import torch
import torch.nn as nn
import onnx
from sb3_contrib import MaskablePPO

class OnnxablePolicy(nn.Module):
    def __init__(self, policy):
        super().__init__()
        self.policy = policy

    def forward(self, observation, action_masks):
        # 1. Extract features
        # SB3 extract_features expects a tensor
        features = self.policy.extract_features(observation)
        
        # 2. Get latent policy representation
        # mlp_extractor returns (latent_pi, latent_vf)
        latent_pi, _ = self.policy.mlp_extractor(features)
        
        # 3. Get raw logits from action net
        logits = self.policy.action_net(latent_pi)
        
        # 4. Apply Masking manually
        # We use a large negative number for invalid actions
        HUGE_NEG = torch.tensor(-1e8, dtype=torch.float32)
        
        # action_masks is boolean: True=Valid, False=Invalid
        # We want to keep logits where mask is True, else HUGE_NEG
        masked_logits = torch.where(action_masks, logits, HUGE_NEG)
        
        return masked_logits

def export_to_onnx():
    print("Loading model...")
    model = MaskablePPO.load("makao_ppo_model")
    
    # Wrap the policy to bypass complex distribution code
    onnx_policy = OnnxablePolicy(model.policy)
    
    # Create dummy observation input
    # Shape must match observation space: (1, 124)
    dummy_obs = torch.randn(1, 124)
    
    # Create dummy action masks
    # Shape must match action space: (1, 54)
    dummy_masks = torch.ones(1, 54, dtype=torch.bool) # All true for export test
    
    print("Exporting to ONNX...")
    
    torch.onnx.export(
        onnx_policy,
        (dummy_obs, dummy_masks), # Tuple of inputs
        "makao_model.onnx",
        opset_version=12, # Downgrade to older opset for compatibility
        input_names=["observation", "action_masks"],
        output_names=["action_logits"], # We return logits now
        dynamic_axes={
            "observation": {0: "batch_size"},
            "action_masks": {0: "batch_size"},
            "action_logits": {0: "batch_size"}
        }
    )
    
    # Post-process to force older IR version (compatibility fix)
    print("Downgrading IR version for compatibility...")
    model_proto = onnx.load("makao_model.onnx")
    model_proto.ir_version = 8 # Force IR version 8 (widely supported)
    onnx.save(model_proto, "makao_model.onnx")
    
    print("Model exported to makao_model.onnx")
    print("You can now load this model in Java using ONNX Runtime.")
    print("Inputs: 'observation' (float32[batch, 124]), 'action_masks' (bool[batch, 54])")
    print("Output: 'action_logits' (float32[batch, 54]) - Apply Softmax or Argmax in Java")

if __name__ == "__main__":
    export_to_onnx()
