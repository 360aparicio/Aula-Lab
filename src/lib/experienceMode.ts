/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ExperienceMode & DailyMissions: Perfil adaptativo por jugador (Principiante,
 * Recreativo/Casual, Regular y Pro) y racha de misiones gamificadas por UID.
 */

import { readScopedItem, writeScopedItem } from './userStorage';

export type ExperienceLevel = 'beginner' | 'recreational' | 'regular' | 'pro';

export interface ExperienceMeta {
  id: ExperienceLevel;
  label: string;
  shortLabel: string;
  description: string;
  showPlainLanguageHints: boolean;
  showGlossaryTooltips: boolean;
  prioritizeFundamentals: boolean;
  simplifyHeader: boolean;
}

export const EXPERIENCE_LEVEL_META: Record<ExperienceLevel, ExperienceMeta> = {
  beginner: {
    id: 'beginner',
    label: 'Nuevo en el Póker',
    shortLabel: 'Principiante',
    description: 'Muestra el Módulo 0 (reglas, ranking, posiciones, pot odds), glosario en línea y explicaciones sin tecnicismos.',
    showPlainLanguageHints: true,
    showGlossaryTooltips: true,
    prioritizeFundamentals: true,
    simplifyHeader: true
  },
  recreational: {
    id: 'recreational',
    label: 'Jugador Recreativo',
    shortLabel: 'Recreativo',
    description: 'Enfoque práctico con misiones cortas, rachas visuales y consejos claros para evitar calls perdedores.',
    showPlainLanguageHints: true,
    showGlossaryTooltips: true,
    prioritizeFundamentals: false,
    simplifyHeader: true
  },
  regular: {
    id: 'regular',
    label: 'Jugador Regular (NL10–NL50)',
    shortLabel: 'Regular',
    description: 'Prioriza TheTracker2, Diagnóstico de Nivel, Mesa 6-Max Preflop→River y fugas por posición.',
    showPlainLanguageHints: false,
    showGlossaryTooltips: true,
    prioritizeFundamentals: false,
    simplifyHeader: false
  },
  pro: {
    id: 'pro',
    label: 'Jugador Pro / Lab Studio',
    shortLabel: 'Pro Nash',
    description: 'Acceso directo a Lab Studio multi-calle, Node-Locking, Rake %, rangos editables y métricas avanzadas.',
    showPlainLanguageHints: false,
    showGlossaryTooltips: false,
    prioritizeFundamentals: false,
    simplifyHeader: false
  }
};

const EXP_MODE_KEY = 'lab_player_experience_mode_v1';
const MISSIONS_KEY = 'lab_player_daily_missions_v1';

export function loadExperienceMode(): ExperienceLevel {
  try {
    const raw = readScopedItem(EXP_MODE_KEY);
    if (raw === 'beginner' || raw === 'recreational' || raw === 'regular' || raw === 'pro') {
      return raw;
    }
  } catch {
    // ignore
  }
  return 'regular';
}

export function saveExperienceMode(level: ExperienceLevel): void {
  try {
    writeScopedItem(EXP_MODE_KEY, level);
  } catch {
    // ignore
  }
}

export interface DailyMissionItem {
  id: string;
  title: string;
  detail: string;
  progress: number;
  target: number;
  completed: boolean;
}

