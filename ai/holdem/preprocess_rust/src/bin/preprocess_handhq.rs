use anyhow::{Context, Result};
use clap::Parser;
use indicatif::{ProgressBar, ProgressStyle};
use ndarray::{Array1, Array2, Array3};
use poker_preprocess::{
    card_to_int, parse_cards, ACTION_VEC_LEN, MAX_ACTIONS_PER_STREET, MAX_PLAYERS, NUM_CARDS,
    UNKNOWN_CARD,
};
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use walkdir::WalkDir;

/// HandHQ poker hand history preprocessor (showdown hands only)
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to directory containing HandHQ .phhs files
    #[arg(short, long, default_value = "dataset/handhq")]
    dataset: PathBuf,

    /// Output NPZ filename
    #[arg(short, long, default_value = "poker_transformer_handhq.npz")]
    output: String,

    /// Maximum hands to process per file
    #[arg(short, long, default_value_t = 10000)]
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
    starting_stacks: Vec<f32>, // HandHQ uses f32 for stacks
    #[serde(default)]
    finishing_stacks: Vec<f32>,
    #[serde(rename = "_results", default)]
    results: Vec<i32>,
    actions: Vec<String>,
    #[serde(default)]
    winnings: Vec<f32>,
}

#[derive(Debug, Clone)]
struct PokerState {
    stacks: Vec<f32>,
    bets: Vec<f32>,
    total_pot: f32,
    hole_cards: Vec<Vec<u8>>,
    board_cards: Vec<u8>,
    street_index: usize,
    actor_index: Option<usize>,
    num_players: usize,
    button_index: usize,
    folded: Vec<bool>,
}

impl PokerState {
    fn new(starting_stacks: Vec<f32>, blinds: Vec<u32>) -> Self {
        let num_players = starting_stacks.len();
        let mut state = PokerState {
            stacks: starting_stacks.clone(),
            bets: vec![0.0; num_players],
            total_pot: 0.0,
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
            state.bets[sb_pos] = blinds[0] as f32;
            state.stacks[sb_pos] -= blinds[0] as f32;
            state.bets[bb_pos] = blinds[1] as f32;
            state.stacks[bb_pos] -= blinds[1] as f32;
        }

        state
    }

    fn deal_hole(&mut self, player: usize, cards_str: &str) {
        self.hole_cards[player] = parse_cards(cards_str);
        if self.actor_index.is_none() {
            self.actor_index = Some(self.find_next_active_player((2 + 1) % self.num_players));
        }
    }

    fn deal_board(&mut self, cards_str: &str) {
        self.board_cards.extend(parse_cards(cards_str));
        self.street_index += 1;
        self.total_pot += self.bets.iter().sum::<f32>();
        self.bets = vec![0.0; self.num_players];
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
            let max_bet = self.bets.iter().cloned().fold(0.0f32, f32::max);
            let call_amount = (max_bet - self.bets[actor]).max(0.0);
            let actual_call = call_amount.min(self.stacks[actor]);

            self.stacks[actor] -= actual_call;
            self.bets[actor] += actual_call;
            self.advance_actor();
        }
    }

    fn complete_bet_or_raise_to(&mut self, total: f32) {
        if let Some(actor) = self.actor_index {
            let current_bet = self.bets[actor];
            let additional = (total - current_bet).max(0.0).min(self.stacks[actor]);

            self.stacks[actor] -= additional;
            self.bets[actor] += additional;
            self.advance_actor();
        }
    }

    fn advance_actor(&mut self) {
        if let Some(current) = self.actor_index {
            let next = self.find_next_active_player((current + 1) % self.num_players);

            let max_bet = self.bets.iter().cloned().fold(0.0f32, f32::max);
            let all_called = self.bets.iter().enumerate().all(|(i, &bet)| {
                self.folded[i] || self.stacks[i] == 0.0 || (bet - max_bet).abs() < 0.01
            });

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
            if !self.folded[pos] && self.stacks[pos] > 0.01 {
                return pos;
            }
            pos = (pos + 1) % self.num_players;
        }
        start
    }

    fn pot_size(&self) -> f32 {
        self.total_pot + self.bets.iter().sum::<f32>()
    }
}

