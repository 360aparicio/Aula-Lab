/**
 * Texas Hold'em Card, Rank, and Suit representations in Rust.
 */

use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(u8)]
pub enum Suit {
    Spades = 0,
    Hearts = 1,
    Diamonds = 2,
    Clubs = 3,
}

impl Suit {
    pub const ALL: [Suit; 4] = [Suit::Spades, Suit::Hearts, Suit::Diamonds, Suit::Clubs];

    pub fn symbol(&self) -> &'static str {
        match self {
            Suit::Spades => "♠",
            Suit::Hearts => "♥",
            Suit::Diamonds => "♦",
            Suit::Clubs => "♣",
        }
    }

    pub fn char_code(&self) -> char {
        match self {
            Suit::Spades => 's',
            Suit::Hearts => 'h',
            Suit::Diamonds => 'd',
            Suit::Clubs => 'c',
        }
    }

    pub fn name_es(&self) -> &'static str {
        match self {
            Suit::Spades => "Picas",
            Suit::Hearts => "Corazones",
            Suit::Diamonds => "Diamantes",
            Suit::Clubs => "Tréboles",
        }
    }
}

impl TryFrom<char> for Suit {
    type Error = CardParseError;

    fn try_from(c: char) -> Result<Self, Self::Error> {
        match c.to_ascii_lowercase() {
            's' | '♠' => Ok(Suit::Spades),
            'h' | '♥' => Ok(Suit::Hearts),
            'd' | '♦' => Ok(Suit::Diamonds),
            'c' | '♣' => Ok(Suit::Clubs),
            _ => Err(CardParseError::InvalidSuit(c)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[repr(u8)]
pub enum Rank {
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9,
    Ten = 10,
    Jack = 11,
    Queen = 12,
    King = 13,
    Ace = 14,
}

impl Rank {
    pub const ALL: [Rank; 13] = [
        Rank::Two,
        Rank::Three,
        Rank::Four,
        Rank::Five,
        Rank::Six,
        Rank::Seven,
        Rank::Eight,
        Rank::Nine,
        Rank::Ten,
        Rank::Jack,
        Rank::Queen,
        Rank::King,
        Rank::Ace,
    ];

    #[inline]
    pub fn value(&self) -> u8 {
        *self as u8
    }

    pub fn char_code(&self) -> char {
        match self {
            Rank::Two => '2',
            Rank::Three => '3',
            Rank::Four => '4',
            Rank::Five => '5',
            Rank::Six => '6',
            Rank::Seven => '7',
            Rank::Eight => '8',
            Rank::Nine => '9',
            Rank::Ten => 'T',
            Rank::Jack => 'J',
            Rank::Queen => 'Q',
            Rank::King => 'K',
            Rank::Ace => 'A',
        }
    }

    pub fn name_singular_es(&self) -> &'static str {
        match self {
            Rank::Two => "Dos",
            Rank::Three => "Tres",
            Rank::Four => "Cuatro",
            Rank::Five => "Cinco",
            Rank::Six => "Seis",
            Rank::Seven => "Siete",
            Rank::Eight => "Ocho",
            Rank::Nine => "Nueve",
            Rank::Ten => "Diez",
            Rank::Jack => "Jota",
            Rank::Queen => "Dama",
            Rank::King => "Rey",
            Rank::Ace => "As",
        }
    }

    pub fn name_plural_es(&self) -> &'static str {
        match self {
            Rank::Two => "Doses",
            Rank::Three => "Treses",
            Rank::Four => "Cuatros",
            Rank::Five => "Cincos",
            Rank::Six => "Seises",
            Rank::Seven => "Sietes",
            Rank::Eight => "Ochos",
            Rank::Nine => "Nueves",
            Rank::Ten => "Dieces",
            Rank::Jack => "Jotas",
            Rank::Queen => "Damas",
            Rank::King => "Reyes",
            Rank::Ace => "Ases",
        }
    }
}

impl TryFrom<u8> for Rank {
    type Error = CardParseError;

    fn try_from(val: u8) -> Result<Self, Self::Error> {
        match val {
            2 => Ok(Rank::Two),
            3 => Ok(Rank::Three),
            4 => Ok(Rank::Four),
            5 => Ok(Rank::Five),
            6 => Ok(Rank::Six),
            7 => Ok(Rank::Seven),
            8 => Ok(Rank::Eight),
            9 => Ok(Rank::Nine),
            10 => Ok(Rank::Ten),
            11 => Ok(Rank::Jack),
            12 => Ok(Rank::Queen),
            13 => Ok(Rank::King),
            14 => Ok(Rank::Ace),
            _ => Err(CardParseError::InvalidRankValue(val)),
        }
    }
}

impl TryFrom<char> for Rank {
    type Error = CardParseError;

    fn try_from(c: char) -> Result<Self, Self::Error> {
        match c.to_ascii_uppercase() {
            '2' => Ok(Rank::Two),
            '3' => Ok(Rank::Three),
            '4' => Ok(Rank::Four),
            '5' => Ok(Rank::Five),
            '6' => Ok(Rank::Six),
            '7' => Ok(Rank::Seven),
            '8' => Ok(Rank::Eight),
            '9' => Ok(Rank::Nine),
            'T' => Ok(Rank::Ten),
            'J' => Ok(Rank::Jack),
            'Q' => Ok(Rank::Queen),
            'K' => Ok(Rank::King),
            'A' => Ok(Rank::Ace),
            _ => Err(CardParseError::InvalidRankChar(c)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct Card {
    pub rank: Rank,
    pub suit: Suit,
}

impl Card {
    pub const fn new(rank: Rank, suit: Suit) -> Self {
        Self { rank, suit }
    }

    /// Unique index 0..51
    pub fn id(&self) -> u8 {
        (self.rank.value() - 2) * 4 + (self.suit as u8)
    }

    pub fn from_id(id: u8) -> Result<Self, CardParseError> {
        if id >= 52 {
            return Err(CardParseError::InvalidCardId(id));
        }
        let rank_val = (id / 4) + 2;
        let suit_val = id % 4;
        let rank = Rank::try_from(rank_val)?;
        let suit = match suit_val {
            0 => Suit::Spades,
            1 => Suit::Hearts,
            2 => Suit::Diamonds,
            _ => Suit::Clubs,
        };
        Ok(Self::new(rank, suit))
    }
}

impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", self.rank.char_code(), self.suit.symbol())
    }
}

impl FromStr for Card {
    type Err = CardParseError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            return Err(CardParseError::EmptyString);
        }

        // Support both "10s" and "Ts"
        if trimmed.starts_with("10") {
            if trimmed.len() < 3 {
                return Err(CardParseError::InvalidLength(trimmed.to_string()));
            }
            let suit_char = trimmed.chars().nth(2).unwrap();
            let suit = Suit::try_from(suit_char)?;
            return Ok(Card::new(Rank::Ten, suit));
        }

        let mut chars = trimmed.chars();
        let rank_char = chars.next().ok_or(CardParseError::EmptyString)?;
        let suit_char = chars.next().ok_or_else(|| CardParseError::InvalidLength(trimmed.to_string()))?;

        let rank = Rank::try_from(rank_char)?;
        let suit = Suit::try_from(suit_char)?;

        Ok(Card::new(rank, suit))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CardParseError {
    EmptyString,
    InvalidLength(String),
    InvalidRankChar(char),
    InvalidRankValue(u8),
    InvalidSuit(char),
    InvalidCardId(u8),
}

impl fmt::Display for CardParseError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            CardParseError::EmptyString => write!(f, "Cadena vacía al parsear carta"),
            CardParseError::InvalidLength(s) => write!(f, "Longitud inválida para carta: '{}'", s),
            CardParseError::InvalidRankChar(c) => write!(f, "Rango de carta inválido: '{}'", c),
            CardParseError::InvalidRankValue(v) => write!(f, "Valor de rango inválido: {}", v),
            CardParseError::InvalidSuit(c) => write!(f, "Palo de carta inválido: '{}'", c),
            CardParseError::InvalidCardId(id) => write!(f, "ID de carta fuera de rango 0..51: {}", id),
        }
    }
}

impl std::error::Error for CardParseError {}

/// Parse multiple cards separated by whitespace or comma, e.g. "As Kh Qd 2c 7h"
pub fn parse_cards(input: &str) -> Result<Vec<Card>, CardParseError> {
    input
        .split(|c: char| c.is_whitespace() || c == ',')
        .filter(|part| !part.is_empty())
        .map(|s| s.parse::<Card>())
        .collect()
}
