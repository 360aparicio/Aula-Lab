/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * UserSettingsModal: Ajustes personales del estudiante (selección de baraja global
 * con vista previa en tiempo real aplicada en Academia, Evaluaciones, Simulador y Lab).
 */

import React, { useState } from 'react';
import { X, Check, Palette, Sparkles, CheckCircle2 } from 'lucide-react';
import { parseCard } from '../engine/cards';
import { DECK_THEME_LIST, type DeckThemeId } from '../lib/deckTheme';
import { useDeckTheme } from '../context/DeckThemeContext';
import { PlayingCard } from './PlayingCard';

interface UserSettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const PREVIEW_CARDS = [
  parseCard('As'),
  parseCard('Kh'),
  parseCard('Qd'),
  parseCard('Jc')
];

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({ open, onClose }) => {
  const { deckThemeId, setDeckTheme } = useDeckTheme();
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  if (!open) return null;

  const handleChooseTheme = (id: DeckThemeId, label: string) => {
    setDeckTheme(id);
    setSavedFeedback(`Baraja "${label}" aplicada en toda la escuela.`);
    setTimeout(() => setSavedFeedback(null), 3000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-settings-title"
    >
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between gap-4 bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h2 id="user-settings-title" className="text-base font-bold text-white tracking-tight">
                Ajustes de Baraja y Preferencias Visuales
              </h2>
              <p className="text-xs text-neutral-400">
                El estilo de naipe elegido se aplica instantáneamente en Inicio, Academia, Evaluaciones y Simuladores.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Cerrar ajustes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {savedFeedback && (
            <div className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{savedFeedback}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DECK_THEME_LIST.map(theme => {
              const isSelected = deckThemeId === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleChooseTheme(theme.id, theme.name)}
                  className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                    isSelected
                      ? 'bg-blue-950/25 border-blue-500 ring-2 ring-blue-500/30 shadow-lg'
                      : 'bg-neutral-950/75 border-neutral-800 hover:border-neutral-600'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white">{theme.name}</span>
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold">
                          <Check className="w-3 h-3" />
                          <span>Activa</span>
                        </span>
                      ) : theme.isDefault ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-mono">
                          <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                          <span>Por defecto</span>
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">{theme.description}</p>
                  </div>

                  {/* Live Deck Preview */}
                  <div className="p-3 rounded-xl bg-neutral-900/80 border border-neutral-800/80 flex items-center justify-center gap-2">
                    {PREVIEW_CARDS.map(card => (
                      <PlayingCard
                        key={`${theme.id}-${card.id}`}
                        card={card}
                        size="xs"
                        themeOverride={theme.id}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/60 flex items-center justify-between gap-3">
          <span className="text-[11px] text-neutral-400">
            Tu preferencia se guarda por usuario y se sincroniza en la nube.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
