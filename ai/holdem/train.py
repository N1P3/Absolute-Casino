"""
Training script for Pluribus Poker Transformer.

Usage:
    # Basic training (NPZ format)
    python train.py --dataset poker_transformer_acpc_rust.npz
    
    # HDF5 format (legacy)
    python train.py --dataset poker_transformer_pluribus.h5
    
    # Custom model size
    python train.py --dataset poker_transformer_acpc_rust.npz --d-model 256 --num-layers 4
    
    # With class weights for imbalanced dataset
    python train.py --dataset poker_transformer_acpc_rust.npz --use-class-weights
"""

import argparse
import torch
import torch.nn as nn
from torch.utils.tensorboard import SummaryWriter
from pathlib import Path
import time
from tqdm import tqdm
import json
from datetime import datetime

from model import create_model, PokerLoss
from dataset import create_dataloaders


def _strip_ddp_prefix(state_dict):
    """Handle DDP/torch.compile wrapped checkpoints by removing `_orig_mod.`."""
    prefix = '_orig_mod.'
    if any(key.startswith(prefix) for key in state_dict.keys()):
        return {key[len(prefix):] if key.startswith(prefix) else key: value
                for key, value in state_dict.items()}
    return state_dict


class Trainer:
    """Trainer for Pluribus Poker Transformer."""
    
    def __init__(
        self,
        model,
        train_loader,
        val_loader,
        optimizer,
        scheduler,
        criterion,
        device,
        output_dir='checkpoints',
        log_dir='runs',
        use_amp=False,
    ):
        self.model = model
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.optimizer = optimizer
        self.scheduler = scheduler
        self.criterion = criterion
        self.device = device
        self.use_amp = use_amp
        
        # Mixed precision scaler
        if use_amp:
            device_type = 'cuda' if 'cuda' in str(device) else 'cpu'
            self.scaler = torch.amp.GradScaler(device_type)
        else:
            self.scaler = None
        
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True, parents=True)
        
        # TensorBoard
        self.writer = SummaryWriter(log_dir)
        
        # Tracking
        self.epoch = 0
        self.global_step = 0
        self.best_val_loss = float('inf')
        self.best_val_accuracy = 0.0
    
    def train_epoch(self):
        """Train for one epoch."""
        self.model.train()
        
        total_loss = 0
        total_action_loss = 0
        total_value_loss = 0
        correct_actions = 0
        total_actions = 0
        num_batches = 0
        
        # Per-class accuracy tracking
        class_correct = [0, 0, 0]
        class_total = [0, 0, 0]
        
        pbar = tqdm(self.train_loader, desc=f'Epoch {self.epoch}')
        
        for batch in pbar:
            # Move to device
            batch = {k: v.to(self.device) if isinstance(v, torch.Tensor) else v 
                    for k, v in batch.items()}
            
            # Forward pass with optional mixed precision
            device_type = 'cuda' if 'cuda' in str(self.device) else 'cpu'
            with torch.amp.autocast(device_type=device_type, enabled=self.use_amp):
                action_logits, value_pred = self.model(batch)
                
                # Compute loss with outcome weighting
                predictions = (action_logits, value_pred)
                targets = (batch['target_action'], batch['target_value'])
                outcomes = batch.get('outcome')  # May be None for old datasets
                
                loss, loss_dict = self.criterion(predictions, targets, outcomes)
            
            # Backward pass
            self.optimizer.zero_grad()
            
            if self.use_amp:
                self.scaler.scale(loss).backward()
                self.scaler.unscale_(self.optimizer)
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                self.scaler.step(self.optimizer)
                self.scaler.update()
            else:
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                self.optimizer.step()
            
            # Track metrics
            total_loss += loss_dict['loss_total']
            total_action_loss += loss_dict['loss_action']
            total_value_loss += loss_dict['loss_value']
            num_batches += 1
            self.global_step += 1
            
            # Compute accuracy
            action_preds = action_logits.argmax(dim=1)
            correct_actions += (action_preds == batch['target_action']).sum().item()
            total_actions += len(batch['target_action'])
            
            # Per-class accuracy
            for cls in range(3):
                mask = batch['target_action'] == cls
                if mask.sum() > 0:
                    class_correct[cls] += (action_preds[mask] == cls).sum().item()
                    class_total[cls] += mask.sum().item()
            
            # Update progress bar
            accuracy = correct_actions / total_actions
            pbar.set_postfix({
                'loss': f"{loss_dict['loss_total']:.4f}",
                'acc': f"{accuracy:.3f}",
            })
            
            # Log to TensorBoard
            if self.global_step % 10 == 0:
                self.writer.add_scalar('train/loss_total', loss_dict['loss_total'], self.global_step)
                self.writer.add_scalar('train/loss_action', loss_dict['loss_action'], self.global_step)
                self.writer.add_scalar('train/loss_value', loss_dict['loss_value'], self.global_step)
                self.writer.add_scalar('train/accuracy', accuracy, self.global_step)
                self.writer.add_scalar('train/lr', self.optimizer.param_groups[0]['lr'], self.global_step)
        
        # Average losses
        avg_loss = total_loss / num_batches
        avg_action_loss = total_action_loss / num_batches
        avg_value_loss = total_value_loss / num_batches
        avg_accuracy = correct_actions / total_actions
        
        # Per-class accuracies
        class_accuracies = [
            class_correct[i] / class_total[i] if class_total[i] > 0 else 0.0
            for i in range(3)
        ]
        
        # Log to TensorBoard (epoch-level)
        self.writer.add_scalar('train_epoch/loss_total', avg_loss, self.epoch)
        self.writer.add_scalar('train_epoch/loss_action', avg_action_loss, self.epoch)
        self.writer.add_scalar('train_epoch/loss_value', avg_value_loss, self.epoch)
        self.writer.add_scalar('train_epoch/accuracy', avg_accuracy, self.epoch)
        self.writer.add_scalar('train_epoch/fold_accuracy', class_accuracies[0], self.epoch)
        self.writer.add_scalar('train_epoch/call_accuracy', class_accuracies[1], self.epoch)
        self.writer.add_scalar('train_epoch/raise_accuracy', class_accuracies[2], self.epoch)
        
        return {
            'loss': avg_loss,
            'action_loss': avg_action_loss,
            'value_loss': avg_value_loss,
            'accuracy': avg_accuracy,
            'fold_accuracy': class_accuracies[0],
            'call_accuracy': class_accuracies[1],
            'raise_accuracy': class_accuracies[2],
        }
    
    @torch.no_grad()
    def validate(self):
        """Validate on validation set."""
        self.model.eval()
        
        total_loss = 0
        total_action_loss = 0
        total_value_loss = 0
        correct_actions = 0
        total_actions = 0
        num_batches = 0
        
        # Per-class tracking
        class_correct = [0, 0, 0]
        class_total = [0, 0, 0]
        class_tp = [0, 0, 0]  # True positives
        class_fp = [0, 0, 0]  # False positives
        class_fn = [0, 0, 0]  # False negatives
        
        # Value prediction tracking (for raises only)
        all_value_preds = []
        all_value_targets = []
        
        for batch in tqdm(self.val_loader, desc='Validation'):
            # Move to device
            batch = {k: v.to(self.device) if isinstance(v, torch.Tensor) else v 
                    for k, v in batch.items()}
            
            # Forward pass
            device_type = 'cuda' if 'cuda' in str(self.device) else 'cpu'
            with torch.amp.autocast(device_type=device_type, enabled=self.use_amp):
                action_logits, value_pred = self.model(batch)
                
                # Compute loss with outcome weighting
                predictions = (action_logits, value_pred)
                targets = (batch['target_action'], batch['target_value'])
                outcomes = batch.get('outcome')  # May be None for old datasets
                
                loss, loss_dict = self.criterion(predictions, targets, outcomes)
            
            # Track metrics
            total_loss += loss_dict['loss_total']
            total_action_loss += loss_dict['loss_action']
            total_value_loss += loss_dict['loss_value']
            num_batches += 1
            
            # Compute accuracy
            action_preds = action_logits.argmax(dim=1)
            correct_actions += (action_preds == batch['target_action']).sum().item()
            total_actions += len(batch['target_action'])
            
            # Per-class metrics (for precision/recall)
            for cls in range(3):
                true_mask = batch['target_action'] == cls
                pred_mask = action_preds == cls
                
                class_total[cls] += true_mask.sum().item()
                class_correct[cls] += (action_preds[true_mask] == cls).sum().item()
                
                # TP, FP, FN for precision/recall
                class_tp[cls] += (true_mask & pred_mask).sum().item()
                class_fp[cls] += ((~true_mask) & pred_mask).sum().item()
                class_fn[cls] += (true_mask & (~pred_mask)).sum().item()
            
            # Track value predictions for raises
            raise_mask = batch['target_action'] == 2
            if raise_mask.sum() > 0:
                # Model predicts in log-space, convert back to original scale
                value_pred_log = value_pred.squeeze()[raise_mask]
                value_pred_original = torch.exp(value_pred_log).clamp(min=0.1, max=10000)
                
                # Targets are in original scale
                value_targets_original = batch['target_value'][raise_mask]
                
                all_value_preds.extend(value_pred_original.cpu().numpy().tolist())
                all_value_targets.extend(value_targets_original.cpu().numpy().tolist())
        
        # Average losses
        avg_loss = total_loss / num_batches
        avg_action_loss = total_action_loss / num_batches
        avg_value_loss = total_value_loss / num_batches
        avg_accuracy = correct_actions / total_actions
        
        # Per-class accuracies
        class_accuracies = [
            class_correct[i] / class_total[i] if class_total[i] > 0 else 0.0
            for i in range(3)
        ]
        
        # Per-class precision/recall
        class_precision = [
            class_tp[i] / (class_tp[i] + class_fp[i]) if (class_tp[i] + class_fp[i]) > 0 else 0.0
            for i in range(3)
        ]
        class_recall = [
            class_tp[i] / (class_tp[i] + class_fn[i]) if (class_tp[i] + class_fn[i]) > 0 else 0.0
            for i in range(3)
        ]
        
        # Balanced accuracy (average of per-class recalls)
        balanced_accuracy = sum(class_recall) / 3
        
        # Value prediction metrics (raises only)
        if len(all_value_preds) > 0:
            value_preds = torch.tensor(all_value_preds)
            value_targets = torch.tensor(all_value_targets)
            value_mae = torch.abs(value_preds - value_targets).mean().item()
            
            # Compute MAE in log-space too (better metric for wide ranges)
            value_preds_log = torch.log(value_preds.clamp(min=0.1))
            value_targets_log = torch.log(value_targets.clamp(min=0.1))
            value_mae_log = torch.abs(value_preds_log - value_targets_log).mean().item()
        else:
            value_mae = 0.0
            value_mae_log = 0.0
        
        # Log to TensorBoard
        self.writer.add_scalar('val/loss_total', avg_loss, self.epoch)
        self.writer.add_scalar('val/loss_action', avg_action_loss, self.epoch)
        self.writer.add_scalar('val/loss_value', avg_value_loss, self.epoch)
        self.writer.add_scalar('val/accuracy', avg_accuracy, self.epoch)
        self.writer.add_scalar('val/balanced_accuracy', balanced_accuracy, self.epoch)
        self.writer.add_scalar('val/fold_accuracy', class_accuracies[0], self.epoch)
        self.writer.add_scalar('val/call_accuracy', class_accuracies[1], self.epoch)
        self.writer.add_scalar('val/raise_accuracy', class_accuracies[2], self.epoch)
        self.writer.add_scalar('val/fold_precision', class_precision[0], self.epoch)
        self.writer.add_scalar('val/call_precision', class_precision[1], self.epoch)
        self.writer.add_scalar('val/raise_precision', class_precision[2], self.epoch)
        self.writer.add_scalar('val/value_mae', value_mae, self.epoch)
        self.writer.add_scalar('val/value_mae_log', value_mae_log, self.epoch)
        
        return {
            'loss': avg_loss,
            'action_loss': avg_action_loss,
            'value_loss': avg_value_loss,
            'accuracy': avg_accuracy,
            'balanced_accuracy': balanced_accuracy,
            'fold_accuracy': class_accuracies[0],
            'call_accuracy': class_accuracies[1],
            'raise_accuracy': class_accuracies[2],
            'fold_precision': class_precision[0],
            'call_precision': class_precision[1],
            'raise_precision': class_precision[2],
            'value_mae': value_mae,
            'value_mae_log': value_mae_log,
        }
    
    def save_checkpoint(self, filename='checkpoint.pt', is_best=False):
        """Save model checkpoint."""
        checkpoint = {
            'epoch': self.epoch,
            'global_step': self.global_step,
            'model_state_dict': self.model.state_dict(),
            'optimizer_state_dict': self.optimizer.state_dict(),
            'scheduler_state_dict': self.scheduler.state_dict() if self.scheduler else None,
            'best_val_loss': self.best_val_loss,
            'best_val_accuracy': self.best_val_accuracy,
        }
        
        checkpoint_path = self.output_dir / filename
        torch.save(checkpoint, checkpoint_path)
        
        if is_best:
            best_path = self.output_dir / 'best_model.pt'
            torch.save(checkpoint, best_path)
            print(f"  ✓ Saved best model to {best_path}")
    
    def train(self, num_epochs, save_every=1):
        """
        Main training loop.
        
        Args:
            num_epochs: Number of epochs to train
            save_every: Save checkpoint every N epochs
        """
        print(f"\nStarting training for {num_epochs} epochs...")
        print(f"Device: {self.device}")
        print(f"Train batches: {len(self.train_loader)}")
        print(f"Val batches: {len(self.val_loader)}")
        print(f"Output dir: {self.output_dir}")
        print("=" * 80)
        
        start_time = time.time()
        
        for epoch in range(num_epochs):
            self.epoch = epoch
            
            # Train
            train_metrics = self.train_epoch()
            
            # Validate
            val_metrics = self.validate()
            
            # Learning rate scheduling
            if self.scheduler:
                self.scheduler.step(val_metrics['loss'])
            
            # Print epoch summary
            print(f"\nEpoch {epoch} Summary:")
            print(f"  Train Loss: {train_metrics['loss']:.4f} | Accuracy: {train_metrics['accuracy']:.4f}")
            print(f"  Val Loss:   {val_metrics['loss']:.4f} | Accuracy: {val_metrics['accuracy']:.4f}")
            print(f"  Balanced Accuracy: {val_metrics['balanced_accuracy']:.4f}")
            print(f"  Per-class Accuracy: Fold={val_metrics['fold_accuracy']:.3f}, "
                  f"Call={val_metrics['call_accuracy']:.3f}, Raise={val_metrics['raise_accuracy']:.3f}")
            print(f"  Per-class Precision: Fold={val_metrics['fold_precision']:.3f}, "
                  f"Call={val_metrics['call_precision']:.3f}, Raise={val_metrics['raise_precision']:.3f}")
            print(f"  Value MAE (raises): {val_metrics['value_mae']:.4f}× pot | Log-MAE: {val_metrics['value_mae_log']:.4f}")
            print(f"  Learning Rate: {self.optimizer.param_groups[0]['lr']:.6f}")
            
            # Save checkpoint
            if (epoch + 1) % save_every == 0:
                self.save_checkpoint(f'checkpoint_epoch_{epoch}.pt')
            
            # Save best model (based on balanced accuracy)
            if val_metrics['balanced_accuracy'] > self.best_val_accuracy:
                self.best_val_accuracy = val_metrics['balanced_accuracy']
                self.best_val_loss = val_metrics['loss']
                self.save_checkpoint('checkpoint.pt', is_best=True)
            
            print("=" * 80)
        
        elapsed = time.time() - start_time
        print(f"\n✓ Training complete! Total time: {elapsed/60:.1f} minutes")
        print(f"Best validation balanced accuracy: {self.best_val_accuracy:.4f}")
        print(f"Best validation loss: {self.best_val_loss:.4f}")
        
        self.writer.close()


