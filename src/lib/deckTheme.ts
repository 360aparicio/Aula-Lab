/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DeckTheme: Preferencias de baraja global de Allin School (por defecto Blanco Clásico)
 * sincronizadas por UID en almacenamiento local y perfil de usuario en Firestore.
 */

import type { Suit } from '../engine/cards';
import { readScopedItem, writeScopedItem } from './userStorage';

export type DeckThemeId =
  | 'classic_white'
  | 'four_color_white'
  | 'dark_pro'
  | 'four_color_dark';

export const DEFAULT_DECK_THEME: DeckThemeId = 'classic_white';
export const DECK_THEME_STORAGE_KEY = 'allin_deck_theme_v1';
export const DECK_THEME_EVENT = 'allin-deck-theme-updated';

export interface DeckThemeDefinition {
  id: DeckThemeId;
  name: string;
  shortName: string;
  description: string;
  isDefault?: boolean;
  isLightCard: boolean;
  cardBg: string;
  cardBorder: string;
  cardShadow: string;
  slotBg: string;
  slotBorder: string;
  slotText: string;
  backBg: string;
  backBorder: string;
  backText: string;
  suitText: Record<Suit, string>;
  suitBorder: Record<Suit, string>;
  pickerCellBg: Record<Suit, string>;
}

export const DECK_THEMES: Record<DeckThemeId, DeckThemeDefinition> = {
  classic_white: {
    id: 'classic_white',
    name: 'Blanco Clásico (2 Colores)',
    shortName: 'Blanco Clásico',
    description: 'Fondo blanco nítido estándar de casino con contraste clásico negro/rojo.',
    isDefault: true,
    isLightCard: true,
    cardBg: 'bg-white',
    cardBorder: 'border-neutral-300',
    cardShadow: 'shadow-md shadow-black/35',
    slotBg: 'bg-white/95',
    slotBorder: 'border-neutral-300',
    slotText: 'text-neutral-600',
    backBg: 'bg-gradient-to-br from-blue-950 to-slate-900',
    backBorder: 'border-blue-400/40',
    backText: 'text-blue-200',
    suitText: {
      s: 'text-neutral-900',
      h: 'text-red-600',
      d: 'text-red-600',
      c: 'text-neutral-900'
    },
    suitBorder: {
      s: 'border-neutral-300',
      h: 'border-neutral-300',
      d: 'border-neutral-300',
      c: 'border-neutral-300'
    },
    pickerCellBg: {
      s: 'bg-white hover:bg-neutral-100',
      h: 'bg-white hover:bg-rose-50',
      d: 'bg-white hover:bg-rose-50',
      c: 'bg-white hover:bg-neutral-100'
    }
  },
  four_color_white: {
    id: 'four_color_white',
    name: 'Blanco Torneo (4 Colores)',
    shortName: 'Blanco 4-Color',
    description: 'Fondo blanco limpio con 4 colores distintos para evitar errores de palo en multi-mesa.',
    isLightCard: true,
    cardBg: 'bg-white',
    cardBorder: 'border-neutral-300',
    cardShadow: 'shadow-md shadow-black/35',
    slotBg: 'bg-white/95',
    slotBorder: 'border-neutral-300',
    slotText: 'text-neutral-600',
    backBg: 'bg-gradient-to-br from-indigo-950 to-slate-900',
    backBorder: 'border-indigo-400/40',
    backText: 'text-indigo-200',
    suitText: {
      s: 'text-neutral-900',
      h: 'text-red-600',
      d: 'text-blue-600',
      c: 'text-emerald-600'
    },
    suitBorder: {
      s: 'border-neutral-300',
      h: 'border-red-300',
      d: 'border-blue-300',
      c: 'border-emerald-300'
    },
    pickerCellBg: {
      s: 'bg-white hover:bg-neutral-100',
      h: 'bg-white hover:bg-red-50',
      d: 'bg-white hover:bg-blue-50',
      c: 'bg-white hover:bg-emerald-50'
    }
  },
  dark_pro: {
    id: 'dark_pro',
    name: 'Negro Estudio (2 Colores)',
    shortName: 'Oscura Clásica',
    description: 'Naipes oscuros de baja fatiga visual con contraste blanco y rojo carmesí.',
    isLightCard: false,
    cardBg: 'bg-neutral-950',
    cardBorder: 'border-neutral-700',
    cardShadow: 'shadow-md shadow-black/50',
    slotBg: 'bg-neutral-950',
    slotBorder: 'border-neutral-700',
    slotText: 'text-neutral-400',
    backBg: 'bg-neutral-900',
    backBorder: 'border-neutral-700',
    backText: 'text-neutral-400',
    suitText: {
      s: 'text-neutral-100',
      h: 'text-rose-400',
      d: 'text-rose-400',
      c: 'text-neutral-100'
    },
    suitBorder: {
      s: 'border-neutral-700',
      h: 'border-rose-900/70',
      d: 'border-rose-900/70',
      c: 'border-neutral-700'
    },
    pickerCellBg: {
      s: 'bg-neutral-900 hover:bg-neutral-800',
      h: 'bg-rose-950/40 hover:bg-rose-950/70',
      d: 'bg-rose-950/40 hover:bg-rose-950/70',
      c: 'bg-neutral-900 hover:bg-neutral-800'
    }
  },
  four_color_dark: {
    id: 'four_color_dark',
    name: 'Dark Solver (4 Colores)',
    shortName: 'Solver 4-Color',
    description: 'Baraja oscura técnica de 4 palos luminosos pensada para sesiones largas de solver.',
    isLightCard: false,
    cardBg: 'bg-neutral-950',
    cardBorder: 'border-neutral-700',
    cardShadow: 'shadow-md shadow-black/50',
    slotBg: 'bg-neutral-950',
    slotBorder: 'border-neutral-700',
    slotText: 'text-neutral-400',
    backBg: 'bg-neutral-900',
    backBorder: 'border-neutral-700',
    backText: 'text-neutral-400',
    suitText: {
      s: 'text-neutral-100',
      h: 'text-red-400',
      d: 'text-blue-400',
      c: 'text-emerald-400'
    },
    suitBorder: {
      s: 'border-neutral-700',
      h: 'border-red-800/70',
      d: 'border-blue-800/70',
      c: 'border-emerald-800/70'
    },
    pickerCellBg: {
      s: 'bg-neutral-800/80 hover:bg-neutral-800',
      h: 'bg-red-950/40 hover:bg-red-950/70',
      d: 'bg-blue-950/40 hover:bg-blue-950/70',
      c: 'bg-emerald-950/40 hover:bg-emerald-950/70'
    }
  }
};

