"""
Export modelu Makao V3 do ONNX.

Model V3 ma:
- 180 obserwacji (rozszerzone o historię kart)
- 93 akcje (52 single + 39 multi-card + draw + skip)
"""

import torch
import torch.nn as nn
import onnx
import argparse
from sb3_contrib import MaskablePPO


class OnnxablePolicy(nn.Module):
    def __init__(self, policy):
        super().__init__()
        self.policy = policy

    def forward(self, observation, action_masks):
        # 1. Extract features
        features = self.policy.extract_features(observation)
        
        # 2. Get latent policy representation
        latent_pi, _ = self.policy.mlp_extractor(features)
        
        # 3. Get raw logits from action net
        logits = self.policy.action_net(latent_pi)
        
        # 4. Apply Masking manually
        HUGE_NEG = torch.tensor(-1e8, dtype=torch.float32)
        masked_logits = torch.where(action_masks, logits, HUGE_NEG)
        
        return masked_logits


def export_to_onnx(model_path: str, output_path: str = "makao_model_v3.onnx"):
    print(f"Loading model: {model_path}")
    model = MaskablePPO.load(model_path)
    
    # Pobierz wymiary z modelu
    obs_size = model.observation_space.shape[0]
    action_size = model.action_space.n
    
    print(f"Observation space: {obs_size}")
    print(f"Action space: {action_size}")
    
    # Wrap the policy
    onnx_policy = OnnxablePolicy(model.policy)
    
    # Create dummy inputs
    dummy_obs = torch.randn(1, obs_size)
    dummy_masks = torch.ones(1, action_size, dtype=torch.bool)
    
    print(f"Exporting to ONNX: {output_path}")
    
    torch.onnx.export(
        onnx_policy,
        (dummy_obs, dummy_masks),
        output_path,
        opset_version=12,
        input_names=["observation", "action_masks"],
        output_names=["action_logits"],
        dynamic_axes={
            "observation": {0: "batch_size"},
            "action_masks": {0: "batch_size"},
            "action_logits": {0: "batch_size"}
        }
    )
    
    # Downgrade IR version for compatibility
    print("Downgrading IR version for compatibility...")
    model_proto = onnx.load(output_path)
    model_proto.ir_version = 8
    onnx.save(model_proto, output_path)
    
    print(f"\n{'='*60}")
    print("EXPORT ZAKOŃCZONY")
    print(f"{'='*60}")
    print(f"Model: {output_path}")
    print(f"Inputs:")
    print(f"  - 'observation': float32[batch, {obs_size}]")
    print(f"  - 'action_masks': bool[batch, {action_size}]")
    print(f"Output:")
    print(f"  - 'action_logits': float32[batch, {action_size}]")
    print(f"\nAkcje (0-92):")
    print(f"  0-51:  Single card play (rank*4 + suit)")
    print(f"  52-64: 2x card play (rank index)")
    print(f"  65-77: 3x card play (rank index)")
    print(f"  78-90: 4x card play (rank index)")
    print(f"  91:    Draw")
    print(f"  92:    Skip")
    print(f"{'='*60}")
    
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Export Makao model to ONNX")
    parser.add_argument("--model", "-m", type=str, default="makao_v3_fixed_100k.zip",
                        help="Path to model .zip file")
    parser.add_argument("--output", "-o", type=str, default="makao_model_v3.onnx",
                        help="Output ONNX file path")
    
    args = parser.parse_args()
    export_to_onnx(args.model, args.output)
