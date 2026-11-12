/**
 * Texas Hold'em 5 to 7 Card Evaluator with exact tie-breaking.
 * Supports arbitrary 5, 6, and 7 card combinations (hole cards + board).
 */

use crate::card::{Card, Rank};
use crate::hand_rank::{HandCategory, HandRank, ShowdownResult};
use std::cmp::Ordering;
use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EvaluationError {
    InvalidCardCount { received: usize, expected: &'static str },
    DuplicateCard(Card),
    InvalidBoardCount(usize),
}

impl fmt::Display for EvaluationError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EvaluationError::InvalidCardCount { received, expected } => {
                write!(f, "Número de cartas inválido: recibido {}, esperado {}", received, expected)
            }
            EvaluationError::DuplicateCard(card) => {
                write!(f, "Carta duplicada detectada: {}", card)
            }
            EvaluationError::InvalidBoardCount(count) => {
                write!(f, "Número de cartas del tablero inválido: {} (debe ser 3, 4 o 5)", count)
            }
        }
    }
}

impl std::error::Error for EvaluationError {}

// All 21 combinations of 5 cards from 7 (indices 0..7)
const COMBOS_7_CHOOSE_5: [[usize; 5]; 21] = [
    [0, 1, 2, 3, 4],
    [0, 1, 2, 3, 5],
    [0, 1, 2, 3, 6],
    [0, 1, 2, 4, 5],
    [0, 1, 2, 4, 6],
    [0, 1, 2, 5, 6],
    [0, 1, 3, 4, 5],
    [0, 1, 3, 4, 6],
    [0, 1, 3, 5, 6],
    [0, 1, 4, 5, 6],
    [0, 2, 3, 4, 5],
    [0, 2, 3, 4, 6],
    [0, 2, 3, 5, 6],
    [0, 2, 4, 5, 6],
    [0, 3, 4, 5, 6],
    [1, 2, 3, 4, 5],
    [1, 2, 3, 4, 6],
    [1, 2, 3, 5, 6],
    [1, 2, 4, 5, 6],
    [1, 3, 4, 5, 6],
    [2, 3, 4, 5, 6],
];

// All 6 combinations of 5 cards from 6
const COMBOS_6_CHOOSE_5: [[usize; 5]; 6] = [
    [0, 1, 2, 3, 4],
    [0, 1, 2, 3, 5],
    [0, 1, 2, 4, 5],
    [0, 1, 3, 4, 5],
    [0, 2, 3, 4, 5],
    [1, 2, 3, 4, 5],
];

