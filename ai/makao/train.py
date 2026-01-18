"""
Skrypt treningowy dla modelu Makao z obsługą multi-card.

Używa MaskablePPO z sb3_contrib do obsługi action masking.
Model uczy się poprzez self-play w środowisku MakaoEnv.
"""

import argparse
import os
import time
from datetime import datetime

from sb3_contrib import MaskablePPO
from sb3_contrib.common.wrappers import ActionMasker
from sb3_contrib.common.maskable.policies import MaskableActorCriticPolicy
from stable_baselines3.common.callbacks import BaseCallback, CheckpointCallback
from stable_baselines3.common.vec_env import DummyVecEnv

from makao_env import MakaoEnv
from makao_env_v2 import MakaoEnvV2
from makao_env_v3 import MakaoEnvV3


def mask_fn(env):
    """Funkcja maskująca dla ActionMasker wrapper."""
    return env.action_masks()


class ProgressCallback(BaseCallback):
    """Callback wyświetlający postęp treningu."""
    
    def __init__(self, total_timesteps: int, log_freq: int = 10000, verbose: int = 1):
        super().__init__(verbose)
        self.total_timesteps = total_timesteps
        self.log_freq = log_freq
        self.start_time = None
        self.last_log = 0
        
    def _on_training_start(self):
        self.start_time = time.time()
        print(f"\n{'='*60}")
        print(f"Rozpoczynam trening: {self.total_timesteps:,} kroków")
        print(f"{'='*60}\n")
        
    def _on_step(self) -> bool:
        if self.num_timesteps - self.last_log >= self.log_freq:
            self.last_log = self.num_timesteps
            
            elapsed = time.time() - self.start_time
            progress = self.num_timesteps / self.total_timesteps * 100
            fps = self.num_timesteps / elapsed if elapsed > 0 else 0
            eta = (self.total_timesteps - self.num_timesteps) / fps if fps > 0 else 0
            
            print(f"[{progress:5.1f}%] {self.num_timesteps:,}/{self.total_timesteps:,} | "
                  f"FPS: {fps:.0f} | Czas: {elapsed:.0f}s | ETA: {eta:.0f}s")
            
            # Statystyki z loggera jeśli dostępne
            if len(self.model.ep_info_buffer) > 0:
                ep_len = sum(ep['l'] for ep in self.model.ep_info_buffer) / len(self.model.ep_info_buffer)
                ep_rew = sum(ep['r'] for ep in self.model.ep_info_buffer) / len(self.model.ep_info_buffer)
                print(f"         Avg episode: len={ep_len:.1f}, reward={ep_rew:.2f}")
        
        return True
    
    def _on_training_end(self):
        elapsed = time.time() - self.start_time
        print(f"\n{'='*60}")
        print(f"Trening zakończony!")
        print(f"Całkowity czas: {elapsed:.1f}s ({elapsed/60:.1f} min)")
        print(f"Średnie FPS: {self.total_timesteps/elapsed:.0f}")
        print(f"{'='*60}\n")


def create_env(env_version=1):
    """Tworzy środowisko z action masking."""
    if env_version == 3:
        env = MakaoEnvV3()  # Sparse rewards + lepsze obserwacje
    elif env_version == 2:
        env = MakaoEnvV2()  # Trening vs heurystyka
    else:
        env = MakaoEnv()    # Self-play
    env = ActionMasker(env, mask_fn)
    return env


