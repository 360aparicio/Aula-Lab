use poker_evaluator::*;

#[test]
fn test_royal_flush() {
    let hands = [
        "As Ks Qs Js Ts",
        "Ah Kh Qh Jh Th",
        "Ad Kd Qd Jd Td",
        "Ac Kc Qc Jc Tc",
    ];

    for h in hands {
        let rank = eval_str(h).expect("Should evaluate royal flush");
        assert_eq!(rank.category, HandCategory::StraightFlush);
        assert_eq!(rank.tiebreakers[0], 14);
        assert!(rank.is_royal_flush());
    }
}

#[test]
fn test_straight_flush_and_wheel() {
    // 9-high straight flush
    let sf_9 = eval_str("9s 8s 7s 6s 5s").unwrap();
    assert_eq!(sf_9.category, HandCategory::StraightFlush);
    assert_eq!(sf_9.tiebreakers[0], 9);

    // Steel wheel (A-2-3-4-5 straight flush)
    let wheel_sf = eval_str("As 5s 4s 3s 2s").unwrap();
    assert_eq!(wheel_sf.category, HandCategory::StraightFlush);
    assert_eq!(wheel_sf.tiebreakers[0], 5); // 5-high!

    // 6-high straight flush beats 5-high steel wheel
    let sf_6 = eval_str("6s 5s 4s 3s 2s").unwrap();
    assert_eq!(sf_6.category, HandCategory::StraightFlush);
    assert!(sf_6 > wheel_sf);
    assert!(sf_9 > sf_6);
}

#[test]
fn test_four_of_a_kind() {
    // Quads comparison
    let quads_aces = eval_str("As Ah Ad Ac Ks").unwrap();
    let quads_kings = eval_str("Ks Kh Kd Kc As").unwrap();
    assert_eq!(quads_aces.category, HandCategory::FourOfAKind);
    assert_eq!(quads_kings.category, HandCategory::FourOfAKind);
    assert!(quads_aces > quads_kings);

    // Kicker comparison with same quads
    let quads_queens_ace = eval_str("Qs Qh Qd Qc As").unwrap();
    let quads_queens_king = eval_str("Qs Qh Qd Qc Ks").unwrap();
    assert!(quads_queens_ace > quads_queens_king);
    assert_eq!(quads_queens_ace.tiebreakers[1], 14);
    assert_eq!(quads_queens_king.tiebreakers[1], 13);
}

#[test]
fn test_full_house() {
    // Trips comparison takes priority
    let fh_aces_full_twos = eval_str("As Ah Ad 2c 2s").unwrap();
    let fh_kings_full_queens = eval_str("Ks Kh Kd Qc Qs").unwrap();
    assert_eq!(fh_aces_full_twos.category, HandCategory::FullHouse);
    assert_eq!(fh_kings_full_queens.category, HandCategory::FullHouse);
    assert!(fh_aces_full_twos > fh_kings_full_queens);

    // Pair comparison when trips are identical
    let fh_jacks_full_tens = eval_str("Js Jh Jd Ts Tc").unwrap();
    let fh_jacks_full_nines = eval_str("Js Jh Jd 9s 9c").unwrap();
    assert!(fh_jacks_full_tens > fh_jacks_full_nines);
}

#[test]
fn test_full_house_7_cards_multiple_trips_and_pairs() {
    // 7 cards with two sets of trips: KKK and QQQ plus a 2
    // Should choose KKK and QQ (Kings full of Queens)
    let rank = eval_str("Ks Kh Kd Qs Qh Qd 2c").unwrap();
    assert_eq!(rank.category, HandCategory::FullHouse);
    assert_eq!(rank.tiebreakers[0], 13); // Kings trips
    assert_eq!(rank.tiebreakers[1], 12); // Queens pair

    // 7 cards with trips and two pairs: 777, 44, 22
    // Should choose 777 and 44
    let rank2 = eval_str("7s 7h 7d 4s 4c 2s 2d").unwrap();
    assert_eq!(rank2.category, HandCategory::FullHouse);
    assert_eq!(rank2.tiebreakers[0], 7);
    assert_eq!(rank2.tiebreakers[1], 4);
}