/// Evaluates exactly 5 cards and returns the exact HandRank.
pub fn evaluate_5(cards: &[Card; 5]) -> HandRank {
    // Sort cards descending by rank value
    let mut sorted = *cards;
    sorted.sort_by(|a, b| b.rank.value().cmp(&a.rank.value()));

    let is_flush = sorted.iter().all(|c| c.suit == sorted[0].suit);

    // Count rank occurrences
    let mut rank_counts = [0u8; 15]; // index 2..14
    for c in &sorted {
        rank_counts[c.rank.value() as usize] += 1;
    }

    // Check straight
    let mut is_straight = false;
    let mut straight_high = 0u8;

    // Check regular straight
    for top in (6..=14).rev() {
        if rank_counts[top] >= 1
            && rank_counts[top - 1] >= 1
            && rank_counts[top - 2] >= 1
            && rank_counts[top - 3] >= 1
            && rank_counts[top - 4] >= 1
        {
            is_straight = true;
            straight_high = top as u8;
            break;
        }
    }

    // Check wheel straight: A-2-3-4-5 (Ace plays low, straight is 5-high)
    let is_wheel = !is_straight
        && rank_counts[14] >= 1
        && rank_counts[2] >= 1
        && rank_counts[3] >= 1
        && rank_counts[4] >= 1
        && rank_counts[5] >= 1;

    if is_wheel {
        is_straight = true;
        straight_high = 5;
    }

    // Reorder best_five for wheel straight: 5, 4, 3, 2, A
    let wheel_sorted = if is_wheel {
        let c5 = sorted.iter().find(|c| c.rank.value() == 5).unwrap();
        let c4 = sorted.iter().find(|c| c.rank.value() == 4).unwrap();
        let c3 = sorted.iter().find(|c| c.rank.value() == 3).unwrap();
        let c2 = sorted.iter().find(|c| c.rank.value() == 2).unwrap();
        let ca = sorted.iter().find(|c| c.rank.value() == 14).unwrap();
        [*c5, *c4, *c3, *c2, *ca]
    } else {
        sorted
    };

    // 1. Straight Flush / Royal Flush
    if is_flush && is_straight {
        let is_royal = straight_high == 14;
        let desc_en = if is_royal {
            format!("Royal Flush in {}", sorted[0].suit.symbol())
        } else {
            format!("Straight Flush, {} High", Rank::try_from(straight_high).unwrap().char_code())
        };
        let desc_es = if is_royal {
            format!("Escalera Real de {}", sorted[0].suit.name_es())
        } else {
            format!("Escalera de Color al {}", Rank::try_from(straight_high).unwrap().name_singular_es())
        };

        return HandRank::new(
            HandCategory::StraightFlush,
            [straight_high, 0, 0, 0, 0],
            wheel_sorted,
            desc_en,
            desc_es,
        );
    }

    // Group ranks by frequency: (count, rank_val)
    let mut groups: Vec<(u8, u8)> = Vec::new();
    for r in (2..=14).rev() {
        let count = rank_counts[r];
        if count > 0 {
            groups.push((count, r as u8));
        }
    }
    // Sort by count descending, then rank descending
    groups.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| b.1.cmp(&a.1)));

    // 2. Four of a Kind: count = [4, 1]
    if groups[0].0 == 4 {
        let quad_rank = groups[0].1;
        let kicker_rank = groups[1].1;
        let quad_r = Rank::try_from(quad_rank).unwrap();
        let kicker_r = Rank::try_from(kicker_rank).unwrap();

        // Sort best_five: four quads first, then kicker
        let mut best = [sorted[0]; 5];
        let mut idx = 0;
        for c in &sorted {
            if c.rank.value() == quad_rank {
                best[idx] = *c;
                idx += 1;
            }
        }
        for c in &sorted {
            if c.rank.value() == kicker_rank {
                best[idx] = *c;
                idx += 1;
            }
        }

        let desc_en = format!("Four of a Kind, {}s with {} kicker", quad_r.char_code(), kicker_r.char_code());
        let desc_es = format!("Póker de {} con {} de kicker", quad_r.name_plural_es(), kicker_r.name_singular_es());

        return HandRank::new(
            HandCategory::FourOfAKind,
            [quad_rank, kicker_rank, 0, 0, 0],
            best,
            desc_en,
            desc_es,
        );
    }

    // 3. Full House: count = [3, 2]
    if groups[0].0 == 3 && groups[1].0 == 2 {
        let trips_rank = groups[0].1;
        let pair_rank = groups[1].1;
        let trips_r = Rank::try_from(trips_rank).unwrap();
        let pair_r = Rank::try_from(pair_rank).unwrap();

        let mut best = [sorted[0]; 5];
        let mut idx = 0;
        for c in &sorted {
            if c.rank.value() == trips_rank {
                best[idx] = *c;
                idx += 1;
            }
        }
        for c in &sorted {
            if c.rank.value() == pair_rank {
                best[idx] = *c;
                idx += 1;
            }
        }

        let desc_en = format!("Full House, {}s full of {}s", trips_r.char_code(), pair_r.char_code());
        let desc_es = format!("Full de {} y {}", trips_r.name_plural_es(), pair_r.name_plural_es());

        return HandRank::new(
            HandCategory::FullHouse,
            [trips_rank, pair_rank, 0, 0, 0],
            best,
            desc_en,
            desc_es,
        );
    }

    // 4. Flush
    if is_flush {
        let t0 = sorted[0].rank.value();
        let t1 = sorted[1].rank.value();
        let t2 = sorted[2].rank.value();
        let t3 = sorted[3].rank.value();
        let t4 = sorted[4].rank.value();

        let high_r = sorted[0].rank;
        let desc_en = format!("Flush, {} High", high_r.char_code());
        let desc_es = format!("Color al {} ({})", high_r.name_singular_es(), sorted[0].suit.name_es());

        return HandRank::new(
            HandCategory::Flush,
            [t0, t1, t2, t3, t4],
            sorted,
            desc_en,
            desc_es,
        );
    }

    // 5. Straight
    if is_straight {
        let high_r = Rank::try_from(straight_high).unwrap();
        let desc_en = if is_wheel {
            "Straight, Five High (Wheel)".to_string()
        } else {
            format!("Straight, {} High", high_r.char_code())
        };
        let desc_es = if is_wheel {
            "Escalera a la Rueda (Al Cinco, A-2-3-4-5)".to_string()
        } else {
            format!("Escalera al {}", high_r.name_singular_es())
        };

        return HandRank::new(
            HandCategory::Straight,
            [straight_high, 0, 0, 0, 0],
            wheel_sorted,
            desc_en,
            desc_es,
        );
    }

    // 6. Three of a Kind: count = [3, 1, 1]
    if groups[0].0 == 3 {
        let trips_rank = groups[0].1;
        let k1 = groups[1].1;
        let k2 = groups[2].1;
        let trips_r = Rank::try_from(trips_rank).unwrap();

        let mut best = [sorted[0]; 5];
        let mut idx = 0;
        for c in &sorted {
            if c.rank.value() == trips_rank {
                best[idx] = *c;
                idx += 1;
            }
        }
        for c in &sorted {
            if c.rank.value() == k1 {
                best[idx] = *c;
                idx += 1;
            }
        }
        for c in &sorted {
            if c.rank.value() == k2 {
                best[idx] = *c;
                idx += 1;
            }
        }

        let desc_en = format!("Three of a Kind, {}s", trips_r.char_code());
        let desc_es = format!("Trío de {}", trips_r.name_plural_es());

        return HandRank::new(
            HandCategory::ThreeOfAKind,
            [trips_rank, k1, k2, 0, 0],
            best,
            desc_en,
            desc_es,
        );
    }

    // 7. Two Pair: count = [2, 2, 1]
    if groups[0].0 == 2 && groups[1].0 == 2 {
        let high_pair = groups[0].1;
        let low_pair = groups[1].1;
        let kicker = groups[2].1;
        let hp_r = Rank::try_from(high_pair).unwrap();
        let lp_r = Rank::try_from(low_pair).unwrap();
        let k_r = Rank::try_from(kicker).unwrap();

        let mut best = [sorted[0]; 5];
        let mut idx = 0;
        for c in &sorted {
            if c.rank.value() == high_pair {
                best[idx] = *c;
                idx += 1;
            }
        }
        for c in &sorted {
            if c.rank.value() == low_pair {
                best[idx] = *c;
                idx += 1;
            }
        }
        for c in &sorted {
            if c.rank.value() == kicker {
                best[idx] = *c;
                idx += 1;
            }
        }

        let desc_en = format!("Two Pair, {}s and {}s with {} kicker", hp_r.char_code(), lp_r.char_code(), k_r.char_code());
        let desc_es = format!("Doble Pareja de {} y {} con {} de kicker", hp_r.name_plural_es(), lp_r.name_plural_es(), k_r.name_singular_es());

        return HandRank::new(
            HandCategory::TwoPair,
            [high_pair, low_pair, kicker, 0, 0],
            best,
            desc_en,
            desc_es,
        );
    }

    // 8. One Pair: count = [2, 1, 1, 1]
    if groups[0].0 == 2 {
        let pair_rank = groups[0].1;
        let k1 = groups[1].1;
        let k2 = groups[2].1;
        let k3 = groups[3].1;
        let pair_r = Rank::try_from(pair_rank).unwrap();

        let mut best = [sorted[0]; 5];
        let mut idx = 0;
        for c in &sorted {
            if c.rank.value() == pair_rank {
                best[idx] = *c;
                idx += 1;
            }
        }
        for c in &sorted {
            if c.rank.value() == k1 {
                best[idx] = *c;
                idx += 1;
            }
        }
        for c in &sorted {
            if c.rank.value() == k2 {
                best[idx] = *c;
                idx += 1;
            }
        }
        for c in &sorted {
            if c.rank.value() == k3 {
                best[idx] = *c;
                idx += 1;
            }
        }

        let desc_en = format!("One Pair of {}s", pair_r.char_code());
        let desc_es = format!("Pareja de {}", pair_r.name_plural_es());

        return HandRank::new(
            HandCategory::OnePair,
            [pair_rank, k1, k2, k3, 0],
            best,
            desc_en,
            desc_es,
        );
    }

    // 9. High Card: count = [1, 1, 1, 1, 1]
    let t0 = sorted[0].rank.value();
    let t1 = sorted[1].rank.value();
    let t2 = sorted[2].rank.value();
    let t3 = sorted[3].rank.value();
    let t4 = sorted[4].rank.value();

    let high_r = sorted[0].rank;
    let desc_en = format!("High Card, {}", high_r.char_code());
    let desc_es = format!("Carta Alta al {}", high_r.name_singular_es());

    HandRank::new(
        HandCategory::HighCard,
        [t0, t1, t2, t3, t4],
        sorted,
        desc_en,
        desc_es,
    )
}

