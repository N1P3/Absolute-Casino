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

/// Pluribus poker hand history preprocessor (one hand per .phh file)
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to directory containing Pluribus .phh files
    #[arg(short, long, default_value = "dataset/pluribus")]
    dataset: PathBuf,

    /// Output NPZ filename
    #[arg(short, long, default_value = "poker_transformer_pluribus.npz")]
    output: String,

    /// Maximum files to process (0 = all)
    #[arg(short, long, default_value_t = 0)]
    max_files: usize,
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

// Include all the poker state and helper functions from main.rs
#[derive(Debug, Clone)]
struct PokerState {
    stacks: Vec<u32>,
    bets: Vec<u32>,
    total_pot: u32,
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
            total_pot: 0,
            hole_cards: vec![vec![]; num_players],
            board_cards: Vec::new(),
            street_index: 0,
            actor_index: None,
            num_players,
            button_index: 0,
            folded: vec![false; num_players],
        };

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
        if self.actor_index.is_none() {
            self.actor_index = Some(self.find_next_active_player((2 + 1) % self.num_players));
        }
    }

    fn deal_board(&mut self, cards_str: &str) {
        self.board_cards.extend(parse_cards(cards_str));
        self.street_index += 1;
        self.total_pot += self.bets.iter().sum::<u32>();
        self.bets = vec![0; self.num_players];
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

            let max_bet = *self.bets.iter().max().unwrap_or(&0);
            let all_called = self
                .bets
                .iter()
                .enumerate()
                .all(|(i, &bet)| self.folded[i] || self.stacks[i] == 0 || bet == max_bet);

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
    // New compact encoding: 2 hole IDs + 5 board IDs + 6 normalized stack positions
    // + 1 normalized pot + 4 street one‑hot = 18 features
    let mut vec = Vec::with_capacity(18);

    // Hole card IDs (2 entries)
    let mut hole_ids = vec![UNKNOWN_CARD as u8; 2];
    if player_index < state.hole_cards.len() {
        for (i, &card) in state.hole_cards[player_index].iter().take(2).enumerate() {
            if (card as usize) < NUM_CARDS {
                hole_ids[i] = card;
            }
        }
    }
    // Convert u8 IDs to f32 before extending
    vec.extend(hole_ids.iter().map(|&id| id as f32));

    // Board card IDs (5 entries)
    let mut board_ids = vec![UNKNOWN_CARD as u8; 5];
    for (i, &card) in state.board_cards.iter().take(5).enumerate() {
        if (card as usize) < NUM_CARDS {
            board_ids[i] = card;
        }
    }
    // Convert u8 IDs to f32 before extending
    vec.extend(board_ids.iter().map(|&id| id as f32));

    // Relative positions (normalized stacks)
    let normalizer = *starting_stacks.iter().max().unwrap_or(&1) as f32;
    let normalizer = normalizer.max(1.0);
    let mut positions = vec![0.0f32; 6];
    for i in 0..state.num_players.min(MAX_PLAYERS) {
        let relative_idx = (i + state.num_players - player_index) % state.num_players;
        if relative_idx < MAX_PLAYERS {
            positions[relative_idx] = state.stacks[i] as f32 / normalizer;
        }
    }
    vec.extend(&positions);

    // Pot size (normalized)
    vec.push(state.pot_size() as f32 / normalizer);

    // Street one‑hot (preflop, flop, turn, river)
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

    let mut player_vec = vec![0.0f32; 6];
    if actor_index < MAX_PLAYERS {
        player_vec[actor_index] = 1.0;
    }
    vec.extend(player_vec);

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
                    if let Ok(bet_amount) = parts[2].parse::<u32>() {
                        let pot = state.pot_size().max(1);
                        amount = bet_amount as f32 / pot as f32;
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
                    if let Ok(bet_amount) = parts[2].parse::<u32>() {
                        let pot = state.pot_size().max(1);
                        amount = bet_amount as f32 / pot as f32;
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
                state.deal_board(parts[2]);
                action_history_this_street.clear();
            }
            "d" if parts.len() >= 4 && parts[1] == "dh" => {
                if let Some(player_str) = parts[2].strip_prefix('p') {
                    if let Ok(player_num) = player_str.parse::<usize>() {
                        let player_index = player_num - 1;
                        state.deal_hole(player_index, parts[3]);
                    }
                }
            }
            p if p.starts_with('p') => {
                if let Some(player_str) = p.strip_prefix('p') {
                    if let Ok(player_num) = player_str.parse::<usize>() {
                        let player_index = player_num - 1;

                        if parts.len() >= 2 && parts[1] != "sm" {
                            let static_state = vectorize_static_state(
                                &state,
                                player_index,
                                &hand_data.starting_stacks,
                            );

                            let mut action_seq = Vec::new();
                            for past_action in action_history_this_street
                                .iter()
                                .rev()
                                .take(MAX_ACTIONS_PER_STREET)
                                .rev()
                            {
                                if let Some(actor_str) = past_action.split_whitespace().next() {
                                    if let Some(actor_player_str) = actor_str.strip_prefix('p') {
                                        if let Ok(actor_num) = actor_player_str.parse::<usize>() {
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
                            let outcome = player_profits.get(player_index).copied().unwrap_or(0.0);

                            static_states.push(static_state);
                            action_sequences.push(action_seq);
                            target_actions.push(target);
                            outcomes.push(outcome);
                        }

                        if parts.len() >= 2 {
                            match parts[1] {
                                "f" => state.fold(),
                                "cc" => state.check_or_call(),
                                "cbr" => {
                                    if parts.len() >= 3 {
                                        if let Ok(amount) = parts[2].parse::<u32>() {
                                            state.complete_bet_or_raise_to(amount);
                                        }
                                    }
                                }
                                _ => {}
                            }
                        }

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

fn parse_pluribus_file(filepath: &Path) -> Result<HandData> {
    let content = fs::read_to_string(filepath)
        .with_context(|| format!("Failed to read file: {}", filepath.display()))?;

    // Wrap in TOML section for parsing
    let toml_content = format!("[hand]\n{}", content);

    let mut parsed: HashMap<String, HandData> = toml::from_str(&toml_content)
        .with_context(|| format!("Failed to parse Pluribus file: {}", filepath.display()))?;

    parsed
        .remove("hand")
        .ok_or_else(|| anyhow::anyhow!("No hand data found"))
}

fn main() -> Result<()> {
    let args = Args::parse();

    println!("Pluribus Poker Preprocessing (Rust - High Performance)");
    println!("=======================================================\n");

    let dataset_dir = &args.dataset;
    let output_filename = &args.output;

    println!("Scanning for .phh files recursively...");
    let mut phh_files: Vec<PathBuf> = WalkDir::new(dataset_dir)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().and_then(|s| s.to_str()) == Some("phh"))
        .map(|e| e.path().to_path_buf())
        .collect();

    if args.max_files > 0 && phh_files.len() > args.max_files {
        phh_files.truncate(args.max_files);
    }

    println!("Found {} files\n", phh_files.len());

    if phh_files.is_empty() {
        anyhow::bail!(
            "No .phh files found in {} (searched recursively)",
            dataset_dir.display()
        );
    }

    println!("Determining dimensions...");
    let mut static_state_size = 0;
    for phh_file in phh_files.iter().take(10) {
        if let Ok(hand) = parse_pluribus_file(phh_file) {
            if let Ok((static_states, _, _, _)) = process_hand_for_transformer(&hand) {
                if let Some(first_state) = static_states.first() {
                    static_state_size = first_state.len();
                    break;
                }
            }
        }
    }

    if static_state_size == 0 {
        anyhow::bail!("Could not determine static state size");
    }

    println!("Static state size: {}\n", static_state_size);

    println!("Processing Pluribus files...");

    let pb = ProgressBar::new(phh_files.len() as u64);
    pb.set_style(
        ProgressStyle::default_bar()
            .template(
                "{spinner:.green} [{elapsed_precise}] [{bar:40.cyan/blue}] {pos}/{len} ({eta})",
            )
            .unwrap()
            .progress_chars("#>-"),
    );

    let pb_mutex = Mutex::new(pb);
    let chunk_size = 100.max(phh_files.len() / rayon::current_num_threads().max(1));

    let file_results: Vec<_> = phh_files
        .par_chunks(chunk_size)
        .map(|chunk| {
            let mut batch_static: Vec<Vec<f32>> = Vec::new();
            let mut batch_sequences: Vec<Vec<Vec<f32>>> = Vec::new();
            let mut batch_targets: Vec<Vec<f32>> = Vec::new();
            let mut batch_outcomes: Vec<f32> = Vec::new();
            let mut chunk_hands = 0;

            for phh_file in chunk {
                if let Ok(hand) = parse_pluribus_file(phh_file) {
                    if let Ok((static_states, sequences, targets, hand_outcomes)) =
                        process_hand_for_transformer(&hand)
                    {
                        chunk_hands += 1;
                        for i in 0..static_states.len() {
                            batch_static.push(static_states[i].clone());
                            batch_sequences.push(sequences[i].clone());
                            batch_targets.push(targets[i].clone());
                            batch_outcomes.push(hand_outcomes[i]);
                        }
                    }
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
            )
        })
        .collect();

    if let Ok(pb) = pb_mutex.lock() {
        pb.finish_with_message("Done!");
    }

    println!("\nMerging results...");
    let mut all_static: Vec<Vec<f32>> = Vec::new();
    let mut all_sequences: Vec<Vec<Vec<f32>>> = Vec::new();
    let mut all_targets: Vec<Vec<f32>> = Vec::new();
    let mut all_outcomes: Vec<f32> = Vec::new();
    let mut total_hands = 0;

    for (static_batch, seq_batch, target_batch, outcome_batch, hands) in file_results {
        total_hands += hands;
        all_static.extend(static_batch);
        all_sequences.extend(seq_batch);
        all_targets.extend(target_batch);
        all_outcomes.extend(outcome_batch);
    }

    let num_examples = all_static.len();

    println!("\nConverting to NumPy arrays...");

    let mut static_flat: Vec<f32> = Vec::with_capacity(num_examples * static_state_size);
    for s in &all_static {
        static_flat.extend_from_slice(&s[..]);
    }
    let static_array = Array2::from_shape_vec((num_examples, static_state_size), static_flat)?;

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
    )?;

    let mut targets_flat: Vec<f32> = Vec::with_capacity(num_examples * 2);
    for t in &all_targets {
        targets_flat.extend_from_slice(&t[..]);
    }
    let targets_array = Array2::from_shape_vec((num_examples, 2), targets_flat)?;
    let outcomes_array = Array1::from_vec(all_outcomes);

    println!("Writing NPZ file...");

    let npz_file = File::create(output_filename)?;
    let mut npz = zip::ZipWriter::new(npz_file);

    let options = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .compression_level(Some(6))
        .large_file(true);

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

    npz.start_file("metadata.json", options)?;
    let metadata = format!(
        r#"{{"num_hands": {}, "num_examples": {}, "num_files": {}}}"#,
        total_hands,
        num_examples,
        phh_files.len()
    );
    npz.write_all(metadata.as_bytes())?;

    npz.finish()?;

    println!(
        "\n✓ Successfully processed {} examples from {} hands",
        num_examples, total_hands
    );
    println!("✓ Output: {}", output_filename);

    Ok(())
}
