# Makao AI - Raport z Treningu Modelu

## Streszczenie

Niniejszy raport dokumentuje proces projektowania, implementacji i ewaluacji modelu uczenia maszynowego do gry w Makao z obsługą jednoczesnego grania wielu kart tego samego nominału (2, 3 lub 4 karty). W toku prac eksperymentalnych przebadano pięć różnych podejść do treningu: self-play z różnymi funkcjami nagród, trening przeciwko heurystyce z nagrodami pośrednimi, oraz curriculum learning. Ostatecznie najlepsze wyniki (50.6% win rate przeciwko silnej heurystyce) uzyskano metodą **treningu ze sparse rewards przeciwko stałemu przeciwnikowi heurystycznemu**.

---

## 1. Wprowadzenie

### 1.1 Cel projektu

Celem projektu było stworzenie agenta AI do gry w Makao, który:

- Potrafi grać wieloma kartami tego samego nominału jednocześnie (2, 3 lub 4 karty)
- Prawidłowo obsługuje wszystkie specjalne akcje (dobieranie kart, pomijanie tury, żądanie koloru/ranku)
- Stanowi wyzwanie dla gracza w aplikacji kasynowej (nie jest ani zbyt słaby, ani frustrująco silny)

### 1.2 Wybrany framework

Do implementacji wykorzystano bibliotekę **Stable-Baselines3** (wersja 2.2.1) z rozszerzeniem **sb3-contrib** dostarczającym algorytm **MaskablePPO**. Wybór ten był podyktowany:

- Koniecznością obsługi masek akcji (nie wszystkie akcje są legalne w każdym stanie gry)
- Stabilnością i dobrą dokumentacją biblioteki
- Natywną integracją z PyTorch, umożliwiającą łatwy eksport do formatu ONNX

### 1.3 Aktualny najlepszy model

**`makao_v3_fixed_100k.zip`** - model używany w produkcji

| Parametr               | Wartość                   |
| ---------------------- | ------------------------- |
| Win rate vs heurystyka | **50.6%** (1000 gier)     |
| Architektura sieci     | MLP [256, 256]            |
| Algorytm               | MaskablePPO               |
| Przestrzeń obserwacji  | 180 floatów               |
| Przestrzeń akcji       | 93 akcje dyskretne        |
| Czas treningu          | ~2.5 minuty (100k kroków) |

---

## 2. Architektura Systemu

### 2.1 Przestrzeń akcji (93 akcje)

Zaprojektowaliśmy przestrzeń akcji obsługującą zarówno pojedyncze karty, jak i multi-card plays:

| Zakres akcji | Typ akcji                 | Opis                       |
| ------------ | ------------------------- | -------------------------- |
| 0-51         | Pojedyncza karta          | `action = rank * 4 + suit` |
| 52-64        | 2 karty tego samego ranku | `rank_idx = action - 52`   |
| 65-77        | 3 karty tego samego ranku | `rank_idx = action - 65`   |
| 78-90        | 4 karty tego samego ranku | `rank_idx = action - 78`   |
| 91           | Dobierz kartę             | Draw                       |
| 92           | Pomiń turę                | Skip                       |

Rangi (13): 2, 3, 4, 5, 6, 7, 8, 9, T, J, Q, K, A (indeksy 0-12)
Kolory (4): Hearts, Diamonds, Clubs, Spades (indeksy 0-3)

### 2.2 Przestrzeń obserwacji (180 floatów)

W finalnej wersji (V3) model otrzymuje rozbudowaną obserwację:

