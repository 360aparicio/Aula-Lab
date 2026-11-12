/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Canonical Card & Deck representations for GTO Studio
 */

export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
export type Suit = 's' | 'h' | 'd' | 'c';

export interface Card {
  rank: Rank;
  suit: Suit;
  id: number; // 0 to 51
}

export const RANKS: readonly Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const;
export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'] as const;

export const RANK_VALUES: Record<Rank, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4,
  '7': 5, '8': 6, '9': 7, 'T': 8, 'J': 9,
  'Q': 10, 'K': 11, 'A': 12
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  's': '♠',
  'h': '♥',
  'd': '♦',
  'c': '♣'
};

export const SUIT_COLORS: Record<Suit, { text: string; bg: string; border: string; name: string }> = {
  's': { text: 'text-neutral-200', bg: 'bg-neutral-800', border: 'border-neutral-700', name: 'Spades' },
  'h': { text: 'text-red-400', bg: 'bg-red-950/40', border: 'border-red-800/60', name: 'Hearts' },
  'd': { text: 'text-blue-400', bg: 'bg-blue-950/40', border: 'border-blue-800/60', name: 'Diamonds' },
  'c': { text: 'text-emerald-400', bg: 'bg-emerald-950/40', border: 'border-emerald-800/60', name: 'Clubs' }
};

export function cardId(rank: Rank, suit: Suit): number {
  return RANK_VALUES[rank] * 4 + (suit === 's' ? 0 : suit === 'h' ? 1 : suit === 'd' ? 2 : 3);
}

export function parseCard(cardStr: string): Card {
  const clean = cardStr.trim();
  if (clean.length < 2) {
    throw new Error(`Invalid card string: "${cardStr}"`);
  }
  const rank = clean[0].toUpperCase() as Rank;
  const suit = clean[1].toLowerCase() as Suit;

  if (!RANKS.includes(rank)) {
    throw new Error(`Invalid rank: "${rank}" in "${cardStr}"`);
  }
  if (!SUITS.includes(suit)) {
    throw new Error(`Invalid suit: "${suit}" in "${cardStr}"`);
  }

  return {
    rank,
    suit,
    id: cardId(rank, suit)
  };
}

export function cardToString(card: Card): string {
  return `${card.rank}${card.suit}`;
}

export function cardFromId(id: number): Card {
  if (id < 0 || id >= 52) {
    throw new Error(`Card ID out of range [0-51]: ${id}`);
  }
  const rankIdx = Math.floor(id / 4);
  const suitIdx = id % 4;
  return {
    rank: RANKS[rankIdx],
    suit: SUITS[suitIdx],
    id
  };
}

export const FULL_DECK: readonly Card[] = Array.from({ length: 52 }, (_, i) => cardFromId(i));