fn vectorize_static_state(
    state: &PokerState,
    player_index: usize,
    starting_stacks: &[f32],
) -> Vec<f32> {
    let mut vec = Vec::with_capacity(52 * 2 + 52 * 5 + 6 + 1 + 4);

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
    // Compute normalizer as the maximum starting stack (fallback to 1.0)
    let normalizer = starting_stacks.iter().cloned().fold(1.0_f32, f32::max);
    let mut positions = vec![0.0f32; 6];
    for i in 0..state.num_players.min(MAX_PLAYERS) {
        let relative_idx = (i + state.num_players - player_index) % state.num_players;
        if relative_idx < MAX_PLAYERS {
            positions[relative_idx] = state.stacks[i] / normalizer;
        }
    }
    vec.extend(&positions);

    // Pot size (normalized)
    vec.push(state.pot_size() / normalizer);

    // Street (one-hot encoded: preflop, flop, turn, river)
    let mut street_vec = vec![0.0f32; 4];
    if state.street_index < 4 {
        street_vec[state.street_index] = 1.0;
    }
    vec.extend(&street_vec);

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
                    if let Ok(bet_amount) = parts[2].parse::<f32>() {
                        let pot = state.pot_size().max(1.0);
                        amount = bet_amount / pot;
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
                    if let Ok(bet_amount) = parts[2].parse::<f32>() {
                        let pot = state.pot_size().max(1.0);
                        amount = bet_amount / pot;
                    }
                }
            }
            _ => {}
        }
    }

    vec![action_type, amount]
}

/// Extract showdown cards from HandHQ data
/// Returns HashMap of player_index -> hole_cards
fn extract_showdown_cards(actions: &[String]) -> HashMap<usize, Vec<u8>> {
    let mut showdown_cards = HashMap::new();

    for action_str in actions {
        let parts: Vec<&str> = action_str.split_whitespace().collect();

        // Look for showdown actions: "pX sm Cards" where Cards != "????"
        if parts.len() >= 3 && parts[1] == "sm" && parts[2] != "????" {
            if let Some(player_str) = parts[0].strip_prefix('p') {
                if let Ok(player_num) = player_str.parse::<usize>() {
                    let player_index = player_num - 1; // Convert to 0-indexed
                    let cards = parse_cards(parts[2]);
                    if !cards.is_empty() {
                        showdown_cards.insert(player_index, cards);
                    }
                }
            }
        }
    }

    showdown_cards
}