| Zakres  | Rozmiar | Opis                            | Uzasadnienie                    |
| ------- | ------- | ------------------------------- | ------------------------------- |
| 0-51    | 52      | Moja ręka (one-hot)             | Podstawowa informacja o kartach |
| 52-103  | 52      | Karta na stole (one-hot)        | Do określenia legalnych ruchów  |
| 104-155 | 52      | Karty które wyszły (counter)    | Śledzenie co zostało w talii    |
| 156     | 1       | Pending draw count (normalized) | Stan specjalnych akcji          |
| 157     | 1       | Pending skip turns (normalized) | Stan specjalnych akcji          |
| 158-161 | 4       | Required suit (one-hot)         | Żądany kolor (As)               |
| 162-174 | 13      | Required rank (one-hot)         | Żądany rank (Jopek)             |
| 175     | 1       | Rozmiar ręki przeciwnika        | Taktyka końcówki                |
| 176     | 1       | Rozmiar talii                   | Informacja o stanie gry         |
| 177     | 1       | Mój rozmiar ręki                | Samoświadomość                  |
| 178     | 1       | Różnica kart (my - opponent)    | Ocena pozycji                   |
| 179     | 1       | Czy blisko wygranej (≤2 karty)  | Sygnał do agresywnej gry        |

### 2.3 Agent heurystyczny (baseline)

Do ewaluacji modeli zaprojektowano silnego agenta heurystycznego (`heuristic_agent.py`), który:

1. **Preferuje multi-card plays** - zawsze gra maksymalną liczbę kart danego ranku
2. **Priorytetyzuje karty specjalne** - zachowuje 2, 3, 4, K, J, A na później
3. **Blokuje przeciwnika** - gra karty akcji gdy przeciwnik ma mało kart
4. **Optymalizuje końcówkę** - przy 2-3 kartach gra agresywniej

Win rate heurystyki vs losowy agent: **96%** (co potwierdza jej siłę)

---

## 3. Metodologia Treningu Aktualnego Modelu

### 3.1 Podejście: Sparse Rewards vs Heurystyka

Aktualny model (`makao_v3_fixed_100k.zip`) jest trenowany metodą **uczenia ze wzmocnieniem przeciwko stałemu przeciwnikowi heurystycznemu** z minimalistyczną funkcją nagród.

