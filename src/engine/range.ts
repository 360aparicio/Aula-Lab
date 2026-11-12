/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 13x13 Range Matrix Model, Standard Notation Parser/Serializer & Presets.
 */

import { Card } from './cards';
import { CANONICAL_MAP, ConcreteCombo, getActiveCombos } from './combos';

export type RangeWeights = Record<string, number>; // canonicalName -> weight (0.0 to 1.0)

export interface PlayerRange {
  name: string;
  weights: RangeWeights;
}

export function createEmptyRange(name = 'Empty Range'): PlayerRange {
  return {
    name,
    weights: {}
  };
}

export function createFullRange(name = '100% Range'): PlayerRange {
  const weights: RangeWeights = {};
  for (const handName of CANONICAL_MAP.keys()) {
    weights[handName] = 1.0;
  }
  return { name, weights };
}

/**
 * Standard Range Presets
 */
export const RANGE_PRESETS: Record<string, string> = {
  'Tight Open (Top 12%)': 'AA,KK,QQ,JJ,TT,99,88,AKs,AQs,AJs,ATs,KQs,KJs,QJs,JTs,AKo,AQo,AJo,KQo',
  'Standard BTN Open (45%)': 'AA-22,AKs-A2s,KQs-K2s,QJs-Q4s,JTs-J6s,T9s-T6s,98s-96s,87s-85s,76s-74s,65s-64s,54s-53s,43s,AKo-A7o,KQo-K9o,QJo-Q9o,JTo-J9o,T9o,98o',
  'BB Defend vs BTN (38%)': 'TT-22,AJs-A2s,KJs-K2s,QJs-Q4s,JTs-J6s,T9s-T6s,98s-96s,87s-85s,76s-75s,65s,54s,AJo-A7o,KQo-K9o,QJo-Q9o,JTo-J9o,T9o,98o,87o',
  'Polarized 3-Bet BTN vs CO': 'AA-QQ,AKs,AKo,A5s-A2s,76s,65s,54s,KJs:0.5,QJs:0.5',
  'Condensed River Calling Range': 'JJ-88,ATs,KTs,QJs,JTs,T9s,AJo,KQo:0.5',
  'Polarized River Value/Bluff': 'AA,KK,AKs,76s,65s,QTo:0.5,JTo:0.5'
};

/**
 * Parses standard poker range string syntax:
 * Examples:
 * - "AA, KK, QQ"
 * - "JJ-88" (pairs range)
 * - "AKs-ATs" (suited range)
 * - "AKo-ATo" (offsuit range)
 * - "A5s:0.5" (weighted hand)
 */
export function parseRangeString(input: string, name = 'Custom Range'): PlayerRange {
  const weights: RangeWeights = {};
  if (!input || !input.trim()) {
    return { name, weights };
  }

  const tokens = input.split(',').map(t => t.trim()).filter(Boolean);

  for (const token of tokens) {
    let part = token;
    let weight = 1.0;

    // Check weight suffix e.g. "AKs:0.5" or "AKs@50"
    if (part.includes(':')) {
      const [handPart, wStr] = part.split(':');
      part = handPart.trim();
      const wVal = parseFloat(wStr);
      if (!isNaN(wVal)) {
        weight = Math.max(0, Math.min(1, wVal));
      }
    } else if (part.includes('@')) {
      const [handPart, wStr] = part.split('@');
      part = handPart.trim();
      const wVal = parseFloat(wStr) / 100;
      if (!isNaN(wVal)) {
        weight = Math.max(0, Math.min(1, wVal));
      }
    }

    // Range dash: e.g. "JJ-88", "AKs-ATs", "AKo-ATo"
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(s => s.trim());
      expandDashRange(start, end, weight, weights);
    } else if (part.endsWith('+')) {
      // e.g. "TT+" -> "TT, JJ, QQ, KK, AA"
      const base = part.slice(0, -1);
      expandPlusRange(base, weight, weights);
    } else {
      if (CANONICAL_MAP.has(part)) {
        weights[part] = weight;
      }
    }
  }

  return { name, weights };
}

