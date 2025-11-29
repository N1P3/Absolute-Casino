import torch
import numpy as np
from typing import Dict, List, Tuple, Optional

class ReservoirBuffer:
    """
    Reservoir sampling buffer for Deep CFR.
    
    Stores tuples of (state_tensor, target_vector, weight).
    Used for both Advantage (regret) and Strategy (average policy) memories.
    """
    
    def __init__(self, capacity: int, device: torch.device, state_shape: Tuple[int, ...], target_size: int):
        self.capacity = capacity
        self.device = device
        self.size = 0
        self.total_seen = 0
        
        # Preallocate tensors
        # Note: state_shape depends on the encoding (e.g., 18 for static, 20x10 for action seq)
        # We'll store the raw encoded tensors.
        # For the Transformer model, input is a dict {'static_state': ..., 'action_sequence': ...}
        # We will flatten or store them separately. To keep it simple and fast, we'll assume
        # we store the components separately.
        
        self.static_states = torch.zeros((capacity, 18), dtype=torch.float32, device=device)
        self.action_seqs = torch.zeros((capacity, 20, 10), dtype=torch.float32, device=device)
        self.targets = torch.zeros((capacity, target_size), dtype=torch.float32, device=device)
        self.weights = torch.zeros((capacity, 1), dtype=torch.float32, device=device)
        
    def add(self, static_state: torch.Tensor, action_seq: torch.Tensor, target: torch.Tensor, weight: float):
        """
        Add a sample to the buffer using reservoir sampling.
        
        Args:
            static_state: [18] tensor
            action_seq: [20, 10] tensor
            target: [target_size] tensor (regrets or strategy)
            weight: scalar weight (iteration t)
        """
        self.total_seen += 1
        
        if self.size < self.capacity:
            # Fill buffer first
            idx = self.size
            self.size += 1
        else:
            # Reservoir sampling: replace existing element with probability capacity/total_seen
            r = np.random.rand()
            if r < self.capacity / self.total_seen:
                idx = np.random.randint(0, self.capacity)
            else:
                return  # Discard sample
        
        # Store sample
        self.static_states[idx] = static_state
        self.action_seqs[idx] = action_seq
        self.targets[idx] = target
        self.weights[idx] = weight
        
    def sample(self, batch_size: int) -> Dict[str, torch.Tensor]:
        """Sample a batch from the buffer."""
        if self.size == 0:
            return {}
            
        indices = torch.randint(0, self.size, (batch_size,), device=self.device)
        
        return {
            'static_state': self.static_states[indices],
            'action_sequence': self.action_seqs[indices],
            'target': self.targets[indices],
            'weight': self.weights[indices]
        }

    def clear(self):
        self.size = 0
        self.total_seen = 0
