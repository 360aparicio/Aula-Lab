/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Board Selector with 4-Color Deck & Blocker Validation.
 */

import React, { useState } from 'react';
import { Card, cardId, cardToString, parseCard, RANKS, SUIT_COLORS, SUIT_SYMBOLS, SUITS } from '../engine/cards';
import { X, Plus } from 'lucide-react';

interface BoardSelectorProps {
  board: Card[];
  onChange: (newBoard: Card[]) => void;
  street: 'flop' | 'turn' | 'river';
  onStreetChange?: (street: 'flop' | 'turn' | 'river') => void;
}

export const BoardSelector: React.FC<BoardSelectorProps> = ({
  board,
  onChange,
  street,
  onStreetChange
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const maxCards = street === 'flop' ? 3 : street === 'turn' ? 4 : 5;

  const handleCardClick = (slotIdx: number) => {
    setSelectedSlotIndex(slotIdx);
    setIsPickerOpen(true);
  };

  const handleSelectCard = (rank: any, suit: any) => {
    const card: Card = {
      rank,
      suit,
      id: cardId(rank, suit)
    };

    // Check if card is already on the board in a different slot
    const existingIdx = board.findIndex(c => c.id === card.id);
    const newBoard = [...board];

    if (selectedSlotIndex !== null && selectedSlotIndex < maxCards) {
      if (existingIdx !== -1 && existingIdx !== selectedSlotIndex) {
        // Swap or remove previous
        newBoard[existingIdx] = newBoard[selectedSlotIndex];
      }
      newBoard[selectedSlotIndex] = card;
    } else {
      // Append if space available
      if (existingIdx === -1 && newBoard.length < maxCards) {
        newBoard.push(card);
      }
    }

    onChange(newBoard.slice(0, maxCards));
    setIsPickerOpen(false);
    setSelectedSlotIndex(null);
  };

  const handleRemoveCard = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    const newBoard = board.filter((_, i) => i !== idx);
    onChange(newBoard);
  };

  const boardCardIds = new Set(board.map(c => c.id));

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Community Board
          </span>
          <span className="text-xs text-neutral-500">· {board.length} of {maxCards} cards</span>
        </div>

        {onStreetChange && (
          <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
            {(['flop', 'turn', 'river'] as const).map(st => (
              <button
                key={st}
                onClick={() => onStreetChange(st)}
                className={`px-2.5 py-1 rounded font-medium capitalize transition-colors ${
                  street === st
                    ? 'bg-neutral-800 text-emerald-400 shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Cards Slots */}
      <div className="flex items-center gap-2.5">
        {Array.from({ length: maxCards }).map((_, idx) => {
          const card = board[idx];
          if (card) {
            const suitStyle = SUIT_COLORS[card.suit];
            return (
              <div
                key={idx}
                onClick={() => handleCardClick(idx)}
                className={`relative group w-14 h-20 rounded-lg bg-neutral-950 border ${suitStyle.border} flex flex-col justify-between p-1.5 cursor-pointer hover:border-neutral-500 transition-all shadow-sm`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-base font-bold leading-none ${suitStyle.text}`}>
                    {card.rank}
                  </span>
                  <span className={`text-xs ${suitStyle.text}`}>
                    {SUIT_SYMBOLS[card.suit]}
                  </span>
                </div>
                <div className="flex justify-center items-center my-auto">
                  <span className={`text-2xl leading-none ${suitStyle.text}`}>
                    {SUIT_SYMBOLS[card.suit]}
                  </span>
                </div>
                <button
                  onClick={(e) => handleRemoveCard(e, idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-neutral-800 hover:bg-red-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-neutral-700"
                  title="Remove card"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={idx}
              onClick={() => handleCardClick(idx)}
              className="w-14 h-20 rounded-lg border border-dashed border-neutral-800 hover:border-neutral-600 bg-neutral-950/50 flex flex-col items-center justify-center text-neutral-600 hover:text-neutral-300 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4 mb-1" />
              <span className="text-[10px] uppercase font-mono">
                {idx < 3 ? 'Flop' : idx === 3 ? 'Turn' : 'River'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Card Picker Modal */}
      {isPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Select Playing Card</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Slot: {selectedSlotIndex !== null ? (selectedSlotIndex < 3 ? 'Flop' : selectedSlotIndex === 3 ? 'Turn' : 'River') : 'New Card'}
                </p>
              </div>
              <button
                onClick={() => setIsPickerOpen(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              {SUITS.map(suit => {
                const suitStyle = SUIT_COLORS[suit];
                return (
                  <div key={suit} className="flex items-center gap-1.5">
                    <div className="w-7 text-center">
                      <span className={`text-base font-bold ${suitStyle.text}`}>
                        {SUIT_SYMBOLS[suit]}
                      </span>
                    </div>
                    <div className="flex-1 grid grid-cols-13 gap-1">
                      {RANKS.slice().reverse().map(rank => {
                        const cid = cardId(rank, suit);
                        const isTaken = boardCardIds.has(cid);
                        return (
                          <button
                            key={rank}
                            disabled={isTaken}
                            onClick={() => handleSelectCard(rank, suit)}
                            className={`h-9 rounded flex items-center justify-center font-bold text-xs transition-colors ${
                              isTaken
                                ? 'bg-neutral-950 text-neutral-700 cursor-not-allowed opacity-40'
                                : `${suitStyle.bg} ${suitStyle.text} border ${suitStyle.border} hover:brightness-125`
                            }`}
                          >
                            {rank}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
