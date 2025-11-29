"""
train_mcts_pokerkit.py

Monte‑Carlo Tree Search (MCTS) reinforcement learning for the Poker Transformer
model using the PokerKit environment.

This script implements a minimal AlphaZero‑style training loop:

1. Load a supervised‑pre‑trained model checkpoint.
2. For each training iteration:
   a. Self‑play a number of episodes using MCTS to select actions.
   b. Record (state, MCTS policy, final reward) for every move.
   c. Compute a policy loss (KL between MCTS policy & network policy) and a
      value loss (MSE between network value & game outcome).
   d. Perform a gradient step on the model.
3. Periodically evaluate against the PPO baseline and save checkpoints.

The implementation focuses on core functionality; further optimisations
(parallel simulations, virtual loss, opponent‑pool updates, etc.) can be added
later.
"""

import argparse
import json
import os
from pathlib import Path
from datetime import datetime

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.tensorboard import SummaryWriter
from tqdm import tqdm

# --------------------------------------------------------------------------- #
# Imports from the existing codebase
# --------------------------------------------------------------------------- #
from model import create_model, PluribusPokerTransformer
from train_rl_pokerkit import PokerKitEnvironment, PPOTrainer
from mcts.mcts_engine import MCTSEngine

# --------------------------------------------------------------------------- #
# Helper utilities
# --------------------------------------------------------------------------- #
def load_pretrained_model(checkpoint_path: str, device: torch.device):
    """Load a supervised checkpoint and return a model on the given device."""
    checkpoint = torch.load(checkpoint_path, map_location=device)
    model_cfg = checkpoint.get('model_config')
    if model_cfg is None:
        # Fallback to config.json next to the checkpoint
        cfg_path = Path(checkpoint_path).parent / 'config.json'
        if cfg_path.exists():
            with open(cfg_path, 'r') as f:
                model_cfg = json.load(f)
    if model_cfg is None:
        # Use default config if none found
        model_cfg = {
            'd_model': 512,
            'nhead': 8,
            'num_layers': 6,
            'dim_feedforward': 2048,
            'dropout': 0.1,
        }
    # Filter out any unexpected keys (e.g., 'dataset') that the model constructor does not accept
    valid_keys = {'d_model', 'nhead', 'num_layers', 'dim_feedforward', 'dropout'}
    filtered_cfg = {k: v for k, v in model_cfg.items() if k in valid_keys}
    model = create_model(filtered_cfg)
    state_dict = checkpoint['model_state_dict']
    # Strip possible torch.compile prefix
    if any(k.startswith('_orig_mod.') for k in state_dict.keys()):
        state_dict = {k.replace('_orig_mod.', ''): v for k, v in state_dict.items()}
    model.load_state_dict(state_dict)
    model.to(device)
    model.train()
    return model

def compute_policy_loss(mcts_policy, net_policy):
    """
    KL divergence between MCTS visit distribution and network policy.
    Both inputs are numpy arrays of shape (3,).
    """
    mcts = torch.tensor(mcts_policy, dtype=torch.float32, device=net_policy.device)
    net = net_policy.squeeze(0)  # shape (3,)
    # Add a small epsilon to avoid log(0)
    eps = 1e-8
    loss = torch.sum(mcts * (torch.log(mcts + eps) - torch.log(net + eps)))
    return loss

def compute_value_loss(net_value, reward):
    """
    Mean‑squared error between network value prediction and final reward.
    reward is a scalar (float) from the perspective of player 0.
    """
    target = torch.tensor([reward], dtype=torch.float32, device=net_value.device)
    loss = F.mse_loss(net_value.squeeze(-1), target)
    return loss

