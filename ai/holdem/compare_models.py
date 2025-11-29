"""
Compare multiple trained PokerTransformer models by having them play against each other.

Usage:
    # Compare 2 models with 1000 games
    python compare_models.py \
        --models checkpoints/best_model.pt checkpoints_rl/best_model.pt \
        --games 1000 \
        --device cuda

    # Compare 3+ models with custom stack sizes
    python compare_models.py \
        --models model1.pt model2.pt model3.pt \
        --games 500 \
        --starting-stack 2000 \
        --device cuda

    # Compare with smaller batch for testing
    python compare_models.py \
        --models checkpoints/best_model.pt checkpoints_good/best_model.pt \
        --games 100 \
        --batch-size 1 \
        --device cpu

The script loads each checkpoint using the PokerInferenceEngine,
creates PokerKit NoLimitTexasHoldem games for each matchup,
and prints a detailed summary with:
  - Head-to-head matchup results
  - Win/loss/draw rates
  - Average chips won/lost
  - Win rate statistics
"""

import argparse
import json
import numpy as np
import torch
import time
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
from tqdm import tqdm

from inference import PokerInferenceEngine
from environment import PokerKitEnvironment
from model import PluribusPokerTransformer


class ModelComparisonEngine:
    """Compare multiple poker models by having them play against each other."""
    
    def __init__(
        self,
        model_paths: List[str],
        device: str = 'cpu',
        starting_stack: int = 1000,
        small_blind: int = 5,
        big_blind: int = 10,
    ):
        """
        Initialize comparison engine.
        
        Args:
            model_paths: List of paths to model checkpoints
            device: Device to run models on ('cpu' or 'cuda')
            starting_stack: Starting chips for each player
            small_blind: Small blind size
            big_blind: Big blind size
        """
        self.device = torch.device(device)
        self.starting_stack = starting_stack
        self.small_blind = small_blind
        self.big_blind = big_blind
        
        # Load all models
        self.models = {}
        self.model_names = {}
        # Track when we override invalid model actions (for diagnostics)
        # Use per-seat counters so we can attribute overrides to each model
        self.override_counts = {i: defaultdict(int) for i in range(len(model_paths))}
        print("Loading models...")
        for i, path in enumerate(model_paths):
            path = Path(path)
            model_name = path.stem
            # Ensure display name is unique (multiple checkpoints may share the same stem)
            display_name = f"{model_name}#{i}"
            self.models[i] = PokerInferenceEngine(str(path), device=device)
            self.model_names[i] = display_name
            print(f"  [{i}] {display_name}")
        
        # Create environment for game simulation (one table with all loaded models)
        self.num_players = len(self.models)
        self.env = PokerKitEnvironment(
            starting_stack=starting_stack,
            small_blind=small_blind,
            big_blind=big_blind,
            player_count=self.num_players,
        )
        
        # Results tracking
        self.results = {}
    
    def play_game(self, temperature: float = 1.0, verbose: bool = False) -> Tuple[Optional[int], List[float]]:
        """
        Play one multi-player game with all loaded models seated at the table.

        Returns:
            winner: Index of winner (single index) or None for draw/split
            profits: List of profit/loss for each player
        """
        # Reset environment
        state = self.env.reset()

        if verbose:
            print(f"\nGame: {' vs '.join(self.model_names.values())}")
            print(f"Stacks: {state['stacks'][:self.num_players]}, Pot: {state['pot']}")

        step_count = 0
        max_steps = 100

        profits = [0.0] * self.num_players
        info = {}

        while not state['done'] and step_count < max_steps:
            current_player = state['player_idx']
            engine = self.models.get(current_player, None)

            try:
                if engine is None:
                    raise RuntimeError('No model for this seat; using random baseline')

                prediction = engine.predict(state, temperature=temperature)
                action_idx = prediction['action_idx']
                raise_amount = prediction['raise_amount_pot_multiple']

                valid_actions = state.get('valid_actions') or self.env.get_valid_actions()
                # If model chose to FOLD but folding isn't valid, prefer CALL then RAISE
                if action_idx == 0 and (valid_actions is None or 0 not in valid_actions):
                    if 1 in valid_actions:
                        self.override_counts[current_player]['fold_to_call'] += 1
                        action_idx = 1
                    elif 2 in valid_actions:
                        self.override_counts[current_player]['fold_to_raise'] += 1
                        action_idx = 2
                if action_idx == 1:
                    raise_amount = 0.0

            except Exception as e:
                if verbose:
                    print(f"  Error getting action for seat {current_player}: {e}")
                valid_actions = self.env.get_valid_actions()
                if not valid_actions:
                    break
                action_idx = int(np.random.choice(valid_actions))
                raise_amount = 1.0

            action_names = ['FOLD', 'CALL', 'RAISE']
            if verbose:
                model_name = self.model_names.get(current_player, f'seat_{current_player}')
                print(f"  P{current_player} ({model_name}): {action_names[action_idx]} (raise_mult={raise_amount:.2f})")

            # Defensive override: if model chose RAISE but RAISE is not valid,
            # convert to CALL to avoid PokerKit invalid-action warnings.
            valid_actions = state.get('valid_actions') or self.env.get_valid_actions()
            if action_idx == 2 and (valid_actions is None or 2 not in valid_actions):
                if 1 in valid_actions:
                    self.override_counts[current_player]['raise_to_call'] += 1
                    action_idx = 1
                    raise_amount = 0.0
                elif 0 in valid_actions:
                    self.override_counts[current_player]['raise_to_fold'] += 1
                    action_idx = 0

            state, reward, done, info = self.env.step(action_idx, raise_amount)
            step_count += 1

        # Finalize profits and winner
        if not state['done'] or step_count >= max_steps:
            profits = [0.0] * self.num_players
            winner = None
        else:
            profits = info.get('rewards', [0.0] * self.num_players)
            max_profit = max(profits)
            winners = [i for i, p in enumerate(profits) if abs(p - max_profit) < 1e-6]
            winner = winners[0] if len(winners) == 1 else None

        if verbose:
            print("Result:")
            for i, p in enumerate(profits):
                name = self.model_names.get(i, f'seat_{i}')
                print(f"  P{i} ({name}) profit={p:.2f}")

        return winner, profits
    
    def run_tournament(
        self,
        num_games: int,
        temperature: float = 1.0,
        batch_size: int = 1,
        verbose: bool = False,
    ) -> Dict:
        """
        Run tournament where all models play against each other.
        
        Args:
            num_games: Number of games per matchup
            temperature: Sampling temperature
            batch_size: Number of games to display progress for
            verbose: Print detailed game logs
        
        Returns:
            Results dictionary with statistics
        """
        num_models = len(self.models)
        print(f"\nRunning single-table tournament with {num_models} players...")
        print(f"Games: {num_games}")
        print(f"Temperature: {temperature}\n")

        # Initialize per-player aggregated results
        self.results = {i: {'wins': 0, 'draws': 0, 'profit': [], 'games_played': 0} for i in range(num_models)}

        total_games = num_games
        with tqdm(total=total_games, desc="Playing games", ncols=80) as pbar:
            for game_num in range(num_games):
                winner, profits = self.play_game(temperature=temperature, verbose=(verbose and game_num < 2))

                # Record per-player stats
                for i in range(num_models):
                    self.results[i]['profit'].append(profits[i] if i < len(profits) else 0.0)
                    self.results[i]['games_played'] += 1

                if winner is None:
                    for i in range(num_models):
                        self.results[i]['draws'] += 1
                else:
                    self.results[winner]['wins'] += 1

                pbar.update(1)
        
        return self._compute_summary()
    
    def _compute_summary(self) -> Dict:
        """Compute summary statistics from results."""
        summary = {
            'matchups': {},
            'overall_stats': {},
        }

        # self.results now maps player_index -> aggregated stats for single-table tournament
        for i, result in self.results.items():
            games = result.get('games_played', 0)
            total_profit = sum(result.get('profit', []))
            wins = result.get('wins', 0)
            draws = result.get('draws', 0)

            avg_profit = total_profit / games if games > 0 else 0.0
            win_rate = wins / games if games > 0 else 0.0

            summary['overall_stats'][self.model_names.get(i, f'seat_{i}')] = {
                'total_wins': wins,
                'total_games': games,
                'overall_win_rate': win_rate,
                'total_profit': total_profit,
                'avg_profit_per_game': avg_profit,
                'draws': draws,
            }

        return summary
    
    def print_results(self, summary: Dict) -> None:
        """Pretty-print tournament results."""
        print("\n" + "="*100)
        print("TOURNAMENT RESULTS")
        print("="*100)
        
        # Overall rankings for single-table tournament
        print("\nOverall Rankings (single-table):")
        print("-" * 100)
        print(f"{'Rank':<6} {'Model':<30} {'Total Wins':>12} {'Win Rate':>12} {'Total Profit':>14} {'Avg/Game':>12} {'Draws':>8}")
        print("-" * 100)

        # Sort by win rate
        sorted_models = sorted(
            summary['overall_stats'].items(),
            key=lambda x: x[1]['overall_win_rate'],
            reverse=True,
        )

        for rank, (model_name, stats) in enumerate(sorted_models, 1):
            win_rate_pct = stats['overall_win_rate'] * 100
            print(f"{rank:<6} {model_name:<30} {stats['total_wins']:>12} {win_rate_pct:>11.1f}% "
                  f"{stats['total_profit']:>14.2f} {stats['avg_profit_per_game']:>12.2f} {stats.get('draws',0):>8}")
        
        print("="*100 + "\n")
    
    def save_results(self, output_path: str, summary: Dict) -> None:
        """Save results to JSON file."""
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        # Add override diagnostics (convert per-seat defaultdicts to regular dicts)
        summary_out = dict(summary)
        overrides_out = {
            self.model_names.get(i, f'seat_{i}'): dict(self.override_counts.get(i, {}))
            for i in range(len(self.override_counts))
        }
        summary_out['overrides'] = overrides_out

        with open(output_file, 'w') as f:
            json.dump(summary_out, f, indent=2)
        
        print(f"Results saved to: {output_file}")


