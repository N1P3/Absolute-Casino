# Poker Transformer Model
#
# Transformer-based model for poker decisions with:
# - Static state encoding (hole cards, stacks, pot)
# - Action sequence attention (betting history)
# - Multi-task prediction (action type + raise amount)

import torch
import torch.nn as nn
import torch.nn.functional as F
import math

# Sentinel for unknown/missing cards (matches Rust preprocessing)
UNKNOWN_CARD = 52


class PluribusPokerTransformer(nn.Module):
    # Transformer-based poker AI.
    # Architecture:
    # 1. Static state encoder: MLP for hole cards, stacks, pot
    # 2. Action sequence encoder: Transformer for betting history
    # 3. Fusion layer: Combine static + sequential features
    # 4. Multi-task heads: Action classification + raise amount regression
    
    def __init__(
        self,
        # Input dimensions
        static_state_dim=20,  # Hole cards (2) + board (5) + stacks (6) + pot (1) + street (4) + equity (1) + odds (1) = 20
        action_seq_length=20,
        action_seq_dim=10,  # Player (6) + action type (3) + amount (1)
        
        # Output dimensions
        num_actions=3,  # Fold, Call, Raise
        
        # Model dimensions
        d_model=512,
        nhead=8,
        num_layers=6,
        dim_feedforward=2048,
        dropout=0.1,
        static_num_layers=None,
    ):
        super().__init__()
        
        self.d_model = d_model
        self.action_seq_length = action_seq_length
        
        # Rank and suit embeddings (shared by hole + board tokens)
        # Rank: 13 possible values (2‑A) → 8‑dim embedding
        # Suit: 4 possible values (c, d, h, s) → 8‑dim embedding
        self.rank_embedding = nn.Embedding(13, 8)
        self.suit_embedding = nn.Embedding(4, 8)
        
        # Project per-card embedding (16-dim) into model space + positional info
        self.card_projection = nn.Linear(16, d_model)
        self.card_position_embedding = nn.Embedding(7, d_model)
        # Street-stage embedding to preserve reveal order semantics
        self.card_stage_embedding = nn.Embedding(4, d_model)  # hole / flop / turn / river
        self.register_buffer('card_position_indices', torch.arange(7))
        self.register_buffer('card_stage_indices', torch.tensor([0, 0, 1, 1, 1, 2, 3]))
        
        # Scalar features (stacks, pot, street, equity, odds)
        self.scalar_encoder = nn.Sequential(
            nn.Linear(13, d_model),  # 11 original + 2 new = 13 scalar features
            nn.GELU(),
            nn.Dropout(dropout),
            nn.LayerNorm(d_model),
        )
        
        # Learned CLS token to summarize static context
        self.static_cls = nn.Parameter(torch.zeros(1, 1, d_model))
        self.static_dropout = nn.Dropout(dropout)
        
        # Lightweight transformer over static tokens (cards + scalar)
        static_layers = static_num_layers if static_num_layers is not None else max(1, num_layers // 3)
        static_encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            activation='gelu',
            batch_first=True,
            norm_first=True,
        )
        self.static_transformer = nn.TransformerEncoder(
            static_encoder_layer,
            num_layers=static_layers,
            norm=nn.LayerNorm(d_model),
        )
        
        # Action sequence encoder (linear projection to tokens)
        self.action_encoder = nn.Linear(action_seq_dim, d_model)
        self.action_cls = nn.Parameter(torch.zeros(1, 1, d_model))
        self.action_dropout = nn.Dropout(dropout)
        
        # Positional encoding for action sequence
        self.pos_encoding = PositionalEncoding(d_model, max_len=action_seq_length)
        
        # Transformer encoder for action sequence
        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=dim_feedforward,
            dropout=dropout,
            activation='gelu',
            batch_first=True,
            norm_first=True,  # Pre-norm architecture (more stable)
        )
        self.transformer = nn.TransformerEncoder(
            encoder_layer,
            num_layers=num_layers,
            norm=nn.LayerNorm(d_model),
        )
        
        # Fusion layer (combine static + sequential + skip features)
        # Skip features: Equity (1) + Pot Odds (1) + Hole Cards (32) = 34
        self.fusion = nn.Sequential(
            nn.Linear(d_model * 2 + 34, d_model),
            nn.LayerNorm(d_model),
            nn.GELU(),
            nn.Dropout(dropout),
        )
        
        # Action classification head
        self.action_head = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, num_actions),
        )
        
        # Raise amount regression head (only used when action=raise)
        self.value_head = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, 1),
        )
        
        # Initialize weights
        self._init_weights()
    
    def _init_weights(self):
        # Initialize weights with Xavier uniform.
        for p in self.parameters():
            if p.dim() > 1:
                nn.init.xavier_uniform_(p)
    
    def forward(self, batch, return_attention=False):
        # Forward pass.
        # Args:
        #     batch: Dictionary containing:
        #         - static_state: [B, 18] - hole card IDs (2), board card IDs (5), stacks (6), pot (1), street (4)
        #         - action_sequence: [B, 20, 10] - previous actions
        #     return_attention: If True, return intermediate representations
        # Returns:
        #     action_logits: [B, 3] - fold/call/raise probabilities
        #     value: [B, 1] - raise amount prediction
        static_state = batch['static_state']  # [B, 18] (IDs + other features)
        action_sequence = batch['action_sequence']  # [B, 20, 10]
        
        batch_size = static_state.size(0)
        
        # Split static_state into card IDs and other scalar features
        ids = static_state[:, :7].long()  # 2 hole card IDs + 5 board IDs
        other_features = static_state[:, 7:]  # [B, 13]

        # Split IDs into rank and suit (card ID = rank*4 + suit)
        rank_ids = torch.div(ids, 4, rounding_mode='floor')
        rank_ids = torch.clamp(rank_ids, min=0, max=12)
        suit_ids = torch.remainder(ids, 4).clamp(min=0, max=3)

        # Embed rank and suit separately, then concatenate → 16-dim per card
        rank_emb = self.rank_embedding(rank_ids)        # [B, 7, 8]
        suit_emb = self.suit_embedding(suit_ids)        # [B, 7, 8]
        card_emb = torch.cat([rank_emb, suit_emb], dim=-1)  # [B, 7, 16]

        # Zero-out embeddings for unknown cards to keep permutation invariance
        unknown_mask = (ids == UNKNOWN_CARD).unsqueeze(-1)   # [B, 7, 1]
        card_emb = torch.where(unknown_mask, torch.zeros_like(card_emb), card_emb)

        # Project cards to model dimension and inject positional + stage info
        card_tokens = self.card_projection(card_emb)  # [B, 7, d_model]
        pos_indices = self.card_position_indices.to(card_tokens.device)
        stage_indices = self.card_stage_indices.to(card_tokens.device)
        card_tokens = (
            card_tokens
            + self.card_position_embedding(pos_indices)[None, :, :]
            + self.card_stage_embedding(stage_indices)[None, :, :]
        )
        card_tokens = torch.where(unknown_mask, torch.zeros_like(card_tokens), card_tokens)

        # Scalar token + learned CLS token
        scalar_token = self.scalar_encoder(other_features).unsqueeze(1)  # [B, 1, d_model]
        cls_token = self.static_cls.expand(batch_size, -1, -1)  # [B, 1, d_model]

        static_tokens = torch.cat([cls_token, card_tokens, scalar_token], dim=1)  # [B, 9, d_model]
        static_tokens = self.static_dropout(static_tokens)

        # Mask padded card slots (unknown cards), keep CLS + scalar always valid
        cls_mask = torch.zeros(batch_size, 1, dtype=torch.bool, device=static_tokens.device)
        card_mask = (ids == UNKNOWN_CARD)
        scalar_mask = torch.zeros(batch_size, 1, dtype=torch.bool, device=static_tokens.device)
        static_mask = torch.cat([cls_mask, card_mask, scalar_mask], dim=1)  # [B, 9]

        static_encoded = self.static_transformer(
            static_tokens,
            src_key_padding_mask=static_mask,
        )
        static_features = static_encoded[:, 0]  # CLS summary
        
        # Encode action sequence with CLS pooling
        action_embeddings = self.action_encoder(action_sequence)  # [B, 20, d_model]
        action_embeddings = self.pos_encoding(action_embeddings)
        action_cls = self.action_cls.expand(batch_size, -1, -1)
        action_tokens = torch.cat([action_cls, action_embeddings], dim=1)  # [B, 21, d_model]
        action_tokens = self.action_dropout(action_tokens)
        
        action_mask = (action_sequence.sum(dim=-1) == 0)  # [B, 20]
        cls_mask = torch.zeros(batch_size, 1, dtype=torch.bool, device=action_tokens.device)
        action_mask_full = torch.cat([cls_mask, action_mask], dim=1)  # [B, 21]
        
        action_features = self.transformer(
            action_tokens,
            src_key_padding_mask=action_mask_full,
        )  # [B, 21, d_model]
        action_pooled = action_features[:, 0]  # CLS summary
        
        # Fuse static and sequential features + SKIP CONNECTION for Equity/Odds + HOLE CARDS
        # Equity is at index 11 of other_features (which corresponds to index 18 of static_state)
        # Pot Odds is at index 12 of other_features (index 19 of static_state)
        equity_odds = other_features[:, 11:13] * 10.0  # [B, 2] SIGNAL BOOST
        
        # Hole cards skip connection (flattened)
        # card_emb is [B, 7, 16]. Hole cards are at indices 0, 1.
        # We need to ensure we use the masked version if possible, but card_emb is masked at line 188.
        # Wait, line 188 masks card_emb. So we can just take it from there.
        # But we need to make sure we access the tensor *after* masking.
        # Let's re-extract or reuse. card_emb is local variable.
        # We need to make sure we are using the card_emb *after* line 188.
        # Since I can't easily reference the local variable from here without seeing the whole function,
        # I will re-apply the mask to be safe or assume card_emb is available if I am editing the end of forward.
        # Actually, I am editing the end of forward. card_emb is available.
        hole_cards_flat = card_emb[:, :2, :].reshape(batch_size, -1) # [B, 32]
        
        combined = torch.cat([static_features, action_pooled, equity_odds, hole_cards_flat], dim=-1)  # [B, d_model*2 + 34]
        fused = self.fusion(combined)  # [B, d_model]
        
        # Multi-task outputs
        action_logits = self.action_head(fused)  # [B, 3]
        value = self.value_head(fused)  # [B, 1]
        
        if return_attention:
            return action_logits, value, {
                'static_features': static_features,
                'action_features': action_pooled,
                'fused_features': fused,
            }
        
        return action_logits, value

    def reset_value_head(self):
        # Reinitialize critic head for RL fine-tuning.
        for layer in self.value_head:
            if isinstance(layer, nn.Linear):
                nn.init.xavier_uniform_(layer.weight)
                if layer.bias is not None:
                    nn.init.zeros_(layer.bias)