```
┌─────────────────────────────────────────────────────────────┐
│                    SCHEMAT TRENINGU                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Agent RL (Player 0)          Heurystyka (Player 1)       │
│        │                              │                     │
│        └──────────── GRA ─────────────┘                     │
│                       │                                     │
│                       ▼                                     │
│              Wynik: Wygrana/Przegrana                       │
│                       │                                     │
│                       ▼                                     │
│              Reward: +1 / -1                                │
│                       │                                     │
│                       ▼                                     │
│              MaskablePPO Update                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Kluczowe decyzje projektowe

#### 3.2.1 Sparse Rewards (tylko +1/-1)

**Decyzja:** Nagroda tylko za wynik końcowy gry:

- Wygrana: +1
- Przegrana: -1
- Wszystkie inne akcje: 0

**Uzasadnienie:** Eksperymenty wykazały, że nagrody pośrednie (np. za zagranie karty, za multi-card) zaburzają gradient uczenia. Model zaczyna optymalizować maksymalizację nagród pośrednich zamiast wygrywania gier.

#### 3.2.2 Rozszerzone obserwacje (180 vs 124 floaty)

**Decyzja:** Dodanie historii zagranych kart i dodatkowych sygnałów.

**Uzasadnienie:** Model potrzebuje więcej kontekstu aby rozumieć:

- Jakie karty zostały w talii (counter kart które wyszły)
- Czy jest blisko wygranej (flaga przy ≤2 kartach)
- Różnicę pozycji względem przeciwnika

#### 3.2.3 Trening vs stały przeciwnik (nie self-play)

**Decyzja:** Przeciwnik to zawsze ta sama deterministyczna heurystyka.

**Uzasadnienie:** Stały przeciwnik zapewnia:

- Stabilny gradient uczenia (brak "moving target")
- Szybszą konwergencję (100k kroków vs miliony)
- Ceiling effect - model może osiągnąć poziom przeciwnika (~50%)

### 3.3 Hiperparametry

```python
model = MaskablePPO(
    policy="MlpPolicy",
    env=env,
    learning_rate=3e-4,          # Standardowa wartość dla PPO
    n_steps=2048,                # Kroki przed update (dużo kontekstu)
    batch_size=64,               # Rozmiar mini-batcha
    n_epochs=10,                 # Epoki na update
    gamma=0.99,                  # Discount factor (wysoki = patrzenie w przyszłość)
    gae_lambda=0.95,             # GAE lambda
    clip_range=0.2,              # PPO clipping
    ent_coef=0.01,               # Entropia (eksploracja)
    vf_coef=0.5,                 # Value function coefficient
    policy_kwargs={
        "net_arch": [256, 256]   # Dwie warstwy po 256 neuronów
    }
)
```

### 3.4 Proces treningu

1. **Inicjalizacja:** Model startuje z losową polityką
2. **Zbieranie doświadczeń:** Agent gra 2048 kroków vs heurystyka
3. **Update:** PPO wykonuje 10 epok optymalizacji na zebranych danych
4. **Powtórzenie:** Do osiągnięcia 100k kroków (~49 updateów)

**Czas treningu:** ~2.5 minuty na CPU

---

## 4. Eksperymenty i Porównanie Metod

### 4.1 Przegląd wszystkich testowanych podejść

W toku prac przetestowano **5 różnych podejść** do treningu modelu:

| #   | Metoda                             | Środowisko       | Idea                                       | Wynik     |
| --- | ---------------------------------- | ---------------- | ------------------------------------------ | --------- |
| 1   | Self-play + complex rewards        | V1 (124 obs)     | Model uczy się sam od siebie               | 36-38%    |
| 2   | Self-play + duże bonusy multi-card | V1 (124 obs)     | Zachęta do grania wieloma kartami          | 38%       |
| 3   | Vs heurystyka + complex rewards    | V2 (180 obs)     | Stabilny przeciwnik + nagrody pośrednie    | 37%       |
| 4   | Curriculum learning                | V4               | Heurystyka → Self-play                     | 38-45%    |
| 5   | **Vs heurystyka + sparse rewards** | **V3 (180 obs)** | **Minimalne nagrody, stabilny przeciwnik** | **50.6%** |

### 4.2 Szczegółowa analiza każdej metody

---

#### 4.2.1 Self-play z Complex Reward Shaping (V1)

**Idea:**
Klasyczne podejście do gier: model gra sam przeciwko sobie, ucząc się z obu perspektyw. Funkcja nagród zawierała:

- +0.5 za zagranie karty
- +1.0 za zagranie karty specjalnej (2, 3, 4, K, J, A)
- +2.0 za zagranie 2 kart tego samego ranku
- +3.0 za zagranie 3 kart
- +5.0 za zagranie 4 kart
- -0.2 za dobieranie karty (kara za pasywność)
- +10/-10 za wygraną/przegraną

**Implementacja:**

```python
def calculate_reward(action, cards_played, game_won):
    reward = 0
    if cards_played > 0:
        reward += 0.5 * cards_played
        if is_special_card(action):
            reward += 1.0
    if cards_played == 2:
        reward += 2.0
    elif cards_played == 3:
        reward += 3.0
    elif cards_played == 4:
        reward += 5.0
    if action == DRAW:
        reward -= 0.2
    if game_won is not None:
        reward += 10 if game_won else -10
    return reward
