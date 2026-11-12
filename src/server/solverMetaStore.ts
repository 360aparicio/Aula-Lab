/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SolverMetaStore: Almacén unificado del conocimiento auto-actualizable de Solvers,
 * tendencias de Internet (vía Google Search Grounding) y aprendizaje colectivo de usuarios.
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

const CACHE_FILE = path.join(os.tmpdir(), 'lab-studio-solver-meta-v31.json');

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

const INITIAL_COLLECTIVE_LEAKS: CollectiveLeakStat[] = [
  {
    texture: 'Monótono (Monotone)',
    street: 'flop',
    sampleCount: 18,
    totalEvLossPct: 147.6,
    avgEvLossPct: 8.2,
    topMistakeAction: 'Bet 75% Pot sin Blocker',
    optimalCounterAction: 'Check Control / Bet 25%',
    lastUpdated: Date.now() - 3600000
  },
  {
    texture: 'Seco (Dry)',
    street: 'flop',
    sampleCount: 24,
    totalEvLossPct: 165.6,
    avgEvLossPct: 6.9,
    topMistakeAction: 'Bet 75% en 3-Bet Pot',
    optimalCounterAction: 'Bet 33% Pot',
    lastUpdated: Date.now() - 3600000
  }
];

let cachedState: SolverMetaState | null = null;

function createDefaultState(): SolverMetaState {
  return {
    version: '3.1.0-adaptive',
    lastInternetSyncAt: null,
    lastCollectiveUpdateAt: Date.now() - 3600000,
    totalUserSamplesLearned: 42,
    internetQuerySummary: 'Base GTO 6-Max cargada. Pulsa "Sincronizar Solvers & Internet" para consultar tendencias actuales en vivo.',
    rules: BASELINE_RULES,
    collectiveLeaks: INITIAL_COLLECTIVE_LEAKS,
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
    // Fallback to in-memory state
  }
  cachedState = createDefaultState();
  return cachedState;
}

export function saveSolverMetaState(nextState: SolverMetaState): SolverMetaState {
  cachedState = nextState;
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(nextState, null, 2), 'utf-8');
  } catch {
    // Ignore disk write issues on ephemeral filesystems
  }
  return cachedState;
}

export function recordCollectiveUserSample(input: {
  texture: string;
  street: string;
  chosenAction: string;
  bestAction: string;
  evLossPct: number;
}): SolverMetaState {
  const current = getSolverMetaState();
  const texture = input.texture || 'Seco (Dry)';
  const street = input.street || 'flop';
  const evLoss = Number.isFinite(input.evLossPct) ? Math.max(0, input.evLossPct) : 0;

  const leaks = [...current.collectiveLeaks];
  const existingIdx = leaks.findIndex(
    l => l.texture.toLowerCase() === texture.toLowerCase() && l.street.toLowerCase() === street.toLowerCase()
  );

  if (existingIdx >= 0) {
    const prev = leaks[existingIdx];
    const nextCount = prev.sampleCount + 1;
    const nextTotal = Number((prev.totalEvLossPct + evLoss).toFixed(2));
    leaks[existingIdx] = {
      ...prev,
      sampleCount: nextCount,
      totalEvLossPct: nextTotal,
      avgEvLossPct: Number((nextTotal / nextCount).toFixed(1)),
      topMistakeAction: evLoss > 5 ? input.chosenAction : prev.topMistakeAction,
      optimalCounterAction: input.bestAction || prev.optimalCounterAction,
      lastUpdated: Date.now()
    };
  } else {
    leaks.unshift({
      texture,
      street,
      sampleCount: 1,
      totalEvLossPct: Number(evLoss.toFixed(2)),
      avgEvLossPct: Number(evLoss.toFixed(1)),
      topMistakeAction: input.chosenAction,
      optimalCounterAction: input.bestAction,
      lastUpdated: Date.now()
    });
  }

  // Synthesize or update collective-user rule when pattern exceeds 3 samples
  const rules = [...current.rules];
  const topLeak = [...leaks].sort((a, b) => b.sampleCount - a.sampleCount)[0];
  if (topLeak && topLeak.sampleCount >= 3) {
    const collectiveRuleId = `meta-collective-${topLeak.texture.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const newRule: SolverMetaRule = {
      id: collectiveRuleId,
      topic: `Corrección Colectiva en ${topLeak.texture} (${topLeak.street.toUpperCase()})`,
      street: (['preflop', 'flop', 'turn', 'river'].includes(topLeak.street) ? topLeak.street : 'flop') as SolverMetaRule['street'],
      texture: topLeak.texture,
      recommendedAction: topLeak.optimalCounterAction,
      sizingPctPot: topLeak.optimalCounterAction.includes('75') ? 75 : topLeak.optimalCounterAction.includes('50') ? 50 : 33,
      gtoFrequencyPct: 78,
      exploitativeAdjustment: `Detectado en ${topLeak.sampleCount} manos de jugadores (EV Loss medio ${topLeak.avgEvLossPct}%): evita "${topLeak.topMistakeAction}" y aplica "${topLeak.optimalCounterAction}".`,
      sourceOrigin: 'collective_users',
      confidence: Math.min(98, 80 + topLeak.sampleCount),
      updatedAt: Date.now(),
      citations: []
    };

    const rIdx = rules.findIndex(r => r.id === collectiveRuleId);
    if (rIdx >= 0) {
      rules[rIdx] = newRule;
    } else {
      rules.unshift(newRule);
    }
  }

  return saveSolverMetaState({
    ...current,
    lastCollectiveUpdateAt: Date.now(),
    totalUserSamplesLearned: current.totalUserSamplesLearned + 1,
    collectiveLeaks: leaks.slice(0, 16),
    rules: rules.slice(0, 20)
  });
}

export function mergeInternetSolverUpdates(params: {
  summary: string;
  newRules: SolverMetaRule[];
  citations: SolverSourceCitation[];
}): SolverMetaState {
  const current = getSolverMetaState();
  const mergedMap = new Map<string, SolverMetaRule>();

  for (const r of params.newRules) {
    mergedMap.set(r.id, r);
  }
  for (const r of current.rules) {
    if (!mergedMap.has(r.id)) {
      mergedMap.set(r.id, r);
    }
  }

  return saveSolverMetaState({
    ...current,
    lastInternetSyncAt: Date.now(),
    internetQuerySummary: params.summary,
    rules: Array.from(mergedMap.values()).slice(0, 20),
    citations: params.citations.slice(0, 10)
  });
}
