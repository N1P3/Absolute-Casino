# Poker Transformer AI

Transformer-based poker AI trained on poker hand histories (ACPC 2017, Pluribus, handhq, WSOP datasets). The model learns betting patterns from action sequences through self-attention and multi-task learning to predict discrete actions and continuous bet sizes.

This README provides quick setup, training, evaluation, inference, data format details, and troubleshooting steps for working with the project.

---

## Table of Contents

- Quickstart
- Dataset & Data Format
- Project Structure & Key Files
- Training (Supervised & RL)
- Inference & Evaluation
- Debugging & Troubleshooting
- Performance & Scaling Notes
- Contributing & Testing
- Appendix: Useful Commands

---

## Quickstart

1. Create and activate a Python virtual environment:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Install dependencies:

```powershell
pip install -r requirements.txt
```

3. Train (CPU):

```powershell
python train.py --dataset acpc_2017_filterd.npz --epochs 20
```

4. Train with GPU and mixed precision (if CUDA available):

```powershell
python train.py --dataset acpc_2017_filterd.npz --epochs 20 --device cuda --use-amp
```

5. Run inference (interactive):

```powershell
python inference.py --checkpoint checkpoints/best_model.pt --interactive
```

---

## Dataset & Data Format

The repository uses NPZ (NumPy `.npz`) for fast preload into RAM, and HDF5 (`.h5`) is used where lazy loading is desired.

Typical datasets in this repo:

- `acpc_2017_filterd.npz`
- `acpc2.npz`
- `combined_all.npz`, `combined2.npz`
- `pluribus2.npz`, `handhq2.npz`, `test_handhq.npz`, `test_pluribus.npz`

NPZ schema expected (see `preprocess_rust/DATASET_FORMAT.md` and `dataset.py` for details):

- `static_states`: (N, 375) — hole cards, board, stacks, pot, street
- `action_sequences`: (N, 20, 10) — sequence of previous actions (player, action type, amount)
- `target_actions`: (N, 2) — [action_type (0=fold,1=call,2=raise), raise_amount]
- `outcomes`: (N,) — final profit/loss in chips (optional)

Action vector encoding:

- `[player_one_hot(6), action_type_one_hot(3), amount(1)]`
- Amount is pot-relative (0.0 for fold/call), fractional value indicating relative bet size.
- Padding: All-zero vectors for unused timesteps.

Use `dataset.py` and `dataset.create_dataloaders` for loading/inspection.

---

## Project Structure & Key Files

- `dataset.py` — Dataloader and dataset classes.
- `model.py` — Model architecture, loss classes, and factory function `create_model()`.
- `train.py` — Supervised training script and CLI.
- `train_rl_pokerkit.py` — RL / self-play training scripts using policy gradient methods.
- `train_deep_cfr.py`, `train_mcts_pokerkit.py` — alternative solvers & training scripts.
- `inference.py` — Inference engine and utilities for checkpoint loading and prediction.
- `demo_inference.py` — Minimal demo script for quick tests.
- `validate_model.py` — Validation and evaluation script.
- `compare_models.py` — Tools for comparing checkpoint outputs.
- `merge_datasets.py` — Utilities for merging datasets and sanity checks.
- `preprocess_rust/` — Rust preprocessor which converts PHH text files to NPZ (fast preprocessing).
- `runs/`, `runs_rl/` — TensorBoard runs / logs.
- `checkpoints/` and `checkpoints_*` — Model checkpoints and `config.json` files.

---

## Training (Supervised & RL)

Supervised training basics (see `train.py` for flags):

```powershell
python train.py --dataset acpc_2017_filterd.npz --epochs 20 --device cuda --use-amp
```

Key CLI flags:

- `--dataset`: Path to NPZ or HDF5 dataset
- `--device`: `cpu` or `cuda`
- `--use-amp`: Enable mixed precision training (float16)
- `--batch-size`, `--d-model`, `--num-layers`
- `--resume` / `--checkpoint` for resuming from saved state

