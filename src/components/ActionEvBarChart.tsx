/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Action EV (Expected Value) Bar Chart for GTO Studio Trainer:
 * Visualizes the Expected Value (in BB and chips) of each available action
 * at the current decision node alongside GTO equilibrium frequencies.
 * Clearly exposes the magnitude of EV mistakes (EV Loss / ΔEV vs optimal action).
 */

import React, { useState } from 'react';
import { Action, ActionNode } from '../engine/gameTree';
import { NodeStrategyResult } from '../engine/dcfr';
import { ConcreteHandWithWeight } from '../engine/range';
import { BarChart3, TrendingUp, AlertCircle, Sparkles, CheckCircle2, User, Layers, AlertOctagon } from 'lucide-react';

interface ActionEvBarChartProps {
  currentNode: ActionNode;
  strategyResult?: NodeStrategyResult;
  heroHand: ConcreteHandWithWeight | null;
  chosenActionType?: string | null;
  potSize: number;
}

export interface ActionEvItem {
  actionType: string;
  actionKey: string;
  label: string;
  evChips: number;
  evBB: number;
  frequency: number; // 0.0 - 1.0
  isBest: boolean;
  isChosen: boolean;
  evLossBB: number;   // Difference from the highest EV action
  evLossChips: number;
  evLossPercentOfPot: number; // Loss as % of pot
  isMistakeThresholdExceeded: boolean; // Loss > 5% of pot
  quality: 'optimal' | 'acceptable' | 'inaccuracy' | 'mistake' | 'blunder';
}

