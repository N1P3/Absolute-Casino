# Poker Dataset Format

## NPZ Output Structure

The preprocessor generates a compressed NumPy archive (`.npz` file) containing four arrays plus metadata.

### Arrays

#### 1. `static_states.npy`

**Shape**: `(num_examples, static_state_size)`  
**Type**: `float32`  
**Size**: `static_state_size = 25` (4 + 10 + 6 + 1 + 4)

Encodes the poker state at each decision point using **efficient rank-suit decomposition**:

- **Hole cards** (4 floats): Rank and suit for 2 cards
  - Card 1 rank (0-12 normalized to [0,1]): 2,3,4,5,6,7,8,9,T,J,Q,K,A
  - Card 1 suit (0-3 normalized to [0,1]): clubs, diamonds, hearts, spades
  - Card 2 rank (normalized)
  - Card 2 suit (normalized)
- **Board cards** (10 floats): Rank and suit for up to 5 board cards
  - Flop card 1: rank, suit
  - Flop card 2: rank, suit
  - Flop card 3: rank, suit
  - Turn card: rank, suit
  - River card: rank, suit
  - (Zeros for cards not yet dealt)
- **Relative positions** (6 floats): Normalized stack sizes by relative seat position
- **Pot size** (1 float): Total pot normalized by starting stack
- **Street** (4 floats): One-hot encoding [preflop, flop, turn, river]

**Note**: This encoding is **26x more efficient** than one-hot card encoding (previous: 364 features → now: 14 features) while preserving all information. Ranks and suits are normalized to [0,1] range for better neural network learning.

#### 2. `action_sequences.npy`

**Shape**: `(num_examples, MAX_ACTIONS_PER_STREET, ACTION_VEC_LEN)`  
**Default**: `(num_examples, 20, 10)`  
**Type**: `float32`

Sequence of actions taken in the current betting round (street):

Each action (10 floats):

- **Player position** (6 floats): One-hot encoding of which player acted
- **Action type** (3 floats): One-hot [fold, check/call, bet/raise]
- **Amount** (1 float): Bet/raise amount normalized by pot size

**Padding**: Sequences shorter than 20 actions are zero-padded.

#### 3. `target_actions.npy`

**Shape**: `(num_examples, 2)`  
**Type**: `float32`

The action the model should learn to predict:

- **Action type** (1 float): 0.0 = fold, 1.0 = check/call, 2.0 = bet/raise
- **Amount** (1 float): Raise size normalized by pot (0.0 for fold/call)

#### 4. `outcomes.npy`

**Shape**: `(num_examples,)`  
**Type**: `float32`

Profit/loss for the acting player at this decision, measured in big blinds.

- Positive = won chips
- Negative = lost chips
- Used for training value heads or reinforcement learning

#### 5. `metadata.json`

**Type**: JSON string

```json
{
  "num_hands": 12500,
  "num_examples": 487320,
  "num_files": 250
}
```

---

## CSV Equivalent Structure

If this data were stored in CSV format, it would look like:

### Main Table: `poker_decisions.csv`

```csv
example_id,hole_card_1_rank,hole_card_1_suit,hole_card_2_rank,hole_card_2_suit,board_1_rank,board_1_suit,board_2_rank,board_2_suit,board_3_rank,board_3_suit,board_4_rank,board_4_suit,board_5_rank,board_5_suit,player_0_stack,player_1_stack,player_2_stack,player_3_stack,player_4_stack,player_5_stack,pot_size,street,action_history,action_type,action_amount,outcome
0,12,2,11,3,3,2,4,1,5,0,0,0,0,0,0.95,1.02,0.88,1.15,0.00,0.00,0.15,flop,"p1:cc,p2:cbr:0.5",cbr,0.75,-2.5
1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1.00,0.98,1.02,0.00,0.00,0.00,0.03,preflop,"",f,0.0,0.0
2,11,2,10,2,7,3,1,1,6,0,12,2,0,0,0.85,1.20,0.95,0.00,0.00,0.00,0.45,turn,"p0:cc,p1:cbr:1.0,p0:cc",cc,0.0,5.2
...
```

