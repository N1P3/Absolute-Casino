use anyhow::{Context, Result};
use clap::Parser;
use indicatif::{ProgressBar, ProgressStyle};
use ndarray::{Array1, Array2, Array3};
use poker_preprocess::{
    parse_cards, ACTION_VEC_LEN, MAX_ACTIONS_PER_STREET, MAX_PLAYERS, NUM_CARDS, UNKNOWN_CARD,
};
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use walkdir::WalkDir;

/// High-performance poker hand history preprocessor for ACPC format
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to directory containing .phhs files
    #[arg(
        short,
        long,
        default_value = "dataset/annual-computer-poker-competition/competitions/2017/logs/processed_logs_2pn_2017"
    )]
    dataset: PathBuf,

    /// Output NPZ filename
    #[arg(short, long, default_value = "poker_transformer_acpc_rust.npz")]
    output: String,

    /// Maximum hands to process per file
    #[arg(short, long, default_value_t = 1000)]
    max_hands: usize,
}

#[derive(Debug, Deserialize)]
struct HandData {
    #[serde(default)]
    ante_trimming_status: bool,
    #[serde(default)]
    antes: Vec<u32>,
    blinds_or_straddles: Vec<u32>,
    min_bet: u32,
    starting_stacks: Vec<u32>,
    #[serde(default)]
    finishing_stacks: Vec<u32>,
    #[serde(rename = "_results", default)]
    results: Vec<i32>,
    actions: Vec<String>,
}

#[derive(Debug, Clone)]
struct PokerState {
    stacks: Vec<u32>,
    bets: Vec<u32>,
    total_pot: u32, // Accumulates pot across streets
    hole_cards: Vec<Vec<u8>>,
    board_cards: Vec<u8>,
    street_index: usize,
    actor_index: Option<usize>,
    num_players: usize,
    button_index: usize,
    folded: Vec<bool>,
}

impl PokerState {
    fn new(starting_stacks: Vec<u32>, blinds: Vec<u32>) -> Self {
        let num_players = starting_stacks.len();
        let mut state = PokerState {
            stacks: starting_stacks.clone(),
            bets: vec![0; num_players],
            total_pot: 0, // Initialize pot accumulator
            hole_cards: vec![vec![]; num_players],
            board_cards: Vec::new(),
            street_index: 0,
            actor_index: None,
            num_players,
            button_index: 0,
            folded: vec![false; num_players],
        };

        // Post blinds
        if blinds.len() >= 2 {
            let sb_pos = 1 % num_players;
            let bb_pos = 2 % num_players;
            state.bets[sb_pos] = blinds[0];
            state.stacks[sb_pos] -= blinds[0];
            state.bets[bb_pos] = blinds[1];
            state.stacks[bb_pos] -= blinds[1];
        }

        state
    }

    fn deal_hole(&mut self, player: usize, cards_str: &str) {
        self.hole_cards[player] = parse_cards(cards_str);
        // After dealing hole cards, set first actor (UTG or after BB)
        if self.actor_index.is_none() {
            self.actor_index =
                Some(self.find_next_active_player((self.button_index + 3) % self.num_players));
        }
    }

    fn deal_board(&mut self, cards_str: &str) {
        self.board_cards.extend(parse_cards(cards_str));
        self.street_index += 1;
        // Accumulate current bets into total pot before clearing
        self.total_pot += self.bets.iter().sum::<u32>();
        // Reset bets for new street
        self.bets = vec![0; self.num_players];
        // First to act is after button
        self.actor_index =
            Some(self.find_next_active_player((self.button_index + 1) % self.num_players));
    }

    fn fold(&mut self) {
        if let Some(actor) = self.actor_index {
            self.folded[actor] = true;
            self.advance_actor();
        }
    }

    fn check_or_call(&mut self) {
        if let Some(actor) = self.actor_index {
            let max_bet = *self.bets.iter().max().unwrap_or(&0);
            let call_amount = max_bet.saturating_sub(self.bets[actor]);
            let actual_call = call_amount.min(self.stacks[actor]);

            self.stacks[actor] -= actual_call;
            self.bets[actor] += actual_call;
            self.advance_actor();
        }
    }

