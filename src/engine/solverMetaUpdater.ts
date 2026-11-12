/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SolverMetaUpdater: Cliente adaptativo que conecta el conocimiento de:
 * 1) Solvers modernos e Internet (vía Google Search Grounding en backend /api/solver/sync-internet)
 * 2) Aprendizaje Colectivo de Usuarios (/api/solver/learn-from-users)
 * 3) Motor local DCFR + LearnerService (>5% EV leaks)
 * para adaptar recomendaciones de calle y sizings en tiempo real.
 */

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

export const SOLVER_META_UPDATE_EVENT = 'solver-meta-updated';
const LOCAL_META_CACHE_KEY = 'lab_studio_solver_meta_v31';

const FALLBACK_META: SolverMetaState = {
  version: '3.1.0-adaptive',
  lastInternetSyncAt: null,
  lastCollectiveUpdateAt: null,
  totalUserSamplesLearned: 42,
  internetQuerySummary: 'Heurísticas GTO 6-Max activas. Sincroniza con internet para actualizar tendencias de solvers.',
  rules: [
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
      updatedAt: Date.now(),
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
      exploitativeAdjustment: 'Evita apostar 75% pot en flop: un sizing de 1/3 permite ir all-in cómodamente en turn/river.',
      sourceOrigin: 'internet_solver',
      confidence: 94,
      updatedAt: Date.now(),
      citations: []
    }
  ],
  collectiveLeaks: [],
  citations: []
};

export class SolverMetaUpdater {
  private static instance: SolverMetaUpdater;
  private state: SolverMetaState;

  private constructor() {
    this.state = this.loadLocalCache();
  }

  public static getInstance(): SolverMetaUpdater {
    if (!SolverMetaUpdater.instance) {
      SolverMetaUpdater.instance = new SolverMetaUpdater();
    }
    return SolverMetaUpdater.instance;
  }

  private loadLocalCache(): SolverMetaState {
    try {
      const raw = localStorage.getItem(LOCAL_META_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SolverMetaState;
        if (parsed && Array.isArray(parsed.rules)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return FALLBACK_META;
  }

  private setState(next: SolverMetaState): SolverMetaState {
    this.state = next;
    try {
      localStorage.setItem(LOCAL_META_CACHE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(SOLVER_META_UPDATE_EVENT));
    }
    return this.state;
  }

  public getState(): SolverMetaState {
    return this.state;
  }

  public async fetchFromServer(): Promise<SolverMetaState> {
    try {
      const res = await fetch('/api/solver/meta');
      if (!res.ok) return this.state;
      const data = (await res.json()) as SolverMetaState;
      if (data && Array.isArray(data.rules)) {
        return this.setState(data);
      }
    } catch {
      // Offline / static fallback
    }
    return this.state;
  }

  public async syncWithInternet(topic?: string): Promise<{ ok: boolean; state: SolverMetaState; error?: string }> {
    try {
      const res = await fetch('/api/solver/sync-internet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic })
      });
      const payload = await res.json();
      if (!res.ok) {
        return {
          ok: false,
          state: this.state,
          error: payload?.error || 'No se pudo completar la sincronización con internet.'
        };
      }
      return {
        ok: true,
        state: this.setState(payload as SolverMetaState)
      };
    } catch (err) {
      return {
        ok: false,
        state: this.state,
        error: err instanceof Error ? err.message : 'Error de red al consultar solvers en internet.'
      };
    }
  }

  public async reportUserDecision(params: {
    texture: string;
    street: string;
    chosenAction: string;
    bestAction: string;
    evLossPct: number;
  }): Promise<SolverMetaState> {
    try {
      const res = await fetch('/api/solver/learn-from-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (res.ok) {
        const data = (await res.json()) as SolverMetaState;
        if (data && Array.isArray(data.rules)) {
          return this.setState(data);
        }
      }
    } catch {
      // Non-fatal background learning
    }
    return this.state;
  }

  /**
   * Encuentra la regla adaptativa más relevante para la calle y textura actual
   */
  public getAdaptiveRuleForSpot(street: string, textureHint?: string): SolverMetaRule | null {
    const streetMatches = this.state.rules.filter(r => r.street === street);
    if (streetMatches.length === 0) return this.state.rules[0] || null;
    if (textureHint) {
      const texMatch = streetMatches.find(r =>
        r.texture.toLowerCase().includes(textureHint.toLowerCase()) ||
        textureHint.toLowerCase().includes(r.texture.toLowerCase().split(' ')[0])
      );
      if (texMatch) return texMatch;
    }
    return streetMatches[0];
  }
}