fn process_hand_for_transformer(
    hand_data: &HandData,
) -> Result<(Vec<Vec<f32>>, Vec<Vec<Vec<f32>>>, Vec<Vec<f32>>, Vec<f32>)> {
    // First pass: extract showdown cards to identify known players
    let showdown_cards = extract_showdown_cards(&hand_data.actions);

    // Filter: only process hands with at least one showdown
    if showdown_cards.is_empty() {
        return Ok((Vec::new(), Vec::new(), Vec::new(), Vec::new()));
    }

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
    let player_profits: Vec<f32> = if !hand_data.winnings.is_empty() {
        // Use winnings if available
        hand_data
            .winnings
            .iter()
            .map(|&w| w / big_blind as f32)
            .collect()
    } else if !hand_data.results.is_empty() {
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
            .map(|(&fin, &start)| (fin - start) / big_blind as f32)
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
                // Board cards
                state.deal_board(parts[2]);
                action_history_this_street.clear();
            }
            "d" if parts.len() >= 4 && parts[1] == "dh" => {
                // Hole cards - use showdown data if available
                if let Some(player_str) = parts[2].strip_prefix('p') {
                    if let Ok(player_num) = player_str.parse::<usize>() {
                        let player_index = player_num - 1;

                        // Check if we have showdown cards for this player
                        if let Some(cards) = showdown_cards.get(&player_index) {
                            state.hole_cards[player_index] = cards.clone();
                        } else {
                            // Unknown cards - leave empty
                            state.hole_cards[player_index] = vec![];
                        }

                        if state.actor_index.is_none() {
                            state.actor_index =
                                Some(state.find_next_active_player((2 + 1) % state.num_players));
                        }
                    }
                }
            }
            p if p.starts_with('p') => {
                // Player action
                if let Some(player_str) = p.strip_prefix('p') {
                    if let Ok(player_num) = player_str.parse::<usize>() {
                        let player_index = player_num - 1;

                        // Only generate training examples for players with known cards
                        if showdown_cards.contains_key(&player_index) {
                            if parts.len() >= 2 && parts[1] != "sm" {
                                // Create training example
                                let static_state = vectorize_static_state(
                                    &state,
                                    player_index,
                                    &hand_data.starting_stacks,
                                );

                                // Pad action sequence
                                let mut action_seq = Vec::new();
                                for past_action in action_history_this_street
                                    .iter()
                                    .rev()
                                    .take(MAX_ACTIONS_PER_STREET)
                                    .rev()
                                {
                                    if let Some(actor_str) = past_action.split_whitespace().next() {
                                        if let Some(actor_player_str) = actor_str.strip_prefix('p')
                                        {
                                            if let Ok(actor_num) = actor_player_str.parse::<usize>()
                                            {
                                                let actor_idx = actor_num - 1;
                                                action_seq.push(vectorize_action_for_sequence(
                                                    &state,
                                                    past_action,
                                                    actor_idx,
                                                ));
                                            }
                                        }
                                    }
                                }
                                while action_seq.len() < MAX_ACTIONS_PER_STREET {
                                    action_seq.insert(0, vec![0.0; ACTION_VEC_LEN]);
                                }

                                let target = vectorize_target_action(&state, action_str);
                                let outcome =
                                    player_profits.get(player_index).copied().unwrap_or(0.0);

                                static_states.push(static_state);
                                action_sequences.push(action_seq);
                                target_actions.push(target);
                                outcomes.push(outcome);
                            }
                        }

                        // Update state based on action
                        if parts.len() >= 2 {
                            match parts[1] {
                                "f" => state.fold(),
                                "cc" => state.check_or_call(),
                                "cbr" => {
                                    if parts.len() >= 3 {
                                        if let Ok(amount) = parts[2].parse::<f32>() {
                                            state.complete_bet_or_raise_to(amount);
                                        }
                                    }
                                }
                                "sm" => {
                                    // Showdown - don't advance state
                                }
                                _ => {}
                            }
                        }

                        // Record action for sequence history (exclude showdown)
                        if parts.len() >= 2 && parts[1] != "sm" {
                            action_history_this_street.push(action_str.clone());
                        }
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

fn process_file_batch_into(
    phh_file: &Path,
    max_hands: usize,
    all_static: &mut Vec<Vec<f32>>,
    all_sequences: &mut Vec<Vec<Vec<f32>>>,
    all_targets: &mut Vec<Vec<f32>>,
    all_outcomes: &mut Vec<f32>,
) -> Result<(usize, usize)> {
    let hands = parse_phhs_file(phh_file)?;
    let mut hands_processed = 0;
    let mut showdown_hands = 0;

    for hand_data in hands.into_iter().take(max_hands) {
        if let Ok((static_states, sequences, targets, hand_outcomes)) =
            process_hand_for_transformer(&hand_data)
        {
            if !static_states.is_empty() {
                showdown_hands += 1;
                hands_processed += 1;
                for i in 0..static_states.len() {
                    all_static.push(static_states[i].clone());
                    all_sequences.push(sequences[i].clone());
                    all_targets.push(targets[i].clone());
                    all_outcomes.push(hand_outcomes[i]);
                }
            }
        }
    }

    Ok((hands_processed, showdown_hands))
}

fn main() -> Result<()> {
    let args = Args::parse();

    println!("HandHQ Poker Preprocessing (Showdown Hands Only)");
    println!("=================================================\n");

    let dataset_dir = &args.dataset;
    let output_filename = &args.output;
    let max_hands_per_file = args.max_hands;

    // Find all .phh and .phhs files (recursively)
    println!("Scanning for .phhs files in HandHQ dataset...");
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
            "No .phhs files found in {} (searched recursively)",
            dataset_dir.display()
        );
    }

    // Determine dimensions from first valid hand
    println!("Determining dimensions...");
    let mut static_state_size = 0;
    let mut checked_files = 0;
    let mut checked_hands = 0;

    for phh_file in phh_files.iter().take(50) {
        checked_files += 1;
        if let Ok(hands) = parse_phhs_file(phh_file) {
            for hand in hands.iter().take(100) {
                checked_hands += 1;
                if let Ok((static_states, _, _, _)) = process_hand_for_transformer(hand) {
                    if let Some(first_state) = static_states.first() {
                        static_state_size = first_state.len();
                        println!(
                            "✓ Found valid showdown hand after checking {} files, {} hands",
                            checked_files, checked_hands
                        );
                        break;
                    }
                }
            }
            if static_state_size > 0 {
                break;
            }
        }
    }

    if static_state_size == 0 {
        anyhow::bail!(
            "Could not determine static state size after checking {} files and {} hands.\n\
             This likely means no hands went to showdown with revealed cards.\n\
             Try a different HandHQ subdirectory or check if the data contains showdown hands.",
            checked_files,
            checked_hands
        );
    }

    println!("Static state size: {}\n", static_state_size);

    println!("Processing HandHQ files (showdown hands only)...");

    let pb = ProgressBar::new(phh_files.len() as u64);
    pb.set_style(
        ProgressStyle::default_bar()
            .template(
                "{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} ({eta})",
            )
            .unwrap()
            .progress_chars("#>-"),
    );

    let estimated_examples = phh_files.len().saturating_mul(200).max(1000);
    let pb_mutex = Mutex::new(pb);

    let chunk_size = 10.max(phh_files.len() / rayon::current_num_threads().max(1));

    let file_results: Vec<_> = phh_files
        .par_chunks(chunk_size)
        .map(|chunk| {
            let mut batch_static: Vec<Vec<f32>> = Vec::new();
            let mut batch_sequences: Vec<Vec<Vec<f32>>> = Vec::new();
            let mut batch_targets: Vec<Vec<f32>> = Vec::new();
            let mut batch_outcomes: Vec<f32> = Vec::new();
            let mut chunk_hands = 0;
            let mut chunk_showdown = 0;

            for phh_file in chunk {
                if let Ok((hands, showdown)) = process_file_batch_into(
                    phh_file,
                    max_hands_per_file,
                    &mut batch_static,
                    &mut batch_sequences,
                    &mut batch_targets,
                    &mut batch_outcomes,
                ) {
                    chunk_hands += hands;
                    chunk_showdown += showdown;
                }

                if let Ok(pb) = pb_mutex.lock() {
                    pb.inc(1);
                }
            }

            (
                batch_static,
                batch_sequences,
                batch_targets,
                batch_outcomes,
                chunk_hands,
                chunk_showdown,
            )
        })
        .collect();

    if let Ok(pb) = pb_mutex.lock() {
        pb.finish_with_message("Done!");
    }

    // Merge results
    println!("\nMerging results from {} chunks...", file_results.len());
    let mut all_static: Vec<Vec<f32>> = Vec::with_capacity(estimated_examples);
    let mut all_sequences: Vec<Vec<Vec<f32>>> = Vec::with_capacity(estimated_examples);
    let mut all_targets: Vec<Vec<f32>> = Vec::with_capacity(estimated_examples);
    let mut all_outcomes: Vec<f32> = Vec::with_capacity(estimated_examples);
    let mut total_hands = 0;
    let mut total_showdown = 0;

    for (static_batch, seq_batch, target_batch, outcome_batch, hands, showdown) in file_results {
        total_hands += hands;
        total_showdown += showdown;
        all_static.extend(static_batch);
        all_sequences.extend(seq_batch);
        all_targets.extend(target_batch);
        all_outcomes.extend(outcome_batch);
    }

    let num_examples = all_static.len();

    println!("\nStats:");
    println!("  Total hands processed: {}", total_hands);
    println!("  Showdown hands: {}", total_showdown);
    println!("  Training examples: {}", num_examples);
    println!(
        "  Showdown rate: {:.1}%",
        (total_showdown as f32 / total_hands.max(1) as f32) * 100.0
    );

    if num_examples == 0 {
        anyhow::bail!("No training examples generated! All hands may have been filtered.");
    }

    println!("\nConverting to NumPy arrays...");

    // Convert to ndarray
    let mut static_flat: Vec<f32> = Vec::with_capacity(num_examples * static_state_size);
    for s in &all_static {
        static_flat.extend_from_slice(&s[..]);
    }
    let static_array = Array2::from_shape_vec((num_examples, static_state_size), static_flat)
        .context("Failed to build static_array")?;

    let seq_stride = MAX_ACTIONS_PER_STREET * ACTION_VEC_LEN;
    let mut sequences_flat = vec![0.0f32; num_examples * seq_stride];
    for i in 0..num_examples {
        for j in 0..all_sequences[i].len().min(MAX_ACTIONS_PER_STREET) {
            let offset = i * seq_stride + j * ACTION_VEC_LEN;
            sequences_flat[offset..offset + ACTION_VEC_LEN]
                .copy_from_slice(&all_sequences[i][j][..]);
        }
    }
    let sequences_array = Array3::from_shape_vec(
        (num_examples, MAX_ACTIONS_PER_STREET, ACTION_VEC_LEN),
        sequences_flat,
    )
    .context("Failed to build sequences_array")?;

    let mut targets_flat: Vec<f32> = Vec::with_capacity(num_examples * 2);
    for t in &all_targets {
        targets_flat.extend_from_slice(&t[..]);
    }
    let targets_array = Array2::from_shape_vec((num_examples, 2), targets_flat)
        .context("Failed to build targets_array")?;

    let outcomes_array = Array1::from_vec(all_outcomes);

    println!("Writing NPZ file...");

    let npz_file = File::create(output_filename)?;
    let mut npz = zip::ZipWriter::new(npz_file);

    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .compression_level(Some(6))
        .large_file(true);

    // Write arrays
    npz.start_file("static_states.npy", options)?;
    let mut buffer = Vec::new();
    ndarray_npy::WriteNpyExt::write_npy(&static_array, &mut buffer)?;
    npz.write_all(&buffer)?;

    npz.start_file("action_sequences.npy", options)?;
    buffer.clear();
    ndarray_npy::WriteNpyExt::write_npy(&sequences_array, &mut buffer)?;
    npz.write_all(&buffer)?;

    npz.start_file("target_actions.npy", options)?;
    buffer.clear();
    ndarray_npy::WriteNpyExt::write_npy(&targets_array, &mut buffer)?;
    npz.write_all(&buffer)?;

    npz.start_file("outcomes.npy", options)?;
    buffer.clear();
    ndarray_npy::WriteNpyExt::write_npy(&outcomes_array, &mut buffer)?;
    npz.write_all(&buffer)?;

    // Write metadata
    npz.start_file("metadata.json", options)?;
    let metadata = format!(
        r#"{{"num_hands": {}, "showdown_hands": {}, "num_examples": {}, "num_files": {}, "showdown_rate": {:.3}}}"#,
        total_hands,
        total_showdown,
        num_examples,
        phh_files.len(),
        (total_showdown as f32 / total_hands.max(1) as f32)
    );
    npz.write_all(metadata.as_bytes())?;

    npz.finish()?;

    println!(
        "\n✓ Successfully processed {} examples from {} showdown hands",
        num_examples, total_showdown
    );
    println!("✓ Output: {}", output_filename);
    println!("\nNote: Only players who showed cards at showdown are included in training data.");

    Ok(())
}