#[test]
fn test_flush_tiebreakers() {
    // Flush tiebreakers descending down to 5th card
    let f1 = eval_str("As Qs Js 9s 4s").unwrap();
    let f2 = eval_str("As Qs Js 9s 3s").unwrap();
    assert_eq!(f1.category, HandCategory::Flush);
    assert_eq!(f2.category, HandCategory::Flush);
    assert!(f1 > f2);

    // 7 cards of same suit: selects the 5 highest
    let f_7cards = eval_str("As Ks Qs Ts 8s 6s 2s").unwrap();
    assert_eq!(f_7cards.category, HandCategory::Flush);
    assert_eq!(f_7cards.tiebreakers, [14, 13, 12, 10, 8]);
}

#[test]
fn test_straight_variations() {
    // Broadway straight
    let broadway = eval_str("As Kd Qh Js Tc").unwrap();
    assert_eq!(broadway.category, HandCategory::Straight);
    assert_eq!(broadway.tiebreakers[0], 14);

    // Wheel straight (A-2-3-4-5)
    let wheel = eval_str("As 2c 3d 4h 5s").unwrap();
    assert_eq!(wheel.category, HandCategory::Straight);
    assert_eq!(wheel.tiebreakers[0], 5);

    // 6-high straight beats wheel
    let six_high = eval_str("6s 5c 4d 3h 2s").unwrap();
    assert!(six_high > wheel);
    assert!(broadway > six_high);

    // 7 cards containing a 7-card run: 5,6,7,8,9,T,J -> selects highest (J-high)
    let run7 = eval_str("5s 6c 7d 8h 9s Ts Jc").unwrap();
    assert_eq!(run7.category, HandCategory::Straight);
    assert_eq!(run7.tiebreakers[0], 11); // Jack high
}

#[test]
fn test_three_of_a_kind() {
    let trips_kicker1 = eval_str("8s 8h 8d As Kc").unwrap();
    let trips_kicker2 = eval_str("8s 8h 8d As Qc").unwrap();
    assert_eq!(trips_kicker1.category, HandCategory::ThreeOfAKind);
    assert!(trips_kicker1 > trips_kicker2);
}

#[test]
fn test_two_pair_and_7_cards_three_pairs() {
    // High pair dominates
    let tp1 = eval_str("As Ah 2s 2c Kd").unwrap();
    let tp2 = eval_str("Ks Kh Qs Qc Ad").unwrap();
    assert!(tp1 > tp2); // Aces and Twos beats Kings and Queens

    // Kicker decides when pairs match
    let tp_q_kicker = eval_str("Js Jh Ts Tc Qd").unwrap();
    let tp_9_kicker = eval_str("Js Jh Ts Tc 9d").unwrap();
    assert!(tp_q_kicker > tp_9_kicker);

    // 7 cards with 3 pairs: AA, KK, QQ and an 8
    // Must pick AA, KK with Q kicker
    let three_pairs = eval_str("As Ah Ks Kh Qs Qh 8c").unwrap();
    assert_eq!(three_pairs.category, HandCategory::TwoPair);
    assert_eq!(three_pairs.tiebreakers, [14, 13, 12, 0, 0]);
}

#[test]
fn test_one_pair_kickers() {
    let p_ak = eval_str("Ts Th As Kd 8c").unwrap();
    let p_aq = eval_str("Ts Th As Qd 8c").unwrap();
    assert_eq!(p_ak.category, HandCategory::OnePair);
    assert!(p_ak > p_aq);

    // Third kicker test
    let p_3rd_high = eval_str("Ts Th As Kd 7c").unwrap();
    let p_3rd_low = eval_str("Ts Th As Kd 6c").unwrap();
    assert!(p_3rd_high > p_3rd_low);
}

#[test]
fn test_high_card() {
    let hc1 = eval_str("As Kd Qd Jc 9s").unwrap();
    let hc2 = eval_str("As Kd Qd Jc 8s").unwrap();
    assert_eq!(hc1.category, HandCategory::HighCard);
    assert!(hc1 > hc2);
}

