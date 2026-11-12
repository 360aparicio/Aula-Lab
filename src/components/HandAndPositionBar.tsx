/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Hand and Position Bar:
 * Allows user to select Hero position (BTN, BB, SB, CO), Villain position,
 * and select exact private hole cards (via 4-color deck picker).
 */

import React, { useState, useMemo } from 'react';
import { Card, cardId, cardToString, RANKS, SUIT_COLORS, SUIT_SYMBOLS, SUITS } from '../engine/cards';
import { createConcreteComboFromCards } from '../engine/combos';
import { ArrowLeftRight, Edit3, Shuffle, X, Check, Eye } from 'lucide-react';

export type TablePosition = 'EP' | 'MP' | 'CO' | 'BTN' | 'SB' | 'BB';

export const TABLE_POSITIONS: TablePosition[] = ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'];

export const POSITION_INFO: Record<TablePosition, { label: string; name: string; full: string; group: string }> = {
  EP: { label: 'EP', name: 'Early Position', full: 'EP (UTG / Temprana)', group: 'Early' },
  MP: { label: 'MP', name: 'Middle Position', full: 'MP (Media)', group: 'Middle' },
  CO: { label: 'CO', name: 'Cutoff', full: 'CO (Cutoff)', group: 'Late' },
  BTN: { label: 'BTN', name: 'Button', full: 'BTN (Botón / Dealer)', group: 'Late' },
  SB: { label: 'SB', name: 'Small Blind', full: 'SB (Ciega Pequeña)', group: 'Blinds' },
  BB: { label: 'BB', name: 'Big Blind', full: 'BB (Ciega Grande)', group: 'Blinds' },
};

/**
 * Standard Texas Hold'em postflop acting order (from earliest/OOP to latest/IP):
 * 1. SB acts first
 * 2. BB acts second
 * 3. EP (UTG) acts third
 * 4. MP acts fourth
 * 5. CO acts fifth
 * 6. BTN acts sixth (acts last on all postflop streets)
 */
export const POSTFLOP_ACTING_ORDER: Record<TablePosition, number> = {
  SB: 1,
  BB: 2,
  EP: 3,
  MP: 4,
  CO: 5,
  BTN: 6,
};

export function getPostflopRole(myPos: TablePosition, oppPos: TablePosition): 'IP' | 'OOP' {
  if (myPos === oppPos) {
    return (myPos === 'BTN' || myPos === 'CO' || myPos === 'MP' || myPos === 'EP') ? 'IP' : 'OOP';
  }
  return POSTFLOP_ACTING_ORDER[myPos] > POSTFLOP_ACTING_ORDER[oppPos] ? 'IP' : 'OOP';
}

interface HandAndPositionBarProps {
  heroPos: TablePosition;
  villainPos: TablePosition;
  onHeroPosChange: (pos: TablePosition) => void;
  onVillainPosChange: (pos: TablePosition) => void;
  onSwapPositions: () => void;
  heroCards: [Card, Card] | null;
  onSelectHeroCards: (card1: Card, card2: Card) => void;
  onRandomHeroCards: () => void;
  boardCards: Card[];
  extraAction?: React.ReactNode;
}

