/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * DualCardSelectorModal: Selector visual interactivo para seleccionar dos cartas al tiempo
 * (Rango + Palo) en un solo paso intuitivo sin clics redundantes, integrado con el wizard
 * de proceso de pensamiento y el solver.
 */

import React, { useState } from 'react';
import { Card, cardId, RANKS, SUITS, SUIT_COLORS, SUIT_SYMBOLS, Rank, Suit } from '../engine/cards';
import { X, Check, Shuffle, Sparkles, Layers } from 'lucide-react';

interface DualCardSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (card1: Card, card2: Card) => void;
  initialCards?: [Card, Card] | null;
  excludedCards?: Card[];
}

export const DualCardSelectorModal: React.FC<DualCardSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialCards,
  excludedCards = []
}) => {
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [card1, setCard1] = useState<Card>(initialCards ? initialCards[0] : { rank: 'A', suit: 's', id: cardId('A', 's') });
  const [card2, setCard2] = useState<Card>(initialCards ? initialCards[1] : { rank: 'K', suit: 's', id: cardId('K', 's') });

  if (!isOpen) return null;

  const isCardExcluded = (c: Card, targetSlot: 0 | 1) => {
    const otherCard = targetSlot === 0 ? card2 : card1;
    if (otherCard && c.rank === otherCard.rank && c.suit === otherCard.suit) return true;
    return excludedCards.some(ec => ec.rank === c.rank && ec.suit === c.suit);
  };

  const handleSelectRank = (rank: Rank) => {
    if (activeSlot === 0) {
      const candidate: Card = { rank, suit: card1.suit, id: cardId(rank, card1.suit) };
      if (!isCardExcluded(candidate, 0)) {
        setCard1(candidate);
      } else {
        const availSuit = SUITS.find(s => !isCardExcluded({ rank, suit: s, id: cardId(rank, s) }, 0));
        if (availSuit) setCard1({ rank, suit: availSuit, id: cardId(rank, availSuit) });
      }
    } else {
      const candidate: Card = { rank, suit: card2.suit, id: cardId(rank, card2.suit) };
      if (!isCardExcluded(candidate, 1)) {
        setCard2(candidate);
      } else {
        const availSuit = SUITS.find(s => !isCardExcluded({ rank, suit: s, id: cardId(rank, s) }, 1));
        if (availSuit) setCard2({ rank, suit: availSuit, id: cardId(rank, availSuit) });
      }
    }
  };

  const handleSelectSuit = (suit: Suit) => {
    if (activeSlot === 0) {
      const candidate: Card = { rank: card1.rank, suit, id: cardId(card1.rank, suit) };
      if (!isCardExcluded(candidate, 0)) {
        setCard1(candidate);
        setActiveSlot(1);
      }
    } else {
      const candidate: Card = { rank: card2.rank, suit, id: cardId(card2.rank, suit) };
      if (!isCardExcluded(candidate, 1)) {
        setCard2(candidate);
      }
    }
  };

  const handlePickSpecificCard = (card: Card) => {
    if (activeSlot === 0) {
      setCard1(card);
      setActiveSlot(1);
    } else {
      setCard2(card);
    }
  };

  const applyPreset = (r1: Rank, s1: Suit, r2: Rank, s2: Suit) => {
    const c1: Card = { rank: r1, suit: s1, id: cardId(r1, s1) };
    const c2: Card = { rank: r2, suit: s2, id: cardId(r2, s2) };
    setCard1(c1);
    setCard2(c2);
    setActiveSlot(1);
  };

  const handleRandomize = () => {
    const deck: Card[] = [];
    for (const r of RANKS) {
      for (const s of SUITS) {
        if (!excludedCards.some(ec => ec.rank === r && ec.suit === s)) {
          deck.push({ rank: r, suit: s, id: cardId(r, s) });
        }
      }
    }
    if (deck.length >= 2) {
      const idx1 = Math.floor(Math.random() * deck.length);
      const c1 = deck.splice(idx1, 1)[0];
      const idx2 = Math.floor(Math.random() * deck.length);
      const c2 = deck[idx2];
      setCard1(c1);
      setCard2(c2);
    }
  };

  const handleConfirm = () => {
    if (card1 && card2 && (card1.rank !== card2.rank || card1.suit !== card2.suit)) {
      onSelect(card1, card2);
      onClose();
    }
  };

  const currentActiveCard = activeSlot === 0 ? card1 : card2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30 text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Selector Dual de Cartas (Rango + Palo)
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-800 text-emerald-300 font-mono">
                  1-Paso Intuitivo
                </span>
              </h2>
              <p className="text-xs text-neutral-400">
                Selecciona ambas cartas de Hero con 0 clics redundantes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Cards Banner (Dual Slots) */}
        <div className="p-5 bg-neutral-950/40 border-b border-neutral-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
              Mano de Hero:
            </span>
            <div className="flex items-center gap-3">
              {/* Slot 1 */}
              <button
                type="button"
                onClick={() => setActiveSlot(0)}
                className={`relative flex items-center justify-center w-16 h-22 rounded-xl border-2 font-mono font-bold text-2xl transition-all shadow-md ${
                  activeSlot === 0
                    ? 'border-emerald-400 bg-neutral-800 ring-2 ring-emerald-500/30 scale-105'
                    : 'border-neutral-700 bg-neutral-850 hover:border-neutral-500 opacity-90'
                } ${SUIT_COLORS[card1.suit].text}`}
              >
                <span className="text-xs absolute top-1 left-1.5 font-sans font-medium text-neutral-400">#1</span>
                <span>{card1.rank}</span>
                <span className="text-xl ml-0.5">{SUIT_SYMBOLS[card1.suit]}</span>
                {activeSlot === 0 && (
                  <span className="absolute -bottom-2 px-1.5 py-0.2 text-[9px] bg-emerald-500 text-neutral-950 font-sans font-bold rounded-full">
                    Editando
                  </span>
                )}
              </button>

              {/* Slot 2 */}
              <button
                type="button"
                onClick={() => setActiveSlot(1)}
                className={`relative flex items-center justify-center w-16 h-22 rounded-xl border-2 font-mono font-bold text-2xl transition-all shadow-md ${
                  activeSlot === 1
                    ? 'border-emerald-400 bg-neutral-800 ring-2 ring-emerald-500/30 scale-105'
                    : 'border-neutral-700 bg-neutral-850 hover:border-neutral-500 opacity-90'
                } ${SUIT_COLORS[card2.suit].text}`}
              >
                <span className="text-xs absolute top-1 left-1.5 font-sans font-medium text-neutral-400">#2</span>
                <span>{card2.rank}</span>
                <span className="text-xl ml-0.5">{SUIT_SYMBOLS[card2.suit]}</span>
                {activeSlot === 1 && (
                  <span className="absolute -bottom-2 px-1.5 py-0.2 text-[9px] bg-emerald-500 text-neutral-950 font-sans font-bold rounded-full">
                    Editando
                  </span>
                )}
              </button>
            </div>

            <div className="text-xs text-neutral-400">
              <span className="font-semibold text-neutral-200">
                {card1.rank === card2.rank ? `Pareja de ${card1.rank}'s` : card1.suit === card2.suit ? `${card1.rank}${card2.rank} Suited` : `${card1.rank}${card2.rank} Offsuit`}
              </span>
              <p className="text-[11px] text-neutral-500">
                Editando Carta #{activeSlot + 1}. Toca el rango o palo deseado abajo.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRandomize}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5 text-emerald-400" />
            <span>Aleatoria</span>
          </button>
        </div>

        {/* Fast Presets */}
        <div className="px-6 py-2.5 bg-neutral-900/90 border-b border-neutral-800 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" /> Presets:
          </span>
          <button
            type="button"
            onClick={() => applyPreset('A', 's', 'A', 'h')}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 shrink-0 font-mono font-medium"
          >
            A♠ A♥
          </button>
          <button
            type="button"
            onClick={() => applyPreset('K', 's', 'K', 'd')}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 shrink-0 font-mono font-medium"
          >
            K♠ K♦
          </button>
          <button
            type="button"
            onClick={() => applyPreset('A', 's', 'K', 's')}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 shrink-0 font-mono font-medium"
          >
            AKs ♠
          </button>
          <button
            type="button"
            onClick={() => applyPreset('A', 's', 'Q', 's')}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 shrink-0 font-mono font-medium"
          >
            AQs ♠
          </button>
          <button
            type="button"
            onClick={() => applyPreset('J', 's', 'T', 's')}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 shrink-0 font-mono font-medium"
          >
            JTs ♠
          </button>
          <button
            type="button"
            onClick={() => applyPreset('8', 'h', '7', 'h')}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 shrink-0 font-mono font-medium"
          >
            87s ♥
          </button>
          <button
            type="button"
            onClick={() => applyPreset('A', 's', '5', 's')}
            className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 shrink-0 font-mono font-medium"
          >
            A5s ♠
          </button>
        </div>

        {/* Interactive Dual Picker Area */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[55vh]">
          {/* Step A: Select Rank */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
                1. Selecciona Rango para Carta #{activeSlot + 1}
              </span>
              <span className="text-xs text-neutral-500 font-mono">
                Actual: <strong className="text-white">{currentActiveCard.rank}</strong>
              </span>
            </div>
            <div className="grid grid-cols-7 sm:grid-cols-13 gap-1.5">
              {RANKS.map(rank => {
                const isSelected = currentActiveCard.rank === rank;
                return (
                  <button
                    key={rank}
                    type="button"
                    onClick={() => handleSelectRank(rank)}
                    className={`h-11 rounded-lg font-mono font-bold text-base transition-all border ${
                      isSelected
                        ? 'bg-emerald-500 text-neutral-950 border-emerald-400 shadow-md font-extrabold scale-105'
                        : 'bg-neutral-800/90 text-neutral-200 border-neutral-700/80 hover:bg-neutral-700 hover:border-neutral-500'
                    }`}
                  >
                    {rank}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step B: Select Suit */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">
                2. Selecciona Palo (Avanza automáticamente al elegir)
              </span>
              <span className="text-xs text-neutral-500">
                Palo actual: <strong className={SUIT_COLORS[currentActiveCard.suit].text}>{SUIT_SYMBOLS[currentActiveCard.suit]}</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {SUITS.map(suit => {
                const isSelected = currentActiveCard.suit === suit;
                const candidate: Card = { rank: currentActiveCard.rank, suit, id: cardId(currentActiveCard.rank, suit) };
                const disabled = isCardExcluded(candidate, activeSlot);

                return (
                  <button
                    key={suit}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleSelectSuit(suit)}
                    className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border font-medium text-sm transition-all ${
                      disabled
                        ? 'opacity-30 cursor-not-allowed bg-neutral-900 border-neutral-800 text-neutral-600'
                        : isSelected
                        ? 'border-emerald-400 bg-neutral-800 shadow-md ring-2 ring-emerald-500/20'
                        : 'bg-neutral-800/70 border-neutral-700 hover:bg-neutral-750 hover:border-neutral-600'
                    }`}
                  >
                    <span className={`text-2xl ${SUIT_COLORS[suit].text}`}>{SUIT_SYMBOLS[suit]}</span>
                    <span className="text-neutral-200 capitalize font-medium">
                      {suit === 's' ? 'Picas (♠)' : suit === 'h' ? 'Corazones (♥)' : suit === 'd' ? 'Diamantes (♦)' : 'Tréboles (♣)'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Grid of All Available 52 Cards for 1-Click Direct Pick */}
          <div className="pt-2 border-t border-neutral-800">
            <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide block mb-2">
              O Selección Directa de 1 Clic (52 Cartas):
            </span>
            <div className="grid grid-cols-13 gap-1">
              {SUITS.map(s => (
                <React.Fragment key={s}>
                  {RANKS.map(r => {
                    const c: Card = { rank: r, suit: s, id: cardId(r, s) };
                    const isCard1 = card1.rank === r && card1.suit === s;
                    const isCard2 = card2.rank === r && card2.suit === s;
                    const isExcluded = isCardExcluded(c, activeSlot);

                    return (
                      <button
                        key={`${r}${s}`}
                        type="button"
                        disabled={isExcluded}
                        onClick={() => handlePickSpecificCard(c)}
                        title={`${r}${SUIT_SYMBOLS[s]}`}
                        className={`h-8 rounded text-[11px] font-mono font-bold flex flex-col items-center justify-center transition-all ${
                          isCard1
                            ? 'bg-emerald-500 text-neutral-950 ring-2 ring-emerald-300 font-extrabold z-10'
                            : isCard2
                            ? 'bg-cyan-500 text-neutral-950 ring-2 ring-cyan-300 font-extrabold z-10'
                            : isExcluded
                            ? 'opacity-20 cursor-not-allowed bg-neutral-900 text-neutral-600'
                            : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-200 border border-neutral-700/50'
                        }`}
                      >
                        <span className={isCard1 || isCard2 ? 'text-neutral-950' : SUIT_COLORS[s].text}>
                          {r}{SUIT_SYMBOLS[s]}
                        </span>
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-800 bg-neutral-950/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-neutral-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Confirmar Mano ({card1.rank}{SUIT_SYMBOLS[card1.suit]} {card2.rank}{SUIT_SYMBOLS[card2.suit]})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
