/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PlayingCard: Componente unificado de naipe que aplica automáticamente la baraja
 * seleccionada en Ajustes de Usuario (por defecto Blanco Clásico) en toda la app.
 */

import React from 'react';
import { X } from 'lucide-react';
import { SUIT_SYMBOLS, type Card } from '../engine/cards';
import { useDeckTheme } from '../context/DeckThemeContext';
import { getDeckThemeDefinition, type DeckThemeId } from '../lib/deckTheme';

export type PlayingCardSize = 'xs' | 'sm' | 'md' | 'lg';

interface PlayingCardProps {
  card: Card;
  size?: PlayingCardSize;
  label?: string;
  onClick?: () => void;
  onRemove?: (e: React.MouseEvent) => void;
  highlight?: 'none' | 'emerald' | 'blue' | 'amber';
  themeOverride?: DeckThemeId;
  className?: string;
  title?: string;
}

const SIZE_MAP: Record<
  PlayingCardSize,
  { box: string; rank: string; cornerSuit: string; centerSuit: string; pad: string }
> = {
  xs: {
    box: 'w-8 h-11 rounded-md',
    rank: 'text-[11px]',
    cornerSuit: 'text-[9px]',
    centerSuit: 'text-sm',
    pad: 'p-1'
  },
  sm: {
    box: 'w-10 h-14 rounded-lg',
    rank: 'text-xs',
    cornerSuit: 'text-[10px]',
    centerSuit: 'text-lg',
    pad: 'p-1'
  },
  md: {
    box: 'w-12 h-16 sm:w-14 sm:h-20 rounded-xl',
    rank: 'text-sm sm:text-base',
    cornerSuit: 'text-[10px] sm:text-xs',
    centerSuit: 'text-xl sm:text-2xl',
    pad: 'p-1.5'
  },
  lg: {
    box: 'w-16 h-22 rounded-xl',
    rank: 'text-lg',
    cornerSuit: 'text-xs',
    centerSuit: 'text-2xl',
    pad: 'p-2'
  }
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  size = 'md',
  label,
  onClick,
  onRemove,
  highlight = 'none',
  themeOverride,
  className = '',
  title
}) => {
  const { deckTheme } = useDeckTheme();
  const activeTheme = themeOverride ? getDeckThemeDefinition(themeOverride) : deckTheme;
  const sz = SIZE_MAP[size];
  const suitColor = activeTheme.suitText[card.suit];
  const borderClass = activeTheme.suitBorder[card.suit] || activeTheme.cardBorder;

  const highlightRing =
    highlight === 'emerald'
      ? 'ring-2 ring-emerald-500/80 border-emerald-400'
      : highlight === 'blue'
      ? 'ring-2 ring-blue-500/80 border-blue-400'
      : highlight === 'amber'
      ? 'ring-2 ring-amber-400/80 border-amber-400'
      : '';

  return (
    <div
      onClick={onClick}
      title={title}
      className={`relative group ${sz.box} ${sz.pad} ${activeTheme.cardBg} border ${borderClass} ${activeTheme.cardShadow} ${highlightRing} flex flex-col justify-between select-none transition-all ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5 hover:ring-2 hover:ring-blue-400/70' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between leading-none">
        <span className={`${sz.rank} font-mono font-extrabold tracking-tight ${suitColor}`}>
          {card.rank}
        </span>
        <span className={`${sz.cornerSuit} leading-none ${suitColor}`}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>

      <div className="flex items-center justify-center my-auto">
        <span className={`${sz.centerSuit} leading-none ${suitColor}`}>
          {SUIT_SYMBOLS[card.suit]}
        </span>
      </div>

      {label ? (
        <div
          className={`text-[8px] font-mono text-right leading-none ${
            activeTheme.isLightCard ? 'text-neutral-500' : 'text-neutral-400'
          }`}
        >
          {label}
        </div>
      ) : (
        <div className="flex items-center justify-between leading-none opacity-85">
          <span className={`${sz.cornerSuit} leading-none ${suitColor}`}>
            {SUIT_SYMBOLS[card.suit]}
          </span>
          <span className={`${sz.cornerSuit} font-mono font-bold ${suitColor}`}>
            {card.rank}
          </span>
        </div>
      )}

      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-neutral-900 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity border border-neutral-700 shadow cursor-pointer"
          title="Quitar carta"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
};

export const PlayingCardBack: React.FC<{
  size?: PlayingCardSize;
  themeOverride?: DeckThemeId;
  className?: string;
}> = ({ size = 'sm', themeOverride, className = '' }) => {
  const { deckTheme } = useDeckTheme();
  const activeTheme = themeOverride ? getDeckThemeDefinition(themeOverride) : deckTheme;
  const sz = SIZE_MAP[size];

  return (
    <div
      className={`${sz.box} ${activeTheme.backBg} border ${activeTheme.backBorder} ${activeTheme.cardShadow} flex items-center justify-center font-mono text-[10px] font-bold select-none ${activeTheme.backText} ${className}`}
    >
      AS
    </div>
  );
};
