/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DeckThemeContext: Proveedor global de estilo de baraja para toda la plataforma.
 * Sincroniza la preferencia entre pestañas, almacenamiento por UID y Firestore.
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  DECK_THEMES,
  DECK_THEME_EVENT,
  DEFAULT_DECK_THEME,
  isValidDeckThemeId,
  loadDeckThemePreference,
  saveDeckThemePreference,
  type DeckThemeDefinition,
  type DeckThemeId
} from '../lib/deckTheme';
import { useAuth } from './AuthContext';

interface DeckThemeContextValue {
  deckThemeId: DeckThemeId;
  deckTheme: DeckThemeDefinition;
  setDeckTheme: (next: DeckThemeId) => void;
}

const DeckThemeContext = createContext<DeckThemeContextValue>({
  deckThemeId: DEFAULT_DECK_THEME,
  deckTheme: DECK_THEMES[DEFAULT_DECK_THEME],
  setDeckTheme: () => {}
});

export const DeckThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile } = useAuth();
  const [deckThemeId, setDeckThemeId] = useState<DeckThemeId>(() => loadDeckThemePreference());

  // Reload preference whenever authenticated user UID changes
  useEffect(() => {
    setDeckThemeId(loadDeckThemePreference());
  }, [user?.uid]);

  // Hydrate preference from cloud profile when available and no local override exists
  useEffect(() => {
    if (userProfile?.deckTheme && isValidDeckThemeId(userProfile.deckTheme)) {
      const saved = saveDeckThemePreference(userProfile.deckTheme);
      setDeckThemeId(saved);
    }
  }, [userProfile?.deckTheme]);

  // Listen for programmatic updates from other views or storage sync
  useEffect(() => {
    const onThemeEvent = (ev: Event) => {
      const detail = (ev as CustomEvent<DeckThemeId>).detail;
      if (isValidDeckThemeId(detail)) {
        setDeckThemeId(detail);
      } else {
        setDeckThemeId(loadDeckThemePreference());
      }
    };
    window.addEventListener(DECK_THEME_EVENT, onThemeEvent);
    return () => window.removeEventListener(DECK_THEME_EVENT, onThemeEvent);
  }, []);

  const setDeckTheme = useCallback((next: DeckThemeId) => {
    const saved = saveDeckThemePreference(next);
    setDeckThemeId(saved);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('lab-pro-sync-needed'));
    }
  }, []);

  return (
    <DeckThemeContext.Provider
      value={{
        deckThemeId,
        deckTheme: DECK_THEMES[deckThemeId] || DECK_THEMES[DEFAULT_DECK_THEME],
        setDeckTheme
      }}
    >
      {children}
    </DeckThemeContext.Provider>
  );
};

export function useDeckTheme(): DeckThemeContextValue {
  return useContext(DeckThemeContext);
}
