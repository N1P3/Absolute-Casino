"""
Gra przeciwko AI z pełnym outputem operacji.
Gracz (człowiek) gra jako P0, AI jako P1.
"""

import argparse
from makao_env import MakaoEnv
from heuristic_agent import HeuristicAgent

try:
    from sb3_contrib import MaskablePPO
    HAS_SB3 = True
except ImportError:
    HAS_SB3 = False
    print("[WARN] sb3_contrib nie zainstalowane - tylko tryb heurystyczny dostępny")


def card_name(card: str) -> str:
    """Zamienia kod karty na czytelną nazwę."""
    ranks = {'2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', 
             '8': '8', '9': '9', 'T': '10', 'J': 'Walet', 'Q': 'Dama', 
             'K': 'Król', 'A': 'As'}
    suits = {'H': '♥', 'D': '♦', 'C': '♣', 'S': '♠'}
    return f"{ranks.get(card[0], card[0])}{suits.get(card[1], card[1])}"


def print_game_state(env, show_opponent=False):
    """Wyświetla stan gry."""
    print("\n" + "="*50)
    print(f"Karta na stole: {card_name(env.game.table_card)}")
    
    if env.game.pending_draw_count > 0:
        print(f"⚠️  Do dobrania: {env.game.pending_draw_count} kart (typ: {env.game.draw_type})")
    if env.game.pending_skip_turns > 0:
        skip_player = "Ty" if env.game.player_to_skip == 0 else "AI"
        print(f"⚠️  {skip_player} musi pominąć {env.game.pending_skip_turns} tur(ę)")
    if env.game.current_suit:
        suits = {'H': '♥ Kier', 'D': '♦ Karo', 'C': '♣ Trefl', 'S': '♠ Pik'}
        print(f"🎯 Wymagany kolor: {suits.get(env.game.current_suit, env.game.current_suit)}")
    if env.game.required_number:
        print(f"🎯 Wymagana wartość: {env.game.required_number}")
    
    print(f"\nTwoja ręka ({len(env.hands[0])} kart):")
    hand_str = "  " + " ".join(card_name(c) for c in sorted(env.hands[0]))
    print(hand_str)
    
    if show_opponent:
        print(f"\nRęka AI ({len(env.hands[1])} kart):")
        opp_str = "  " + " ".join(card_name(c) for c in sorted(env.hands[1]))
        print(opp_str)
    else:
        print(f"\nAI ma {len(env.hands[1])} kart")
    print("="*50)


def get_player_action(env):
    """Pobiera akcję od gracza."""
    mask = env.action_masks()
    valid_actions = [i for i, v in enumerate(mask) if v]
    
    print("\nDostępne akcje:")
    action_map = {}
    idx = 1
    
    # Karty pojedyncze
    for action in valid_actions:
        if action < 52:
            card = env.card_map[action]
            print(f"  {idx}. Zagraj {card_name(card)}")
            action_map[idx] = action
            idx += 1
    
    # Multi-card
    for action in valid_actions:
        if 52 <= action <= 64:
            rank_idx = action - 52
            rank = env.ranks[rank_idx]
            print(f"  {idx}. Zagraj 2x {rank}")
            action_map[idx] = action
            idx += 1
        elif 65 <= action <= 77:
            rank_idx = action - 65
            rank = env.ranks[rank_idx]
            print(f"  {idx}. Zagraj 3x {rank}")
            action_map[idx] = action
            idx += 1
        elif 78 <= action <= 90:
            rank_idx = action - 78
            rank = env.ranks[rank_idx]
            print(f"  {idx}. Zagraj 4x {rank}")
            action_map[idx] = action
            idx += 1
    
    # Specjalne
    if 91 in valid_actions:
        to_draw = env.game.pending_draw_count if env.game.pending_draw_count > 0 else 1
        print(f"  {idx}. Dobierz {to_draw} kart(y)")
        action_map[idx] = 91
        idx += 1
    
    if 92 in valid_actions:
        print(f"  {idx}. Pomiń turę")
        action_map[idx] = 92
        idx += 1
    
    while True:
        try:
            choice = int(input("\nTwój wybór (numer): "))
            if choice in action_map:
                return action_map[choice]
            print("Nieprawidłowy wybór, spróbuj ponownie.")
        except ValueError:
            print("Podaj numer akcji.")


def play_game(model_path=None, show_opponent=False):
    """Główna pętla gry."""
    env = MakaoEnv()
    
    # Wybór typu AI
    if model_path and HAS_SB3:
        try:
            model = MaskablePPO.load(model_path)
            ai_type = "Model PPO"
            print(f"[INFO] Załadowano model: {model_path}")
        except Exception as e:
            print(f"[WARN] Nie można załadować modelu: {e}")
            print("[INFO] Używam heurystyki")
            model = None
            ai_type = "Heurystyka"
    else:
        model = None
        ai_type = "Heurystyka"
    
    heuristic = HeuristicAgent()
    
    print("\n" + "="*50)
    print("       🃏 MAKAO - GRA PRZECIWKO AI 🃏")
    print(f"           Tryb AI: {ai_type}")
    print("="*50)
    
    obs, _ = env.reset()
    done = False
    truncated = False
    turn = 0
    
    while not (done or truncated):
        turn += 1
        player = env.current_player
        
        print_game_state(env, show_opponent)
        
        if player == 0:  # Gracz
            print("\n>>> TWOJA TURA <<<")
            action = get_player_action(env)
            desc = env.action_to_description(action)
            print(f"\nWybrałeś: {desc}")
        else:  # AI
            print("\n>>> TURA AI <<<")
            
            if model:
                mask = env.action_masks()
                action, _ = model.predict(obs, action_masks=mask, deterministic=True)
                action = int(action)
                desc = env.action_to_description(action)
            else:
                action, desc = heuristic.select_action(env, verbose=False)
            
            print(f"AI ({ai_type}) wykonuje: {desc}")
            
            # Szczegółowy output dla multi-card
            if 52 <= action <= 90:
                if action <= 64:
                    num = 2
                    rank_idx = action - 52
                elif action <= 77:
                    num = 3
                    rank_idx = action - 65
                else:
                    num = 4
                    rank_idx = action - 78
                rank = env.ranks[rank_idx]
                cards = [c for c in env.hands[1] if c[0] == rank][:num]
                print(f"   Karty: {' '.join(card_name(c) for c in cards)}")
        
        obs, reward, done, truncated, info = env.step(action)
        
        if done:
            print("\n" + "="*50)
            if len(env.hands[player]) == 0:
                if player == 0:
                    print("🎉🎉🎉 WYGRAŁEŚ! 🎉🎉🎉")
                else:
                    print("😢 Przegrałeś... AI wygrało.")
            else:
                if player == 0:
                    print("😢 Przegrałeś... AI wygrało.")
                else:
                    print("🎉🎉🎉 WYGRAŁEŚ! 🎉🎉🎉")
            print("="*50)
        
        if truncated:
            print("\n" + "="*50)
            print("⏰ Remis - gra trwała za długo")
            print("="*50)
    
    print(f"\nGra zakończona po {turn} turach.")
    print(f"Twoje karty: {len(env.hands[0])}, Karty AI: {len(env.hands[1])}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Gra w Makao przeciwko AI")
    parser.add_argument("--model", type=str, default=None, 
                        help="Ścieżka do modelu PPO (domyślnie: heurystyka)")
    parser.add_argument("--show-opponent", action="store_true",
                        help="Pokaż karty przeciwnika (debug)")
    args = parser.parse_args()
    
    play_game(model_path=args.model, show_opponent=args.show_opponent)
