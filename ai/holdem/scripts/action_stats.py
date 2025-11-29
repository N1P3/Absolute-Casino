"""
action_stats.py

Compute action distribution percentages for NPZ datasets used in this repo.

Usage:
  python scripts/action_stats.py path/to/dataset.npz [--sequences]

By default the script tries to read the `target_actions` array (N, 2) where column 0 is action type (0=fold,1=call,2=raise).
If `--sequences` is passed (or action_sequences is present and --auto), also compute distribution across historical action sequences.

Outputs an easy-to-read breakdown of counts and percentages.

"""

from __future__ import annotations
import argparse
import os
from collections import Counter

import numpy as np


ACTION_LABELS = {0: 'fold', 1: 'call', 2: 'raise'}


def percent_fmt(count, total):
    if total == 0:
        return '0.00%'
    return f"{count/total*100:0.2f}%"


def analyze_target_actions(arr: np.ndarray):
    # arr can be shape (N,), (N,1) or (N,2) where first column is action type
    if arr.ndim == 2 and arr.shape[1] >= 1:
        types = arr[:, 0]
    elif arr.ndim == 1:
        types = arr
    else:
        # fallback: flatten then take first column
        types = arr.reshape(len(arr), -1)[:, 0]

    # Normalize to int
    types_int = types.astype(int)
    counts = Counter(types_int.tolist())
    total = len(types_int)
    result = {ACTION_LABELS.get(k, str(k)): (counts.get(k, 0), percent_fmt(counts.get(k, 0), total)) for k in sorted(counts.keys())}
    # Ensure all expected labels present with 0 counts if absent
    for code in ACTION_LABELS:
        label = ACTION_LABELS[code]
        if label not in result:
            result[label] = (0, percent_fmt(0, total))
    return total, counts, result


def analyze_action_sequences(arr: np.ndarray):
    # arr shape: (N, seq_len, 10)
    if arr.ndim != 3 or arr.shape[-1] < 9:
        raise ValueError('action_sequences array should have shape (N, seq_len, 10)')

    # Determine padding timestep (all zeros)
    valid_mask = arr.sum(axis=-1) != 0  # [N, seq_len]

    # action_type is a one-hot 3 dims inside the 10 dims: [player(6), action(3), amount(1)]
    # action indices: 6,7,8
    action_type_slice = arr[..., 6:9]

    # compute argmax for action types, but only where valid_mask==True
    # Flatten valid entries
    action_type_flat = action_type_slice[valid_mask]
    if action_type_flat.size == 0:
        total = 0
        counts = Counter()
        result = {label: (0, '0.00%') for label in ACTION_LABELS.values()}
        return total, counts, result

    types_int = np.argmax(action_type_flat, axis=-1).astype(int)
    counts = Counter(types_int.tolist())
    total = len(types_int)
    result = {ACTION_LABELS.get(k, str(k)): (counts.get(k, 0), percent_fmt(counts.get(k, 0), total)) for k in sorted(counts.keys())}
    for code in ACTION_LABELS:
        label = ACTION_LABELS[code]
        if label not in result:
            result[label] = (0, percent_fmt(0, total))
    return total, counts, result


def print_summary(file_path: str, target_result, seq_result=None):
    print(f"\nFile: {file_path}")
    if target_result is not None:
        total, counts, result = target_result
        print(f"  Target Actions: total examples: {total}")
        for k in sorted(ACTION_LABELS.keys()):
            label = ACTION_LABELS[k]
            cnt, pct = result[label]
            print(f"    {label:6}: {cnt:8} ({pct})")

    if seq_result is not None:
        total, counts, result = seq_result
        print(f"  Action Sequences: total actions (all timesteps, excluding padding): {total}")
        for k in sorted(ACTION_LABELS.keys()):
            label = ACTION_LABELS[k]
            cnt, pct = result[label]
            print(f"    {label:6}: {cnt:8} ({pct})")


def main():
    parser = argparse.ArgumentParser(description='Analyze action type distribution in NPZ dataset(s)')
    parser.add_argument('paths', nargs='+', help='NPZ dataset file(s). Can be a directory or list of files')
    parser.add_argument('--sequences', action='store_true', help='Also analyze action_sequences (counts over all timesteps)')
    parser.add_argument('--auto-sequences', action='store_true', help='Analyze sequences if the dataset has `action_sequences` key (without forcing `--sequences`)')
    parser.add_argument('--key', default='target_actions', help='Key in the NPZ containing target actions (default: target_actions)')
    parser.add_argument('--seq-key', default='action_sequences', help='Key in NPZ for action sequences (default: action_sequences)')

    args = parser.parse_args()

    file_list = []
    for p in args.paths:
        if os.path.isdir(p):
            file_list.extend([os.path.join(p, f) for f in os.listdir(p) if f.endswith('.npz')])
        else:
            file_list.append(p)

    for f in file_list:
        if not os.path.exists(f):
            print(f"Skipping missing file: {f}")
            continue
        try:
            npz = np.load(f)
        except Exception as e:
            print(f"Failed loading {f}: {e}")
            continue

        target_result = None
        seq_result = None

        if args.key in npz:
            try:
                arr = npz[args.key]
                total, counts, result = analyze_target_actions(arr)
                target_result = (total, counts, result)
            except Exception as e:
                print(f"Error parsing {args.key} in {f}: {e}")

        if args.sequences or (args.auto_sequences and args.seq_key in npz):
            if args.seq_key in npz:
                try:
                    arr = npz[args.seq_key]
                    total, counts, result = analyze_action_sequences(arr)
                    seq_result = (total, counts, result)
                except Exception as e:
                    print(f"Error parsing {args.seq_key} in {f}: {e}")
            else:
                print(f"No `{args.seq_key}` key in {f}")

        print_summary(f, target_result, seq_result)
        npz.close()


if __name__ == '__main__':
    main()
