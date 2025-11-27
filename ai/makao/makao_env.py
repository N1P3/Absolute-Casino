import gymnasium as gym
import numpy as np
from gymnasium import spaces
from makao_game import MakaoGame

class MakaoEnv(gym.Env):
    """
    Gymnasium Environment for Makao.
    Designed for Self-Play: The agent plays as the 'Current Player'.
    The observation is always from the perspective of the player whose turn it is.
    """
    metadata = {"render_modes": ["human"]}

    def __init__(self):
        super(MakaoEnv, self).__init__()
        self.game = MakaoGame()
        
        # Define Card Mapping
        self.suits = ['H', 'D', 'C', 'S']
        self.ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
        self.card_map = [f"{r}{s}" for r in self.ranks for s in self.suits]
        self.card_to_idx = {c: i for i, c in enumerate(self.card_map)}
        
        # Action Space:
        # 0-51: Play specific card
        # 52: Draw card
        # 53: Skip turn
        self.action_space = spaces.Discrete(54)
        
        # Observation Space (124 floats):
        # 0-51: My Hand (One-hot)
        # 52-103: Table Card (One-hot)
        # 104: Pending Draw Count (Normalized / 20)
        # 105: Pending Skip Turns (Normalized / 5)
        # 106-109: Required Suit (One-hot: H, D, C, S)
        # 110-122: Required Rank (One-hot: 2..A)
        # 123: Opponent Hand Size (Normalized / 20)
        self.observation_space = spaces.Box(low=0, high=1, shape=(124,), dtype=np.float32)

        # Internal state
        self.hands = {0: [], 1: []}
        self.deck = []
        self.current_player = 0
        self.steps_without_progress = 0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.game.reset()
        
        # Initialize Deck and Deal
        self.deck = self.card_map.copy()
        np.random.shuffle(self.deck)
        
        self.hands = {0: [], 1: []}
        for _ in range(5):
            self.hands[0].append(self.deck.pop())
            self.hands[1].append(self.deck.pop())
            
        self.game.table_card = self.deck.pop()
        self.current_player = 0
        self.steps_without_progress = 0
        
        return self._get_obs(), {}

    def step(self, action):
        reward = 0
        terminated = False
        truncated = False
        info = {}
        
        player_id = self.current_player
        opponent_id = (player_id + 1) % 2
        
        # --- Execute Action ---
        valid_move = False
        
        if action < 52: # Play Card
            card_str = self.card_map[action]
            if card_str in self.hands[player_id]:
                # Heuristic for Ace/Jack choices to simplify action space
                chosen_suit = self._get_most_frequent_suit(player_id)
                chosen_number = '5' # Default safe choice
                
                # Try to play
                result = self.game.play_cards([card_str], chosen_suit, chosen_number, player_id, opponent_id)
                
                if result.success:
                    self.hands[player_id].remove(card_str)
                    valid_move = True
                    reward = 1.0 # Reward for playing a card
                    self.steps_without_progress = 0
                else:
                    reward = -0.1 # Invalid rule move
            else:
                reward = -1.0 # Tried to play card not in hand
                
        elif action == 52: # Draw
            # Check if we MUST skip (if so, drawing is invalid, must skip)
            if self.game.pending_skip_turns > 0 and self.game.player_to_skip == player_id:
                 reward = -1.0
            else:
                to_draw = self.game.draw_cards()
                for _ in range(to_draw):
                    if not self.deck:
                        self._reshuffle_deck()
                    if self.deck:
                        self.hands[player_id].append(self.deck.pop())
                valid_move = True
                reward = -0.1 # Slight penalty for drawing
                self.steps_without_progress += 1

        elif action == 53: # Skip
            result = self.game.skip_turn(player_id)
            if result.success:
                valid_move = True
                reward = 0.0
                self.steps_without_progress = 0
            else:
                reward = -1.0 # Invalid skip

        # --- Check Win Condition ---
        if len(self.hands[player_id]) == 0:
            terminated = True
            reward = 100.0 # Big reward for winning
        
        # --- Check Draw/Loop Condition ---
        if self.steps_without_progress > 100:
            truncated = True
            reward = -10.0
            
        # --- Switch Turn ---
        # In self-play, we switch perspective to the other player
        if not terminated and not truncated:
            if valid_move:
                self.current_player = opponent_id
            # If invalid move, we stay on current player (they must retry) 
            # BUT for RL training, usually we end the episode or force a random valid move.
            # To keep it simple: if invalid, we force a Draw (or Skip if needed) and switch turn
            # to prevent the model from getting stuck in an infinite loop of invalid actions.
            if not valid_move:
                self._force_valid_move(player_id, opponent_id)
                self.current_player = opponent_id
                
        return self._get_obs(), reward, terminated, truncated, info

    def _get_obs(self):
        """Generate observation vector for the CURRENT player"""
        obs = np.zeros(124, dtype=np.float32)
        p_idx = self.current_player
        
        # 0-51: My Hand
        for card in self.hands[p_idx]:
            idx = self.card_to_idx[card]
            obs[idx] = 1.0
            
        # 52-103: Table Card
        if self.game.table_card:
            idx = self.card_to_idx[self.game.table_card]
            obs[52 + idx] = 1.0
            
        # 104: Pending Draw
        obs[104] = min(self.game.pending_draw_count / 20.0, 1.0)
        
        # 105: Pending Skip
        obs[105] = min(self.game.pending_skip_turns / 5.0, 1.0)
        
        # 106-109: Required Suit
        if self.game.current_suit:
            s_idx = self.suits.index(self.game.current_suit)
            obs[106 + s_idx] = 1.0
            
        # 110-122: Required Rank
        if self.game.required_number:
            try:
                r_idx = self.ranks.index(self.game.required_number)
                obs[110 + r_idx] = 1.0
            except: pass
            
        # 123: Opponent Hand Size
        opp_idx = (p_idx + 1) % 2
        obs[123] = min(len(self.hands[opp_idx]) / 20.0, 1.0)
        
        return obs

    def _get_most_frequent_suit(self, player_id):
        counts = {'H': 0, 'D': 0, 'C': 0, 'S': 0}
        for card in self.hands[player_id]:
            counts[card[1]] += 1
        return max(counts, key=counts.get)

    def _reshuffle_deck(self):
        # Create new deck from cards not in hands or table
        used = set(self.hands[0] + self.hands[1])
        if self.game.table_card:
            used.add(self.game.table_card)
        
        self.deck = [c for c in self.card_map if c not in used]
        np.random.shuffle(self.deck)

    def _force_valid_move(self, player_id, opponent_id):
        """Fallback to keep game moving if agent hallucinates"""
        # Try to skip
        if self.game.skip_turn(player_id).success:
            return
        
        # Try to draw
        to_draw = self.game.draw_cards()
        for _ in range(to_draw):
            if not self.deck: self._reshuffle_deck()
            if self.deck: self.hands[player_id].append(self.deck.pop())

    def action_masks(self):
        """
        Returns a boolean mask of valid actions for the CURRENT player.
        True = Valid, False = Invalid.
        """
        mask = np.zeros(54, dtype=bool)
        player_id = self.current_player
        hand = self.hands[player_id]
        
        # 1. Check Card Plays (0-51)
        for i, card_str in enumerate(self.card_map):
            if card_str in hand:
                # Check if game rules allow playing this card
                if self.game.can_play_card(card_str, self.game.table_card, self.game.current_suit, player_id):
                    mask[i] = True
        
        # 2. Check Special Actions
        is_skipping = (self.game.pending_skip_turns > 0 and self.game.player_to_skip == player_id)
        
        if is_skipping:
            # Must play '4' (handled above) or Skip
            mask[53] = True  # Skip
            mask[52] = False # Cannot draw
        else:
            # Normal or Drawing state
            mask[53] = False # Cannot skip
            mask[52] = True  # Can always draw (voluntarily or forced by stack)
            
        return mask
