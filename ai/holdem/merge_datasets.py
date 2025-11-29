"""
Merge multiple NPZ poker datasets into a single combined dataset.

Usage:
    python merge_datasets.py --datasets acpc_2017.npz test_handhq.npz --output combined.npz
"""

import argparse
import numpy as np
from pathlib import Path


def merge_npz_datasets(dataset_paths, output_path, shuffle=True, chunk_shuffle=False):
    """
    Merge multiple NPZ datasets into one.
    
    Args:
        dataset_paths: List of paths to NPZ files
        output_path: Output path for merged NPZ
        shuffle: Whether to shuffle the combined data
        chunk_shuffle: For large datasets, shuffle in chunks to save memory
    """
    print(f"Merging {len(dataset_paths)} datasets...")
    
    all_static_states = []
    all_action_sequences = []
    all_target_actions = []
    all_outcomes = []
    
    total_examples = 0
    dataset_info = []
    
    for dataset_path in dataset_paths:
        print(f"\nLoading {dataset_path}...")
        data = np.load(dataset_path)
        
        num_examples = data['static_states'].shape[0]
        total_examples += num_examples
        
        dataset_info.append({
            'path': str(dataset_path),
            'examples': num_examples
        })
        
        print(f"  Examples: {num_examples}")
        print(f"  Shapes: static={data['static_states'].shape}, "
              f"actions={data['action_sequences'].shape}, "
              f"targets={data['target_actions'].shape}")
        
        # Verify shapes match
        if all_static_states:
            assert data['static_states'].shape[1] == all_static_states[0].shape[1], \
                f"Static state dimension mismatch: {data['static_states'].shape[1]} vs {all_static_states[0].shape[1]}"
            assert data['action_sequences'].shape[1:] == all_action_sequences[0].shape[1:], \
                f"Action sequence dimension mismatch"
        
        all_static_states.append(data['static_states'])
        all_action_sequences.append(data['action_sequences'])
        all_target_actions.append(data['target_actions'])
        all_outcomes.append(data['outcomes'])
    
    print(f"\nConcatenating {total_examples} total examples...")
    
    # Concatenate all arrays
    static_states = np.concatenate(all_static_states, axis=0)
    action_sequences = np.concatenate(all_action_sequences, axis=0)
    target_actions = np.concatenate(all_target_actions, axis=0)
    outcomes = np.concatenate(all_outcomes, axis=0)
    
    print(f"  Combined shapes: static={static_states.shape}, "
          f"actions={action_sequences.shape}, targets={target_actions.shape}")
    
    # Save merged dataset
    print(f"\nSaving to {output_path}...")
    
    if shuffle and total_examples > 1_000_000:
        # For large datasets, save without shuffling and let DataLoader shuffle during training
        print("  ⚠️  Dataset too large to shuffle in memory (>1M examples)")
        print("  Saving unshuffled - use DataLoader shuffle=True during training")
        np.savez_compressed(
            output_path,
            static_states=static_states,
            action_sequences=action_sequences,
            target_actions=target_actions,
            outcomes=outcomes
        )
    elif shuffle:
        # For smaller datasets, shuffle in memory
        print("\nShuffling combined data...")
        indices = np.random.permutation(total_examples)
        static_states = static_states[indices]
        action_sequences = action_sequences[indices]
        target_actions = target_actions[indices]
        outcomes = outcomes[indices]
        
        np.savez_compressed(
            output_path,
            static_states=static_states,
            action_sequences=action_sequences,
            target_actions=target_actions,
            outcomes=outcomes
        )
    else:
        # No shuffle requested
        np.savez_compressed(
            output_path,
            static_states=static_states,
            action_sequences=action_sequences,
            target_actions=target_actions,
            outcomes=outcomes
        )
    
    print(f"\n✓ Successfully merged {len(dataset_paths)} datasets")
    print(f"✓ Total examples: {total_examples}")
    print(f"✓ Output: {output_path}")
    print("\nDataset breakdown:")
    for info in dataset_info:
        pct = (info['examples'] / total_examples) * 100
        print(f"  {Path(info['path']).name}: {info['examples']:,} examples ({pct:.1f}%)")


def main():
    parser = argparse.ArgumentParser(
        description='Merge multiple NPZ poker datasets into one'
    )
    parser.add_argument(
        '--datasets',
        nargs='+',
        required=True,
        help='Paths to NPZ datasets to merge'
    )
    parser.add_argument(
        '--output',
        required=True,
        help='Output path for merged NPZ file'
    )
    parser.add_argument(
        '--no-shuffle',
        action='store_true',
        help='Do not shuffle the combined data (default: shuffle)'
    )
    parser.add_argument(
        '--chunk-shuffle',
        action='store_true',
        help='Shuffle in chunks for memory efficiency (for very large datasets)'
    )
    
    args = parser.parse_args()
    
    # Validate inputs
    for dataset_path in args.datasets:
        if not Path(dataset_path).exists():
            print(f"Error: Dataset not found: {dataset_path}")
            return 1
    
    # Merge datasets
    merge_npz_datasets(
        dataset_paths=args.datasets,
        output_path=args.output,
        shuffle=not args.no_shuffle,
        chunk_shuffle=args.chunk_shuffle
    )
    
    return 0


if __name__ == '__main__':
    exit(main())