    fn complete_bet_or_raise_to(&mut self, total: u32) {
        if let Some(actor) = self.actor_index {
            let current_bet = self.bets[actor];
            let additional = total.saturating_sub(current_bet).min(self.stacks[actor]);

            self.stacks[actor] -= additional;
            self.bets[actor] += additional;
            self.advance_actor();
        }
    }

    fn advance_actor(&mut self) {
        if let Some(current) = self.actor_index {
            let next = self.find_next_active_player((current + 1) % self.num_players);

            // Check if betting round is complete
            let max_bet = *self.bets.iter().max().unwrap_or(&0);
            let all_called = self
                .bets
                .iter()
                .enumerate()
                .all(|(i, &bet)| self.folded[i] || bet == max_bet || self.stacks[i] == 0);

            if all_called {
                self.actor_index = None;
            } else {
                self.actor_index = Some(next);
            }
        }
    }

    fn find_next_active_player(&self, start: usize) -> usize {
        let mut pos = start;
        for _ in 0..self.num_players {
            if !self.folded[pos] && self.stacks[pos] > 0 {
                return pos;
            }
            pos = (pos + 1) % self.num_players;
        }
        start
    }

    fn pot_size(&self) -> u32 {
        self.total_pot + self.bets.iter().sum::<u32>()
    }
}

fn vectorize_static_state(
    state: &PokerState,
    player_index: usize,
    starting_stacks: &[u32],
) -> Vec<f32> {
    // New efficient encoding: 2 hole IDs + 5 board IDs + 6 stack positions + 1 pot + 4 street = 18 features
    let mut vec = Vec::with_capacity(18);

    // Hole card IDs (2 entries)
    let mut hole_ids = vec![UNKNOWN_CARD; 2];
    if player_index < state.hole_cards.len() {
        for (i, &card) in state.hole_cards[player_index].iter().take(2).enumerate() {
            if (card as usize) < NUM_CARDS {
                // Cast u8 card ID to usize for consistency with UNKNOWN_CARD type
                hole_ids[i] = card as usize;
            }
        }
    }
    // Convert usize IDs to f32 before extending
    vec.extend(hole_ids.iter().map(|&id| id as f32));

    // Board card IDs (5 entries)
    let mut board_ids = vec![UNKNOWN_CARD; 5];
    for (i, &card) in state.board_cards.iter().take(5).enumerate() {
        if (card as usize) < NUM_CARDS {
            // Cast u8 card ID to usize for consistency with UNKNOWN_CARD type
            board_ids[i] = card as usize;
        }
    }
    // Convert usize IDs to f32 before extending
    vec.extend(board_ids.iter().map(|&id| id as f32));
    // Relative positions (normalized stacks)
    // Use max of starting stacks for consistent normalization across games
    let normalizer = (*starting_stacks.iter().max().unwrap_or(&1)).max(1) as f32;
    let mut positions = vec![0.0f32; 6];
    for i in 0..state.num_players.min(MAX_PLAYERS) {
        let relative_idx = (i + state.num_players - player_index) % state.num_players;
        if relative_idx < MAX_PLAYERS {
            positions[relative_idx] = state.stacks[i] as f32 / normalizer;
        }
    }
    vec.extend(positions);

    // Pot size (normalized)
    vec.push(state.pot_size() as f32 / normalizer);

    // Street (one-hot encoded: preflop, flop, turn, river)
    let mut street_vec = vec![0.0f32; 4];
    if state.street_index < 4 {
        street_vec[state.street_index] = 1.0;
    }
    vec.extend(street_vec);

    vec
}