```

**Wyniki:**
| Kroków | Win Rate vs Heurystyka |
|--------|------------------------|
| 200k | 36% |
| 500k | 37% |
| 1M | 38% |

**Problemy zidentyfikowane:**

1. **Moving target problem:** Gdy model się uczy, jego przeciwnik (kopia samego siebie) też się zmienia. To destabilizuje gradient uczenia - model "goni własny ogon".

2. **Reward hacking:** Model nauczył się maksymalizować nagrody pośrednie zamiast wygrywać. Obserwowaliśmy zachowania typu:
   - Granie pojedynczych kart zamiast multi-card (szybsza nagroda)
   - Unikanie dobierania kart nawet gdy było to korzystne strategicznie

3. **Brak postępu po plateau:** Po osiągnięciu 38% model przestawał się uczyć, mimo kontynuacji treningu.

**Analiza błędów (na próbce 714 gier):**

```
Jedna karta zamiast wielu: 329 (46.0%)
Dobieranie zamiast grania: 198 (27.7%)
Słaby wybór karty: 112 (15.7%)
Niepotrzebne pomijanie: 75 (10.5%)
```

---

#### 4.2.2 Self-play z Dużymi Bonusami za Multi-card

**Idea:**
Hipoteza: model nie gra wieloma kartami bo nagroda jest za mała. Rozwiązanie: drastyczne zwiększenie bonusów za multi-card.

**Modyfikacje nagród:**

```python
# Nowe nagrody
+5.0 za zagranie 2 kart tego samego ranku
+10.0 za zagranie 3 kart
+20.0 za zagranie 4 kart (wszystkich danego ranku!)

# Kary za "trzymanie" kart
-2.0 gdy masz 2+ karty ranku ale grasz tylko 1
-5.0 gdy masz 3+ karty ranku ale grasz tylko 1-2
```

**Wyniki:**
| Kroków | Win Rate vs Heurystyka |
|--------|------------------------|
| 200k | 38% |
| 1M | 38% |
| 2M | 38% |
| 5M | 38% |

**Problemy zidentyfikowane:**

1. **Brak poprawy mimo 25x dłuższego treningu:** Model osiągnął 38% po 200k kroków i nie poprawił się do 5M kroków. To sugeruje fundamentalny problem z metodą, nie z czasem treningu.

2. **Overfitting do nagród:** Model zaczął "polować" na sytuacje multi-card zamiast grać optymalnie. Czasem trzymał karty czekając na więcej tego samego ranku, zamiast grać od razu.

3. **Self-play w grze z dużą losowością:** Makao ma znaczący element losowy (karty dobierane z talii). Self-play sprawdza się w grach deterministycznych (szachy, Go), ale w grach losowych model może uczyć się złych strategii które "przypadkiem" wygrywają w self-play.

---

#### 4.2.3 Trening vs Heurystyka z Complex Rewards (V2)

**Idea:**
Połączenie stabilności stałego przeciwnika (heurystyki) z bogatszą informacją zwrotną (nagrody pośrednie).

**Zmiany w środowisku V2:**

- Przeciwnik: zawsze heurystyka (nie self-play)
- Obserwacje: rozszerzone do 180 floatów (dodane historia kart, różnica pozycji)
- Nagrody:
  - +1.0 za każdą zagraną kartę
  - +5.0 bonus za multi-card
  - +20/-20 za wygraną/przegraną

**Wyniki:**
| Kroków | Win Rate vs Heurystyka |
|--------|------------------------|
| 100k | 35% |
| 200k | 37% |
| 500k | 37% |

**Problemy zidentyfikowane:**

1. **Nagrody pośrednie nadal zaburzają uczenie:** Nawet przy stabilnym przeciwniku, model optymalizował "granie kart" zamiast "wygrywania". Wysokie nagrody pośrednie (+1/kartę, +5/multi-card) dominowały nad nagrodą końcową.

2. **Suboptymalne strategie:** Model nauczył się grać dużo kart szybko, nawet gdy strategicznie lepiej było poczekać (np. trzymać karty specjalne na końcówkę).

---

#### 4.2.4 Curriculum Learning (V4)

**Idea:**
Dwufazowy trening:

1. **Faza 1 (100k kroków):** Trening vs heurystyka - nauczenie podstaw
2. **Faza 2 (200k kroków):** Self-play - odkrywanie strategii lepszych niż heurystyka

**Hipoteza:** Self-play po nauczeniu podstaw pozwoli modelowi "przeskoczyć" poziom heurystyki.

**Wyniki:**
| Etap | Win Rate vs Heurystyka |
|------|------------------------|
| Po fazie 1 (100k vs heur) | 45.1% |
| Po fazie 2 (+200k self-play) | 38.1% |

**Problemy zidentyfikowane:**

1. **Catastrophic forgetting:** Self-play w fazie 2 **pogarszał** model! Win rate spadł z 45% do 38%. Model "zapominał" dobre strategie nauczone przeciwko heurystyce.

2. **Brak discovering better strategies:** Hipoteza o odkrywaniu lepszych strategii nie sprawdziła się. W grze z dużą losowością self-play nie prowadzi do lepszych strategii - prowadzi do overfittingu do własnych błędów.

3. **Checkpoint before self-play lepszy:** Model po fazie 1 (45%) był lepszy niż końcowy model curriculum (38%). To ostatecznie przekonało nas do porzucenia self-play.

---

#### 4.2.5 Trening vs Heurystyka ze Sparse Rewards (V3) - FINAL

**Idea:**
Minimalizm: tylko nagroda za wynik końcowy, żadnych nagród pośrednich. Stabilny przeciwnik (heurystyka).

**Kluczowe zmiany:**

```python
def step(self, action):
    # ... wykonanie akcji ...

    reward = 0.0  # Brak nagród pośrednich!

    if done:
        if winner == 0:  # Agent wygrał
            reward = 1.0
        else:  # Agent przegrał
            reward = -1.0

    return obs, reward, done, truncated, info
