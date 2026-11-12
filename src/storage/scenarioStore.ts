/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local persistence, scenario schema validation, import/export JSON for GTO Studio.
 */

import { PREBUILT_SCENARIOS, PrebuiltScenario } from '../trainer/prebuiltScenarios';

const STORAGE_KEY = 'gto_studio_scenarios_v1';

export interface SavedScenarioRecord extends PrebuiltScenario {
  createdAt: number;
  updatedAt: number;
  isCustom: boolean;
}

export function loadAllScenarios(): SavedScenarioRecord[] {
  const freshPrebuilts: SavedScenarioRecord[] = PREBUILT_SCENARIOS.map(p => ({
    ...p,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    isCustom: false
  }));

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const customOnly = parsed.filter(s => s.isCustom);
        const merged = [...freshPrebuilts, ...customOnly];
        return merged;
      }
    }
  } catch (e) {
    console.error('Failed to parse saved scenarios from localStorage', e);
  }

  saveAllScenarios(freshPrebuilts);
  return freshPrebuilts;
}

export function saveAllScenarios(scenarios: SavedScenarioRecord[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
  } catch (e) {
    console.error('Failed to save scenarios to localStorage', e);
  }
}

export function saveCustomScenario(scenario: PrebuiltScenario): SavedScenarioRecord {
  const all = loadAllScenarios();
  const existingIdx = all.findIndex(s => s.id === scenario.id);

  const now = Date.now();
  const record: SavedScenarioRecord = {
    ...scenario,
    createdAt: existingIdx >= 0 ? all[existingIdx].createdAt : now,
    updatedAt: now,
    isCustom: true
  };

  if (existingIdx >= 0) {
    all[existingIdx] = record;
  } else {
    all.unshift(record);
  }

  saveAllScenarios(all);
  return record;
}

export function deleteScenario(id: string): boolean {
  const all = loadAllScenarios();
  const filtered = all.filter(s => s.id !== id);
  if (filtered.length !== all.length) {
    saveAllScenarios(filtered);
    return true;
  }
  return false;
}

export function exportScenariosToJson(scenarios?: SavedScenarioRecord[]): string {
  const data = scenarios || loadAllScenarios();
  return JSON.stringify({
    format: 'GTO_STUDIO_SCENARIOS',
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    scenarios: data
  }, null, 2);
}

export function importScenariosFromJson(jsonStr: string): { importedCount: number; errors: string[] } {
  const errors: string[] = [];
  try {
    const parsed = JSON.parse(jsonStr);
    const list = Array.isArray(parsed) ? parsed : parsed.scenarios;
    if (!Array.isArray(list)) {
      errors.push('Invalid file structure: expected array or scenarios property');
      return { importedCount: 0, errors };
    }

    const current = loadAllScenarios();
    let importedCount = 0;

    for (const item of list) {
      if (!item.id || !item.title || !item.boardCards || !item.oopRangeStr || !item.ipRangeStr) {
        errors.push(`Skipped invalid scenario item: ${item.title || item.id || 'unnamed'}`);
        continue;
      }

      const existingIdx = current.findIndex(s => s.id === item.id);
      const record: SavedScenarioRecord = {
        id: item.id,
        title: item.title,
        description: item.description || '',
        street: item.street || 'river',
        boardCards: item.boardCards,
        oopRangeStr: item.oopRangeStr,
        ipRangeStr: item.ipRangeStr,
        config: item.config || {
          startingPot: 100,
          effectiveStack: 100,
          betSizes: [0.75],
          raiseSizes: [2.5],
          allowAllIn: true,
          maxRaises: 2,
          street: 'river'
        },
        defaultHero: item.defaultHero || 'OOP',
        createdAt: item.createdAt || Date.now(),
        updatedAt: Date.now(),
        isCustom: true
      };

      if (existingIdx >= 0) {
        current[existingIdx] = record;
      } else {
        current.push(record);
      }
      importedCount++;
    }

    saveAllScenarios(current);
    return { importedCount, errors };
  } catch (err: any) {
    errors.push(`JSON parsing error: ${err.message || String(err)}`);
    return { importedCount: 0, errors };
  }
}
