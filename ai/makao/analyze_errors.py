"""
Analiza błędów modelu - porównanie decyzji z heurystyką.
"""

import argparse
from collections import defaultdict
from sb3_contrib import MaskablePPO
from makao_env import MakaoEnv
from heuristic_agent import HeuristicAgent

RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
SUITS = ['H', 'D', 'C', 'S']
SUIT_SYMBOLS = {'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠'}

def card_to_str(card):
    """Konwertuje kartę na czytelny string."""
    if isinstance(card, str):
        # Format "2H", "TH" etc
        rank = card[:-1]
        suit = card[-1]
        return f"{rank}{SUIT_SYMBOLS.get(suit, suit)}"
    else:
        # Indeks 0-51
        rank = RANKS[card % 13]
        suit = SUITS[card // 13]
        return f"{rank}{SUIT_SYMBOLS.get(suit, suit)}"

def action_to_str(action):
    """Konwertuje akcję na czytelny string."""
    if action < 52:
        return f"Zagraj {card_to_str(action)}"
    elif action < 65:
        rank_idx = action - 52
        return f"Zagraj 2x {RANKS[rank_idx]}"
    elif action < 78:
        rank_idx = action - 65
        return f"Zagraj 3x {RANKS[rank_idx]}"
    elif action < 91:
        rank_idx = action - 78
        return f"Zagraj 4x {RANKS[rank_idx]}"
    elif action == 91:
        return "Dobierz kartę"
    else:
        return "Pomiń turę"

def get_hand_str(env, player_id):
    """Zwraca czytelny opis ręki gracza."""
    hand = env.hands[player_id]
    if not hand:
        return "(pusta)"
    return ", ".join(card_to_str(c) for c in sorted(hand))

def get_table_str(env):
    """Zwraca czytelny opis karty na stole."""
    if env.game.table_card:
        return card_to_str(env.game.table_card)
    return "(brak)"

def analyze_game(model, env, heuristic, verbose=True):
    """Analizuje jedną grę i zwraca statystyki błędów."""
    errors = []
    stats = defaultdict(int)
    
    obs, _ = env.reset()
    done = False
    step = 0
    winner = None
    
    while not done:
        current_player = env.current_player
        mask = env.action_masks()
        valid_actions = [i for i, v in enumerate(mask) if v]
        
        # Decyzja modelu
        model_action, _ = model.predict(obs, deterministic=True, action_masks=mask)
        model_action = int(model_action)
        
        # Decyzja heurystyki
        heuristic_action, _ = heuristic.select_action(env)
        
        stats['total_decisions'] += 1
        
        if model_action != heuristic_action:
            stats['disagreements'] += 1
            
            # Kategoryzuj typ błędu
            error_type = categorize_error(model_action, heuristic_action, env, current_player)
            stats[error_type] += 1
            
            if verbose:
                error_info = {
                    'step': step,
                    'player': current_player,
                    'hand': get_hand_str(env, current_player),
                    'table': get_table_str(env),
                    'pending_draw': env.game.pending_draw_count,
                    'pending_skip': env.game.pending_skip_turns,
                    'model_action': action_to_str(model_action),
                    'heuristic_action': action_to_str(heuristic_action),
                    'error_type': error_type,
                    'valid_actions': len(valid_actions)
                }
                errors.append(error_info)
        
        # Sprawdź kto wygrał przed wykonaniem ruchu
        acting_player = env.current_player
        obs, _, terminated, truncated, _ = env.step(model_action)
        done = terminated or truncated
        
        if terminated:
            # Sprawdź kto ma pustą rękę - wygrał
            if len(env.hands[0]) == 0:
                winner = 0  # Model wygrał
            elif len(env.hands[1]) == 0:
                winner = 1  # Heurystyka wygrała
            else:
                winner = 1 if len(env.hands[0]) > len(env.hands[1]) else 0
        
        step += 1
    
    return errors, stats, winner

def categorize_error(model_action, heuristic_action, env, player_id):
    """Kategoryzuje typ błędu."""
    # Model dobrał zamiast zagrać
    if model_action == 91 and heuristic_action < 91:
        return 'draw_instead_of_play'
    
    # Model zagrał zamiast dobrać
    if model_action < 91 and heuristic_action == 91:
        return 'play_instead_of_draw'
    
    # Model pominął zamiast zagrać
    if model_action == 92 and heuristic_action < 91:
        return 'skip_instead_of_play'
    
    # Model zagrał mniej kart (single vs multi)
    if model_action < 52 and 52 <= heuristic_action < 91:
        return 'single_instead_of_multi'
    
    # Model zagrał więcej kart
    if 52 <= model_action < 91 and heuristic_action < 52:
        return 'multi_instead_of_single'
    
    # Inna karta/kombinacja
    if model_action < 91 and heuristic_action < 91:
        # Sprawdź czy model zagrał kartę specjalną vs normalną
        model_rank = model_action % 13 if model_action < 52 else (model_action - 52) % 13 if model_action < 65 else (model_action - 65) % 13 if model_action < 78 else (model_action - 78) % 13
        heur_rank = heuristic_action % 13 if heuristic_action < 52 else (heuristic_action - 52) % 13 if heuristic_action < 65 else (heuristic_action - 65) % 13 if heuristic_action < 78 else (heuristic_action - 78) % 13
        
        special_ranks = [0, 1, 2, 9]  # 2, 3, 4, J
        model_special = model_rank in special_ranks
        heur_special = heur_rank in special_ranks
        
        if not model_special and heur_special:
            return 'normal_instead_of_special'
        if model_special and not heur_special:
            return 'special_instead_of_normal'
        
        return 'different_card_choice'
    
    return 'other'

def run_analysis(model_path, num_games=50, verbose_games=5):
    """Uruchamia analizę na wielu grach."""
    print(f"\n{'='*60}")
    print(f"ANALIZA BŁĘDÓW MODELU: {model_path}")
    print(f"{'='*60}\n")
    
    model = MaskablePPO.load(model_path)
    env = MakaoEnv()
    heuristic = HeuristicAgent()
    
    all_stats = defaultdict(int)
    model_wins = 0
    detailed_errors = []
    
    for game_idx in range(num_games):
        verbose = game_idx < verbose_games
        errors, stats, winner = analyze_game(model, env, heuristic, verbose=verbose)
        
        if winner == 0:
            model_wins += 1
        
        for key, val in stats.items():
            all_stats[key] += val
        
        if verbose and errors:
            print(f"\n--- Gra {game_idx + 1} (Wygrał: {'Model' if winner == 0 else 'Heurystyka'}) ---")
            for err in errors[:10]:  # Max 10 błędów na grę
                print(f"  Krok {err['step']}: {err['error_type']}")
                print(f"    Ręka: {err['hand']}")
                print(f"    Stół: {err['table']}, Dobierz: {err['pending_draw']}, Pomiń: {err['pending_skip']}")
                print(f"    Model: {err['model_action']}")
                print(f"    Heurystyka: {err['heuristic_action']}")
            
            if len(errors) > 10:
                print(f"  ... i {len(errors) - 10} więcej błędów")
    
    # Podsumowanie
    print(f"\n{'='*60}")
    print("PODSUMOWANIE")
    print(f"{'='*60}")
    print(f"Gry: {num_games}")
    print(f"Wygrane modelu: {model_wins}/{num_games} ({100*model_wins/num_games:.1f}%)")
    print(f"\nDecyzje ogółem: {all_stats['total_decisions']}")
    print(f"Niezgodności z heurystyką: {all_stats['disagreements']} ({100*all_stats['disagreements']/all_stats['total_decisions']:.1f}%)")
    
    print(f"\n--- Typy błędów ---")
    error_types = [
        ('draw_instead_of_play', 'Dobrał zamiast zagrać'),
        ('play_instead_of_draw', 'Zagrał zamiast dobrać'),
        ('skip_instead_of_play', 'Pominął zamiast zagrać'),
        ('single_instead_of_multi', 'Jedna karta zamiast wielu'),
        ('multi_instead_of_single', 'Wiele kart zamiast jednej'),
        ('normal_instead_of_special', 'Normalna zamiast specjalnej'),
        ('special_instead_of_normal', 'Specjalna zamiast normalnej'),
        ('different_card_choice', 'Inna karta tego samego typu'),
        ('other', 'Inne'),
    ]
    
    for key, desc in error_types:
        count = all_stats.get(key, 0)
        if count > 0:
            pct = 100 * count / all_stats['disagreements'] if all_stats['disagreements'] > 0 else 0
            print(f"  {desc}: {count} ({pct:.1f}%)")

def main():
    parser = argparse.ArgumentParser(description='Analiza błędów modelu Makao')
    parser.add_argument('--model', type=str, required=True, help='Ścieżka do modelu .zip')
    parser.add_argument('--games', type=int, default=50, help='Liczba gier do analizy')
    parser.add_argument('--verbose', type=int, default=5, help='Ile gier pokazać szczegółowo')
    
    args = parser.parse_args()
    run_analysis(args.model, args.games, args.verbose)

if __name__ == "__main__":
    main()
