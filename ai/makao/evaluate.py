"""
Ewaluacja modelu Makao przeciwko heurystyce.

Rozgrywa wiele gier między modelem PPO a heurystycznym agentem
i oblicza statystyki wygranych.
"""

import argparse
import time
import random
import numpy as np

from sb3_contrib import MaskablePPO
from makao_env import MakaoEnv
from makao_env_v3 import MakaoEnvV3
from heuristic_agent import HeuristicAgent


def detect_env_version(model_path: str):
    """Wykrywa wersję środowiska na podstawie observation space modelu."""
    model = MaskablePPO.load(model_path)
    obs_size = model.observation_space.shape[0]
    if obs_size == 180:
        return 3  # V3 i V4 mają tę samą przestrzeń obserwacji
    return 1


def evaluate_v3(model_path: str, episodes: int = 100, verbose: bool = False):
    """
    Ewaluacja dla V3 - heurystyka jest wbudowana w środowisko.
    Model = P0, Heurystyka = P1 (automatycznie w step).
    """
    env = MakaoEnvV3()
    
    print(f"Ładowanie modelu: {model_path}")
    model = MaskablePPO.load(model_path)
    print("Model załadowany (V3 - sparse rewards)")
    
    print(f"\n{'='*60}")
    print(f"EWALUACJA V3: Model vs Heurystyka (wbudowana)")
    print(f"{'='*60}")
    print(f"Epizody: {episodes}")
    print(f"{'='*60}\n")
    
    stats = {
        'model_wins': 0,
        'heuristic_wins': 0,
        'draws': 0,
        'model_cards_left': [],
        'heuristic_cards_left': [],
    }
    
    start_time = time.time()
    
    for ep in range(episodes):
        obs, _ = env.reset()
        done = False
        truncated = False
        step_count = 0
        
        while not (done or truncated):
            step_count += 1
            mask = env.action_masks()
            
            # Tylko model decyduje - heurystyka automatycznie w step()
            action, _ = model.predict(obs, action_masks=mask, deterministic=True)
            action = int(action)
            
            obs, reward, done, truncated, info = env.step(action)
            
            if step_count > 500:
                truncated = True
                break
        
        model_cards = len(env.hands[0])
        heur_cards = len(env.hands[1])
        stats['model_cards_left'].append(model_cards)
        stats['heuristic_cards_left'].append(heur_cards)
        
        if truncated:
            stats['draws'] += 1
            result = "DRAW"
        elif model_cards == 0:
            stats['model_wins'] += 1
            result = "MODEL WIN"
        elif heur_cards == 0:
            stats['heuristic_wins'] += 1
            result = "HEUR WIN"
        else:
            stats['draws'] += 1
            result = "DRAW"
        
        if verbose or (ep + 1) % 20 == 0:
            print(f"Ep {ep+1:3d}/{episodes}: {result:10s} | Steps: {step_count:3d} | "
                  f"Model wins: {stats['model_wins']:3d} ({stats['model_wins']/(ep+1)*100:.1f}%)")
    
    elapsed = time.time() - start_time
    
    print(f"\n{'='*60}")
    print("WYNIKI EWALUACJI (V3)")
    print(f"{'='*60}")
    print(f"Łącznie epizodów: {episodes}")
    print(f"Czas: {elapsed:.1f}s")
    print()
    print(f"Model wygrane:     {stats['model_wins']:4d} ({stats['model_wins']/episodes*100:.1f}%)")
    print(f"Heurystyka wygr:   {stats['heuristic_wins']:4d} ({stats['heuristic_wins']/episodes*100:.1f}%)")
    print(f"Remisy:            {stats['draws']:4d} ({stats['draws']/episodes*100:.1f}%)")
    print()
    print(f"Śr. karty modelu:    {np.mean(stats['model_cards_left']):.2f}")
    print(f"Śr. karty heuryst:   {np.mean(stats['heuristic_cards_left']):.2f}")
    print(f"{'='*60}")
    
    return stats


