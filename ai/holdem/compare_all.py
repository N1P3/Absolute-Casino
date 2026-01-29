"""
Compare trained models against a heuristic player.
Includes 'best_model', 'best_model_rl', and a 'Heuristic' script.
"""

import argparse
import json
import numpy as np
import torch
import time
import matplotlib.pyplot as plt
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Union
from collections import defaultdict
from tqdm import tqdm

from inference import PokerInferenceEngine
from train_rl_pokerkit import PokerKitEnvironment
from pokerkit import StandardHighHand, Card

# Heuristic Player Implementation
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
                return 2, 2.0
            elif score >= 4:
                return 2, 0.7
            elif score >= 2:
                return 1, 0.0
            else:
                return 0, 0.0

        except:
             return 1, 0.0

    def _get_rank_val(self, card):
        rank_char = str(card)[0]
        return self.high_cards.get(rank_char, 0)


class ComparisonEngine:
    def __init__(self, players, starting_stack=1000, small_blind=5, big_blind=10):
        # Convert dict to valid list of agents for rotation
        self.agents = [players[i] for i in sorted(players.keys())]
        self.num_players = len(self.agents)
        self.player_names = {i: p.name if hasattr(p, 'name') else f"P{i}" for i, p in enumerate(self.agents)}

        self.env = PokerKitEnvironment(
            starting_stack=starting_stack,
            small_blind=small_blind,
            big_blind=big_blind,
            player_count=self.num_players
        )
        self.results = defaultdict(lambda: {'wins': 0, 'profit': [], 'games': 0})

    def play_game(self, shift=0):
        state = self.env.reset()
        info = {}

        step = 0
        while not state['done'] and step < 200:
            seat_idx = state['player_idx']
            # Map Map physical seat to logical agent
            agent_idx = (seat_idx + shift) % self.num_players
            player = self.agents[agent_idx]

            valid_actions = self.env.get_valid_actions()
            state['valid_actions'] = valid_actions

            try:
                if isinstance(player, PokerInferenceEngine):
                    pred = player.predict(state, temperature=1.0)
                else:
                    pred = player.predict(state)

                action_idx = pred['action_idx']
                raise_amt = pred.get('raise_amount_pot_multiple', 0.0)

                if valid_actions and action_idx not in valid_actions:
                    if 1 in valid_actions: action_idx = 1
                    elif 0 in valid_actions: action_idx = 0
                    else: action_idx = valid_actions[0]

                state, reward, done, info = self.env.step(action_idx, raise_amt)
            except Exception as e:
                valid = self.env.get_valid_actions()
                act = valid[0] if valid else 0
                state, reward, done, info = self.env.step(act, 0.0)

            step += 1

        agent_profits = [0.0] * self.num_players
        winner_agent = -1

        if state['done']:
            seat_profits = info.get('rewards', [0.0] * self.num_players)

            # Map seat profits back to agents
            for seat_i in range(self.num_players):
                agent_i = (seat_i + shift) % self.num_players
                agent_profits[agent_i] = seat_profits[seat_i]

            max_profit = max(agent_profits)
            winners = [i for i, p in enumerate(agent_profits) if abs(p - max_profit) < 1e-6 and p > 0]
            if len(winners) == 1:
                winner_agent = winners[0]
            elif len(winners) > 1:
                winner_agent = -1 # Tie/Split pot win logic simplified

        return winner_agent, agent_profits

    def run_tournament(self, num_games=100):
        print(f"Starting tournament with {num_games} games (with seat rotation)...")
        for i in tqdm(range(num_games)):
            # Rotate agents: shift determines which agent sits at Seat 0
            shift = i % self.num_players
            winner, profits = self.play_game(shift=shift)

            for p_idx in range(self.num_players):
                self.results[p_idx]['games'] += 1
                self.results[p_idx]['profit'].append(profits[p_idx])

            if winner is not None and winner >= 0:
                self.results[winner]['wins'] += 1

        self.print_summary()
        self.plot_results()

    def print_summary(self):
        print("\n=== Tournament Results ===")
        print(f"{'Player':<20} {'Wins':<10} {'Win Rate':<10} {'Total Profit':<15} {'Avg Profit/Game'}")
        for i in range(self.num_players):
            stats = self.results[i]
            name = self.player_names[i]
            wins = stats['wins']
            games = stats['games']
            win_rate = (wins/games * 100) if games > 0 else 0
            tot_profit = sum(stats['profit'])
            avg_profit = tot_profit / games if games > 0 else 0

            print(f"{name:<20} {wins:<10} {win_rate:>9.1f}% {tot_profit:>15.2f} {avg_profit:>15.4f}")

    def plot_results(self):
        # 1. Cumulative Profit
        plt.figure(figsize=(12, 6))
        for i in range(self.num_players):
            name = self.player_names[i]
            profits = self.results[i]['profit']
            cum_profit = np.cumsum(profits)
            plt.plot(cum_profit, label=name)

        plt.title("Cumulative Profit over Games")
        plt.xlabel("Game Number")
        plt.ylabel("Profit (Chips normalized)")
        plt.legend()
        plt.grid(True, alpha=0.3)
        plt.savefig("tournament_profit.png")
        print("Saved chart: tournament_profit.png")

        # 2. Win Counts
        plt.figure(figsize=(8, 6))
        names = [self.player_names[i] for i in range(self.num_players)]
        wins = [self.results[i]['wins'] for i in range(self.num_players)]
        plt.bar(names, wins, color=['blue', 'green', 'orange'])
        plt.title("Total Wins by Player")
        plt.ylabel("Wins")
        plt.savefig("tournament_wins.png")
        print("Saved chart: tournament_wins.png")


