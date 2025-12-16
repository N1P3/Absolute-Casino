"""
Inference script for trained Pluribus Poker Transformer.

Usage examples:
    # Basic inference on a single hand
    python inference.py --checkpoint checkpoints/best_model.pt --hand-file example_hand.json
    
    # Interactive mode - input hands manually
    python inference.py --checkpoint checkpoints/best_model.pt --interactive
    
    # Batch inference on multiple hands
    python inference.py --checkpoint checkpoints/best_model.pt --batch-file hands_batch.json
    
    # Show top-k actions with probabilities
    python inference.py --checkpoint checkpoints/best_model.pt --interactive --top-k 3
"""

import argparse
import torch
import torch.nn.functional as F
import json
import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple, Optional

from model import create_model, UNKNOWN_CARD


class PokerInferenceEngine:
    """
    Inference engine for trained Pluribus Poker Transformer.
    
    Handles:
    - Loading trained model from checkpoint
    - Encoding poker game state to model input format
    - Decoding model output to action recommendations
    - Interactive play and batch processing
    """
    
    def __init__(self, checkpoint_path: str, device: str = 'cpu'):
        """
        Initialize inference engine.
        
        Args:
            checkpoint_path: Path to model checkpoint (.pt file)
            device: Device to run inference on ('cpu' or 'cuda')
        """
        self.device = torch.device(device)
        self.checkpoint_path = Path(checkpoint_path)
        
        # Load checkpoint
        print(f"Loading checkpoint: {self.checkpoint_path}")
        checkpoint = torch.load(self.checkpoint_path, map_location=self.device)
        
        # Extract model config - try multiple sources
        model_config = None
        
        # 1. Check if embedded in checkpoint
        if 'model_config' in checkpoint:
            model_config = checkpoint['model_config']
            print("✓ Model config loaded from checkpoint")
        
        # 2. Check for config.json in same directory as checkpoint
        if model_config is None:
            config_path = self.checkpoint_path.parent / 'config.json'
            if config_path.exists():
                import json
                with open(config_path, 'r') as f:
                    full_config = json.load(f)
                    if 'model_config' in full_config:
                        model_config = full_config['model_config']
                        print(f"✓ Model config loaded from {config_path}")
        
        # 3. Fallback to default config
        if model_config is None:
            print("⚠️  Warning: Model config not found, using default config")
            print("   This may cause errors if checkpoint was trained with different config!")
            model_config = {
                'd_model': 512,
                'nhead': 8,
                'num_layers': 6,
                'dim_feedforward': 2048,
                'dropout': 0.1,
            }
            state_dict = {k.replace('_orig_mod.', ''): v for k, v in state_dict.items()}
        # Create model
        print("Creating model...")
        self.model = create_model(model_config)
        
        # Load weights - handle torch.compile() prefix if present
        state_dict = checkpoint['model_state_dict']
        
        # Check if state_dict has _orig_mod prefix (from torch.compile)
        if any(key.startswith('_orig_mod.') for key in state_dict.keys()):
            print("✓ Detected torch.compile() checkpoint, removing _orig_mod prefix...")
            # Remove _orig_mod. prefix from all keys
            state_dict = {k.replace('_orig_mod.', ''): v for k, v in state_dict.items()}
        
        self.model.load_state_dict(state_dict)
        self.model = self.model.to(self.device)
        self.model.eval()  # Set to evaluation mode
        
        print(f"✓ Model loaded successfully")
        print(f"  Epoch: {checkpoint.get('epoch', 'unknown')}")
        print(f"  Best validation accuracy: {checkpoint.get('best_val_accuracy', 'unknown')}")
        print(f"  Device: {self.device}")
        
        # Action names
        self.action_names = ['FOLD', 'CALL', 'RAISE']
        
        # Card encoding
        self.ranks = '23456789TJQKA'
        self.suits = 'shdc'  # spades, hearts, diamonds, clubs
    
    def encode_card(self, card_str: str) -> int:
        """
        Encode card string to index.
        
        Args:
            card_str: Card string like 'Ah' (Ace of hearts) or '??' (unknown)
        
        Returns:
            Card index (0-51 for known cards, 52 for unknown)
        """
        if card_str == '??':
            return 52
        
        rank = card_str[0]
        suit = card_str[1]
        
        rank_idx = self.ranks.index(rank)
        suit_idx = self.suits.index(suit)
        
        return rank_idx * 4 + suit_idx
    
    def decode_card(self, card_idx: int) -> str:
        """Decode card index to string."""
        if card_idx == 52:
            return '??'
        
        rank_idx = card_idx // 4
        suit_idx = card_idx % 4
        
        return self.ranks[rank_idx] + self.suits[suit_idx]
    
    def encode_hand_state(self, hand_state: Dict) -> dict[str, torch.Tensor]:
        """
        Encode hand state to model input format.
        
        Args:
            hand_state: Dictionary containing:
                - hole_cards: List of 2 cards (e.g., ['Ah', 'Ks'])
                - board: List of 0-5 cards (e.g., ['5h', '6d', '7c'])
                - stacks: List of player stacks (e.g., [1000, 1000, 1000, 1000, 1000, 1000])
                - pot: Current pot size (e.g., 150)
                - street: Current street (0=preflop, 1=flop, 2=turn, 3=river)
                - actions: List of previous actions in current street
        
        Returns:
            batch: Dictionary with model inputs
        """
        # Encode hole + board cards as IDs expected by the model/dataset
        hole_cards = hand_state.get('hole_cards', [])
        board_cards = hand_state.get('board', [])

        hole_ids = [self.encode_card(card) for card in hole_cards[:2]]
        hole_ids += [UNKNOWN_CARD] * (2 - len(hole_ids))

        board_ids = [self.encode_card(card) for card in board_cards[:5]]
        board_ids += [UNKNOWN_CARD] * (5 - len(board_ids))

        card_ids = hole_ids + board_ids  # length 7

        # Encode stacks (6 players, normalized by max stack to match training preprocessing)
        stacks = hand_state.get('stacks', [])
        if stacks:
            starting_stack = max(stacks)
        else:
            starting_stack = 1000.0
        stacks_clamped = stacks[:6] + [0.0] * (6 - len(stacks))
        stacks_encoding = np.array(stacks_clamped, dtype=np.float32) / max(starting_stack, 1.0)

        # Encode pot (normalized by same starting stack baseline)
        pot = float(hand_state.get('pot', 0.0))
        pot_encoding = np.array([pot / max(starting_stack, 1.0)], dtype=np.float32)

        # Encode street (one-hot: preflop, flop, turn, river)
        street = int(hand_state.get('street', 0))
        street_encoding = np.zeros(4, dtype=np.float32)
        if 0 <= street < 4:
            street_encoding[street] = 1.0

        static_state = np.concatenate([
            np.array(card_ids, dtype=np.float32),  # 7 card IDs (ints but stored as float)
            stacks_encoding,                      # 6
            pot_encoding,                         # 1
            street_encoding,                      # 4
        ])  # Total: 18
        
        # Encode action sequence
        # Action format: [player_one_hot (6) + action_type_one_hot (3) + amount (1)] = 10 features
        actions = hand_state.get('actions', [])
        max_actions = 20
        action_sequence = np.zeros((max_actions, 10))
        
        for i, action in enumerate(actions[-max_actions:]):  # Take last 20 actions
            player_idx = action.get('player', 0)
            action_type = action.get('type', 0)  # 0=fold, 1=call, 2=raise
            amount = action.get('amount', 0)
            
            # One-hot encode player
            if player_idx < 6:
                action_sequence[i, player_idx] = 1.0
            
            # One-hot encode action type
            if action_type < 3:
                action_sequence[i, 6 + action_type] = 1.0
            
            # Encode amount (normalized by pot)
            current_pot = hand_state.get('pot', 1)
            action_sequence[i, 9] = amount / max(current_pot, 1)
        
        # Convert to tensors
        static_state_tensor = torch.from_numpy(static_state).float().unsqueeze(0)  # [1, 375]
        action_sequence_tensor = torch.from_numpy(action_sequence).float().unsqueeze(0)  # [1, 20, 10]
        
        batch = {
            'static_state': static_state_tensor.to(self.device),
            'action_sequence': action_sequence_tensor.to(self.device),
        }
        
        return batch
    
    @torch.no_grad()
    def predict(
        self,
        hand_state: Dict,
        temperature: float = 1.0,
        top_k: Optional[int] = None,
    ) -> Dict:
        """
        Predict best action for given hand state.
        
        Args:
            hand_state: Hand state dictionary (see encode_hand_state)
            temperature: Sampling temperature (1.0 = normal, <1 = more confident, >1 = more random)
            top_k: If set, return top-k actions with probabilities
        
        Returns:
            Dictionary containing:
                - action: Predicted action name ('FOLD', 'CALL', 'RAISE')
                - action_idx: Action index (0, 1, 2)
                - probability: Probability of predicted action
                - raise_amount: Predicted raise amount (if action=RAISE)
                - all_probabilities: Probabilities for all actions
                - top_k_actions: (Optional) Top-k actions with probabilities
        """
        # Encode hand state
        batch = self.encode_hand_state(hand_state)
        
        # Forward pass
        action_logits, value_pred = self.model(batch)
        
        # Apply temperature scaling
        action_logits = action_logits / temperature
        
        # Get probabilities
        action_probs = F.softmax(action_logits, dim=1)  # [1, 3]
        action_probs_numpy = action_probs.cpu().numpy()[0]  # [3]
        
        # Get top prediction
        action_idx = action_probs.argmax(dim=1).item()
        action_name = self.action_names[action_idx]
        action_prob = action_probs_numpy[action_idx]
        
        # Decode raise amount (model predicts in log-space)
        value_pred_log = value_pred.item()
        raise_amount_pot_multiple = np.exp(value_pred_log)
        raise_amount_pot_multiple = np.clip(raise_amount_pot_multiple, 0.5, 10.0)  # Reasonable range
        
        # Convert to actual chips
        pot = hand_state.get('pot', 0)
        raise_amount = raise_amount_pot_multiple * pot
        
        result = {
            'action': action_name,
            'action_idx': action_idx,
            'probability': float(action_prob),
            'raise_amount': float(raise_amount),
            'raise_amount_pot_multiple': float(raise_amount_pot_multiple),
            'all_probabilities': {
                'FOLD': float(action_probs_numpy[0]),
                'CALL': float(action_probs_numpy[1]),
                'RAISE': float(action_probs_numpy[2]),
            },
        }
        
        # Add top-k if requested
        if top_k is not None:
            top_k_indices = np.argsort(action_probs_numpy)[::-1][:top_k]
            result['top_k_actions'] = [
                {
                    'action': self.action_names[idx],
                    'probability': float(action_probs_numpy[idx]),
                }
                for idx in top_k_indices
            ]
        
        return result
    
    def predict_batch(self, hand_states: List[Dict]) -> List[Dict]:
        """
        Predict actions for multiple hands.
        
        Args:
            hand_states: List of hand state dictionaries
        
        Returns:
            List of prediction dictionaries
        """
        return [self.predict(hand_state) for hand_state in hand_states]
    
    def interactive_mode(self, top_k: int = 3):
        """
        Interactive mode - input hand states and get predictions.
        
        Args:
            top_k: Number of top actions to show
        """
        print("\n" + "=" * 80)
        print("Poker Transformer - Interactive Mode")
        print("=" * 80)
        print("\nEnter hand state in JSON format, or type 'example' to see format")
        print("Type 'quit' to exit\n")
        
        example_hand = {
            "hole_cards": ["Ah", "Ks"],
            "board": [],
            "stacks": [1000, 1000, 1000, 1000, 1000, 1000],
            "pot": 30,
            "street": 0,
            "actions": [
                {"player": 0, "type": 2, "amount": 15},
                {"player": 1, "type": 1, "amount": 15},
            ]
        }
        
        while True:
            try:
                user_input = input(">>> ")
                
                if user_input.lower() == 'quit':
                    break
                
                if user_input.lower() == 'example':
                    print("\nExample hand state:")
                    print(json.dumps(example_hand, indent=2))
                    print("\nExplanation:")
                    print("  - hole_cards: Your 2 cards (e.g., Ah = Ace of hearts)")
                    print("  - board: Community cards (empty for preflop)")
                    print("  - stacks: Chip stacks for all players")
                    print("  - pot: Current pot size")
                    print("  - street: 0=preflop, 1=flop, 2=turn, 3=river")
                    print("  - actions: Previous actions (player index, type: 0=fold/1=call/2=raise, amount)")
                    print()
                    continue
                
                # Parse JSON input
                hand_state = json.loads(user_input)
                
                # Predict
                result = self.predict(hand_state, top_k=top_k)
                
                # Display results
                print("\n" + "-" * 80)
                print(f"Recommended Action: {result['action']} (confidence: {result['probability']:.1%})")
                
                if result['action'] == 'RAISE':
                    print(f"Raise Amount: {result['raise_amount']:.0f} chips ({result['raise_amount_pot_multiple']:.2f}× pot)")
                
                print("\nAll Action Probabilities:")
                for action, prob in result['all_probabilities'].items():
                    bar_length = int(prob * 50)
                    bar = '█' * bar_length + '░' * (50 - bar_length)
                    print(f"  {action:6s} {bar} {prob:.1%}")
                
                if 'top_k_actions' in result:
                    print(f"\nTop {top_k} Actions:")
                    for i, action_info in enumerate(result['top_k_actions'], 1):
                        print(f"  {i}. {action_info['action']:6s} - {action_info['probability']:.1%}")
                
                print("-" * 80 + "\n")
                
            except json.JSONDecodeError as e:
                print(f"Error: Invalid JSON format: {e}")
            except KeyboardInterrupt:
                print("\nExiting...")
                break
            except Exception as e:
                print(f"Error: {e}")
                import traceback
                traceback.print_exc()