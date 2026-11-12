/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 13x13 Strategy Heatmap & Hand Breakdown Viewer for Selected Decision Node.
 */

import React, { useState } from 'react';
import { Card } from '../engine/cards';
import { CANONICAL_GRID, getActiveComboCount } from '../engine/combos';
import { NodeStrategyResult } from '../engine/dcfr';
import { ActionNode } from '../engine/gameTree';

interface StrategyMatrixViewProps {
  selectedNode: ActionNode;
  strategyResult?: NodeStrategyResult;
  boardCards: Card[];
}

export const StrategyMatrixView: React.FC<StrategyMatrixViewProps> = ({
  selectedNode,
  strategyResult,
  boardCards
}) => {
  const [hoveredHand, setHoveredHand] = useState<string | null>(null);
  const [filterAction, setFilterAction] = useState<string>('ALL');

  if (!strategyResult) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-8 flex flex-col items-center justify-center text-center">
        <p className="text-sm font-semibold text-neutral-300">Estrategia Pendiente de Cálculo</p>
        <p className="text-xs text-neutral-500 mt-1 max-w-sm">
          Calcula el pensamiento ideal en este escenario para generar frecuencias de equilibrio para {selectedNode.player} en este punto.
        </p>
      </div>
    );
  }

  const actions = strategyResult.actions;
  const canonicalStrat = strategyResult.canonicalStrategy;

  // Action color mapping
  const getActionColor = (act: string): { bg: string; text: string; hex: string } => {
    if (act === 'FOLD') {
      return { bg: 'bg-red-500', text: 'text-red-400', hex: '#ef4444' };
    }
    if (act === 'CHECK' || act === 'CALL') {
      return { bg: 'bg-blue-500', text: 'text-blue-400', hex: '#3b82f6' };
    }
    if (act === 'ALLIN') {
      return { bg: 'bg-rose-500', text: 'text-rose-400', hex: '#f43f5e' };
    }
    if (act.startsWith('BET') || act.startsWith('RAISE')) {
      if (act.includes('75') || act.includes('80') || act.includes('100')) {
        return { bg: 'bg-emerald-400', text: 'text-emerald-300', hex: '#34d399' };
      }
      return { bg: 'bg-emerald-600', text: 'text-emerald-400', hex: '#059669' };
    }
    return { bg: 'bg-neutral-500', text: 'text-neutral-400', hex: '#737373' };
  };

  const hoveredData = hoveredHand ? canonicalStrat[hoveredHand] : null;

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
      {/* Node Info & Overall Distribution */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Strategy at Node: {selectedNode.id}
            </span>
            <span className="text-xs font-mono text-emerald-400">
              · {selectedNode.player} to Act
            </span>
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Pot: {selectedNode.pot} chips · Stacks: OOP {selectedNode.stacks.OOP} / IP {selectedNode.stacks.IP}
          </p>
        </div>

        {/* Overall Action Distribution Bar */}
        <div className="flex items-center gap-3">
          {actions.map(act => {
            const freq = strategyResult.overallStrategy[act] || 0;
            const col = getActionColor(act);
            return (
              <div key={act} className="flex items-center gap-1.5 text-xs font-mono">
                <span className={`w-2.5 h-2.5 rounded-xs ${col.bg}`}></span>
                <span className="text-neutral-300">
                  {strategyResult.actionLabels[act] || act}:
                </span>
                <span className="font-bold text-white">
                  {(freq * 100).toFixed(1)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 13x13 Heatmap */}
      <div className="grid grid-cols-13 gap-0.5 w-full max-w-[540px] aspect-square mx-auto bg-neutral-950 p-1.5 rounded-lg border border-neutral-800 select-none">
        {CANONICAL_GRID.map((row) =>
          row.map((cell) => {
            const strat = canonicalStrat[cell.name];
            const remainingCombos = getActiveComboCount(cell.name, boardCards);
            const inRange = Boolean(strat && remainingCombos > 0);

            if (!inRange) {
              return (
                <div
                  key={cell.name}
                  className="aspect-square bg-neutral-950/40 border border-neutral-900 flex items-center justify-center text-[9px] text-neutral-700"
                >
                  {cell.name}
                </div>
              );
            }

            return (
              <div
                key={cell.name}
                onMouseEnter={() => setHoveredHand(cell.name)}
                className="relative aspect-square border border-neutral-800 flex flex-col items-center justify-center text-[9px] sm:text-[10px] font-mono cursor-pointer overflow-hidden rounded-xs bg-neutral-900 group"
              >
                {/* Horizontal multi-color action fill */}
                <div className="absolute inset-0 flex flex-col">
                  {actions.map(act => {
                    const pct = (strat?.[act] || 0) * 100;
                    if (pct <= 0) return null;
                    const col = getActionColor(act);
                    return (
                      <div
                        key={act}
                        style={{ height: `${pct}%`, backgroundColor: col.hex }}
                        className="w-full opacity-80"
                      />
                    );
                  })}
                </div>

                {/* Hand label overlaid */}
                <span className="relative z-10 font-bold text-white drop-shadow-sm">
                  {cell.name}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Hovered Hand Breakdown */}
      {hoveredHand && hoveredData ? (
        <div className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{hoveredHand}</span>
            <span className="text-neutral-500 font-mono">
              ({getActiveComboCount(hoveredHand, boardCards)} combos active)
            </span>
          </div>

          <div className="flex items-center gap-4 flex-wrap font-mono">
            {actions.map(act => {
              const freq = hoveredData[act] || 0;
              const col = getActionColor(act);
              return (
                <div key={act} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-xs ${col.bg}`}></span>
                  <span className="text-neutral-400">{strategyResult.actionLabels[act] || act}:</span>
                  <span className="font-bold text-white">{(freq * 100).toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-2 text-center text-xs text-neutral-500 font-mono">
          Hover over any hand in the matrix to view specific action frequencies
        </div>
      )}
    </div>
  );
};