def evaluate_vs_heuristic(
    model_path: str,
    episodes: int = 100,
    verbose: bool = False,
    model_as_p0: bool = True,
    env_version: int = None
):
    """
    Ewaluuje model przeciwko heurystyce.
    
    Args:
        model_path: Ścieżka do modelu .zip
        episodes: Liczba epizodów
        verbose: Szczegółowy output
        model_as_p0: Czy model gra jako P0 (True) czy P1 (False)
        env_version: Wersja środowiska (auto-detect jeśli None)
    """
    # Auto-detect env version
    if env_version is None:
        env_version = detect_env_version(model_path)
        print(f"Auto-detected env version: {env_version}")
    
    if env_version == 3:
        env = MakaoEnvV3()
    else:
        env = MakaoEnv()
    heuristic = HeuristicAgent()
    
    print(f"Ładowanie modelu: {model_path}")
    try:
        model = MaskablePPO.load(model_path)
        print("Model załadowany pomyślnie")
    except Exception as e:
        print(f"Błąd ładowania modelu: {e}")
        return
    
    model_player = 0 if model_as_p0 else 1
    
    print(f"\n{'='*60}")
    print(f"EWALUACJA: Model vs Heurystyka")
    print(f"{'='*60}")
    print(f"Model gra jako: P{model_player}")
    print(f"Epizody: {episodes}")
    print(f"{'='*60}\n")
    
    stats = {
        'model_wins': 0,
        'heuristic_wins': 0,
        'draws': 0,
        'total_steps': 0,
        'model_cards_left': [],
        'heuristic_cards_left': [],
        'episode_lengths': []
    }
    
    start_time = time.time()
    
    for ep in range(episodes):
        obs, _ = env.reset()
        done = False
        truncated = False
        step_count = 0
        
        while not (done or truncated):
            step_count += 1
            current_player = env.current_player
            mask = env.action_masks()
            
            if current_player == model_player:
                # Model's turn
                action, _ = model.predict(obs, action_masks=mask, deterministic=True)
                action = int(action)
            else:
                # Heuristic's turn
                action, _ = heuristic.select_action(env, verbose=False)
            
            if verbose and step_count <= 5:
                player_name = "Model" if current_player == model_player else "Heur"
                desc = env.action_to_description(action)
                print(f"  [{player_name}] {desc}")
            
            obs, reward, done, truncated, info = env.step(action)
            
            if step_count > 500:
                truncated = True
                break
        
        stats['total_steps'] += step_count
        stats['episode_lengths'].append(step_count)
        
        model_cards = len(env.hands[model_player])
        heur_cards = len(env.hands[1 - model_player])
        stats['model_cards_left'].append(model_cards)
        stats['heuristic_cards_left'].append(heur_cards)
        
        if truncated:
            stats['draws'] += 1
            result = "DRAW"
        elif model_cards == 0:
            stats['model_wins'] += 1
            result = "MODEL WIN"
        else:
            stats['heuristic_wins'] += 1
            result = "HEUR WIN"
        
        if verbose or (ep + 1) % 20 == 0:
            print(f"Ep {ep+1:3d}/{episodes}: {result:10s} | Steps: {step_count:3d} | "
                  f"Model wins: {stats['model_wins']:3d} ({stats['model_wins']/(ep+1)*100:.1f}%)")
    
    elapsed = time.time() - start_time
    
    # Podsumowanie
    print(f"\n{'='*60}")
    print("WYNIKI EWALUACJI")
    print(f"{'='*60}")
    print(f"Łącznie epizodów: {episodes}")
    print(f"Czas: {elapsed:.1f}s ({elapsed/episodes:.2f}s/ep)")
    print()
    print(f"Model wygrane:     {stats['model_wins']:4d} ({stats['model_wins']/episodes*100:.1f}%)")
    print(f"Heurystyka wygr:   {stats['heuristic_wins']:4d} ({stats['heuristic_wins']/episodes*100:.1f}%)")
    print(f"Remisy:            {stats['draws']:4d} ({stats['draws']/episodes*100:.1f}%)")
    print()
    print(f"Śr. długość epizodu: {np.mean(stats['episode_lengths']):.1f}")
    print(f"Śr. karty modelu:    {np.mean(stats['model_cards_left']):.2f}")
    print(f"Śr. karty heuryst:   {np.mean(stats['heuristic_cards_left']):.2f}")
    print(f"{'='*60}")
    
    return stats