export const ActionEvBarChart: React.FC<ActionEvBarChartProps> = ({
  currentNode,
  strategyResult,
  heroHand,
  chosenActionType,
  potSize
}) => {
  const [viewMode, setViewMode] = useState<'combo' | 'range'>('combo');

  const comboKey = heroHand?.combo.key;
  const canonicalName = heroHand?.combo.canonicalName;

  // Retrieve strategies and EVs
  const actions = currentNode.actions;

  // Compute EV data for each available action
  const items: ActionEvItem[] = actions.map(act => {
    const actKey = act.actionKey || act.type;
    let freq = 0;
    let evChips = 0;

    if (strategyResult) {
      // 1. Frequency (match by actionKey first, then base type)
      if (viewMode === 'combo' && comboKey && strategyResult.comboStrategy?.[comboKey]) {
        freq = strategyResult.comboStrategy[comboKey][actKey] ?? strategyResult.comboStrategy[comboKey][act.type] ?? 0;
      } else if (viewMode === 'combo' && canonicalName && strategyResult.canonicalStrategy?.[canonicalName]) {
        freq = strategyResult.canonicalStrategy[canonicalName][actKey] ?? strategyResult.canonicalStrategy[canonicalName][act.type] ?? 0;
      } else if (strategyResult.overallStrategy) {
        freq = strategyResult.overallStrategy[actKey] ?? strategyResult.overallStrategy[act.type] ?? 0;
      }

      // 2. Exact EV from DCFR Solver
      if (viewMode === 'combo' && comboKey && strategyResult.comboActionEVs?.[comboKey]) {
        evChips = strategyResult.comboActionEVs[comboKey][actKey] ?? strategyResult.comboActionEVs[comboKey][act.type] ?? 0;
      } else if (viewMode === 'combo' && canonicalName && strategyResult.canonicalActionEVs?.[canonicalName]) {
        evChips = strategyResult.canonicalActionEVs[canonicalName][actKey] ?? strategyResult.canonicalActionEVs[canonicalName][act.type] ?? 0;
      } else if (strategyResult.overallActionEVs) {
        evChips = strategyResult.overallActionEVs[actKey] ?? strategyResult.overallActionEVs[act.type] ?? 0;
      } else {
        // Mathematical estimate if solver EV is 0 or pending
        if (act.type === 'FOLD') {
          evChips = - (currentNode.playerBets[currentNode.player] || 0);
        } else if (freq > 0.05) {
          evChips = Math.round((potSize * 0.45) * 10) / 10;
        } else {
          evChips = Math.round((potSize * 0.15) * 10) / 10;
        }
      }
    } else {
      // Fallback baseline approximation when not yet solved
      if (act.type === 'FOLD') {
        evChips = - (currentNode.playerBets[currentNode.player] || 0);
      } else {
        evChips = Math.round((potSize * 0.35) * 10) / 10;
      }
      freq = 1 / actions.length;
    }

    // 2 chips per Big Blind (assuming 100 chips = 50BB)
    const evBB = Math.round((evChips / 2) * 100) / 100;
    const isChosen = chosenActionType === actKey || chosenActionType === act.type;

    return {
      actionType: act.type,
      actionKey: actKey,
      label: act.label || act.type,
      evChips,
      evBB,
      frequency: freq,
      isBest: false,
      isChosen,
      evLossBB: 0,
      evLossChips: 0,
      evLossPercentOfPot: 0,
      isMistakeThresholdExceeded: false,
      quality: 'optimal'
    };
  });

  // Determine maximum EV action
  let maxEvBB = -Infinity;
  let maxEvChips = -Infinity;
  items.forEach(item => {
    if (item.evBB > maxEvBB) {
      maxEvBB = item.evBB;
      maxEvChips = item.evChips;
    }
  });

  // Calculate EV loss relative to optimal action
  items.forEach(item => {
    const lossBB = Math.max(0, Math.round((maxEvBB - item.evBB) * 100) / 100);
    const lossChips = Math.max(0, Math.round((maxEvChips - item.evChips) * 10) / 10);
    const pctOfPot = potSize > 0 ? Math.round(((lossChips / potSize) * 100) * 10) / 10 : 0;
    const exceedsThreshold = pctOfPot > 5.0 || (lossBB > 0.5 && item.frequency < 0.05 && pctOfPot >= 4.0);

    item.evLossBB = lossBB;
    item.evLossChips = lossChips;
    item.evLossPercentOfPot = pctOfPot;
    item.isMistakeThresholdExceeded = exceedsThreshold;
    item.isBest = item.evBB >= maxEvBB - 0.01;

    // Quality assessment
    if (item.isBest || item.frequency > 0.25 || lossBB <= 0.05) {
      item.quality = 'optimal';
    } else if (item.frequency > 0.08 || lossBB <= 1.0) {
      item.quality = 'acceptable';
    } else if (lossBB <= 3.0 && !exceedsThreshold) {
      item.quality = 'inaccuracy';
    } else if (exceedsThreshold || lossBB > 5.0) {
      item.quality = 'blunder';
    } else {
      item.quality = 'mistake';
    }
  });

  // Scaling for bar chart width
  const minEvBB = Math.min(0, ...items.map(i => i.evBB));
  const absMax = Math.max(Math.abs(maxEvBB), Math.abs(minEvBB), 1.0);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col gap-4">
      {/* Chart Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Gráfico de EV por Acción vs Estrategia Ideal
              </h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 font-mono">
                Valor Esperado (EV)
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Magnitud de errores: Compara el EV (en BB) y las frecuencias de cada acción para {heroHand ? heroHand.combo.canonicalName : 'tu rango'}.
            </p>
          </div>
        </div>

        {/* View Mode Switcher: Combo vs Range */}
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('combo')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-colors ${
              viewMode === 'combo'
                ? 'bg-neutral-800 text-white font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <User className="w-3 h-3 text-emerald-400" />
            <span>Mano ({heroHand ? heroHand.combo.canonicalName : 'Hero'})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('range')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-medium transition-colors ${
              viewMode === 'range'
                ? 'bg-neutral-800 text-white font-bold shadow-xs'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Layers className="w-3 h-3 text-cyan-400" />
            <span>Rango Completo</span>
          </button>
        </div>
      </div>

      {/* Bar Chart Body */}
      <div className="space-y-3.5">
        {items.map(item => {
          // Color coding by quality and action
          const isChosen = item.isChosen;
          const isBest = item.isBest;

          // EV bar width percentage normalized
          // For positive EV: width proportional to evBB / absMax
          // For negative EV: width proportional to abs(evBB) / absMax
          const positivePct = item.evBB > 0 ? Math.min(100, Math.max(5, (item.evBB / absMax) * 100)) : 0;
          const negativePct = item.evBB < 0 ? Math.min(100, Math.max(5, (Math.abs(item.evBB) / absMax) * 100)) : 0;
          const freqPct = Math.round(item.frequency * 100);

          let barColor = 'bg-emerald-500';
          let textColor = 'text-emerald-400';
          let borderHighlight = 'border-neutral-800';

          if (item.quality === 'optimal') {
            barColor = 'bg-emerald-500';
            textColor = 'text-emerald-400';
          } else if (item.quality === 'acceptable') {
            barColor = 'bg-blue-500';
            textColor = 'text-blue-400';
          } else if (item.quality === 'inaccuracy') {
            barColor = 'bg-amber-500';
            textColor = 'text-amber-400';
          } else if (item.quality === 'mistake') {
            barColor = 'bg-rose-500';
            textColor = 'text-rose-400';
          } else {
            barColor = 'bg-red-600';
            textColor = 'text-red-400';
          }

          if (isChosen) {
            borderHighlight = 'border-emerald-400/80 ring-1 ring-emerald-500/50 bg-neutral-950/90';
          }

          return (
            <div
              key={item.actionType}
              className={`p-3 rounded-xl border ${borderHighlight} bg-neutral-950/60 transition-all hover:bg-neutral-950`}
            >
              {/* Top Row: Action Name, Badges, EV values */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-mono text-white tracking-wide">
                    {item.label}
                  </span>

                  {isBest && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      Línea Ideal
                    </span>
                  )}

                  {isChosen && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 animate-pulse">
                      <CheckCircle2 className="w-3 h-3 text-cyan-400" />
                      Tu Decisión
                    </span>
                  )}

                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      item.quality === 'optimal'
                        ? 'bg-emerald-950 text-emerald-400'
                        : item.quality === 'acceptable'
                        ? 'bg-blue-950 text-blue-400'
                        : item.quality === 'inaccuracy'
                        ? 'bg-amber-950 text-amber-400'
                        : 'bg-red-950 text-red-400'
                    }`}
                  >
                    {item.quality.toUpperCase()}
                  </span>

                  {item.isMistakeThresholdExceeded && (
                    <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-500/60 font-mono">
                      <AlertOctagon className="w-3 h-3 text-rose-400" />
                      &gt;5% EV Loss ({item.evLossPercentOfPot}% Pot)
                    </span>
                  )}
                </div>

                {/* Right: EV Values and Loss Delta */}
                <div className="flex items-center gap-3 font-mono text-right text-xs">
                  <div>
                    <span className="text-neutral-400 text-[10px] mr-1">EV:</span>
                    <span className={`font-bold ${textColor}`}>
                      {item.evBB >= 0 ? `+${item.evBB.toFixed(2)}` : item.evBB.toFixed(2)} BB
                    </span>
                    <span className="text-neutral-500 text-[10px] ml-1">
                      ({item.evChips >= 0 ? `+${item.evChips}` : item.evChips} chips)
                    </span>
                  </div>

                  {item.evLossBB > 0 ? (
                    <div className="text-rose-400 font-bold bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/50">
                      -{item.evLossBB.toFixed(2)} BB loss
                    </div>
                  ) : (
                    <div className="text-emerald-400 text-[11px] font-bold bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/50">
                      0.00 BB loss
                    </div>
                  )}
                </div>
              </div>

              {/* Middle Row: Double Bar Display (EV Bar + GTO Frequency Bar) */}
              <div className="space-y-1.5">
                {/* 1. Expected Value Magnitude Bar */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                    <span>Magnitud EV ({item.evBB >= 0 ? 'Ganancia Neta' : 'Pérdida'})</span>
                    <span className="font-bold text-white">{item.evBB.toFixed(2)} BB</span>
                  </div>
                  <div className="h-2.5 w-full bg-neutral-900 rounded-full overflow-hidden flex border border-neutral-800">
                    {item.evBB >= 0 ? (
                      <div
                        style={{ width: `${positivePct}%` }}
                        className={`h-full ${barColor} rounded-full transition-all duration-300 shadow-sm`}
                      />
                    ) : (
                      <div
                        style={{ width: `${negativePct}%` }}
                        className="h-full bg-red-600 rounded-full transition-all duration-300 shadow-sm"
                      />
                    )}
                  </div>
                </div>

                {/* 2. Frequency Bar */}
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[10px] font-mono text-neutral-400">
                    <span>Frecuencia de Pensamiento Ideal</span>
                    <span className="font-bold text-cyan-300">{freqPct}% ({item.frequency.toFixed(3)})</span>
                  </div>
                  <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                    <div
                      style={{ width: `${freqPct}%` }}
                      className="h-full bg-cyan-500 rounded-full transition-all duration-300"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart Footer: Key Takeaway / Insight */}
      <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-start gap-2.5 text-xs text-neutral-300">
        <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-white">Interpretación Teórica del Pensamiento Ideal:</span>
          <p className="text-[11px] text-neutral-400 leading-relaxed">
            En un equilibrio de Nash puro o mixto, las acciones jugadas a frecuencia positiva (&gt; 0%) tienen exactamente el mismo EV óptimo ({maxEvBB.toFixed(2)} BB). Cualquier acción con frecuencia 0% que produzca una diferencia negativa (EV Loss &gt; 0) representa un desvío explotable; la barra roja/ámbar muestra el costo matemático exacto de cometer ese error.
          </p>
        </div>
      </div>
    </div>
  );
};
