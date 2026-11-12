/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * PlayerLiveCoachTracker: Componente visual de Auto-Aprendizaje en Tiempo Real & SM-2.
 * Muestra el perfil dinámico auto-aprendido del usuario (Dominio, Fugas principales,
 * Estilo de juego, Manos recopiladas y Tarjetas SM-2 pendientes para ganar la mano actual).
 */

import React, { useState, useEffect } from 'react';
import { AutoLearningEngine, PlayerLearningProfile } from '../engine/autoLearningEngine';
import {
  Brain,
  Zap,
  AlertTriangle,
  TrendingUp,
  ShieldAlert,
  Sparkles,
  ChevronRight,
  RotateCcw,
  History,
  Target
} from 'lucide-react';

interface PlayerLiveCoachTrackerProps {
  street?: string;
  potBB?: number;
  compact?: boolean;
}

export const PlayerLiveCoachTracker: React.FC<PlayerLiveCoachTrackerProps> = ({
  street = 'flop',
  potBB = 6,
  compact = false
}) => {
  const [profile, setProfile] = useState<PlayerLearningProfile>(() => {
    return AutoLearningEngine.getInstance().getProfile();
  });

  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect(() => {
    const handleStorage = () => {
      setProfile(AutoLearningEngine.getInstance().getProfile());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  if (compact) {
    return (
      <div className="flex items-center justify-between gap-3 px-3 py-1.5 bg-neutral-900 border border-neutral-800 rounded-xl text-xs">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-neutral-400">Auto-Learning:</span>
          <strong className="text-white font-mono">{profile.masteryScore}% Dominio</strong>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-mono">
            {profile.styleProfile}
          </span>
          <span className="text-emerald-400 font-semibold text-[11px]">
            {profile.sm2DueCardsCount} SM-2 pendientes
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 shadow-xl space-y-3">
      {/* Top Banner */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-blue-500/10 rounded-lg border border-blue-500/30 text-blue-400">
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              Auto-Aprendizaje & Repetición Espaciada SM-2
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-950 text-blue-300 border border-blue-800 font-mono">
                Autosuficiente V3.1 Pro
              </span>
            </h4>
            <span className="text-[11px] text-neutral-400">
              Recopila manos jugadas, detecta fugas en vivo y agenda repasos automáticos
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="text-right">
              <span className="text-[10px] text-neutral-500 uppercase block">Puntuación GTO:</span>
              <span className="text-sm font-bold font-mono text-emerald-400">{profile.masteryScore} / 100</span>
            </div>
            <div className="text-right pl-3 border-l border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase block">SM-2 Hoy:</span>
              <span className="text-sm font-bold font-mono text-blue-400">{profile.sm2DueCardsCount} spots</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer pl-2"
          >
            {expanded ? 'Menos detalles ▲' : 'Ver Fugas & Manos ▼'}
          </button>
        </div>
      </div>

      {/* Dynamic Live Advice Card */}
      <div className="p-3 bg-gradient-to-r from-blue-950/30 via-neutral-900 to-neutral-900 border border-blue-800/40 rounded-xl flex items-start gap-3">
        <Zap className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <strong className="text-white block font-sans">
            Guía Personalizada para Ganar esta Mano:
          </strong>
          <p className="text-neutral-300 leading-relaxed font-sans text-[11px]">
            {profile.primaryLeak.prescriptiveFix}
          </p>
        </div>
      </div>

      {/* Expanded Breakdown */}
      {expanded && (
        <div className="pt-2 border-t border-neutral-800/80 space-y-3 text-xs animate-in fade-in duration-150">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block">Estilo Detectado:</span>
              <strong className="text-blue-300 font-mono">{profile.styleProfile}</strong>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block">EV Loss Medio:</span>
              <strong className="text-amber-400 font-mono">{profile.averageEvLossPct}% / mano</strong>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block">Manos Recopiladas:</span>
              <strong className="text-emerald-400 font-mono">{(profile.collectedHands || []).length} manos</strong>
            </div>
            <div className="p-2.5 bg-neutral-900 rounded-xl border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block">Fuga Crítica:</span>
              <strong className="text-red-400 truncate block">{profile.primaryLeak.title}</strong>
            </div>
          </div>

          <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-red-400 font-bold text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Diagnóstico Detallado de tu Fuga:</span>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              {profile.primaryLeak.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
