/// Common utilities for poker hand preprocessing
/// Only contains card parsing - state management is dataset-specific

// Constants
pub const MAX_ACTIONS_PER_STREET: usize = 20;
pub const MAX_PLAYERS: usize = 6;
pub const NUM_CARDS: usize = 52;
pub const UNKNOWN_CARD: usize = 52;
pub const ACTION_VEC_LEN: usize = 10; // player_onehot (6) + action_onehot (3) + amount (1)

/// Convert card string (e.g., "Ah", "2c") to integer 0-51
pub fn card_to_int(card_str: &str) -> usize {
    if card_str.len() != 2 || card_str == "??" {
        return UNKNOWN_CARD;
    }

    let rank_char = card_str.chars().nth(0).unwrap();
    let suit_char = card_str.chars().nth(1).unwrap();

    let rank = match rank_char {
        '2' => 0,
        '3' => 1,
        '4' => 2,
        '5' => 3,
        '6' => 4,
        '7' => 5,
        '8' => 6,
        '9' => 7,
        'T' => 8,
        'J' => 9,
        'Q' => 10,
        'K' => 11,
        'A' => 12,
        _ => return UNKNOWN_CARD,
    };

    let suit = match suit_char {
        'c' => 0,
        'd' => 1,
        'h' => 2,
        's' => 3,
        _ => return UNKNOWN_CARD,
    };

    rank * 4 + suit
}

pub fn parse_cards(cards_str: &str) -> Vec<u8> {
    let mut cards = Vec::new();
    let mut i = 0;
    let chars: Vec<char> = cards_str.chars().collect();

    while i + 1 < chars.len() {
        let card_str: String = chars[i..i + 2].iter().collect();
        let card_idx = card_to_int(&card_str);
        if card_idx < UNKNOWN_CARD {
            cards.push(card_idx as u8);
        }
        i += 2;
    }
    cards
}

/// Decompose card index (0-51) into (rank, suit)
/// Rank: 0-12 (2, 3, 4, 5, 6, 7, 8, 9, T, J, Q, K, A)
/// Suit: 0-3 (clubs, diamonds, hearts, spades)
#[inline]
pub fn card_to_rank_suit(card: u8) -> (u8, u8) {
    let rank = card / 4;
    let suit = card % 4;
    (rank, suit)
}
