/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SolverMetaStore (Admin Repo): Almacén del conocimiento auto-actualizable
 * de estrategias GTO, tendencias Web e inteligencia colectiva.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface SolverSourceCitation {
  title: string;
  url: string;
}

export interface SolverMetaRule {
  id: string;
  topic: string;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  texture: string;
  recommendedAction: string;
  sizingPctPot: number;
  gtoFrequencyPct: number;
  exploitativeAdjustment: string;
  sourceOrigin: 'internet_solver' | 'collective_users' | 'dcfr_equilibrium';
  confidence: number;
  updatedAt: number;
  citations: SolverSourceCitation[];
}

export interface CollectiveLeakStat {
  texture: string;
  street: string;
  sampleCount: number;
  totalEvLossPct: number;
  avgEvLossPct: number;
  topMistakeAction: string;
  optimalCounterAction: string;
  lastUpdated: number;
}

export interface SolverMetaState {
  version: string;
  lastInternetSyncAt: number | null;
  lastCollectiveUpdateAt: number | null;
  totalUserSamplesLearned: number;
  internetQuerySummary: string;
  rules: SolverMetaRule[];
  collectiveLeaks: CollectiveLeakStat[];
  citations: SolverSourceCitation[];
}

const CACHE_FILE = path.join(os.tmpdir(), 'allin-studio-lab-meta-v1.json');

const BASELINE_RULES: SolverMetaRule[] = [
  {
    id: 'meta-dry-cbet',
    topic: 'C-Bet IP en Flops Secos A/K-High (SRP)',
    street: 'flop',
    texture: 'Seco (Dry)',
    recommendedAction: 'Bet 33% Pot (Rango Completo)',
    sizingPctPot: 33,
    gtoFrequencyPct: 82,
    exploitativeAdjustment: 'Ante Nits con Fold-to-CBet >55%, amplía a 95% de rango con tamaño 25% pot.',
    sourceOrigin: 'dcfr_equilibrium',
    confidence: 96,
    updatedAt: Date.now() - 86400000,
    citations: []
  },
  {
    id: 'meta-3bet-spr',
    topic: 'Botes 3-Bet con SPR Bajo (< 4.5)',
    street: 'flop',
    texture: 'Botes 3-Bet / A-High',
    recommendedAction: 'Bet 25% - 33% Pot',
    sizingPctPot: 33,
    gtoFrequencyPct: 76,
    exploitativeAdjustment: 'Evita apostar 75% pot en flop: un sizing de 1/3 permite ir all-in cómodamente en turn/river sin aislar tu mano.',
    sourceOrigin: 'internet_solver',
    confidence: 94,
    updatedAt: Date.now() - 86400000,
    citations: []
  },
  {
    id: 'meta-monotone-check',
    topic: 'Control de Bote en Flops Monótonos',
    street: 'flop',
    texture: 'Monótono (Monotone)',
    recommendedAction: 'Check Behind / C-Bet Polarizado 25%',
    sizingPctPot: 25,
    gtoFrequencyPct: 72,
    exploitativeAdjustment: 'Sin carta bloqueadora alta del palo (As o Rey), reduce tu C-Bet al 30% de frecuencia para evitar check-raises.',
    sourceOrigin: 'collective_users',
    confidence: 91,
    updatedAt: Date.now() - 86400000,
    citations: []
  },
  {
    id: 'meta-river-overbet',
    topic: 'Polarización y Overbet en River Seco',
    street: 'river',
    texture: 'Seco (Dry)',
    recommendedAction: 'Overbet 125% Pot con Nuts + Blockers',
    sizingPctPot: 125,
    gtoFrequencyPct: 48,
    exploitativeAdjustment: 'Contra Calling Stations, reemplaza faroles puros por Value Bet 75-100% únicamente con manos reales.',
    sourceOrigin: 'internet_solver',
    confidence: 90,
    updatedAt: Date.now() - 86400000,
    citations: []
  }
];

let cachedState: SolverMetaState | null = null;

function createDefaultState(): SolverMetaState {
  return {
    version: '4.3.0-allin-admin',
    lastInternetSyncAt: null,
    lastCollectiveUpdateAt: Date.now() - 3600000,
    totalUserSamplesLearned: 42,
    internetQuerySummary: 'Base Equilibrio Nash 6-Max cargada en Allin Studio Admin. Pulsa "Actualizar Meta Web" para consultar tendencias actuales en vivo.',
    rules: BASELINE_RULES,
    collectiveLeaks: [],
    citations: []
  };
}

export function getSolverMetaState(): SolverMetaState {
  if (cachedState) return cachedState;
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const raw = fs.readFileSync(CACHE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as SolverMetaState;
      if (parsed && Array.isArray(parsed.rules)) {
        cachedState = parsed;
        return cachedState;
      }
    }
  } catch {
    // Fallback
  }
  cachedState = createDefaultState();
  return cachedState;
}

export function saveSolverMetaState(nextState: SolverMetaState): SolverMetaState {
  cachedState = nextState;
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(nextState, null, 2), 'utf-8');
  } catch {
    // Ignore ephemeral FS issues
  }
  return cachedState;
}

export function mergeInternetSolverUpdates(params: {
  summary: string;
  newRules: SolverMetaRule[];
  citations: SolverSourceCitation[];
}): SolverMetaState {
  const current = getSolverMetaState();
  const mergedMap = new Map<string, SolverMetaRule>();

  for (const r of params.newRules) mergedMap.set(r.id, r);
  for (const r of current.rules) {
    if (!mergedMap.has(r.id)) mergedMap.set(r.id, r);
  }

  return saveSolverMetaState({
    ...current,
    lastInternetSyncAt: Date.now(),
    internetQuerySummary: params.summary,
    rules: Array.from(mergedMap.values()).slice(0, 20),
    citations: params.citations.slice(0, 10)
  });
}