def evaluate_against_ppo(model, device, eval_episodes=50):
    """
    Simple head‑to‑head evaluation: play `eval_episodes` hands where the
    MCTS‑based player (using the current model) faces the PPO baseline
    (loaded from the same checkpoint). Returns win rate.
    """
    # Load PPO trainer to reuse its opponent pool (which contains the base model)
    # We instantiate a dummy trainer just to get the base model.
    dummy_args = argparse.Namespace(
        checkpoint='', device=str(device), episodes=0, batch_size=0,
        lr=0, gamma=1.0, gae_lambda=0.95, clip_epsilon=0.25,
        ppo_epochs=1, target_kl=0.02, entropy_coef=0.02,
        temperature=1.2, baseline_frac=0.15, randomize_stacks=False,
        use_amp=False, pool_size=5, update_pool_every=500,
        eval_every=100, save_every=500, log_dir='runs_eval',
        output_dir='checkpoints_eval', resume=None
    )
    # Re‑use the PPOTrainer class to get a baseline model (the first in the pool)
    # We only need the base model for evaluation.
    optimizer = torch.optim.AdamW(model.parameters(), lr=1e-5)
    ppo_trainer = PPOTrainer(
        model=model,
        optimizer=optimizer,
        device=device,
        opponent_pool_size=5,
        output_dir='tmp_eval',
        log_dir='tmp_eval',
        gamma=1.0,
        gae_lambda=0.95,
        clip_epsilon=0.25,
        entropy_coef=0.02,
        value_coef=0.75,
        max_grad_norm=0.5,
        ppo_epochs=1,
        target_kl=0.02,
        use_amp=False,
        temperature=1.2,
        baseline_frac=0.15,
        randomize_stacks=False,
    )
    # The base model is stored in ppo_trainer.base_model
    baseline_model = ppo_trainer.base_model
    baseline_model.eval()

    mcts_engine = MCTSEngine(model=model, device=device, num_simulations=100)

    wins = 0
    for _ in range(eval_episodes):
        env = PokerKitEnvironment()
        state = env.reset()
        done = False
        while not done:
            # MCTS player (player 0)
            if state['player_idx'] == 0:
                policy, _ = mcts_engine.search(state)

                # If no valid actions (policy sum zero), end the hand
                if policy.sum() == 0:
                    break

                # Sample action from MCTS policy
                action = np.random.choice([0, 1, 2], p=policy)

                # Ensure selected action is valid; if not, fallback to call or fold
                valid = state.get('valid_actions', [])
                if action == 2 and 2 not in valid:
                    # Prefer call if available, otherwise fold
                    action = 1 if 1 in valid else 0

                # Additional safety: if raise selected but no raise amount possible, treat as call
                if action == 2 and state.get('to_call', 0) == 0:
                    action = 1

                raise_amount = None
                # Compute raise amount only if raise action is valid
                if action == 2 and 2 in state.get('valid_actions', []):
                    # Use model's value head as raise multiplier (as in PPO)
                    _, value_pred = model(mcts_engine._encode_state(state))
                    raise_amount = float(torch.exp(value_pred).item())
                else:
                    raise_amount = None

                # Final safety: if action is still raise but raise_amount is None, treat as call
                if action == 2 and raise_amount is None:
                    action = 1
                    raise_amount = None

                next_state, _, done, _ = env.step(action, raise_amount)
                state = next_state
            else:
                # Baseline opponent uses the base model (deterministic)
                action, raise_amount, _ = ppo_trainer.select_action(state, model=baseline_model, deterministic=True)
                next_state, _, done, _ = env.step(action, raise_amount)
                state = next_state

        # Determine winner from final reward
        final_reward = env._compute_rewards()[0]  # reward for player 0
        if final_reward > 0:
            wins += 1

    win_rate = wins / eval_episodes
    return win_rate

