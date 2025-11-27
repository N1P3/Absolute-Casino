import os
from sb3_contrib import MaskablePPO
from sb3_contrib.common.wrappers import ActionMasker
from makao_env import MakaoEnv

def train():
    # Create log dir
    log_dir = "logs"
    os.makedirs(log_dir, exist_ok=True)

    # Initialize Environment
    env = MakaoEnv()
    env = ActionMasker(env, lambda env: env.action_masks())

    # Initialize Agent
    # MaskablePPO is required for action masking
    model = MaskablePPO("MlpPolicy", env, verbose=1, tensorboard_log=log_dir)

    print("Starting training (Self-Play)...")
    # Train for 1,000,000 timesteps (approx 30-60 mins on CPU)
    # This is a good balance for a decent Makao bot.
    # For superhuman level, try 10,000,000+.
    model.learn(total_timesteps=50000)

    # Save Model
    model.save("makao_ppo_model")
    print("Model saved to makao_ppo_model.zip")

if __name__ == "__main__":
    train()