def main():
    parser = argparse.ArgumentParser(
        description="Compare trained poker transformer models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Compare 2 models with 1000 games on GPU
  python compare_models.py --models checkpoints/best_model.pt checkpoints_rl/best_model.pt --games 1000 --device cuda

  # Compare 3 models with 500 games each
  python compare_models.py --models model1.pt model2.pt model3.pt --games 500 --device cuda

  # Quick test with 10 games on CPU
  python compare_models.py --models model1.pt model2.pt --games 10 --device cpu
        """
    )
    
    parser.add_argument(
        '--models',
        nargs='+',
        required=True,
        help='Paths to model checkpoints to compare'
    )
    parser.add_argument(
        '--games',
        type=int,
        default=100,
        help='Number of games per matchup (default: 100)'
    )
    parser.add_argument(
        '--device',
        choices=['cpu', 'cuda'],
        default='cpu',
        help='Device to run models on (default: cpu)'
    )
    parser.add_argument(
        '--temperature',
        type=float,
        default=1.0,
        help='Sampling temperature (default: 1.0)'
    )
    parser.add_argument(
        '--starting-stack',
        type=int,
        default=1000,
        help='Starting stack for each player (default: 1000)'
    )
    parser.add_argument(
        '--small-blind',
        type=int,
        default=5,
        help='Small blind size (default: 5)'
    )
    parser.add_argument(
        '--big-blind',
        type=int,
        default=10,
        help='Big blind size (default: 10)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='comparison_results.json',
        help='Output file for results (default: comparison_results.json)'
    )
    parser.add_argument(
        '--verbose',
        action='store_true',
        help='Print detailed game logs'
    )
    
    args = parser.parse_args()
    
    # Validate models exist
    for model_path in args.models:
        if not Path(model_path).exists():
            print(f"Error: Model not found: {model_path}")
            return
    
    # Check CUDA availability
    if args.device == 'cuda' and not torch.cuda.is_available():
        print("Error: CUDA requested but not available. Use --device cpu")
        return
    
    # Create engine
    engine = ModelComparisonEngine(
        model_paths=args.models,
        device=args.device,
        starting_stack=args.starting_stack,
        small_blind=args.small_blind,
        big_blind=args.big_blind,
    )
    
    # Run tournament
    start_time = time.time()
    summary = engine.run_tournament(
        num_games=args.games,
        temperature=args.temperature,
        verbose=args.verbose,
    )
    elapsed = time.time() - start_time
    
    # Print and save results
    engine.print_results(summary)
    engine.save_results(args.output, summary)
    
    print(f"Tournament completed in {elapsed:.1f} seconds")
    print(f"Total games played: {args.games}")


if __name__ == '__main__':
    main()