/// Evaluates exactly 6 cards by picking the maximum HandRank from all 6 5-card combinations.
pub fn evaluate_6(cards: &[Card; 6]) -> HandRank {
    let mut best: Option<HandRank> = None;

    for idxs in COMBOS_6_CHOOSE_5 {
        let five = [
            cards[idxs[0]],
            cards[idxs[1]],
            cards[idxs[2]],
            cards[idxs[3]],
            cards[idxs[4]],
        ];
        let rank = evaluate_5(&five);
        match &best {
            None => best = Some(rank),
            Some(curr) => {
                if rank > *curr {
                    best = Some(rank);
                }
            }
        }
    }

    best.unwrap()
}

/// Evaluates exactly 7 cards (2 hole cards + 5 board cards in Texas Hold'em)
/// by picking the maximum HandRank from all 21 5-card combinations.
pub fn evaluate_7(cards: &[Card; 7]) -> HandRank {
    let mut best: Option<HandRank> = None;

    for idxs in COMBOS_7_CHOOSE_5 {
        let five = [
            cards[idxs[0]],
            cards[idxs[1]],
            cards[idxs[2]],
            cards[idxs[3]],
            cards[idxs[4]],
        ];
        let rank = evaluate_5(&five);
        match &best {
            None => best = Some(rank),
            Some(curr) => {
                if rank > *curr {
                    best = Some(rank);
                }
            }
        }
    }

    best.unwrap()
}

