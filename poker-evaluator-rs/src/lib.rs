/**
 * @license
 * Apache-2.0
 * 
 * High-performance Texas Hold'em 5-to-7 Card Evaluator in Rust.
 */

pub mod card;
pub mod hand_rank;
pub mod evaluator;

pub use card::{Card, CardParseError, Rank, Suit, parse_cards};
pub use hand_rank::{HandCategory, HandRank, ShowdownResult};
pub use evaluator::{
    evaluate_5, evaluate_6, evaluate_7, evaluate_hand, compare_showdown, EvaluationError,
};

/// Convenience function to evaluate a string of cards, e.g. "As Kh Qd 2c 7h 4s 9d"
pub fn eval_str(cards_str: &str) -> Result<HandRank, Box<dyn std::error::Error>> {
    let cards = parse_cards(cards_str)?;
    let rank = evaluate_hand(&cards)?;
    Ok(rank)
}

/// Convenience function to evaluate showdown from strings:
/// hero: "As Kh", villain: "Qd Qs", board: "Ac 7d 2h 4s 9c"
pub fn showdown_str(
    hero_str: &str,
    villain_str: &str,
    board_str: &str,
) -> Result<ShowdownResult, Box<dyn std::error::Error>> {
    let hero = parse_cards(hero_str)?;
    let villain = parse_cards(villain_str)?;
    let board = parse_cards(board_str)?;

    if hero.len() != 2 {
        return Err("Hero must have exactly 2 hole cards".into());
    }
    if villain.len() != 2 {
        return Err("Villain must have exactly 2 hole cards".into());
    }

    let hero_hole = [hero[0], hero[1]];
    let villain_hole = [villain[0], villain[1]];

    let res = compare_showdown(&hero_hole, &villain_hole, &board)?;
    Ok(res)
}
