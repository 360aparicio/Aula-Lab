/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HandContextBar: Universal real-time poker metric bar.
 * Monitors and displays:
 * - Current Pot Size (Chips & BB)
 * - Effective Stack Size (Chips & BB)
 * - Stack-to-Pot Ratio (SPR) with dynamic color-coding and commitment interpretation
 * - Pot Odds Calculator & Facing Bet Odds
 * - Opponent Profile selector (Nit / Regular / Fish)
 * - Board Texture summary
 */

import React from 'react';
import { Card, SUIT_SYMBOLS } from '../engine/cards';
import { ActionNode } from '../engine/gameTree';
import { TablePosition } from './HandAndPositionBar';
import { OpponentProfile, OPPONENT_PROFILES } from '../engine/preflopMatchups';
import {
  PieChart,
  Coins,
  ShieldAlert,
  Percent,
  Sparkles,
  HelpCircle,
  TrendingUp,
  Layers,
  Flame,
  UserCheck,
  Fish,
  Shield,
  Scale
} from 'lucide-react';

export interface HandContextBarProps {
  currentPot: number; // in chips
  effectiveStack: number; // in chips
  boardCards: Card[];
  street: 'flop' | 'turn' | 'river';
  selectedNode?: ActionNode | null;
  heroPos?: TablePosition;
  villainPos?: TablePosition;
  opponentProfile?: OpponentProfile;
  onOpponentProfileChange?: (profile: OpponentProfile) => void;
  bbUnit?: number; // default chips per BB (typically 2 or 10)
  className?: string;
}

