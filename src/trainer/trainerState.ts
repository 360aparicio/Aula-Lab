/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive GTO Training Session Engine with Multi-Street Play,
 * Elo progression, EV loss metrics, and persistent attempt logging.
 */

import { Card } from '../engine/cards';
import { Action, ActionNode, GameNode, PlayerRole } from '../engine/gameTree';
import { ConcreteHandWithWeight } from '../engine/range';
import { NodeStrategyResult, SolveResult } from '../engine/dcfr';
import { compareHands, evaluateCards } from '../engine/evaluator';

export type ActionGrade = 'optimal' | 'acceptable' | 'inaccuracy' | 'mistake' | 'blunder';

export interface TrainingFeedback {
  chosenAction: string;
  bestAction: string;
  grade: ActionGrade;
  gradeLabel: string;
  gradeColor: string;
  chosenFrequency: number;
  bestFrequency: number;
  evLossBB: number;     // EV lost in big blinds (assuming 100 chips = 50BB or similar)
  evLossChips: number;  // EV lost in raw chips
  evLossPercentOfPot: number; // EV loss as % of pot (e.g. 7.5%)
  isMistakeThresholdExceeded: boolean; // Flagged when EV loss > 5.0%
  eloChange: number;
  explanation: string;
  gtoDistribution: Record<string, number>;
}

export interface TrainingAttempt {
  id: string;
  timestamp: number;
  scenarioTitle: string;
  nodeHistory: string[];
  heroCombo: string;
  board: string[];
  chosenAction: string;
  bestAction: string;
  grade: ActionGrade;
  chosenFrequency: number;
  bestFrequency: number;
  evLossBB: number;
  evLossChips?: number;
  evLossPercentOfPot?: number;
  isMistakeThresholdExceeded?: boolean;
  eloChange: number;
  newElo: number;
}

export interface TrainerUserStats {
  elo: number;
  handsPlayed: number;
  optimalMoves: number;
  acceptableMoves: number;
  inaccuracies: number;
  mistakes: number;
  blunders: number;
  streak: number;
  bestStreak: number;
  totalEvLossBB: number;
}

export interface EloTier {
  name: string;
  color: string;
  minElo: number;
  maxElo: number;
}

export const ELO_TIERS: EloTier[] = [
  { name: 'Gran Maestro de Pensamiento', color: 'text-purple-400', minElo: 1700, maxElo: 3000 },
  { name: 'High Stakes Crusher', color: 'text-emerald-400', minElo: 1500, maxElo: 1699 },
  { name: 'Pro Regular', color: 'text-cyan-400', minElo: 1300, maxElo: 1499 },
  { name: 'Analytical Grinder', color: 'text-amber-400', minElo: 1100, maxElo: 1299 },
  { name: 'Novice Explorer', color: 'text-neutral-400', minElo: 0, maxElo: 1099 }
];

export function getEloTier(elo: number): EloTier {
  return ELO_TIERS.find(t => elo >= t.minElo) || ELO_TIERS[ELO_TIERS.length - 1];
}

const STATS_STORAGE_KEY = 'gto_studio_trainer_stats_v2';
const ATTEMPTS_STORAGE_KEY = 'gto_studio_trainer_attempts_v2';