fn vectorize_action_for_sequence(
    state: &PokerState,
    action_str: &str,
    actor_index: usize,
) -> Vec<f32> {
    let mut vec = Vec::with_capacity(ACTION_VEC_LEN);

    // Player position (one-hot, max 6 players)
    let mut player_vec = vec![0.0f32; 6];
    if actor_index < MAX_PLAYERS {
        player_vec[actor_index] = 1.0;
    }
    vec.extend(player_vec);

    // Action type (one-hot: FOLD, CC, CBR)
    let mut action_type = vec![0.0f32; 3];
    let mut amount = 0.0f32;

    let parts: Vec<&str> = action_str.split_whitespace().collect();
    if parts.len() >= 2 {
        match parts[1] {
            "f" => action_type[0] = 1.0,
            "cc" => action_type[1] = 1.0,
            "cbr" => {
                action_type[2] = 1.0;
                if parts.len() >= 3 {
                    if let Ok(total_commit) = parts[2].parse::<u32>() {
                        let pot = state.pot_size().max(1) as f32;
                        // Calculate actual raise size (not total commit)
                        let amount_to_call = state.bets[actor_index];
                        let raise_size = total_commit.saturating_sub(amount_to_call);
                        // Normalize by pot and clamp to reasonable range (0-10x pot)
                        amount = (raise_size as f32 / pot).clamp(0.0, 10.0);
                    }
                }
            }
            _ => {}
        }
    }
    vec.extend(action_type);
    vec.push(amount);

    vec
}

fn vectorize_target_action(state: &PokerState, action_str: &str) -> Vec<f32> {
    let parts: Vec<&str> = action_str.split_whitespace().collect();
    let mut action_type = 0.0f32;
    let mut amount = 0.0f32;

    if parts.len() >= 2 {
        match parts[1] {
            "f" => action_type = 0.0,
            "cc" => action_type = 1.0,
            "cbr" => {
                action_type = 2.0;
                if parts.len() >= 3 {
                    if let Ok(total_commit) = parts[2].parse::<u32>() {
                        let pot = state.pot_size().max(1) as f32;
                        if let Some(actor) = state.actor_index {
                            let amount_to_call = state.bets[actor];
                            let raise_size = total_commit.saturating_sub(amount_to_call);
                            // Normalize by pot and clamp to reasonable range (0-10x pot)
                            amount = (raise_size as f32 / pot).clamp(0.0, 10.0);
                        }
                    }
                }
            }
            _ => {}
        }
    }

    vec![action_type, amount]
}

