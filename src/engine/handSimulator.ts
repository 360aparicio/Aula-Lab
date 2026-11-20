/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * HandSimulator: Motor de Simulación 6-Max en Vivo (SRP IP/OOP, 3-Bet IP/OOP,
 * Squeeze, ROL, 4-Bet, Cold Call y Multiway 3+ jugadores) con mezcla real de
 * rivales (Regular, Fish, Nit), cálculo de Equity/Pot Odds/SPR, showdown
 * multiway de 7 cartas y persistencia por UID del Reto de 100 Manos.
 */

import { Card, FULL_DECK, RANK_VALUES, Rank, cardToString } from './cards';
import { evaluateCards } from './evaluator';
import { analyzeBoardTexture } from './learner';
import { AutoLearningEngine } from './autoLearningEngine';
import { readScopedItem, writeScopedItem, removeScopedItem, readScopedJson, writeScopedJson } from '../lib/userStorage';
import { cryptoPick, cryptoRandomFloat, cryptoRandomInt, fisherYatesShuffle } from '../lib/random';
import type { TablePosition } from '../components/HandAndPositionBar';

const rankNum = (r: Rank): number => RANK_VALUES[r] + 2;
const createDeck = (): Card[] => [...FULL_DECK];

export const SIM_RECENT_HANDS_STORAGE_KEY = 'allin_sim_recent_hands_v1';
const SIM_RECENT_LIMIT = 180;

/**
 * Semilla aleatoria dinámica alimentada directamente por Crypto.getRandomValues.
 * Mezcla 128 bits de entropía hardware por sesión y por reparto para impedir
 * cualquier secuencia repetible entre sesiones.
 */
export function generateDynamicCryptoSeed(): Uint32Array {
  const seed = new Uint32Array(4);
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(seed);
  } else {
    const now = Date.now() >>> 0;
    seed[0] = now ^ 0xa5a55a5a;
    seed[1] = (now * 2654435761) >>> 0;
    seed[2] = cryptoRandomInt(0x7fffffff);
    seed[3] = cryptoRandomInt(0x7fffffff);
  }
  return seed;
}

const SESSION_DYNAMIC_SEED = generateDynamicCryptoSeed();

export function pickTrueRandomDeckIndex(bound: number): number {
  if (bound <= 1) return 0;
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const words = new Uint32Array(2);
    const maxUint = 0x100000000;
    const limit = Math.floor(maxUint / bound) * bound;
    for (let k = 0; k < 16; k++) {
      globalThis.crypto.getRandomValues(words);
      const mixed = (words[0] ^ SESSION_DYNAMIC_SEED[k % 4] ^ words[1]) >>> 0;
      if (mixed < limit) {
        return mixed % bound;
      }
    }
    return words[0] % bound;
  }
  return cryptoRandomInt(bound);
}

export function loadPersistedSimulatedFingerprints(): string[] {
  const stored = readScopedJson<string[]>(SIM_RECENT_HANDS_STORAGE_KEY, []);
  return Array.isArray(stored) ? stored.filter(x => typeof x === 'string') : [];
}

function appendPersistedSimulatedFingerprint(fp: string): void {
  const current = loadPersistedSimulatedFingerprints().filter(k => k !== fp);
  const next = [...current, fp].slice(-SIM_RECENT_LIMIT);
  writeScopedJson(SIM_RECENT_HANDS_STORAGE_KEY, next);
}

export function resetSimulatedHandHistory(): void {
  removeScopedItem(SIM_RECENT_HANDS_STORAGE_KEY);
}

export type SimPosition = TablePosition;
export type SimScenarioType =
  | 'SRP_IP'
  | 'SRP_OOP'
  | '3BET_IP'
  | '3BET_OOP'
  | 'SQUEEZE'
  | 'ROL'
  | '4BET'
  | 'COLD_CALL'
  | 'MULTIWAY';

export type VillainArchetype = 'Regular' | 'Fish' | 'Nit';
export type TablePoolPreset = 'mixed' | 'recreational' | 'reg_heavy';

export const SIM_POSITIONS: SimPosition[] = ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'];

export const SCENARIO_META: Record<
  SimScenarioType,
  { label: string; shortLabel: string; basePotBB: number; effectiveStackBB: number; description: string }
> = {
  SRP_IP: {
    label: 'SRP In Position (IP)',
    shortLabel: 'SRP IP',
    basePotBB: 6.5,
    effectiveStackBB: 97,
    description: 'Abres preflop y juegas con ventaja posicional tras el call de ciegas o cold-caller.'
  },
  SRP_OOP: {
    label: 'SRP Out of Position (OOP)',
    shortLabel: 'SRP OOP',
    basePotBB: 6.5,
    effectiveStackBB: 97,
    description: 'Defiendes o abres fuera de posición contra un rival que actúa después en todas las calles.'
  },
  '3BET_IP': {
    label: '3-Bet Pot In Position',
    shortLabel: '3-Bet IP',
    basePotBB: 21.5,
    effectiveStackBB: 90,
    description: 'Bote 3-bet con SPR bajo (~4.2) y ventaja de rango polarizado/lineal en posición.'
  },
  '3BET_OOP': {
    label: '3-Bet Pot Out of Position',
    shortLabel: '3-Bet OOP',
    basePotBB: 22.5,
    effectiveStackBB: 89,
    description: '3-Bet desde ciegas o OOP: exige control de polarización y protección del rango de check.'
  },
  SQUEEZE: {
    label: 'Squeeze Pot (SQZ)',
    shortLabel: 'Squeeze',
    basePotBB: 27.5,
    effectiveStackBB: 87,
    description: 'Aplicaste 3-bet sobre un open-raiser y un caller; SPR reducido y alta presión de fold equity.'
  },
  ROL: {
    label: 'Raise Over Limp (ROL)',
    shortLabel: 'ROL',
    basePotBB: 9.0,
    effectiveStackBB: 96,
    description: 'Aislamiento contra limper recreacional (Fish/Passive) con rango amplio por valor.'
  },
  '4BET': {
    label: '4-Bet Pot',
    shortLabel: '4-Bet',
    basePotBB: 46.0,
    effectiveStackBB: 77,
    description: 'SPR muy bajo (<1.8): compromisos rápidos con top pairs, overpairs y bloqueadores.'
  },
  COLD_CALL: {
    label: 'Cold Call en Posición / Defensa',
    shortLabel: 'Cold Call',
    basePotBB: 7.5,
    effectiveStackBB: 97,
    description: 'Pagaste un open-raise con manos conectadas o pares medianos buscando realizar equity.'
  },
  MULTIWAY: {
    label: 'Bote Multiway (3+ Jugadores)',
    shortLabel: 'Multiway',
    basePotBB: 11.5,
    effectiveStackBB: 95,
    description: 'Tres o más jugadores activos en el flop: menor frecuencia de C-bet de farol y más valor estricto.'
  }
};

export interface SeatPlayer {
  pos: SimPosition;
  isHero: boolean;
  inHand: boolean;
  archetype: VillainArchetype | 'Hero';
  stackBB: number;
  committedBB: number;
  lastAction: string;
  holeCards: [Card, Card] | null;
}

export interface SimActionOption {
  id: string;
  label: string;
  actionType: 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin';
  amountBB: number;
  sizingPctPot?: number;
  gtoFreqPct: number;
  evDeltaBB: number;
  isRecommended: boolean;
}

export interface StreetChronicleStep {
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  heroAction: string;
  recommendedAction: string;
  villainAction: string;
  grade: 'optimal' | 'acceptable' | 'inaccuracy' | 'mistake' | 'blunder';
  evLossBB: number;
  potOddsPct: number;
  estimatedEquityPct: number;
  spr: number;
  explanationDummies: string;
  exploitativeNote: string;
  plainEnglishTip?: string;
}