class PositionalEncoding(nn.Module):
    # Sinusoidal positional encoding for action sequences.
    
    def __init__(self, d_model, max_len=100):
        super().__init__()
        
        # Create positional encoding matrix
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float).unsqueeze(1)
        div_term = torch.exp(
            torch.arange(0, d_model, 2).float() * (-math.log(10000.0) / d_model)
        )
        
        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        pe = pe.unsqueeze(0)  # [1, max_len, d_model]
        
        # Register as a tensor buffer (not a sub‑module) to avoid type‑checking issues
        self.register_buffer('pe_tensor', pe)
    
    def forward(self, x):
        # Args: x: [B, seq_len, d_model]
        # Add sinusoidal positional encoding
        # Retrieve the buffer (named either 'pe' or 'pe_tensor') safely to avoid type‑checking issues
        pe_buf = getattr(self, 'pe', None) or getattr(self, 'pe_tensor', None)
        if pe_buf is None:
            raise RuntimeError("Positional encoding buffer not found")
        return x + pe_buf[:, :x.size(1), :]


class PokerLoss(nn.Module):
    # Multi-task loss for poker model with outcome-based weighting.
    # Combines:
    # - Action classification loss (cross-entropy)
    # - Raise amount regression loss (Huber, only for raise actions)
    # - Outcome-based weighting (learn more from winning decisions)
    
    def __init__(self, action_weight=1.0, value_weight=0.1, use_class_weights=False, use_outcome_weighting=True,
                 outcome_temperature=5.0, outcome_weight_range=(0.2, 2.0)):
        # Args:
        #     action_weight: Weight for action classification loss
        #     value_weight: Weight for raise amount regression loss
        #     use_class_weights: If True, weight classes inversely to frequency
        #     use_outcome_weighting: If True, weight by hand outcomes (wins/losses)
        #     outcome_temperature: Temperature parameter for outcome scaling (lower = more sensitive)
        #     outcome_weight_range: (min_weight, max_weight) tuple for outcome weight range
        super().__init__()
        self.action_weight = action_weight
        self.value_weight = value_weight
        self.use_class_weights = use_class_weights
        self.use_outcome_weighting = use_outcome_weighting
        self.outcome_temperature = outcome_temperature
        self.outcome_min_weight, self.outcome_max_weight = outcome_weight_range
        
        # Class weights for imbalanced dataset
        # Based on dataset stats: fold=53%, call=27%, raise=20%
        if use_class_weights:
            # Inverse frequency weighting
            class_weights = torch.tensor([1/0.53, 1/0.27, 1/0.20])
            class_weights = class_weights / class_weights.sum() * 3  # Normalize
            # Register as buffer so it moves to device with model
            self.register_buffer('class_weights', class_weights)
            self.action_loss_fn = nn.CrossEntropyLoss(weight=self.class_weights, reduction='none')
        else:
            self.class_weights = None
            self.action_loss_fn = nn.CrossEntropyLoss(reduction='none')  # No reduction for outcome weighting
        
        self.value_loss = nn.MSELoss(reduction='none')
    
    def forward(self, predictions, targets, outcomes=None):
        # Compute multi-task loss with optional outcome weighting.
        # Args:
        #     predictions: (action_logits, value_pred)
        #         - action_logits: [B, 3]
        #         - value_pred: [B, 1]
        #     targets: (action_labels, value_targets)
        #         - action_labels: [B]
        #         - value_targets: [B]
        #     outcomes: [B] profit/loss in big blinds (optional, for outcome weighting)
        # Returns:
        #     total_loss: scalar
        #     loss_dict: dict with individual losses
        action_logits, value_pred = predictions
        action_labels, value_targets = targets
        
        # Action classification loss (all examples)
        # Note: class_weights are automatically on correct device via register_buffer
        loss_action_per_sample = self.action_loss_fn(action_logits, action_labels)  # [B]
        
        # Outcome-based weighting: weight by (normalized) outcome
        if self.use_outcome_weighting and outcomes is not None:
            # More aggressive scaling: use configurable temperature and wider weight range
            # Lower temperature = more sensitive to outcome differences
            outcome_weights = torch.sigmoid(outcomes / self.outcome_temperature)
            # Rescale to configured range (default [0.2, 2.0] for 10x dynamic range)
            weight_range = self.outcome_max_weight - self.outcome_min_weight
            outcome_weights = self.outcome_min_weight + weight_range * outcome_weights
            loss_action = (loss_action_per_sample * outcome_weights).mean()
        else:
            loss_action = loss_action_per_sample.mean()
        
        # Raise amount regression loss (only for raise actions)
        # Only compute loss where action_labels == 2 (raise)
        raise_mask = (action_labels == 2)
        
        if raise_mask.any():
            value_pred_raise = value_pred[raise_mask].squeeze(-1)
            value_targets_raise = value_targets[raise_mask]
            
            # Use log-scale for predictions (makes learning easier)
            # Range: 0.5x to 9000x pot → log(0.5) to log(9000) = -0.69 to 9.1
            # This compresses the range and makes outliers less extreme
            value_targets_log = torch.log(value_targets_raise.clamp(min=0.1))
            value_pred_log = value_pred_raise  # Model predicts in log-space
            
            loss_value_per_sample = self.value_loss(value_pred_log, value_targets_log)  # [N_raises]
            
            # Apply outcome weighting to value loss too
            if self.use_outcome_weighting and outcomes is not None:
                outcome_weights_raise = torch.sigmoid(outcomes[raise_mask] / self.outcome_temperature)
                weight_range = self.outcome_max_weight - self.outcome_min_weight
                outcome_weights_raise = self.outcome_min_weight + weight_range * outcome_weights_raise
                loss_value = (loss_value_per_sample * outcome_weights_raise).mean()
            else:
                loss_value = loss_value_per_sample.mean()
        else:
            # No raises in batch - set loss to 0
            loss_value = torch.tensor(0.0, device=action_logits.device)
        
        # Combined loss
        total_loss = (
            self.action_weight * loss_action +
            self.value_weight * loss_value
        )
        
        return total_loss, {
            'loss_action': loss_action.item(),
            'loss_value': loss_value.item() if isinstance(loss_value, torch.Tensor) else 0.0,
            'loss_total': total_loss.item(),
        }


