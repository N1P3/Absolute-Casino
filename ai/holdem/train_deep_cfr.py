import argparse
import torch
import time
from pathlib import Path
from tqdm import tqdm

from model import create_model
from deep_cfr.solver import DeepCFRSolver

def main():
    parser = argparse.ArgumentParser(description='Deep CFR Training for Poker')
    parser.add_argument('--iterations', type=int, default=1000, help='Number of CFR iterations')
    parser.add_argument('--traversals', type=int, default=100, help='Traversals per iteration per player')
    parser.add_argument('--batch-size', type=int, default=1024, help='Training batch size')
    parser.add_argument('--checkpoint', type=str, default=None, help='Path to pre-trained model checkpoint')
    parser.add_argument('--device', type=str, default='cuda' if torch.cuda.is_available() else 'cpu')
    parser.add_argument('--output-dir', type=str, default='checkpoints_deep_cfr')
    args = parser.parse_args()
    
    device = torch.device(args.device)
    print(f"Using device: {device}")
    
    # Create models
    # We use the same config as before
    model_config = {
        'd_model': 512,
        'nhead': 8,
        'num_layers': 6,
        'dim_feedforward': 2048,
        'dropout': 0.1,
    }
    
    print("Creating Advantage Network...")
    adv_model = create_model(model_config).to(device)
    
    print("Creating Strategy Network...")
    strat_model = create_model(model_config).to(device)
    
    # Load checkpoint if provided
    if args.checkpoint:
        print(f"Loading checkpoint from: {args.checkpoint}")
        checkpoint = torch.load(args.checkpoint, map_location=device)
        
        # Handle different checkpoint formats
        if 'model_state_dict' in checkpoint:
            state_dict = checkpoint['model_state_dict']
            print("  Detected Supervised/PPO checkpoint. Using as warm start.")
        elif 'adv_model' in checkpoint:
            # Deep CFR checkpoint
            print("  Detected Deep CFR checkpoint. Resuming training.")
            adv_model.load_state_dict(checkpoint['adv_model'])
            strat_model.load_state_dict(checkpoint['strat_model'])
            state_dict = None # Already loaded
        else:
            # Raw state dict?
            state_dict = checkpoint
            
        if state_dict is not None:
            # Strip torch.compile prefix if present
            if any(key.startswith('_orig_mod.') for key in state_dict.keys()):
                print("  Removing torch.compile() prefix...")
                state_dict = {k.replace('_orig_mod.', ''): v for k, v in state_dict.items()}
            
            print("  Initializing BOTH networks from checkpoint...")
            # Strict=False because supervised model might have different head names or extra keys
            adv_model.load_state_dict(state_dict, strict=False)
            strat_model.load_state_dict(state_dict, strict=False)
            print("  ✓ Loaded weights")
    
    # Solver
    solver = DeepCFRSolver(adv_model, strat_model, device, batch_size=args.batch_size)
    
    # Output dir
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)
    
    print("Starting Deep CFR Training...")
    start_time = time.time()
    
    for i in range(args.iterations):
        iter_start = time.time()
        
        # 1. Traversal Phase
        # Player 0
        for _ in range(args.traversals):
            solver.traverse(iteration=i+1, traverser=0)
            
        # Player 1
        for _ in range(args.traversals):
            solver.traverse(iteration=i+1, traverser=1)
            
        # 2. Advantage Update
        # Train on collected regrets
        solver.train_advantage(steps=100) # Adjust steps as needed
        
        # 3. Strategy Update
        # Train on collected strategies
        solver.train_strategy(steps=100) # Adjust steps as needed
        
        # Logging
        dt = time.time() - iter_start
        print(f"Iteration {i+1}/{args.iterations} | Time: {dt:.2f}s | "
              f"Adv Buffer: {solver.adv_buffer.size} | Strat Buffer: {solver.strat_buffer.size}")
        
        # Save checkpoints
        if (i+1) % 100 == 0:
            torch.save({
                'iteration': i+1,
                'adv_model': adv_model.state_dict(),
                'strat_model': strat_model.state_dict(),
            }, output_dir / f'checkpoint_{i+1}.pt')
            print(f"Saved checkpoint to {output_dir}")
            
    total_time = time.time() - start_time
    torch.save({
                'iteration': i+1,
                'adv_model': adv_model.state_dict(),
                'strat_model': strat_model.state_dict(),
            }, output_dir / f'checkpoint_{i+1}.pt')
    print(f"Training Complete. Total time: {total_time/60:.1f} mins")

if __name__ == '__main__':
    main()
