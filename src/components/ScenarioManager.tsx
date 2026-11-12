/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Scenario Library, Custom Creator, and JSON Export/Import Manager.
 */

import React, { useState } from 'react';
import { Card, parseCard } from '../engine/cards';
import {
  deleteScenario,
  exportScenariosToJson,
  importScenariosFromJson,
  loadAllScenarios,
  SavedScenarioRecord,
  saveCustomScenario
} from '../storage/scenarioStore';
import { PrebuiltScenario } from '../trainer/prebuiltScenarios';
import { Download, Upload, Plus, Trash2, Play, BookOpen, Layers } from 'lucide-react';

interface ScenarioManagerProps {
  onLoadScenario: (scenario: PrebuiltScenario) => void;
  onTrainScenario: (scenario: PrebuiltScenario) => void;
}

export const ScenarioManager: React.FC<ScenarioManagerProps> = ({
  onLoadScenario,
  onTrainScenario
}) => {
  const [scenarios, setScenarios] = useState<SavedScenarioRecord[]>(loadAllScenarios());
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const handleExport = () => {
    const json = exportScenariosToJson(scenarios);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gto_studio_scenarios_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const res = importScenariosFromJson(content);
      if (res.importedCount > 0) {
        setScenarios(loadAllScenarios());
        setImportStatus(`Successfully imported ${res.importedCount} scenarios!`);
      } else {
        setImportStatus(`Import failed: ${res.errors.join(', ')}`);
      }
    };
    reader.readAsText(file);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this scenario?')) {
      deleteScenario(id);
      setScenarios(loadAllScenarios());
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <h2 className="text-base font-bold text-white">Librería de Escenarios</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Situaciones heads-up preconfiguradas para análisis de pensamiento ideal y práctica estratégica.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImport}
              className="hidden"
            />
          </label>

          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Library</span>
          </button>
        </div>
      </div>

      {importStatus && (
        <div className="p-3 bg-neutral-950 border border-neutral-800 rounded-lg text-xs text-emerald-400">
          {importStatus}
        </div>
      )}

      {/* Grid of Scenarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scenarios.map(sc => (
          <div
            key={sc.id}
            className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between gap-3 hover:border-neutral-700 transition-colors"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-neutral-800 text-emerald-400">
                  {sc.street}
                </span>
                {sc.isCustom && (
                  <button
                    onClick={() => handleDelete(sc.id)}
                    className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                    title="Delete custom scenario"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <h3 className="text-sm font-bold text-white leading-tight">
                {sc.title}
              </h3>
              <p className="text-xs text-neutral-400 line-clamp-2">
                {sc.description}
              </p>

              {/* Board and Pot Specs */}
              <div className="pt-2 flex items-center justify-between text-xs font-mono text-neutral-400 border-t border-neutral-900">
                <div className="flex items-center gap-1">
                  <span>Board:</span>
                  <span className="text-white font-bold">{sc.boardCards.join(' ')}</span>
                </div>
                <div>
                  <span>Pot:</span>{' '}
                  <span className="text-emerald-400 font-bold">{sc.config.startingPot}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-neutral-900">
              <button
                onClick={() => onLoadScenario(sc)}
                className="flex-1 py-1.5 px-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Cargar en Pensamiento Ideal</span>
              </button>

              <button
                onClick={() => onTrainScenario(sc)}
                className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Practice</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
