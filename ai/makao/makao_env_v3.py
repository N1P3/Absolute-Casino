"""
Makao Environment V3 - Sparse rewards + lepsze obserwacje.

Kluczowe zmiany:
1. TYLKO nagroda za wygraną/przegraną (sparse rewards)
2. Rozszerzone obserwacje (ile kart wyszło, karty na stosie odrzuconych)
3. Trening vs heurystyka
"""

import gymnasium as gym
import numpy as np
from gymnasium import spaces
from makao_game import MakaoGame
from heuristic_agent import HeuristicAgent
from collections import Counter


class MakaoEnvV3(gym.Env):
    """
    Makao Environment V3 - Sparse Rewards.
    Agent = gracz 0, Heurystyka = gracz 1.
    """
    metadata = {"render_modes": ["human"]}

    def __init__(self):
        super().__init__()
        self.game = MakaoGame()
        self.heuristic = HeuristicAgent()
        
        # Mapowanie kart
        self.suits = ['H', 'D', 'C', 'S']
        self.ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
        self.card_map = [f"{r}{s}" for r in self.ranks for s in self.suits]
        self.card_to_idx = {c: i for i, c in enumerate(self.card_map)}
        
        # Przestrzeń akcji (93 akcje)
        self.action_space = spaces.Discrete(93)
        
        # Rozszerzona przestrzeń obserwacji (180 floatów):
        # 0-51: Moja ręka (one-hot)
        # 52-103: Karta na stole (one-hot)
        # 104-155: Karty które wyszły z gry (counter, normalized)
        # 156: Pending draw (normalized)
        # 157: Pending skip (normalized)
        # 158-161: Required suit (one-hot)
        # 162-174: Required rank (one-hot)
        # 175: Rozmiar ręki przeciwnika (normalized)
        # 176: Rozmiar talii (normalized)
        # 177: Mój rozmiar ręki (normalized)
        # 178: Różnica kart (moja - przeciwnika, normalized)
        # 179: Czy jestem blisko wygranej (mam <= 2 karty)
        self.observation_space = spaces.Box(low=0, high=1, shape=(180,), dtype=np.float32)
        
        self.hands = [[], []]
        self.deck = []
        self.discard_pile = []  # Śledzenie kart które wyszły
        self.current_player = 0
        self.steps_without_progress = 0

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        
        self.game = MakaoGame()
        full_deck = [f"{r}{s}" for r in self.ranks for s in self.suits]
        
        if seed is not None:
            np.random.seed(seed)
        np.random.shuffle(full_deck)
        
        self.hands = [full_deck[:5], full_deck[5:10]]
        self.deck = full_deck[11:]
        self.game.table_card = full_deck[10]
        self.discard_pile = [full_deck[10]]  # Początkowa karta na stole
        self.current_player = 0
        self.steps_without_progress = 0
        
        return self._get_obs(), {}

    def step(self, action):
        """Agent wykonuje akcję, potem heurystyka odpowiada."""
        reward = 0.0
        terminated = False
        truncated = False
        info = {}
        
        # --- Ruch agenta (gracz 0) ---
        agent_terminated = self._execute_action(0, action)
        
        if agent_terminated:
            # Agent wygrał
            if len(self.hands[0]) == 0:
                reward = 1.0
            return self._get_obs(), reward, True, False, info
        
        # --- Ruch heurystyki (gracz 1) ---
        max_heur_moves = 10  # Zabezpieczenie przed nieskończoną pętlą
        heur_moves = 0
        while self.current_player == 1 and not terminated and heur_moves < max_heur_moves:
            heur_action, _ = self.heuristic.select_action(self)
            heur_terminated = self._execute_action(1, heur_action)
            heur_moves += 1
            
            if heur_terminated:
                # Heurystyka wygrała = agent przegrał
                if len(self.hands[1]) == 0:
                    reward = -1.0
                terminated = True
                break
        
        # Sprawdź truncation
        if self.steps_without_progress > 150:
            truncated = True
            # Kto ma mniej kart - ten bliżej wygranej
            card_diff = len(self.hands[0]) - len(self.hands[1])
            reward = -0.5 if card_diff > 0 else 0.5 if card_diff < 0 else 0
        
        return self._get_obs(), reward, terminated, truncated, info

    def _execute_action(self, player_id, action):
        """Wykonuje akcję dla gracza. Zwraca True jeśli gra się skończyła."""
        opponent_id = 1 - player_id
        terminated = False
        valid_move = False
        
        if action < 52:  # Pojedyncza karta
            card_str = self.card_map[action]
            if card_str in self.hands[player_id]:
                chosen_suit = self._get_most_frequent_suit(player_id)
                chosen_number = self._get_best_jack_number(player_id)
                result = self.game.play_cards([card_str], chosen_suit, chosen_number, player_id, opponent_id)
                
                if result.success:
                    self.hands[player_id].remove(card_str)
                    self.discard_pile.append(card_str)
                    valid_move = True
                    self.steps_without_progress = 0
                        
        elif 52 <= action <= 90:  # Multi-card
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
                        self.discard_pile.append(card)
                    valid_move = True
                    self.steps_without_progress = 0
                        
        elif action == 91:  # Dobierz
            if not (self.game.pending_skip_turns > 0 and self.game.player_to_skip == player_id):
                to_draw = self.game.draw_cards()
                for _ in range(to_draw):
                    if not self.deck:
                        self._reshuffle_deck()
                    if self.deck:
                        self.hands[player_id].append(self.deck.pop())
                valid_move = True
                self.steps_without_progress += 1
                    
        elif action == 92:  # Pomiń
            result = self.game.skip_turn(player_id)
            if result.success:
                valid_move = True
                self.steps_without_progress = 0
        
        # Sprawdź wygraną
        if len(self.hands[player_id]) == 0:
            terminated = True
        
        # Zmień turę
        if valid_move and not terminated:
            self.current_player = opponent_id
        elif not valid_move:
            self._force_valid_move(player_id, opponent_id)
            self.current_player = opponent_id
        
        return terminated

    def _get_obs(self):
        """Rozszerzona obserwacja z perspektywy agenta (gracz 0)."""
        obs = np.zeros(180, dtype=np.float32)
        
        # 0-51: Moja ręka (one-hot)
        for card in self.hands[0]:
            idx = self.card_to_idx[card]
            obs[idx] = 1.0
        
        # 52-103: Karta na stole (one-hot)
        if self.game.table_card:
            idx = self.card_to_idx[self.game.table_card]
            obs[52 + idx] = 1.0
        
        # 104-155: Karty które wyszły (counter normalized)
        for card in self.discard_pile:
            idx = self.card_to_idx[card]
            obs[104 + idx] = min(obs[104 + idx] + 0.25, 1.0)  # Max 4 tego samego typu
        
        # 156: Pending draw
        obs[156] = min(self.game.pending_draw_count / 20.0, 1.0)
        
        # 157: Pending skip
        obs[157] = min(self.game.pending_skip_turns / 5.0, 1.0)
        
        # 158-161: Required suit
        if self.game.current_suit:
            s_idx = self.suits.index(self.game.current_suit)
            obs[158 + s_idx] = 1.0
        
        # 162-174: Required rank
        if self.game.required_number:
            try:
                r_idx = self.ranks.index(self.game.required_number)
                obs[162 + r_idx] = 1.0
            except:
                pass
        
        # 175: Rozmiar ręki przeciwnika
        obs[175] = min(len(self.hands[1]) / 20.0, 1.0)
        
        # 176: Rozmiar talii
        obs[176] = min(len(self.deck) / 40.0, 1.0)
        
        # 177: Mój rozmiar ręki
        obs[177] = min(len(self.hands[0]) / 20.0, 1.0)
        
        # 178: Różnica kart (normalized -1 to 1)
        card_diff = len(self.hands[0]) - len(self.hands[1])
        obs[178] = max(-1.0, min(1.0, card_diff / 10.0))
        
        # 179: Czy jestem blisko wygranej
        obs[179] = 1.0 if len(self.hands[0]) <= 2 else 0.0
        
        return obs

    def action_masks(self, player_id=None):
        """Maska akcji dla gracza."""
        mask = np.zeros(93, dtype=bool)
        if player_id is None:
            player_id = self.current_player
        
        # Skip
        if self.game.pending_skip_turns > 0 and self.game.player_to_skip == player_id:
            mask[92] = True
            return mask
        
        has_playable = False
        
        # Pojedyncze karty
        for card in self.hands[player_id]:
            if self.game.can_play_card(card, self.game.table_card, self.game.current_suit, player_id):
                idx = self.card_to_idx[card]
                mask[idx] = True
                has_playable = True
        
        # Multi-card
        rank_counts = Counter(c[0] for c in self.hands[player_id])
        
        for rank, count in rank_counts.items():
            if count >= 2:
                sample_card = next(c for c in self.hands[player_id] if c[0] == rank)
                if self.game.can_play_card(sample_card, self.game.table_card, self.game.current_suit, player_id):
                    rank_idx = self.ranks.index(rank)
                    mask[52 + rank_idx] = True  # 2x
                    has_playable = True
                    if count >= 3:
                        mask[65 + rank_idx] = True  # 3x
                    if count >= 4:
                        mask[78 + rank_idx] = True  # 4x
        
        # Draw - tylko gdy nie ma kart do zagrania lub pending_draw
        if not has_playable or self.game.pending_draw_count > 0:
            mask[91] = True
        
        # Fallback
        if not mask.any():
            mask[91] = True
        
        return mask

    def _get_most_frequent_suit(self, player_id):
        suits = [c[-1] for c in self.hands[player_id]]
        if suits:
            return Counter(suits).most_common(1)[0][0]
        return 'H'

    def _get_best_jack_number(self, player_id):
        ranks = [c[0] for c in self.hands[player_id] if c[0] not in ['J', '2', '3', '4', 'A']]
        if ranks:
            return Counter(ranks).most_common(1)[0][0]
        return '5'

    def _reshuffle_deck(self):
        """Przetasuj stos odrzuconych (oprócz ostatniej karty) z powrotem do talii."""
        if len(self.discard_pile) > 1:
            # Zostaw ostatnią kartę na stole
            cards_to_shuffle = self.discard_pile[:-1]
            self.discard_pile = [self.discard_pile[-1]]
            np.random.shuffle(cards_to_shuffle)
            self.deck.extend(cards_to_shuffle)

    def _force_valid_move(self, player_id, opponent_id):
        if not self.deck:
            self._reshuffle_deck()
        if self.deck:
            self.hands[player_id].append(self.deck.pop())
