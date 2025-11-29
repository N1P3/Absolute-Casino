import numpy as np
from typing import Dict, List, Tuple, Optional
from pokerkit import Automation, NoLimitTexasHoldem

class PokerKitEnvironment:
    """
    Poker environment wrapper using PokerKit library.
    
    Handles:
    - 2-player heads-up No-Limit Texas Hold'em
    - Full game simulation (preflop, flop, turn, river)
    - Action validation
    - Proper hand evaluation
    - Reward computation
    """
    
    def __init__(
        self,
        starting_stack: int = 1000,
        small_blind: int = 5,
        big_blind: int = 10,
        randomize_stacks: bool = True,
        player_count: int = 2,
    ):
        self.starting_stack = starting_stack
        self.small_blind = small_blind
        self.big_blind = big_blind
        self.randomize_stacks = randomize_stacks
        self.player_count = player_count
        
        # Card encoding
        self.ranks = '23456789TJQKA'
        self.suits = 'shdc'
        
        # Pre-compute card index mapping for faster encoding
        self.card_index_cache = {}
        for rank_idx, rank in enumerate(self.ranks):
            for suit_idx, suit in enumerate(self.suits):
                card_str = f"{rank}{suit}"
                self.card_index_cache[card_str.lower()] = rank_idx * 4 + suit_idx
        
        # Create PokerKit game instance (using create_state method)
        # We'll create states on each reset, not use a game factory
        self.automations = (
            Automation.ANTE_POSTING,
            Automation.BET_COLLECTION,
            Automation.BLIND_OR_STRADDLE_POSTING,
            Automation.CARD_BURNING,
            Automation.HOLE_DEALING,
            Automation.BOARD_DEALING,
            Automation.HOLE_CARDS_SHOWING_OR_MUCKING,
            Automation.HAND_KILLING,
            Automation.CHIPS_PUSHING,
            Automation.CHIPS_PULLING,
        )
        
    def reset(self) -> Dict:
        """
        Reset environment for new hand.
        
        Returns:
            Initial state dictionary
        """
        # Randomize starting stacks to match training distribution (mean ~0.33)
        if self.randomize_stacks:
            # Sample stacks from distribution similar to training data
            # Training data has mean 0.327, std 0.465, range 0-0.9975
            # This suggests many depleted stacks (hence median close to 0)
            # Use beta distribution or truncated normal to match
            stack_multiplier1 = np.random.beta(1.2, 2.0)  # Skewed toward lower values
            stack_multiplier2 = np.random.beta(1.2, 2.0)
            # Generate starting stacks for all players
            stacks = []
            for _ in range(self.player_count):
                mult = np.random.beta(1.2, 2.0)
                stacks.append(max(int(self.starting_stack * mult), self.big_blind * 2))
        else:
            stacks = [self.starting_stack] * self.player_count
        
        # Create new game state using NoLimitTexasHoldem.create_state
        # Ensure starting stacks tuple matches player count
        raw_starting_stacks = tuple(stacks)

        self.state = NoLimitTexasHoldem.create_state(
            automations=self.automations,
            ante_trimming_status=True,  # Uniform antes
            raw_antes=0,  # No ante
            raw_blinds_or_straddles=(self.small_blind, self.big_blind),
            min_bet=self.big_blind,
            raw_starting_stacks=raw_starting_stacks,
            player_count=self.player_count,
        )
        
        # Track initial stacks for reward computation
        self.initial_stacks = list(self.state.stacks)
        
        # Build initial state representation
        return self._build_state_dict()
    
    def _build_state_dict(self) -> Dict:
        """
        Build state dictionary from PokerKit state.
        
        Returns:
            State dict compatible with model input
        """
        # Get current player index
        if self.state.actor_index is not None:
            current_player = self.state.actor_index
        else:
            current_player = 0  # Default when no actor (hand finished)
        
        # Get hole cards for current player
        hole_cards = self.state.hole_cards[current_player]
        hole_cards_str = [self._card_to_string(card) for card in hole_cards]
        
        # Get board cards (PokerKit stores them as a flat list)
        board_cards = list(self.state.board_cards)
        board_cards_str = [self._card_to_string(card) for card in board_cards]
        
        # Get stacks and pot
        stacks = list(self.state.stacks)
        pot = self.state.total_pot_amount
        
        # Get street (0=preflop, 1=flop, 2=turn, 3=river)
        street = self.state.street_index if self.state.street_index is not None else 0
        
        # Build action history for current street
        actions = self._build_action_history()
        
        # Get betting info
        if self.state.actor_index is not None:
            current_bet = max(self.state.bets)
            to_call = self.state.checking_or_calling_amount if self.state.checking_or_calling_amount is not None else 0
        else:
            current_bet = 0
            to_call = 0
        
        return {
            'hole_cards': hole_cards_str,
            'board': board_cards_str,
            'stacks': stacks,
            'pot': pot,
            'street': street,
            'street_name': ['preflop', 'flop', 'turn', 'river'][street],
            'actions': actions,
            'current_bet': current_bet,
            'to_call': to_call,
            'player_idx': current_player,
            # Include valid actions for MCTS expansion without needing the full PokerKit state
            'valid_actions': self.get_valid_actions(),
            'done': not self.state.status,  # status=True means hand is active
        }
    
    def _card_to_string(self, card) -> str:
        """Convert PokerKit card to string format (e.g., 'As', '7h') with caching."""
        if card is None:
            return ''
        # PokerKit returns format like "EIGHT OF DIAMONDS (8d)"
        # Extract the short form in parentheses
        card_str = str(card)
        if '(' in card_str and ')' in card_str:
            # Extract "8d" from "EIGHT OF DIAMONDS (8d)"
            start = card_str.index('(') + 1
            end = card_str.index(')')
            short_form = card_str[start:end]
            return short_form.lower()  # Normalize to lowercase for cache
        return card_str.lower()
    
    def _build_action_history(self) -> List[Dict]:
        """
        Build action history from PokerKit operations.
        
        Returns:
            List of action dictionaries
        """
        actions = []
        
        # Parse operations for betting actions only
        for op in self.state.operations:
            op_name = type(op).__name__
            
            if op_name == 'Folding':
                actions.append({
                    'player': getattr(op, 'player_index', None),
                    'type': 0,  # FOLD
                    'amount': 0,
                })
            elif op_name == 'CheckingOrCalling':
                actions.append({
                    'player': getattr(op, 'player_index', None),
                    'type': 1,  # CALL/CHECK
                    'amount': getattr(op, 'amount', 0),
                })
            elif op_name == 'CompletionBettingOrRaisingTo':
                actions.append({
                    'player': getattr(op, 'player_index', None),
                    'type': 2,  # RAISE/BET
                    'amount': getattr(op, 'amount', 0),
                })
        
        return actions
    
    def get_valid_actions(self) -> List[int]:
        """
        Get valid actions for current player.
        
        Returns:
            List of action indices: 0=fold, 1=call/check, 2=raise/bet
        """
        # The environment may be used in contexts (e.g., MCTS) where
        # ``self.state`` is a plain ``dict`` representation rather than a
        # full PokerKit state object. Guard against attribute errors by
        # detecting the type and returning an empty list when a dict is
        # provided. This prevents crashes during MCTS expansion while
        # still allowing the rest of the training pipeline to function.
        if isinstance(self.state, dict):
            # No direct access to PokerKit methods; assume no actions are
            # available in this simplified context.
            return []
        
        if not self.state.status or self.state.actor_index is None:
            return []  # Hand is over
        
        valid = []
        
        # Can fold (unless checking is free)
        if self.state.can_fold():
            valid.append(0)  # FOLD
        
        # Can call/check
        if self.state.can_check_or_call():
            valid.append(1)  # CALL/CHECK
        
        # Can bet/raise
        if self.state.can_complete_bet_or_raise_to():
            valid.append(2)  # RAISE/BET
        
        return valid
    
    def step(self, action: int, raise_amount: Optional[float] = None) -> Tuple[Dict, float, bool, Dict]:
        """
        Take action in environment.
        
        Args:
            action: Action index (0=fold, 1=call, 2=raise)
            raise_amount: Raise amount multiplier of pot (only for action=2)
        
        Returns:
            next_state: State dictionary
            reward: Reward for player who just acted
            done: Whether hand is finished
            info: Additional information
        """
        if not self.state.status:
            # Hand already finished
            return self._build_state_dict(), 0.0, True, {'rewards': [0.0] * self.player_count}
        
        current_player = self.state.actor_index
        
        try:
            # Execute action
            if action == 0:  # FOLD
                self.state.fold()
            elif action == 1:  # CALL/CHECK
                self.state.check_or_call()
            elif action == 2:  # RAISE/BET
                # Calculate raise amount
                if raise_amount is None:
                    raise_amount = 1.0  # Default: pot-sized raise
        
                # Clamp raise multiplier
                raise_amount = np.clip(raise_amount, 0.5, 10.0)
        
                # Calculate bet size
                pot = self.state.total_pot_amount
                to_call = self.state.checking_or_calling_amount if self.state.checking_or_calling_amount is not None else 0
        
                # Total amount to bet/raise to
                min_raise = self.state.min_completion_betting_or_raising_to_amount
                max_raise = self.state.max_completion_betting_or_raising_to_amount
        
                # Pot-relative raise
                # Ensure raise_amount is a float (fallback to 1.0) before multiplication
                safe_raise_amount = raise_amount if raise_amount is not None else 1.0
                raise_size = int(pot * safe_raise_amount)
                total_amount = to_call + raise_size

                # Clamp to valid range (handle None values)
                if min_raise is not None and max_raise is not None:
                    total_amount = max(min_raise, min(total_amount, max_raise))
                elif min_raise is not None:
                    total_amount = max(min_raise, total_amount)

                self.state.complete_bet_or_raise_to(total_amount)
        
        except ValueError as e:
            # Invalid action - fold as penalty
            # Use a counter to avoid flooding logs
            if not hasattr(self, '_invalid_action_count'):
                self._invalid_action_count = 0
            self._invalid_action_count += 1
            if self._invalid_action_count <= 10 or self._invalid_action_count % 100 == 0:
                print(f"Warning: Invalid action {action} (count: {self._invalid_action_count}). Error: {e}")
            if self.state.can_fold():
                self.state.fold()
        
        # Build next state
        next_state = self._build_state_dict()
        done = not self.state.status
        
        # Compute rewards if hand is finished
        if done:
            rewards = self._compute_rewards()
            info = {'rewards': rewards}
            # current_player might be None when hand is done, use last valid player or 0
            if current_player is not None:
                reward = rewards[current_player]
            else:
                reward = 0.0
        else:
            info = {}
            reward = 0.0
        
        return next_state, reward, done, info
    
    def _compute_rewards(self) -> List[float]:
        """
        Compute final rewards (profit/loss in chips).
        Normalized to [-1, 1] range for better learning stability.
        """
        # Get final stacks
        final_stacks = list(self.state.stacks)
        
        # Compute profit/loss
        rewards = [
            (final_stacks[i] - self.initial_stacks[i]) / self.starting_stack
            for i in range(len(final_stacks))
        ]
        
        return rewards