```

**Wyniki:**
| Kroków | Win Rate vs Heurystyka |
|--------|------------------------|
| 100k | **50.6%** |
| 200k | 46.2% |
| 300k | 50.3% |
| 400k | 50.4% |
| 500k | 50.1% |

**Sukces!** Model osiągnął 50% win rate - poziom równy heurystyce.

**Dlaczego to zadziałało:**

1. **Brak reward hacking:** Bez nagród pośrednich model nie ma czego "hackować". Jedyny sposób na maksymalizację nagrody to wygrywanie gier.

2. **Czysty sygnał uczenia:** Gradient wskazuje bezpośrednio "co prowadzi do wygranej", bez szumu od nagród pośrednich.

3. **Stabilny przeciwnik:** Heurystyka nie zmienia się podczas treningu, więc model ma stabilny cel do osiągnięcia.

4. **Szybka konwergencja:** Model osiąga optimum już po 100k kroków (~2.5 min). Dłuższy trening nie poprawia wyników.

---

### 4.3 Tabela porównawcza wszystkich modeli

| Model             | Metoda              | Kroków   | Obserwacje | Nagrody      | Win Rate      | Uwagi           |
| ----------------- | ------------------- | -------- | ---------- | ------------ | ------------- | --------------- |
| Random            | -                   | -        | -          | -            | 4%            | Baseline        |
| Heurystyka        | Rule-based          | -        | -          | -            | 96% vs random | Silny baseline  |
| **V3 100k**       | **vs heur, sparse** | **100k** | **180**    | **±1 tylko** | **50.6%**     | **Najlepszy**   |
| V3 200k           | vs heur, sparse     | 200k     | 180        | ±1 tylko     | 46.2%         | Overfitting?    |
| V3 300k           | vs heur, sparse     | 300k     | 180        | ±1 tylko     | 50.3%         | Stabilny        |
| V3 400k           | vs heur, sparse     | 400k     | 180        | ±1 tylko     | 50.4%         | Stabilny        |
| V3 500k           | vs heur, sparse     | 500k     | 180        | ±1 tylko     | 50.1%         | Stabilny        |
| V1 self-play 200k | self-play, complex  | 200k     | 124        | Pośrednie    | 36%           | Moving target   |
| V1 self-play 1M   | self-play, complex  | 1M       | 124        | Pośrednie    | 38%           | Plateau         |
| V1 self-play 5M   | self-play, complex  | 5M       | 124        | Bonusy +20   | 38%           | Brak poprawy    |
| V2 vs heur        | vs heur, complex    | 200k     | 180        | Pośrednie    | 37%           | Reward hacking  |
| Curriculum phase1 | vs heur, sparse     | 100k     | 180        | ±1 tylko     | 45.1%         | Przed self-play |
| Curriculum final  | +200k self-play     | 300k     | 180        | ±1 tylko     | 38.1%         | Regresja!       |

---

## 5. Uzasadnienie Wyboru Metody

### 5.1 Dlaczego sparse rewards vs heurystyka?

Na podstawie eksperymentów zidentyfikowaliśmy **5 kluczowych czynników** sukcesu:

#### 5.1.1 Stabilność gradientu uczenia

**Problem self-play:** Gdy model gra sam ze sobą, jego przeciwnik (kopia) też się zmienia podczas treningu. To tworzy "moving target" - model goni własny ogon.

**Rozwiązanie:** Stały przeciwnik (heurystyka) zapewnia stabilny cel. Model wie dokładnie "przeciwko czemu" się uczy.

#### 5.1.2 Eliminacja reward hacking

**Problem complex rewards:** Model nauczył się maksymalizować nagrody pośrednie zamiast wygrywać. Grał pojedyncze karty (szybsza nagroda +0.5) zamiast czekać na multi-card.

**Rozwiązanie:** Tylko nagroda za wynik (+1/-1) nie pozostawia miejsca na "hackowanie". Jedyna droga do nagrody to wygrana.

#### 5.1.3 Szybkość konwergencji

**Obserwacja:** Model V3 osiągał optimum po 100k kroków (2.5 min). Self-play wymagał milionów kroków bez poprawy.

**Wniosek:** Przy stabilnym przeciwniku i czystym sygnale uczenia, konwergencja jest znacznie szybsza.

#### 5.1.4 Ceiling effect

**Teoria:** Trenując przeciwko heurystyce o sile X, model może nauczyć się grać na poziomie ~X (50% win rate = remis).

**Praktyka:** Osiągnęliśmy 50.6% win rate - model gra na równi z heurystyką.

**Implikacja:** Aby przekroczyć poziom heurystyki, potrzebowalibyśmy albo lepszej heurystyki jako przeciwnika, albo innej metody (np. MCTS, CFR). Self-play się nie sprawdził.

#### 5.1.5 Losowość gry Makao

**Obserwacja:** Makao ma znaczący element losowy (dobieranie kart z talii). W grach losowych self-play nie odkrywa optymalnych strategii - model może uczyć się złych strategii które "przypadkiem" wygrywają w self-play.

**Kontrast z szachami/Go:** W grach deterministycznych self-play (AlphaZero) odkrywa optymalne strategie. W grach losowych (Makao) to nie działa.

### 5.2 Dlaczego nie kontynuować treningu?

Wykres win rate vs kroków treningu:

```
Win Rate
   │
