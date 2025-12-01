import argparse
import torch
import numpy as np
from pathlib import Path
import json
from model import create_model
from environment import PokerKitEnvironment

def load_model(checkpoint_path, device):
    print(f"Loading model from {checkpoint_path}...")
    checkpoint = torch.load(checkpoint_path, map_location=device)
    
    # Try to find config
    model_config = checkpoint.get('model_config')
    if not model_config:
        # Default config
        model_config = {
            'd_model': 512,
            'nhead': 8,
            'num_layers': 6,
            'dim_feedforward': 2048,
            'dropout': 0.1,
            'static_state_dim': 20  # Ensure we use the new dim
        }
    
    # Create model
    model = create_model(model_config)
    
    # Load state dict
    state_dict = checkpoint['model_state_dict']
    # Remove compile prefix if present
    state_dict = {k.replace('_orig_mod.', ''): v for k, v in state_dict.items()}
    
    try:
        model.load_state_dict(state_dict)
    except RuntimeError as e:
        print(f"Warning: Strict loading failed ({e}). Trying strict=False...")
        model.load_state_dict(state_dict, strict=False)
        
    model.to(device)
    model.eval()
    return model

def format_cards(cards):
    return " ".join(cards) if cards else "None"

def main():
    parser = argparse.ArgumentParser(description="Test model predictions on 30 random hands")
    parser.add_argument('--checkpoint', type=str, required=True, help='Path to model checkpoint')
    parser.add_argument('--device', type=str, default='cuda' if torch.cuda.is_available() else 'cpu')
    parser.add_argument('--players', type=int, default=2, help='Number of players (2-6)')
    args = parser.parse_args()

    # Load model
    try:
        model = load_model(args.checkpoint, args.device)
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    # Initialize environment
    env = PokerKitEnvironment(
        starting_stack=1000,
        player_count=args.players
    )
    
    print("\n" + "="*180)
    print(f"{'HAND':<10} | {'BOARD':<15} | {'STREET':<8} | {'POS':<3} | {'EQ':<5} | {'LAST ACTIONS':<30} | {'PROBS (F/C/R)':<20} | {'RAW PROBS':<20} | {'MASK':<5} | {'DEC':<6} | {'SIZE'}")
    print("="*180)

    hands_shown = 0
    target_hands = 30
    
    while hands_shown < target_hands:
        state = env.reset()
        done = False
        
        while not done:
            if state['player_idx'] == 0: # Only show Hero's decisions
                # Encode state
                # We need to manually construct the batch as in train_rl_pokerkit.py
                # Re-using the logic from the trainer would be best, but let's implement a simple encoder here
                # to avoid importing the whole Trainer class.
                
                # 1. Static State (20 dim)
                static_vec = torch.zeros(1, 20, device=args.device)
                
                # Cards
                hole_cards = state['hole_cards']
                board = state['board']
                
                # Helper to encode card
                def encode_card(c, idx):
                    if not c: return 52
                    # Clean string: remove brackets, whitespace
                    c = c.replace('[', '').replace(']', '').strip().lower()
                    # Handle 10 -> t
                    if c.startswith('10'):
                        c = 't' + c[2:]
                    
                    ranks = '23456789tjqka'
                    suits = 'shdc'
                    
                    if len(c) < 2: return 52 # Invalid
                    
                    try:
                        r = ranks.index(c[0])
                        s = suits.index(c[1])
                        return r * 4 + s
                    except ValueError:
                        return 52 # Unknown/Error

                for i, c in enumerate(hole_cards[:2]): static_vec[0, i] = encode_card(c, i)
                for i, c in enumerate(board[:5]): static_vec[0, 2+i] = encode_card(c, i)
                # Fill rest with 52 (unknown)
                for i in range(len(hole_cards), 2): static_vec[0, i] = 52
                for i in range(len(board), 5): static_vec[0, 2+i] = 52
                
                # Scalars
                stacks = torch.tensor(state['stacks'], device=args.device)
                # Pad stacks to 6 players
                if len(stacks) < 6:
                    padding = torch.zeros(6 - len(stacks), device=args.device)
                    stacks = torch.cat([stacks, padding])
                
                # Log scaling for stacks and pot (matches training)
                log_start = np.log(env.starting_stack + 1)
                
                # Stacks
                static_vec[0, 7:13] = torch.log(torch.clamp(stacks[:6], min=0) + 1) / log_start
                
                # Pot
                static_vec[0, 13] = np.log(max(0, state['pot']) + 1) / log_start
                if state['street'] < 4: static_vec[0, 14 + state['street']] = 1.0
                static_vec[0, 18] = state.get('equity', 0.5)
                static_vec[0, 19] = state.get('pot_odds', 0.0)
                
                # 2. Action Sequence
                action_seq = torch.zeros(1, 20, 10, device=args.device)
                for i, act in enumerate(state['actions'][-20:]):
                    if act['player'] < 6: action_seq[0, i, act['player']] = 1.0
                    if act['type'] < 3: action_seq[0, i, 6 + act['type']] = 1.0
                    # Log scale amount
                    action_seq[0, i, 9] = np.log(max(0, act['amount']) + 1) / log_start

                batch = {
                    'static_state': static_vec,
                    'action_sequence': action_seq
                }
                
                # Inference
                with torch.no_grad():
                    action_logits, value_pred = model(batch)
                    probs = torch.softmax(action_logits, dim=1)[0]
                    
                    # Mask invalid
                    valid_actions = env.get_valid_actions()
                    mask = torch.zeros(3, device=args.device)
                    for a in valid_actions: mask[a] = 1.0
                    
                    masked_probs = probs * mask
                    masked_probs /= masked_probs.sum()
                    
                    decision_idx = masked_probs.argmax().item()
                    decision_str = ['FOLD', 'CALL', 'RAISE'][decision_idx]
                    
                    bet_size = 0.0
                    if decision_idx == 2:
                        bet_size = torch.exp(value_pred).item()
                
                # Get position and last action
                position = "SB" if state['player_idx'] == 0 else "BB" # Heads-up: Dealer is SB
                
                # Format last actions
                last_actions = []
                for act in state['actions'][-3:]: # Show last 3 actions
                    p_name = "Hero" if act['player'] == 0 else "Villain"
                    type_str = ['FOLD', 'CALL', 'RAISE'][act['type']]
                    amt = f"{act['amount']:.1f}" if act['amount'] > 0 else ""
                    last_actions.append(f"{p_name}:{type_str}{amt}")
                action_hist = " -> ".join(last_actions)
                
                # Print row
                probs_str = f"{masked_probs[0]:.2f}/{masked_probs[1]:.2f}/{masked_probs[2]:.2f}"
                raw_probs_str = f"{probs[0]:.2f}/{probs[1]:.2f}/{probs[2]:.2f}"
                mask_str = f"{int(mask[0])}/{int(mask[1])}/{int(mask[2])}"
                equity_str = f"{state.get('equity', 0.0):.2f}"
                bet_str = f"{bet_size:.2f}x" if decision_idx == 2 else "-"
                
                print(f"{format_cards(hole_cards):<10} | {format_cards(board):<15} | {state['street_name']:<8} | {position:<3} | {equity_str:<5} | {action_hist:<30} | {probs_str:<20} | {raw_probs_str:<20} | {mask_str:<5} | {decision_str:<6} | {bet_str}")
                
                hands_shown += 1
                if hands_shown >= target_hands:
                    break
            
            # Step environment randomly to progress
            valid = env.get_valid_actions()
            if not valid: break
            act = np.random.choice(valid)
            state, _, done, _ = env.step(act)

    print("="*100)

if __name__ == "__main__":
    main()
