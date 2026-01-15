# Poker Transformer AI

Sztuczna inteligencja do gry w pokera Texas Hold'em oparta na architekturze Transformer. Model został wytrenowany dwuetapowo: najpierw metodą nadzorowaną (supervised learning) na historiach rozgrywek profesjonalnych graczy, a następnie za pomocą uczenia przez wzmacnianie (reinforcement learning) z użyciem algorytmu PPO (Proximal Policy Optimization).

---

## Spis Treści

1. [Opis Projektu](#opis-projektu)
2. [Architektura Modelu](#architektura-modelu)
3. [Struktura Danych](#struktura-danych)
4. [Pipeline Treningowy](#pipeline-treningowy)
   - [Etap 1: Preprocessing Danych (Rust)](#etap-1-preprocessing-danych-rust)
   - [Etap 2: Łączenie Datasetów](#etap-2-łączenie-datasetów)
   - [Etap 3: Trening Nadzorowany](#etap-3-trening-nadzorowany)
   - [Etap 4: Trening RL (Self-Play)](#etap-4-trening-rl-self-play)
5. [Struktura Projektu](#struktura-projektu)
6. [Wymagania Systemowe](#wymagania-systemowe)
7. [Instrukcja Uruchomienia](#instrukcja-uruchomienia)
8. [Inferencja i Ewaluacja](#inferencja-i-ewaluacja)
9. [Eksport do ONNX](#eksport-do-onnx)
10. [Szczegóły Techniczne](#szczegóły-techniczne)
11. [Wyniki i Metryki](#wyniki-i-metryki)

---

## Opis Projektu

Projekt stanowi implementację systemu AI do gry w No-Limit Texas Hold'em opartego na nowoczesnej architekturze sieci neuronowych. System wykorzystuje:

- **Transformer** jako główną architekturę — umożliwia modelowanie sekwencji akcji licytacyjnych z uwzględnieniem kontekstu
- **Multi-task learning** — model jednocześnie przewiduje typ akcji (fold/call/raise) oraz wysokość zakładu
- **Uczenie dwuetapowe** — najpierw supervised learning na danych ekspertów, następnie RL przez self-play
- **Bibliotekę PokerKit** — do symulacji gier podczas treningu RL

### Źródła Danych

Model został wytrenowany na trzech zbiorach danych zawierających historie rozgrywek:

1. **ACPC 2017** — Annual Computer Poker Competition, rozgrywki botów pokerowych
2. **HandHQ** — profesjonalne rozgrywki heads-up z pokazanymi kartami (showdown hands)
3. **Pluribus** — rozgrywki AI od Facebook Research, mistrzowski poziom gry

Łącznie przetworzono setki tysięcy rąk pokerowych, co stanowi podstawę do nauki wzorców licytacyjnych.

---

## Architektura Modelu

### PluribusPokerTransformer

Model składa się z następujących komponentów:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PluribusPokerTransformer                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                 STATIC STATE ENCODER                     │   │
│  │  • Karty gracza (2) + karty wspólne (5) → Embeddingi    │   │
│  │  • Rank Embedding (13 rang → 8-dim)                     │   │
│  │  • Suit Embedding (4 kolory → 8-dim)                    │   │
│  │  • Position + Stage Embedding                            │   │
│  │  • Scalar Encoder (stacki, pot, ulica)                  │   │
│  │  • Static Transformer (2 warstwy)                       │   │
│  │  • Token CLS → static_features                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │               ACTION SEQUENCE ENCODER                    │   │
│  │  • Historia akcji (max 20) → Linear Projection          │   │
│  │  • Positional Encoding (sinusoidalne)                   │   │
│  │  • Transformer Encoder (6 warstw)                       │   │
│  │  • Token CLS → action_features                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                              ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                     FUSION LAYER                         │   │
│  │  Concatenate(static_features, action_features)           │   │
│  │  → Linear(d_model*2, d_model) → LayerNorm → GELU        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│                    ┌─────────┴─────────┐                       │
│                    ▼                   ▼                        │
│  ┌────────────────────────┐  ┌────────────────────────┐       │
│  │     ACTION HEAD        │  │      VALUE HEAD        │       │
│  │  Linear → GELU →       │  │  Linear → GELU →       │       │
│  │  Linear → [3]          │  │  Linear → [1]          │       │
│  │  (fold/call/raise)     │  │  (log raise amount)    │       │
│  └────────────────────────┘  └────────────────────────┘       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Parametry Domyślne Modelu

| Parametr            | Wartość | Opis                                     |
| ------------------- | ------- | ---------------------------------------- |
| `d_model`           | 512     | Wymiar reprezentacji wewnętrznej         |
| `nhead`             | 8       | Liczba głowic attention                  |
| `num_layers`        | 6       | Warstwy transformera dla sekwencji akcji |
| `static_num_layers` | 2       | Warstwy transformera dla kart            |
| `dim_feedforward`   | 2048    | Wymiar warstw Feed-Forward               |
| `dropout`           | 0.1     | Regularyzacja dropout                    |

**Całkowita liczba parametrów:** ~28 milionów (~112 MB w fp32)

### Enkodowanie Kart

Karty są reprezentowane jako indeksy 0-51:

- **Indeks karty** = `rank * 4 + suit`
- **Rank:** 0-12 (2, 3, 4, 5, 6, 7, 8, 9, T, J, Q, K, A)
- **Suit:** 0-3 (clubs, diamonds, hearts, spades)
- **Nieznana karta:** indeks 52 (UNKNOWN_CARD)

Każda karta jest zamieniana na embedding 16-wymiarowy (8 dla rangi + 8 dla koloru), a następnie projektowana do przestrzeni `d_model`.

---

## Struktura Danych

### Format NPZ

Dane treningowe są przechowywane w formacie NumPy `.npz`, który umożliwia szybkie ładowanie do pamięci RAM.

#### Schemat Danych

```python
{
    'static_states':     np.ndarray[N, 18],      # Stan statyczny
    'action_sequences':  np.ndarray[N, 20, 10],  # Sekwencja akcji
    'target_actions':    np.ndarray[N, 2],       # Cel: [typ akcji, wysokość]
    'outcomes':          np.ndarray[N],          # Wynik ręki (profit/loss)
}
```

Gdzie `N` to liczba przykładów (punktów decyzyjnych) w datasecie.

#### Static State (18 cech)

| Indeks | Opis                                         | Zakres   |
| ------ | -------------------------------------------- | -------- |
| 0-1    | ID kart gracza (hole cards)                  | 0-52     |
| 2-6    | ID kart wspólnych (board)                    | 0-52     |
| 7-12   | Stacki wszystkich graczy (znormalizowane)    | 0.0-1.0  |
| 13     | Pot (znormalizowany względem starting stack) | 0.0-1.0+ |
| 14-17  | Ulica (one-hot: preflop/flop/turn/river)     | 0/1      |

#### Action Sequence (20 × 10 cech)

Każda akcja w sekwencji jest zakodowana jako wektor 10-wymiarowy:

| Indeks | Opis                                           |
| ------ | ---------------------------------------------- |
| 0-5    | Gracz wykonujący akcję (one-hot, max 6 graczy) |
| 6-8    | Typ akcji (one-hot: fold=0, call=1, raise=2)   |
| 9      | Wysokość zakładu (względem pota)               |

Sekwencja jest paddowana zerami dla pustych miejsc.

#### Target Actions

| Indeks | Opis                                           |
| ------ | ---------------------------------------------- |
| 0      | Typ akcji: 0=fold, 1=call, 2=raise             |
| 1      | Wysokość raise (mnożnik pota), 0 dla fold/call |

---

## Pipeline Treningowy

Pipeline treningowy składa się z 4 głównych etapów:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE TRENINGOWY                           │
└─────────────────────────────────────────────────────────────────────────┘

      ETAP 1                ETAP 2              ETAP 3              ETAP 4
  Preprocessing          Merge Datasets     Supervised            RL Training
      (Rust)               (Python)          Training              (Self-Play)
                                             (Python)               (Python)

┌─────────────┐         ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ ACPC 2017   │         │             │    │             │    │             │
│  (.phhs)    │────────▶│             │    │             │    │             │
│             │         │             │    │             │    │             │
├─────────────┤  .npz   │   merge_    │    │  train.py   │    │train_rl_    │
│ HandHQ      │────────▶│ datasets.py │───▶│             │───▶│pokerkit.py  │
│  (.phhs)    │         │             │    │ (CrossEnt + │    │             │
│             │         │             │    │  MSE Loss)  │    │ (PPO)       │
├─────────────┤         │             │    │             │    │             │
│ Pluribus    │────────▶│             │    │             │    │             │
│  (.phh)     │         │             │    │             │    │             │
└─────────────┘         └─────────────┘    └─────────────┘    └─────────────┘
       │                      │                  │                  │
       ▼                      ▼                  ▼                  ▼
  acpc.npz                combined.npz    best_model.pt      best_model_rl.pt
  handhq.npz
  pluribus.npz
```

---

### Etap 1: Preprocessing Danych (Rust)

Preprocessing jest wykonywany w języku **Rust** dla maksymalnej wydajności przetwarzania dużych plików tekstowych z historiami rąk.

#### Dlaczego Rust?

- **Wydajność:** 10-100× szybsze parsowanie niż Python
- **Równoległość:** Natywna obsługa wielowątkowości (Rayon)
- **Niezawodność:** Brak błędów pamięci, bezpieczny kod

#### Lokalizacja Kodu

```
preprocess_rust/
├── Cargo.toml                     # Konfiguracja projektu Rust
├── src/
│   ├── lib.rs                     # Wspólne funkcje (parsowanie kart)
│   └── bin/
│       ├── preprocess_acpc.rs     # Preprocessor dla ACPC 2017
│       ├── preprocess_handhq.rs   # Preprocessor dla HandHQ
│       └── preprocess_pluribus.rs # Preprocessor dla Pluribus
```

#### Kompilacja

```powershell
cd preprocess_rust
cargo build --release
```

Kompilacja z opcją `--release` włącza optymalizacje:

- Link-Time Optimization (LTO)
- Optymalizacja poziomu 3 (`opt-level = 3`)
- Pojedyncza jednostka kompilacji (`codegen-units = 1`)

#### Uruchomienie Preprocessorów

Każdy dataset ma dedykowany preprocessor z powodu różnic w formatach plików:

```powershell
# ACPC 2017 (format: .phhs z wieloma rękami w pliku)
cargo run --release --bin preprocess_acpc -- `
    --dataset "dataset/acpc_2017/" `
    --output "acpc_2017.npz" `
    --max-hands 1000

# HandHQ (format: .phhs z rękami showdown)
cargo run --release --bin preprocess_handhq -- `
    --dataset "dataset/handhq/" `
    --output "handhq.npz" `
    --max-hands 10000

# Pluribus (format: jeden plik .phh na rękę)
cargo run --release --bin preprocess_pluribus -- `
    --dataset "dataset/pluribus/" `
    --output "pluribus.npz" `
    --max-files 0  # 0 = przetwórz wszystkie pliki
```

#### Szczegóły Implementacji

##### lib.rs - Wspólne Funkcje

```rust
// Stałe definiujące strukturę danych
pub const MAX_ACTIONS_PER_STREET: usize = 20;  // Max akcji do zapamiętania
pub const MAX_PLAYERS: usize = 6;               // Max graczy przy stole
pub const NUM_CARDS: usize = 52;                // Standardowa talia
pub const UNKNOWN_CARD: usize = 52;             // Sentinel dla nieznanej karty
pub const ACTION_VEC_LEN: usize = 10;           // Wymiar wektora akcji

/// Konwersja karty tekstowej na indeks 0-51
/// Przykłady: "Ah" → 50, "2c" → 0, "Td" → 33
pub fn card_to_int(card_str: &str) -> usize {
    let rank_char = card_str.chars().nth(0).unwrap();
    let suit_char = card_str.chars().nth(1).unwrap();

    let rank = match rank_char {
        '2' => 0, '3' => 1, '4' => 2, '5' => 3, '6' => 4,
        '7' => 5, '8' => 6, '9' => 7, 'T' => 8, 'J' => 9,
        'Q' => 10, 'K' => 11, 'A' => 12,
        _ => return UNKNOWN_CARD,
    };

    let suit = match suit_char {
        'c' => 0, 'd' => 1, 'h' => 2, 's' => 3,
        _ => return UNKNOWN_CARD,
    };

    rank * 4 + suit
}
```

##### Struktura Stanu Gry (PokerState)

Każdy preprocessor implementuje symulator stanu gry:

```rust
struct PokerState {
    stacks: Vec<u32>,        // Aktualne stacki graczy
    bets: Vec<u32>,          // Zakłady w obecnej ulicy
    total_pot: u32,          // Łączny pot
    hole_cards: Vec<Vec<u8>>, // Karty graczy [gracz][karta]
    board_cards: Vec<u8>,    // Karty wspólne
    street_index: usize,     // 0=preflop, 1=flop, 2=turn, 3=river
    actor_index: Option<usize>, // Kto teraz gra
    num_players: usize,
    folded: Vec<bool>,       // Kto sfoldował
}
```

##### Proces Przetwarzania

1. **Parsowanie TOML** — każda ręka jest w formacie TOML (PHH format)
2. **Odtworzenie gry** — symulacja krok po kroku z postowaniem blindów
3. **Ekstrakcja punktów decyzyjnych** — dla każdej decyzji gracza:
   - Zapisanie stanu gry (karty, stacki, pot, ulica)
   - Zapisanie historii akcji
   - Zapisanie wykonywanej akcji (cel)
   - Zapisanie wyniku ręki (outcome)
4. **Zapis do ndarray** — konwersja na tablice NumPy
5. **Kompresja NPZ** — zapis w formacie `.npz`

---

### Etap 2: Łączenie Datasetów

Skrypt `merge_datasets.py` łączy wiele plików NPZ w jeden zunifikowany dataset.

#### Uruchomienie

```powershell
python merge_datasets.py `
    --datasets acpc_2017.npz handhq.npz pluribus.npz `
    --output combined_all.npz
```

#### Parametry

| Parametr     | Opis                                               |
| ------------ | -------------------------------------------------- |
| `--datasets` | Lista plików NPZ do połączenia (oddzielone spacją) |
| `--output`   | Ścieżka wynikowego pliku NPZ                       |
| `--shuffle`  | Czy tasować dane po połączeniu (domyślnie: tak)    |

#### Proces Łączenia

```python
def merge_npz_datasets(dataset_paths, output_path, shuffle=True):
    """Łączenie datasetów NPZ."""

    all_static_states = []
    all_action_sequences = []
    all_target_actions = []
    all_outcomes = []

    for dataset_path in dataset_paths:
        data = np.load(dataset_path)

        # Weryfikacja zgodności wymiarów
        if all_static_states:
            assert data['static_states'].shape[1] == all_static_states[0].shape[1]

        all_static_states.append(data['static_states'])
        all_action_sequences.append(data['action_sequences'])
        all_target_actions.append(data['target_actions'])
        all_outcomes.append(data['outcomes'])

    # Konkatenacja
    static_states = np.concatenate(all_static_states, axis=0)
    action_sequences = np.concatenate(all_action_sequences, axis=0)
    target_actions = np.concatenate(all_target_actions, axis=0)
    outcomes = np.concatenate(all_outcomes, axis=0)

    # Tasowanie (ważne dla generalizacji!)
    if shuffle:
        indices = np.random.permutation(len(static_states))
        static_states = static_states[indices]
        action_sequences = action_sequences[indices]
        target_actions = target_actions[indices]
        outcomes = outcomes[indices]

    # Zapis skompresowany
    np.savez_compressed(output_path,
        static_states=static_states,
        action_sequences=action_sequences,
        target_actions=target_actions,
        outcomes=outcomes
    )
```

---

### Etap 3: Trening Nadzorowany

Główny skrypt treningowy: `train.py`

#### Uruchomienie

```powershell
# Podstawowy trening (CPU)
python train.py --dataset combined_all.npz --epochs 20

# Trening z GPU i mixed precision (zalecane)
python train.py `
    --dataset combined_all.npz `
    --epochs 20 `
    --device cuda `
    --use-amp `
    --batch-size 1024

# Pełna konfiguracja
python train.py `
    --dataset combined_all.npz `
    --epochs 20 `
    --device cuda `
    --use-amp `
    --batch-size 1024 `
    --d-model 512 `
    --num-layers 6 `
    --lr 1e-4 `
    --weight-decay 0.01 `
    --use-class-weights `
    --output-dir checkpoints
```

#### Parametry Treningowe

| Parametr              | Domyślnie  | Opis                                   |
| --------------------- | ---------- | -------------------------------------- |
| `--dataset`           | (wymagany) | Ścieżka do datasetu NPZ                |
| `--epochs`            | 20         | Liczba epok treningowych               |
| `--batch-size`        | 32         | Rozmiar batcha                         |
| `--lr`                | 1e-4       | Learning rate                          |
| `--weight-decay`      | 0.01       | Regularyzacja L2 (AdamW)               |
| `--device`            | auto       | `cuda` lub `cpu`                       |
| `--use-amp`           | False      | Mixed precision (fp16)                 |
| `--use-class-weights` | False      | Wagi klas dla niezbalansowanych danych |
| `--d-model`           | 512        | Wymiar modelu                          |
| `--num-layers`        | 6          | Liczba warstw transformera             |
| `--nhead`             | 8          | Liczba głowic attention                |

#### Funkcja Straty (PokerLoss)

Model jest trenowany z **multi-task loss**:

```
L_total = α × L_action + β × L_value

gdzie:
  L_action = CrossEntropyLoss(action_logits, target_action)
  L_value  = MSELoss(log(pred_raise), log(target_raise))  # tylko dla akcji raise

  α = 1.0  (action_weight)
  β = 0.2  (value_weight)
```

##### Outcome-Based Weighting

Model uczy się więcej z wygrywających decyzji:

```python
# Waga zależna od wyniku ręki
outcome_weight = sigmoid(outcome / temperature)
outcome_weight = 0.2 + 1.8 × outcome_weight  # zakres [0.2, 2.0]

# Ważona strata
loss = (per_sample_loss × outcome_weight).mean()
```

To sprawia, że model zwraca większą uwagę na decyzje prowadzące do wygranej.

#### Optymalizator i Scheduler

```python
# AdamW z weight decay
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=1e-4,
    weight_decay=0.01,
    betas=(0.9, 0.999),
)

# Redukcja LR gdy val_loss nie spada
scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
    optimizer,
    mode='min',
    factor=0.5,
    patience=3,
)
```

#### Checkpointy

Zapisywane w katalogu `checkpoints/`:

- `best_model.pt` — najlepszy model (wg balanced accuracy)
- `checkpoint_epoch_N.pt` — checkpoint co N epok
- `config.json` — pełna konfiguracja treningu i modelu

---

### Etap 4: Trening RL (Self-Play)

Skrypt: `train_rl_pokerkit.py`

Ten etap wykorzystuje algorytm **PPO (Proximal Policy Optimization)** do doskonalenia modelu przez grę sam ze sobą w realistycznym środowisku pokerowym.

#### Motywacja

Trening nadzorowany uczy model naśladować ekspertów, ale:

- Może nie generalizować do nowych sytuacji
- Nie eksploruje alternatywnych strategii
- Nie optymalizuje bezpośrednio nagrody (wygranej)

Trening RL rozwiązuje te problemy przez:

- Eksplorację różnych strategii
- Bezpośrednią optymalizację oczekiwanej wygranej
- Adaptację do własnego stylu gry (self-play)

#### Uruchomienie

```powershell
# Podstawowy trening RL
python train_rl_pokerkit.py `
    --checkpoint checkpoints/best_model.pt `
    --episodes 50000

# Pełna konfiguracja
python train_rl_pokerkit.py `
    --checkpoint checkpoints/best_model.pt `
    --episodes 50000 `
    --device cuda `
    --use-amp `
    --batch-size 20 `
    --lr 2e-5 `
    --clip-epsilon 0.25 `
    --entropy-coef 0.02 `
    --ppo-epochs 6 `
    --pool-size 5 `
    --temperature 1.2 `
    --randomize-stacks `
    --output-dir checkpoints_rl

# Wznowienie treningu
python train_rl_pokerkit.py `
    --checkpoint checkpoints/best_model.pt `
    --resume checkpoints_rl/checkpoint_episode_10000.pt `
    --episodes 50000
```

#### Parametry PPO

| Parametr         | Domyślnie | Opis                                  |
| ---------------- | --------- | ------------------------------------- |
| `--episodes`     | 50000     | Całkowita liczba epizodów (rąk)       |
| `--batch-size`   | 10        | Epizodów na update gradientu          |
| `--lr`           | 2e-5      | Learning rate (niższy niż supervised) |
| `--clip-epsilon` | 0.25      | Clipping ratio PPO                    |
| `--entropy-coef` | 0.02      | Współczynnik entropii (eksploracja)   |
| `--value-coef`   | 0.75      | Waga funkcji wartości                 |
| `--ppo-epochs`   | 6         | Epoki PPO na każdy batch              |
| `--target-kl`    | 0.02      | Cel KL-divergence (early stopping)    |
| `--gamma`        | 1.0       | Współczynnik dyskontowania            |
| `--gae-lambda`   | 0.95      | Lambda dla GAE                        |
| `--temperature`  | 1.2       | Temperatura sampowania akcji          |

#### Algorytm PPO

```
dla każdego batcha epizodów:
    1. Zbierz epizody przez self-play
    2. Oblicz advantages: A = R - V(s)  # nagrodę minus estymata wartości
    3. Dla każdej epoki PPO:
        a. Oblicz nowe log_probs dla akcji
        b. Oblicz ratio: r = exp(log_π_new - log_π_old)
        c. Clipped surrogate: L = min(r*A, clip(r, 1-ε, 1+ε)*A)
        d. Value loss: L_v = MSE(V(s), R)
        e. Entropy bonus: H = -Σ π*log(π)
        f. Total loss: L = -L_surr + c_v*L_v - c_e*H
        g. Gradient update
    4. Jeśli KL > target_kl: early stop epoch
```

#### Opponent Pool

Aby uniknąć overfittingu do jednego stylu gry, utrzymywana jest pula przeciwników:

```python
opponent_pool = deque(maxlen=5)  # Ostatnie 5 wersji modelu

# Podczas gry:
if random() < 0.15:
    opponent = RandomBaseline()  # 15% gier z losowym przeciwnikiem
else:
    opponent = random.choice(opponent_pool)  # 85% z puli

# Co 500 epizodów:
opponent_pool.append(clone(current_model))
```

#### Środowisko PokerKit

Klasa `PokerKitEnvironment` (plik `environment.py`) opakowuje bibliotekę PokerKit:

```python
env = PokerKitEnvironment(
    starting_stack=1000,      # Początkowy stack
    small_blind=5,            # Mały blind
    big_blind=10,             # Duży blind
    randomize_stacks=True,    # Losowe stacki (lepsza generalizacja)
    player_count=2,           # Heads-up
)

# API:
state = env.reset()           # Nowa ręka
valid_actions = env.get_valid_actions()
next_state, reward, done, info = env.step(action, raise_amount)
```

#### Optymalizacje Wydajności

Trening RL jest compute-intensive, więc zaimplementowano optymalizacje:

1. **Zero-copy encoding** — prealokowane tensory na GPU
2. **Cached forward passes** — cache'owanie logitów podczas kolekcji epizodów
3. **Batched PPO updates** — jeden forward pass dla wszystkich kroków
4. **Vectorized GAE** — uproszczona advantage estimation dla sparse rewards

```python
# Prealokacja tensorów
self._static_state_buffer = torch.zeros(1, 18, device=device)
self._action_seq_buffer = torch.zeros(1, 20, 10, device=device)

# Reużycie zamiast alokacji
self._static_state_buffer.zero_()  # Szybsze niż nowy tensor
```

---

## Struktura Projektu

```
ai/holdem/
├── README.md                    # Dokumentacja (ten plik)
├── requirements.txt             # Zależności Python
│
├── # ===== PREPROCESSING (Rust) =====
├── preprocess_rust/
│   ├── Cargo.toml               # Konfiguracja projektu Rust
│   └── src/
│       ├── lib.rs               # Wspólne funkcje (parsowanie kart)
│       └── bin/
│           ├── preprocess_acpc.rs     # Preprocessor ACPC 2017
│           ├── preprocess_handhq.rs   # Preprocessor HandHQ
│           └── preprocess_pluribus.rs # Preprocessor Pluribus
│
├── # ===== DANE I DATASETY =====
├── merge_datasets.py            # Łączenie wielu NPZ w jeden
├── dataset.py                   # PyTorch Dataset & DataLoader
│
├── # ===== MODEL =====
├── model.py                     # Architektura PluribusPokerTransformer
│                                # + klasa PokerLoss
│                                # + funkcja create_model()
│
├── # ===== TRENING =====
├── train.py                     # Trening nadzorowany (supervised)
├── train_rl_pokerkit.py         # Trening RL (PPO + self-play)
├── environment.py               # Wrapper na bibliotekę PokerKit
│
├── # ===== INFERENCJA I EWALUACJA =====
├── inference.py                 # Silnik inferencji z CLI
├── validate_model.py            # Walidacja i analiza błędów
├── compare_models.py            # Porównanie checkpointów
├── test_predictions.py          # Testy predykcji
│
├── # ===== EKSPORT =====
├── export_onnx.py               # Eksport modelu do ONNX
├── holdem_model.onnx            # Wyeksportowany model
│
├── # ===== CHECKPOINTY =====
├── checkpoints/
│   ├── best_model.pt            # Najlepszy model (supervised)
│   ├── best_model_rl_big.pt     # Model po RL fine-tuning
│   └── config.json              # Konfiguracja modelu
│
├── # ===== LOGI TENSORBOARD =====
├── runs/                        # Logi treningu supervised
└── runs_rl/                     # Logi treningu RL
```

---

## Wymagania Systemowe

### Python

```
Python >= 3.9
```

### Zależności Python

Plik `requirements.txt`:

```
# Core
numpy>=1.24.0
h5py>=3.8.0
tqdm>=4.65.0
toml>=0.10.2
rtoml>=0.9.0  # Szybki parser TOML (Rust-based)

# Deep Learning
torch>=2.0.0
tensorboard>=2.13.0

# Poker simulation
pokerkit>=0.5.0

# Opcjonalne (wizualizacja)
pandas>=2.0.0
matplotlib>=3.7.0
seaborn>=0.12.0
```

Instalacja:

```powershell
pip install -r requirements.txt
```

### Rust (dla preprocessingu)

```
Rust >= 1.70
Cargo (menedżer pakietów)
```

Instalacja: https://rustup.rs/

```powershell
# Windows (PowerShell)
winget install Rustlang.Rust
# lub
iwr https://win.rustup.rs -OutFile rustup-init.exe; .\rustup-init.exe
```

### GPU (opcjonalne, ale zalecane)

- CUDA >= 11.7
- GPU z minimum 4GB VRAM (8GB+ zalecane dla dużych batchy)
- Obsługiwane: NVIDIA GTX 1060+, RTX seria

---

## Instrukcja Uruchomienia

### 1. Przygotowanie Środowiska

```powershell
# Klonowanie/przejście do katalogu
cd ai/holdem

# Utworzenie virtual environment
python -m venv .venv

# Aktywacja (Windows PowerShell)
.\.venv\Scripts\Activate.ps1

# Instalacja zależności Python
pip install -r requirements.txt
```

### 2. Preprocessing Danych (jeśli masz surowe dane)

```powershell
# Kompilacja preprocessorów Rust
cd preprocess_rust
cargo build --release
cd ..

# Przetworzenie ACPC 2017
.\preprocess_rust\target\release\preprocess_acpc.exe `
    --dataset dataset/acpc_2017 `
    --output acpc_2017.npz

# Przetworzenie HandHQ
.\preprocess_rust\target\release\preprocess_handhq.exe `
    --dataset dataset/handhq `
    --output handhq.npz

# Przetworzenie Pluribus
.\preprocess_rust\target\release\preprocess_pluribus.exe `
    --dataset dataset/pluribus `
    --output pluribus.npz

# Połączenie wszystkich datasetów
python merge_datasets.py `
    --datasets acpc_2017.npz handhq.npz pluribus.npz `
    --output combined_all.npz
```

### 3. Trening Modelu

```powershell
# Etap 1: Supervised learning
python train.py `
    --dataset combined_all.npz `
    --epochs 20 `
    --device cuda `
    --use-amp `
    --batch-size 1024 `
    --output-dir checkpoints

# Etap 2: RL fine-tuning
python train_rl_pokerkit.py `
    --checkpoint checkpoints/best_model.pt `
    --episodes 50000 `
    --device cuda `
    --use-amp `
    --randomize-stacks `
    --output-dir checkpoints_rl
```

### 4. Monitorowanie Treningu

```powershell
# TensorBoard dla supervised
tensorboard --logdir runs

# TensorBoard dla RL
tensorboard --logdir runs_rl
```

Otwórz http://localhost:6006 w przeglądarce.

---

## Inferencja i Ewaluacja

### PokerInferenceEngine

Klasa w pliku `inference.py` zapewnia łatwy interfejs:

```python
from inference import PokerInferenceEngine

# Załadowanie modelu
engine = PokerInferenceEngine(
    checkpoint_path='checkpoints/best_model.pt',
    device='cuda'  # lub 'cpu'
)

# Przygotowanie stanu gry
game_state = {
    'hole_cards': ['Ah', 'Kd'],           # Karty gracza
    'board': ['Jc', '7h', '2s'],          # Karty na stole (flop)
    'stacks': [950, 1050],                # Stacki graczy
    'pot': 100,                           # Aktualny pot
    'street': 1,                          # 0=preflop, 1=flop, 2=turn, 3=river
    'actions': [                          # Historia akcji
        {'player': 0, 'type': 2, 'amount': 50},  # gracz 0 raise 50
        {'player': 1, 'type': 1, 'amount': 50},  # gracz 1 call
    ]
}

# Uzyskanie predykcji
action, raise_amount, probs = engine.predict(game_state)
print(f"Rekomendowana akcja: {['FOLD', 'CALL', 'RAISE'][action]}")
print(f"Prawdopodobieństwa: Fold={probs[0]:.2%}, Call={probs[1]:.2%}, Raise={probs[2]:.2%}")
if action == 2:
    print(f"Zalecana wysokość raise: {raise_amount:.2f}x pot")
```

### Tryb Interaktywny

```powershell
python inference.py --checkpoint checkpoints/best_model.pt --interactive
```

### Walidacja Modelu

```powershell
python validate_model.py `
    --checkpoint checkpoints/best_model.pt `
    --test-data test_pluribus.npz `
    --output-dir validation_results
```

Generuje:

- `confusion_matrix.png` — macierz pomyłek
- `per_class_metrics.json` — precision/recall/F1 per class
- `raise_amount_errors.png` — rozkład błędów predykcji raise
- `sample_predictions.csv` — przykładowe predykcje

---

## Eksport do ONNX

Model można wyeksportować do formatu ONNX dla produkcyjnego deployment:

```powershell
python export_onnx.py
```

Wynik: `holdem_model.onnx`

### Użycie w ONNX Runtime

```python
import onnxruntime as ort
import numpy as np

# Załadowanie modelu
session = ort.InferenceSession('holdem_model.onnx')

# Przygotowanie danych wejściowych
static_state = np.zeros((1, 18), dtype=np.float32)
action_sequence = np.zeros((1, 20, 10), dtype=np.float32)

# Inferencja
action_logits, value_pred = session.run(
    None,
    {
        'static_state': static_state,
        'action_sequence': action_sequence
    }
)

# Interpretacja wyniku
action = np.argmax(action_logits[0])  # 0=fold, 1=call, 2=raise
raise_multiplier = np.exp(value_pred[0, 0])  # konwersja z log-space
```

---

## Szczegóły Techniczne

### Inicjalizacja Wag

- **Xavier Uniform** dla wszystkich warstw Linear
- **Learned embeddings** dla tokenów CLS
- **Zeros** dla biasów

```python
def _init_weights(self):
    for p in self.parameters():
        if p.dim() > 1:
            nn.init.xavier_uniform_(p)
```

### Optymalizator

```python
optimizer = torch.optim.AdamW(
    model.parameters(),
    lr=1e-4,
    weight_decay=0.01,
    betas=(0.9, 0.999),
)
```

### Gradient Clipping

```python
torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
```

### Mixed Precision Training

```python
with torch.amp.autocast(device_type='cuda', enabled=use_amp):
    action_logits, value_pred = model(batch)
    loss, loss_dict = criterion(predictions, targets, outcomes)

if use_amp:
    scaler.scale(loss).backward()
    scaler.unscale_(optimizer)
    torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
    scaler.step(optimizer)
    scaler.update()
```

### Architektura Transformera

- **Pre-norm** — LayerNorm przed attention/FFN (stabilniejszy trening)
- **GELU activation** — gładsza niż ReLU
- **Dropout** — 0.1 na wszystkich warstwach
- **Sinusoidal positional encoding** — dla sekwencji akcji

### Maskowanie

- **Nieznane karty:** UNKNOWN_CARD=52 → zerowane embeddingi
- **Padding akcji:** all-zeros → maskowane w attention (`src_key_padding_mask`)

---

## Wyniki i Metryki

### Metryki Treningu Nadzorowanego

| Metryka             | Opis                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `accuracy`          | Ogólna dokładność predykcji akcji                                 |
| `balanced_accuracy` | Średnia dokładność per-class (ważne dla niezbalansowanych danych) |
| `fold_accuracy`     | Dokładność dla akcji fold                                         |
| `call_accuracy`     | Dokładność dla akcji call                                         |
| `raise_accuracy`    | Dokładność dla akcji raise                                        |
| `fold_precision`    | Precyzja dla fold                                                 |
| `call_precision`    | Precyzja dla call                                                 |
| `raise_precision`   | Precyzja dla raise                                                |
| `value_mae`         | Mean Absolute Error dla raise amounts (w mnożnikach pota)         |
| `value_mae_log`     | MAE w skali logarytmicznej                                        |

### Metryki Treningu RL

| Metryka          | Opis                                            |
| ---------------- | ----------------------------------------------- |
| `mean_reward`    | Średnia nagroda na epizod (w BB)                |
| `win_rate`       | Procent wygranych rąk                           |
| `expected_value` | Oczekiwana wartość vs baseline                  |
| `policy_loss`    | Strata polityki PPO                             |
| `value_loss`     | Strata funkcji wartości (critic)                |
| `entropy`        | Entropia polityki (miara eksploracji)           |
| `kl_div`         | KL-divergence między starą a nową polityką      |
| `clip_fraction`  | Procent zclipowanych ratio (powinien być < 20%) |

### Wizualizacja w TensorBoard

```powershell
# Supervised training logs
tensorboard --logdir runs --port 6006

# RL training logs
tensorboard --logdir runs_rl --port 6007
```