50%├────●───────●───────●───────●
   │    │
45%├    │
   │    │
40%├    │
   │    │
35%├    │
   │    │
   └────┼───────┼───────┼───────┼────→ Kroków
        100k   200k   300k   500k
```

Po 100k kroków model osiąga plateau. Dłuższy trening nie poprawia wyników (a czasem nawet je pogarsza - overfitting).

### 5.3 Dlaczego 50% to dobry wynik?

1. **Ceiling effect:** Trenując vs heurystykę, 50% to teoretyczne maximum (remis).
2. **Cel aplikacji:** W kasynie AI powinno być wyzwaniem, ale nie frustrująco silne. 50% = "uczciwa gra".
3. **Heurystyka jest silna:** 96% win rate vs random. Model grający na równi z heurystyką jest silny.
4. **Losowość gry:** W Makao nawet optymalna strategia nie gwarantuje wygranej (losowe karty).

---

## 6. Wnioski i Rekomendacje

### 6.1 Główne wnioski

1. **Sparse rewards > complex rewards** dla gier z jasnym warunkiem wygranej
2. **Stały przeciwnik > self-play** dla gier z dużą losowością
3. **Rozszerzone obserwacje** (180 vs 124 floatów) poprawiają uczenie
4. **Self-play może pogarszać** model (catastrophic forgetting w curriculum)
5. **Dłuższy trening ≠ lepszy model** - ważniejsza jest metoda

### 6.2 Potencjalne kierunki rozwoju

1. **Lepsza heurystyka jako przeciwnik** - ceiling effect ogranicza model do poziomu przeciwnika
2. **CFR (Counterfactual Regret Minimization)** - algorytm do gier z niepełną informacją
3. **Population-based training** - trening przeciwko populacji różnych strategii
4. **Ensemble modeli** - kombinacja kilku modeli o różnych stylach gry

### 6.3 Rekomendacja produkcyjna

Model `makao_v3_fixed_100k.zip` jest rekomendowany do użycia produkcyjnego:

- Stabilny win rate ~50% vs silna heurystyka
- Szybki trening (2.5 min) umożliwia łatwe re-trenowanie
- Eksport ONNX działa prawidłowo z backendem Java

---

## 7. Struktura Repozytorium

### 7.1 Pliki źródłowe

| Plik                 | Opis                                          |
| -------------------- | --------------------------------------------- |
| `makao_env.py`       | Środowisko V1 - self-play (124 obs, 93 akcji) |
| `makao_env_v3.py`    | Środowisko V3 - vs heurystyka (180 obs)       |
| `makao_game.py`      | Logika gry Makao                              |
| `heuristic_agent.py` | Agent heurystyczny (benchmark, 96% vs random) |
| `train.py`           | Skrypt treningu MaskablePPO                   |
| `evaluate.py`        | Ewaluacja modelu vs heurystyka/random         |
| `analyze_errors.py`  | Analiza błędów modelu                         |
| `play_vs_ai.py`      | Gra interaktywna z AI                         |
| `export_onnx_v3.py`  | Eksport modelu do ONNX                        |

### 7.2 Checkpoints (do porównania)

```
checkpoints/
├── makao_v3_fixed_100k_100000_steps.zip    # Aktualny najlepszy (50.6%)
├── makao_1M_reward_for_all_rank_1000000_steps.zip  # Self-play 1M (38%)
├── makao_5M_reward_for_all_rank_2000000_steps.zip  # Self-play 5M (38%)
└── makao_curriculum_v4_after_phase1.zip    # Curriculum faza 1 (45.1%)
```

---

## 8. Instrukcja Użycia

### 8.1 Instalacja zależności

```bash
pip install gymnasium numpy stable-baselines3 sb3-contrib torch onnx
```

### 8.2 Trening modelu

```bash
# Trening vs heurystyka (zalecane)
python train.py --timesteps 100000 --name moj_model --env-version 3 --net-arch 256,256

# Self-play (nie zalecane, dla porównania)
python train.py --timesteps 200000 --name moj_model --env-version 1
```

### 8.3 Ewaluacja

```bash
python evaluate.py --model moj_model.zip --episodes 1000 --opponent heuristic
```

### 8.4 Eksport do ONNX (dla Javy)

```bash
python export_onnx_v3.py --model makao_v3_fixed_100k.zip --output makao_model.onnx
```

### 8.5 Gra interaktywna

```bash
python play_vs_ai.py --model makao_v3_fixed_100k.zip
python play_vs_ai.py --heuristic  # vs heurystyka
```

---

## 9. Integracja z Backendem Java

Model ONNX (`makao_model_v3.onnx`) jest używany w `MakaoAI.java`:

- **Input:** observation (180 floats), action_masks (93 bools)
- **Output:** action_logits (93 floats) → masked argmax dla najlepszej legalnej akcji

Lokalizacja: `backend/control/src/main/java/com/absoluteCasino/control/games/makao/MakaoAI.java`

---
