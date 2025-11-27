import os
import time
import numpy as np
import torch
from sb3_contrib import MaskablePPO
from makao_env import MakaoEnv

def play_vs_ai():
    if not os.path.exists("makao_ppo_model.zip"):
        print("Error: 'makao_ppo_model.zip' not found.")
        print("Please run 'python ai/train.py' first to train the model.")
        return

    print("Loading environment and model...")
    env = MakaoEnv()
    
    # Load the trained model
    try:
        model = MaskablePPO.load("makao_ppo_model")
    except Exception as e:
        print(f"Error loading model: {e}")
        return

    # Reset environment
    obs, _ = env.reset()
    done = False
    
    # Human is Player 0, AI is Player 1
    human_player = 0
    ai_player = 1
    
    print("\n" + "="*40)
    print("      MAKAO AI DUEL: HUMAN vs BOT      ")
    print("="*40)
    print("You are Player 0 (Starts first)")
    print("AI is Player 1")
    
    while not done:
        current_player = env.current_player
        
        # Display Game State
        print(f"\n{'-'*20} Turn: {'YOU' if current_player == human_player else 'AI'} {'-'*20}")
        print(f"Table Card: [{env.game.table_card}]")
        
        # Show active effects
        effects = []
        if env.game.current_suit: effects.append(f"Suit: {env.game.current_suit}")
        if env.game.required_number: effects.append(f"Rank: {env.game.required_number}")
        if env.game.pending_draw_count > 0: effects.append(f"Draw Stack: {env.game.pending_draw_count}")
        if env.game.pending_skip_turns > 0: effects.append(f"Skip Active (Target: {env.game.player_to_skip})")
        if effects:
            print("Active Effects: " + ", ".join(effects))
            
        print(f"AI Hand: {len(env.hands[ai_player])} cards")

        if current_player == human_player:
            # --- HUMAN TURN ---
            hand = env.hands[human_player]
            print(f"Your Hand: {hand}")
            
            # Get valid actions
            mask = env.action_masks()
            valid_indices = np.where(mask)[0]
            
            # Display options
            print("\nAvailable Actions:")
            options = {}
            for idx in valid_indices:
                if idx < 52:
                    card = env.card_map[idx]
                    desc = f"Play {card}"
                elif idx == 52:
                    desc = "Draw Card"
                elif idx == 53:
                    desc = "Skip Turn"
                
                print(f"  [{idx}] {desc}")
                options[idx] = desc
            
            # Input loop
            while True:
                try:
                    user_input = input("\nChoose action ID: ")
                    action = int(user_input)
                    if action in valid_indices:
                        break
                    else:
                        print("Invalid action. Please choose a number from the list.")
                except ValueError:
                    print("Invalid input. Please enter a number.")
            
            # Execute
            print(f"You chose: {options[action]}")
            obs, reward, done, truncated, info = env.step(action)
            
            if done:
                print("\n" + "*"*30)
                print("       YOU WON! CONGRATS!       ")
                print("*"*30)

        else:
            # --- AI TURN ---
            print("AI is thinking...")
            time.sleep(0.5) # Simulate thinking
            
            action_masks = env.action_masks()
            
            # --- LOGGING AI DECISION ---
            # Prepare tensors for probability analysis
            obs_tensor = torch.as_tensor(obs).unsqueeze(0)
            masks_tensor = torch.as_tensor(action_masks).unsqueeze(0)
            
            with torch.no_grad():
                # Get probability distribution from the policy
                dist = model.policy.get_distribution(obs_tensor, action_masks=masks_tensor)
                probs = dist.distribution.probs.numpy()[0]
            
            # Sort actions by probability
            top_indices = np.argsort(probs)[::-1]
            
            print("\n[AI Decision Logs]")
            print("Top considered moves:")
            count = 0
            for idx in top_indices:
                prob = probs[idx]
                if prob < 0.01: break # Don't show very low probs
                if count >= 5: break
                
                if idx < 52:
                    move_name = f"Play {env.card_map[idx]}"
                elif idx == 52:
                    move_name = "Draw"
                elif idx == 53:
                    move_name = "Skip"
                
                print(f"  - {move_name}: {prob*100:.1f}%")
                count += 1
                
            # Predict action (deterministic=True takes the argmax)
            action, _ = model.predict(obs, action_masks=action_masks, deterministic=True)
            
            # Execute
            if action < 52:
                move_desc = f"Plays {env.card_map[action]}"
            elif action == 52:
                move_desc = "Draws a card"
            elif action == 53:
                move_desc = "Skips turn"
                
            print(f"\n>>> AI {move_desc}")
            
            obs, reward, done, truncated, info = env.step(action)
            
            if done:
                print("\n" + "!"*30)
                print("       AI WON! GAME OVER       ")
                print("!"*30)
                
        if truncated:
            print("\nGame Over - Draw (Limit reached)")
            break

if __name__ == "__main__":
    play_vs_ai()
