
import torch
import torch.nn as nn
import json
from pathlib import Path
import sys

# Add current directory to path so we can import model
sys.path.append(str(Path(__file__).parent))

from model import create_model

class OnnxWrapper(nn.Module):
    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, static_state, action_sequence):
        batch = {
            'static_state': static_state,
            'action_sequence': action_sequence
        }
        return self.model(batch)

def export_model():
    checkpoint_path = Path('checkpoints_big_2/best_model.pt')
    output_path = Path('holdem_model.onnx')
    
    print(f"Loading checkpoint: {checkpoint_path}")
    if not checkpoint_path.exists():
        print(f"Error: Checkpoint not found at {checkpoint_path}")
        return

    checkpoint = torch.load(checkpoint_path, map_location='cpu')
    
    # Extract config
    model_config = None
    if 'model_config' in checkpoint:
        model_config = checkpoint['model_config']
        print("[OK] Model config loaded from checkpoint")
    elif (checkpoint_path.parent / 'config.json').exists():
        with open(checkpoint_path.parent / 'config.json', 'r') as f:
            full_config = json.load(f)
            model_config = full_config.get('model_config')
            print("[OK] Model config loaded from config.json")
    
    if model_config is None:
        print("Warning: Using default config")
        model_config = {
            'd_model': 512,
            'nhead': 8,
            'num_layers': 6,
            'dim_feedforward': 2048,
            'dropout': 0.1,
        }

    print("Creating model...")
    model = create_model(model_config)
    
    state_dict = checkpoint['model_state_dict']
    # Handle torch.compile prefix
    if any(key.startswith('_orig_mod.') for key in state_dict.keys()):
        print("Removing _orig_mod prefix...")
        state_dict = {k.replace('_orig_mod.', ''): v for k, v in state_dict.items()}
        
    model.load_state_dict(state_dict)
    model.eval()

    # Wrap model for ONNX export (to handle dictionary input)
    wrapped_model = OnnxWrapper(model)
    
    # Create dummy input
    # static_state: [1, 18]
    # action_sequence: [1, 20, 10]
    dummy_static = torch.randn(1, 18)
    dummy_actions = torch.randn(1, 20, 10)
    
    print(f"Exporting to {output_path}...")
    torch.onnx.export(
        wrapped_model,
        (dummy_static, dummy_actions),
        output_path,
        input_names=['static_state', 'action_sequence'],
        output_names=['action_logits', 'value_pred'],
        dynamic_axes={
            'static_state': {0: 'batch_size'},
            'action_sequence': {0: 'batch_size'},
            'action_logits': {0: 'batch_size'},
            'value_pred': {0: 'batch_size'}
        },
        opset_version=14
    )
    print("[OK] Export complete!")

if __name__ == '__main__':
    export_model()