fn process_hand_for_transformer(
    hand_data: &HandData,
) -> Result<(Vec<Vec<f32>>, Vec<Vec<Vec<f32>>>, Vec<Vec<f32>>, Vec<f32>)> {
    let mut static_states = Vec::new();
    let mut action_sequences = Vec::new();
    let mut target_actions = Vec::new();
    let mut outcomes = Vec::new();

    let mut state = PokerState::new(
        hand_data.starting_stacks.clone(),
        hand_data.blinds_or_straddles.clone(),
    );

    let mut action_history_this_street: Vec<String> = Vec::new();

    // Calculate player profits
    let big_blind = *hand_data.blinds_or_straddles.iter().max().unwrap_or(&1);
    let player_profits: Vec<f32> = if !hand_data.results.is_empty() {
        hand_data
            .results
            .iter()
            .map(|&r| r as f32 / big_blind as f32)
            .collect()
    } else if !hand_data.finishing_stacks.is_empty() {
        hand_data
            .finishing_stacks
            .iter()
            .zip(hand_data.starting_stacks.iter())
            .map(|(&fin, &start)| (fin as i32 - start as i32) as f32 / big_blind as f32)
            .collect()
    } else {
        vec![0.0; hand_data.starting_stacks.len()]
    };

    for action_str in &hand_data.actions {
        let parts: Vec<&str> = action_str.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        match parts[0] {
            "d" if parts.len() >= 3 && parts[1] == "db" => {
                // New street, clear action history
                action_history_this_street.clear();
                state.deal_board(parts[2]);
            }
            "d" if parts.len() >= 4 && parts[1] == "dh" => {
                if let Some(player_str) = parts[2].strip_prefix('p') {
                    if let Ok(player_idx) = player_str.parse::<usize>() {
                        if player_idx > 0 {
                            state.deal_hole(player_idx - 1, parts[3]);
                        }
                    }
                }
            }
            p if p.starts_with('p') => {
                // Player action
                if state.actor_index.is_none() {
                    continue;
                }

                let current_player_idx = state.actor_index.unwrap();

                // 1. Capture inputs
                let static_state_vec =
                    vectorize_static_state(&state, current_player_idx, &hand_data.starting_stacks);

                // 2. Action sequence (what happened so far)
                let sequence_vec: Vec<Vec<f32>> = action_history_this_street
                    .iter()
                    .map(|act_str| {
                        let actor = act_str
                            .split_whitespace()
                            .next()
                            .and_then(|p| p.strip_prefix('p'))
                            .and_then(|idx| idx.parse::<usize>().ok())
                            .map(|i| i - 1)
                            .unwrap_or(0);
                        vectorize_action_for_sequence(&state, act_str, actor)
                    })
                    .collect();

                // 3. Target action
                let target_action_vec = vectorize_target_action(&state, action_str);

                // 4. Outcome
                let outcome = if current_player_idx < player_profits.len() {
                    player_profits[current_player_idx]
                } else {
                    0.0
                };

                // Store training sample
                static_states.push(static_state_vec);
                action_sequences.push(sequence_vec);
                target_actions.push(target_action_vec);
                outcomes.push(outcome);

                // Update state
                action_history_this_street.push(action_str.clone());

                if parts.len() >= 2 {
                    match parts[1] {
                        "f" => state.fold(),
                        "cc" => state.check_or_call(),
                        "cbr" if parts.len() >= 3 => {
                            if let Ok(amount) = parts[2].parse::<u32>() {
                                state.complete_bet_or_raise_to(amount);
                            }
                        }
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }

    Ok((static_states, action_sequences, target_actions, outcomes))
}

fn parse_phhs_file(filepath: &Path) -> Result<Vec<HandData>> {
    let content = fs::read_to_string(filepath)
        .with_context(|| format!("Failed to read file: {}", filepath.display()))?;

    let parsed: HashMap<String, HandData> = toml::from_str(&content)
        .with_context(|| format!("Failed to parse TOML: {}", filepath.display()))?;

    // Sort by numeric keys
    let mut hands: Vec<(usize, HandData)> = parsed
        .into_iter()
        .filter_map(|(k, v)| k.parse::<usize>().ok().map(|n| (n, v)))
        .collect();
    hands.sort_by_key(|(n, _)| *n);

    Ok(hands.into_iter().map(|(_, h)| h).collect())
}

fn process_file_batch(
    phh_file: &Path,
    max_hands: usize,
) -> Result<(
    Vec<Vec<f32>>,
    Vec<Vec<Vec<f32>>>,
    Vec<Vec<f32>>,
    Vec<f32>,
    usize,
)> {
    let hands = parse_phhs_file(phh_file)?;

    let mut all_static = Vec::new();
    let mut all_sequences = Vec::new();
    let mut all_targets = Vec::new();
    let mut all_outcomes = Vec::new();
    let mut hands_processed = 0;

    for hand_data in hands.into_iter().take(max_hands) {
        match process_hand_for_transformer(&hand_data) {
            Ok((static_states, sequences, targets, hand_outcomes)) => {
                hands_processed += 1;
                for i in 0..static_states.len() {
                    all_static.push(static_states[i].clone());
                    all_sequences.push(sequences[i].clone());
                    all_targets.push(targets[i].clone());
                    all_outcomes.push(hand_outcomes[i]);
                }
            }
            Err(_) => continue,
        }
    }

    Ok((
        all_static,
        all_sequences,
        all_targets,
        all_outcomes,
        hands_processed,
    ))
}

/// Process a file and directly append results into provided buffers to avoid extra cloning
fn process_file_batch_into(
    phh_file: &Path,
    max_hands: usize,
    all_static: &mut Vec<Vec<f32>>,
    all_sequences: &mut Vec<Vec<Vec<f32>>>,
    all_targets: &mut Vec<Vec<f32>>,
    all_outcomes: &mut Vec<f32>,
) -> Result<usize> {
    let hands = parse_phhs_file(phh_file)?;
    let mut hands_processed = 0;

    for hand_data in hands.into_iter().take(max_hands) {
        if let Ok((static_states, sequences, targets, hand_outcomes)) =
            process_hand_for_transformer(&hand_data)
        {
            hands_processed += 1;
            for i in 0..static_states.len() {
                all_static.push(static_states[i].clone());
                all_sequences.push(sequences[i].clone());
                all_targets.push(targets[i].clone());
                all_outcomes.push(hand_outcomes[i]);
            }
        }
    }

    Ok(hands_processed)
}

fn main() -> Result<()> {
    let args = Args::parse();

    println!("Poker Preprocessing (Rust - High Performance)");
    println!("==============================================\n");

    // Configuration from CLI args
    let dataset_dir = &args.dataset;
    let output_filename = &args.output;
    let max_hands_per_file = args.max_hands;

    // Find all .phh and .phhs files (recursively)
    println!("Scanning for .phh and .phhs files recursively...");
    let phh_files: Vec<PathBuf> = WalkDir::new(dataset_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let ext = e.path().extension().and_then(|s| s.to_str());
            ext == Some("phhs") || ext == Some("phh")
        })
        .map(|e| e.path().to_path_buf())
        .collect();

    println!("Found {} files\n", phh_files.len());

    if phh_files.is_empty() {
        anyhow::bail!(
            "No .phh or .phhs files found in {} (searched recursively)",
            dataset_dir.display()
        );
    }

    // Determine dimensions from first valid hand
    println!("Determining dimensions...");
    let mut static_state_size = 0;
    for phh_file in phh_files.iter().take(10) {
        if let Ok(hands) = parse_phhs_file(phh_file) {
            if let Some(hand) = hands.first() {
                if let Ok((static_states, _, _, _)) = process_hand_for_transformer(hand) {
                    if !static_states.is_empty() {
                        static_state_size = static_states[0].len();
                        break;
                    }
                }
            }
        }
    }

    // Fallback to known static state size if none of the sampled hands produced a static state
    if static_state_size == 0 {
        // The static state vector is designed to have 18 features (see vectorize_static_state)
        static_state_size = 18;
        println!(
            "Warning: Could not infer static state size from sample hands; using fallback size {}",
            static_state_size
        );
    }

    println!("Static state size: {}\n", static_state_size);

    // Prepare data collection (will write to NPZ at the end)
    println!("Processing files to NPZ format...");

    // Processing loop
    let pb = ProgressBar::new(phh_files.len() as u64);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}] [{bar:40}] {pos}/{len} files ({msg})")
            .unwrap()
            .progress_chars("=>-"),
    );

    // Parallel processing with chunking for better cache locality
    let estimated_examples = phh_files.len().saturating_mul(200).max(1000);
    let pb_mutex = Mutex::new(pb);

    // Process files in parallel chunks to reduce overhead
    let chunk_size = 10.max(phh_files.len() / rayon::current_num_threads().max(1));

    let file_results: Vec<_> = phh_files
        .par_chunks(chunk_size)
        .map(|chunk| {
            let mut local_static = Vec::new();
            let mut local_sequences = Vec::new();
            let mut local_targets = Vec::new();
            let mut local_outcomes = Vec::new();
            let mut local_hands = 0;

            for phh_file in chunk {
                if let Ok(hands_count) = process_file_batch_into(
                    phh_file,
                    max_hands_per_file,
                    &mut local_static,
                    &mut local_sequences,
                    &mut local_targets,
                    &mut local_outcomes,
                ) {
                    local_hands += hands_count;
                }

                // Update progress less frequently
                if let Ok(pb) = pb_mutex.lock() {
                    pb.inc(1);
                }
            }

            (
                local_static,
                local_sequences,
                local_targets,
                local_outcomes,
                local_hands,
            )
        })
        .collect();

    if let Ok(pb) = pb_mutex.lock() {
        pb.finish_with_message("Done!");
    }

    // Merge results from chunks
    println!("\nMerging results from {} chunks...", file_results.len());
    let mut all_static: Vec<Vec<f32>> = Vec::with_capacity(estimated_examples);
    let mut all_sequences: Vec<Vec<Vec<f32>>> = Vec::with_capacity(estimated_examples);
    let mut all_targets: Vec<Vec<f32>> = Vec::with_capacity(estimated_examples);
    let mut all_outcomes: Vec<f32> = Vec::with_capacity(estimated_examples);
    let mut total_hands_processed = 0;

    for (static_batch, seq_batch, target_batch, outcome_batch, hands_count) in file_results {
        total_hands_processed += hands_count;
        all_static.extend(static_batch);
        all_sequences.extend(seq_batch);
        all_targets.extend(target_batch);
        all_outcomes.extend(outcome_batch);
    }

    let num_examples = all_static.len();

    println!("\nConverting to NumPy arrays...");

    // Convert to ndarray using flat buffers (faster than from_shape_fn)
    // static_array: shape (num_examples, static_state_size)
    let mut static_flat: Vec<f32> = Vec::with_capacity(num_examples * static_state_size);
    for s in &all_static {
        static_flat.extend_from_slice(&s[..]);
    }
    let static_array = Array2::from_shape_vec((num_examples, static_state_size), static_flat)
        .context("Failed to build static_array")?;

    // sequences: build flat buffer of zeros then copy each sequence into its slot
    let seq_stride = MAX_ACTIONS_PER_STREET * ACTION_VEC_LEN;
    let mut sequences_flat = vec![0.0f32; num_examples * seq_stride];
    for i in 0..num_examples {
        for j in 0..all_sequences[i].len().min(MAX_ACTIONS_PER_STREET) {
            let base = i * seq_stride + j * ACTION_VEC_LEN;
            for k in 0..ACTION_VEC_LEN {
                sequences_flat[base + k] = all_sequences[i][j].get(k).copied().unwrap_or(0.0);
            }
        }
    }
    let sequences_array = Array3::from_shape_vec(
        (num_examples, MAX_ACTIONS_PER_STREET, ACTION_VEC_LEN),
        sequences_flat,
    )
    .context("Failed to build sequences_array")?;

    // targets: shape (num_examples, 2)
    let mut targets_flat: Vec<f32> = Vec::with_capacity(num_examples * 2);
    for t in &all_targets {
        targets_flat.extend_from_slice(&t[..]);
    }
    let targets_array = Array2::from_shape_vec((num_examples, 2), targets_flat)
        .context("Failed to build targets_array")?;

    let outcomes_array = Array1::from_vec(all_outcomes);

    println!("Writing NPZ file...");

    // Write to NPZ (compressed NumPy archive)
    use std::fs::File;
    use std::io::Write;
    let npz_file = File::create(output_filename)?;
    let mut npz = zip::ZipWriter::new(npz_file);

    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .compression_level(Some(6))
        .large_file(true); // Enable ZIP64 for large files

    // Write static_states
    npz.start_file("static_states.npy", options)?;
    let mut buffer = Vec::new();
    ndarray_npy::WriteNpyExt::write_npy(&static_array, &mut buffer)?;
    npz.write_all(&buffer)?;

    // Write action_sequences
    npz.start_file("action_sequences.npy", options)?;
    buffer.clear();
    ndarray_npy::WriteNpyExt::write_npy(&sequences_array, &mut buffer)?;
    npz.write_all(&buffer)?;

    // Write target_actions
    npz.start_file("target_actions.npy", options)?;
    buffer.clear();
    ndarray_npy::WriteNpyExt::write_npy(&targets_array, &mut buffer)?;
    npz.write_all(&buffer)?;

    // Write outcomes
    npz.start_file("outcomes.npy", options)?;
    buffer.clear();
    ndarray_npy::WriteNpyExt::write_npy(&outcomes_array, &mut buffer)?;
    npz.write_all(&buffer)?;

    // Write metadata as JSON
    npz.start_file("metadata.json", options)?;
    let metadata = format!(
        r#"{{"num_hands": {}, "num_examples": {}, "num_files": {}}}"#,
        total_hands_processed,
        num_examples,
        phh_files.len()
    );
    npz.write_all(metadata.as_bytes())?;

    npz.finish()?;

    println!(
        "\n✓ Successfully processed {} examples from {} hands",
        num_examples, total_hands_processed
    );
    println!("✓ Output: {}", output_filename);

    Ok(())
}
