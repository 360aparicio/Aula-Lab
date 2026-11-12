/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Tree Sizing & Solver Algorithm Configuration Panel.
 */

import React from 'react';
import { TreeConfig } from '../engine/gameTree';
import { DCFRConfig } from '../engine/dcfr';
import { Settings, Sliders } from 'lucide-react';

interface TreeConfigPanelProps {
  treeConfig: TreeConfig;
  onTreeConfigChange: (config: TreeConfig) => void;
  dcfrConfig: DCFRConfig;
  onDCFRConfigChange: (config: DCFRConfig) => void;
}

export const TreeConfigPanel: React.FC<TreeConfigPanelProps> = ({
  treeConfig,
  onTreeConfigChange,
  dcfrConfig,
  onDCFRConfigChange
}) => {
  const handleBetSizeToggle = (size: number) => {
    const exists = treeConfig.betSizes.includes(size);
    let newSizes: number[];
    if (exists) {
      if (treeConfig.betSizes.length === 1) return; // Keep at least one
      newSizes = treeConfig.betSizes.filter(s => s !== size);
    } else {
      newSizes = [...treeConfig.betSizes, size].sort((a, b) => a - b);
    }
    onTreeConfigChange({ ...treeConfig, betSizes: newSizes });
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center gap-2 pb-2 border-b border-neutral-800">
        <Sliders className="w-4 h-4 text-emerald-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Tree Sizing & Engine Settings
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
        {/* Pot & Stack */}
        <div className="space-y-1">
          <label className="text-neutral-400 font-medium">Starting Pot (chips)</label>
          <input
            type="number"
            min={10}
            max={10000}
            value={treeConfig.startingPot}
            onChange={(e) => onTreeConfigChange({
              ...treeConfig,
              startingPot: Math.max(10, parseInt(e.target.value) || 100)
            })}
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5 font-mono text-white focus:outline-hidden"
          />
        </div>

        <div className="space-y-1">
          <label className="text-neutral-400 font-medium">Effective Stack (chips)</label>
          <input
            type="number"
            min={10}
            max={50000}
            value={treeConfig.effectiveStack}
            onChange={(e) => onTreeConfigChange({
              ...treeConfig,
              effectiveStack: Math.max(10, parseInt(e.target.value) || 100)
            })}
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-1.5 font-mono text-white focus:outline-hidden"
          />
        </div>

        {/* Algorithm Selection */}
        <div className="space-y-1">
          <label className="text-neutral-400 font-medium">Solving Algorithm</label>
          <select
            value={dcfrConfig.algorithm}
            onChange={(e) => onDCFRConfigChange({
              ...dcfrConfig,
              algorithm: e.target.value as 'DCFR' | 'CFR_PLUS'
            })}
            className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 font-mono text-white focus:outline-hidden"
          >
            <option value="DCFR">Discounted CFR (α=1.5, β=0, γ=2.0)</option>
            <option value="CFR_PLUS">CFR+ (Regret Matching+)</option>
          </select>
        </div>

        {/* Iterations */}
        <div className="space-y-1">
          <label className="text-neutral-400 font-medium">Iterations ({dcfrConfig.iterations})</label>
          <input
            type="range"
            min={50}
            max={1000}
            step={25}
            value={dcfrConfig.iterations}
            onChange={(e) => onDCFRConfigChange({
              ...dcfrConfig,
              iterations: parseInt(e.target.value)
            })}
            className="w-full accent-emerald-500 cursor-pointer mt-2"
          />
        </div>
      </div>

      {/* Bet sizings checkboxes */}
      <div className="flex items-center gap-3 pt-2 border-t border-neutral-800/80 flex-wrap text-xs">
        <span className="text-neutral-400 font-medium">Bet Sizes (% of Pot):</span>
        {[0.25, 0.33, 0.50, 0.75, 1.0, 1.5].map(size => {
          const isSelected = treeConfig.betSizes.includes(size);
          return (
            <button
              key={size}
              type="button"
              onClick={() => handleBetSizeToggle(size)}
              className={`px-2.5 py-1 rounded font-mono font-medium transition-colors ${
                isSelected
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {Math.round(size * 100)}%
            </button>
          );
        })}

        <label className="flex items-center gap-1.5 ml-auto text-neutral-300 cursor-pointer">
          <input
            type="checkbox"
            checked={treeConfig.allowAllIn}
            onChange={(e) => onTreeConfigChange({
              ...treeConfig,
              allowAllIn: e.target.checked
            })}
            className="accent-emerald-500 rounded"
          />
          <span>Include All-In</span>
        </label>
      </div>
    </div>
  );
};
