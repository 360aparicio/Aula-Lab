/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive 13x13 Range Matrix Component with Multi-Brush, Presets & Blockers.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card } from '../engine/cards';
import { CANONICAL_GRID, getActiveComboCount } from '../engine/combos';
import {
  calculateRangeMetrics,
  parseRangeString,
  PlayerRange,
  RANGE_PRESETS,
  RangeWeights,
  serializeRange
} from '../engine/range';

interface RangeMatrixProps {
  range: PlayerRange;
  onChange: (updatedRange: PlayerRange) => void;
  boardCards?: Card[];
  title?: string;
  badgeLabel?: string;
}

export const RangeMatrix13x13: React.FC<RangeMatrixProps> = ({
  range,
  onChange,
  boardCards = [],
  title = 'Hand Range',
  badgeLabel = 'OOP'
}) => {
  const [brushWeight, setBrushWeight] = useState<number>(1.0);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [hoveredHand, setHoveredHand] = useState<string | null>(null);
  const [rangeText, setRangeText] = useState(serializeRange(range));
  const [textError, setTextError] = useState<string | null>(null);

  useEffect(() => {
    setRangeText(serializeRange(range));
  }, [range]);

  const metrics = calculateRangeMetrics(range, boardCards);

  const handleCellClickOrDrag = (handName: string) => {
    const updatedWeights: RangeWeights = { ...range.weights };
    if (brushWeight === 0) {
      delete updatedWeights[handName];
    } else {
      updatedWeights[handName] = brushWeight;
    }
    onChange({
      ...range,
      weights: updatedWeights
    });
  };

  const handleTextApply = () => {
    try {
      const parsed = parseRangeString(rangeText, range.name);
      onChange(parsed);
      setTextError(null);
    } catch (e: any) {
      setTextError('Invalid range syntax');
    }
  };

  const handlePresetSelect = (presetKey: string) => {
    const presetStr = RANGE_PRESETS[presetKey];
    if (presetStr) {
      const parsed = parseRangeString(presetStr, presetKey);
      onChange(parsed);
    }
  };

  const handleClear = () => {
    onChange({ ...range, weights: {} });
  };

  const handleSelectAll = () => {
    const allWeights: RangeWeights = {};
    for (const row of CANONICAL_GRID) {
      for (const h of row) {
        allWeights[h.name] = 1.0;
      }
    }
    onChange({ ...range, weights: allWeights });
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
            {title}
          </span>
          <span className="text-xs text-neutral-400">
            ({badgeLabel}) · <span className="text-white font-mono">{metrics.totalCombos}</span> combos ({metrics.percentage}%)
          </span>
        </div>

        {/* Quick presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <select
            onChange={(e) => {
              if (e.target.value) handlePresetSelect(e.target.value);
            }}
            defaultValue=""
            className="text-xs bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-neutral-300 focus:outline-hidden"
          >
            <option value="" disabled>Load Preset...</option>
            {Object.keys(RANGE_PRESETS).map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>

          <button
            onClick={handleSelectAll}
            className="text-xs px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            100%
          </button>
          <button
            onClick={handleClear}
            className="text-xs px-2 py-1 rounded bg-neutral-950 border border-neutral-800 text-neutral-400 hover:text-white transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Brush tools */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs bg-neutral-950/60 p-2 rounded-lg border border-neutral-800/80">
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-500 font-medium">Brush Weight:</span>
          {[1.0, 0.75, 0.5, 0.25, 0.0].map(w => (
            <button
              key={w}
              onClick={() => setBrushWeight(w)}
              className={`px-2 py-0.5 rounded font-mono font-medium transition-colors ${
                brushWeight === w
                  ? 'bg-emerald-600 text-white'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {Math.round(w * 100)}%
            </button>
          ))}
        </div>

        {/* Hover info */}
        {hoveredHand && (
          <div className="text-xs text-neutral-400 font-mono flex items-center gap-2">
            <span className="text-white font-bold">{hoveredHand}</span>
            <span>
              Weight: {Math.round((range.weights[hoveredHand] || 0) * 100)}%
            </span>
            <span>
              Combos: {getActiveComboCount(hoveredHand, boardCards)}
            </span>
          </div>
        )}
      </div>

      {/* 13x13 Grid */}
      <div
        className="select-none grid grid-cols-13 gap-0.5 w-full max-w-[540px] aspect-square mx-auto bg-neutral-950 p-1.5 rounded-lg border border-neutral-800"
        onMouseLeave={() => {
          setIsMouseDown(false);
          setHoveredHand(null);
        }}
        onMouseUp={() => setIsMouseDown(false)}
      >
        {CANONICAL_GRID.map((row, rowIdx) =>
          row.map((cell, colIdx) => {
            const weight = range.weights[cell.name] || 0;
            const remainingCombos = getActiveComboCount(cell.name, boardCards);
            const isBlocked = remainingCombos === 0;

            // Background color based on weight and hand type
            let bgStyle = 'bg-neutral-900 text-neutral-400';
            let borderStyle = 'border-neutral-800/60';

            if (isBlocked) {
              bgStyle = 'bg-neutral-950 text-neutral-700 opacity-40 line-through';
            } else if (weight > 0) {
              if (cell.type === 'pair') {
                // Pairs: Green tint
                bgStyle = weight >= 0.8
                  ? 'bg-emerald-600 text-white font-bold'
                  : weight >= 0.4
                  ? 'bg-emerald-700/80 text-emerald-100'
                  : 'bg-emerald-900/60 text-emerald-200';
              } else if (cell.type === 'suited') {
                // Suited: Blue/Teal tint
                bgStyle = weight >= 0.8
                  ? 'bg-cyan-600 text-white font-bold'
                  : weight >= 0.4
                  ? 'bg-cyan-700/80 text-cyan-100'
                  : 'bg-cyan-900/60 text-cyan-200';
              } else {
                // Offsuit: Amber/Bronze tint
                bgStyle = weight >= 0.8
                  ? 'bg-amber-600 text-white font-bold'
                  : weight >= 0.4
                  ? 'bg-amber-700/80 text-amber-100'
                  : 'bg-amber-900/60 text-amber-200';
              }
            } else {
              if (cell.type === 'pair') {
                borderStyle = 'border-emerald-950/80';
              } else if (cell.type === 'suited') {
                borderStyle = 'border-cyan-950/80';
              }
            }

            return (
              <button
                key={cell.name}
                type="button"
                onMouseDown={() => {
                  setIsMouseDown(true);
                  handleCellClickOrDrag(cell.name);
                }}
                onMouseEnter={() => {
                  setHoveredHand(cell.name);
                  if (isMouseDown) {
                    handleCellClickOrDrag(cell.name);
                  }
                }}
                className={`relative aspect-square flex flex-col items-center justify-center text-[10px] sm:text-xs border ${borderStyle} ${bgStyle} transition-transform active:scale-95 cursor-pointer rounded-xs`}
                title={`${cell.name} - Combos: ${remainingCombos}`}
              >
                <span>{cell.name}</span>
                {weight > 0 && weight < 1 && (
                  <span className="text-[8px] opacity-75 font-mono">
                    {Math.round(weight * 100)}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Legend & Text syntax input */}
      <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800 text-xs">
        <div className="flex items-center justify-between text-neutral-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-emerald-600 rounded-xs"></span>
              Pairs (Diagonal)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-cyan-600 rounded-xs"></span>
              Suited (Top Right)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 bg-amber-600 rounded-xs"></span>
              Offsuit (Bottom Left)
            </span>
          </div>
        </div>

        {/* Text Input */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={rangeText}
            onChange={(e) => setRangeText(e.target.value)}
            placeholder="Standard range notation e.g. AA,KK,AKs-ATs,AKo:0.5"
            className="flex-1 bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-xs text-neutral-200 font-mono focus:outline-hidden focus:border-neutral-600"
          />
          <button
            onClick={handleTextApply}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded font-medium text-xs whitespace-nowrap transition-colors"
          >
            Apply
          </button>
        </div>
        {textError && (
          <p className="text-red-400 text-[11px]">{textError}</p>
        )}
      </div>
    </div>
  );
};
