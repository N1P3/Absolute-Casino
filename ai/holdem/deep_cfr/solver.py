import torch
import torch.nn as nn
import torch.nn.functional as F
import numpy as np
from typing import Dict, List, Tuple, Optional
import copy

from environment import PokerKitEnvironment
from model import PluribusPokerTransformer
from .memory import ReservoirBuffer

class DeepCFRSolver:
    """
    Deep Counterfactual Regret Minimization Solver.
    
    Implements External Sampling MCCFR with neural network approximation.
    """
    
    def __init__(
        self,
        adv_model: PluribusPokerTransformer,
        strat_model: PluribusPokerTransformer,
        device: torch.device,
        memory_capacity: int = 1000000,
        batch_size: int = 1024,
    ):
        self.adv_model = adv_model
        self.strat_model = strat_model
        self.device = device
        self.batch_size = batch_size
        
        # Initialize buffers
        # Target size 3 for 3 actions (Fold, Call, Raise)
        self.adv_buffer = ReservoirBuffer(memory_capacity, device, (0,), 3)
        self.strat_buffer = ReservoirBuffer(memory_capacity, device, (0,), 3)
        
        self.env = PokerKitEnvironment()
        
        # Preallocate tensors for encoding
        self._static_state_buffer = torch.zeros(1, 18, device=self.device, dtype=torch.float32)
        self._action_seq_buffer = torch.zeros(1, 20, 10, device=self.device, dtype=torch.float32)

    def _encode_state(self, state: Dict) -> Dict:
        """Encode state to model input format (reused from PPOTrainer)."""
        # Zero out buffers
        self._static_state_buffer.zero_()
        self._action_seq_buffer.zero_()
        
        static = self._static_state_buffer[0]
        action_seq = self._action_seq_buffer[0]
        
        # Encode hole cards
        hole_cards = state['hole_cards']
        for i, card in enumerate(hole_cards[:2]):
            if len(card) >= 2:
                card_lower = card.lower()
                if card_lower in self.env.card_index_cache:
                    static[i] = float(self.env.card_index_cache[card_lower])
                else:
                    static[i] = 52.0
            else:
                static[i] = 52.0
        
        # Encode board
        board = state.get('board', [])
        for i, card in enumerate(board[:5]):
            if len(card) >= 2:
                card_lower = card.lower()
                if card_lower in self.env.card_index_cache:
                    static[2 + i] = float(self.env.card_index_cache[card_lower])
                else:
                    static[2 + i] = 52.0
            else:
                static[2 + i] = 52.0
        
        # Stacks
        stacks = state['stacks']
        for i, stack in enumerate(stacks[:6]):
            static[7 + i] = stack / self.env.starting_stack
        
        # Pot
        static[13] = state['pot'] / self.env.starting_stack
        
        # Street
        street = state['street']
        if street < 4:
            static[14 + street] = 1.0
        
        # Actions
        actions = state.get('actions', [])
        for i, action in enumerate(actions[-20:]):
            player_idx = action.get('player', 0)
            action_type = action.get('type', 0)
            amount = action.get('amount', 0)
            
            if player_idx < 6:
                action_seq[i, player_idx] = 1.0
            if action_type < 3:
                action_seq[i, 6 + action_type] = 1.0
            
            current_pot = state.get('pot', 1)
            action_seq[i, 9] = amount / max(current_pot, 1)
            
        return {
            'static_state': self._static_state_buffer,
            'action_sequence': self._action_seq_buffer,
        }

    def _get_strategy(self, model: PluribusPokerTransformer, state: Dict, valid_actions: List[int]) -> np.ndarray:
        """Get strategy from model (regret matching or average strategy)."""
        batch = self._encode_state(state)
        with torch.no_grad():
            # Model outputs logits. For advantage net, these are advantages.
            # For strategy net, these are probabilities (if trained with CrossEntropy) 
            # or just logits to be softmaxed.
            # Deep CFR usually predicts advantages directly.
            logits, _ = model(batch)
            logits = logits[0].cpu().numpy()
            
        # Regret Matching
        # Relu(advantages) / sum(Relu(advantages))
        advantages = logits
        
        # Mask invalid actions
        mask = np.zeros(3)
        mask[valid_actions] = 1.0
        
        # Regret matching
        positive_regrets = np.maximum(advantages, 0.0)
        positive_regrets *= mask
        sum_pos_regret = positive_regrets.sum()
        
        if sum_pos_regret > 0:
            strategy = positive_regrets / sum_pos_regret
        else:
            # Uniform over valid actions
            strategy = mask / mask.sum()
            
        return strategy

    def traverse(self, iteration: int, traverser: int):
        """
        Perform one external sampling traversal.
        
        Args:
            iteration: Current iteration number (t).
            traverser: The player updating their regrets (0 or 1).
        """
        self.env.reset()
        self._traverse_recursive(self.env.state, traverser, iteration)

    def _traverse_recursive(self, pokerkit_state, traverser: int, iteration: int):
        """
        Recursive traversal.
        
        Note: We need to be careful with PokerKit state cloning or just use the environment wrapper
        to manage state. Since PokerKit state is mutable and complex, we might need to
        rely on `env.step` and backtracking or just play out one trajectory per call (External Sampling).
        
        External Sampling MCCFR:
        - Sample chance nodes (board cards).
        - Sample opponent actions according to their strategy.
        - Traverse ALL actions for the traverser.
        
        However, standard External Sampling requires branching at the traverser's nodes.
        PokerKit doesn't easily support branching (cloning states can be heavy).
        
        Alternative: Outcome Sampling (one path).
        Or: Re-implement a lightweight state or use `env` carefully.
        
        Let's use a modified External Sampling where we only branch at the top-level or 
        just use Outcome Sampling for simplicity first, or stick to the plan of "Traversals".
        
         actually, Deep CFR paper uses External Sampling.
        "Traverse the game tree... at traverser nodes, iterate over all actions... at opponent nodes, sample one action."
        
        To do this with PokerKit, we need to be able to clone the state.
        `state.clone()` exists in PokerKit? Let's check or assume yes.
        If not, we might have to rely on `create_state` from history.
        
        Let's assume we can clone for now. If not, we will fix it.
        """
        # Build our state dict wrapper
        # We need a temporary env to wrap this state to get valid actions etc.
        # This is a bit hacky. A better way is to pass the env around.
        # But `env.state` is the source of truth.
        
        # Check terminal
        if not self.env.state.status:
            # Terminal
            rewards = self.env._compute_rewards()
            return rewards[traverser]
            
        current_player = self.env.state.actor_index
        if current_player is None:
            # Chance node or something? PokerKit handles chance internally usually.
            # If actor_index is None but status is True, it might be a chance event waiting?
            # PokerKit usually automates chance.
            # If we are here, it's a player node.
            return 0.0

        valid_actions = self.env.get_valid_actions()
        if not valid_actions:
            return 0.0
            
        # Get current state dict for model
        state_dict = self.env._build_state_dict()
        
        if current_player == traverser:
            # Traverser node: Iterate over ALL valid actions
            # We need the strategy to weight the values? No, External Sampling doesn't weight traverser actions.
            # We just need the strategy to compute regrets.
            
            # Get strategy from Advantage Network
            strategy = self._get_strategy(self.adv_model, state_dict, valid_actions)
            
            # Values for each action
            action_values = np.zeros(3)
            
            # We need to clone the state to explore all branches
            # PokerKit state is a `NoLimitTexasHoldem` object (or similar).
            # We can try `copy.deepcopy`.
            original_state = self.env.state
            
            for action in valid_actions:
                # Clone environment state
                # self.env.state = copy.deepcopy(original_state) # This might be slow
                # Optimization: Use a lighter way if possible.
                
                # Actually, for Deep CFR with neural nets, we often just do Monte Carlo Counterfactual Regret Minimization (MCCFR).
                # External Sampling is efficient.
                
                # Execute action
                # We need to handle raise amounts.
                # For simplicity in this version, we assume fixed raise sizes or just one raise size.
                # The model outputs 3 actions. If raise is chosen, we need a size.
                # We can assume pot-sized raise for now to keep the tree manageable.
                
                raise_amount = 1.0 # Pot size
                
                # Step
                # We need to restore state after step.
                # Since we can't easily "undo", cloning is necessary.
                self.env.state = copy.deepcopy(original_state)
                self.env.step(action, raise_amount)
                
                # Recurse
                val = self._traverse_recursive(None, traverser, iteration) # Recursive call
                action_values[action] = val
                
            # Restore state
            self.env.state = original_state
            
            # Compute Regrets
            # Value of node = sum(strategy * action_values)
            node_value = np.dot(strategy, action_values)
            
            regrets = action_values - node_value
            
            # Store in Advantage Buffer
            # Weight = iteration t (linear weighting)
            # Deep CFR uses t^alpha usually, or just t.
            weight = float(iteration)
            
            # Add to buffer
            # We need to get the encoded tensors again or cache them. 
            # _encode_state puts them in self._static_state_buffer
            # We should copy them to CPU for the buffer
            
            static_cpu = self._static_state_buffer[0].cpu().clone()
            action_seq_cpu = self._action_seq_buffer[0].cpu().clone()
            target_cpu = torch.tensor(regrets, dtype=torch.float32)
            
            self.adv_buffer.add(static_cpu, action_seq_cpu, target_cpu, weight)
            
            # Also add to Strategy Buffer (Average Strategy)
            # Target = strategy
            strat_cpu = torch.tensor(strategy, dtype=torch.float32)
            self.strat_buffer.add(static_cpu, action_seq_cpu, strat_cpu, weight)
            
            return node_value
            
        else:
            # Opponent node: Sample ONE action
            # Get strategy
            strategy = self._get_strategy(self.adv_model, state_dict, valid_actions)
            
            # Sample action
            action = np.random.choice(3, p=strategy)
            
            # Step
            raise_amount = 1.0
            self.env.step(action, raise_amount)
            
            # Recurse
            val = self._traverse_recursive(None, traverser, iteration)
            
            return val

    def train_advantage(self, steps=1000):
        """Train Advantage Network."""
        self.adv_model.train()
        optimizer = torch.optim.Adam(self.adv_model.parameters(), lr=1e-4)
        
        for _ in range(steps):
            batch = self.adv_buffer.sample(self.batch_size)
            if not batch:
                break
                
            # Forward
            logits, _ = self.adv_model(batch)
            
            # Loss = Weighted MSE
            # target is regrets
            target = batch['target']
            weights = batch['weight']
            
            loss = (weights * (logits - target) ** 2).mean()
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            
    def train_strategy(self, steps=1000):
        """Train Strategy Network."""
        self.strat_model.train()
        optimizer = torch.optim.Adam(self.strat_model.parameters(), lr=1e-4)
        
        for _ in range(steps):
            batch = self.strat_buffer.sample(self.batch_size)
            if not batch:
                break
                
            # Forward
            logits, _ = self.strat_model(batch)
            
            # Loss = Weighted MSE on probabilities
            # target is strategy probabilities
            target = batch['target']
            weights = batch['weight']
            
            # Note: Model outputs logits. We should probably softmax them if we want probs.
            # But Deep CFR usually trains on the probabilities directly using MSE.
            # So we might want the model to output raw values and interpret them as logits for regret matching,
            # but for the strategy net, we might want a Softmax layer?
            # Or just treat logits as "unnormalized probs" and use CrossEntropy?
            # Deep CFR paper: "The strategy network is trained to minimize the MSE between its output and the average strategy."
            # So we should probably use Softmax on logits to get probs, then MSE?
            # Or just have the model output probs directly (Sigmoid/Softmax)?
            # PluribusPokerTransformer outputs logits.
            
            probs = F.softmax(logits, dim=1)
            loss = (weights * (probs - target) ** 2).mean()
            
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