/// Evaluates a hand of 5, 6, or 7 cards, validating uniqueness and card count.
pub fn evaluate_hand(cards: &[Card]) -> Result<HandRank, EvaluationError> {
    if cards.len() < 5 || cards.len() > 7 {
        return Err(EvaluationError::InvalidCardCount {
            received: cards.len(),
            expected: "entre 5 y 7 cartas",
        });
    }

    // Check duplicate cards
    for i in 0..cards.len() {
        for j in (i + 1)..cards.len() {
            if cards[i].id() == cards[j].id() {
                return Err(EvaluationError::DuplicateCard(cards[i]));
            }
        }
    }

    match cards.len() {
        5 => {
            let mut five = [cards[0]; 5];
            five.copy_from_slice(cards);
            Ok(evaluate_5(&five))
        }
        6 => {
            let mut six = [cards[0]; 6];
            six.copy_from_slice(cards);
            Ok(evaluate_6(&six))
        }
        7 => {
            let mut seven = [cards[0]; 7];
            seven.copy_from_slice(cards);
            Ok(evaluate_7(&seven))
        }
        _ => unreachable!(),
    }
}

/// Compares two players' hands on a Texas Hold'em community board (3, 4, or 5 cards).
/// Handles kicker resolution, suited/offsuit permutations, and shared board split pots.
pub fn compare_showdown(
    hero_hole: &[Card; 2],
    villain_hole: &[Card; 2],
    board: &[Card],
) -> Result<ShowdownResult, EvaluationError> {
    if board.len() < 3 || board.len() > 5 {
        return Err(EvaluationError::InvalidBoardCount(board.len()));
    }

    // Combine all cards to verify no duplicates across players & board
    let mut all_cards = Vec::with_capacity(4 + board.len());
    all_cards.extend_from_slice(hero_hole);
    all_cards.extend_from_slice(villain_hole);
    all_cards.extend_from_slice(board);

    for i in 0..all_cards.len() {
        for j in (i + 1)..all_cards.len() {
            if all_cards[i].id() == all_cards[j].id() {
                return Err(EvaluationError::DuplicateCard(all_cards[i]));
            }
        }
    }

    let mut hero_all = Vec::with_capacity(2 + board.len());
    hero_all.extend_from_slice(hero_hole);
    hero_all.extend_from_slice(board);
    let hero_rank = evaluate_hand(&hero_all)?;

    let mut villain_all = Vec::with_capacity(2 + board.len());
    villain_all.extend_from_slice(villain_hole);
    villain_all.extend_from_slice(board);
    let villain_rank = evaluate_hand(&villain_all)?;

    match hero_rank.cmp(&villain_rank) {
        Ordering::Greater => Ok(ShowdownResult::HeroWins {
            hero_rank,
            villain_rank,
        }),
        Ordering::Less => Ok(ShowdownResult::VillainWins {
            hero_rank,
            villain_rank,
        }),
        Ordering::Equal => {
            // Check if playing the board: are best_five exactly board cards?
            let is_board_played = board.len() == 5 && {
                let mut board_ids: Vec<u8> = board.iter().map(|c| c.id()).collect();
                board_ids.sort_unstable();
                let mut hero_five_ids: Vec<u8> = hero_rank.best_five.iter().map(|c| c.id()).collect();
                hero_five_ids.sort_unstable();
                board_ids == hero_five_ids
            };

            Ok(ShowdownResult::SplitPot {
                rank: hero_rank,
                is_playing_the_board: is_board_played,
            })
        }
    }
}