export const DECK_THEME_LIST: DeckThemeDefinition[] = [
  DECK_THEMES.classic_white,
  DECK_THEMES.four_color_white,
  DECK_THEMES.dark_pro,
  DECK_THEMES.four_color_dark
];

export function isValidDeckThemeId(val: unknown): val is DeckThemeId {
  return (
    val === 'classic_white' ||
    val === 'four_color_white' ||
    val === 'dark_pro' ||
    val === 'four_color_dark'
  );
}

export function loadDeckThemePreference(): DeckThemeId {
  try {
    const raw = readScopedItem(DECK_THEME_STORAGE_KEY);
    if (isValidDeckThemeId(raw)) {
      return raw;
    }
  } catch {
    // ignore storage fallback errors
  }
  return DEFAULT_DECK_THEME;
}

export function saveDeckThemePreference(themeId: DeckThemeId): DeckThemeId {
  const safeTheme = isValidDeckThemeId(themeId) ? themeId : DEFAULT_DECK_THEME;
  try {
    writeScopedItem(DECK_THEME_STORAGE_KEY, safeTheme);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(DECK_THEME_EVENT, { detail: safeTheme }));
    }
  } catch {
    // ignore storage errors
  }
  return safeTheme;
}

export function getDeckThemeDefinition(themeId?: DeckThemeId | null): DeckThemeDefinition {
  if (themeId && isValidDeckThemeId(themeId)) {
    return DECK_THEMES[themeId];
  }
  return DECK_THEMES[DEFAULT_DECK_THEME];
}
