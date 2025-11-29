"""
Dataset loader for Pluribus poker dataset (HDF5 or NPZ format).

Loads preflop decision examples with static states and action sequences.
"""

import h5py
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from pathlib import Path


class PluribusPokerDataset(Dataset):
    """
    PyTorch Dataset for Pluribus poker decisions from HDF5 or NPZ file.
    
    Each example is a single preflop decision point with:
    - Static state: hole cards, stacks, pot, street
    - Action sequence: previous actions in current betting round
    - Target: action type (fold/call/raise) + raise amount
    """
    
    def __init__(
        self,
        dataset_path,
        transform=None,
        preload=True,  # Preload entire dataset to RAM (recommended for <5GB datasets)
    ):
        """
        Args:
            dataset_path: Path to HDF5 (.h5) or NPZ (.npz) file
            transform: Optional transform to apply to samples
            preload: If True, load entire dataset to RAM (much faster for small datasets)
        """
        self.dataset_path = Path(dataset_path)
        self.transform = transform
        self.preload = preload
        self.is_npz = self.dataset_path.suffix == '.npz'
        
        # Load dataset based on format
        if self.is_npz:
            self._load_npz()
        else:
            self._load_hdf5()
    
    def _load_npz(self):
        """Load NPZ format dataset."""
        print(f"Loading NPZ dataset: {self.dataset_path}")
        data = np.load(self.dataset_path)
        
        # Load arrays
        self.static_states = torch.from_numpy(data['static_states']).float()
        self.action_sequences = torch.from_numpy(data['action_sequences']).float()
        self.target_actions = torch.from_numpy(data['target_actions']).float()
        
        # Load outcomes if available
        if 'outcomes' in data:
            self.outcomes = torch.from_numpy(data['outcomes']).float()
        else:
            self.outcomes = None
        
        # Get dimensions
        self.num_examples = len(self.static_states)
        self.static_state_dim = self.static_states.shape[1]
        self.action_seq_length = self.action_sequences.shape[1]
        self.action_seq_dim = self.action_sequences.shape[2]
        
        data.close()
        
        print(f"  Loaded {self.num_examples:,} examples ({self.static_states.element_size() * self.static_states.nelement() / 1024**2:.1f} MB)")
        print(f"  Static state dim: {self.static_state_dim}")
        print(f"  Action sequence: {self.action_seq_length} × {self.action_seq_dim}")
    
    def _load_hdf5(self):
        """Load HDF5 format dataset."""
        # Load dataset info and optionally preload data
        with h5py.File(self.dataset_path, 'r') as f:
            self.num_examples = f.attrs['num_examples']
            
            # Get shapes
            self.static_state_dim = f['static_states'].shape[1]  # 375
            self.action_seq_length = f['action_sequences'].shape[1]  # 20
            self.action_seq_dim = f['action_sequences'].shape[2]  # 10
            
            # Preload entire dataset to RAM (avoids HDF5 multiprocessing issues)
            if self.preload:
                print(f"Preloading HDF5 dataset to RAM...")
                self.static_states = torch.from_numpy(f['static_states'][:]).float()
                self.action_sequences = torch.from_numpy(f['action_sequences'][:]).float()
                self.target_actions = torch.from_numpy(f['target_actions'][:]).float()
                
                # Load outcomes if available
                if 'outcomes' in f:
                    self.outcomes = torch.from_numpy(f['outcomes'][:]).float()
                else:
                    self.outcomes = None
                
                print(f"  Loaded {self.num_examples:,} examples ({self.static_states.element_size() * self.static_states.nelement() / 1024**2:.1f} MB)")
            else:
                self.static_states = None
                self.action_sequences = None
                self.target_actions = None
                self.outcomes = None
            
            print(f"Dataset loaded: {self.dataset_path}")
            print(f"  Total examples: {self.num_examples:,}")
            print(f"  Static state dim: {self.static_state_dim}")
            print(f"  Action sequence: {self.action_seq_length} × {self.action_seq_dim}")
        
        # Only used if not preloading (HDF5 only)
        self.hdf5_file = None
    
    def _ensure_hdf5_open(self):
        """Ensure HDF5 file is open (for multiprocessing compatibility)."""
        if self.hdf5_file is None:
            self.hdf5_file = h5py.File(self.hdf5_path, 'r')
    
    def __len__(self):
        return self.num_examples
    
    def __getitem__(self, idx):
        """
        Get a poker decision example.
        
        Returns:
            dict with:
                - static_state: [371] - hole cards, board, stacks, pot, street
                - action_sequence: [20, 10] - previous actions
                - target_action: scalar - action type (0=fold, 1=call, 2=raise)
                - target_value: scalar - raise amount (normalized by pot)
                - outcome: scalar - profit/loss for this player (in big blinds)
        """
        if self.is_npz or self.preload:
            # Fast path: data already in RAM (NPZ always preloaded)
            static_state = self.static_states[idx]
            action_sequence = self.action_sequences[idx]
            target = self.target_actions[idx]
            outcome = self.outcomes[idx].item() if self.outcomes is not None else 0.0
        else:
            # Slow path: load from HDF5 (for large datasets)
            self._ensure_hdf5_open()
            static_state = torch.from_numpy(self.hdf5_file['static_states'][idx]).float()
            action_sequence = torch.from_numpy(self.hdf5_file['action_sequences'][idx]).float()
            target = torch.from_numpy(self.hdf5_file['target_actions'][idx]).float()
            
            # Load outcome if available
            if 'outcomes' in self.hdf5_file:
                outcome = float(self.hdf5_file['outcomes'][idx])
            else:
                outcome = 0.0
        
        # Split target into action type and value
        target_action = int(target[0].item())  # 0, 1, or 2
        target_value = target[1].item()  # Raise amount (0 for fold/call)
        
        sample = {
            'static_state': static_state,
            'action_sequence': action_sequence,
            'target_action': target_action,
            'target_value': target_value,
            'outcome': outcome,
        }
        
        if self.transform:
            sample = self.transform(sample)
        
        return sample
    
    def __del__(self):
        """Close HDF5 file if using lazy loading."""
        if hasattr(self, 'hdf5_file') and self.hdf5_file is not None:
            self.hdf5_file.close()