export interface DailyMissionsState {
  streakDays: number;
  lastActiveDate: string;
  missions: DailyMissionItem[];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function createFreshMissions(streakDays = 1): DailyMissionsState {
  return {
    streakDays,
    lastActiveDate: todayKey(),
    missions: [
      {
        id: 'm-hands',
        title: 'Mesa 6-Max en Vivo',
        detail: 'Juega 5 decisiones en la mesa 6-Max sin pagar con aire fuera de posición.',
        progress: 0,
        target: 5,
        completed: false
      },
      {
        id: 'm-fund',
        title: 'Fundamentos & Pot Odds',
        detail: 'Resuelve 3 ejercicios en el Módulo 0 (Ranking de Manos o Pot Odds).',
        progress: 0,
        target: 3,
        completed: false
      },
      {
        id: 'm-sm2',
        title: 'Repaso Inteligente',
        detail: 'Guarda o repasa 1 mano clave en tu mazo de memoria SM-2.',
        progress: 0,
        target: 1,
        completed: false
      }
    ]
  };
}

export function loadDailyMissions(): DailyMissionsState {
  try {
    const raw = readScopedItem(MISSIONS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyMissionsState;
      if (parsed && Array.isArray(parsed.missions)) {
        const today = todayKey();
        if (parsed.lastActiveDate !== today) {
          const next = createFreshMissions((parsed.streakDays || 0) + 1);
          writeScopedItem(MISSIONS_KEY, JSON.stringify(next));
          return next;
        }
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  const fresh = createFreshMissions(1);
  writeScopedItem(MISSIONS_KEY, JSON.stringify(fresh));
  return fresh;
}

export function incrementMissionProgress(
  missionId: 'm-hands' | 'm-fund' | 'm-sm2',
  delta = 1
): DailyMissionsState {
  const current = loadDailyMissions();
  const next: DailyMissionsState = {
    ...current,
    lastActiveDate: todayKey(),
    missions: current.missions.map(m => {
      if (m.id !== missionId) return m;
      const progress = Math.min(m.target, m.progress + delta);
      return {
        ...m,
        progress,
        completed: progress >= m.target
      };
    })
  };
  writeScopedItem(MISSIONS_KEY, JSON.stringify(next));
  return next;
}

import { LearnerService } from '../engine/learner';
import { loadLiveChallengeState, type SimPosition, type SimScenarioType } from '../engine/handSimulator';
import { computeHudStats, getActiveTracker2DatabaseId, loadTracker2Databases } from '../engine/theTracker2Engine';

const ONBOARDING_KEY = 'lab_player_onboarding_60s_v1';

export type OnboardingGoal = 'learn_zero' | 'analyze_hands' | 'crush_stakes';

export interface OnboardingState {
  completed: boolean;
  dismissed: boolean;
  goal?: OnboardingGoal;
  completedAt?: number;
}

export function loadOnboardingState(): OnboardingState {
  try {
    const raw = readScopedItem(ONBOARDING_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OnboardingState;
      if (parsed && typeof parsed.completed === 'boolean') {
        return {
          completed: parsed.completed,
          dismissed: Boolean(parsed.dismissed),
          goal: parsed.goal,
          completedAt: parsed.completedAt
        };
      }
    }
  } catch {
    // ignore
  }
  return { completed: false, dismissed: false };
}

export function saveOnboardingState(state: OnboardingState): void {
  try {
    writeScopedItem(ONBOARDING_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function resetOnboardingState(): void {
  saveOnboardingState({ completed: false, dismissed: false });
}

export interface WeeklyLeakRadarItem {
  id: string;
  title: string;
  costBB: number;
  costLabel: string;
  plainReason: string;
  fixAction: string;
  drillPos: SimPosition | 'RANDOM';
  drillScenario: SimScenarioType | 'RANDOM';
}

export function buildWeeklyLeaksRadar(): WeeklyLeakRadarItem[] {
  const candidates: WeeklyLeakRadarItem[] = [];
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // 1. Live 6-Max Challenge records from last 7 days (or all recent if older)
  try {
    const live = loadLiveChallengeState();
    const recentLive = live.records.filter(r => r.timestamp >= oneWeekAgo);
    const pool = recentLive.length > 0 ? recentLive : live.records;

    const byScenario: Record<string, { loss: number; count: number; pos: SimPosition; scenario: SimScenarioType }> = {};
    for (const r of pool) {
      if (r.evLossBB <= 0.4) continue;
      const key = `${r.scenario}_${r.heroPos}`;
      if (!byScenario[key]) {
        byScenario[key] = { loss: 0, count: 0, pos: r.heroPos, scenario: r.scenario };
      }
      byScenario[key].loss += r.evLossBB;
      byScenario[key].count += 1;
    }

    for (const [key, item] of Object.entries(byScenario)) {
      if (item.loss < 0.8) continue;
      const roundedLoss = Math.round(item.loss * 10) / 10;
      const isOop = item.pos === 'BB' || item.pos === 'SB' || item.pos === 'EP' || item.scenario.includes('OOP');
      const isMultiway = item.scenario === 'MULTIWAY';
      candidates.push({
        id: `live-${key}`,
        title: isMultiway
          ? `Sobre-apuestas o pagas de más con ${item.count} manos contra 2+ rivales`
          : isOop
          ? `Pierdes fichas pagando sin posición desde ${item.pos === 'EP' ? 'UTG' : item.pos}`
          : `Decisiones costosas desde ${item.pos} en botes ${item.scenario.replace('_', ' ')}`,
        costBB: roundedLoss,
        costLabel: `-${roundedLoss} BB en ${item.count} ${item.count === 1 ? 'mano' : 'manos'}`,
        plainReason: isMultiway
          ? 'Cuando hay 3 o más jugadores en el bote, un par simple pierde fuerza rápido y pagar apuestas grandes sale caro.'
          : isOop
          ? 'Actuar primero después del flop te pone en desventaja de información; necesitas manos más sólidas para continuar.'
          : 'Estás eligiendo líneas poco rentables (apostar muy grande con aire o pagar cuando el bote no da precio).',
        fixAction: isMultiway
          ? 'Juega directo por valor (trío/dobles/draws fuertes) y evita faroles contra varios rivales.'
          : isOop
          ? 'Descarta cartas dominadas fuera de posición y usa check-fold sin miedo cuando falles el flop.'
          : 'Revisa los botones de Pot Odds y practica 5 manos guiadas de este asiento.',
        drillPos: item.pos,
        drillScenario: item.scenario
      });
    }
  } catch {
    // ignore
  }

  // 2. LearnerService Trainer mistakes
  try {
    const allMistakes = LearnerService.getInstance().getMistakes();
    const recentMistakes = allMistakes.filter(m => m.timestamp >= oneWeekAgo);
    const pool = recentMistakes.length > 0 ? recentMistakes : allMistakes;

    const byCategory: Record<string, { loss: number; count: number; fix: string; pos: string }> = {};
    for (const m of pool) {
      const cat = m.leakCategory || 'Desviación Postflop';
      if (!byCategory[cat]) {
        byCategory[cat] = { loss: 0, count: 0, fix: m.prescriptiveFix, pos: m.heroPos };
      }
      byCategory[cat].loss += Math.max(0.5, m.evLossBB || 1);
      byCategory[cat].count += 1;
    }

    for (const [cat, info] of Object.entries(byCategory)) {
      const roundedLoss = Math.round(info.loss * 10) / 10;
      const safePos: SimPosition =
        info.pos === 'EP' || info.pos === 'MP' || info.pos === 'CO' || info.pos === 'BTN' || info.pos === 'SB' || info.pos === 'BB'
          ? info.pos
          : 'BTN';
      candidates.push({
        id: `learner-${cat}`,
        title: cat
          .replace('Desbalance en Flops Secos', 'Apuestas demasiado grande en mesas secas donde basta poco')
          .replace('Sobre-inversión en Mesas Monótonas', 'Pagas o apuestas fuerte cuando hay 3 cartas del mismo palo')
          .replace('Falta de Protección en Boards Dinámicos', 'Das cartas gratis en mesas muy conectadas (muchos proyectos)')
          .replace('Sizing excesivo en Botes 3-Bet / 4-Bet', 'Arriesgas fichas de más en botes ya gigantes desde el preflop'),
        costBB: roundedLoss,
        costLabel: `-${roundedLoss} BB (${info.count} errores)`,
        plainReason: info.fix,
        fixAction: 'Entrena este escenario en la Mesa 6-Max en Vivo con feedback paso a paso.',
        drillPos: safePos,
        drillScenario: 'SRP_IP'
      });
    }
  } catch {
    // ignore
  }

  // 3. Active TheTracker2 Database behavioral leaks (translated into everyday Spanish)
  try {
    const dbs = loadTracker2Databases();
    const activeId = getActiveTracker2DatabaseId();
    const activeDb = dbs.find(d => d.id === activeId) || dbs[0];
    if (activeDb && activeDb.hands.length >= 15) {
      const recentHands = activeDb.hands.filter(h => h.timestamp >= oneWeekAgo);
      const hands = recentHands.length >= 15 ? recentHands : activeDb.hands;
      const stats = computeHudStats(hands);

      if (stats.vpip - stats.pfr > 7) {
        const estCost = Math.round(Math.max(4, (stats.vpip - stats.pfr - 5) * 2.4) * 10) / 10;
        candidates.push({
          id: 't2-gap-passive',
          title: 'Entras pagando sin subir (Limps / Calls pasivos antes del flop)',
          costBB: estCost,
          costLabel: `-${estCost} BB estimados`,
          plainReason: `Tu VPIP es ${stats.vpip}% pero subes solo ${stats.pfr}%. Entrar pagando te quita el control de la mano.`,
          fixAction: 'Si tu mano es lo bastante buena para jugar, entra subiendo (Open Raise) o resube; si no, foldea.',
          drillPos: 'CO',
          drillScenario: 'ROL'
        });
      }

      if (stats.wtsd > 31 && stats.wsd < 50) {
        const estCost = Math.round(Math.max(5, (stats.wtsd - 28) * 3.1) * 10) / 10;
        candidates.push({
          id: 't2-station-river',
          title: 'Llegas hasta el final (Showdown) con parejas débiles y pierdes el bote',
          costBB: estCost,
          costLabel: `-${estCost} BB en Showdowns`,
          plainReason: `Vas al showdown el ${stats.wtsd}% de las veces pero solo ganas el ${stats.wsd}%. Estás pagando de más en Turn y River.`,
          fixAction: 'Cuando un rival pasivo apuesta fuerte en Turn y River, respeta su fuerza y suelta parejas medias.',
          drillPos: 'BB',
          drillScenario: 'SRP_OOP'
        });
      }

      if (stats.bbFoldVsSteal > 62) {
        const estCost = Math.round(Math.max(3.5, (stats.bbFoldVsSteal - 55) * 1.8) * 10) / 10;
        candidates.push({
          id: 't2-bb-overfold',
          title: 'Regalas demasiado tu Ciega Grande cuando te atacan desde el Botón',
          costBB: estCost,
          costLabel: `-${estCost} BB en ciegas`,
          plainReason: `Foldeas ${stats.bbFoldVsSteal}% desde BB. Como ya invertiste 1 BB obligatoria, puedes defender más manos con buen precio.`,
          fixAction: 'Defiende en BB con pares, cartas del mismo palo y Broadways frente a robos pequeños de CO/BTN.',
          drillPos: 'BB',
          drillScenario: 'SRP_OOP'
        });
      }
    }
  } catch {
    // ignore
  }

  return candidates.sort((a, b) => b.costBB - a.costBB).slice(0, 3);
}

