import gymnasium as gym
import numpy as np
from gymnasium import spaces
from makao_game import MakaoGame

class MakaoEnv(gym.Env):
    """
    Gymnasium Environment for Makao with Multi-Card Support.
    Designed for Self-Play: The agent plays as the 'Current Player'.
    The observation is always from the perspective of the player whose turn it is.
    
    Extended Action Space (93 actions):
    - 0-51: Play single card
    - 52-64: Play 2 cards of same rank (rank index 0-12: 2,3,4,5,6,7,8,9,T,J,Q,K,A)
    - 65-77: Play 3 cards of same rank
    - 78-90: Play 4 cards of same rank
    - 91: Draw card
    - 92: Skip turn
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
        
        # Action Space (93 actions):
        # 0-51: Play single card
        # 52-64: Play 2 cards of same rank (rank_idx = action - 52)
        # 65-77: Play 3 cards of same rank (rank_idx = action - 65)
        # 78-90: Play 4 cards of same rank (rank_idx = action - 78)
        # 91: Draw card
        # 92: Skip turn
        self.action_space = spaces.Discrete(93)
        
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
        
        if action < 52:  # Play Single Card
            card_str = self.card_map[action]
            if card_str in self.hands[player_id]:
                chosen_suit = self._get_most_frequent_suit(player_id)
                chosen_number = self._get_best_jack_number(player_id)
                
                result = self.game.play_cards([card_str], chosen_suit, chosen_number, player_id, opponent_id)
                
                if result.success:
                    self.hands[player_id].remove(card_str)
                    valid_move = True
                    self.steps_without_progress = 0
                    
                    # Sprawdź czy można było zagrać więcej kart tego samego ranku
                    card_rank = card_str[0]
                    same_rank_count = sum(1 for c in self.hands[player_id] if c[0] == card_rank)
                    
                    if same_rank_count >= 1:  # Miał jeszcze karty tego ranku po zagraniu
                        # KARA za nieoptymalne granie - mógł zagrać więcej!
                        reward = -0.5 - (0.5 * same_rank_count)  # Większa kara im więcej mógł zagrać
                    else:
                        # Nie miał więcej tego ranku - OK
                        reward = 1.0
                        # Bonus tylko gdy naprawdę potrzebne (pending > 0)
                        if self.game.pending_draw_count > 0 or self.game.pending_skip_turns > 0:
                            if card_rank == '2':
                                reward += 0.5
                            elif card_rank == '3':
                                reward += 0.5
                            elif card_rank == 'K' and card_str[1] in ['H', 'S']:
                                reward += 0.5
                            elif card_rank == '4':
                                reward += 0.3
                else:
                    reward = -0.5
            else:
                reward = -1.0
                
        elif 52 <= action <= 90:  # Play Multiple Cards of Same Rank
            if action <= 64:
                num_cards = 2
                rank_idx = action - 52
            elif action <= 77:
                num_cards = 3
                rank_idx = action - 65
            else:
                num_cards = 4
                rank_idx = action - 78

            rank = self.ranks[rank_idx]
            cards_of_rank = [c for c in self.hands[player_id] if c[0] == rank]

            if len(cards_of_rank) >= num_cards:
                cards_to_play = cards_of_rank[:num_cards]
                chosen_suit = self._get_most_frequent_suit(player_id)
                chosen_number = self._get_best_jack_number(player_id)

                result = self.game.play_cards(cards_to_play, chosen_suit, chosen_number, player_id, opponent_id)

                if result.success:
                    for card in cards_to_play:
                        self.hands[player_id].remove(card)
                    valid_move = True
                    self.steps_without_progress = 0

                    # Bardzo silny bonus za zagranie wszystkich kart danego ranku naraz!
                    remaining_same_rank = sum(1 for c in self.hands[player_id] if c[0] == rank)
                    if remaining_same_rank == 0 and len(cards_of_rank) == num_cards:
                        reward = 20.0  # Maksymalny bonus za pełne wyczyszczenie ranku
                    else:
                        # Kara za zagranie tylko części kart (im więcej zostawił, tym większa kara)
                        reward = 2.0 * num_cards - 2.0 * (len(cards_of_rank) - num_cards)
                        # Dodatkowy minus jeśli mógł zagrać 3x/4x a zagrał mniej
                        if len(cards_of_rank) > num_cards:
                            reward -= 3.0 * (len(cards_of_rank) - num_cards)

                    # Dodatkowy bonus za specjalne tylko gdy potrzebne
                    if self.game.pending_draw_count > 0 or self.game.pending_skip_turns > 0:
                        if rank == '2':
                            reward += 1.0 * num_cards
                        elif rank == '3':
                            reward += 1.0 * num_cards
                        elif rank == 'K':
                            special_kings = sum(1 for c in cards_to_play if c[1] in ['H', 'S'])
                            reward += 1.0 * special_kings
                        elif rank == '4':
                            reward += 0.5 * num_cards
                else:
                    reward = -0.5
            else:
                reward = -1.0
                
        elif action == 91:  # Draw
            if self.game.pending_skip_turns > 0 and self.game.player_to_skip == player_id:
                reward = -1.0
            else:
                # Sprawdź czy były karty do zagrania (kara za niepotrzebne dobieranie)
                had_playable = self._has_playable_cards(player_id)
                
                to_draw = self.game.draw_cards()
                for _ in range(to_draw):
                    if not self.deck:
                        self._reshuffle_deck()
                    if self.deck:
                        self.hands[player_id].append(self.deck.pop())
                valid_move = True
                
                if had_playable:
                    # Kara za dobieranie gdy można było zagrać
                    reward = -1.0
                else:
                    # Normalna mała kara za wymuszone dobieranie
                    reward = -0.1 * to_draw
                self.steps_without_progress += 1

        elif action == 92:  # Skip
            result = self.game.skip_turn(player_id)
            if result.success:
                valid_move = True
                # Sprawdź czy miał karty do zagrania - kara za niepotrzebne pomijanie
                had_playable = self._has_playable_cards(player_id)
                if had_playable:
                    reward = -2.0  # Duża kara za pomijanie gdy można grać
                else:
                    reward = -0.1  # Mała kara gdy musi pominąć
                self.steps_without_progress = 0
            else:
                reward = -1.0

        # --- Check Win Condition ---
        if len(self.hands[player_id]) == 0:
            terminated = True
            reward = 20.0
        
        if len(self.hands[opponent_id]) == 0:
            terminated = True
            reward = -20.0
        
        # --- Check Draw/Loop Condition ---
        if self.steps_without_progress > 100:
            truncated = True
            card_diff = len(self.hands[player_id]) - len(self.hands[opponent_id])
            reward = -1.0 - (card_diff * 0.1)
            
        # --- Switch Turn ---
        if not terminated and not truncated:
            if valid_move:
                self.current_player = opponent_id
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
    
    def _get_best_jack_number(self, player_id):
        """
        Wybiera najlepszą wartość do żądania po zagraniu Waleta.
        Strategia: wybierz wartość której masz najwięcej w ręce (5-10).
        """
        valid_numbers = ['5', '6', '7', '8', '9', 'T']
        counts = {n: 0 for n in valid_numbers}
        
        for card in self.hands[player_id]:
            if card[0] in counts:
                counts[card[0]] += 1
        
        # Zwróć wartość której mamy najwięcej
        best = max(counts, key=counts.get)
        
        # Jeśli nie mamy żadnej karty 5-10, wybierz losowo
        if counts[best] == 0:
            return '5'
        
        return best

    def _reshuffle_deck(self):
        # Create new deck from cards not in hands or table
        used = set(self.hands[0] + self.hands[1])
        if self.game.table_card:
            used.add(self.game.table_card)
        
        self.deck = [c for c in self.card_map if c not in used]
        np.random.shuffle(self.deck)

    def _has_playable_cards(self, player_id):
        """Sprawdza czy gracz ma jakiekolwiek karty do zagrania."""
        hand = self.hands[player_id]
        for card in hand:
            if self.game.can_play_card(card, self.game.table_card, self.game.current_suit, player_id):
                return True
        return False

    def _force_valid_move(self, player_id, opponent_id):
        """Fallback to keep game moving if agent hallucinates"""
        if self.game.skip_turn(player_id).success:
            return
        to_draw = self.game.draw_cards()
        for _ in range(to_draw):
            if not self.deck: self._reshuffle_deck()
            if self.deck: self.hands[player_id].append(self.deck.pop())

    def action_masks(self):
        """
        Returns a boolean mask of valid actions for the CURRENT player.
        True = Valid, False = Invalid.
        
        Actions:
        - 0-51: Play single card
        - 52-64: Play 2 cards of same rank
        - 65-77: Play 3 cards of same rank
        - 78-90: Play 4 cards of same rank
        - 91: Draw card
        - 92: Skip turn
        """
        mask = np.zeros(93, dtype=bool)
        player_id = self.current_player
        hand = self.hands[player_id]
        
        # Count cards per rank in hand
        rank_counts = {r: [] for r in self.ranks}
        for card in hand:
            rank_counts[card[0]].append(card)
        
        # 1. Check Single Card Plays (0-51)
        for i, card_str in enumerate(self.card_map):
            if card_str in hand:
                if self.game.can_play_card(card_str, self.game.table_card, self.game.current_suit, player_id):
                    mask[i] = True
        
        # 2. Check Multi-Card Plays (52-90)
        for rank_idx, rank in enumerate(self.ranks):
            cards_of_rank = rank_counts[rank]
            num_cards = len(cards_of_rank)
            
            if num_cards >= 2:
                # Check if at least one card of this rank can be played
                can_play_this_rank = any(
                    self.game.can_play_card(card, self.game.table_card, self.game.current_suit, player_id)
                    for card in cards_of_rank
                )
                
                if can_play_this_rank:
                    mask[52 + rank_idx] = True  # 2 cards
                    if num_cards >= 3:
                        mask[65 + rank_idx] = True  # 3 cards
                    if num_cards >= 4:
                        mask[78 + rank_idx] = True  # 4 cards
        
        # 3. Check Special Actions
        is_skipping = (self.game.pending_skip_turns > 0 and self.game.player_to_skip == player_id)
        
        # Check if any card can be played
        has_playable_card = any(mask[i] for i in range(91))  # Any card or multi-card action
        
        if is_skipping:
            mask[92] = True   # Skip
            mask[91] = False  # Cannot draw
        else:
            mask[92] = False  # Cannot skip
            # Draw only if: forced (pending_draw) OR no playable cards
            if self.game.pending_draw_count > 0 or not has_playable_card:
                mask[91] = True
            else:
                mask[91] = False  # Must play a card if possible!
            
        return mask
    
    def action_to_description(self, action):
        """Konwertuje akcję na czytelny opis"""
        if action < 52:
            return f"Zagraj {self.card_map[action]}"
        elif action <= 64:
            rank_idx = action - 52
            return f"Zagraj 2x {self.ranks[rank_idx]}"
        elif action <= 77:
            rank_idx = action - 65
            return f"Zagraj 3x {self.ranks[rank_idx]}"
        elif action <= 90:
            rank_idx = action - 78
            return f"Zagraj 4x {self.ranks[rank_idx]}"
        elif action == 91:
            return "Dobierz kartę"
        elif action == 92:
            return "Pomiń turę"
        return "Nieznana akcja"