def main():
    parser = argparse.ArgumentParser(description='Train Pluribus Poker Transformer')
    
    # Data
    parser.add_argument('--dataset', type=str, default='poker_transformer_acpc_rust.npz',
                       help='Path to dataset (HDF5 .h5 or NPZ .npz)')
    parser.add_argument('--batch-size', type=int, default=32, help='Batch size')
    parser.add_argument('--num-workers', type=int, default=0, help='DataLoader workers (use 0 on Windows)')
    parser.add_argument('--no-preload', action='store_true', 
                       help='Disable RAM preloading (use for large datasets >5GB)')
    
    # Model
    parser.add_argument('--d-model', type=int, default=512, help='Model dimension')
    parser.add_argument('--nhead', type=int, default=8, help='Number of attention heads')
    parser.add_argument('--num-layers', type=int, default=6, help='Number of transformer layers')
    parser.add_argument('--dim-feedforward', type=int, default=2048, help='FFN dimension')
    parser.add_argument('--dropout', type=float, default=0.1, help='Dropout rate')
    
    # Training
    parser.add_argument('--epochs', type=int, default=20, help='Number of epochs')
    parser.add_argument('--lr', type=float, default=1e-4, help='Learning rate')
    parser.add_argument('--weight-decay', type=float, default=0.01, help='Weight decay')
    parser.add_argument('--use-class-weights', action='store_true', 
                       help='Use class weights for imbalanced dataset')
    parser.add_argument('--use-amp', action='store_true', 
                       help='Use automatic mixed precision (GPU only)')
    
    # Output
    parser.add_argument('--output-dir', type=str, default='checkpoints', help='Output directory')
    parser.add_argument('--log-dir', type=str, default=None, 
                       help='TensorBoard log directory (default: runs/TIMESTAMP)')
    parser.add_argument('--save-every', type=int, default=5, help='Save checkpoint every N epochs')
    
    # Device
    parser.add_argument('--device', type=str, default='cuda' if torch.cuda.is_available() else 'cpu')
    
    # Resume
    parser.add_argument('--resume', type=str, default=None, help='Resume from checkpoint')
    
    args = parser.parse_args()
    
    # Create timestamped log directory if not specified
    if args.log_dir is None:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        args.log_dir = f'runs/run_{timestamp}'
    
    # Check dataset exists
    if not Path(args.dataset).exists():
        print(f"Error: Dataset not found: {args.dataset}")
        print("Run preprocess.py first to create the dataset!")
        return
    
    print("=" * 80)
    print("Pluribus Poker Transformer Training")
    print("=" * 80)
    print(f"Dataset: {args.dataset}")
    print(f"Device: {args.device}")
    print(f"Mixed Precision: {'Enabled' if args.use_amp else 'Disabled'}")
    print(f"Class Weights: {'Enabled' if args.use_class_weights else 'Disabled'}")
    print(f"Batch size: {args.batch_size}")
    print(f"Model: d_model={args.d_model}, layers={args.num_layers}, heads={args.nhead}")
    print("=" * 80)
    
    # Create dataloaders
    train_loader, val_loader = create_dataloaders(
        args.dataset,
        batch_size=args.batch_size,
        num_workers=args.num_workers,
        preload=not args.no_preload,  # Preload by default
    )
    
    # Create model
    model_config = {
        'd_model': args.d_model,
        'nhead': args.nhead,
        'num_layers': args.num_layers,
        'dim_feedforward': args.dim_feedforward,
        'dropout': args.dropout,
    }
    model = create_model(model_config)
    model = model.to(args.device)
    
    # Create optimizer
    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=args.weight_decay,
        betas=(0.9, 0.999),
    )
    
    # Learning rate scheduler
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer,
        mode='min',
        factor=0.5,
        patience=3,
    )
    
    # Loss function
    criterion = PokerLoss(
        action_weight=1.0,
        value_weight=0.2,  # Increased to give value head more gradient signal
        use_class_weights=args.use_class_weights,
        use_outcome_weighting=True,  # Enable outcome-based learning
    )
    criterion = criterion.to(args.device)  # Move to device (for class weights)
    
    # Resume from checkpoint if specified
    start_epoch = 0
    if args.resume:
        print(f"Resuming from checkpoint: {args.resume}")
        checkpoint = torch.load(args.resume, map_location=args.device)
        state_dict = _strip_ddp_prefix(checkpoint['model_state_dict'])
        model.load_state_dict(state_dict)
        optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
        if checkpoint['scheduler_state_dict']:
            scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
        start_epoch = checkpoint['epoch'] + 1
        print(f"Resumed from epoch {checkpoint['epoch']}")
    
    # Save config
    output_dir = Path(args.output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)
    
    config_dict = vars(args)
    config_dict['model_config'] = model_config
    
    with open(output_dir / 'config.json', 'w') as f:
        json.dump(config_dict, f, indent=2)
    
    # Create trainer
    trainer = Trainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        optimizer=optimizer,
        scheduler=scheduler,
        criterion=criterion,
        device=args.device,
        output_dir=args.output_dir,
        log_dir=args.log_dir,
        use_amp=args.use_amp,
        precision="fp4"
    )
    
    # Set start epoch for resuming
    trainer.epoch = start_epoch
    
    # Train
    trainer.train(num_epochs=args.epochs, save_every=args.save_every)


if __name__ == '__main__':
    main()