# --------------------------------------------------------------------------- #
# Main training loop
# --------------------------------------------------------------------------- #
def main():
    parser = argparse.ArgumentParser(description='MCTS RL training for Poker Transformer')
    parser.add_argument('--checkpoint', type=str, required=True,
                        help='Path to supervised pre‑trained model checkpoint')
    parser.add_argument('--device', type=str, default='cuda' if torch.cuda.is_available() else 'cpu')
    parser.add_argument('--episodes', type=int, default=50000,
                        help='Total number of self‑play episodes')
    parser.add_argument('--batch-size', type=int, default=32,
                        help='Number of episodes per training batch')
    parser.add_argument('--num-simulations', type=int, default=100,
                        help='MCTS simulations per move')
    parser.add_argument('--lr', type=float, default=2e-5,
                        help='Learning rate')
    parser.add_argument('--eval-every', type=int, default=1000,
                        help='Evaluate against PPO baseline every N episodes')
    parser.add_argument('--save-every', type=int, default=500,
                        help='Save checkpoint every N episodes')
    parser.add_argument('--output-dir', type=str, default='checkpoints_mcts',
                        help='Directory to store checkpoints')
    parser.add_argument('--log-dir', type=str, default=None,
                        help='TensorBoard log directory')
    args = parser.parse_args()

    device = torch.device(args.device)

    # ------------------------------------------------------------------- #
    # Model & optimizer
    # ------------------------------------------------------------------- #
    model = load_pretrained_model(args.checkpoint, device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)

    # ------------------------------------------------------------------- #
    # MCTS engine
    # ------------------------------------------------------------------- #
    mcts_engine = MCTSEngine(model=model, device=device,
                             c_puct=1.0, num_simulations=args.num_simulations)

    # ------------------------------------------------------------------- #
    # Logging / checkpointing
    # ------------------------------------------------------------------- #
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    if args.log_dir is None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        log_dir = f'runs_mcts/run_{timestamp}'
    else:
        log_dir = args.log_dir
    writer = SummaryWriter(log_dir)

    # ------------------------------------------------------------------- #
    # Training state
    # ------------------------------------------------------------------- #
    total_steps = 0
    best_win_rate = 0.0

    # ------------------------------------------------------------------- #
    # Main loop
    # ------------------------------------------------------------------- #
    env = PokerKitEnvironment()
    pbar = tqdm(range(0, args.episodes, args.batch_size), desc='MCTS Training')
    for batch_start in pbar:
        batch_end = min(batch_start + args.batch_size, args.episodes)
        batch_size = batch_end - batch_start

        # ---------------------------------------------------------------- #
        # Self‑play collection
        # ---------------------------------------------------------------- #
        batch_states = []      # list of state dicts
        batch_policies = []    # list of MCTS visit distributions (np.ndarray shape (3,))
        batch_rewards = []     # final reward for player 0 (scalar)

        for _ in range(batch_size):
            # Play one episode
            episode_states = []
            episode_policies = []

            state = env.reset()
            done = False
            while not state['done']:
                # Run MCTS from current state
                policy, _ = mcts_engine.search(state)
                episode_states.append(state)
                episode_policies.append(policy)

                # If no valid actions (policy sum zero), end the hand
                if policy.sum() == 0:
                    break

                # Sample action from MCTS policy (no temperature for now)
                action = np.random.choice([0, 1, 2], p=policy)

                # Ensure selected action is valid; if not, fallback to call or fold
                valid = state.get('valid_actions', [])
                if action == 2 and 2 not in valid:
                    # Prefer call if available, otherwise fold
                    action = 1 if 1 in valid else 0

                # Additional safety: if already matched (to_call == 0), treat raise as call
                if action == 2 and state.get('to_call', 0) == 0:
                    action = 1

                raise_amount = None
                # Compute raise amount only if raise action is valid
                if action == 2 and 2 in state.get('valid_actions', []):
                    # Use model's value head as raise multiplier (consistent with PPO)
                    _, value_pred = model(mcts_engine._encode_state(state))
                    raise_amount = float(torch.exp(value_pred).item())
                else:
                    raise_amount = None

                state, _, done, _ = env.step(action, raise_amount)

            # Episode finished – get final reward for player 0
            final_reward = env._compute_rewards()[0]

            # Store episode data
            batch_states.extend(episode_states)
            batch_policies.extend(episode_policies)
            batch_rewards.extend([final_reward] * len(episode_states))

        # ---------------------------------------------------------------- #
        # Training on collected batch
        # ---------------------------------------------------------------- #
        optimizer.zero_grad()
        total_policy_loss = 0.0
        total_value_loss = 0.0

        for state_dict, mcts_policy, reward in zip(batch_states, batch_policies, batch_rewards):
            # Encode state and run network forward pass
            batch = mcts_engine._encode_state(state_dict)
            action_logits, value_pred = model(batch)

            # Compute losses
            policy_loss = compute_policy_loss(mcts_policy, action_logits)
            value_loss = compute_value_loss(value_pred, reward)

            loss = policy_loss + value_loss
            loss.backward()

            total_policy_loss += policy_loss.item()
            total_value_loss += value_loss.item()

        # Gradient clipping & optimizer step
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=0.5)
        optimizer.step()

        total_steps += batch_size

        # ---------------------------------------------------------------- #
        # Logging
        # ---------------------------------------------------------------- #
        avg_policy_loss = total_policy_loss / batch_size
        avg_value_loss = total_value_loss / batch_size
        pbar.set_postfix({
            'policy_loss': f'{avg_policy_loss:.3f}',
            'value_loss': f'{avg_value_loss:.3f}',
        })
        writer.add_scalar('train/policy_loss', avg_policy_loss, total_steps)
        writer.add_scalar('train/value_loss', avg_value_loss, total_steps)

        # ---------------------------------------------------------------- #
        # Evaluation
        # ---------------------------------------------------------------- #
        if total_steps % args.eval_every == 0:
            win_rate = evaluate_against_ppo(model, device, eval_episodes=50)
            writer.add_scalar('eval/win_rate', win_rate, total_steps)
            print(f'\n[Step {total_steps}] Eval vs PPO: win_rate={win_rate:.2%}')
            if win_rate > best_win_rate:
                best_win_rate = win_rate
                ckpt_path = output_dir / f'best_model_step_{total_steps}.pt'
                torch.save({
                    'step': total_steps,
                    'model_state_dict': model.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'best_win_rate': best_win_rate,
                }, ckpt_path)
                print(f'  ✓ New best model saved to {ckpt_path}')

        # ---------------------------------------------------------------- #
        # Checkpointing
        # ---------------------------------------------------------------- #
        if total_steps % args.save_every == 0:
            ckpt_path = output_dir / f'checkpoint_step_{total_steps}.pt'
            torch.save({
                'step': total_steps,
                'model_state_dict': model.state_dict(),
                'optimizer_state_dict': optimizer.state_dict(),
                'best_win_rate': best_win_rate,
            }, ckpt_path)
            print(f'  ✓ Checkpoint saved to {ckpt_path}')

    writer.close()
    print('\nTraining complete!')


if __name__ == '__main__':
    main()