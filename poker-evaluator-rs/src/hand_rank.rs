/**
 * Texas Hold'em Hand Categories, Ranks, and Tiebreaker Ordering in Rust.
 */

use crate::card::Card;
use std::cmp::Ordering;
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(u8)]
pub enum HandCategory {
    HighCard = 1,
    OnePair = 2,
    TwoPair = 3,
    ThreeOfAKind = 4,
    Straight = 5,
    Flush = 6,
    FullHouse = 7,
    FourOfAKind = 8,
    StraightFlush = 9,
}

impl HandCategory {
    pub fn name_en(&self) -> &'static str {
        match self {
            HandCategory::HighCard => "High Card",
            HandCategory::OnePair => "One Pair",
            HandCategory::TwoPair => "Two Pair",
            HandCategory::ThreeOfAKind => "Three of a Kind",
            HandCategory::Straight => "Straight",
            HandCategory::Flush => "Flush",
            HandCategory::FullHouse => "Full House",
            HandCategory::FourOfAKind => "Four of a Kind",
            HandCategory::StraightFlush => "Straight Flush",
        }
    }

    pub fn name_es(&self) -> &'static str {
        match self {
            HandCategory::HighCard => "Carta Alta",
            HandCategory::OnePair => "Pareja",
            HandCategory::TwoPair => "Doble Pareja",
            HandCategory::ThreeOfAKind => "Trío",
            HandCategory::Straight => "Escalera",
            HandCategory::Flush => "Color",
            HandCategory::FullHouse => "Full",
            HandCategory::FourOfAKind => "Póker",
            HandCategory::StraightFlush => "Escalera de Color",
        }
    }
}

/// Evaluated poker hand with exact category and 5 tiebreaker values.
/// Ordering is mathematically derived directly from (category, tiebreakers).
#[derive(Debug, Clone, Eq)]
pub struct HandRank {
    pub category: HandCategory,
    /// 5-slot tiebreaker array in descending priority order
    pub tiebreakers: [u8; 5],
    /// The best 5 cards forming this hand
    pub best_five: [Card; 5],
    /// Human-readable English description
    pub description_en: String,
    /// Human-readable Spanish description
    pub description_es: String,
}

impl HandRank {
    pub fn new(
        category: HandCategory,
        tiebreakers: [u8; 5],
        best_five: [Card; 5],
        description_en: String,
        description_es: String,
    ) -> Self {
        Self {
            category,
            tiebreakers,
            best_five,
            description_en,
            description_es,
        }
    }

    pub fn is_royal_flush(&self) -> bool {
        self.category == HandCategory::StraightFlush && self.tiebreakers[0] == 14
    }

    /// Primary score integer for fast comparisons (guaranteed monotonic)
    pub fn primary_score(&self) -> u32 {
        let cat = self.category as u32;
        let t0 = self.tiebreakers[0] as u32;
        let t1 = self.tiebreakers[1] as u32;
        let t2 = self.tiebreakers[2] as u32;
        let t3 = self.tiebreakers[3] as u32;
        let t4 = self.tiebreakers[4] as u32;

        (cat << 20) | (t0 << 16) | (t1 << 12) | (t2 << 8) | (t3 << 4) | t4
    }
}

impl PartialEq for HandRank {
    fn eq(&self, other: &Self) -> bool {
        self.category == other.category && self.tiebreakers == other.tiebreakers
    }
}

impl Ord for HandRank {
    fn cmp(&self, other: &Self) -> Ordering {
        match self.category.cmp(&other.category) {
            Ordering::Equal => self.tiebreakers.cmp(&other.tiebreakers),
            other_order => other_order,
        }
    }
}

impl PartialOrd for HandRank {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl fmt::Display for HandRank {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            f,
            "{} ({}) [{}{}{}{}{}]",
            self.description_es,
            self.category.name_es(),
            self.best_five[0],
            self.best_five[1],
            self.best_five[2],
            self.best_five[3],
            self.best_five[4],
        )
    }
}

/// Result of a Texas Hold'em showdown between two players
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ShowdownResult {
    HeroWins {
        hero_rank: HandRank,
        villain_rank: HandRank,
    },
    VillainWins {
        hero_rank: HandRank,
        villain_rank: HandRank,
    },
    SplitPot {
        rank: HandRank,
        is_playing_the_board: bool,
    },
}

impl fmt::Display for ShowdownResult {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ShowdownResult::HeroWins { hero_rank, villain_rank } => {
                write!(
                    f,
                    "Hero Gana con {} frente a {}",
                    hero_rank.description_es, villain_rank.description_es
                )
            }
            ShowdownResult::VillainWins { hero_rank, villain_rank } => {
                write!(
                    f,
                    "Villano Gana con {} frente a {}",
                    villain_rank.description_es, hero_rank.description_es
                )
            }
            ShowdownResult::SplitPot { rank, is_playing_the_board } => {
                if *is_playing_the_board {
                    write!(
                        f,
                        "Bote Compartido (Empate): Ambos juegan las 5 cartas del tablero [{}]",
                        rank.description_es
                    )
                } else {
                    write!(
                        f,
                        "Bote Compartido (Empate): Manos equivalentes con [{}]",
                        rank.description_es
                    )
                }
            }
        }
    }
}