export function loadTrainerStats(): TrainerUserStats {
  try {
    const raw = localStorage.getItem(STATS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // fallback
  }
  return {
    elo: 1200,
    handsPlayed: 0,
    optimalMoves: 0,
    acceptableMoves: 0,
    inaccuracies: 0,
    mistakes: 0,
    blunders: 0,
    streak: 0,
    bestStreak: 0,
    totalEvLossBB: 0
  };
}

export function saveTrainerStats(stats: TrainerUserStats) {
  try {
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    // fallback
  }
}

export function loadTrainingAttempts(): TrainingAttempt[] {
  try {
    const raw = localStorage.getItem(ATTEMPTS_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    // fallback
  }
  return [];
}

export function saveTrainingAttempt(attempt: TrainingAttempt) {
  try {
    const list = loadTrainingAttempts();
    list.unshift(attempt);
    if (list.length > 200) list.pop();
    localStorage.setItem(ATTEMPTS_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    // fallback
  }
}

export function clearTrainingAttempts() {
  try {
    localStorage.removeItem(ATTEMPTS_STORAGE_KEY);
  } catch (e) {
    // fallback
  }
}

/**
 * Deal a random hero hand from active unblocked combos
 */
export function dealRandomHeroHand(
  combos: ConcreteHandWithWeight[]
): ConcreteHandWithWeight | null {
  if (combos.length === 0) return null;

  let totalWeight = 0;
  for (const c of combos) totalWeight += c.weight;
  if (totalWeight <= 0) return combos[0];

  let r = Math.random() * totalWeight;
  for (const c of combos) {
    if (r < c.weight) return c;
    r -= c.weight;
  }
  return combos[combos.length - 1];
}

/**
 * Deal a random villain hand from villain's active combos
 * that does not clash with board or hero's hole cards
 */
export function dealRandomVillainHand(
  combos: ConcreteHandWithWeight[],
  heroHand: ConcreteHandWithWeight
): ConcreteHandWithWeight | null {
  const heroCard1 = heroHand.combo.card1.id;
  const heroCard2 = heroHand.combo.card2.id;

  const validCombos = combos.filter(c =>
    c.combo.card1.id !== heroCard1 &&
    c.combo.card1.id !== heroCard2 &&
    c.combo.card2.id !== heroCard1 &&
    c.combo.card2.id !== heroCard2
  );

  return dealRandomHeroHand(validCombos);
}

/**
 * Grade user action based on GTO strategy frequencies and calculate EV loss
 */
export function evaluateUserAction(
  chosenActionType: string,
  heroCombo: ConcreteHandWithWeight,
  strategyResult: NodeStrategyResult,
  potSize = 100
): TrainingFeedback {
  const comboKey = heroCombo.combo.key;
  const canonicalName = heroCombo.combo.canonicalName;

  // Retrieve exact distribution: combo > canonical > overall
  const dist = strategyResult.comboStrategy[comboKey] ||
               strategyResult.canonicalStrategy[canonicalName] ||
               strategyResult.overallStrategy;

  const chosenFreq = dist[chosenActionType] ?? dist[chosenActionType.split('_')[0]] ?? 0;

  // Best action is the one with highest frequency
  let bestAction = chosenActionType;
  let bestFreq = 0;
  for (const [act, freq] of Object.entries(dist)) {
    if (freq > bestFreq) {
      bestFreq = freq;
      bestAction = act;
    }
  }

  // Exact EV from DCFR Solver if available
  const comboEvs = strategyResult.comboActionEVs?.[comboKey] ||
                   strategyResult.canonicalActionEVs?.[canonicalName] ||
                   strategyResult.overallActionEVs;

  let evLossChips = 0;
  if (comboEvs && comboEvs[bestAction] !== undefined) {
    const bestEV = comboEvs[bestAction];
    const chosenEV = comboEvs[chosenActionType] ?? comboEvs[chosenActionType.split('_')[0]] ?? (bestEV - (potSize * 0.25));
    evLossChips = Math.max(0, Math.round((bestEV - chosenEV) * 10) / 10);
  } else {
    // Mathematical estimate using pot size and frequency deficit:
    if (chosenFreq < 0.05 && bestFreq > 0.6) {
      // Pure blunder
      evLossChips = Math.round((bestFreq - chosenFreq) * potSize * 0.35 * 10) / 10;
    } else if (chosenFreq < 0.15) {
      evLossChips = Math.round((bestFreq - chosenFreq) * potSize * 0.15 * 10) / 10;
    } else {
      // Valid mixed strategy: 0 EV loss!
      evLossChips = 0;
    }
  }

  // Standard 100 chips = 50BB (2 chips per BB)
  const evLossBB = Math.round((evLossChips / 2) * 100) / 100;

  // EV Loss as percentage of pot (e.g. 7.2% of pot)
  const evLossPercentOfPot = potSize > 0 ? Math.round(((evLossChips / potSize) * 100) * 10) / 10 : 0;

  // Mistake Threshold: Significant deviation (> 5.0% EV loss)
  const isMistakeThresholdExceeded = evLossPercentOfPot > 5.0 || (bestFreq > 0.65 && chosenFreq < 0.05 && evLossChips > 0);

  let grade: ActionGrade = 'optimal';
  let gradeLabel = 'Línea Ideal';
  let gradeColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-800';
  let eloChange = 15;
  let explanation = '';

  if (chosenFreq >= 0.25 || chosenActionType === bestAction) {
    grade = 'optimal';
    gradeLabel = 'Acción Ideal';
    gradeColor = 'text-emerald-400 bg-emerald-950/40 border-emerald-800';
    eloChange = +15;
    explanation = `Línea estándar para ${canonicalName} (${(chosenFreq * 100).toFixed(1)}% de frecuencia). Ejecución perfecta.`;
  } else if (chosenFreq >= 0.10) {
    grade = 'acceptable';
    gradeLabel = 'Frecuencia Mixta Aceptable';
    gradeColor = 'text-blue-400 bg-blue-950/40 border-blue-800';
    eloChange = +5;
    explanation = `Elección mixta viable (${(chosenFreq * 100).toFixed(1)}%), aunque ${bestAction} es preferida (${(bestFreq * 100).toFixed(1)}%). Cero pérdida de EV en equilibrio.`;
  } else if (chosenFreq >= 0.02) {
    grade = 'inaccuracy';
    gradeLabel = 'Imprecisión';
    gradeColor = 'text-amber-400 bg-amber-950/40 border-amber-800';
    eloChange = -10;
    explanation = `Línea de baja frecuencia para ${canonicalName} (${(chosenFreq * 100).toFixed(1)}%). La línea preferida es ${bestAction} (${(bestFreq * 100).toFixed(1)}%).`;
  } else if (bestFreq > 0.80 || isMistakeThresholdExceeded) {
    grade = isMistakeThresholdExceeded ? 'blunder' : 'mistake';
    gradeLabel = isMistakeThresholdExceeded ? 'Desviación Crítica (>5% EV)' : 'Error Grave (Blunder)';
    gradeColor = 'text-red-400 bg-red-950/40 border-red-800';
    eloChange = -25;
    explanation = `El pensamiento ideal evita esta acción (${(chosenFreq * 100).toFixed(1)}% frecuencia). Se requiere ${bestAction} puro (${(bestFreq * 100).toFixed(1)}%). Pérdida de ${evLossBB} BB (${evLossPercentOfPot}% del bote, >5% umbral).`;
  } else {
    grade = 'mistake';
    gradeLabel = 'Error';
    gradeColor = 'text-rose-400 bg-rose-950/40 border-rose-800';
    eloChange = -18;
    explanation = `Decisión fuera del árbol ideal para este combo. Se prefiere ${bestAction} (${(bestFreq * 100).toFixed(1)}%).`;
  }

  return {
    chosenAction: chosenActionType,
    bestAction,
    grade,
    gradeLabel,
    gradeColor,
    chosenFrequency: chosenFreq,
    bestFrequency: bestFreq,
    evLossBB,
    evLossChips,
    evLossPercentOfPot,
    isMistakeThresholdExceeded,
    eloChange,
    explanation,
    gtoDistribution: dist
  };
}

/**
 * Sample an action for GTO Villain according to its strategy distribution
 */
export function sampleVillainAction(
  strategyResult: NodeStrategyResult,
  villainCombo: ConcreteHandWithWeight
): { actionKey: string; frequency: number } {
  const comboKey = villainCombo.combo.key;
  const canonicalName = villainCombo.combo.canonicalName;

  const dist = strategyResult.comboStrategy[comboKey] ||
               strategyResult.canonicalStrategy[canonicalName] ||
               strategyResult.overallStrategy;

  const entries = Object.entries(dist);
  if (entries.length === 0) return { actionKey: 'CHECK', frequency: 1.0 };

  const r = Math.random();
  let cum = 0;
  for (const [actionKey, freq] of entries) {
    cum += freq;
    if (r <= cum) {
      return { actionKey, frequency: freq };
    }
  }

  return { actionKey: entries[0][0], frequency: entries[0][1] };
}
