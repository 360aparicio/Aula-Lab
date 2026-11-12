/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 169 Canonical Hand Categories and 1326 Combinations Generator with Blocker logic.
 */

import { Card, cardId, cardToString, parseCard, Rank, RANKS, RANK_VALUES, Suit, SUITS } from './cards';

export type HandType = 'pair' | 'suited' | 'offsuit';

export interface CanonicalHand {
  name: string; // e.g. "AA", "AKs", "AKo"
  rank1: Rank;
  rank2: Rank;
  type: HandType;
  row: number; // 0 (Ace) to 12 (Two) in 13x13 grid
  col: number; // 0 (Ace) to 12 (Two) in 13x13 grid
  combos: ConcreteCombo[];
}

export interface ConcreteCombo {
  card1: Card;
  card2: Card;
  key: string; // e.g. "AhKd"
  canonicalName: string;
}

// Map 13x13 grid indices (0=Ace down to 12=Two)
// Row is rank 1, Col is rank 2
export function getRankFromIndex(index: number): Rank {
  return RANKS[12 - index]; // 0 -> 'A', 1 -> 'K', ..., 12 -> '2'
}

export function getIndexFromRank(rank: Rank): number {
  return 12 - RANK_VALUES[rank];
}

// Generate all 169 canonical hands and their 1326 concrete combos
export function generateCanonicalGrid(): CanonicalHand[][] {
  const grid: CanonicalHand[][] = [];

  for (let row = 0; row < 13; row++) {
    const rowList: CanonicalHand[] = [];
    const r1 = getRankFromIndex(row);

    for (let col = 0; col < 13; col++) {
      const r2 = getRankFromIndex(col);
      let name: string;
      let type: HandType;
      const combos: ConcreteCombo[] = [];

      if (row === col) {
        // Pocket pair: 6 combos
        name = `${r1}${r2}`;
        type = 'pair';
        for (let i = 0; i < SUITS.length; i++) {
          for (let j = i + 1; j < SUITS.length; j++) {
            const c1: Card = { rank: r1, suit: SUITS[i], id: cardId(r1, SUITS[i]) };
            const c2: Card = { rank: r2, suit: SUITS[j], id: cardId(r2, SUITS[j]) };
            combos.push({
              card1: c1,
              card2: c2,
              key: `${cardToString(c1)}${cardToString(c2)}`,
              canonicalName: name
            });
          }
        }
      } else if (row < col) {
        // Suited hand (higher rank first): 4 combos
        name = `${r1}${r2}s`;
        type = 'suited';
        for (const s of SUITS) {
          const c1: Card = { rank: r1, suit: s, id: cardId(r1, s) };
          const c2: Card = { rank: r2, suit: s, id: cardId(r2, s) };
          combos.push({
            card1: c1,
            card2: c2,
            key: `${cardToString(c1)}${cardToString(c2)}`,
            canonicalName: name
          });
        }
      } else {
        // Offsuit hand (higher rank first): 12 combos
        name = `${r2}${r1}o`;
        type = 'offsuit';
        for (const s1 of SUITS) {
          for (const s2 of SUITS) {
            if (s1 !== s2) {
              const c1: Card = { rank: r2, suit: s1, id: cardId(r2, s1) };
              const c2: Card = { rank: r1, suit: s2, id: cardId(r1, s2) };
              combos.push({
                card1: c1,
                card2: c2,
                key: `${cardToString(c1)}${cardToString(c2)}`,
                canonicalName: name
              });
            }
          }
        }
      }

      rowList.push({
        name,
        rank1: row <= col ? r1 : r2,
        rank2: row <= col ? r2 : r1,
        type,
        row,
        col,
        combos
      });
    }
    grid.push(rowList);
  }

  return grid;
}

export const CANONICAL_GRID = generateCanonicalGrid();

export const CANONICAL_MAP: Map<string, CanonicalHand> = new Map();
for (const row of CANONICAL_GRID) {
  for (const hand of row) {
    CANONICAL_MAP.set(hand.name, hand);
  }
}

/**
 * Filter concrete combos that are blocked by board cards or dead cards.
 */
export function getActiveCombos(
  canonicalName: string,
  deadCards: Card[]
): ConcreteCombo[] {
  const hand = CANONICAL_MAP.get(canonicalName);
  if (!hand) return [];

  const deadSet = new Set(deadCards.map(c => c.id));
  return hand.combos.filter(
    combo => !deadSet.has(combo.card1.id) && !deadSet.has(combo.card2.id)
  );
}

/**
 * Count total available combos for a hand given dead cards.
 */
export function getActiveComboCount(
  canonicalName: string,
  deadCards: Card[]
): number {
  return getActiveCombos(canonicalName, deadCards).length;
}

/**
 * Create a ConcreteCombo from any two distinct cards.
 */
export function createConcreteComboFromCards(c1: Card, c2: Card): ConcreteCombo {
  if (c1.id === c2.id) {
    throw new Error('A hand must consist of two distinct cards');
  }

  const r1Val = RANK_VALUES[c1.rank];
  const r2Val = RANK_VALUES[c2.rank];

  let first = c1;
  let second = c2;
  if (r2Val > r1Val) {
    first = c2;
    second = c1;
  }

  const isPair = first.rank === second.rank;
  const isSuited = !isPair && first.suit === second.suit;
  const canonicalName = isPair
    ? `${first.rank}${second.rank}`
    : isSuited
    ? `${first.rank}${second.rank}s`
    : `${first.rank}${second.rank}o`;

  return {
    card1: first,
    card2: second,
    key: `${cardToString(first)}${cardToString(second)}`,
    canonicalName
  };
}