#[test]
fn test_texas_holdem_showdown_kicker_battle() {
    // Hero: A♠ K♥ vs Villain: A♦ Q♣
    // Board: A♣ 8♦ 6♠ 4♥ 2♣
    let result = showdown_str("As Kh", "Ad Qc", "Ac 8d 6s 4h 2c").unwrap();
    match result {
        ShowdownResult::HeroWins { hero_rank, villain_rank } => {
            assert_eq!(hero_rank.category, HandCategory::OnePair);
            assert_eq!(hero_rank.tiebreakers[1], 13); // King kicker
            assert_eq!(villain_rank.tiebreakers[1], 12); // Queen kicker
        }
        _ => panic!("Hero should win with King kicker"),
    }
}

#[test]
fn test_texas_holdem_playing_the_board_split_pot() {
    // Board has a Royal Flush: A♠ K♠ Q♠ J♠ T♠
    // Neither player holds a spade that can improve the board
    let result = showdown_str("2c 3c", "4d 5d", "As Ks Qs Js Ts").unwrap();
    match result {
        ShowdownResult::SplitPot { rank, is_playing_the_board } => {
            assert_eq!(rank.category, HandCategory::StraightFlush);
            assert!(rank.is_royal_flush());
            assert!(is_playing_the_board);
        }
        _ => panic!("Should be a split pot playing the board"),
    }
}

#[test]
fn test_texas_holdem_counterfeited_two_pair() {
    // Hero has 44, Villain has 33.
    // Board runs out: 9 9 8 8 A
    // Both players' pocket pairs are counterfeited: the best 5 cards for both are 9-9-8-8-A!
    let result = showdown_str("4s 4h", "3s 3h", "9c 9d 8c 8d As").unwrap();
    match result {
        ShowdownResult::SplitPot { rank, is_playing_the_board } => {
            assert_eq!(rank.category, HandCategory::TwoPair);
            assert_eq!(rank.tiebreakers, [9, 8, 14, 0, 0]);
            assert!(is_playing_the_board);
        }
        _ => panic!("Should be a split pot due to counterfeiting"),
    }
}

#[test]
fn test_texas_holdem_flush_vs_straight_on_wet_board() {
    // Hero holds suited connector 9♠ 8♠ (makes flush)
    // Villain holds offsuit A♥ Q♦ (makes broadway straight A-K-Q-J-T)
    // Board: J♠ T♠ 2♠ K♣ 7♦
    let result = showdown_str("9s 8s", "Ah Qd", "Js Ts 2s Kc 7d").unwrap();
    match result {
        ShowdownResult::HeroWins { hero_rank, villain_rank } => {
            assert_eq!(hero_rank.category, HandCategory::Flush);
            assert_eq!(villain_rank.category, HandCategory::Straight);
        }
        _ => panic!("Flush must beat Straight"),
    }
}

#[test]
fn test_texas_holdem_split_pot_identical_straight() {
    // Hero has 9♠ 8♥, Villain has 9♦ 7♣
    // Board: T♠ J♦ Q♥ K♠ 2♣
    // Both players use 9 to complete Broadway 9-T-J-Q-K (King-high straight)
    let result = showdown_str("9s 8h", "9d 7c", "Ts Jd Qh Ks 2c").unwrap();
    match result {
        ShowdownResult::SplitPot { rank, is_playing_the_board } => {
            assert_eq!(rank.category, HandCategory::Straight);
            assert_eq!(rank.tiebreakers[0], 13); // King high
            assert!(!is_playing_the_board); // Using hole card 9
        }
        _ => panic!("Should be a split pot with identical straight"),
    }
}

#[test]
fn test_error_handling() {
    // Duplicate card in hand
    assert!(eval_str("As As Kh Qd Jc").is_err());

    // Duplicate card across hole and board
    assert!(showdown_str("As Kh", "Qd Jc", "As 8d 6s 4h 2c").is_err());

    // Too few cards
    assert!(eval_str("As Kh Qd").is_err());

    // Too many cards (8 cards)
    assert!(eval_str("As Kh Qd Jc Ts 9d 8c 7h").is_err());

    // Invalid card format
    assert!(eval_str("Xx 10s Kh Qd Jc").is_err());
}
