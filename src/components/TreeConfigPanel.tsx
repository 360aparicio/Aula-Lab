/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tree Sizing, Rake, Multi-Street Simulation & Node-Locking Configuration Panel.
 */

import React from 'react';
import { ActionNode, TreeConfig } from '../engine/gameTree';
import {
  buildArchetypeNodeLocks,
  DCFRConfig,
  NODE_LOCK_PRESETS,
  type NodeLockPresetId
} from '../engine/dcfr';
import { Lock, RotateCcw, Sliders, Sparkles } from 'lucide-react';

interface TreeConfigPanelProps {
  treeConfig: TreeConfig;
  onTreeConfigChange: (config: TreeConfig) => void;
  dcfrConfig: DCFRConfig;
  onDCFRConfigChange: (config: DCFRConfig) => void;
  selectedNode?: ActionNode;
  gameTree?: ActionNode;
}

export const TreeConfigPanel: React.FC<TreeConfigPanelProps> = ({
  treeConfig,
  onTreeConfigChange,
  dcfrConfig,
  onDCFRConfigChange,
  selectedNode,
  gameTree
}) => {
  const handleBetSizeToggle = (size: number) => {
    const exists = treeConfig.betSizes.includes(size);
    let newSizes: number[];
    if (exists) {
      if (treeConfig.betSizes.length === 1) return;
      newSizes = treeConfig.betSizes.filter(s => s !== size);
    } else {
      newSizes = [...treeConfig.betSizes, size].sort((a, b) => a - b);
    }
    onTreeConfigChange({ ...treeConfig, betSizes: newSizes });
  };

  const lockedNodesCount = Object.keys(dcfrConfig.nodeLocks || {}).length;
  const activeNodeLock = selectedNode ? dcfrConfig.nodeLocks?.[selectedNode.id] : undefined;

  // Compute display percentages for mixed node-locking sliders (sum = 100)
  const getNormalizedActionPcts = (node: ActionNode): Record<string, number> => {
    const keys = node.actions.map(a => a.actionKey || a.type);
    if (keys.length === 0) return {};
    if (activeNodeLock) {
      let sum = 0;
      for (const k of keys) sum += Math.max(0, Number(activeNodeLock[k] ?? 0));
      if (sum > 0) {
        const res: Record<string, number> = {};
        let assigned = 0;
        keys.forEach((k, idx) => {
          if (idx === keys.length - 1) {
            res[k] = Math.max(0, 100 - assigned);
          } else {
            const val = Math.round(((Math.max(0, Number(activeNodeLock[k] ?? 0)) / sum) * 100));
            res[k] = val;
            assigned += val;
          }
        });
        return res;
      }
    }
    const equal = Math.floor(100 / keys.length);
    const out: Record<string, number> = {};
    let rem = 100;
    keys.forEach((k, idx) => {
      if (idx === keys.length - 1) out[k] = rem;
      else {
        out[k] = equal;
        rem -= equal;
      }
    });
    return out;
  };

  const handleSliderChange = (changedKey: string, nextPct: number) => {
    if (!selectedNode) return;
    const keys = selectedNode.actions.map(a => a.actionKey || a.type);
    const clampedPct = Math.max(0, Math.min(100, Math.round(nextPct)));
    const currentPcts = getNormalizedActionPcts(selectedNode);
    const otherKeys = keys.filter(k => k !== changedKey);
    const remainingBudget = 100 - clampedPct;

    const newWeights: Record<string, number> = {
      [changedKey]: clampedPct / 100
    };

    if (otherKeys.length > 0) {
      const otherSum = otherKeys.reduce((acc, k) => acc + (currentPcts[k] ?? 0), 0);
      otherKeys.forEach(k => {
        const ratio = otherSum > 0 ? (currentPcts[k] ?? 0) / otherSum : 1 / otherKeys.length;
        newWeights[k] = Math.round(remainingBudget * ratio * 10) / 1000;
      });
    }

    onDCFRConfigChange({
      ...dcfrConfig,
      nodeLocks: {
        ...(dcfrConfig.nodeLocks || {}),
        [selectedNode.id]: newWeights
      }
    });
  };

  const handleLockAction = (actionKey: string) => {
    if (!selectedNode) return;
    const lockMap: Record<string, number> = {};
    for (const a of selectedNode.actions) {
      const k = a.actionKey || a.type;
      lockMap[k] = k === actionKey ? 1 : 0;
    }
    onDCFRConfigChange({
      ...dcfrConfig,
      nodeLocks: {
        ...(dcfrConfig.nodeLocks || {}),
        [selectedNode.id]: lockMap
      }
    });
  };

  const handleClearNodeLock = (nodeId: string) => {
    const next = { ...(dcfrConfig.nodeLocks || {}) };
    delete next[nodeId];
    onDCFRConfigChange({
      ...dcfrConfig,
      nodeLocks: next
    });
  };

  const handleApplyArchetypePreset = (presetId: NodeLockPresetId) => {
    const rootNode = gameTree || selectedNode;
    if (!rootNode) return;
    const locks = buildArchetypeNodeLocks(rootNode, presetId);
    onDCFRConfigChange({
      ...dcfrConfig,
      nodeLocks: locks
    });
  };

  const normalizedPcts = selectedNode ? getNormalizedActionPcts(selectedNode) : {};

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-800 flex-wrap">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Tree Sizing, Rake, Árbol Multi-Calle &amp; Node-Locking Mixto
          </span>
        </div>
        {lockedNodesCount > 0 && (
          <button
            type="button"
            onClick={() => onDCFRConfigChange({ ...dcfrConfig, nodeLocks: {} })}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-semibold cursor-pointer hover:text-white whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Limpiar {lockedNodesCount} Node-Lock(s)</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 text-xs">
        {/* Pot & Stack */}
        <div className="space-y-1">
          <label className="text-neutral-400 font-medium">Bote Inicial (fichas)</label>
          <input
            type="number"
            min={10}
            max={10000}
            value={treeConfig.startingPot}
            onChange={(e) =>
              onTreeConfigChange({
                ...treeConfig,
                startingPot: Math.max(10, parseInt(e.target.value, 10) || 100)
              })
            }
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5 font-mono tabular-nums text-white focus:outline-hidden"
          />
        </div>

        <div className="space-y-1">
          <label className="text-neutral-400 font-medium">Stack Efectivo (fichas)</label>
          <input
            type="number"
            min={10}
            max={50000}
            value={treeConfig.effectiveStack}
            onChange={(e) =>
              onTreeConfigChange({
                ...treeConfig,
                effectiveStack: Math.max(10, parseInt(e.target.value, 10) || 100)
              })
            }
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5 font-mono tabular-nums text-white focus:outline-hidden"
          />
        </div>

        {/* Rake % & Cap */}
        <div className="space-y-1">
          <label className="text-neutral-400 font-medium">Rake Sala (%)</label>
          <input
            type="number"
            min={0}
            max={15}
            step={0.5}
            value={Math.round((dcfrConfig.rakePct ?? 0) * 1000) / 10}
            onChange={(e) =>
              onDCFRConfigChange({
                ...dcfrConfig,
                rakePct: Math.max(0, Math.min(0.15, (parseFloat(e.target.value) || 0) / 100))
              })
            }
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5 font-mono tabular-nums text-white focus:outline-hidden"
          />
        </div>

        <div className="space-y-1">
          <label className="text-neutral-400 font-medium">Cap Rake (fichas)</label>
          <input
            type="number"
            min={0}
            max={200}
            step={1}
            value={dcfrConfig.rakeCapChips ?? 12}
            onChange={(e) =>
              onDCFRConfigChange({
                ...dcfrConfig,
                rakeCapChips: Math.max(0, parseInt(e.target.value, 10) || 0)
              })
            }
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5 font-mono tabular-nums text-white focus:outline-hidden"
          />
        </div>

        {/* Algorithm Selection */}
        <div className="space-y-1">
          <label className="text-neutral-400 font-medium">Algoritmo Solver</label>
          <select
            value={dcfrConfig.algorithm}
            onChange={(e) =>
              onDCFRConfigChange({
                ...dcfrConfig,
                algorithm: e.target.value as 'DCFR' | 'CFR_PLUS'
              })
            }
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 font-mono text-white focus:outline-hidden"
          >
            <option value="DCFR">Discounted CFR (α=1.5, β=0, γ=2.0)</option>
            <option value="CFR_PLUS">CFR+ (Regret Matching+)</option>
          </select>
        </div>

        {/* Iterations */}
        <div className="space-y-1">
          <label className="text-neutral-400 font-medium font-mono tabular-nums">
            Iteraciones ({dcfrConfig.iterations})
          </label>
          <input
            type="range"
            min={50}
            max={1000}
            step={25}
            value={dcfrConfig.iterations}
            onChange={(e) =>
              onDCFRConfigChange({
                ...dcfrConfig,
                iterations: parseInt(e.target.value, 10)
              })
            }
            className="w-full accent-emerald-500 cursor-pointer mt-2"
          />
        </div>
      </div>

      {/* Bet sizings + Multi-street tree + equity runouts & All-in checkboxes */}
      <div className="flex items-center gap-3 pt-2 border-t border-neutral-800/80 flex-wrap text-xs">
        <span className="text-neutral-400 font-medium">Bet Sizes (% Bote):</span>
        {[0.25, 0.33, 0.50, 0.75, 1.0, 1.5].map(size => {
          const isSelected = treeConfig.betSizes.includes(size);
          return (
            <button
              key={size}
              type="button"
              onClick={() => handleBetSizeToggle(size)}
              className={`px-2.5 py-1.5 rounded font-mono font-medium transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {Math.round(size * 100)}%
            </button>
          );
        })}

        <div className="flex items-center gap-4 ml-auto flex-wrap">
          <label className="flex items-center gap-1.5 text-emerald-300 font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(treeConfig.multiStreetMode)}
              onChange={(e) =>
                onTreeConfigChange({
                  ...treeConfig,
                  multiStreetMode: e.target.checked
                })
              }
              className="accent-emerald-500 rounded"
            />
            <span>Árbol Multi-Calle Completo (Flop → Turn → River)</span>
          </label>

          <label className="flex items-center gap-1.5 text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={dcfrConfig.simulateFutureStreets ?? true}
              onChange={(e) =>
                onDCFRConfigChange({
                  ...dcfrConfig,
                  simulateFutureStreets: e.target.checked
                })
              }
              className="accent-blue-500 rounded"
            />
            <span>Runouts Equity Turn/River</span>
          </label>

          <label className="flex items-center gap-1.5 text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={treeConfig.allowAllIn}
              onChange={(e) =>
                onTreeConfigChange({
                  ...treeConfig,
                  allowAllIn: e.target.checked
                })
              }
              className="accent-emerald-500 rounded"
            />
            <span>Incluir All-In</span>
          </label>
        </div>
      </div>

      {/* Archetype Node-Lock Presets */}
      <div className="pt-2 border-t border-neutral-800/80 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Presets Explotativos de Arquetipo (aplican en todo el árbol):</span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {NODE_LOCK_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                title={preset.description}
                onClick={() => handleApplyArchetypePreset(preset.id)}
                className="px-3 py-1.5 rounded-lg bg-neutral-950 hover:bg-amber-950/60 border border-neutral-800 hover:border-amber-500/50 text-amber-200 font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Node-Locking Mixto Control on Selected Node */}
      {selectedNode && selectedNode.actions.length > 0 && (
        <div className="pt-2 border-t border-neutral-800/80 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-neutral-300">
              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                <strong>Node-Locking Mixto</strong> ({selectedNode.player} · calle{' '}
                <span className="uppercase font-mono text-blue-300">{selectedNode.street}</span> · nodo{' '}
                <span className="font-mono text-neutral-400">{selectedNode.id}</span>)
              </span>
            </div>

            {activeNodeLock && (
              <button
                type="button"
                onClick={() => handleClearNodeLock(selectedNode.id)}
                className="px-2.5 py-1 rounded-lg bg-neutral-950 border border-neutral-700 text-neutral-300 hover:text-white text-xs cursor-pointer whitespace-nowrap"
              >
                Soltar Nodo (Volver a Equilibrio Nash)
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {selectedNode.actions.map(act => {
              const actKey = act.actionKey || act.type;
              const pct = normalizedPcts[actKey] ?? 0;
              const isLocked = Boolean(activeNodeLock);
              return (
                <div
                  key={actKey}
                  className={`p-2.5 rounded-lg border space-y-1.5 ${
                    isLocked
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-white truncate">{act.label}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono tabular-nums font-bold text-amber-300">{pct}%</span>
                      <button
                        type="button"
                        onClick={() => handleLockAction(actKey)}
                        className="px-1.5 py-0.5 rounded bg-black border border-neutral-700 hover:border-amber-400 text-[10px] font-mono text-neutral-300 hover:text-white cursor-pointer"
                        title={`Forzar 100% ${act.label}`}
                      >
                        100%
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={pct}
                    aria-label={`Frecuencia mixta ${act.label}`}
                    onChange={(e) => handleSliderChange(actKey, parseInt(e.target.value, 10))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