export const HandContextBar: React.FC<HandContextBarProps> = ({
  currentPot,
  effectiveStack,
  boardCards,
  street,
  selectedNode,
  heroPos = 'BTN',
  villainPos = 'BB',
  opponentProfile = 'regular',
  onOpponentProfileChange,
  bbUnit = 2,
  className = ''
}) => {
  // Use node pot if selected node exists, otherwise use currentPot
  const activePot = selectedNode?.pot ?? currentPot;
  const potInBB = (activePot / bbUnit).toFixed(1);
  const stackInBB = (effectiveStack / bbUnit).toFixed(1);

  // Stack-to-Pot Ratio (SPR) Calculation
  const sprValue = activePot > 0 ? effectiveStack / activePot : 0;
  const sprFormatted = sprValue.toFixed(2);

  // SPR Interpretation & Classification
  let sprCategory: 'low' | 'medium' | 'high' = 'medium';
  let sprBadgeClass = 'bg-emerald-950/80 text-emerald-400 border-emerald-500/50';
  let sprLabel = 'SPR Medio (Estándar)';
  let sprStrategicGuidance = 'Top pair con kicker medio debe controlar el bote; los proyectos retienen buenas implied odds.';

  if (sprValue < 2.5) {
    sprCategory = 'low';
    sprBadgeClass = 'bg-rose-950/90 text-rose-300 border-rose-500/60 animate-pulse';
    sprLabel = 'SPR Bajo (Compromiso Total)';
    sprStrategicGuidance = 'Pot Committed: Overpairs y Top Pair Top Kicker juegan por stacks sin contemplar folds.';
  } else if (sprValue > 6.5) {
    sprCategory = 'high';
    sprBadgeClass = 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50';
    sprLabel = 'SPR Alto (Juego Profundo)';
    sprStrategicGuidance = 'Mucha maniobrabilidad. Cuidado con Reverse Implied Odds; solo manos de valor monstruo arriesgan todo el stack.';
  }

  // Pot Odds Calculation for facing bets
  let facingBetOdds: { bet: number; potOddsPercent: number; ratio: string } | null = null;
  if (selectedNode && selectedNode.actions) {
    const callAction = selectedNode.actions.find(a => a.type === 'CALL');
    if (callAction && callAction.addedAmount > 0) {
      const betAmount = callAction.addedAmount;
      const potBeforeCall = activePot;
      const totalPotAfterCall = potBeforeCall + betAmount;
      const potOddsPct = (betAmount / totalPotAfterCall) * 100;
      const ratioVal = potBeforeCall / betAmount;
      facingBetOdds = {
        bet: betAmount,
        potOddsPercent: Math.round(potOddsPct * 10) / 10,
        ratio: `${ratioVal.toFixed(1)} : 1`
      };
    }
  }

  // Board texture diagnostics
  const numSuits: Record<string, number> = {};
  boardCards.forEach(c => {
    numSuits[c.suit] = (numSuits[c.suit] || 0) + 1;
  });
  const maxSameSuit = Math.max(...Object.values(numSuits), 0);
  const isFlushPossibility = maxSameSuit >= 3;
  const isMonotone = maxSameSuit >= 4;

  const currentOpponent = OPPONENT_PROFILES[opponentProfile] || OPPONENT_PROFILES.regular;

  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4 relative overflow-hidden ${className}`}
    >
      {/* Decorative gradient flare */}
      <div className="absolute top-0 right-0 w-96 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Row 1: Primary Metrics Grid (SPR, Pot, Stack, Opponent Profile) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
        {/* Metric 1: SPR (Stack-to-Pot Ratio) */}
        <div className="bg-neutral-950/80 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2 shadow-xs group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <PieChart className="w-3.5 h-3.5 text-cyan-400" />
              <span>SPR de la Mano</span>
            </span>
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${sprBadgeClass}`}>
              {sprLabel}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white tracking-tight">
              {sprFormatted}
            </span>
            <span className="text-xs text-neutral-500 font-mono">
              (Stack / Bote)
            </span>
          </div>

          <p className="text-[11px] text-neutral-400 leading-snug">
            {sprStrategicGuidance}
          </p>
        </div>

        {/* Metric 2: Pot Size */}
        <div className="bg-neutral-950/80 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2 shadow-xs group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>Tamaño del Bote</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-emerald-400 border border-neutral-800 font-bold uppercase">
              {street}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400 tracking-tight">
              {activePot}
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              fichas · <strong className="text-white">{potInBB} BB</strong>
            </span>
          </div>

          <p className="text-[11px] text-neutral-400 leading-snug">
            {selectedNode ? `Nodo actual: ${selectedNode.player} (${selectedNode.actions?.map(a => a.label).join(' / ') || 'Acción'})` : 'Bote acumulado postflop'}
          </p>
        </div>

        {/* Metric 3: Pot Odds (Required Equity) */}
        <div className="bg-neutral-950/80 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2 shadow-xs group hover:border-emerald-500/40 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pot Odds & Equity</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-neutral-900 text-cyan-300 border border-neutral-800 font-bold">
              {facingBetOdds ? facingBetOdds.ratio : 'Escala Referencia'}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-cyan-300 tracking-tight">
              {facingBetOdds ? `${facingBetOdds.potOddsPercent}%` : '20% - 30%'}
            </span>
            <span className="text-xs text-neutral-400 font-mono">
              {facingBetOdds ? 'equity requerida' : 'según sizing'}
            </span>
          </div>

          {/* Quick reference chips */}
          <div className="flex items-center gap-1 text-[10px] font-mono text-neutral-400 flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800" title="Apuesta 33% pot requiere 20% equity">
              33% ➔ 20%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800" title="Apuesta 50% pot requiere 25% equity">
              50% ➔ 25%
            </span>
            <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-300 border border-neutral-800" title="Apuesta 75% pot requiere 30% equity">
              75% ➔ 30%
            </span>
          </div>
        </div>

        {/* Metric 4: Opponent Profile Selector (Nit / Regular / Fish) */}
        <div className="bg-neutral-950/80 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              <span>Perfil del Rival</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-bold">
              {currentOpponent.tag}
            </span>
          </div>

          {/* Archetype selector pills */}
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'nit' as const, label: 'Nit', icon: Shield, desc: 'Roca / Pasivo' },
              { id: 'regular' as const, label: 'Regular', icon: Scale, desc: 'TAG / GTO' },
              { id: 'fish' as const, label: 'Fish', icon: Fish, desc: 'Calling Station' },
            ].map((p) => {
              const isSelected = opponentProfile === p.id;
              const IconComp = p.icon;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onOpponentProfileChange?.(p.id)}
                  className={`py-1.5 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                    isSelected
                      ? p.id === 'nit'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : p.id === 'fish'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800'
                  }`}
                  title={`${p.label}: ${p.desc}`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{p.label}</span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-neutral-400 line-clamp-1" title={currentOpponent.desc}>
            {currentOpponent.desc}
          </p>
        </div>
      </div>

      {/* Row 2: Tactical Exploit Strip */}
      <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-amber-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Explotación vs {currentOpponent.name}:</span>
          </span>
          <span className="text-neutral-300">
            {currentOpponent.exploitHint}
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-neutral-400 shrink-0">
          <span>Stack Efectivo: <strong className="text-white">{effectiveStack} fichas ({stackInBB} BB)</strong></span>
          <span>·</span>
          <span>Hero ({heroPos}) vs Rival ({villainPos})</span>
        </div>
      </div>
    </div>
  );
};