**Note**: Card ranks are 0-12 (2=0, 3=1, ..., K=11, A=12). Suits are 0-3 (clubs=0, diamonds=1, hearts=2, spades=3).

### Column Descriptions

| Column              | Type   | Description                                                     |
| ------------------- | ------ | --------------------------------------------------------------- |
| `example_id`        | int    | Unique identifier for each decision point                       |
| `hole_card_1_rank`  | float  | First hole card rank (0-12, normalized to [0,1])                |
| `hole_card_1_suit`  | float  | First hole card suit (0-3, normalized to [0,1])                 |
| `hole_card_2_rank`  | float  | Second hole card rank (0-12, normalized to [0,1])               |
| `hole_card_2_suit`  | float  | Second hole card suit (0-3, normalized to [0,1])                |
| `board_1..5_rank`   | float  | Board card ranks (0.0 if not dealt yet)                         |
| `board_1..5_suit`   | float  | Board card suits (0.0 if not dealt yet)                         |
| `player_0..5_stack` | float  | Normalized stack for each player (0.0 if not in hand)           |
| `pot_size`          | float  | Current pot size (normalized)                                   |
| `street`            | string | "preflop", "flop", "turn", or "river"                           |
| `action_history`    | string | Sequence of actions this street (e.g., "p1:cc,p2:cbr:0.5")      |
| `action_type`       | string | Target action: "f" (fold), "cc" (check/call), "cbr" (bet/raise) |
| `action_amount`     | float  | Target raise amount (normalized by pot)                         |
| `outcome`           | float  | Profit/loss in big blinds for acting player                     |

### Action History Format

Actions encoded as `pN:action:amount` where:

- `N` = player index (0-5)
- `action` = `f` (fold), `cc` (check/call), `cbr` (bet/raise)
- `amount` = bet amount (only for `cbr`)

Examples:

- `"p0:cc"` = Player 0 checks/calls
- `"p1:cbr:0.75"` = Player 1 raises to 0.75× pot
- `"p2:f"` = Player 2 folds

---

## Why NPZ Instead of CSV?

### Storage Efficiency

- **NPZ (compressed)**: ~2-5 GB for 500k examples
- **CSV**: ~20-30 GB for same data (10x larger)

### Loading Speed

- **NPZ**: Direct memory mapping, instant array access
- **CSV**: Must parse strings, convert types (100x slower)

### Compatibility

- **NPZ**: Native NumPy format, works with PyTorch/TensorFlow
- **CSV**: Requires pandas → numpy conversion

### Precision

- **NPZ**: Binary float32 (exact)
- **CSV**: Text representation, potential rounding errors

---

## Loading the NPZ in Python

```python
import numpy as np

# Load the dataset
data = np.load('poker_transformer_acpc_rust.npz')

static_states = data['static_states']      # (N, 25)
action_sequences = data['action_sequences']  # (N, 20, 10)
target_actions = data['target_actions']     # (N, 2)
outcomes = data['outcomes']                 # (N,)

print(f"Loaded {len(static_states)} training examples")
```

## Converting to CSV (if needed)

```python
import numpy as np
import pandas as pd

data = np.load('poker_transformer_acpc_rust.npz')

# Flatten arrays for CSV
df = pd.DataFrame({
    'example_id': range(len(data['static_states'])),
    'action_type': data['target_actions'][:, 0],
    'action_amount': data['target_actions'][:, 1],
    'outcome': data['outcomes'],
})

# Add static state features (simplified)
for i in range(data['static_states'].shape[1]):
    df[f'state_{i}'] = data['static_states'][:, i]

df.to_csv('poker_decisions.csv', index=False)
```

**Warning**: CSV will be very large (~10-20x NPZ size)!
