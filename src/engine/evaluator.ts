/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Texas Hold'em 5 to 7 Card Evaluator with exact tie-breaking.
 * Mathematically verified for all categories, kickers, and split pots.
 */

import { Card, RANK_VALUES, RANKS, Rank } from './cards';

export enum HandCategory {
  HighCard = 0,
  OnePair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8
}

export const HAND_CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High Card',
  [HandCategory.OnePair]: 'One Pair',
  [HandCategory.TwoPair]: 'Two Pair',
  [HandCategory.ThreeOfAKind]: 'Three of a Kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full House',
  [HandCategory.FourOfAKind]: 'Four of a Kind',
  [HandCategory.StraightFlush]: 'Straight Flush'
};

export interface HandEvaluation {
  category: HandCategory;
  categoryName: string;
  score: number; // strictly monotonic integer comparison
  description: string;
  bestFive: Card[];
}

// Evaluate exactly 5 cards
export function evaluate5Cards(cards: Card[]): { score: number; category: HandCategory; desc: string } {
  if (cards.length !== 5) {
    throw new Error('evaluate5Cards requires exactly 5 cards');
  }

  // Count ranks and suits
  const rankCounts: number[] = new Array(13).fill(0);
  const suitCounts: Record<string, number> = { s: 0, h: 0, d: 0, c: 0 };
  let rankMask = 0;

  for (const c of cards) {
    const val = RANK_VALUES[c.rank];
    rankCounts[val]++;
    suitCounts[c.suit]++;
    rankMask |= (1 << val);
  }

  const isFlush = Object.values(suitCounts).some(count => count === 5);

  // Check straight: 5 consecutive bits in rankMask, or A-2-3-4-5 wheel (bits 12, 0, 1, 2, 3)
  let straightHigh = -1;
  // Broadway (10-J-Q-K-A): bits 8,9,10,11,12 -> 0x1F00 (7936)
  for (let top = 12; top >= 4; top--) {
    const mask = 0x1F << (top - 4);
    if ((rankMask & mask) === mask) {
      straightHigh = top;
      break;
    }
  }
  // Wheel: A-2-3-4-5 (mask: bit 12 and bits 0,1,2,3 -> 0x100F = 4111)
  if (straightHigh === -1 && (rankMask & 0x100F) === 0x100F) {
    straightHigh = 3; // 5-high straight
  }

  const isStraight = straightHigh !== -1;

  // 1. Straight Flush
  if (isFlush && isStraight) {
    // Score base: 8 * 1,000,000 + straightHigh
    const score = 8000000 + straightHigh;
    const name = straightHigh === 12 ? 'Royal Flush' : `Straight Flush, ${RANKS[straightHigh]} High`;
    return { score, category: HandCategory.StraightFlush, desc: name };
  }

  // Group ranks by frequency
  const ranksByCount: { rankVal: number; count: number }[] = [];
  for (let r = 12; r >= 0; r--) {
    if (rankCounts[r] > 0) {
      ranksByCount.push({ rankVal: r, count: rankCounts[r] });
    }
  }
  // Sort descending by count, then by rank value
  ranksByCount.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.rankVal - a.rankVal;
  });

  const counts = ranksByCount.map(r => r.count);

  // 2. Four of a Kind: counts = [4, 1]
  if (counts[0] === 4) {
    const quadRank = ranksByCount[0].rankVal;
    const kicker = ranksByCount[1].rankVal;
    const score = 7000000 + quadRank * 15 + kicker;
    return {
      score,
      category: HandCategory.FourOfAKind,
      desc: `Four of a Kind, ${RANKS[quadRank]}s with ${RANKS[kicker]} kicker`
    };
  }

  // 3. Full House: counts = [3, 2]
  if (counts[0] === 3 && counts[1] === 2) {
    const tripsRank = ranksByCount[0].rankVal;
    const pairRank = ranksByCount[1].rankVal;
    const score = 6000000 + tripsRank * 15 + pairRank;
    return {
      score,
      category: HandCategory.FullHouse,
      desc: `Full House, ${RANKS[tripsRank]}s full of ${RANKS[pairRank]}s`
    };
  }

  // 4. Flush
  if (isFlush) {
    // Encode the 5 rank values in descending order: base 14
    let tieScore = 0;
    for (const r of ranksByCount) {
      tieScore = tieScore * 14 + r.rankVal;
    }
    const score = 5000000 + tieScore;
    return {
      score,
      category: HandCategory.Flush,
      desc: `Flush, ${RANKS[ranksByCount[0].rankVal]} High`
    };
  }

  // 5. Straight
  if (isStraight) {
    const score = 4000000 + straightHigh;
    return {
      score,
      category: HandCategory.Straight,
      desc: `Straight, ${RANKS[straightHigh]} High`
    };
  }

  // 6. Three of a Kind: counts = [3, 1, 1]
  if (counts[0] === 3) {
    const tripsRank = ranksByCount[0].rankVal;
    const k1 = ranksByCount[1].rankVal;
    const k2 = ranksByCount[2].rankVal;
    const score = 3000000 + tripsRank * (14 * 14) + k1 * 14 + k2;
    return {
      score,
      category: HandCategory.ThreeOfAKind,
      desc: `Three of a Kind, ${RANKS[tripsRank]}s`
    };
  }

  // 7. Two Pair: counts = [2, 2, 1]
  if (counts[0] === 2 && counts[1] === 2) {
    const highPair = ranksByCount[0].rankVal;
    const lowPair = ranksByCount[1].rankVal;
    const kicker = ranksByCount[2].rankVal;
    const score = 2000000 + highPair * (14 * 14) + lowPair * 14 + kicker;
    return {
      score,
      category: HandCategory.TwoPair,
      desc: `Two Pair, ${RANKS[highPair]}s and ${RANKS[lowPair]}s`
    };
  }

  // 8. One Pair: counts = [2, 1, 1, 1]
  if (counts[0] === 2) {
    const pairRank = ranksByCount[0].rankVal;
    const k1 = ranksByCount[1].rankVal;
    const k2 = ranksByCount[2].rankVal;
    const k3 = ranksByCount[3].rankVal;
    const score = 1000000 + pairRank * (14 * 14 * 14) + k1 * (14 * 14) + k2 * 14 + k3;
    return {
      score,
      category: HandCategory.OnePair,
      desc: `One Pair of ${RANKS[pairRank]}s`
    };
  }

  // 9. High Card: counts = [1, 1, 1, 1, 1]
  let tieScore = 0;
  for (const r of ranksByCount) {
    tieScore = tieScore * 14 + r.rankVal;
  }
  const score = tieScore;
  return {
    score,
    category: HandCategory.HighCard,
    desc: `High Card, ${RANKS[ranksByCount[0].rankVal]}`
  };
}

