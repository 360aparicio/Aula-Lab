/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StepByStepThinkingBar: Barra Maestra del Proceso de Pensamiento Paso a Paso.
 * Integra de forma intuitiva:
 * 1. Posición de Hero & Rival (con rol IP/OOP automático)
 * 2. Acción Previa: "¿Alguien abrió la mano antes de mí?" (con ajuste automático de rangos y bote)
 * 3. Mis Cartas de Mano (Hero cards con selector de 52 cartas y botón aleatorio de rango)
 * 4. Calle a Calle (Flop -> Turn -> River con cartas comunitarias, presets de texturas y ventaja de rango)
 */

import React, { useState, useMemo } from 'react';
import { Card, cardId, cardToString, parseCard, RANKS, SUIT_COLORS, SUIT_SYMBOLS, SUITS } from '../engine/cards';
import { TablePosition, TABLE_POSITIONS, POSITION_INFO, getPostflopRole } from './HandAndPositionBar';
import { PreflopActionContext, getAutoMatchupProfile } from '../engine/preflopMatchups';
import { evaluateCards } from '../engine/evaluator';
import {
  Compass,
  ArrowLeftRight,
  Edit3,
  Shuffle,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Layers,
  Play,
  RotateCcw,
  X,
  Check,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';

export interface StepByStepThinkingBarProps {
  heroPos: TablePosition;
  villainPos: TablePosition;
  onHeroPosChange: (pos: TablePosition) => void;
  onVillainPosChange: (pos: TablePosition) => void;
  onSwapPositions: () => void;
  preflopAction: PreflopActionContext;
  onPreflopActionChange: (action: PreflopActionContext) => void;
  heroCards: [Card, Card] | null;
  onSelectHeroCards: (c1: Card, c2: Card) => void;
  onRandomHeroCards: () => void;
  boardCards: Card[];
  onBoardChange: (cards: Card[]) => void;
  street: 'flop' | 'turn' | 'river';
  onStreetChange: (street: 'flop' | 'turn' | 'river') => void;
  extraAction?: React.ReactNode;
}

export const StepByStepThinkingBar: React.FC<StepByStepThinkingBarProps> = ({
  heroPos,
  villainPos,
  onHeroPosChange,
  onVillainPosChange,
  onSwapPositions,
  preflopAction,
  onPreflopActionChange,
  heroCards,
  onSelectHeroCards,
  onRandomHeroCards,
  boardCards,
  onBoardChange,
  street,
  onStreetChange,
  extraAction
}) => {
  // Modal state for card picker
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [modalTarget, setModalTarget] = useState<'hero' | 'board'>('hero');
  const [targetSlot, setTargetSlot] = useState<number>(0);

  const heroRole = getPostflopRole(heroPos, villainPos);

  // Matchup profile summary
  const matchupProfile = useMemo(() => {
    return getAutoMatchupProfile(heroPos, villainPos, preflopAction);
  }, [heroPos, villainPos, preflopAction]);

  // Board texture analysis
  const boardAnalysis = useMemo(() => {
    if (!boardCards || boardCards.length < 3) {
      return {
        wetness: 'Seco',
        highCard: 'Sin cartas',
        suitTexture: 'Rainbow',
        rangeAdvantage: 'Hero tiene iniciativa preflop'
      };
    }

    const ranks = boardCards.map(c => '23456789TJQKA'.indexOf(c.rank)).sort((a, b) => b - a);
    const suits = boardCards.map(c => c.suit);
    const suitCounts: Record<string, number> = {};
    suits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
    const maxSuitCount = Math.max(...Object.values(suitCounts));

    const suitTexture = maxSuitCount >= 4 ? '4-Flush' : maxSuitCount === 3 ? 'Monocolor' : maxSuitCount === 2 ? 'Dos tonos' : 'Arcoíris';
    const isPaired = ranks.some((r, i) => i > 0 && r === ranks[i - 1]);

    let wetness = 'Seco';
    if (maxSuitCount >= 3 || (!isPaired && Math.abs(ranks[0] - ranks[2]) <= 4)) {
      wetness = 'Mojado (Wet)';
    } else if (maxSuitCount === 2 || Math.abs(ranks[0] - ranks[1]) <= 2) {
      wetness = 'Coordinado';
    }

    const isAceHigh = boardCards.some(c => c.rank === 'A');
    let rangeAdvantage = '';
    if (matchupProfile.aggressor === 'HERO') {
      rangeAdvantage = isAceHigh ? 'Fuerte ventaja de rango para Hero' : 'Ventaja de iniciativa para Hero';
    } else {
      rangeAdvantage = isAceHigh ? 'Ventaja de cartas altas para el Rival' : 'Ventaja de defensa conectada para Hero';
    }

    return {
      wetness,
      highCard: boardCards[0]?.rank || 'A',
      suitTexture,
      rangeAdvantage
    };
  }, [boardCards, matchupProfile]);

  // Hand strength evaluation
  const handEval = useMemo(() => {
    if (!heroCards || !boardCards || boardCards.length < 3) return null;
    try {
      return evaluateCards([heroCards[0], heroCards[1], ...boardCards]);
    } catch {
      return null;
    }
  }, [heroCards, boardCards]);

  // Handle card selection inside modal
  const handleSelectCard = (rank: any, suit: any) => {
    const card: Card = { rank, suit, id: cardId(rank, suit) };

    if (modalTarget === 'hero') {
      if (!heroCards) {
        onSelectHeroCards(card, { rank: 'K', suit: 's', id: cardId('K', 's') });
      } else {
        if (targetSlot === 0) {
          onSelectHeroCards(card, heroCards[1]);
        } else {
          onSelectHeroCards(heroCards[0], card);
        }
      }
      setIsCardModalOpen(false);
    } else {
      const maxSlots = street === 'flop' ? 3 : street === 'turn' ? 4 : 5;
      const newBoard = [...boardCards];
      newBoard[targetSlot] = card;
      onBoardChange(newBoard.slice(0, maxSlots));
      setIsCardModalOpen(false);
    }
  };

  // Quick preset board textures
  const handleSetPresetBoard = (cards: string[]) => {
    const parsed = cards.map(parseCard);
    onBoardChange(parsed);
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-5">
      {/* Step Indicator Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Compass className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Proceso de Pensamiento Paso a Paso</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                Sincronización en Vivo
              </span>
            </h2>
            <p className="text-[11px] text-neutral-400">
              Cada cambio de posición, acción previa, cartas o calle actualiza inmediatamente el árbol de decisión y los gráficos.
            </p>
          </div>
        </div>

        {extraAction && <div className="flex items-center gap-2">{extraAction}</div>}
      </div>

      {/* 4-Step Ordered Pipeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ========================================================================= */}
        {/* PASO 1: POSICIÓN DE HERO Y RIVAL (4 cols)                                */}
        {/* ========================================================================= */}
        <div className="lg:col-span-4 bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>1. Posición & Rol</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
              Hero: {heroRole === 'IP' ? 'IP (Actúa Último)' : 'OOP (Actúa Primero)'}
            </span>
          </div>

          {/* Hero Position */}
          <div className="space-y-1">
            <div className="text-[10px] text-neutral-400 font-semibold uppercase">
              Tu Posición (Hero):
            </div>
            <div className="grid grid-cols-6 gap-1">
              {TABLE_POSITIONS.map(pos => {
                const isSel = heroPos === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      onHeroPosChange(pos);
                      if (pos === villainPos) onVillainPosChange(pos === 'BB' ? 'BTN' : 'BB');
                    }}
                    className={`py-1 rounded font-mono font-bold text-xs transition-all cursor-pointer ${
                      isSel
                        ? 'bg-emerald-600 text-white shadow-xs border border-emerald-400'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                    }`}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Villain Position with Swap */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-neutral-400 font-semibold uppercase">
              <span>Posición del Rival (Villano):</span>
              <button
                type="button"
                onClick={onSwapPositions}
                className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-mono cursor-pointer"
                title="Invertir posiciones"
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>Invertir</span>
              </button>
            </div>
            <div className="grid grid-cols-6 gap-1">
              {TABLE_POSITIONS.map(pos => {
                const isSel = villainPos === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      onVillainPosChange(pos);
                      if (pos === heroPos) onHeroPosChange(pos === 'BTN' ? 'BB' : 'BTN');
                    }}
                    className={`py-1 rounded font-mono font-bold text-xs transition-all cursor-pointer ${
                      isSel
                        ? 'bg-rose-600 text-white shadow-xs border border-rose-400'
                        : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                    }`}
                  >
                    {pos}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PASO 2: ACCIÓN PREVIA PREFLOP (4 cols)                                   */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. ¿Alguien abrió antes de ti?</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              Bote: {matchupProfile.potBB} BB ({matchupProfile.potChips} fichas)
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {[
              { id: 'RFI' as const, label: 'Nadie abrió (RFI)', tag: 'Hero Abre (~5.5 BB)' },
              { id: 'FACING_OPEN' as const, label: 'Rival abrió (Call)', tag: 'Defensa Hero' },
              { id: 'HERO_3BET' as const, label: 'Hero Resubió (3-Bet)', tag: 'Bote Grande (~20 BB)' },
              { id: 'FACING_3BET' as const, label: 'Rival hizo 3-Bet', tag: 'Defensa 3-Bet' },
              { id: 'BVB_LIMP' as const, label: 'Bote Limpeado', tag: 'Bote Mínimo' }
            ].map(act => {
              const isSelected = preflopAction === act.id;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => onPreflopActionChange(act.id)}
                  className={`p-2 rounded-lg border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-950/70 border-emerald-500 ring-1 ring-emerald-500 shadow-xs'
                      : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 text-neutral-300'
                  }`}
                >
                  <div className="text-[11px] font-bold text-white leading-tight">{act.label}</div>
                  <div className="text-[9px] font-mono text-emerald-400 mt-1">{act.tag}</div>
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-neutral-400 flex items-center gap-1 leading-tight">
            <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
            <span>Rangos de {heroPos} y {villainPos} ajustados automáticamente para este spot.</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PASO 3: MIS CARTAS DE MANO (3 cols)                                      */}
        {/* ========================================================================= */}
        <div className="lg:col-span-3 bg-neutral-950/70 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>3. Mis 2 Cartas</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">
              {heroCards ? `${cardToString(heroCards[0])} ${cardToString(heroCards[1])}` : 'Sin cartas'}
            </span>
          </div>

          {/* Cards Display */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {[0, 1].map(slot => {
                const card = heroCards ? heroCards[slot as 0 | 1] : null;
                if (!card) {
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        setModalTarget('hero');
                        setTargetSlot(slot);
                        setIsCardModalOpen(true);
                      }}
                      className="w-10 h-14 rounded-lg border-2 border-dashed border-neutral-700 hover:border-emerald-500 bg-neutral-950 flex flex-col items-center justify-center text-neutral-500 hover:text-emerald-400 text-xs font-mono transition-colors cursor-pointer"
                    >
                      <span>+</span>
                      <span className="text-[8px]">Carta {slot + 1}</span>
                    </button>
                  );
                }
                const isRed = card.suit === 'h' || card.suit === 'd';
                return (
                  <div
                    key={slot}
                    onClick={() => {
                      setModalTarget('hero');
                      setTargetSlot(slot);
                      setIsCardModalOpen(true);
                    }}
                    className={`w-10 h-14 rounded-lg bg-neutral-950 border border-neutral-700 flex flex-col justify-between p-1 shadow-md cursor-pointer hover:border-emerald-400 transition-colors select-none ${
                      isRed ? 'text-rose-400' : 'text-neutral-100'
                    }`}
                  >
                    <div className="text-[10px] font-bold leading-none">{card.rank}</div>
                    <div className="text-center text-sm leading-none">{SUIT_SYMBOLS[card.suit]}</div>
                    <div className="text-[8px] text-neutral-500 font-mono text-right">{SUIT_SYMBOLS[card.suit]}</div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <button
                type="button"
                onClick={() => {
                  setModalTarget('hero');
                  setTargetSlot(0);
                  setIsCardModalOpen(true);
                }}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>Elegir Cartas</span>
              </button>

              <button
                type="button"
                onClick={onRandomHeroCards}
                className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded text-[11px] font-medium flex items-center gap-1 border border-neutral-800 transition-colors cursor-pointer"
                title="Mano aleatoria desde el rango de Hero"
              >
                <Shuffle className="w-3 h-3 text-cyan-400" />
                <span>Aleatorio</span>
              </button>
            </div>
          </div>

          {handEval ? (
            <div className="text-[10px] font-mono text-emerald-300 truncate">
              ★ {handEval.description}
            </div>
          ) : (
            <div className="text-[10px] text-neutral-500">
              Haz clic en las cartas para seleccionarlas
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* PASO 4: CALLE A CALLE (FLOP -> TURN -> RIVER) Y BOARD COMUNITARIO        */}
      {/* ========================================================================= */}
      <div className="bg-neutral-950/70 p-4 rounded-xl border border-neutral-800 flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>4. Calle a Calle (Flop ➔ Turn ➔ River)</span>
            </span>

            {/* Street Switcher Pills */}
            <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800 text-xs font-semibold">
              {(['flop', 'turn', 'river'] as const).map(st => {
                const isCur = street === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => onStreetChange(st)}
                    className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                      isCur
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                    }`}
                  >
                    {st === 'flop' ? 'Flop (3)' : st === 'turn' ? 'Turn (4)' : 'River (5)'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Diagnostic Tag */}
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800 font-mono text-[10px]">
              Textura: <strong className="text-cyan-400">{boardAnalysis.wetness}</strong> ({boardAnalysis.suitTexture})
            </span>
            <span className="px-2 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800 font-mono text-[10px]">
              {boardAnalysis.rangeAdvantage}
            </span>
          </div>
        </div>

        {/* Board Cards Visual Slots */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {[0, 1, 2, 3, 4].map(idx => {
              const maxSlot = street === 'flop' ? 3 : street === 'turn' ? 4 : 5;
              const isAvailable = idx < maxSlot;
              const card = boardCards[idx] || null;

              if (!isAvailable) {
                return (
                  <div
                    key={idx}
                    className="w-11 h-16 rounded-lg bg-neutral-950/40 border border-neutral-900 flex flex-col items-center justify-center text-neutral-700 text-xs font-mono opacity-30 select-none"
                  >
                    <span>-</span>
                    <span className="text-[8px]">{idx === 3 ? 'Turn' : idx === 4 ? 'River' : ''}</span>
                  </div>
                );
              }

              if (!card) {
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setModalTarget('board');
                      setTargetSlot(idx);
                      setIsCardModalOpen(true);
                    }}
                    className="w-11 h-16 rounded-lg border-2 border-dashed border-neutral-700 hover:border-emerald-500 bg-neutral-950 flex flex-col items-center justify-center text-neutral-500 hover:text-emerald-400 text-xs font-mono transition-colors cursor-pointer"
                  >
                    <span>+</span>
                    <span className="text-[8px]">{idx < 3 ? `F${idx + 1}` : idx === 3 ? 'Turn' : 'River'}</span>
                  </button>
                );
              }

              const isRed = card.suit === 'h' || card.suit === 'd';
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setModalTarget('board');
                    setTargetSlot(idx);
                    setIsCardModalOpen(true);
                  }}
                  className={`w-11 h-16 rounded-lg bg-neutral-950 border border-neutral-700 flex flex-col justify-between p-1.5 shadow-md cursor-pointer hover:border-emerald-400 transition-colors select-none ${
                    isRed ? 'text-rose-400' : 'text-neutral-100'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold leading-none">
                    <span>{card.rank}</span>
                    <span className="text-[10px]">{SUIT_SYMBOLS[card.suit]}</span>
                  </div>
                  <div className="text-center text-base leading-none">{SUIT_SYMBOLS[card.suit]}</div>
                  <div className="text-[8px] text-neutral-500 font-mono text-right">
                    {idx < 3 ? `Flop` : idx === 3 ? 'Turn' : 'River'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Frequent Board Shortcuts */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-neutral-500 uppercase font-semibold">Texturas Rápidas:</span>
            {[
              { label: 'A♠ 7♦ 2♣ (Seco)', cards: ['As', '7d', '2c'] },
              { label: 'K♥ J♠ 8♦ (Coordinado)', cards: ['Kh', 'Js', '8d'] },
              { label: '9♠ 8♠ 4♦ (Mojado)', cards: ['9s', '8s', '4d'] },
              { label: 'Q♥ Q♦ 5♣ (Emparejado)', cards: ['Qh', 'Qd', '5c'] },
              { label: 'J♠ 7♠ 2♠ (Monocolor)', cards: ['Js', '7s', '2s'] }
            ].map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleSetPresetBoard(preset.cards)}
                className="px-2 py-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 text-[10px] font-mono transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 52-Card Universal Modal Picker */}
      {isCardModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-xl w-full p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>
                  {modalTarget === 'hero'
                    ? `Seleccionar Carta de Mano ${targetSlot + 1}`
                    : `Seleccionar Carta Comunitaria (${targetSlot < 3 ? `Flop ${targetSlot + 1}` : targetSlot === 3 ? 'Turn' : 'River'})`}
                </span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCardModalOpen(false)}
                className="p-1 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5">
              {SUITS.map(suit => {
                const isRed = suit === 'h' || suit === 'd';
                return (
                  <div key={suit} className="flex items-center gap-1.5">
                    <span className={`w-6 text-center font-bold text-sm ${isRed ? 'text-rose-400' : 'text-neutral-300'}`}>
                      {SUIT_SYMBOLS[suit]}
                    </span>
                    <div className="grid grid-cols-13 gap-1 flex-1">
                      {RANKS.map(rank => {
                        const id = cardId(rank, suit);
                        const isTaken =
                          (heroCards && (heroCards[0]?.id === id || heroCards[1]?.id === id)) ||
                          (boardCards && boardCards.some(c => c?.id === id));
                        return (
                          <button
                            key={rank}
                            type="button"
                            disabled={isTaken}
                            onClick={() => handleSelectCard(rank, suit)}
                            className={`py-1.5 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                              isTaken
                                ? 'bg-neutral-950 text-neutral-600 border border-neutral-900 cursor-not-allowed opacity-30'
                                : isRed
                                ? 'bg-rose-950/40 text-rose-300 hover:bg-rose-600 hover:text-white border border-rose-900'
                                : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700 hover:text-white border border-neutral-700'
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
