from typing import Dict, List
from pokerkit import StandardHighHand, Card

class HeuristicPokerPlayer:
    """A simple rule-based poker player."""
    def __init__(self, name="Heuristic"):
        self.name = name
        self.action_names = ['FOLD', 'CALL', 'RAISE']

        # Precompute simple preflop strengths
        self.high_cards = {'A': 14, 'K': 13, 'Q': 12, 'J':11, 'T':10}
        for i in range(2, 10):
            self.high_cards[str(i)] = i

    def predict(self, hand_state: Dict, temperature: float = 1.0) -> Dict:
        """
        Decision making for heuristic player.
        """
        hole_cards_str = hand_state.get('hole_cards', [])
        board_cards_str = hand_state.get('board', [])
        street = hand_state.get('street', 0)

        # Valid actions if provided
        valid_actions = hand_state.get('valid_actions', [0, 1, 2])

        action_idx = 0 # Default Fold
        raise_amount_multiple = 1.0

        if not hole_cards_str:
            return {'action_idx': 1, 'raise_amount_pot_multiple': 0.0}

        try:
            hole_cards = list(Card.parse(''.join(hole_cards_str)))
            board_cards = list(Card.parse(''.join(board_cards_str) if board_cards_str else ''))
        except Exception as e:
            return {'action_idx': 1, 'raise_amount_pot_multiple': 0.0}

        if street == 0: # Preflop
            action_idx = self._strategy_preflop(hole_cards, valid_actions)
        else:
            action_idx, raise_amount_multiple = self._strategy_postflop(hole_cards, board_cards, valid_actions)

        action_name = self.action_names[action_idx]

        # Respect valid actions (simple correction)
        if valid_actions and action_idx not in valid_actions:
            if 1 in valid_actions: # Prefer Call/Check
                action_idx = 1
            elif 2 in valid_actions:
                action_idx = 2
            elif 0 in valid_actions:
                action_idx = 0
            else:
                 action_idx = valid_actions[0]

        return {
            'action': action_name,
            'action_idx': action_idx,
            'raise_amount_pot_multiple': raise_amount_multiple,
            'probability': 1.0
        }

    def _strategy_preflop(self, hole_cards, valid_actions):
        c1, c2 = hole_cards[0], hole_cards[1]

        is_pair = c1.rank == c2.rank
        is_suited = c1.suit == c2.suit

        r1_val = self._get_rank_val(c1)
        r2_val = self._get_rank_val(c2)

        high_val = max(r1_val, r2_val)
        low_val = min(r1_val, r2_val)

        if is_pair:
            if high_val >= 10: # TT+
                return 2 # Raise
            elif high_val >= 7: # 77-99
                return 1 # Call
            else:
                return 1 # Call (low pair)

        if high_val >= 13: # K or A
             if low_val >= 10:
                 return 2 if high_val == 14 else 1
             elif is_suited and low_val >= 9:
                 return 1

        if is_suited and high_val >= 10 and low_val >= 9: # JTs, QJs
            return 1

        if 1 in valid_actions:
            return 0

        return 0

    def _strategy_postflop(self, hole_cards, board_cards, valid_actions):
        try:
            full_hand = StandardHighHand.from_game(hole_cards + board_cards)
            desc = str(full_hand).lower()

            score = 0
            if 'straight flush' in desc: score = 10
            elif 'four of a kind' in desc: score = 9
            elif 'full house' in desc: score = 8
            elif 'flush' in desc: score = 7
            elif 'straight' in desc: score = 6
            elif 'three of a kind' in desc: score = 5
            elif 'two pair' in desc: score = 4
            elif 'one pair' in desc:
                score = 2
            else:
                score = 0

            if score >= 5:
                # Strong hand (Three of a kind +)
                return 2, 2.0
            elif score >= 4:
                # Two pair
                return 2, 0.7
            elif score >= 2:
                # One pair
                return 1, 0.0
            else:
                # High card / Trash
                return 0, 0.0

        except:
             return 1, 0.0

    def _get_rank_val(self, card):
        rank_char = str(card)[0]
        return self.high_cards.get(rank_char, 0)