function expandDashRange(start: string, end: string, weight: number, weights: RangeWeights) {
  const h1 = CANONICAL_MAP.get(start);
  const h2 = CANONICAL_MAP.get(end);
  if (!h1 || !h2) return;

  if (h1.type === 'pair' && h2.type === 'pair') {
    const minRow = Math.min(h1.row, h2.row);
    const maxRow = Math.max(h1.row, h2.row);
    for (let r = minRow; r <= maxRow; r++) {
      for (const [handName, hand] of CANONICAL_MAP.entries()) {
        if (hand.type === 'pair' && hand.row === r) {
          weights[handName] = weight;
        }
      }
    }
  } else if (h1.type === h2.type && h1.rank1 === h2.rank1) {
    // e.g. AKs - ATs
    const minCol = Math.min(h1.col, h2.col);
    const maxCol = Math.max(h1.col, h2.col);
    for (let c = minCol; c <= maxCol; c++) {
      for (const [handName, hand] of CANONICAL_MAP.entries()) {
        if (hand.type === h1.type && hand.rank1 === h1.rank1 && (hand.col === c || hand.row === c)) {
          weights[handName] = weight;
        }
      }
    }
  }
}

function expandPlusRange(base: string, weight: number, weights: RangeWeights) {
  const h = CANONICAL_MAP.get(base);
  if (!h) return;

  if (h.type === 'pair') {
    // "TT+" -> row 4 down to 0
    for (let r = h.row; r >= 0; r--) {
      for (const [handName, hand] of CANONICAL_MAP.entries()) {
        if (hand.type === 'pair' && hand.row === r) {
          weights[handName] = weight;
        }
      }
    }
  } else {
    // "A9s+" -> col from A9s down to AKs
    for (const [handName, hand] of CANONICAL_MAP.entries()) {
      if (hand.type === h.type && hand.rank1 === h.rank1 && hand.col <= h.col) {
        weights[handName] = weight;
      }
    }
  }
}

/**
 * Serializes PlayerRange to standard format string
 */
export function serializeRange(range: PlayerRange): string {
  const entries = Object.entries(range.weights)
    .filter(([_, w]) => w > 0)
    .sort(([a], [b]) => a.localeCompare(b));

  return entries.map(([hand, w]) => {
    if (w >= 0.999) return hand;
    return `${hand}:${w.toFixed(2)}`;
  }).join(',');
}

export interface ConcreteHandWithWeight {
  combo: ConcreteCombo;
  weight: number;
}

/**
 * Returns all unblocked concrete combos for a given range and dead cards (board cards, etc.)
 */
export function getRangeActiveCombos(
  range: PlayerRange,
  deadCards: Card[]
): ConcreteHandWithWeight[] {
  const result: ConcreteHandWithWeight[] = [];

  for (const [handName, weight] of Object.entries(range.weights)) {
    if (weight <= 0) continue;
    const activeCombos = getActiveCombos(handName, deadCards);
    for (const combo of activeCombos) {
      result.push({
        combo,
        weight
      });
    }
  }

  return result;
}

/**
 * Calculate total combo count and percentage of all hands
 */
export function calculateRangeMetrics(
  range: PlayerRange,
  deadCards: Card[] = []
): { totalCombos: number; maxCombos: number; percentage: number } {
  let totalCombos = 0;
  let maxCombos = 0;

  for (const [handName, hand] of CANONICAL_MAP.entries()) {
    const unblockedCount = getActiveCombos(handName, deadCards).length;
    maxCombos += unblockedCount;
    const w = range.weights[handName] || 0;
    totalCombos += unblockedCount * w;
  }

  const percentage = maxCombos > 0 ? (totalCombos / maxCombos) * 100 : 0;
  return {
    totalCombos: Math.round(totalCombos * 10) / 10,
    maxCombos,
    percentage: Math.round(percentage * 10) / 10
  };
}
