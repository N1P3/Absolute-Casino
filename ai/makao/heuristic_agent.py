"""
Heurystyczny agent do gry w Makao z obsługą wielu kart naraz.

Strategia priorytetyzacji:
1. Graj jak najwięcej kart naraz (4 > 3 > 2 > 1)
2. Preferuj karty specjalne (2, 3, 4, K♠/K♥) gdy są korzystne
3. Unikaj grania Asów i Waletów bez potrzeby (zachowaj na później)
4. Dobieraj tylko gdy nie ma innej opcji
"""

import numpy as np
from typing import List, Tuple, Optional


class HeuristicAgent:
    """Heurystyczny agent Makao z pełnym wsparciem multi-card."""
    
    def __init__(self):
        self.ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
        self.suits = ['H', 'D', 'C', 'S']
        
    def select_action(self, env, verbose=False) -> Tuple[int, str]:
        """
        Wybiera najlepszą akcję na podstawie heurystyki.
        
        Returns:
            Tuple[int, str]: (action_id, description)
        """
        mask = env.action_masks()
        valid_actions = [i for i, v in enumerate(mask) if v]
        
        if not valid_actions:
            return 91, "Brak akcji - wymuszam dobieranie"
        
        player_id = env.current_player
        hand = env.hands[player_id]
        
        # Grupuj karty według rangi
        rank_cards = {r: [] for r in self.ranks}
        for card in hand:
            rank_cards[card[0]].append(card)
        
        # === PRIORYTET 1: Zagraj 4 karty naraz ===
        for rank_idx, rank in enumerate(self.ranks):
            action = 78 + rank_idx  # 4-card actions
            if action in valid_actions:
                desc = f"4x {rank} - maksymalna eliminacja!"
                if verbose:
                    print(f"  [HEUR] {desc}")
                return action, desc
        
        # === PRIORYTET 2: Zagraj 3 karty naraz ===
        for rank_idx, rank in enumerate(self.ranks):
            action = 65 + rank_idx  # 3-card actions
            if action in valid_actions:
                desc = f"3x {rank} - silna eliminacja"
                if verbose:
                    print(f"  [HEUR] {desc}")
                return action, desc
        
        # === PRIORYTET 3: Zagraj 2 karty naraz ===
        # Preferuj karty specjalne
        priority_2card = ['2', '3', '4']  # 2-ki, 3-ki, 4-ki dają bonus
        for rank in priority_2card:
            rank_idx = self.ranks.index(rank)
            action = 52 + rank_idx
            if action in valid_actions:
                desc = f"2x {rank} - specjalne combo"
                if verbose:
                    print(f"  [HEUR] {desc}")
                return action, desc
        
        # Potem zwykłe 2-card plays
        for rank_idx, rank in enumerate(self.ranks):
            action = 52 + rank_idx
            if action in valid_actions:
                desc = f"2x {rank}"
                if verbose:
                    print(f"  [HEUR] {desc}")
                return action, desc
        
        # === PRIORYTET 4: Zagraj pojedynczą kartę specjalną ===
        # Kolejność: 2 > 3 > 4 > K♠/K♥
        special_priority = []
        
        for action in valid_actions:
            if action >= 52:
                continue
            card = env.card_map[action]
            value = card[0]
            suit = card[1]
            
            if value == '2':
                special_priority.append((action, 10, f"{card} - przeciwnik dobiera 2"))
            elif value == '3':
                special_priority.append((action, 9, f"{card} - przeciwnik dobiera 3"))
            elif value == '4':
                special_priority.append((action, 8, f"{card} - przeciwnik traci turę"))
            elif value == 'K' and suit in ['H', 'S']:
                special_priority.append((action, 7, f"{card} - przeciwnik dobiera 5!"))
        
        if special_priority:
            special_priority.sort(key=lambda x: -x[1])  # Sortuj malejąco
            action, _, desc = special_priority[0]
            if verbose:
                print(f"  [HEUR] {desc}")
            return action, desc
        
        # === PRIORYTET 5: Zagraj zwykłą kartę (nie Asa/Waleta) ===
        normal_cards = []
        for action in valid_actions:
            if action >= 52:
                continue
            card = env.card_map[action]
            value = card[0]
            if value not in ['A', 'J']:  # Zachowaj Asy i Walety
                normal_cards.append((action, card))
        
        if normal_cards:
            # Wybierz kartę której mamy najwięcej tego koloru (utrzymaj opcje)
            suit_counts = {}
            for card in hand:
                suit_counts[card[1]] = suit_counts.get(card[1], 0) + 1
            
            best = max(normal_cards, key=lambda x: suit_counts.get(x[1][1], 0))
            action, card = best
            desc = f"{card} - zwykła karta"
            if verbose:
                print(f"  [HEUR] {desc}")
            return action, desc
        
        # === PRIORYTET 6: Zagraj Asa lub Waleta ===
        for action in valid_actions:
            if action >= 52:
                continue
            card = env.card_map[action]
            if card[0] == 'J':
                desc = f"{card} - Walet (żądanie wartości)"
                if verbose:
                    print(f"  [HEUR] {desc}")
                return action, desc
        
        for action in valid_actions:
            if action >= 52:
                continue
            card = env.card_map[action]
            if card[0] == 'A':
                desc = f"{card} - As (zmiana koloru)"
                if verbose:
                    print(f"  [HEUR] {desc}")
                return action, desc
        
        # === PRIORYTET 7: Skip jeśli musimy ===
        if 92 in valid_actions:
            desc = "Pominięcie tury (4-ka przeciwnika)"
            if verbose:
                print(f"  [HEUR] {desc}")
            return 92, desc
        
        # === PRIORYTET 8: Dobierz kartę ===
        if 91 in valid_actions:
            to_draw = env.game.pending_draw_count if env.game.pending_draw_count > 0 else 1
            desc = f"Dobierz {to_draw} kart(y)"
            if verbose:
                print(f"  [HEUR] {desc}")
            return 91, desc
        
        # Fallback
        action = valid_actions[0]
        return action, f"Fallback: akcja {action}"


def test_heuristic():
    """Test działania heurystyki."""
    from makao_env import MakaoEnv
    
    env = MakaoEnv()
    agent = HeuristicAgent()
    
    obs, _ = env.reset()
    
    print("=== Test Heurystycznego Agenta ===")
    print(f"Ręka P0: {env.hands[0]}")
    print(f"Ręka P1: {env.hands[1]}")
    print(f"Stół: {env.game.table_card}")
    
    for step in range(30):
        player = env.current_player
        action, desc = agent.select_action(env, verbose=True)
        
        print(f"\nKrok {step+1}, Gracz {player}:")
        print(f"  Ręka: {env.hands[player]}")
        print(f"  Akcja: {desc}")
        
        obs, reward, done, truncated, info = env.step(action)
        print(f"  Reward: {reward:.2f}")
        print(f"  Po ruchu - P0: {len(env.hands[0])} kart, P1: {len(env.hands[1])} kart")
        
        if done:
            winner = 0 if len(env.hands[0]) == 0 else 1
            print(f"\n=== KONIEC: Gracz {winner} wygrywa! ===")
            break
        if truncated:
            print("\n=== Remis (za dużo kroków) ===")
            break
    
    print(f"\nŁącznie kroków: {step + 1}")


if __name__ == "__main__":
    test_heuristic()