def main():
    print("Main function started.")

    # Define paths holding the models
    # We check relative to current dir (if running from ai/holdem) or from project root

    parser = argparse.ArgumentParser()
    parser.add_argument('--games', type=int, default=5000, help='Number of games to simulate')
    parser.add_argument('--rl-model', type=str, default="best_model.pt", help='Name of the RL model file (default: best_model.pt)')
    args = parser.parse_args()

    # Path to original Supervised Learning model
    sl_dir_name = "checkpoints_big_2"
    sl_model_name = "best_model.pt"

    # Path to new Reinforcement Learning model
    rl_dir_name = "checkpoints_rl_auto"
    rl_model_name = args.rl_model

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Using device: {device}")

    # Resolve SL path
    sl_path = Path(sl_dir_name) / sl_model_name
    if not sl_path.exists():
        sl_path = Path(f"ai/holdem/{sl_dir_name}") / sl_model_name

    # Resolve RL path
    rl_path = Path(rl_dir_name) / rl_model_name
    if not rl_path.exists():
        rl_path = Path(f"ai/holdem/{rl_dir_name}") / rl_model_name

    players = {}

    # Load Supervised Model
    if sl_path.exists():
        print(f"Loading Supervised Model from {sl_path}...")
        try:
            players[0] = PokerInferenceEngine(str(sl_path), device=device)
            players[0].name = "Supervised Model"
        except Exception as e:
            print(f"Failed to load Supervised Model: {e}")
            players[0] = HeuristicPokerPlayer(name="Heuristic Backup 1")
    else:
        print(f"Warning: Supervised model at {sl_path} not found.")
        players[0] = HeuristicPokerPlayer(name="Heuristic Backup 1")

    # Load RL Model
    if rl_path.exists():
        print(f"Loading RL Model from {rl_path}...")
        try:
            players[1] = PokerInferenceEngine(str(rl_path), device=device)
            players[1].name = "RL Model"
        except Exception as e:
            print(f"Failed to load RL Model: {e}")
            players[1] = HeuristicPokerPlayer(name="Heuristic Backup 2")
    else:
        print(f"Warning: RL model at {rl_path} not found.")
        players[1] = HeuristicPokerPlayer(name="Heuristic Backup 2")

    # Add Heuristic Player
    players[2] = HeuristicPokerPlayer(name="Heuristic Bot")

    # Remap indices to 0,1,2 continuously
    final_players = {i: p for i, (_, p) in enumerate(players.items())}

    print(f"Players: {[p.name for p in final_players.values()]}")

    engine = ComparisonEngine(final_players)
    engine.run_tournament(num_games=args.games)

if __name__ == "__main__":
    main()

