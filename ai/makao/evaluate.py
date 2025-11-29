import random
import numpy as np
from sb3_contrib import MaskablePPO
from makao_env import MakaoEnv

def evaluate():
    env = MakaoEnv()
    
    # Load Model
    try:
        model = MaskablePPO.load("makao_ppo_model")
    except:
        print("Model not found. Run train.py first.")
        return

    episodes = 100
    wins = 0
    draws = 0
    
    print(f"Evaluating for {episodes} episodes against Random Agent...")
    
    for ep in range(episodes):
        obs, _ = env.reset()
        done = False
        truncated = False
        
        # We need to track whose turn it is manually for evaluation
        # because env.step() switches turns automatically.
        # Let's say Model is Player 0, Random is Player 1.
        
        while not (done or truncated):
            current_player = env.current_player
            
            if current_player == 0:
                # Model's Turn
                action_masks = env.action_masks()
                action, _ = model.predict(obs, action_masks=action_masks, deterministic=True)
            else:
                # Random Agent's Turn
                # Try to find a valid move randomly
                hand = env.hands[1]
                valid_actions = []
                
                # Check cards
                for card in hand:
                    if env.game.can_play_card(card, env.game.table_card, env.game.current_suit, 1):
                        valid_actions.append(env.card_to_idx[card])
                
                # Check skip
                if env.game.pending_skip_turns > 0 and env.game.player_to_skip == 1:
                    valid_actions.append(53)
                
                # Check draw (only if not forced to skip)
                if not (env.game.pending_skip_turns > 0 and env.game.player_to_skip == 1):
                    valid_actions.append(52)
                
                if valid_actions:
                    action = random.choice(valid_actions)
                else:
                    action = 52 # Fallback draw
            
            obs, reward, done, truncated, info = env.step(action)
            
            if done:
                # If done is True, the CURRENT player (who just moved) won.
                if current_player == 0:
                    wins += 1
            
            if truncated:
                draws += 1
                    
    print(f"Results over {episodes} games:")
    print(f"AI Wins: {wins}")
    print(f"Draws/Timeouts: {draws}")
    print(f"Losses: {episodes - wins - draws}")
    print(f"Win Rate: {wins/episodes*100}%")

if __name__ == "__main__":
    evaluate()