export const HandAndPositionBar: React.FC<HandAndPositionBarProps> = ({
  heroPos,
  villainPos,
  onHeroPosChange,
  onVillainPosChange,
  onSwapPositions,
  heroCards,
  onSelectHeroCards,
  onRandomHeroCards,
  boardCards,
  extraAction
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pickerCard1, setPickerCard1] = useState<Card | null>(heroCards ? heroCards[0] : null);
  const [pickerCard2, setPickerCard2] = useState<Card | null>(heroCards ? heroCards[1] : null);

  const heroIsIp = getPostflopRole(heroPos, villainPos) === 'IP';
  const villainIsIp = getPostflopRole(villainPos, heroPos) === 'IP';

  const boardCardIds = useMemo(() => new Set(boardCards.map(c => c.id)), [boardCards]);

  const handleOpenModal = () => {
    if (heroCards) {
      setPickerCard1(heroCards[0]);
      setPickerCard2(heroCards[1]);
    } else {
      setPickerCard1(null);
      setPickerCard2(null);
    }
    setIsModalOpen(true);
  };

  const handleCardClick = (card: Card) => {
    if (pickerCard1 && pickerCard1.id === card.id) {
      setPickerCard1(null);
      return;
    }
    if (pickerCard2 && pickerCard2.id === card.id) {
      setPickerCard2(null);
      return;
    }
    if (!pickerCard1) {
      setPickerCard1(card);
      return;
    }
    if (!pickerCard2) {
      setPickerCard2(card);
      return;
    }
    setPickerCard2(card);
  };

  const handleConfirm = () => {
    if (pickerCard1 && pickerCard2) {
      onSelectHeroCards(pickerCard1, pickerCard2);
      setIsModalOpen(false);
    }
  };

  const renderMiniCard = (card: Card) => {
    const style = SUIT_COLORS[card.suit];
    return (
      <div
        key={card.id}
        className={`w-10 h-14 rounded-lg bg-neutral-950 border ${style.border} flex flex-col justify-between p-1 shadow-md select-none`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-bold leading-none ${style.text}`}>{card.rank}</span>
          <span className={`text-[10px] ${style.text}`}>{SUIT_SYMBOLS[card.suit]}</span>
        </div>
        <div className="flex justify-center items-center my-auto">
          <span className={`text-lg leading-none ${style.text}`}>{SUIT_SYMBOLS[card.suit]}</span>
        </div>
      </div>
    );
  };

  const currentCombo = heroCards
    ? createConcreteComboFromCards(heroCards[0], heroCards[1])
    : null;

  return (
    <div className="bg-neutral-900 border border-emerald-500/40 rounded-xl p-4 shadow-lg flex flex-col gap-3">
      {/* Title strip */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            Configuración de Posición y Cartas del Jugador (Hero)
          </h2>
        </div>
        {extraAction}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Left: Positions Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Hero Position */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
              <span className="font-bold text-emerald-400">Mi Posición (Hero):</span>
              <span className="text-neutral-500">
                ({heroIsIp ? 'Con Posición / IP' : 'Fuera de Posición / OOP'})
              </span>
            </div>
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs flex-wrap">
              {TABLE_POSITIONS.map(pos => {
                const role = getPostflopRole(pos, villainPos);
                const isSelected = heroPos === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      onHeroPosChange(pos);
                      if (pos === villainPos) {
                        onVillainPosChange(pos === 'BB' ? 'BTN' : 'BB');
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded font-mono font-bold transition-all flex items-center gap-1 ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                    }`}
                    title={`${POSITION_INFO[pos].full} - ${role === 'IP' ? 'In Position' : 'Out of Position'}`}
                  >
                    <span>{pos}</span>
                    <span className={`text-[10px] font-normal ${isSelected ? 'text-emerald-100' : 'text-neutral-500'}`}>
                      {role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Swap Positions Button */}
          <div className="flex flex-col justify-end pt-5">
            <button
              type="button"
              onClick={onSwapPositions}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-700 shadow-xs"
              title="Invertir posiciones entre Hero y Villano"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-emerald-400" />
              <span>Invertir Posiciones</span>
            </button>
          </div>

          {/* Villain Position */}
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-400">
              <span>Posición del Villano:</span>
              <span className="text-neutral-500">
                ({villainIsIp ? 'IP' : 'OOP'})
              </span>
            </div>
            <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs flex-wrap">
              {TABLE_POSITIONS.map(pos => {
                const role = getPostflopRole(pos, heroPos);
                const isSelected = villainPos === pos;
                return (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => {
                      onVillainPosChange(pos);
                      if (pos === heroPos) {
                        onHeroPosChange(pos === 'BB' ? 'BTN' : 'BB');
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded font-mono font-medium transition-colors flex items-center gap-1 ${
                      isSelected
                        ? 'bg-rose-600 text-white font-bold shadow-xs border border-rose-500 ring-1 ring-rose-400/50'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-900/60'
                    }`}
                    title={`${POSITION_INFO[pos].full} - ${role === 'IP' ? 'In Position' : 'Out of Position'}`}
                  >
                    <span>{pos}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-rose-100 font-semibold' : 'text-neutral-500'}`}>
                      {role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Hero Hole Cards Selector */}
        <div className="flex items-center gap-3 bg-neutral-950/80 p-2.5 rounded-xl border border-neutral-800">
          {/* Card Slots */}
          <div
            onClick={handleOpenModal}
            className="flex items-center gap-1.5 cursor-pointer group hover:opacity-90 transition-opacity"
            title="Haz clic para seleccionar tus 2 cartas"
          >
            {heroCards ? (
              <>
                {renderMiniCard(heroCards[0])}
                {renderMiniCard(heroCards[1])}
              </>
            ) : (
              <>
                <div className="w-10 h-14 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                  Carta 1
                </div>
                <div className="w-10 h-14 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                  Carta 2
                </div>
              </>
            )}
          </div>

          <div className="space-y-1">
            <div className="text-xs font-semibold text-white flex items-center gap-2">
              <span>{currentCombo ? currentCombo.canonicalName : 'Sin cartas seleccionadas'}</span>
              {currentCombo && (
                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                  ({currentCombo.key})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenModal}
                className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Elegir Mis Cartas</span>
              </button>

              <button
                type="button"
                onClick={onRandomHeroCards}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
                title="Repartir mano aleatoria desde el rango"
              >
                <Shuffle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Aleatorio</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 52-Card Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div>
                <h3 className="text-sm font-bold text-white">Selecciona tus 2 Cartas (Hero)</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Posición activa: <strong className="text-emerald-400">{heroPos} ({heroIsIp ? 'IP' : 'OOP'})</strong>. Las cartas presentes en el board están bloqueadas.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview of chosen cards */}
            <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-xl border border-neutral-800">
              <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-400 font-medium">Mano Elegida:</span>
                <div className="flex items-center gap-2">
                  {pickerCard1 ? (
                    renderMiniCard(pickerCard1)
                  ) : (
                    <div className="w-10 h-14 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                      Carta 1
                    </div>
                  )}
                  {pickerCard2 ? (
                    renderMiniCard(pickerCard2)
                  ) : (
                    <div className="w-10 h-14 rounded-lg border border-dashed border-neutral-700 flex items-center justify-center text-[10px] text-neutral-500 font-mono">
                      Carta 2
                    </div>
                  )}
                </div>
              </div>

              {pickerCard1 && pickerCard2 && (
                <div className="text-right">
                  <div className="text-base font-bold text-white font-mono">
                    {createConcreteComboFromCards(pickerCard1, pickerCard2).canonicalName}
                  </div>
                  <div className="text-xs text-emerald-400 font-mono">
                    {createConcreteComboFromCards(pickerCard1, pickerCard2).key}
                  </div>
                </div>
              )}
            </div>

            {/* 4-Color Card Grid */}
            <div className="space-y-2.5">
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
                        const isDead = boardCardIds.has(cid);
                        const isSelectedCard1 = pickerCard1?.id === cid;
                        const isSelectedCard2 = pickerCard2?.id === cid;
                        const isSelected = isSelectedCard1 || isSelectedCard2;
                        const cardObj: Card = { rank, suit, id: cid };

                        return (
                          <button
                            key={rank}
                            type="button"
                            disabled={isDead}
                            onClick={() => handleCardClick(cardObj)}
                            className={`h-9 rounded flex items-center justify-center font-bold text-xs transition-all ${
                              isDead
                                ? 'bg-neutral-950 text-neutral-800 line-through cursor-not-allowed border border-neutral-900'
                                : isSelected
                                ? 'bg-emerald-500 text-white ring-2 ring-emerald-300 font-extrabold scale-105 z-10'
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

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => {
                  setPickerCard1(null);
                  setPickerCard2(null);
                }}
                className="px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Limpiar Selección
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-neutral-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!pickerCard1 || !pickerCard2}
                  onClick={handleConfirm}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    pickerCard1 && pickerCard2
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                      : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Confirmar Mis Cartas</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