def collate_fn(batch):
    """
    Custom collate function to stack tensors.
    
    All sequences are already same length (20), so just stack.
    """
    batch_size = len(batch)
    
    # Stack tensors
    static_states = torch.stack([sample['static_state'] for sample in batch])  # [B, 371]
    action_sequences = torch.stack([sample['action_sequence'] for sample in batch])  # [B, 20, 10]
    target_actions = torch.tensor([sample['target_action'] for sample in batch], dtype=torch.long)  # [B]
    target_values = torch.tensor([sample['target_value'] for sample in batch], dtype=torch.float)  # [B]
    outcomes = torch.tensor([sample['outcome'] for sample in batch], dtype=torch.float)  # [B]
    
    return {
        'static_state': static_states,
        'action_sequence': action_sequences,
        'target_action': target_actions,
        'target_value': target_values,
        'outcome': outcomes,
    }


def create_dataloaders(
    dataset_path,
    batch_size=32,
    train_split=0.8,
    num_workers=0,  # Default 0 for Windows compatibility
    preload=True,  # Preload to RAM (recommended for datasets <5GB)
):
    """
    Create train and validation dataloaders.
    
    Args:
        dataset_path: Path to HDF5 (.h5) or NPZ (.npz) dataset
        batch_size: Batch size
        train_split: Fraction for training (rest is validation)
        num_workers: Number of worker processes (use 0 on Windows)
        preload: If True, preload entire dataset to RAM (much faster, requires ~400MB RAM)
    
    Returns:
        train_loader, val_loader
    """
    # Load dataset
    dataset = PluribusPokerDataset(dataset_path, preload=preload)
    
    # Split into train/val
    train_size = int(train_split * len(dataset))
    val_size = len(dataset) - train_size
    
    train_dataset, val_dataset = torch.utils.data.random_split(
        dataset,
        [train_size, val_size],
        generator=torch.Generator().manual_seed(42),
    )
    
    # Create dataloaders
    # Enable pin_memory for GPU training (faster host-to-device transfer)
    use_pin_memory = torch.cuda.is_available()
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        collate_fn=collate_fn,
        pin_memory=use_pin_memory,
        persistent_workers=num_workers > 0,  # Keep workers alive between epochs
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        collate_fn=collate_fn,
        pin_memory=use_pin_memory,
        persistent_workers=num_workers > 0,  # Keep workers alive between epochs
    )
    
    print(f"\nDataloaders created:")
    print(f"  Train size: {train_size:,} examples")
    print(f"  Val size: {val_size:,} examples")
    print(f"  Batch size: {batch_size}")
    print(f"  Train batches: {len(train_loader)}")
    print(f"  Val batches: {len(val_loader)}")
    
    return train_loader, val_loader


if __name__ == '__main__':
    # Test dataset loading
    import sys
    
    if len(sys.argv) > 1:
        dataset_path = sys.argv[1]
    else:
        # Try NPZ first, then HDF5
        if Path('poker_transformer_acpc_rust.npz').exists():
            dataset_path = 'poker_transformer_acpc_rust.npz'
        else:
            dataset_path = 'poker_transformer_pluribus.h5'
    
    if not Path(dataset_path).exists():
        print(f"Dataset file not found: {dataset_path}")
        print("Run preprocess.py or Rust preprocessor first!")
        sys.exit(1)
    
    print("Testing dataset loading...")
    train_loader, val_loader = create_dataloaders(
        dataset_path,
        batch_size=4,
    )
    
    # Test batch loading
    batch = next(iter(train_loader))
    
    print(f"\nTest batch:")
    for key, value in batch.items():
        if isinstance(value, torch.Tensor):
            print(f"  {key}: {value.shape}, dtype={value.dtype}")
            if key == 'target_action':
                print(f"    Values: {value.tolist()}")
            elif key == 'target_value':
                print(f"    Values: {value.tolist()}")
        else:
            print(f"  {key}: {value}")
    
    # Check action distribution in batch
    actions = batch['target_action']
    print(f"\nAction distribution in batch:")
    print(f"  Fold (0): {(actions == 0).sum().item()}")
    print(f"  Call (1): {(actions == 1).sum().item()}")
    print(f"  Raise (2): {(actions == 2).sum().item()}")
    
    print(f"\n✓ Dataset test successful!")