def train(
    timesteps: int = 200000,
    model_name: str = None,
    resume_from: str = None,
    env_version: int = 1,
    learning_rate: float = 3e-4,
    n_steps: int = 2048,
    batch_size: int = 64,
    n_epochs: int = 10,
    gamma: float = 0.99,
    checkpoint_freq: int = 50000,
    seed: int = None,
    net_arch: list = None
):
    """
    Trenuje model MaskablePPO.
    
    Args:
        timesteps: Liczba kroków treningowych
        model_name: Nazwa modelu (bez .zip)
        resume_from: Ścieżka do modelu bazowego (do dotrenowania)
        env_version: 1=self-play, 2=vs heurystyka, 3=sparse rewards
        learning_rate: Learning rate
        n_steps: Kroki na update
        batch_size: Rozmiar batcha
        n_epochs: Epoki na update
        gamma: Discount factor
        checkpoint_freq: Częstotliwość checkpointów
        seed: Seed dla reprodukowalności
        net_arch: Architektura sieci [pi, vf] (domyślnie [64, 64])
    """
    # Generuj nazwę modelu jeśli nie podano
    if model_name is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        model_name = f"makao_ppo_{timesteps//1000}k_{timestamp}"
    
    # Default net_arch
    if net_arch is None:
        net_arch = [64, 64]
    
    env_names = {1: 'Self-play', 2: 'vs Heurystyka', 3: 'Sparse rewards (V3)'}
    
    print(f"\n{'='*60}")
    print("KONFIGURACJA TRENINGU")
    print(f"{'='*60}")
    print(f"Model: {model_name}")
    print(f"Timesteps: {timesteps:,}")
    if resume_from:
        print(f"Dotrenowanie z: {resume_from}")
    print(f"Tryb: {env_names.get(env_version, 'Unknown')}")
    print(f"Sieć: {net_arch}")
    print(f"Learning rate: {learning_rate}")
    print(f"N_steps: {n_steps}")
    print(f"Batch size: {batch_size}")
    print(f"N_epochs: {n_epochs}")
    print(f"Gamma: {gamma}")
    print(f"{'='*60}")
    
    # Środowisko
    env = DummyVecEnv([lambda: create_env(env_version)])
    
    # Model - załaduj istniejący lub stwórz nowy
    if resume_from:
        print(f"\nŁadowanie modelu bazowego: {resume_from}")
        model = MaskablePPO.load(
            resume_from,
            env=env,
            learning_rate=learning_rate,
            n_steps=n_steps,
            batch_size=batch_size,
            n_epochs=n_epochs,
            gamma=gamma,
            verbose=0,
            tensorboard_log="./logs/tensorboard/"
        )
        print("Model załadowany, kontynuuję trening...")
    else:
        policy_kwargs = dict(
            net_arch=dict(pi=net_arch, vf=net_arch)
        )
        model = MaskablePPO(
            MaskableActorCriticPolicy,
            env,
            policy_kwargs=policy_kwargs,
            learning_rate=learning_rate,
            n_steps=n_steps,
            batch_size=batch_size,
            n_epochs=n_epochs,
            gamma=gamma,
            verbose=0,
            seed=seed,
            tensorboard_log="./logs/tensorboard/"
        )
    
    print(f"\nModel utworzony:")
    print(f"  Policy: {model.policy.__class__.__name__}")
    print(f"  Observation space: {env.observation_space}")
    print(f"  Action space: {env.action_space}")
    
    # Callbacks
    callbacks = [
        ProgressCallback(timesteps, log_freq=10000),
    ]
    
    if checkpoint_freq > 0:
        os.makedirs("./checkpoints", exist_ok=True)
        callbacks.append(
            CheckpointCallback(
                save_freq=checkpoint_freq,
                save_path="./checkpoints",
                name_prefix=model_name
            )
        )
    
    # Trening
    model.learn(
        total_timesteps=timesteps,
        callback=callbacks,
        progress_bar=False
    )
    
    # Zapisz model
    model_path = f"{model_name}.zip"
    model.save(model_path)
    print(f"Model zapisany: {model_path}")
    
    return model_path


def main():
    parser = argparse.ArgumentParser(description="Trening modelu Makao AI")
    parser.add_argument("--timesteps", "-t", type=int, default=200000,
                        help="Liczba kroków treningowych (domyślnie: 200000)")
    parser.add_argument("--name", "-n", type=str, default=None,
                        help="Nazwa modelu (domyślnie: auto-generowana)")
    parser.add_argument("--resume", "-r", type=str, default=None,
                        help="Ścieżka do modelu bazowego (do dotrenowania)")
    parser.add_argument("--env-version", type=int, default=1,
                        help="Wersja środowiska: 1=self-play, 2=vs heur, 3=sparse (domyślnie: 1)")
    parser.add_argument("--vs-heuristic", action="store_true",
                        help="[DEPRECATED] Użyj --env-version 2")
    parser.add_argument("--net-arch", type=str, default="64,64",
                        help="Architektura sieci (domyślnie: 64,64)")
    parser.add_argument("--lr", type=float, default=3e-4,
                        help="Learning rate (domyślnie: 3e-4)")
    parser.add_argument("--n-steps", type=int, default=2048,
                        help="Kroki na update (domyślnie: 2048)")
    parser.add_argument("--batch-size", type=int, default=64,
                        help="Rozmiar batcha (domyślnie: 64)")
    parser.add_argument("--n-epochs", type=int, default=10,
                        help="Epoki na update (domyślnie: 10)")
    parser.add_argument("--gamma", type=float, default=0.99,
                        help="Discount factor (domyślnie: 0.99)")
    parser.add_argument("--checkpoint-freq", type=int, default=50000,
                        help="Częstotliwość checkpointów (domyślnie: 50000)")
    parser.add_argument("--seed", type=int, default=None,
                        help="Seed dla reprodukowalności")
    
    args = parser.parse_args()
    
    # Parse net_arch
    net_arch = [int(x) for x in args.net_arch.split(',')]
    
    # Backwards compatibility
    env_version = args.env_version
    if args.vs_heuristic:
        env_version = 2
    
    train(
        timesteps=args.timesteps,
        model_name=args.name,
        resume_from=args.resume,
        env_version=env_version,
        learning_rate=args.lr,
        n_steps=args.n_steps,
        batch_size=args.batch_size,
        n_epochs=args.n_epochs,
        gamma=args.gamma,
        checkpoint_freq=args.checkpoint_freq,
        seed=args.seed,
        net_arch=net_arch
    )


if __name__ == "__main__":
    main()