export interface SimulatedHandState {
  handNumber: number;
  scenario: SimScenarioType;
  heroPos: SimPosition;
  heroCards: [Card, Card];
  seats: SeatPlayer[];
  boardCards: Card[];
  fullRunout: [Card, Card, Card, Card, Card];
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  potBB: number;
  facingBetBB: number;
  heroInvestedBB: number;
  villainName: string;
  villainArchetype: VillainArchetype;
  actions: SimActionOption[];
  chronicle: StreetChronicleStep[];
  isFinished: boolean;
  heroNetBB: number;
  showdownSummary?: {
    winners: SimPosition[];
    rankings: Array<{ pos: SimPosition; archetype: string; handDesc: string; score: number; cards: [Card, Card] }>;
    potAwardedBB: number;
  };
}

export interface LiveDecisionRecord {
  id: string;
  timestamp: number;
  handNumber: number;
  heroPos: SimPosition;
  scenario: SimScenarioType;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  chosenAction: string;
  bestAction: string;
  evLossBB: number;
  evLossPctPot: number;
  isOptimal: boolean;
  isBlunder: boolean;
  vpipAction: boolean;
  pfrAction: boolean;
  threeBetSpot: boolean;
  cbetOpportunity: boolean;
  cbetTaken: boolean;
  wentToShowdown: boolean;
  wonAtShowdown: boolean;
  netBB: number;
}

export interface LiveChallengeState {
  active: boolean;
  targetHands: number;
  completedHands: number;
  records: LiveDecisionRecord[];
  startedAt: number;
  updatedAt: number;
}

export const LIVE_CHALLENGE_STORAGE_KEY = 'gto_live_100_challenge_v1';

