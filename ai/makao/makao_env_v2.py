"""
Makao Environment V2 - Uproszczone nagrody + trening vs heurystyka.

Główne zmiany:
- Nagroda główna: wygrana/przegrana (+100/-100)
- Małe bonusy za karty (+1 za kartę, +0.5 za każdą dodatkową w multi)
- Przeciwnik: heurystyka zamiast self-play
"""

import gymnasium as gym
import numpy as np
from gymnasium import spaces
from makao_game import MakaoGame
from heuristic_agent import HeuristicAgent


class MakaoEnvV2(gym.Env):
    """
    Makao Environment z treningiem przeciwko heurystyce.
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
        
        # Przestrzeń obserwacji (124 floaty)
        self.observation_space = spaces.Box(low=0, high=1, shape=(124,), dtype=np.float32)
        
        self.hands = [[], []]
        self.deck = []
        self.current_player = 0

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
        self.current_player = 0  # Agent zawsze zaczyna
        self.steps_without_progress = 0
        
        return self._get_obs(), {}

    def step(self, action):
        """Agent wykonuje akcję, potem heurystyka odpowiada."""
        reward = 0.0
        terminated = False
        truncated = False
        info = {}
        
        # --- Ruch agenta (gracz 0) ---
        agent_reward, agent_terminated = self._execute_action(0, action)
        reward += agent_reward
        
        if agent_terminated:
            return self._get_obs(), reward, True, False, info
        
        # --- Ruch heurystyki (gracz 1) ---
        while self.current_player == 1 and not terminated:
            heur_action, _ = self.heuristic.select_action(self)
            _, heur_terminated = self._execute_action(1, heur_action)
            
            if heur_terminated:
                # Heurystyka wygrała = agent przegrał
                if len(self.hands[1]) == 0:
                    reward = -100.0
                terminated = True
                break
        
        # Sprawdź truncation
        if self.steps_without_progress > 100:
            truncated = True
            card_diff = len(self.hands[0]) - len(self.hands[1])
            reward = -10.0 if card_diff > 0 else 10.0 if card_diff < 0 else 0
        
        return self._get_obs(), reward, terminated, truncated, info

    def _execute_action(self, player_id, action):
        """Wykonuje akcję dla gracza. Zwraca (reward, terminated)."""
        opponent_id = 1 - player_id
        reward = 0.0
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
                    valid_move = True
                    self.steps_without_progress = 0
                    
                    if player_id == 0:  # Tylko agent dostaje reward
                        reward = 1.0  # +1 za zagraną kartę
                        
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
                    valid_move = True
                    self.steps_without_progress = 0
                    
                    if player_id == 0:  # Tylko agent dostaje reward
                        reward = 1.0 + 0.5 * (num_cards - 1)  # +1 base + 0.5 za każdą dodatkową
                        
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
                
                if player_id == 0:
                    reward = -0.1 * to_draw  # Mała kara za dobieranie
                    
        elif action == 92:  # Pomiń
            result = self.game.skip_turn(player_id)
            if result.success:
                valid_move = True
                self.steps_without_progress = 0
                if player_id == 0:
                    reward = -0.1  # Mała kara za pominięcie
        
        # Sprawdź wygraną
        if len(self.hands[player_id]) == 0:
            terminated = True
            if player_id == 0:
                reward = 100.0  # Agent wygrał!
        
        # Zmień turę
        if valid_move and not terminated:
            self.current_player = opponent_id
        elif not valid_move:
            self._force_valid_move(player_id, opponent_id)
            self.current_player = opponent_id
        
        return reward, terminated

    def _get_obs(self):
        """Obserwacja z perspektywy agenta (gracz 0)."""
        obs = np.zeros(124, dtype=np.float32)
        
        # 0-51: Ręka agenta
        for card in self.hands[0]:
            idx = self.card_to_idx[card]
            obs[idx] = 1.0
        
        # 52-103: Karta na stole
        if self.game.table_card:
            idx = self.card_to_idx[self.game.table_card]
            obs[52 + idx] = 1.0
        
        # 104: Pending draw
        obs[104] = min(self.game.pending_draw_count / 20.0, 1.0)
        
        # 105: Pending skip
        obs[105] = min(self.game.pending_skip_turns / 5.0, 1.0)
        
        # 106-109: Required suit
        if self.game.current_suit:
            s_idx = self.suits.index(self.game.current_suit)
            obs[106 + s_idx] = 1.0
        
        # 110-122: Required rank
        if self.game.required_number:
            try:
                r_idx = self.ranks.index(self.game.required_number)
                obs[110 + r_idx] = 1.0
            except:
                pass
        
        # 123: Rozmiar ręki przeciwnika
        obs[123] = min(len(self.hands[1]) / 20.0, 1.0)
        
        return obs

    def action_masks(self):
        """Maska akcji dla agenta (gracz 0)."""
        mask = np.zeros(93, dtype=bool)
        player_id = 0
        opponent_id = 1
        
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
        from collections import Counter
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
        from collections import Counter
        suits = [c[-1] for c in self.hands[player_id]]
        if suits:
            return Counter(suits).most_common(1)[0][0]
        return 'H'

    def _get_best_jack_number(self, player_id):
        from collections import Counter
        ranks = [c[0] for c in self.hands[player_id] if c[0] not in ['J', '2', '3', '4', 'A']]
        if ranks:
            return Counter(ranks).most_common(1)[0][0]
        return '5'

    def _reshuffle_deck(self):
        pass

    def _force_valid_move(self, player_id, opponent_id):
        if not self.deck:
            self._reshuffle_deck()
        if self.deck:
            self.hands[player_id].append(self.deck.pop())