Model creation is centralized via `model.create_model()`. Checkpoint config JSON files (`checkpoints/config.json`) are used to reinstantiate exact model architecture.

RL fine-tuning (self-play / REINFORCE style) example:

```powershell
python train_rl_pokerkit.py --checkpoint checkpoints_big_2/best_model.pt --episodes 50000 --device cuda
```

- RL training uses same architecture, adds policy gradient updates and environment simulation.
- Use `--resume` to continue an RL run.

---

## Model & Loss Recipe

The model uses a multi-task loss composed of:

- Cross-entropy for action classification (fold/call/raise)
- Regression MSE (or MAE) for raise amount prediction

Loss formula:

Loss_total = action_weight _ CrossEntropy(action_logits, target_action) + value_weight _ MSE(value_pred, target_value)

Default weights can be found in `model.PokerLoss`.

---

## Inference & Evaluation

Interactive inference:

```powershell
python inference.py --checkpoint checkpoints/best_model.pt --interactive --temperature 0.5
```

Other evaluation tools:

- `demo_inference.py` — local demo script for quick checks
- `validate_model.py` — runs validation metrics on test datasets
- `compare_models.py` — compare two checkpoint performance trajectories
- `tensorboard --logdir runs` — visualize training metrics

Key inference options:

- `--temperature`: Sampling temperature for action probabilities (0.5 more confident, 2.0 more exploratory)
- `--batch-file`: Batch predictions on multiple hands

---

## Debugging & Troubleshooting

Common pitfalls and solutions:

- NPZ preload loads dataset into RAM: use HDF5 for very large datasets (>5GB)
- Windows `num_workers`: set `num_workers=0` (h5py handles), use `num_workers>0` on Linux to speed up data loading
- GPU OOM: reduce `--batch-size` or `--d-model`, enable `--use-amp` to save memory
- Architecture mismatch with a checkpoint: check `checkpoints/config.json` and reconstruct model using `model.create_model()` params or delete incompatible checkpoints

Quick data inspection:

```powershell
python -c "import numpy as np; d=np.load('acpc_2017_filterd.npz'); print(list(d.keys())); print('Examples:', d['static_states'].shape[0])"
```

Export samples to CSV or inspect `poker_samples.csv` to confirm data format and sanity check.

---

## Performance & Scaling Notes

- Using NPZ preloading reduces training I/O by keeping dataset in RAM — beneficial for training speed at the cost of memory.
- For large datasets, prefer HDF5 + lazy loading with `preload=False`.
- GPU speedups: mixed precision (`--use-amp`) and larger batch sizes if VRAM allows.
- VRAM estimate (approx): model bytes + batch_size × 20 × d_model × 4 bytes (per-batch attention costs).

---

## Contributing & Testing

- Add a `tests/` folder with dataset/core model forward pass tests.
- Keep `checkpoints/config.json` consistent when changing model hyperparameters.
- Provide new dataset format descriptions in `preprocess_rust/DATASET_FORMAT.md`.
- Add CI (GitHub Actions) to run minimal tests: linting and quick forward pass checks.

---

## Appendix: Useful Commands

```powershell
# Build rust preprocessor once
cd preprocess_rust; cargo build --release; cd ..

# Preprocess dataset with Rust tool
.\preprocess_rust\target\release\poker_preprocess.exe --dataset dataset/pluribus --output poker_pluribus.npz

# Monitor training
tensorboard --logdir runs

# Run inference
python inference.py --checkpoint checkpoints/best_model.pt --interactive

# Validate model
python validate_model.py --dataset test_pluribus.npz --checkpoint checkpoints/best_model.pt
```

---

If you'd like, I can also:

- Add a ready-to-use `WORKFLOW.md` with training and RL presets.
- Add a minimal `tests/` skeleton that validates dataset loading and a model forward pass.
- Add GitHub Actions CI templates for basic linting and model forward pass tests.

---

License / Attribution

Please ensure you follow license terms for any datasets used (ACPC, Pluribus, handhq, etc.). This repository is provided without warranty; see project policy files if included.