export function loadLiveChallengeState(): LiveChallengeState {
  try {
    const raw = readScopedItem(LIVE_CHALLENGE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LiveChallengeState>;
      if (parsed && Array.isArray(parsed.records)) {
        return {
          active: Boolean(parsed.active),
          targetHands: typeof parsed.targetHands === 'number' ? parsed.targetHands : 100,
          completedHands: typeof parsed.completedHands === 'number' ? parsed.completedHands : parsed.records.length,
          records: parsed.records,
          startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : Date.now(),
          updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now()
        };
      }
    }
  } catch {
    // ignore parse failure
  }
  return {
    active: false,
    targetHands: 100,
    completedHands: 0,
    records: [],
    startedAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function saveLiveChallengeState(state: LiveChallengeState): void {
  try {
    writeScopedItem(LIVE_CHALLENGE_STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lab-pro-sync-needed'));
    }
  } catch {
    // ignore quota error
  }
}

export function resetLiveChallengeState(startActive = true): LiveChallengeState {
  removeScopedItem(LIVE_CHALLENGE_STORAGE_KEY);
  const next: LiveChallengeState = {
    active: startActive,
    targetHands: 100,
    completedHands: 0,
    records: [],
    startedAt: Date.now(),
    updatedAt: Date.now()
  };
  saveLiveChallengeState(next);
  return next;
}

function pickRandom<T>(arr: readonly T[]): T {
  if (arr.length <= 1) return arr[0];
  return arr[pickTrueRandomDeckIndex(arr.length)];
}

function shuffledDeck(): Card[] {
  // Doble barajado Fisher-Yates con semilla dinámica Crypto.getRandomValues
  const firstPass = fisherYatesShuffle(createDeck());
  const copy = [...firstPass];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = pickTrueRandomDeckIndex(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function canonicalHandNotation(c1: Card, c2: Card): string {
  const r1 = rankNum(c1.rank);
  const r2 = rankNum(c2.rank);
  const hi = r1 >= r2 ? c1 : c2;
  const lo = r1 >= r2 ? c2 : c1;
  if (hi.rank === lo.rank) return `${hi.rank}${lo.rank}`;
  return `${hi.rank}${lo.rank}${hi.suit === lo.suit ? 's' : 'o'}`;
}

function exactHeroPairKey(c1: Card, c2: Card): string {
  return [cardToString(c1), cardToString(c2)].sort().join('');
}

export function buildSimulatedHandFingerprint(state: {
  scenario: SimScenarioType;
  heroPos: SimPosition;
  heroCards: [Card, Card];
  boardCards?: Card[];
  fullRunout: [Card, Card, Card, Card, Card];
}): string {
  const canonical = canonicalHandNotation(state.heroCards[0], state.heroCards[1]);
  const exact = exactHeroPairKey(state.heroCards[0], state.heroCards[1]);
  const flopSig = state.fullRunout
    .slice(0, 3)
    .map(cardToString)
    .sort()
    .join('');
  return `${state.scenario}|${state.heroPos}|${canonical}|${exact}|${flopSig}`;
}

function parseRecentKeyHints(recentKeys: string[] = []): {
  fullKeys: Set<string>;
  spotCanonicals: Set<string>;
  exactPairs: Set<string>;
  recentCanonicals: string[];
  recentScenarios: SimScenarioType[];
  recentPositions: SimPosition[];
} {
  const fullKeys = new Set<string>();
  const spotCanonicals = new Set<string>();
  const exactPairs = new Set<string>();
  const recentCanonicals: string[] = [];
  const recentScenarios: SimScenarioType[] = [];
  const recentPositions: SimPosition[] = [];

  for (const raw of recentKeys) {
    if (!raw) continue;
    fullKeys.add(raw);
    const parts = raw.split('|');
    if (parts.length >= 3) {
      const sc = parts[0] as SimScenarioType;
      const pos = parts[1] as SimPosition;
      const can = parts[2];
      if (sc in SCENARIO_META) recentScenarios.push(sc);
      if (SIM_POSITIONS.includes(pos)) recentPositions.push(pos);
      if (can) {
        recentCanonicals.push(can);
        spotCanonicals.add(`${sc}|${pos}|${can}`);
      }
      if (parts[3]) exactPairs.add(parts[3]);
    } else {
      exactPairs.add(raw);
    }
  }

  return { fullKeys, spotCanonicals, exactPairs, recentCanonicals, recentScenarios, recentPositions };
}

function pickFromBagAvoidingRecent<T extends string>(all: readonly T[], recent: readonly T[]): T {
  if (all.length === 0) throw new Error('Empty option list');
  // Avoid repeating items seen in the current partial cycle of length `all.length`
  const cycleTailCount = recent.length % all.length;
  const tailWindow = cycleTailCount > 0 ? recent.slice(-cycleTailCount) : recent.slice(-Math.min(recent.length, all.length - 1));
  const excluded = new Set(tailWindow);
  if (recent.length > 0) {
    excluded.add(recent[recent.length - 1]);
  }
  const fresh = all.filter(item => !excluded.has(item));
  const pool = fresh.length > 0 ? fresh : all.filter(item => item !== recent[recent.length - 1]);
  return cryptoPick(pool.length > 0 ? pool : all);
}

function preflopHandTier(c1: Card, c2: Card): 'premium' | 'strong' | 'playable' | 'speculative' | 'trash' {
  const r1 = rankNum(c1.rank);
  const r2 = rankNum(c2.rank);
  const high = Math.max(r1, r2);
  const low = Math.min(r1, r2);
  const suited = c1.suit === c2.suit;
  const gap = high - low;
  if ((r1 === r2 && high >= 10) || (high === 14 && low >= 13)) return 'premium';
  if ((r1 === r2 && high >= 7) || (high >= 13 && low >= 11) || (suited && high === 14 && low >= 10)) return 'strong';
  if (r1 === r2 || (suited && (high === 14 || (high >= 10 && gap <= 2) || (high >= 7 && gap === 1))) || (high >= 12 && low >= 10)) {
    return 'playable';
  }
  if ((suited && gap <= 3 && high >= 6) || (high >= 10 && gap <= 1)) return 'speculative';
  return 'trash';
}

function pickPlayableHeroCards(
  deck: Card[],
  heroPos: SimPosition = 'BTN',
  scenario: SimScenarioType = 'SRP_IP',
  hints?: ReturnType<typeof parseRecentKeyHints>
): { hero: [Card, Card]; remaining: Card[] } {
  const needTight = heroPos === 'EP' || scenario === '4BET';
  const needMid = heroPos === 'MP' || scenario === '3BET_OOP' || scenario === 'SQUEEZE';
  const recentCanonSet = new Set((hints?.recentCanonicals || []).slice(-18));
  const exactPairs = hints?.exactPairs || new Set<string>();
  const spotCanonicals = hints?.spotCanonicals || new Set<string>();

  // Selecciona índices aleatorios reales en el mazo barajado mediante Crypto.getRandomValues (sin buffer secuencial)
  for (let attempt = 0; attempt < 90; attempt++) {
    const idx1 = pickTrueRandomDeckIndex(deck.length);
    let idx2 = pickTrueRandomDeckIndex(deck.length - 1);
    if (idx2 >= idx1) idx2 += 1;

    const c1 = deck[idx1];
    const c2 = deck[idx2];
    const tier = preflopHandTier(c1, c2);
    const tierOk = needTight
      ? tier === 'premium' || tier === 'strong' || (tier === 'playable' && attempt > 16)
      : needMid
      ? tier === 'premium' || tier === 'strong' || tier === 'playable'
      : tier !== 'trash' || attempt > 65;

    if (!tierOk) continue;

    const canonical = canonicalHandNotation(c1, c2);
    const exact = exactHeroPairKey(c1, c2);
    const spotCan = `${scenario}|${heroPos}|${canonical}`;

    // Control estricto de novedad antes de relajar restricciones
    if (attempt < 55 && (exactPairs.has(exact) || recentCanonSet.has(canonical) || spotCanonicals.has(spotCan))) {
      continue;
    }
    if (attempt < 80 && exactPairs.has(exact)) {
      continue;
    }

    const remaining = deck.filter((_, idx) => idx !== idx1 && idx !== idx2);
    return { hero: [c1, c2], remaining: fisherYatesShuffle(remaining) };
  }

  // Fallback también con índice aleatorio real (nunca deck[0], deck[1] secuencial)
  const fallbackIdx1 = pickTrueRandomDeckIndex(deck.length);
  let fallbackIdx2 = pickTrueRandomDeckIndex(deck.length - 1);
  if (fallbackIdx2 >= fallbackIdx1) fallbackIdx2 += 1;
  const fallbackRemaining = fisherYatesShuffle(
    deck.filter((_, idx) => idx !== fallbackIdx1 && idx !== fallbackIdx2)
  );
  return { hero: [deck[fallbackIdx1], deck[fallbackIdx2]], remaining: fallbackRemaining };
}

function buildPreflopDecisionNode(
  heroCards: [Card, Card],
  heroPos: SimPosition,
  scenario: SimScenarioType,
  archetype: VillainArchetype
): { actions: SimActionOption[]; potBB: number; facingBetBB: number } {
  const tier = preflopHandTier(heroCards[0], heroCards[1]);
  const isTightPos = heroPos === 'EP' || heroPos === 'MP';

  if (scenario === '3BET_IP' || scenario === '3BET_OOP' || scenario === 'SQUEEZE') {
    const facing = 2.5;
    const pot = 4.0;
    const threeBetSize = scenario === 'SQUEEZE' ? 11 : 8.5;
    let rec: 'fold' | 'call' | 'raise' = 'fold';
    if (tier === 'premium' || tier === 'strong') rec = 'raise';
    else if (tier === 'playable') rec = archetype === 'Nit' && isTightPos ? 'fold' : 'call';
    else rec = 'fold';

    return {
      potBB: pot,
      facingBetBB: facing,
      actions: [
        {
          id: 'fold',
          label: 'Fold Preflop',
          actionType: 'fold',
          amountBB: 0,
          gtoFreqPct: rec === 'fold' ? 78 : 12,
          evDeltaBB: rec === 'fold' ? 0 : -1.4,
          isRecommended: rec === 'fold'
        },
        {
          id: 'call',
          label: `Call ${facing} BB`,
          actionType: 'call',
          amountBB: facing,
          gtoFreqPct: rec === 'call' ? 68 : 22,
          evDeltaBB: rec === 'call' ? 0 : rec === 'raise' ? -0.5 : -1.2,
          isRecommended: rec === 'call'
        },
        {
          id: 'raise',
          label: `3-Bet ${threeBetSize} BB`,
          actionType: 'raise',
          amountBB: threeBetSize,
          gtoFreqPct: rec === 'raise' ? 76 : 15,
          evDeltaBB: rec === 'raise' ? 0 : -1.9,
          isRecommended: rec === 'raise'
        }
      ]
    };
  }

  if (scenario === '4BET') {
    const facing = 8.5;
    const pot = 12.0;
    let rec: 'fold' | 'call' | 'raise' = tier === 'premium' ? 'raise' : tier === 'strong' ? 'call' : 'fold';
    return {
      potBB: pot,
      facingBetBB: facing,
      actions: [
        {
          id: 'fold',
          label: 'Fold vs 3-Bet',
          actionType: 'fold',
          amountBB: 0,
          gtoFreqPct: rec === 'fold' ? 82 : 8,
          evDeltaBB: rec === 'fold' ? 0 : -2.6,
          isRecommended: rec === 'fold'
        },
        {
          id: 'call',
          label: `Call ${facing} BB`,
          actionType: 'call',
          amountBB: facing,
          gtoFreqPct: rec === 'call' ? 70 : 25,
          evDeltaBB: rec === 'call' ? 0 : -0.8,
          isRecommended: rec === 'call'
        },
        {
          id: 'raise',
          label: '4-Bet 22 BB',
          actionType: 'raise',
          amountBB: 22,
          gtoFreqPct: rec === 'raise' ? 78 : 10,
          evDeltaBB: rec === 'raise' ? 0 : -3.4,
          isRecommended: rec === 'raise'
        }
      ]
    };
  }

  // Open Raise / ROL / Cold Call
  const facing = scenario === 'COLD_CALL' ? 2.5 : scenario === 'ROL' ? 1.0 : 0;
  const pot = facing > 0 ? 4.0 : 1.5;
  const openSize = scenario === 'ROL' ? 4.0 : 2.5;
  const shouldOpen =
    tier === 'premium' ||
    tier === 'strong' ||
    (tier === 'playable' && (!isTightPos || scenario !== 'SRP_OOP')) ||
    (tier === 'speculative' && (heroPos === 'BTN' || heroPos === 'CO'));

  const recId = scenario === 'COLD_CALL' ? (tier === 'trash' ? 'fold' : 'call') : shouldOpen ? 'raise' : 'fold';

  return {
    potBB: pot,
    facingBetBB: facing,
    actions: [
      {
        id: 'fold',
        label: 'Fold Preflop',
        actionType: 'fold',
        amountBB: 0,
        gtoFreqPct: recId === 'fold' ? 84 : 10,
        evDeltaBB: recId === 'fold' ? 0 : -1.1,
        isRecommended: recId === 'fold'
      },
      {
        id: 'call',
        label: facing > 0 ? `Call ${facing} BB` : 'Limp 1 BB',
        actionType: 'call',
        amountBB: Math.max(1, facing),
        gtoFreqPct: recId === 'call' ? 72 : 12,
        evDeltaBB: recId === 'call' ? 0 : -0.7,
        isRecommended: recId === 'call'
      },
      {
        id: 'raise',
        label: scenario === 'ROL' ? `ROL Raise ${openSize} BB` : `Open Raise ${openSize} BB`,
        actionType: 'raise',
        amountBB: openSize,
        gtoFreqPct: recId === 'raise' ? 82 : 18,
        evDeltaBB: recId === 'raise' ? 0 : -1.3,
        isRecommended: recId === 'raise'
      }
    ]
  };
}

function resolvePositionalMatchup(
  heroPos: SimPosition,
  scenario: SimScenarioType
): { ipVillains: SimPosition[]; oopVillains: SimPosition[] } {
  const postflopOrder: Record<SimPosition, number> = { SB: 0, BB: 1, EP: 2, MP: 3, CO: 4, BTN: 5 };
  const others = SIM_POSITIONS.filter(p => p !== heroPos);

  if (scenario === 'MULTIWAY') {
    const shuffledOthers = fisherYatesShuffle(others);
    const oppCount = cryptoRandomFloat() < 0.35 && shuffledOthers.length >= 3 ? 3 : 2;
    const picked = shuffledOthers.slice(0, oppCount);
    return {
      ipVillains: picked.filter(p => postflopOrder[p] > postflopOrder[heroPos]),
      oopVillains: picked.filter(p => postflopOrder[p] < postflopOrder[heroPos])
    };
  }

  const isHeroIp = scenario === 'SRP_IP' || scenario === '3BET_IP' || scenario === 'ROL' || scenario === 'COLD_CALL';
  const ipCandidates = others.filter(p => postflopOrder[p] > postflopOrder[heroPos]);
  const oopCandidates = others.filter(p => postflopOrder[p] < postflopOrder[heroPos]);

  if (isHeroIp && oopCandidates.length > 0) {
    return { ipVillains: [], oopVillains: [pickRandom(oopCandidates)] };
  }
  if (!isHeroIp && ipCandidates.length > 0) {
    return { ipVillains: [pickRandom(ipCandidates)], oopVillains: [] };
  }
  const fallback = pickRandom(others);
  return postflopOrder[fallback] > postflopOrder[heroPos]
    ? { ipVillains: [fallback], oopVillains: [] }
    : { ipVillains: [], oopVillains: [fallback] };
}

export function estimateHandStrengthCategory(
  holeCards: [Card, Card],
  boardCards: Card[]
): { tier: 'monster' | 'strong' | 'medium' | 'draw' | 'air'; label: string; equityPct: number } {
  const rankCounts = new Map<number, number>();
  const boardRankCounts = new Map<number, number>();
  const suitCounts = new Map<string, number>();
  const all = [...holeCards, ...boardCards];
  for (const c of all) {
    const rv = rankNum(c.rank);
    rankCounts.set(rv, (rankCounts.get(rv) || 0) + 1);
    suitCounts.set(c.suit, (suitCounts.get(c.suit) || 0) + 1);
  }
  for (const b of boardCards) {
    const rv = rankNum(b.rank);
    boardRankCounts.set(rv, (boardRankCounts.get(rv) || 0) + 1);
  }
  const boardVals = boardCards.map(c => rankNum(c.rank));
  const boardMax = boardVals.length > 0 ? Math.max(...boardVals) : 14;
  const boardMin = boardVals.length > 0 ? Math.min(...boardVals) : 2;
  const maxBoardRankCnt = boardVals.length > 0 ? Math.max(...Array.from(boardRankCounts.values())) : 0;
  const h0 = rankNum(holeCards[0].rank);
  const h1 = rankNum(holeCards[1].rank);
  const heroMax = Math.max(h0, h1);
  const heroMin = Math.min(h0, h1);
  const isPair = h0 === h1;
  const isRiver = boardCards.length >= 5;

  const eval7 =
    all.length >= 5
      ? evaluateCards(all.slice(0, 7))
      : { category: 0, description: 'Carta Alta', score: 0 };

  const boardScore = isRiver ? evaluateCards(boardCards.slice(0, 5)).score : -1;
  const heroBeatsBoard = !isRiver || eval7.score > boardScore;

  // Verify Hero actually contributes to Three-of-a-Kind+ (not just playing board trips like KKK42 with 76)
  const boardTripsOnly =
    maxBoardRankCnt >= 3 &&
    !isPair &&
    boardCards.every(b => (boardRankCounts.get(rankNum(b.rank)) || 0) >= 3 || (rankNum(b.rank) !== h0 && rankNum(b.rank) !== h1)) &&
    eval7.category === 3;

  if ((eval7.category >= 3 && heroBeatsBoard && !boardTripsOnly) || (isPair && boardCards.some(b => b.rank === holeCards[0].rank))) {
    return { tier: 'monster', label: eval7.description || 'Mano Muy Fuerte (Set+)', equityPct: 84 };
  }

  // Draws only exist when cards remain to be dealt (< 5 board cards)
  let hasFlushDraw = false;
  let hasStraightDraw = false;
  if (!isRiver) {
    hasFlushDraw = Array.from(suitCounts.values()).some(cnt => cnt === 4);
    const rankSet = new Set(all.map(c => rankNum(c.rank)));
    if (rankSet.has(14)) rankSet.add(1); // Wheel draw A-2-3-4
    for (let start = 1; start <= 10; start++) {
      let count = 0;
      for (let r = start; r < start + 5; r++) {
        if (rankSet.has(r)) count++;
      }
      if (count >= 4) {
        hasStraightDraw = true;
        break;
      }
    }
  }

  const topPairHit = boardVals.some(v => v === boardMax && (h0 === v || h1 === v));
  const holePairHitsBoard =
    (boardRankCounts.get(h0) || 0) >= 1 && (boardRankCounts.get(h1) || 0) >= 1 && h0 !== h1;
  const genuineTwoPair =
    eval7.category === 2 && (holePairHitsBoard || (isPair && heroMax > boardMax) || (topPairHit && isPair));

  if (genuineTwoPair) {
    return { tier: 'monster', label: 'Doble Pareja', equityPct: 77 };
  }
  if ((isPair && heroMax > boardMax) || (topPairHit && heroMax >= 12)) {
    return { tier: 'strong', label: isPair ? 'Overpair' : 'Top Pair Buen Kicker', equityPct: 68 };
  }
  if (topPairHit || (isPair && heroMax > boardMin) || (isPair && maxBoardRankCnt >= 2)) {
    return { tier: 'medium', label: 'Top/Second Pair (Valor Medio)', equityPct: 50 };
  }
  if (hasFlushDraw && hasStraightDraw) {
    return { tier: 'strong', label: 'Combo Draw (Color + Escalera)', equityPct: 58 };
  }
  if (hasFlushDraw || hasStraightDraw) {
    return { tier: 'draw', label: hasFlushDraw ? 'Proyecto de Color' : 'Proyecto de Escalera', equityPct: 38 };
  }
  if (boardCards.some(b => b.rank === holeCards[0].rank || b.rank === holeCards[1].rank)) {
    return { tier: 'medium', label: 'Pareja Baja / Showdown Value', equityPct: 40 };
  }
  if (heroMax >= 13 && heroMin >= 11) {
    return { tier: 'air', label: isRiver ? 'As/Rey Alto (Bluff-Catcher)' : 'Overcards (Backdoor Equity)', equityPct: 24 };
  }
  return { tier: 'air', label: 'Aire / Candidato a Semi-Bluff o Check', equityPct: 16 };
}

function buildStreetDecisionNode(
  heroCards: [Card, Card],
  boardCards: Card[],
  potBB: number,
  facingBetBB: number,
  stackRemainingBB: number,
  scenario: SimScenarioType,
  archetype: VillainArchetype,
  activeOpponents: number
): SimActionOption[] {
  const strength = estimateHandStrengthCategory(heroCards, boardCards);
  const texture = analyzeBoardTexture(boardCards);
  const isWet = texture.wetness.includes('Coordinado') || texture.wetness.includes('Monótono');
  const spr = stackRemainingBB / Math.max(1, potBB);

  const smallBet = Math.max(1, Math.round(potBB * 0.33 * 10) / 10);
  const largeBet = Math.max(2, Math.round(potBB * 0.72 * 10) / 10);
  const overBet = Math.min(stackRemainingBB, Math.round(potBB * 1.15 * 10) / 10);

  if (facingBetBB > 0) {
    const callAmt = Math.min(stackRemainingBB, facingBetBB);
    const potOdds = (callAmt / (potBB + callAmt)) * 100;
    const raiseAmt = Math.min(stackRemainingBB, Math.round((facingBetBB * 2.8) * 10) / 10);

    let recType: 'fold' | 'call' | 'raise' = 'fold';
    if (strength.tier === 'monster' || (strength.tier === 'strong' && spr <= 2.5)) {
      recType = archetype === 'Fish' ? 'raise' : strength.tier === 'monster' ? 'raise' : 'call';
    } else if (strength.equityPct >= potOdds + 4) {
      recType = 'call';
    } else if (strength.tier === 'draw' && archetype === 'Nit' && activeOpponents === 1) {
      recType = 'raise';
    } else {
      recType = 'fold';
    }

    const opts: SimActionOption[] = [
      {
        id: 'fold',
        label: 'Fold',
        actionType: 'fold',
        amountBB: 0,
        gtoFreqPct: recType === 'fold' ? 78 : strength.tier === 'medium' ? 22 : 5,
        evDeltaBB: recType === 'fold' ? 0 : -Math.round(potBB * (strength.equityPct / 100 - 0.18) * 10) / 10,
        isRecommended: recType === 'fold'
      },
      {
        id: 'call',
        label: `Call ${callAmt} BB`,
        actionType: 'call',
        amountBB: callAmt,
        gtoFreqPct: recType === 'call' ? 76 : recType === 'raise' ? 28 : 18,
        evDeltaBB:
          recType === 'call'
            ? 0
            : recType === 'fold'
            ? -Math.round((callAmt * (potOdds - strength.equityPct) / 100) * 10) / 10
            : -0.4,
        isRecommended: recType === 'call'
      },
      {
        id: 'raise',
        label: raiseAmt >= stackRemainingBB * 0.85 ? `All-In (${stackRemainingBB} BB)` : `Raise ${raiseAmt} BB`,
        actionType: raiseAmt >= stackRemainingBB * 0.85 ? 'allin' : 'raise',
        amountBB: raiseAmt,
        gtoFreqPct: recType === 'raise' ? 74 : strength.tier === 'draw' ? 24 : 4,
        evDeltaBB: recType === 'raise' ? 0 : recType === 'fold' ? -Math.round(raiseAmt * 0.35 * 10) / 10 : -0.6,
        isRecommended: recType === 'raise'
      }
    ];
    return opts;
  }

  // Hero acts first or after check (Check / Bet Small / Bet Large / Overbet)
  let recId = 'check';
  if (activeOpponents >= 2) {
    // Multiway tightens bluffing significantly
    if (strength.tier === 'monster' || strength.tier === 'strong') {
      recId = isWet ? 'bet_large' : 'bet_small';
    } else if (strength.tier === 'draw' && archetype !== 'Fish') {
      recId = 'check';
    } else {
      recId = 'check';
    }
  } else if (strength.tier === 'monster') {
    recId = spr <= 2.2 || isWet ? 'bet_large' : 'bet_small';
  } else if (strength.tier === 'strong') {
    recId = isWet ? 'bet_large' : 'bet_small';
  } else if (strength.tier === 'medium') {
    recId = scenario === '3BET_IP' && !isWet ? 'bet_small' : 'check';
  } else if (strength.tier === 'draw') {
    recId = archetype === 'Fish' ? 'check' : 'bet_large';
  } else {
    recId = !isWet && (scenario === 'SRP_IP' || scenario === '3BET_IP' || scenario === 'ROL') && archetype === 'Nit'
      ? 'bet_small'
      : 'check';
  }

  const opts: SimActionOption[] = [
    {
      id: 'check',
      label: 'Check',
      actionType: 'check',
      amountBB: 0,
      gtoFreqPct: recId === 'check' ? 74 : 26,
      evDeltaBB: recId === 'check' ? 0 : -Math.round(potBB * 0.08 * 10) / 10,
      isRecommended: recId === 'check'
    },
    {
      id: 'bet_small',
      label: `Bet 33% (${smallBet} BB)`,
      actionType: 'bet',
      amountBB: smallBet,
      sizingPctPot: 33,
      gtoFreqPct: recId === 'bet_small' ? 72 : recId === 'check' ? 20 : 28,
      evDeltaBB: recId === 'bet_small' ? 0 : recId === 'check' && strength.tier === 'air' ? -Math.round(smallBet * 0.28 * 10) / 10 : -0.35,
      isRecommended: recId === 'bet_small'
    },
    {
      id: 'bet_large',
      label: `Bet 72% (${largeBet} BB)`,
      actionType: 'bet',
      amountBB: largeBet,
      sizingPctPot: 72,
      gtoFreqPct: recId === 'bet_large' ? 76 : strength.tier === 'draw' ? 30 : 12,
      evDeltaBB: recId === 'bet_large' ? 0 : recId === 'check' ? -Math.round(largeBet * 0.34 * 10) / 10 : -0.45,
      isRecommended: recId === 'bet_large'
    }
  ];

  if (spr > 1.3 && overBet <= stackRemainingBB && (strength.tier === 'monster' || boardCards.length >= 4)) {
    opts.push({
      id: 'overbet',
      label: overBet >= stackRemainingBB * 0.9 ? `All-In (${stackRemainingBB} BB)` : `Overbet 115% (${overBet} BB)`,
      actionType: overBet >= stackRemainingBB * 0.9 ? 'allin' : 'bet',
      amountBB: overBet,
      sizingPctPot: 115,
      gtoFreqPct: strength.tier === 'monster' && boardCards.length === 5 ? 42 : 8,
      evDeltaBB: strength.tier === 'monster' ? -0.1 : -Math.round(overBet * 0.32 * 10) / 10,
      isRecommended: false
    });
  }

  return opts;
}

const ARCHETYPES: VillainArchetype[] = ['Regular', 'Fish', 'Nit'];
const VILLAIN_NAMES: Record<VillainArchetype, string[]> = {
  Regular: ['Reg_6Max', 'SolverGrinder', 'TagPro_ES'],
  Fish: ['CallingFun88', 'LimperMax', 'SundayRec'],
  Nit: ['RockSolid12', 'TightWaiter', 'NitShield']
};

function pickArchetypeByPreset(preset: TablePoolPreset): VillainArchetype {
  if (preset === 'recreational') {
    return cryptoRandomFloat() < 0.72 ? 'Fish' : cryptoRandomFloat() < 0.5 ? 'Nit' : 'Regular';
  }
  if (preset === 'reg_heavy') {
    return cryptoRandomFloat() < 0.75 ? 'Regular' : 'Nit';
  }
  return pickRandom(ARCHETYPES);
}

export function createSimulatedHand(params: {
  handNumber: number;
  positionFilter: SimPosition | 'RANDOM';
  scenarioFilter: SimScenarioType | 'RANDOM';
  recentKeys?: string[];
  includePreflop?: boolean;
  tablePreset?: TablePoolPreset;
}): SimulatedHandState {
  const allScenarios: SimScenarioType[] = Object.keys(SCENARIO_META) as SimScenarioType[];
  const persistedRecent = loadPersistedSimulatedFingerprints();
  const mergedRecentKeys = Array.from(new Set([...persistedRecent, ...(params.recentKeys || [])]));
  const hints = parseRecentKeyHints(mergedRecentKeys);
  const chosenScenario: SimScenarioType =
    params.scenarioFilter === 'RANDOM'
      ? pickFromBagAvoidingRecent(allScenarios, hints.recentScenarios)
      : params.scenarioFilter;
  const chosenHeroPos: SimPosition =
    params.positionFilter === 'RANDOM'
      ? pickFromBagAvoidingRecent(SIM_POSITIONS, hints.recentPositions)
      : params.positionFilter;

  const initialDeck = shuffledDeck();
  const initialIdx1 = pickTrueRandomDeckIndex(initialDeck.length);
  let initialIdx2 = pickTrueRandomDeckIndex(initialDeck.length - 1);
  if (initialIdx2 >= initialIdx1) initialIdx2 += 1;
  let hero: [Card, Card] = [initialDeck[initialIdx1], initialDeck[initialIdx2]];
  let remaining: Card[] = fisherYatesShuffle(
    initialDeck.filter((_, idx) => idx !== initialIdx1 && idx !== initialIdx2)
  );
  let fullRunout: [Card, Card, Card, Card, Card] = [
    remaining[0],
    remaining[1],
    remaining[2],
    remaining[3],
    remaining[4]
  ];

  for (let dealTry = 0; dealTry < 10; dealTry++) {
    const deck = shuffledDeck();
    const dealt = pickPlayableHeroCards(deck, chosenHeroPos, chosenScenario, hints);
    const candidateRunout: [Card, Card, Card, Card, Card] = [
      dealt.remaining[0],
      dealt.remaining[1],
      dealt.remaining[2],
      dealt.remaining[3],
      dealt.remaining[4]
    ];
    hero = dealt.hero;
    remaining = dealt.remaining;
    fullRunout = candidateRunout;

    const candidateFp = buildSimulatedHandFingerprint({
      scenario: chosenScenario,
      heroPos: chosenHeroPos,
      heroCards: hero,
      fullRunout
    });
    if (!hints.fullKeys.has(candidateFp)) {
      break;
    }
  }
  const finalFingerprint = buildSimulatedHandFingerprint({
    scenario: chosenScenario,
    heroPos: chosenHeroPos,
    heroCards: hero,
    fullRunout
  });
  appendPersistedSimulatedFingerprint(finalFingerprint);
  let cursor = 5;

  const { ipVillains, oopVillains } = resolvePositionalMatchup(chosenHeroPos, chosenScenario);
  const activeVillainPositions = new Set([...ipVillains, ...oopVillains]);
  const mainVillainPos = ipVillains[0] || oopVillains[0] || 'BB';

  const preset: TablePoolPreset = params.tablePreset || 'mixed';
  const archetype: VillainArchetype = pickArchetypeByPreset(preset);
  const meta = SCENARIO_META[chosenScenario];
  const startPreflop = Boolean(params.includePreflop);

  const seats: SeatPlayer[] = SIM_POSITIONS.map(pos => {
    const isHero = pos === chosenHeroPos;
    const inHand = isHero || activeVillainPositions.has(pos);
    const seatArch: VillainArchetype | 'Hero' = isHero
      ? 'Hero'
      : pos === mainVillainPos
      ? archetype
      : pickArchetypeByPreset(preset);
    let holeCards: [Card, Card] | null = null;
    if (isHero) {
      holeCards = hero;
    } else if (inHand) {
      holeCards = [remaining[cursor], remaining[cursor + 1]];
      cursor += 2;
    }

    const preflopLabel = startPreflop
      ? isHero
        ? 'Tu turno'
        : pos === 'SB'
        ? 'SB 0.5 BB'
        : pos === 'BB'
        ? 'BB 1.0 BB'
        : inHand
        ? 'En mano'
        : 'Fold'
      : isHero
      ? chosenScenario === 'COLD_CALL'
        ? 'Call'
        : chosenScenario === '3BET_IP' || chosenScenario === '3BET_OOP'
        ? '3-Bet'
        : chosenScenario === 'SQUEEZE'
        ? 'Squeeze'
        : chosenScenario === '4BET'
        ? '4-Bet'
        : 'Open'
      : inHand
      ? 'En Bote'
      : 'Fold';

    return {
      pos,
      isHero,
      inHand,
      archetype: seatArch,
      stackBB: startPreflop ? 100 : meta.effectiveStackBB,
      committedBB: startPreflop
        ? pos === 'SB'
          ? 0.5
          : pos === 'BB'
          ? 1
          : 0
        : isHero
        ? Math.round(meta.basePotBB * 0.48 * 10) / 10
        : inHand
        ? Math.round(meta.basePotBB * 0.45 * 10) / 10
        : 0,
      lastAction: preflopLabel,
      holeCards
    };
  });

  if (startPreflop) {
    const preNode = buildPreflopDecisionNode(hero, chosenHeroPos, chosenScenario, archetype);
    const villainName = `${pickRandom(VILLAIN_NAMES[archetype])} (${mainVillainPos})`;
    return {
      handNumber: params.handNumber,
      scenario: chosenScenario,
      heroPos: chosenHeroPos,
      heroCards: hero,
      seats,
      boardCards: [],
      fullRunout,
      street: 'preflop',
      potBB: preNode.potBB,
      facingBetBB: preNode.facingBetBB,
      heroInvestedBB: chosenHeroPos === 'BB' ? 1 : chosenHeroPos === 'SB' ? 0.5 : 0,
      villainName,
      villainArchetype: archetype,
      actions: preNode.actions,
      chronicle: [],
      isFinished: false,
      heroNetBB: 0
    };
  }

  // Occasionally villain leads OOP on flop (Donk or C-Bet against Hero IP)
  const heroActsSecond = oopVillains.length > 0;
  const facingBetBB = heroActsSecond && cryptoRandomFloat() < 0.48 ? Math.round(meta.basePotBB * 0.35 * 10) / 10 : 0;
  const potAfterDonk = meta.basePotBB + facingBetBB;
  const flopBoard = fullRunout.slice(0, 3);

  const actions = buildStreetDecisionNode(
    hero,
    flopBoard,
    potAfterDonk,
    facingBetBB,
    meta.effectiveStackBB,
    chosenScenario,
    archetype,
    activeVillainPositions.size
  );

  const villainName = `${pickRandom(VILLAIN_NAMES[archetype])} (${mainVillainPos})`;

  return {
    handNumber: params.handNumber,
    scenario: chosenScenario,
    heroPos: chosenHeroPos,
    heroCards: hero,
    seats,
    boardCards: flopBoard,
    fullRunout,
    street: 'flop',
    potBB: potAfterDonk,
    facingBetBB,
    heroInvestedBB: Math.round(meta.basePotBB * 0.48 * 10) / 10,
    villainName,
    villainArchetype: archetype,
    actions,
    chronicle: [],
    isFinished: false,
    heroNetBB: 0
  };
}

function resolveShowdown(state: SimulatedHandState): SimulatedHandState['showdownSummary'] {
  const contenders = state.seats.filter(s => s.inHand && s.holeCards);
  const rankings = contenders
    .map(s => {
      const cards = s.holeCards!;
      const evalRes = evaluateCards([...cards, ...state.fullRunout]);
      return {
        pos: s.pos,
        archetype: s.archetype,
        handDesc: evalRes.description,
        score: evalRes.score,
        cards
      };
    })
    .sort((a, b) => b.score - a.score);

  const bestScore = rankings[0]?.score ?? 0;
  const winners = rankings.filter(r => r.score === bestScore).map(r => r.pos);
  return {
    winners,
    rankings,
    potAwardedBB: Math.round(state.potBB * 10) / 10
  };
}

export function applyHeroDecision(
  state: SimulatedHandState,
  chosenOption: SimActionOption
): { nextState: SimulatedHandState; decisionRecord: LiveDecisionRecord } {
  const recommended = state.actions.find(a => a.isRecommended) || state.actions[0];
  const evLossBB = Math.max(0, Math.round(Math.abs(chosenOption.evDeltaBB) * 10) / 10);
  const evLossPctPot = Math.round((evLossBB / Math.max(1, state.potBB)) * 100);

  let grade: StreetChronicleStep['grade'] = 'optimal';
  if (chosenOption.id === recommended.id || evLossPctPot <= 2) {
    grade = 'optimal';
  } else if (evLossPctPot <= 5) {
    grade = 'acceptable';
  } else if (evLossPctPot <= 12) {
    grade = 'inaccuracy';
  } else if (evLossPctPot <= 24) {
    grade = 'mistake';
  } else {
    grade = 'blunder';
  }

  const strength =
    state.street === 'preflop'
      ? {
          tier: preflopHandTier(state.heroCards[0], state.heroCards[1]) === 'premium' ? ('monster' as const) : ('strong' as const),
          label: `Mano Preflop (${preflopHandTier(state.heroCards[0], state.heroCards[1])})`,
          equityPct: preflopHandTier(state.heroCards[0], state.heroCards[1]) === 'premium' ? 76 : 54
        }
      : estimateHandStrengthCategory(state.heroCards, state.boardCards);
  const potOddsPct =
    state.facingBetBB > 0 ? Math.round((state.facingBetBB / (state.potBB + state.facingBetBB)) * 100) : 0;
  const heroSeat = state.seats.find(s => s.isHero);
  const stackRemaining = heroSeat ? heroSeat.stackBB : 85;
  const spr = Math.round((stackRemaining / Math.max(1, state.potBB)) * 10) / 10;

  const explanationDummies =
    chosenOption.id === recommended.id
      ? `¡Decisión exacta! Con ${strength.label} (~${strength.equityPct}% equity) y SPR ${spr}, ${recommended.label} maximiza el EV en ${SCENARIO_META[state.scenario].shortLabel}.`
      : `La línea Nash preferida era ${recommended.label} (${recommended.gtoFreqPct}% freq). Tu elección (${chosenOption.label}) cede ~${evLossBB} BB (${evLossPctPot}% del bote).`;

  const exploitativeNote =
    state.villainArchetype === 'Fish'
      ? 'Vs Fish (Calling Station): apuesta más por valor fino y reduce faroles sin equity.'
      : state.villainArchetype === 'Nit'
      ? 'Vs Nit: aumenta C-bet de farol en boards secos y respeta sus raises fuertes.'
      : 'Vs Regular: mantén frecuencias balanceadas y protege tu rango de check con manos medias.';

  const plainEnglishTip =
    chosenOption.id === recommended.id
      ? `Bien jugado: tu mano tiene fuerza suficiente para esta acción sin regalar fichas al rival (${state.villainArchetype}).`
      : recommended.actionType === 'fold'
      ? `Consejo claro: aquí tu mano va por detrás o cuesta demasiado pagar. Tirar cartas a tiempo también es ganar dinero.`
      : recommended.actionType === 'call'
      ? `Consejo claro: el precio para ver la siguiente carta es bueno respecto a tus opciones de ligar o ganar.`
      : `Consejo claro: con esta jugada conviene tomar la iniciativa apostando/subiendo en vez de jugar pasivo.`;

  // Capture into AutoLearningEngine + SM-2
  if (state.street !== 'showdown') {
    const texture = state.boardCards.length >= 3 ? analyzeBoardTexture(state.boardCards) : null;
    AutoLearningEngine.getInstance().collectHand({
      street: state.street,
      category: `${SCENARIO_META[state.scenario].shortLabel} (${state.heroPos})`,
      heroCards: `${cardToString(state.heroCards[0])} ${cardToString(state.heroCards[1])}`,
      board: state.boardCards.length > 0 ? state.boardCards.map(cardToString).join(' ') : 'Preflop',
      heroPos: state.heroPos,
      villainPos: state.seats.find(s => !s.isHero && s.inHand)?.pos || 'BB',
      potBB: state.potBB,
      chosenAction: chosenOption.label,
      optimalAction: recommended.label,
      evLossPct: evLossPctPot,
      isMistake: evLossPctPot > 3,
      keyTakeaway: `${explanationDummies} ${exploitativeNote}`
    });
    void texture;
  }

  const heroSeatPre = state.seats.find(s => s.isHero);
  const heroPreCommitted = heroSeatPre?.committedBB ?? 0;
  const heroAddedBB =
    state.street === 'preflop'
      ? chosenOption.actionType === 'fold'
        ? 0
        : chosenOption.actionType === 'call'
        ? state.facingBetBB > 0
          ? chosenOption.amountBB
          : Math.max(0, chosenOption.amountBB - heroPreCommitted)
        : Math.max(0, chosenOption.amountBB - heroPreCommitted)
      : chosenOption.amountBB;
  const heroTargetTotalBB = Math.round((heroPreCommitted + heroAddedBB) * 10) / 10;

  let newPot = state.potBB + heroAddedBB;
  let heroInvested = state.heroInvestedBB + heroAddedBB;
  let updatedSeats = state.seats.map(s =>
    s.isHero
      ? {
          ...s,
          stackBB: Math.max(0, Math.round((s.stackBB - heroAddedBB) * 10) / 10),
          committedBB: heroTargetTotalBB,
          lastAction: chosenOption.label
        }
      : s
  );

  let villainActionDesc = 'Check';
  let finished = false;
  let heroNetBB = 0;
  let nextStreet: SimulatedHandState['street'] = state.street;
  let nextBoard = [...state.boardCards];
  let nextFacingBet = 0;
  let showdownSummary: SimulatedHandState['showdownSummary'];
  let stayedForRaise = false;

  if (chosenOption.actionType === 'fold') {
    villainActionDesc = `${state.villainArchetype} gana el bote (${state.potBB} BB).`;
    finished = true;
    heroNetBB = -Math.round(heroInvested * 10) / 10;
    nextStreet = 'showdown';
  } else if (state.street === 'preflop') {
    // Transition cleanly from Preflop -> Flop without double counting prior villain bets
    const activeVillains = updatedSeats.filter(s => !s.isHero && s.inHand);
    const firstActiveV = activeVillains[0];
    const targetOppTotalBB = Math.max(heroTargetTotalBB, state.facingBetBB);
    updatedSeats = updatedSeats.map(s => {
      if (s.isHero || !s.inHand) return s;
      const impliedExisting =
        firstActiveV && s.pos === firstActiveV.pos && state.facingBetBB > 0
          ? Math.max(s.committedBB, state.scenario === '4BET' ? 8.5 : 2.5)
          : s.committedBB;
      const add = Math.min(s.stackBB, Math.max(0, Math.round((targetOppTotalBB - impliedExisting) * 10) / 10));
      newPot += add;
      return {
        ...s,
        stackBB: Math.max(0, Math.round((s.stackBB - add) * 10) / 10),
        committedBB: Math.round((impliedExisting + add) * 10) / 10,
        lastAction: 'Call Preflop'
      };
    });
    nextStreet = 'flop';
    nextBoard = state.fullRunout.slice(0, 3);
    villainActionDesc = `${activeVillains.length} rival(es) igualan · Sale el Flop`;
  } else {
    // Postflop: Villain reacts to hero bet or check
    const activeVillains = updatedSeats.filter(s => !s.isHero && s.inHand);
    const activeCount = activeVillains.length;

    if (chosenOption.actionType === 'bet' || chosenOption.actionType === 'raise' || chosenOption.actionType === 'allin') {
      const foldThreshold =
        state.villainArchetype === 'Nit' ? 0.36 : state.villainArchetype === 'Regular' ? 0.25 : 0.14;
      const villainFolds = chosenOption.actionType !== 'allin' && cryptoRandomFloat() < foldThreshold && activeCount === 1;

      if (villainFolds) {
        villainActionDesc = 'Fold ante tu agresión';
        finished = true;
        heroNetBB = Math.round((state.potBB - heroInvested) * 10) / 10;
        nextStreet = 'showdown';
        updatedSeats = updatedSeats.map(s => (!s.isHero && s.inHand ? { ...s, lastAction: 'Fold', inHand: false } : s));
      } else {
        // Check whether main villain Check-Raises / Raises Hero's bet
        const mainV = activeVillains[0];
        const vCards = mainV?.holeCards;
        const vStrength = vCards ? estimateHandStrengthCategory(vCards, state.boardCards) : null;
        const canRaise =
          chosenOption.actionType === 'bet' &&
          state.facingBetBB === 0 &&
          activeCount === 1 &&
          mainV &&
          mainV.stackBB > chosenOption.amountBB * 2.5 &&
          vStrength &&
          ((vStrength.tier === 'monster' && cryptoRandomFloat() < 0.55) ||
            (vStrength.tier === 'strong' && state.villainArchetype === 'Regular' && cryptoRandomFloat() < 0.25) ||
            (vStrength.tier === 'draw' && state.villainArchetype === 'Regular' && cryptoRandomFloat() < 0.22));

        if (canRaise && mainV) {
          const raiseTotal = Math.min(mainV.stackBB, Math.round(chosenOption.amountBB * 2.7 * 10) / 10);
          const raiseExtra = Math.max(1, Math.round((raiseTotal - chosenOption.amountBB) * 10) / 10);
          newPot += raiseTotal;
          nextFacingBet = raiseExtra;
          stayedForRaise = true;
          nextStreet = state.street;
          updatedSeats = updatedSeats.map(s =>
            s.pos === mainV.pos
              ? {
                  ...s,
                  stackBB: Math.max(0, Math.round((s.stackBB - raiseTotal) * 10) / 10),
                  committedBB: Math.round((s.committedBB + raiseTotal) * 10) / 10,
                  lastAction: `Check-Raise ${raiseTotal} BB`
                }
              : s
          );
          villainActionDesc = `¡${mainV.archetype} hace Check-Raise a ${raiseTotal} BB!`;
        } else {
          let callers = 0;
          updatedSeats = updatedSeats.map(s => {
            if (s.isHero || !s.inHand) return s;
            if (activeCount > 1 && callers >= 1 && cryptoRandomFloat() < 0.45) {
              return { ...s, inHand: false, lastAction: 'Fold' };
            }
            callers++;
            const callShare = Math.min(s.stackBB, chosenOption.amountBB);
            newPot += callShare;
            return {
              ...s,
              stackBB: Math.max(0, Math.round((s.stackBB - callShare) * 10) / 10),
              committedBB: Math.round((s.committedBB + callShare) * 10) / 10,
              lastAction: `Call ${callShare} BB`
            };
          });
          villainActionDesc = callers > 1 ? `${callers} rivales hacen Call` : `Call ${chosenOption.amountBB} BB`;
        }
      }
    } else {
      villainActionDesc = chosenOption.actionType === 'call' ? 'Call confirmado · Pasa a siguiente calle' : 'Check back';
      updatedSeats = updatedSeats.map(s => (!s.isHero && s.inHand ? { ...s, lastAction: 'Check / Call' } : s));
    }

    if (!finished && !stayedForRaise) {
      if (state.street === 'flop') {
        nextStreet = 'turn';
        nextBoard = state.fullRunout.slice(0, 4);
      } else if (state.street === 'turn') {
        nextStreet = 'river';
        nextBoard = state.fullRunout.slice(0, 5);
      } else {
        nextStreet = 'showdown';
        finished = true;
      }

      const { oopVillains } = resolvePositionalMatchup(state.heroPos, state.scenario);
      const oopLeadCandidate = updatedSeats.find(
        s => !s.isHero && s.inHand && s.stackBB > 3 && oopVillains.includes(s.pos)
      );
      if (!finished && oopLeadCandidate && cryptoRandomFloat() < 0.34) {
        const heroRemStack = updatedSeats.find(s => s.isHero)?.stackBB ?? 80;
        const vBet = Math.min(
          oopLeadCandidate.stackBB,
          heroRemStack,
          Math.max(1, Math.round(newPot * 0.45 * 10) / 10)
        );
        if (vBet > 0) {
          nextFacingBet = vBet;
          newPot += vBet;
          updatedSeats = updatedSeats.map(s =>
            s.pos === oopLeadCandidate.pos
              ? {
                  ...s,
                  stackBB: Math.max(0, Math.round((s.stackBB - vBet) * 10) / 10),
                  committedBB: Math.round((s.committedBB + vBet) * 10) / 10,
                  lastAction: `Bet ${vBet} BB`
                }
              : s
          );
          villainActionDesc += ` · ${oopLeadCandidate.pos} apuesta ${vBet} BB en ${nextStreet.toUpperCase()}`;
        }
      }
    }
  }

  newPot = Math.round(newPot * 10) / 10;
  let nextActions: SimActionOption[] = [];

  if (finished && nextStreet === 'showdown' && chosenOption.actionType !== 'fold') {
    const remainingSeats = updatedSeats.filter(s => s.inHand);
    if (remainingSeats.length > 1) {
      showdownSummary = resolveShowdown({ ...state, seats: updatedSeats, potBB: newPot });
      const heroWon = showdownSummary?.winners.includes(state.heroPos);
      const splitCount = showdownSummary?.winners.length || 1;
      heroNetBB = heroWon
        ? Math.round((newPot / splitCount - heroInvested) * 10) / 10
        : -Math.round(heroInvested * 10) / 10;
    }
  } else if (!finished && nextStreet !== 'showdown') {
    const activeVillainSeats = updatedSeats.filter(s => !s.isHero && s.inHand).length;
    const hStack = updatedSeats.find(s => s.isHero)?.stackBB ?? 80;
    nextActions = buildStreetDecisionNode(
      state.heroCards,
      nextBoard,
      newPot,
      nextFacingBet,
      hStack,
      state.scenario,
      state.villainArchetype,
      activeVillainSeats
    );
  }

  const step: StreetChronicleStep = {
    street: state.street === 'showdown' ? 'river' : state.street,
    heroAction: chosenOption.label,
    recommendedAction: recommended.label,
    villainAction: villainActionDesc,
    grade,
    evLossBB,
    potOddsPct,
    estimatedEquityPct: strength.equityPct,
    spr,
    explanationDummies,
    exploitativeNote,
    plainEnglishTip
  };

  const nextState: SimulatedHandState = {
    ...state,
    seats: updatedSeats,
    boardCards: nextBoard,
    street: nextStreet,
    potBB: newPot,
    facingBetBB: nextFacingBet,
    heroInvestedBB: Math.round(heroInvested * 10) / 10,
    actions: nextActions,
    chronicle: [...state.chronicle, step],
    isFinished: finished,
    heroNetBB,
    showdownSummary
  };

  const decisionRecord: LiveDecisionRecord = {
    id: `live-${Date.now()}-${cryptoRandomInt(10000)}`,
    timestamp: Date.now(),
    handNumber: state.handNumber,
    heroPos: state.heroPos,
    scenario: state.scenario,
    street: state.street === 'showdown' ? 'river' : state.street,
    chosenAction: chosenOption.label,
    bestAction: recommended.label,
    evLossBB,
    evLossPctPot,
    isOptimal: grade === 'optimal' || grade === 'acceptable',
    isBlunder: grade === 'blunder' || grade === 'mistake',
    vpipAction:
      chosenOption.actionType !== 'fold' &&
      (state.street !== 'preflop' || chosenOption.actionType === 'raise' || chosenOption.actionType === 'call' || chosenOption.actionType === 'allin'),
    pfrAction:
      chosenOption.actionType !== 'fold' &&
      (state.street === 'preflop'
        ? chosenOption.actionType === 'raise' || chosenOption.actionType === 'allin'
        : state.scenario === 'SRP_IP' ||
          state.scenario === '3BET_IP' ||
          state.scenario === '3BET_OOP' ||
          state.scenario === '4BET' ||
          state.scenario === 'SQUEEZE' ||
          state.scenario === 'ROL'),
    threeBetSpot:
      (state.scenario === '3BET_IP' || state.scenario === '3BET_OOP' || state.scenario === 'SQUEEZE') &&
      chosenOption.actionType !== 'fold',
    cbetOpportunity: state.street === 'flop' && state.facingBetBB === 0,
    cbetTaken: state.street === 'flop' && state.facingBetBB === 0 && (chosenOption.actionType === 'bet' || chosenOption.actionType === 'allin'),
    wentToShowdown: Boolean(showdownSummary),
    wonAtShowdown: Boolean(showdownSummary?.winners.includes(state.heroPos)),
    netBB: finished ? heroNetBB : 0
  };

  return { nextState, decisionRecord };
}
