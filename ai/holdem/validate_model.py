"""
Comprehensive model validation with visualizations and error analysis.

Usage:
    python validate_model.py --checkpoint checkpoints/best_model.pt --test-data test_pluribus.npz
    python validate_model.py --checkpoint checkpoints/best_model.pt --test-data test_pluribus.npz --output-dir validation_results
"""

import argparse
import torch
import torch.nn as nn
from pathlib import Path
import numpy as np
from tqdm import tqdm
import json
import matplotlib.pyplot as plt
import seaborn as sns
from collections import defaultdict

from model import create_model, PokerLoss
from dataset import PluribusPokerDataset
from torch.utils.data import DataLoader


# Card and action name mappings for readable output
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A']
SUITS = ['c', 'd', 'h', 's']
ACTION_NAMES = ['FOLD', 'CALL', 'RAISE']


def decode_cards(card_encoding):
    """Decode multi-hot card encoding to readable format (order-invariant)."""
    cards = []
    # Hole cards: first 52 features (multi-hot, both cards in same 52 slots)
    hole_card_vec = card_encoding[:52]
    card_indices = np.where(hole_card_vec > 0)[0]
    
    for card_idx in card_indices:
        rank = RANKS[card_idx // 4]
        suit = SUITS[card_idx % 4]
        cards.append(f"{rank}{suit}")
    
    # Pad to 2 cards if needed
    while len(cards) < 2:
        cards.append("??")
    
    return cards[:2]  # Only return first 2


def decode_board(card_encoding):
    """Decode board cards from encoding."""
    cards = []
    # Board cards: features 104-364 (5 cards × 52)
    for i in range(5):
        start = 104 + i * 52
        end = start + 52
        card_vec = card_encoding[start:end]
        if card_vec.sum() > 0:
            card_idx = card_vec.argmax()
            rank = RANKS[card_idx // 4]
            suit = SUITS[card_idx % 4]
            cards.append(f"{rank}{suit}")
    return cards


def get_street_name(static_state):
    """Get street name from static state encoding."""
    # Street: last 4 features (one-hot)
    street_vec = static_state[-4:]
    if street_vec[0] == 1:
        return "PREFLOP"
    elif street_vec[1] == 1:
        return "FLOP"
    elif street_vec[2] == 1:
        return "TURN"
    elif street_vec[3] == 1:
        return "RIVER"
    return "UNKNOWN"


class ModelValidator:
    """Comprehensive model validation with analysis."""
    
    def __init__(self, model, criterion, device='cpu', output_dir=None):
        self.model = model
        self.criterion = criterion
        self.device = device
        self.model.to(device)
        self.model.eval()
        
        self.output_dir = Path(output_dir) if output_dir else None
        if self.output_dir:
            self.output_dir.mkdir(exist_ok=True, parents=True)
        
        # Storage for detailed analysis
        self.predictions = []
        self.confusion_matrix = np.zeros((3, 3), dtype=int)
        self.probability_distributions = defaultdict(list)
        self.wrong_predictions = []
    
    @torch.no_grad()
    def validate(self, dataloader, dataset_name="Test"):
        """Validate and collect detailed metrics."""
        print(f"\n{'='*80}")
        print(f"Evaluating on {dataset_name} dataset...")
        print(f"{'='*80}")
        
        total_loss = 0
        total_action_loss = 0
        total_value_loss = 0
        correct_actions = 0
        total_actions = 0
        num_batches = 0
        
        # Per-class tracking
        class_correct = [0, 0, 0]
        class_total = [0, 0, 0]
        class_tp = [0, 0, 0]
        class_fp = [0, 0, 0]
        class_fn = [0, 0, 0]
        
        # Value prediction tracking
        all_value_preds = []
        all_value_targets = []
        
        # Action distribution
        action_distribution = [0, 0, 0]
        
        for batch_idx, batch in enumerate(tqdm(dataloader, desc=f'Evaluating {dataset_name}')):
            # Move to device
            batch = {k: v.to(self.device) if isinstance(v, torch.Tensor) else v 
                    for k, v in batch.items()}
            
            # Forward pass
            action_logits, value_pred = self.model(batch)
            
            # Get probabilities for analysis
            action_probs = torch.softmax(action_logits, dim=1)
            
            # Compute loss
            predictions = (action_logits, value_pred)
            targets = (batch['target_action'], batch['target_value'])
            outcomes = batch.get('outcome')
            
            loss, loss_dict = self.criterion(predictions, targets, outcomes)
            
            # Track metrics
            total_loss += loss_dict['loss_total']
            total_action_loss += loss_dict['loss_action']
            total_value_loss += loss_dict['loss_value']
            num_batches += 1
            
            # Predictions
            action_preds = action_logits.argmax(dim=1)
            target_actions = batch['target_action']
            
            correct_actions += (action_preds == target_actions).sum().item()
            total_actions += len(target_actions)
            
            # Track for confusion matrix and analysis
            for pred, target, probs, static_state, value_p, value_t in zip(
                action_preds.cpu().numpy(),
                target_actions.cpu().numpy(),
                action_probs.cpu().numpy(),
                batch['static_state'].cpu().numpy(),
                value_pred.squeeze().cpu().numpy(),
                batch['target_value'].cpu().numpy()
            ):
                self.confusion_matrix[target, pred] += 1
                
                # Store probability distribution for each true class
                self.probability_distributions[target].append(probs)
                
                # Collect wrong predictions (sample first 100)
                if pred != target and len(self.wrong_predictions) < 100:
                    hole_cards = decode_cards(static_state)
                    board = decode_board(static_state)
                    street = get_street_name(static_state)
                    pot = static_state[370]  # Pot size feature
                    
                    # Only include value predictions when both are raises
                    value_pred_amount = None
                    value_target_amount = None
                    if pred == 2 and target == 2:
                        value_pred_amount = np.exp(value_p)
                        value_target_amount = value_t
                    
                    self.wrong_predictions.append({
                        'hole_cards': hole_cards,
                        'board': board,
                        'street': street,
                        'pot': pot,
                        'predicted': ACTION_NAMES[pred],
                        'predicted_prob': probs[pred],
                        'target': ACTION_NAMES[target],
                        'probabilities': {
                            'FOLD': probs[0],
                            'CALL': probs[1],
                            'RAISE': probs[2],
                        },
                        'value_pred': value_pred_amount,
                        'value_target': value_target_amount,
                    })
            
            # Track action distribution
            for cls in range(3):
                action_distribution[cls] += (target_actions == cls).sum().item()
            
            # Per-class metrics
            for cls in range(3):
                true_mask = target_actions == cls
                pred_mask = action_preds == cls
                
                class_total[cls] += true_mask.sum().item()
                class_correct[cls] += (action_preds[true_mask] == cls).sum().item()
                
                class_tp[cls] += (true_mask & pred_mask).sum().item()
                class_fp[cls] += ((~true_mask) & pred_mask).sum().item()
                class_fn[cls] += (true_mask & (~pred_mask)).sum().item()
            
            # Value predictions for raises
            raise_mask = target_actions == 2
            if raise_mask.sum() > 0:
                value_pred_log = value_pred.squeeze()[raise_mask]
                value_pred_original = torch.exp(value_pred_log).clamp(min=0.1, max=10000)
                value_targets_original = batch['target_value'][raise_mask]
                
                all_value_preds.extend(value_pred_original.cpu().numpy().tolist())
                all_value_targets.extend(value_targets_original.cpu().numpy().tolist())
        
        # Compute metrics
        metrics = self._compute_metrics(
            total_loss, total_action_loss, total_value_loss, num_batches,
            correct_actions, total_actions,
            class_correct, class_total, class_tp, class_fp, class_fn,
            all_value_preds, all_value_targets,
            action_distribution
        )
        
        # Print results
        self._print_results(metrics, dataset_name)
        
        # Generate visualizations
        if self.output_dir:
            self._generate_visualizations(metrics, dataset_name)
            self._save_wrong_predictions()
        
        return metrics
    
    def _compute_metrics(self, total_loss, total_action_loss, total_value_loss, num_batches,
                        correct_actions, total_actions,
                        class_correct, class_total, class_tp, class_fp, class_fn,
                        all_value_preds, all_value_targets, action_distribution):
        """Compute all metrics."""
        avg_loss = total_loss / num_batches
        avg_action_loss = total_action_loss / num_batches
        avg_value_loss = total_value_loss / num_batches
        avg_accuracy = correct_actions / total_actions
        
        # Per-class metrics
        class_accuracies = [
            class_correct[i] / class_total[i] if class_total[i] > 0 else 0.0
            for i in range(3)
        ]
        
        class_precision = [
            class_tp[i] / (class_tp[i] + class_fp[i]) if (class_tp[i] + class_fp[i]) > 0 else 0.0
            for i in range(3)
        ]
        class_recall = [
            class_tp[i] / (class_tp[i] + class_fn[i]) if (class_tp[i] + class_fn[i]) > 0 else 0.0
            for i in range(3)
        ]
        class_f1 = [
            2 * (class_precision[i] * class_recall[i]) / (class_precision[i] + class_recall[i])
            if (class_precision[i] + class_recall[i]) > 0 else 0.0
            for i in range(3)
        ]
        
        balanced_accuracy = sum(class_recall) / 3
        macro_f1 = sum(class_f1) / 3
        
        # Value metrics
        if len(all_value_preds) > 0:
            value_preds = np.array(all_value_preds)
            value_targets = np.array(all_value_targets)
            value_mae = np.abs(value_preds - value_targets).mean()
            value_median_ae = np.median(np.abs(value_preds - value_targets))
            
            value_preds_log = np.log(np.clip(value_preds, 0.1, None))
            value_targets_log = np.log(np.clip(value_targets, 0.1, None))
            value_mae_log = np.abs(value_preds_log - value_targets_log).mean()
        else:
            value_mae = value_median_ae = value_mae_log = 0.0
        
        action_pct = [count / total_actions for count in action_distribution]
        
        return {
            'loss': avg_loss,
            'action_loss': avg_action_loss,
            'value_loss': avg_value_loss,
            'accuracy': avg_accuracy,
            'balanced_accuracy': balanced_accuracy,
            'macro_f1': macro_f1,
            'class_accuracies': class_accuracies,
            'class_precision': class_precision,
            'class_recall': class_recall,
            'class_f1': class_f1,
            'value_mae': value_mae,
            'value_mae_log': value_mae_log,
            'value_median_ae': value_median_ae,
            'total_examples': total_actions,
            'action_distribution': action_distribution,
            'action_pct': action_pct,
        }
    
    def _print_results(self, m, dataset_name):
        """Print validation results."""
        print(f"\n{'='*80}")
        print(f"{dataset_name.upper()} VALIDATION RESULTS")
        print(f"{'='*80}")
        print(f"Total Examples: {m['total_examples']:,}")
        print(f"\nOVERALL METRICS:")
        print(f"  Loss (Total):        {m['loss']:.4f}")
        print(f"  Loss (Action):       {m['action_loss']:.4f}")
        print(f"  Loss (Value):        {m['value_loss']:.4f}")
        print(f"  Accuracy:            {m['accuracy']:.4f} ({m['accuracy']*100:.2f}%)")
        print(f"  Balanced Accuracy:   {m['balanced_accuracy']:.4f} ({m['balanced_accuracy']*100:.2f}%)")
        print(f"  Macro F1-Score:      {m['macro_f1']:.4f}")
        
        print(f"\nACTION DISTRIBUTION:")
        for i, name in enumerate(ACTION_NAMES):
            print(f"  {name:5s}: {m['action_pct'][i]*100:5.2f}% ({m['action_distribution'][i]:,} examples)")
        
        print(f"\nPER-CLASS PERFORMANCE:")
        print(f"              Accuracy  Precision  Recall    F1-Score")
        for i, name in enumerate(ACTION_NAMES):
            print(f"  {name:5s}:      {m['class_accuracies'][i]:.4f}    "
                  f"{m['class_precision'][i]:.4f}     {m['class_recall'][i]:.4f}    "
                  f"{m['class_f1'][i]:.4f}")
        
        if m['value_mae'] > 0:
            print(f"\nBET SIZING (Raise Actions Only):")
            print(f"  Value MAE:           {m['value_mae']:.4f}× pot")
            print(f"  Value MAE (log):     {m['value_mae_log']:.4f}")
            print(f"  Value Median AE:     {m['value_median_ae']:.4f}× pot")
        
        print(f"{'='*80}\n")
    
    def _generate_visualizations(self, metrics, dataset_name):
        """Generate and save visualization plots."""
        print("Generating visualizations...")
        
        # Set style
        sns.set_style("whitegrid")
        plt.rcParams['figure.figsize'] = (12, 8)
        
        # 1. Confusion Matrix
        self._plot_confusion_matrix(dataset_name)
        
        # 2. Probability Distributions
        self._plot_probability_distributions(dataset_name)
        
        # 3. Metrics Summary
        self._plot_metrics_summary(metrics, dataset_name)
        
        # 4. Class Performance Radar
        self._plot_performance_radar(metrics, dataset_name)
        
        print(f"✓ Visualizations saved to {self.output_dir}")
    
    def _plot_confusion_matrix(self, dataset_name):
        """Plot confusion matrix."""
        fig, ax = plt.subplots(figsize=(10, 8))
        
        # Normalize by row (true labels)
        cm_normalized = self.confusion_matrix.astype('float') / self.confusion_matrix.sum(axis=1)[:, np.newaxis]
        
        sns.heatmap(cm_normalized, annot=True, fmt='.3f', cmap='Blues',
                   xticklabels=ACTION_NAMES, yticklabels=ACTION_NAMES,
                   cbar_kws={'label': 'Proportion'}, ax=ax)
        
        ax.set_xlabel('Predicted Action', fontsize=12, fontweight='bold')
        ax.set_ylabel('True Action', fontsize=12, fontweight='bold')
        ax.set_title(f'Confusion Matrix - {dataset_name}', fontsize=14, fontweight='bold')
        
        # Add counts in parentheses
        for i in range(3):
            for j in range(3):
                count = self.confusion_matrix[i, j]
                text = ax.texts[i * 3 + j]
                text.set_text(f'{cm_normalized[i, j]:.3f}\n({count:,})')
        
        plt.tight_layout()
        plt.savefig(self.output_dir / f'confusion_matrix_{dataset_name}.png', dpi=300)
        plt.close()
    
    def _plot_probability_distributions(self, dataset_name):
        """Plot probability distributions for each true class."""
        fig, axes = plt.subplots(1, 3, figsize=(18, 5))
        
        for true_class in range(3):
            ax = axes[true_class]
            probs = np.array(self.probability_distributions[true_class])
            
            if len(probs) == 0:
                continue
            
            # Plot distribution for each predicted class
            for pred_class in range(3):
                pred_probs = probs[:, pred_class]
                ax.hist(pred_probs, bins=50, alpha=0.6, label=ACTION_NAMES[pred_class],
                       density=True)
            
            ax.set_xlabel('Probability', fontsize=11)
            ax.set_ylabel('Density', fontsize=11)
            ax.set_title(f'Predictions when True={ACTION_NAMES[true_class]}', 
                        fontsize=12, fontweight='bold')
            ax.legend()
            ax.grid(True, alpha=0.3)
        
        plt.suptitle(f'Probability Distributions - {dataset_name}', 
                    fontsize=14, fontweight='bold', y=1.02)
        plt.tight_layout()
        plt.savefig(self.output_dir / f'probability_distributions_{dataset_name}.png', dpi=300)
        plt.close()
    
    def _plot_metrics_summary(self, metrics, dataset_name):
        """Plot metrics summary bar charts."""
        fig, axes = plt.subplots(2, 2, figsize=(14, 10))
        
        # 1. Per-class Accuracy
        ax = axes[0, 0]
        x = np.arange(3)
        ax.bar(x, metrics['class_accuracies'], color=['#1f77b4', '#ff7f0e', '#2ca02c'], alpha=0.7)
        ax.set_xticks(x)
        ax.set_xticklabels(ACTION_NAMES)
        ax.set_ylabel('Accuracy', fontweight='bold')
        ax.set_title('Per-Class Accuracy', fontweight='bold')
        ax.set_ylim([0, 1])
        ax.grid(True, alpha=0.3, axis='y')
        for i, v in enumerate(metrics['class_accuracies']):
            ax.text(i, v + 0.02, f'{v:.3f}', ha='center', fontweight='bold')
        
        # 2. Precision vs Recall
        ax = axes[0, 1]
        x = np.arange(3)
        width = 0.35
        ax.bar(x - width/2, metrics['class_precision'], width, label='Precision', alpha=0.7)
        ax.bar(x + width/2, metrics['class_recall'], width, label='Recall', alpha=0.7)
        ax.set_xticks(x)
        ax.set_xticklabels(ACTION_NAMES)
        ax.set_ylabel('Score', fontweight='bold')
        ax.set_title('Precision vs Recall', fontweight='bold')
        ax.set_ylim([0, 1])
        ax.legend()
        ax.grid(True, alpha=0.3, axis='y')
        
        # 3. F1 Scores
        ax = axes[1, 0]
        x = np.arange(3)
        ax.bar(x, metrics['class_f1'], color=['#d62728', '#9467bd', '#8c564b'], alpha=0.7)
        ax.set_xticks(x)
        ax.set_xticklabels(ACTION_NAMES)
        ax.set_ylabel('F1-Score', fontweight='bold')
        ax.set_title('Per-Class F1-Score', fontweight='bold')
        ax.set_ylim([0, 1])
        ax.grid(True, alpha=0.3, axis='y')
        for i, v in enumerate(metrics['class_f1']):
            ax.text(i, v + 0.02, f'{v:.3f}', ha='center', fontweight='bold')
        
        # 4. Action Distribution
        ax = axes[1, 1]
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c']
        wedges, texts, autotexts = ax.pie(
            metrics['action_distribution'],
            labels=ACTION_NAMES,
            autopct='%1.1f%%',
            colors=colors,
            startangle=90
        )
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontweight('bold')
        ax.set_title('Action Distribution', fontweight='bold')
        
        plt.suptitle(f'Performance Metrics - {dataset_name}', 
                    fontsize=16, fontweight='bold', y=0.995)
        plt.tight_layout()
        plt.savefig(self.output_dir / f'metrics_summary_{dataset_name}.png', dpi=300)
        plt.close()
    
    def _plot_performance_radar(self, metrics, dataset_name):
        """Plot radar chart of performance across classes."""
        from math import pi
        
        fig, ax = plt.subplots(figsize=(10, 10), subplot_kw=dict(projection='polar'))
        
        # Metrics to plot
        categories = ['Accuracy', 'Precision', 'Recall', 'F1-Score']
        num_vars = len(categories)
        
        # Compute angles
        angles = [n / float(num_vars) * 2 * pi for n in range(num_vars)]
        angles += angles[:1]
        
        # Plot for each action class
        colors = ['#1f77b4', '#ff7f0e', '#2ca02c']
        for i, name in enumerate(ACTION_NAMES):
            values = [
                metrics['class_accuracies'][i],
                metrics['class_precision'][i],
                metrics['class_recall'][i],
                metrics['class_f1'][i],
            ]
            values += values[:1]
            
            ax.plot(angles, values, 'o-', linewidth=2, label=name, color=colors[i])
            ax.fill(angles, values, alpha=0.25, color=colors[i])
        
        ax.set_xticks(angles[:-1])
        ax.set_xticklabels(categories, fontweight='bold')
        ax.set_ylim([0, 1])
        ax.set_title(f'Performance Radar - {dataset_name}', 
                    fontsize=14, fontweight='bold', pad=20)
        ax.legend(loc='upper right', bbox_to_anchor=(1.3, 1.1))
        ax.grid(True)
        
        plt.tight_layout()
        plt.savefig(self.output_dir / f'performance_radar_{dataset_name}.png', dpi=300)
        plt.close()
    
    def _save_wrong_predictions(self):
        """Save wrong predictions to JSON file."""
        output_file = self.output_dir / 'wrong_predictions.json'
        
        # Convert to serializable format
        wrong_preds_serializable = []
        for pred in self.wrong_predictions:
            wrong_preds_serializable.append({
                'hole_cards': pred['hole_cards'],
                'board': pred['board'],
                'street': pred['street'],
                'pot': float(pred['pot']),
                'predicted': pred['predicted'],
                'predicted_prob': float(pred['predicted_prob']),
                'target': pred['target'],
                'probabilities': {k: float(v) for k, v in pred['probabilities'].items()},
                'value_pred': float(pred['value_pred']) if pred['value_pred'] is not None else None,
                'value_target': float(pred['value_target']) if pred['value_target'] is not None else None,
            })
        
        with open(output_file, 'w') as f:
            json.dump(wrong_preds_serializable, f, indent=2)
        
        print(f"\n{'='*80}")
        print(f"SAMPLE WRONG PREDICTIONS (First 20)")
        print(f"{'='*80}")
        for i, pred in enumerate(self.wrong_predictions[:20]):
            print(f"\n#{i+1}:")
            print(f"  Hole Cards: {' '.join(pred['hole_cards'])}")
            print(f"  Board:      {' '.join(pred['board']) if pred['board'] else 'None'} ({pred['street']})")
            print(f"  Predicted:  {pred['predicted']} ({pred['predicted_prob']:.2%} confidence)")
            print(f"  Correct:    {pred['target']}")
            print(f"  Probs:      FOLD={pred['probabilities']['FOLD']:.2%}, "
                  f"CALL={pred['probabilities']['CALL']:.2%}, "
                  f"RAISE={pred['probabilities']['RAISE']:.2%}")
            if pred['value_pred'] is not None and pred['value_target'] is not None:
                print(f"  Bet Size:   Pred={pred['value_pred']:.2f}× pot, Target={pred['value_target']:.2f}× pot")
        
        print(f"\n✓ All {len(self.wrong_predictions)} wrong predictions saved to {output_file}")
        print(f"{'='*80}\n")


def load_checkpoint(checkpoint_path, device='cpu'):
    """Load model from checkpoint."""
    checkpoint_path = Path(checkpoint_path)
    
    if not checkpoint_path.exists():
        raise FileNotFoundError(f"Checkpoint not found: {checkpoint_path}")
    
    print(f"\nLoading checkpoint: {checkpoint_path}")
    checkpoint = torch.load(checkpoint_path, map_location=device)
    
    # Try to get model config
    model_config = None
    
    if 'model_config' in checkpoint:
        model_config = checkpoint['model_config']
        print("  Using model config from checkpoint")
    elif (checkpoint_path.parent / 'config.json').exists():
        with open(checkpoint_path.parent / 'config.json', 'r') as f:
            full_config = json.load(f)
            model_config = full_config.get('model_config')
        print("  Using model config from config.json")
    
    if model_config is None:
        model_config = {
            'd_model': 512,
            'nhead': 8,
            'num_layers': 6,
            'dim_feedforward': 2048,
            'dropout': 0.1,
        }
        print("  Using default model config")
    
    # Create model
    model = create_model(model_config)
    
    # Handle torch.compile() prefix
    state_dict = checkpoint['model_state_dict']
    if any(k.startswith('_orig_mod.') for k in state_dict.keys()):
        print("  Detected torch.compile() checkpoint, removing _orig_mod prefix...")
        state_dict = {k.replace('_orig_mod.', ''): v for k, v in state_dict.items()}
    
    model.load_state_dict(state_dict)
    model.to(device)
    model.eval()
    
    if 'epoch' in checkpoint:
        print(f"  Checkpoint epoch: {checkpoint['epoch']}")
    if 'best_val_accuracy' in checkpoint:
        print(f"  Best validation accuracy: {checkpoint['best_val_accuracy']:.4f}")
    
    print(f"  ✓ Model loaded successfully")
    
    return model, model_config


def main():
    parser = argparse.ArgumentParser(description='Validate poker transformer with visualizations')
    
    parser.add_argument('--checkpoint', type=str, required=True,
                       help='Path to model checkpoint')
    parser.add_argument('--test-data', type=str, required=True,
                       help='Path to test NPZ dataset')
    parser.add_argument('--batch-size', type=int, default=256,
                       help='Batch size for evaluation')
    parser.add_argument('--device', type=str, 
                       default='cuda' if torch.cuda.is_available() else 'cpu',
                       help='Device to use')
    parser.add_argument('--output-dir', type=str, default='validation_results',
                       help='Directory to save visualizations and analysis')
    parser.add_argument('--num-workers', type=int, default=0,
                       help='DataLoader workers')
    
    args = parser.parse_args()
    
    print("="*80)
    print("MODEL VALIDATION WITH VISUALIZATIONS")
    print("="*80)
    print(f"Checkpoint:  {args.checkpoint}")
    print(f"Test Data:   {args.test_data}")
    print(f"Device:      {args.device}")
    print(f"Output Dir:  {args.output_dir}")
    print("="*80)
    
    # Load checkpoint
    try:
        model, model_config = load_checkpoint(args.checkpoint, args.device)
    except Exception as e:
        print(f"\nError loading checkpoint: {e}")
        return 1
    
    # Create loss function
    criterion = PokerLoss(
        action_weight=1.0,
        value_weight=0.2,
        use_class_weights=False,
        use_outcome_weighting=True,
    )
    criterion = criterion.to(args.device)
    
    # Create validator
    validator = ModelValidator(model, criterion, args.device, args.output_dir)
    
    # Load test dataset
    print(f"\nLoading test dataset: {args.test_data}")
    test_dataset = PluribusPokerDataset(args.test_data, preload=True)
    test_loader = DataLoader(
        test_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=args.num_workers,
        pin_memory=True if args.device == 'cuda' else False,
    )
    
    print(f"  Loaded {test_dataset.num_examples:,} examples")
    print(f"  Batches: {len(test_loader)}")
    
    # Validate
    metrics = validator.validate(test_loader, "Test")
    
    print("\n✓ Validation complete!")
    if args.output_dir:
        print(f"✓ Results saved to {args.output_dir}/")
    
    return 0


if __name__ == '__main__':
    import sys
    sys.exit(main())