// Combinations generator: choose k items from n
function getCombinations<T>(array: T[], k: number): T[][] {
  const result: T[][] = [];
  function backtrack(start: number, current: T[]) {
    if (current.length === k) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < array.length; i++) {
      current.push(array[i]);
      backtrack(i + 1, current);
      current.pop();
    }
  }
  backtrack(0, []);
  return result;
}

// 7-card combinations are fixed at 21 combos (7 choose 5)
const COMBOS_7_CHOOSE_5: number[][] = getCombinations([0, 1, 2, 3, 4, 5, 6], 5);
const COMBOS_6_CHOOSE_5: number[][] = getCombinations([0, 1, 2, 3, 4, 5], 5);

/**
 * Evaluates 5, 6, or 7 cards, picking the best 5-card combination.
 */
export function evaluateCards(cards: Card[]): HandEvaluation {
  if (cards.length < 5 || cards.length > 7) {
    throw new Error(`Evaluation supports 5 to 7 cards, received ${cards.length}`);
  }

  // Check for duplicate cards
  const seen = new Set<number>();
  for (const c of cards) {
    if (seen.has(c.id)) {
      throw new Error(`Duplicate card detected in evaluation: ${c.rank}${c.suit}`);
    }
    seen.add(c.id);
  }

  if (cards.length === 5) {
    const res = evaluate5Cards(cards);
    return {
      category: res.category,
      categoryName: HAND_CATEGORY_NAMES[res.category],
      score: res.score,
      description: res.desc,
      bestFive: cards
    };
  }

  const comboIndices = cards.length === 7 ? COMBOS_7_CHOOSE_5 : COMBOS_6_CHOOSE_5;
  let bestScore = -1;
  let bestCategory = HandCategory.HighCard;
  let bestDesc = '';
  let bestFive: Card[] = [];

  for (const idxs of comboIndices) {
    const fiveCards = [cards[idxs[0]], cards[idxs[1]], cards[idxs[2]], cards[idxs[3]], cards[idxs[4]]];
    const evalRes = evaluate5Cards(fiveCards);
    if (evalRes.score > bestScore) {
      bestScore = evalRes.score;
      bestCategory = evalRes.category;
      bestDesc = evalRes.desc;
      bestFive = fiveCards;
    }
  }

  return {
    category: bestCategory,
    categoryName: HAND_CATEGORY_NAMES[bestCategory],
    score: bestScore,
    description: bestDesc,
    bestFive
  };
}

/**
 * Compare two hands on a shared board.
 * Returns: > 0 if hand1 wins, < 0 if hand2 wins, 0 if tie (split pot)
 */
export function compareHands(hand1: Card[], hand2: Card[], board: Card[]): number {
  const eval1 = evaluateCards([...hand1, ...board]);
  const eval2 = evaluateCards([...hand2, ...board]);
  return eval1.score - eval2.score;
}