def evaluate_vs_random(
    model_path: str,
    episodes: int = 100,
    verbose: bool = False
):
    """Ewaluuje model przeciwko losowemu agentowi."""
    env = MakaoEnv()
    
    print(f"Ładowanie modelu: {model_path}")
    model = MaskablePPO.load(model_path)
    
    print(f"\n{'='*60}")
    print(f"EWALUACJA: Model vs Random")
    print(f"{'='*60}")
    
    model_wins = 0
    random_wins = 0
    draws = 0
    
    for ep in range(episodes):
        obs, _ = env.reset()
        done = False
        truncated = False
        steps = 0
        
        while not (done or truncated) and steps < 500:
            steps += 1
            current_player = env.current_player
            mask = env.action_masks()
            valid = [i for i, v in enumerate(mask) if v]
            
            if current_player == 0:
                action, _ = model.predict(obs, action_masks=mask, deterministic=True)
                action = int(action)
            else:
                action = random.choice(valid)
            
            obs, reward, done, truncated, info = env.step(action)
        
        if steps >= 500:
            draws += 1
        elif len(env.hands[0]) == 0:
            model_wins += 1
        else:
            random_wins += 1
        
        if (ep + 1) % 20 == 0:
            print(f"Ep {ep+1}/{episodes}: Model {model_wins}, Random {random_wins}, Draws {draws}")
    
    print(f"\n{'='*60}")
    print(f"Model wins:  {model_wins} ({model_wins/episodes*100:.1f}%)")
    print(f"Random wins: {random_wins} ({random_wins/episodes*100:.1f}%)")
    print(f"Draws:       {draws} ({draws/episodes*100:.1f}%)")
    print(f"{'='*60}")


def heuristic_vs_random(episodes: int = 100):
    """Baseline: Heurystyka vs Random."""
    env = MakaoEnv()
    heuristic = HeuristicAgent()
    
    print(f"\n{'='*60}")
    print(f"BASELINE: Heurystyka vs Random")
    print(f"{'='*60}")
    
    heur_wins = 0
    random_wins = 0
    draws = 0
    
    for ep in range(episodes):
        obs, _ = env.reset()
        done = False
        truncated = False
        steps = 0
        
        while not (done or truncated) and steps < 500:
            steps += 1
            current_player = env.current_player
            mask = env.action_masks()
            valid = [i for i, v in enumerate(mask) if v]
            
            if current_player == 0:
                action, _ = heuristic.select_action(env, verbose=False)
            else:
                action = random.choice(valid)
            
            obs, reward, done, truncated, info = env.step(action)
        
        if steps >= 500:
            draws += 1
        elif len(env.hands[0]) == 0:
            heur_wins += 1
        else:
            random_wins += 1
        
        if (ep + 1) % 20 == 0:
            print(f"Ep {ep+1}/{episodes}: Heur {heur_wins}, Random {random_wins}")
    
    print(f"\n{'='*60}")
    print(f"Heurystyka wins: {heur_wins} ({heur_wins/episodes*100:.1f}%)")
    print(f"Random wins:     {random_wins} ({random_wins/episodes*100:.1f}%)")
    print(f"Draws:           {draws} ({draws/episodes*100:.1f}%)")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="Ewaluacja modelu Makao")
    parser.add_argument("--model", "-m", type=str, required=True,
                        help="Ścieżka do modelu .zip")
    parser.add_argument("--episodes", "-e", type=int, default=100,
                        help="Liczba epizodów (domyślnie: 100)")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Szczegółowy output")
    parser.add_argument("--opponent", "-o", type=str, default="heuristic",
                        choices=["heuristic", "random", "baseline"],
                        help="Typ przeciwnika")
    
    args = parser.parse_args()
    
    if args.opponent == "baseline":
        heuristic_vs_random(args.episodes)
    elif args.opponent == "random":
        evaluate_vs_random(args.model, args.episodes, args.verbose)
    else:
        # Auto-detect env version
        env_version = detect_env_version(args.model)
        if env_version == 3:
            evaluate_v3(args.model, args.episodes, args.verbose)
        else:
            evaluate_vs_heuristic(args.model, args.episodes, args.verbose)


if __name__ == "__main__":
    main()