def create_model(config=None):
    # Factory function to create model with default or custom config.
    # Args: config: dict with model parameters (optional)
    # Returns: model: PluribusPokerTransformer instance
    if config is None:
        config = {
            'd_model': 512,
            'nhead': 8,
            'num_layers': 6,
            'dim_feedforward': 2048,
            'dropout': 0.1,
        }
    
    model = PluribusPokerTransformer(**config)
    
    # Count parameters
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    
    print(f"Model created:")
    print(f"  Architecture: PokerTransformer")
    print(f"  Total parameters: {total_params:,}")
    print(f"  Trainable parameters: {trainable_params:,}")
    print(f"  Model size: ~{total_params * 4 / 1024**2:.1f} MB (fp32)")
    
    return model


if __name__ == '__main__':
    # Test model creation
    print("Testing model creation...")
    
    model = create_model()
    
    # Test forward pass with realistic batch
    batch_size = 4
    
    batch = {
        'static_state': torch.randn(batch_size, 20),  # Random for test (IDs + other features)
        'action_sequence': torch.randn(batch_size, 20, 10),  # Random for test
    }
    
    action_logits, value = model(batch)
    
    print(f"\nTest forward pass:")
    print(f"  Batch size: {batch_size}")
    print(f"  Static state: {batch['static_state'].shape}")
    print(f"  Action sequence: {batch['action_sequence'].shape}")
    print(f"  Action logits: {action_logits.shape}")
    print(f"  Value output: {value.shape}")
    
    # Test with attention
    action_logits, value, attention = model(batch, return_attention=True)
    print(f"\nAttention outputs:")
    for key, val in attention.items():
        print(f"  {key}: {val.shape}")
    
    print(f"\n✓ Model test successful!")
