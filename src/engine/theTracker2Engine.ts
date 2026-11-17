/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TheTracker2Engine: Motor propietario de tracking, análisis estadístico,
 * gráficos de rendimiento y Replayer calle-por-calle de Allin School.
 * - Hasta 3 bases de datos independientes aisladas por UID.
 * - Parser multi-formato (.txt, .xml, .json, .zip) con deduplicación exacta.
 * - 4 series estadísticas (Won BB, EV Adjusted, Showdown, Non-Showdown) con filtros dinámicos.
 * - Plantilla HUD personalizable (importar/exportar JSON) + Glosario educativo instantáneo.
 */

import JSZip from 'jszip';
import { readScopedItem, writeScopedItem } from '../lib/userStorage';
import { FULL_DECK, parseCard, type Card } from './cards';
import { compareHands } from './evaluator';
import type { TablePosition } from '../components/HandAndPositionBar';
import type { SimScenarioType } from './handSimulator';

export interface Tracker2ActionStep {
  stepIndex: number;
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  actor: string;
  isHero: boolean;
  actionType: 'post' | 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'allin' | 'deal' | 'collect';
  amountBB: number;
  potAfterBB: number;
  toCallBB: number;
  potOddsPct: number | null;
  boardSoFar: string;
  summary: string;
}

export interface ParsedHandRecord {
  id: string;
  handKey: string;
  site: 'PokerStars' | 'GGPoker' | 'Winamax' | 'LabDemo';
  timestamp: number;
  stakes: string;
  heroPos: TablePosition;
  scenario: SimScenarioType;
  potType: 'SRP' | '3Bet' | '4Bet' | 'Multiway';
  wentToShowdown: boolean;
  heroInvestedBB: number;
  netWonBB: number;
  evAdjustedBB: number;
  showdownBB: number;
  nonShowdownBB: number;
  vpip: boolean;
  pfr: boolean;
  threeBet: boolean;
  threeBetOpportunity?: boolean;
  foldToThreeBet: boolean | null;
  cbet: boolean | null;
  foldToCbet: boolean | null;
  wonAtShowdown: boolean;
  stealAttempt: boolean | null;
  bbFoldVsSteal: boolean | null;
  aggressiveActions: number;
  passiveCalls: number;
  heroCardsStr: string;
  villainCardsStr?: string;
  boardStr: string;
  actionSteps?: Tracker2ActionStep[];
}

export const POPULATION_BENCHMARKS = {
  NL10: { vpip: 23.5, pfr: 19.0, threeBet: 7.5, cbet: 58, bbFoldVsSteal: 56, wtsd: 27.5, wsd: 52.5, bbPer100: 5.5 },
  NL25: { vpip: 24.5, pfr: 20.5, threeBet: 8.8, cbet: 61, bbFoldVsSteal: 53, wtsd: 28.0, wsd: 53.0, bbPer100: 4.5 },
  'NL50+': { vpip: 25.5, pfr: 21.5, threeBet: 9.8, cbet: 63, bbFoldVsSteal: 50, wtsd: 28.5, wsd: 53.5, bbPer100: 3.8 }
} as const;

export interface Tracker2Database {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  hands: ParsedHandRecord[];
  importedFiles: string[];
}

export type Tracker2FilterKey =
  | 'ALL'
  | 'EP'
  | 'UTG'
  | 'MP'
  | 'CO'
  | 'BTN'
  | 'SB'
  | 'BB'
  | 'SRP'
  | '3BET'
  | '4BET'
  | 'MULTIWAY'
  | 'SHOWDOWN'
  | 'WINS'
  | 'LOSSES';

export interface Tracker2ChartPoint {
  handIndex: number;
  wonBB: number;
  evAdjustedBB: number;
  showdownBB: number;
  nonShowdownBB: number;
}

export interface Tracker2HudStatSummary {
  hands: number;
  vpip: number;
  pfr: number;
  threeBet: number;
  foldToThreeBet: number;
  cbet: number;
  foldToCbet: number;
  wtsd: number;
  wsd: number;
  af: number;
  steal: number;
  bbFoldVsSteal: number;
  rfi: number;
  netWonBB: number;
  evAdjustedBB: number;
  showdownWonBB: number;
  nonShowdownWonBB: number;
  bbPer100: number;
  evBbPer100: number;
  nashPrecisionPct: number;
}

export type HudStatKey =
  | 'vpip'
  | 'pfr'
  | 'threeBet'
  | 'foldToThreeBet'
  | 'cbet'
  | 'foldToCbet'
  | 'wtsd'
  | 'wsd'
  | 'af'
  | 'steal'
  | 'bbFoldVsSteal'
  | 'rfi';

export interface HudTemplateConfig {
  name: string;
  version: string;
  layoutRows: HudStatKey[][];
}

export const DEFAULT_HUD_TEMPLATE: HudTemplateConfig = {
  name: 'TheTracker2 6-Max Estándar',
  version: '2.0',
  layoutRows: [
    ['vpip', 'pfr', 'threeBet', 'af'],
    ['cbet', 'foldToCbet', 'foldToThreeBet', 'rfi'],
    ['wtsd', 'wsd', 'steal', 'bbFoldVsSteal']
  ]
};

export const HUD_PRESETS: HudTemplateConfig[] = [
  DEFAULT_HUD_TEMPLATE,
  {
    name: 'Explotativo Niveles Bajos (Preflop + Robo)',
    version: '2.0',
    layoutRows: [
      ['vpip', 'pfr', 'rfi', 'steal'],
      ['threeBet', 'foldToThreeBet', 'bbFoldVsSteal', 'cbet']
    ]
  },
  {
    name: 'Postflop Showdown & Línea Roja',
    version: '2.0',
    layoutRows: [
      ['cbet', 'foldToCbet', 'af', 'wtsd'],
      ['wsd', 'vpip', 'pfr', 'threeBet']
    ]
  }
];

export interface HudStatGlossaryItem {
  key: HudStatKey;
  shortCode: string;
  label: string;
  formula: string;
  optimalRange: string;
  simpleExplanation: string;
  tooHighFix: string;
  tooLowFix: string;
}

export const HUD_STAT_GLOSSARY: Record<HudStatKey, HudStatGlossaryItem> = {
  vpip: {
    key: 'vpip',
    shortCode: 'VPIP',
    label: 'Voluntarily Put Money In Pot',
    formula: 'Manos donde pones fichas preflop sin obligación ÷ Total manos',
    optimalRange: '21% – 27% (6-Max)',
    simpleExplanation: 'Mide qué tan selectivo eres entrando a botes. Es la métrica base para distinguir juego sólido de excesiva soltura.',
    tooHighFix: 'Estás jugando demasiadas manos débiles fuera de posición; cierra tus calls en SB/MP.',
    tooLowFix: 'Juegas muy predecible; abre más suited connectors y broadways desde CO/BTN.'
  },
  pfr: {
    key: 'pfr',
    shortCode: 'PFR',
    label: 'Pre-Flop Raise',
    formula: 'Subidas/3-Bets preflop ÷ Total manos',
    optimalRange: '17% – 23% (Gap ≤ 5% vs VPIP)',
    simpleExplanation: 'Indica con qué frecuencia entras al bote con iniciativa (subiendo en vez de solo pagar).',
    tooHighFix: 'Estrecha tus 3-bets especulativos fuera de posición.',
    tooLowFix: 'Si VPIP - PFR > 7%, estás haciendo demasiado cold-call pasivo en vez de tomar la iniciativa.'
  },
  threeBet: {
    key: 'threeBet',
    shortCode: '3B',
    label: '3-Bet Preflop',
    formula: 'Re-subidas tras un Open Raise ÷ Oportunidades de 3-Bet',
    optimalRange: '7% – 10.5%',
    simpleExplanation: 'Mide tu agresividad preflop para aislar abridores y castigar robos desde BTN/CO.',
    tooHighFix: 'Evita 3-betear manos dominadas contra aperturas tempranas de UTG.',
    tooLowFix: 'Incorpora 3-bets estratégicos con bloqueadores (A5s, KTs) frente a robos de BTN/CO.'
  },
  foldToThreeBet: {
    key: 'foldToThreeBet',
    shortCode: 'F3B',
    label: 'Fold to 3-Bet',
    formula: 'Veces que foldeas cuando te 3-betean ÷ Veces enfrentado a 3-Bet',
    optimalRange: '48% – 58%',
    simpleExplanation: 'Si foldeas más de 65% ante 3-bets, los regulares te explotarán re-subiéndote con cualquier par de cartas.',
    tooHighFix: 'Defiende más en posición (pares medios y suited broadways) o 4-betea con bloqueadores.',
    tooLowFix: 'Estás pagando 3-bets OOP con manos dominadas (KTo, QJo).'
  },
  cbet: {
    key: 'cbet',
    shortCode: 'CB',
    label: 'Continuation Bet Flop',
    formula: 'Apuestas en flop siendo el agresor preflop ÷ Oportunidades C-Bet',
    optimalRange: '54% – 68%',
    simpleExplanation: 'Frecuencia con la que continúas apostando en el flop tras haber subido preflop.',
    tooHighFix: 'En boards muy conectados o multiway, aplica check-control con manos medias y aire sin equity.',
    tooLowFix: 'Apuesta 33% del bote con alta frecuencia en boards secos altos (A-x-x, K-7-2).'
  },
  foldToCbet: {
    key: 'foldToCbet',
    shortCode: 'FCB',
    label: 'Fold to Flop C-Bet',
    formula: 'Folds frente a C-Bet en flop ÷ Veces que enfrentas C-Bet',
    optimalRange: '38% – 48%',
    simpleExplanation: 'Mide cuánto te dejas robar los botes en el flop cuando defiendes tu ciega.',
    tooHighFix: 'Flota más en posición con backdoor flush/straight draws y overcards fuertes.',
    tooLowFix: 'Estás haciendo demasiados calls sin plan en turn/river.'
  },
  wtsd: {
    key: 'wtsd',
    shortCode: 'WTSD',
    label: 'Went to Showdown',
    formula: 'Manos que llegan al showdown ÷ Manos que vieron el flop',
    optimalRange: '25% – 30%',
    simpleExplanation: 'Porcentaje de flops vistos que terminan enseñando cartas al final. Clave para detectar hero-calls excesivos.',
    tooHighFix: 'Estás pagando triples barriles en river con Top Pair débil frente a rangos polarizados.',
    tooLowFix: 'Te están tirando de manos legítimas con apuestas pequeñas en turn.'
  },
  wsd: {
    key: 'wsd',
    shortCode: 'W$SD',
    label: 'Won Money at Showdown',
    formula: 'Showdowns ganados ÷ Total de Showdowns alcanzados',
    optimalRange: '51% – 56%',
    simpleExplanation: 'Indica qué tan fuerte es tu selección de manos cuando llegas hasta el final.',
    tooHighFix: 'Si supera 60% con WTSD < 22%, estás foldeando demasiado por precaución.',
    tooLowFix: 'Filtra tus calls en river contra perfiles muy pasivos.'
  },
  af: {
    key: 'af',
    shortCode: 'AF',
    label: 'Aggression Factor Postflop',
    formula: '(Apuestas + Subidas Postflop) ÷ Calls Postflop',
    optimalRange: '2.2 – 3.5',
    simpleExplanation: 'Relación entre acciones agresivas y pasivas después del flop. Valores < 1.5 revelan juego pasivo.',
    tooHighFix: 'Controla tus semi-faroles sin equity en river contra jugadores que nunca foldean.',
    tooLowFix: 'Sube con tus monstruos y combos fuertes en vez de solo hacer slowplay pasivo.'
  },
  steal: {
    key: 'steal',
    shortCode: 'STEAL',
    label: 'Attempt to Steal (CO/BTN/SB)',
    formula: 'Open raises desde CO, BTN o SB cuando llega limpio ÷ Oportunidades',
    optimalRange: '34% – 44%',
    simpleExplanation: 'Frecuencia con la que intentas robar las ciegas desde posiciones tardías.',
    tooHighFix: 'Cierra un poco el rango de SB contra ciegas grandes agresivas.',
    tooLowFix: 'Estás dejando dinero muerto en las ciegas al no abrir BTN/CO con suficiencia.'
  },
  bbFoldVsSteal: {
    key: 'bbFoldVsSteal',
    shortCode: 'BBFvS',
    label: 'BB Fold vs Steal',
    formula: 'Folds en Big Blind ante robo de CO/BTN/SB ÷ Oportunidades',
    optimalRange: '48% – 58%',
    simpleExplanation: 'Si foldeas >65% en BB contra robos de BTN, estás perdiendo valor automáticamente por las ciegas pagadas.',
    tooHighFix: 'Defiende 3-bet o call con suited gappers y broadways aprovechando tus pot odds.',
    tooLowFix: 'No sobre-defiendas manos offsuit sin jugabilidad (K4o, J6o) ante sizings grandes.'
  },
  rfi: {
    key: 'rfi',
    shortCode: 'RFI',
    label: 'Raise First In',
    formula: 'Subidas siendo el primer jugador voluntario ÷ Oportunidades limpio',
    optimalRange: '19% – 26%',
    simpleExplanation: 'Porcentaje global de manos con las que abres cuando nadie ha entrado antes que tú.',
    tooHighFix: 'Respeta tus rangos estrictos desde UTG y MP.',
    tooLowFix: 'Aprovecha la posición en CO y BTN para sumar fichas sin showdown.'
  }
};

const TRACKER2_DBS_KEY = 'allin_tracker2_databases_v1';
const TRACKER2_ACTIVE_DB_KEY = 'allin_tracker2_active_db_v1';
const TRACKER2_HUD_TEMPLATE_KEY = 'allin_tracker2_hud_template_v1';

// Legacy storage keys checked strictly for seamless one-time profile migration
const LEGACY_DBS_KEY = 'gto_pt4_databases_v1';
const LEGACY_ACTIVE_DB_KEY = 'gto_pt4_active_db_v1';
const LEGACY_HUD_TEMPLATE_KEY = 'gto_pt4_hud_template_v1';

export const MAX_TRACKER2_DATABASES = 3;

export function loadTracker2Databases(): Tracker2Database[] {
  try {
    const raw = readScopedItem(TRACKER2_DBS_KEY) ?? readScopedItem(LEGACY_DBS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Tracker2Database[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (!readScopedItem(TRACKER2_DBS_KEY)) {
          writeScopedItem(TRACKER2_DBS_KEY, raw);
        }
        return parsed.slice(0, MAX_TRACKER2_DATABASES);
      }
    }
  } catch {
    // ignore
  }
  const initial: Tracker2Database = {
    id: 'db-principal',
    name: 'Base Principal 6-Max',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    hands: [],
    importedFiles: []
  };
  saveTracker2Databases([initial]);
  return [initial];
}

export function saveTracker2Databases(dbs: Tracker2Database[]): void {
  try {
    writeScopedItem(TRACKER2_DBS_KEY, JSON.stringify(dbs.slice(0, MAX_TRACKER2_DATABASES)));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lab-pro-sync-needed'));
    }
  } catch {
    // ignore storage quota errors cleanly
  }
}

export function getActiveTracker2DatabaseId(): string {
  return readScopedItem(TRACKER2_ACTIVE_DB_KEY) || readScopedItem(LEGACY_ACTIVE_DB_KEY) || 'db-principal';
}

export function setActiveTracker2DatabaseId(id: string): void {
  writeScopedItem(TRACKER2_ACTIVE_DB_KEY, id);
}

export function loadSavedHudTemplate(): HudTemplateConfig {
  try {
    const raw = readScopedItem(TRACKER2_HUD_TEMPLATE_KEY) ?? readScopedItem(LEGACY_HUD_TEMPLATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as HudTemplateConfig;
      if (parsed && Array.isArray(parsed.layoutRows) && parsed.layoutRows.length > 0) {
        return parsed;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_HUD_TEMPLATE;
}

export function saveHudTemplate(tpl: HudTemplateConfig): void {
  writeScopedItem(TRACKER2_HUD_TEMPLATE_KEY, JSON.stringify(tpl));
}

export function parseHudTemplateJson(jsonText: string): HudTemplateConfig {
  const parsed = JSON.parse(jsonText) as Partial<HudTemplateConfig>;
  if (!parsed || !Array.isArray(parsed.layoutRows)) {
    throw new Error('La plantilla JSON debe incluir "layoutRows" con códigos HUD válidos de TheTracker2.');
  }
  const validKeys = new Set<string>(Object.keys(HUD_STAT_GLOSSARY));
  const cleanRows = parsed.layoutRows
    .map(row => (Array.isArray(row) ? row.filter((k): k is HudStatKey => typeof k === 'string' && validKeys.has(k)) : []))
    .filter(row => row.length > 0);
  if (cleanRows.length === 0) {
    throw new Error('No se encontraron stats HUD reconocidos en "layoutRows".');
  }
  return {
    name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim().slice(0, 60) : 'HUD Importado TheTracker2',
    version: typeof parsed.version === 'string' ? parsed.version.slice(0, 16) : '2.0',
    layoutRows: cleanRows
  };
}

function inferPositionFromBlock(block: string, heroName = 'Hero'): TablePosition {
  if (/button|seat.*BTN|\(BTN\)/i.test(block) && new RegExp(`${heroName}.*\\(BTN\\)`, 'i').test(block)) return 'BTN';
  if (new RegExp(`${heroName}.*\\(SB\\)`, 'i').test(block)) return 'SB';
  if (new RegExp(`${heroName}.*\\(BB\\)`, 'i').test(block)) return 'BB';
  if (new RegExp(`${heroName}.*\\(CO\\)`, 'i').test(block)) return 'CO';
  if (new RegExp(`${heroName}.*\\((MP|HJ)\\)`, 'i').test(block)) return 'MP';
  if (new RegExp(`${heroName}.*\\((UTG|EP)\\)`, 'i').test(block)) return 'EP';

  const btnSeatM = block.match(/Seat\s+#?(\d+)\s+is the button/i);
  const seatLines = Array.from(block.matchAll(/Seat\s+(\d+):\s+([^\(\r\n]+?)\s+\(/gi));
  if (btnSeatM && seatLines.length >= 2) {
    const btnSeat = parseInt(btnSeatM[1], 10);
    const seats = seatLines.map(m => ({ seat: parseInt(m[1], 10), name: m[2].trim() })).sort((a, b) => a.seat - b.seat);
    const btnIdx = seats.findIndex(s => s.seat === btnSeat);
    const heroIdx = seats.findIndex(s => s.name.toLowerCase() === heroName.toLowerCase());
    if (btnIdx >= 0 && heroIdx >= 0) {
      const n = seats.length;
      const offsetFromBtn = (heroIdx - btnIdx + n) % n;
      if (offsetFromBtn === 0) return 'BTN';
      if (n === 2) return 'BB';
      if (offsetFromBtn === 1) return 'SB';
      if (offsetFromBtn === 2) return 'BB';
      const remaining = n - offsetFromBtn;
      if (remaining === 1) return 'CO';
      if (remaining === 2 && n >= 5) return 'MP';
      return 'EP';
    }
  }

  if (/\(BTN\)/i.test(block)) return 'BTN';
  if (/\(SB\)/i.test(block)) return 'SB';
  if (/\(BB\)/i.test(block)) return 'BB';
  if (/\(CO\)/i.test(block)) return 'CO';
  if (/UTG\+1|\(MP\)|hijack/i.test(block)) return 'MP';
  if (/\(UTG\)|\(EP\)/i.test(block)) return 'EP';
  return 'BTN';
}

function inferMoneyBB(text: string): { bbUnit: number; stakes: string } {
  const m = text.match(/(?:[$€£]|USD|EUR)?\s*([0-9]+(?:\.[0-9]+)?)\s*\/\s*(?:[$€£]|USD|EUR)?\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (m) {
    const bb = parseFloat(m[2]);
    if (Number.isFinite(bb) && bb > 0) {
      const sym = text.includes('€') ? '€' : text.includes('£') ? '£' : bb >= 10 ? '' : '$';
      return { bbUnit: bb, stakes: `${sym}${m[1]}/${sym}${m[2]}` };
    }
  }
  return { bbUnit: 0.1, stakes: 'NL10' };
}

function parseTokenCards(cardStr: string): Card[] {
  const tokens = cardStr.trim().split(/\s+/).filter(Boolean);
  const out: Card[] = [];
  for (const tok of tokens) {
    try {
      if (tok.length === 2) out.push(parseCard(tok));
      else if (tok.length === 4) {
        out.push(parseCard(tok.slice(0, 2)), parseCard(tok.slice(2, 4)));
      }
    } catch {
      // ignore unparseable card token
    }
  }
  return out;
}

function computeShowdownAllInEV(
  heroCardsStr: string,
  villainCardsStr: string | undefined,
  boardStr: string,
  netWonBB: number,
  heroInvestedBB: number
): number {
  if (!villainCardsStr) return netWonBB;
  const hCards = parseTokenCards(heroCardsStr);
  const vCards = parseTokenCards(villainCardsStr);
  const bCards = parseTokenCards(boardStr);
  if (hCards.length !== 2 || vCards.length !== 2 || bCards.length < 3) return netWonBB;

  try {
    const usedIds = new Set([...hCards, ...vCards, ...bCards].map(c => c.id));
    let wins = 0;
    let ties = 0;
    let samples = 0;

    if (bCards.length >= 5) {
      const cmp = compareHands(hCards, vCards, bCards.slice(0, 5));
      wins = cmp > 0 ? 1 : 0;
      ties = cmp === 0 ? 1 : 0;
      samples = 1;
    } else {
      const remaining = FULL_DECK.filter(c => !usedIds.has(c.id));
      if (bCards.length === 4) {
        for (let i = 0; i < remaining.length; i++) {
          const cmp = compareHands(hCards, vCards, [...bCards, remaining[i]]);
          if (cmp > 0) wins++;
          else if (cmp === 0) ties++;
          samples++;
        }
      } else {
        const n = remaining.length;
        const maxFlopSamples = 100;
        const seenPairs = new Set<string>();
        for (let k = 0; k < n * n && samples < maxFlopSamples; k++) {
          const i = (k * 7) % n;
          const stepOffset = 1 + (Math.floor(k / n) * 5) % (n - 1);
          const j = (i + stepOffset + 11) % n;
          if (i === j) continue;
          const a = Math.min(i, j);
          const b = Math.max(i, j);
          const key = `${a}:${b}`;
          if (seenPairs.has(key)) continue;
          seenPairs.add(key);
          const cmp = compareHands(hCards, vCards, [...bCards, remaining[a], remaining[b]]);
          if (cmp > 0) wins++;
          else if (cmp === 0) ties++;
          samples++;
        }
      }
    }

    if (samples === 0) return netWonBB;
    const equity = (wins + ties * 0.5) / samples;
    const estimatedPot = Math.max(heroInvestedBB * 2, netWonBB > 0 ? netWonBB + heroInvestedBB : heroInvestedBB * 2);
    return Math.round((equity * estimatedPot - heroInvestedBB) * 10) / 10;
  } catch {
    return netWonBB;
  }
}

export function parseHandHistoriesText(rawText: string, sourceName = 'session.txt'): ParsedHandRecord[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.hands) ? parsed.hands : [];
      if (arr.length > 0) {
        return arr.map((item: Record<string, unknown>, idx: number): ParsedHandRecord => {
          const handKey = String(item.handKey || item.id || `json-${sourceName}-${idx}`);
          const netWonBB = Number(item.netWonBB ?? item.netBB ?? 0);
          const evAdjustedBB = Number(item.evAdjustedBB ?? netWonBB);
          const wentToShowdown = Boolean(item.wentToShowdown);
          return {
            id: `hh-${handKey}`,
            handKey,
            site: 'LabDemo',
            timestamp: Number(item.timestamp || Date.now() - idx * 1000),
            stakes: String(item.stakes || 'NL10'),
            heroPos: (['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'].includes(String(item.heroPos))
              ? String(item.heroPos)
              : 'BTN') as TablePosition,
            scenario: (item.scenario as SimScenarioType) || 'SRP_IP',
            potType: item.potType === '3Bet' || item.potType === '4Bet' || item.potType === 'Multiway' ? item.potType : 'SRP',
            wentToShowdown,
            heroInvestedBB: Number(item.heroInvestedBB || 5),
            netWonBB,
            evAdjustedBB,
            showdownBB: wentToShowdown ? netWonBB : 0,
            nonShowdownBB: wentToShowdown ? 0 : netWonBB,
            vpip: typeof item.vpip === 'boolean' ? item.vpip : true,
            pfr: typeof item.pfr === 'boolean' ? item.pfr : true,
            threeBet: Boolean(item.threeBet),
            foldToThreeBet: typeof item.foldToThreeBet === 'boolean' ? item.foldToThreeBet : null,
            cbet: typeof item.cbet === 'boolean' ? item.cbet : null,
            foldToCbet: typeof item.foldToCbet === 'boolean' ? item.foldToCbet : null,
            wonAtShowdown: Boolean(item.wonAtShowdown ?? (wentToShowdown && netWonBB > 0)),
            stealAttempt: typeof item.stealAttempt === 'boolean' ? item.stealAttempt : null,
            bbFoldVsSteal: typeof item.bbFoldVsSteal === 'boolean' ? item.bbFoldVsSteal : null,
            aggressiveActions: Number(item.aggressiveActions || 1),
            passiveCalls: Number(item.passiveCalls || 0),
            heroCardsStr: String(item.heroCardsStr || 'AsKd'),
            boardStr: String(item.boardStr || 'Ah7d2c'),
            actionSteps: Array.isArray(item.actionSteps) ? (item.actionSteps as Tracker2ActionStep[]) : undefined
          };
        });
      }
    } catch {
      // fall through
    }
  }

  // XML hand history export format support
  if (trimmed.startsWith('<')) {
    const handNodes = trimmed.match(/<(?:hand|HandHistory|game)[\s\S]*?<\/(?:hand|HandHistory|game)>/gi) || [];
    if (handNodes.length > 0) {
      return handNodes.map((node, idx): ParsedHandRecord => {
        const keyM = node.match(/(?:id|hand_no|handNumber)=["']?([A-Za-z0-9_-]+)["']?/i);
        const handKey = keyM ? keyM[1] : `xml-${sourceName}-${idx}`;
        const heroPos = inferPositionFromBlock(node);
        const netM = node.match(/(?:netWonBB|won|amount)=["']?(-?[0-9]+(?:\.[0-9]+)?)["']?/i);
        const netWonBB = netM ? Math.round(parseFloat(netM[1]) * 10) / 10 : 0;
        const wentToShowdown = /showdown/i.test(node);
        const vpip = /vpip=["']?true["']?|call|raise/i.test(node);
        const pfr = /pfr=["']?true["']?|raise/i.test(node);
        return {
          id: `hh-${handKey}`,
          handKey,
          site: 'PokerStars',
          timestamp: Date.now() - (handNodes.length - idx) * 30000,
          stakes: 'NL10 XML',
          heroPos,
          scenario: heroPos === 'BTN' || heroPos === 'CO' ? 'SRP_IP' : 'SRP_OOP',
          potType: /3bet/i.test(node) ? '3Bet' : /4bet/i.test(node) ? '4Bet' : 'SRP',
          wentToShowdown,
          heroInvestedBB: Math.max(1, Math.abs(netWonBB) + 2),
          netWonBB,
          evAdjustedBB: netWonBB,
          showdownBB: wentToShowdown ? netWonBB : 0,
          nonShowdownBB: wentToShowdown ? 0 : netWonBB,
          vpip,
          pfr,
          threeBet: /3bet/i.test(node),
          foldToThreeBet: null,
          cbet: /cbet/i.test(node) ? true : null,
          foldToCbet: null,
          wonAtShowdown: wentToShowdown && netWonBB > 0,
          stealAttempt: heroPos === 'CO' || heroPos === 'BTN' || heroPos === 'SB' ? pfr : null,
          bbFoldVsSteal: heroPos === 'BB' ? !vpip : null,
          aggressiveActions: pfr ? 2 : 0,
          passiveCalls: vpip && !pfr ? 1 : 0,
          heroCardsStr: 'AsKd',
          boardStr: 'Ah 7d 2c'
        };
      });
    }
  }

  // Standard online room hand delimiters (TXT / ZIP archive files)
  const blocks = trimmed
    .split(/(?=PokerStars Hand #|PokerStars Game #|Poker Hand #[A-Z0-9]+|Winamax Poker -|Hand #)/i)
    .map(b => b.trim())
    .filter(b => b.length > 35);

  const results: ParsedHandRecord[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const idMatch = b.match(/#([A-Z0-9\-]+)/i);
    const handKey = idMatch ? idMatch[1] : `${sourceName}-${i}-${b.slice(0, 32).replace(/\s+/g, '')}`;
    const site: ParsedHandRecord['site'] = /PokerStars/i.test(b)
      ? 'PokerStars'
      : /Poker Hand #|GGPoker|PokerCraft/i.test(b)
      ? 'GGPoker'
      : /Winamax/i.test(b)
      ? 'Winamax'
      : 'LabDemo';

    const { bbUnit, stakes } = inferMoneyBB(b);
    const heroMatch = b.match(/Dealt to\s+([^\[\r\n]+)\s*\[([^\]]+)\]/i);
    const heroName = heroMatch ? heroMatch[1].trim() : 'Hero';
    const heroCardsStr = heroMatch ? heroMatch[2].trim() : '?? ??';
    const boardMatch = b.match(/Board\s*\[([^\]]+)\]/i);
    const boardStr = boardMatch ? boardMatch[1].trim() : '';

    const escapedHero = heroName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const villainShowM = b.match(new RegExp(`^(?!${escapedHero}:).*shows\\s+\\[([^\\]]+)\\]`, 'im'));
    const villainCardsStr = villainShowM ? villainShowM[1].trim() : undefined;

    const heroPos = inferPositionFromBlock(b, heroName);

    const preflopEndIdx = b.indexOf('*** FLOP ***');
    const preflopChunk = preflopEndIdx > 0 ? b.slice(0, preflopEndIdx) : b;
    const preflopAllLines = preflopChunk.split(/\r?\n/);
    const heroLower = heroName.toLowerCase();
    const isHeroActionLine = (line: string) =>
      line.trim().toLowerCase().startsWith(`${heroLower}:`) || line.toLowerCase().includes(heroLower);

    const heroFirstPreIdx = preflopAllLines.findIndex(l => isHeroActionLine(l) && !/posts/i.test(l));
    const linesBeforeHero = heroFirstPreIdx >= 0 ? preflopAllLines.slice(0, heroFirstPreIdx) : preflopAllLines;
    const threeBetOpportunity = linesBeforeHero.some(l => /:\s*raises/i.test(l) && !isHeroActionLine(l));

    const preflopHeroLines = preflopAllLines.filter(isHeroActionLine);
    const raisedPreflop = preflopHeroLines.some(l => /:\s*(?:raises|bets)/i.test(l));
    const calledPreflop = preflopHeroLines.some(l => /:\s*calls/i.test(l) && !/posts small|posts big/i.test(l));
    const vpip = raisedPreflop || calledPreflop;
    const pfr = raisedPreflop;

    let raisesSeenPreflop = 0;
    let heroThreeBet = false;
    let heroFacedThreeBet = false;
    let heroFoldedToThreeBet = false;
    let heroHasRaisedPre = false;
    for (const line of preflopAllLines) {
      const byHero = isHeroActionLine(line);
      if (/:\s*raises/i.test(line)) {
        if (byHero) {
          if (raisesSeenPreflop >= 1) heroThreeBet = true;
          heroHasRaisedPre = true;
        } else if (heroHasRaisedPre) {
          heroFacedThreeBet = true;
        }
        raisesSeenPreflop++;
      } else if (byHero && heroFacedThreeBet && /:\s*folds/i.test(line)) {
        heroFoldedToThreeBet = true;
      }
    }

    const raiseCountPreflop = raisesSeenPreflop || (preflopChunk.match(/raises/gi) || []).length;
    const threeBet = heroThreeBet;
    const potType: ParsedHandRecord['potType'] =
      raiseCountPreflop >= 3
        ? '4Bet'
        : raiseCountPreflop === 2
        ? '3Bet'
        : /\*\*\* FLOP \*\*\*/i.test(b) && (b.match(/calls/gi) || []).length >= 2
        ? 'Multiway'
        : 'SRP';

    const wentToShowdown = /\*\*\* SHOW ?DOWN \*\*\*/i.test(b);
    const wonMatch = b.match(new RegExp(`${escapedHero}\\s+(?:collected|won)\\s+(?:[$€£])?([0-9]+(?:\\.[0-9]+)?)`, 'i'));
    const collectedAmt = wonMatch ? parseFloat(wonMatch[1]) : 0;

    let investedAmt = 0;
    let streetHeroCommitted = 0;
    for (const rawLine of b.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (/^\*\*\* (?:FLOP|TURN|RIVER) \*\*\*/i.test(line)) {
        streetHeroCommitted = 0;
        continue;
      }
      if (/^\*\*\* SHOW ?DOWN|^\*\*\* SUMMARY/i.test(line)) break;
      if (!isHeroActionLine(line)) continue;
      const postMatch = line.match(/posts (?:small|big) blind\s+(?:[$€£])?([0-9]+(?:\.[0-9]+)?)/i);
      if (postMatch) {
        const amt = parseFloat(postMatch[1]) || 0;
        investedAmt += amt;
        streetHeroCommitted += amt;
        continue;
      }
      const raiseMatch = line.match(/raises\s+(?:[$€£])?[0-9]+(?:\.[0-9]+)?\s+to\s+(?:[$€£])?([0-9]+(?:\.[0-9]+)?)/i);
      if (raiseMatch) {
        const toAmt = parseFloat(raiseMatch[1]) || 0;
        const delta = Math.max(0, toAmt - streetHeroCommitted);
        investedAmt += delta;
        streetHeroCommitted += delta;
        continue;
      }
      const callOrBetMatch = line.match(/(?:calls|bets)\s+(?:[$€£])?([0-9]+(?:\.[0-9]+)?)/i);
      if (callOrBetMatch) {
        const amt = parseFloat(callOrBetMatch[1]) || 0;
        investedAmt += amt;
        streetHeroCommitted += amt;
      }
    }
    const returnedMatch = b.match(new RegExp(`Uncalled bet \\((?:[$€£])?([0-9]+(?:\\.[0-9]+)?)\\) returned to ${escapedHero}`, 'i'));
    if (returnedMatch) {
      investedAmt = Math.max(0, investedAmt - (parseFloat(returnedMatch[1]) || 0));
    }

    const heroInvestedBB = Math.round((investedAmt / bbUnit) * 10) / 10;
    const netWonBB = Math.round(((collectedAmt - investedAmt) / bbUnit) * 10) / 10;
    const evAdjustedBB = wentToShowdown && villainCardsStr
      ? computeShowdownAllInEV(heroCardsStr, villainCardsStr, boardStr, netWonBB, heroInvestedBB)
      : netWonBB;

    const postflopChunk = preflopEndIdx > 0 ? b.slice(preflopEndIdx) : '';
    const postflopHeroLines = postflopChunk.split(/\r?\n/).filter(isHeroActionLine);
    const aggressiveActions = postflopHeroLines.filter(l => /:\s*(?:bets|raises)/i.test(l)).length;
    const passiveCalls = postflopHeroLines.filter(l => /:\s*calls/i.test(l)).length;
    const flopChunk = postflopChunk.split('*** TURN ***')[0] || '';
    const flopLines = flopChunk.split(/\r?\n/);

    let betSeenOnFlop = false;
    let heroCbet: boolean | null = null;
    let heroFacedFlopBet = false;
    let heroFoldedFlop = false;
    for (const fl of flopLines) {
      const byHero = isHeroActionLine(fl);
      if (/:\s*bets/i.test(fl)) {
        if (byHero && !betSeenOnFlop) heroCbet = true;
        else if (!byHero) heroFacedFlopBet = true;
        betSeenOnFlop = true;
      } else if (byHero && /:\s*checks/i.test(fl) && !betSeenOnFlop && heroCbet === null) {
        heroCbet = false;
      } else if (byHero && heroFacedFlopBet && /:\s*folds/i.test(fl)) {
        heroFoldedFlop = true;
      }
    }
    const cbetOpp = pfr && flopChunk.length > 0;
    const cbet = cbetOpp ? Boolean(heroCbet) : null;
    const foldToCbet = !pfr && flopChunk.length > 0 && heroFacedFlopBet ? heroFoldedFlop : null;

    const scenario: SimScenarioType =
      potType === '4Bet'
        ? '4BET'
        : potType === '3Bet'
        ? heroPos === 'BTN' || heroPos === 'CO'
          ? '3BET_IP'
          : '3BET_OOP'
        : potType === 'Multiway'
        ? 'MULTIWAY'
        : heroPos === 'BTN' || heroPos === 'CO'
        ? 'SRP_IP'
        : 'SRP_OOP';

    const actionSteps = parseActionStepsFromBlock(b, heroName, bbUnit, boardStr);

    results.push({
      id: `hh-${handKey}`,
      handKey,
      site,
      timestamp: Date.now() - (blocks.length - i) * 35000,
      stakes,
      heroPos,
      scenario,
      potType,
      wentToShowdown,
      heroInvestedBB,
      netWonBB,
      evAdjustedBB,
      showdownBB: wentToShowdown ? netWonBB : 0,
      nonShowdownBB: wentToShowdown ? 0 : netWonBB,
      vpip,
      pfr,
      threeBet,
      threeBetOpportunity,
      foldToThreeBet: heroFacedThreeBet ? heroFoldedToThreeBet : null,
      cbet,
      foldToCbet,
      wonAtShowdown: wentToShowdown && netWonBB > 0,
      stealAttempt: heroPos === 'CO' || heroPos === 'BTN' || heroPos === 'SB' ? pfr : null,
      bbFoldVsSteal: heroPos === 'BB' ? !vpip : null,
      aggressiveActions,
      passiveCalls,
      heroCardsStr,
      villainCardsStr,
      boardStr,
      actionSteps
    });
  }

  return results;
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function parseActionStepsFromBlock(
  block: string,
  heroName: string,
  bbUnit: number,
  fallbackBoardStr: string
): Tracker2ActionStep[] {
  const lines = block.split(/\r?\n/);
  const steps: Tracker2ActionStep[] = [];
  let street: Tracker2ActionStep['street'] = 'preflop';
  let boardCards: string[] = [];
  let potBB = 0;
  let currentMaxBetBB = 0;
  let committed: Record<string, number> = {};
  const heroLower = heroName.toLowerCase();

  const boardSoFar = () => boardCards.join(' ');
  const calcPotOdds = (toCallBB: number, currentPotBB: number): number | null => {
    if (toCallBB <= 0) return null;
    const denom = currentPotBB + toCallBB;
    if (denom <= 0) return null;
    return Math.round((toCallBB / denom) * 1000) / 10;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const flopM = line.match(/^\*\*\*\s*FLOP\s*\*\*\*\s*\[([^\]]+)\]/i);
    if (flopM) {
      street = 'flop';
      boardCards = flopM[1].trim().split(/\s+/).filter(Boolean);
      committed = {};
      currentMaxBetBB = 0;
      steps.push({
        stepIndex: steps.length,
        street: 'flop',
        actor: 'Mesa',
        isHero: false,
        actionType: 'deal',
        amountBB: 0,
        potAfterBB: round1(potBB),
        toCallBB: 0,
        potOddsPct: null,
        boardSoFar: boardSoFar(),
        summary: `Se reparte Flop [${boardSoFar()}] · Bote ${round1(potBB)} BB`
      });
      continue;
    }

    const turnM = line.match(/^\*\*\*\s*TURN\s*\*\*\*\s*\[([^\]]+)\](?:\s*\[([^\]]+)\])?/i);
    if (turnM) {
      street = 'turn';
      const base = turnM[1].trim().split(/\s+/).filter(Boolean);
      const extra = turnM[2] ? turnM[2].trim().split(/\s+/).filter(Boolean) : [];
      boardCards = extra.length > 0 ? [...base, ...extra] : base;
      committed = {};
      currentMaxBetBB = 0;
      steps.push({
        stepIndex: steps.length,
        street: 'turn',
        actor: 'Mesa',
        isHero: false,
        actionType: 'deal',
        amountBB: 0,
        potAfterBB: round1(potBB),
        toCallBB: 0,
        potOddsPct: null,
        boardSoFar: boardSoFar(),
        summary: `Se reparte Turn [${boardSoFar()}] · Bote ${round1(potBB)} BB`
      });
      continue;
    }

    const riverM = line.match(/^\*\*\*\s*RIVER\s*\*\*\*\s*\[([^\]]+)\](?:\s*\[([^\]]+)\])?/i);
    if (riverM) {
      street = 'river';
      const base = riverM[1].trim().split(/\s+/).filter(Boolean);
      const extra = riverM[2] ? riverM[2].trim().split(/\s+/).filter(Boolean) : [];
      boardCards = extra.length > 0 ? [...base, ...extra] : base;
      committed = {};
      currentMaxBetBB = 0;
      steps.push({
        stepIndex: steps.length,
        street: 'river',
        actor: 'Mesa',
        isHero: false,
        actionType: 'deal',
        amountBB: 0,
        potAfterBB: round1(potBB),
        toCallBB: 0,
        potOddsPct: null,
        boardSoFar: boardSoFar(),
        summary: `Se reparte River [${boardSoFar()}] · Bote ${round1(potBB)} BB`
      });
      continue;
    }

    if (/^\*\*\*\s*SHOW ?DOWN\s*\*\*\*/i.test(line)) {
      street = 'showdown';
      if (boardCards.length === 0 && fallbackBoardStr) {
        boardCards = fallbackBoardStr.trim().split(/\s+/).filter(Boolean);
      }
      committed = {};
      currentMaxBetBB = 0;
      steps.push({
        stepIndex: steps.length,
        street: 'showdown',
        actor: 'Mesa',
        isHero: false,
        actionType: 'deal',
        amountBB: 0,
        potAfterBB: round1(potBB),
        toCallBB: 0,
        potOddsPct: null,
        boardSoFar: boardSoFar(),
        summary: `Showdown final · Bote ${round1(potBB)} BB`
      });
      continue;
    }

    const postM = line.match(/^([^:\r\n]+):\s+posts\s+(small blind|big blind|ante)\s+(?:[$€£])?([0-9]+(?:\.[0-9]+)?)/i);
    if (postM) {
      const actor = postM[1].trim();
      const postType = postM[2].toLowerCase();
      const amtBB = round1(parseFloat(postM[3]) / bbUnit);
      potBB = round1(potBB + amtBB);
      if (!postType.includes('ante')) {
        committed[actor] = round1((committed[actor] || 0) + amtBB);
        currentMaxBetBB = Math.max(currentMaxBetBB, committed[actor]);
      }
      steps.push({
        stepIndex: steps.length,
        street,
        actor,
        isHero: actor.toLowerCase() === heroLower,
        actionType: 'post',
        amountBB: amtBB,
        potAfterBB: potBB,
        toCallBB: 0,
        potOddsPct: null,
        boardSoFar: boardSoFar(),
        summary: `${actor} pone ${postType === 'small blind' ? 'SB' : postType === 'big blind' ? 'BB' : 'Ante'} ${amtBB} BB`
      });
      continue;
    }

    const actM = line.match(/^([^:\r\n]+):\s+(folds|checks|calls|bets|raises)(.*)$/i);
    if (actM) {
      const actor = actM[1].trim();
      if (/^(seat\s+\d+|total pot|board)/i.test(actor)) continue;
      const verb = actM[2].toLowerCase();
      const rest = actM[3] || '';
      const isHero = actor.toLowerCase() === heroLower;
      const isAllIn = /all-in/i.test(rest);
      const alreadyIn = committed[actor] || 0;
      const toCallBB = round1(Math.max(0, currentMaxBetBB - alreadyIn));

      if (verb === 'folds') {
        const potOdds = calcPotOdds(toCallBB, potBB);
        steps.push({
          stepIndex: steps.length,
          street,
          actor,
          isHero,
          actionType: 'fold',
          amountBB: 0,
          potAfterBB: potBB,
          toCallBB,
          potOddsPct: potOdds,
          boardSoFar: boardSoFar(),
          summary: `${actor} hace Fold${toCallBB > 0 ? ` ante ${toCallBB} BB` : ''}`
        });
        continue;
      }

      if (verb === 'checks') {
        steps.push({
          stepIndex: steps.length,
          street,
          actor,
          isHero,
          actionType: 'check',
          amountBB: 0,
          potAfterBB: potBB,
          toCallBB: 0,
          potOddsPct: null,
          boardSoFar: boardSoFar(),
          summary: `${actor} hace Check`
        });
        continue;
      }

      if (verb === 'calls') {
        const numM = rest.match(/(?:[$€£])?([0-9]+(?:\.[0-9]+)?)/);
        const callAmt = numM ? round1(parseFloat(numM[1]) / bbUnit) : toCallBB;
        const effectiveToCall = toCallBB > 0 ? toCallBB : callAmt;
        const potOdds = calcPotOdds(effectiveToCall, potBB);
        committed[actor] = round1(alreadyIn + callAmt);
        potBB = round1(potBB + callAmt);
        steps.push({
          stepIndex: steps.length,
          street,
          actor,
          isHero,
          actionType: isAllIn ? 'allin' : 'call',
          amountBB: callAmt,
          potAfterBB: potBB,
          toCallBB: effectiveToCall,
          potOddsPct: potOdds,
          boardSoFar: boardSoFar(),
          summary: `${actor} paga ${callAmt} BB${isAllIn ? ' (All-In)' : ''}${potOdds !== null ? ` · Pot Odds ${potOdds}%` : ''}`
        });
        continue;
      }

      if (verb === 'bets') {
        const numM = rest.match(/(?:[$€£])?([0-9]+(?:\.[0-9]+)?)/);
        const betAmt = numM ? round1(parseFloat(numM[1]) / bbUnit) : 0;
        committed[actor] = round1(alreadyIn + betAmt);
        currentMaxBetBB = Math.max(currentMaxBetBB, committed[actor]);
        potBB = round1(potBB + betAmt);
        steps.push({
          stepIndex: steps.length,
          street,
          actor,
          isHero,
          actionType: isAllIn ? 'allin' : 'bet',
          amountBB: betAmt,
          potAfterBB: potBB,
          toCallBB: 0,
          potOddsPct: null,
          boardSoFar: boardSoFar(),
          summary: `${actor} apuesta ${betAmt} BB${isAllIn ? ' (All-In)' : ''}`
        });
        continue;
      }

      if (verb === 'raises') {
        const toM = rest.match(/to\s+(?:[$€£])?([0-9]+(?:\.[0-9]+)?)/i);
        const firstM = rest.match(/(?:[$€£])?([0-9]+(?:\.[0-9]+)?)/);
        const targetTotalBB = toM
          ? round1(parseFloat(toM[1]) / bbUnit)
          : round1(alreadyIn + (firstM ? parseFloat(firstM[1]) / bbUnit : 0));
        const addedBB = round1(Math.max(0, targetTotalBB - alreadyIn));
        const potOdds = calcPotOdds(toCallBB, potBB);
        committed[actor] = targetTotalBB;
        currentMaxBetBB = Math.max(currentMaxBetBB, targetTotalBB);
        potBB = round1(potBB + addedBB);
        steps.push({
          stepIndex: steps.length,
          street,
          actor,
          isHero,
          actionType: isAllIn ? 'allin' : 'raise',
          amountBB: targetTotalBB,
          potAfterBB: potBB,
          toCallBB,
          potOddsPct: potOdds,
          boardSoFar: boardSoFar(),
          summary: `${actor} sube a ${targetTotalBB} BB${isAllIn ? ' (All-In)' : ''}`
        });
        continue;
      }
    }

    const uncalledM = line.match(/^Uncalled bet \((?:[$€£])?([0-9]+(?:\.[0-9]+)?)\) returned to ([^\r\n]+)/i);
    if (uncalledM) {
      const retAmt = round1(parseFloat(uncalledM[1]) / bbUnit);
      potBB = round1(Math.max(0, potBB - retAmt));
      continue;
    }

    const colM = line.match(/^([^\s:]+(?:\s+[^\s:]+)?)\s+(?:collected|won)\s+(?:[$€£])?([0-9]+(?:\.[0-9]+)?)/i);
    if (colM && !/^Total pot/i.test(line)) {
      const actor = colM[1].trim();
      const wonAmt = round1(parseFloat(colM[2]) / bbUnit);
      steps.push({
        stepIndex: steps.length,
        street: street === 'preflop' ? 'preflop' : 'showdown',
        actor,
        isHero: actor.toLowerCase() === heroLower,
        actionType: 'collect',
        amountBB: wonAmt,
        potAfterBB: wonAmt,
        toCallBB: 0,
        potOddsPct: null,
        boardSoFar: boardSoFar(),
        summary: `${actor} gana el bote (${wonAmt} BB)`
      });
    }
  }

  return steps;
}

export function appendHandsToTracker2Database(
  dbId: string,
  incomingHands: ParsedHandRecord[],
  fileName: string
): { databases: Tracker2Database[]; addedCount: number; duplicateCount: number } {
  const all = loadTracker2Databases();
  let addedCount = 0;
  let duplicateCount = 0;

  const updated = all.map(db => {
    if (db.id !== dbId) return db;
    const existingKeys = new Set(db.hands.map(h => h.handKey));
    const uniqueNew: ParsedHandRecord[] = [];
    for (const h of incomingHands) {
      if (existingKeys.has(h.handKey)) {
        duplicateCount++;
      } else {
        existingKeys.add(h.handKey);
        uniqueNew.push(h);
        addedCount++;
      }
    }
    const mergedHands = [...db.hands, ...uniqueNew];
    const files = db.importedFiles.includes(fileName) ? db.importedFiles : [...db.importedFiles, fileName];
    return {
      ...db,
      hands: mergedHands,
      importedFiles: files,
      updatedAt: Date.now()
    };
  });

  saveTracker2Databases(updated);
  return { databases: updated, addedCount, duplicateCount };
}

export function generateSampleSessionHands(count = 250, batchTag = `demo-${Date.now()}`): ParsedHandRecord[] {
  const positions: TablePosition[] = ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'];
  const hands: ParsedHandRecord[] = [];
  const sampleCombos = ['AsKd', 'AhQh', 'KcQs', 'JdJc', 'Td9d', 'Ac5c', '9s8s', 'KhJh', 'QdTc', '7h7d', 'AdTd', 'KsJs'];
  const sampleBoards = ['Ah 8d 2c', 'Ks Qh 9d', 'Jc Tc 4s', '7d 7s 3h', 'Qc 6d 2s', 'Td 9h 5c'];

  for (let i = 0; i < count; i++) {
    const heroPos = positions[i % positions.length];
    const seed = (i * 37 + 13) % 100;
    const potType: ParsedHandRecord['potType'] =
      seed < 12 ? '4Bet' : seed < 30 ? '3Bet' : seed < 42 ? 'Multiway' : 'SRP';
    const vpip = heroPos === 'BTN' ? seed < 36 : heroPos === 'BB' ? seed < 38 : seed < 24;
    const pfr = vpip && (heroPos === 'BB' ? seed < 14 : seed < 21);
    const threeBet = pfr && potType === '3Bet' && i % 3 === 0;
    const wentToShowdown = vpip && seed % 5 === 0;
    const cbet = pfr ? seed % 3 !== 0 : null;
    const netWonBB = !vpip
      ? heroPos === 'SB'
        ? -0.5
        : heroPos === 'BB'
        ? -1.0
        : 0
      : Math.round(((Math.sin(i * 1.37) * 14 + (heroPos === 'BTN' ? 1.1 : heroPos === 'BB' ? -0.45 : 0.35))) * 10) / 10;
    const evDiff = wentToShowdown ? Math.round(Math.cos(i * 0.9) * 3.2 * 10) / 10 : 0;
    const evAdjustedBB = Math.round((netWonBB + evDiff) * 10) / 10;

    const scenario: SimScenarioType =
      potType === '4Bet'
        ? '4BET'
        : potType === '3Bet'
        ? heroPos === 'BTN' || heroPos === 'CO'
          ? '3BET_IP'
          : '3BET_OOP'
        : potType === 'Multiway'
        ? 'MULTIWAY'
        : heroPos === 'BTN' || heroPos === 'CO'
        ? 'SRP_IP'
        : 'SRP_OOP';

    const sampleRecord: ParsedHandRecord = {
      id: `hh-${batchTag}-${i}`,
      handKey: `ALLIN-${batchTag}-${i}`,
      site: 'LabDemo',
      timestamp: Date.now() - (count - i) * 45000,
      stakes: 'NL10 6-Max',
      heroPos,
      scenario,
      potType,
      wentToShowdown,
      heroInvestedBB: vpip ? Math.abs(Math.min(0, netWonBB)) + 3 : heroPos === 'BB' ? 1 : heroPos === 'SB' ? 0.5 : 0,
      netWonBB,
      evAdjustedBB,
      showdownBB: wentToShowdown ? netWonBB : 0,
      nonShowdownBB: wentToShowdown ? 0 : netWonBB,
      vpip,
      pfr,
      threeBet,
      foldToThreeBet: pfr ? seed > 55 : null,
      cbet,
      foldToCbet: !pfr && vpip ? seed % 2 === 0 : null,
      wonAtShowdown: wentToShowdown && netWonBB > 0,
      stealAttempt: heroPos === 'CO' || heroPos === 'BTN' || heroPos === 'SB' ? pfr : null,
      bbFoldVsSteal: heroPos === 'BB' ? !vpip : null,
      aggressiveActions: pfr ? 2 : vpip ? 1 : 0,
      passiveCalls: vpip && !pfr ? 2 : wentToShowdown ? 1 : 0,
      heroCardsStr: sampleCombos[i % sampleCombos.length],
      boardStr: `${sampleBoards[i % sampleBoards.length]} ${(i % 2 === 0 ? '4s Td' : '2h Kc')}`
    };
    sampleRecord.actionSteps = getHandActionSteps(sampleRecord);
    hands.push(sampleRecord);
  }
  return hands;
}

export function getHandActionSteps(hand: ParsedHandRecord): Tracker2ActionStep[] {
  if (hand.actionSteps && hand.actionSteps.length > 0) {
    return hand.actionSteps;
  }

  const heroLabel = `Hero (${hand.heroPos === 'EP' ? 'UTG' : hand.heroPos})`;
  const villainLabel = hand.heroPos === 'BB' ? 'Villano (BTN)' : 'Villano (BB)';
  const boardTokens = (hand.boardStr || '').trim().split(/\s+/).filter(Boolean);
  const flopBoard = boardTokens.slice(0, 3).join(' ');
  const turnBoard = boardTokens.slice(0, 4).join(' ');
  const riverBoard = boardTokens.slice(0, 5).join(' ');

  const steps: Tracker2ActionStep[] = [
    {
      stepIndex: 0,
      street: 'preflop',
      actor: 'SB',
      isHero: hand.heroPos === 'SB',
      actionType: 'post',
      amountBB: 0.5,
      potAfterBB: 0.5,
      toCallBB: 0,
      potOddsPct: null,
      boardSoFar: '',
      summary: 'SB pone ciega pequeña 0.5 BB'
    },
    {
      stepIndex: 1,
      street: 'preflop',
      actor: 'BB',
      isHero: hand.heroPos === 'BB',
      actionType: 'post',
      amountBB: 1.0,
      potAfterBB: 1.5,
      toCallBB: 0,
      potOddsPct: null,
      boardSoFar: '',
      summary: 'BB pone ciega grande 1.0 BB'
    }
  ];

  let pot = 1.5;
  if (!hand.vpip) {
    steps.push({
      stepIndex: steps.length,
      street: 'preflop',
      actor: heroLabel,
      isHero: true,
      actionType: 'fold',
      amountBB: 0,
      potAfterBB: pot,
      toCallBB: 1.0,
      potOddsPct: 40.0,
      boardSoFar: '',
      summary: `${heroLabel} descarta preflop (Fold disciplinado)`
    });
    return steps;
  }

  if (hand.pfr) {
    const openSz = hand.potType === '3Bet' ? 9.0 : hand.potType === '4Bet' ? 22.0 : 2.5;
    pot = round1(pot + openSz);
    steps.push({
      stepIndex: steps.length,
      street: 'preflop',
      actor: heroLabel,
      isHero: true,
      actionType: 'raise',
      amountBB: openSz,
      potAfterBB: pot,
      toCallBB: 1.0,
      potOddsPct: null,
      boardSoFar: '',
      summary: `${heroLabel} abre/sube a ${openSz} BB (${hand.potType})`
    });
    const callAdd = round1(Math.max(1.5, openSz - 1));
    const callOdds = Math.round((callAdd / (pot + callAdd)) * 1000) / 10;
    pot = round1(pot + callAdd);
    steps.push({
      stepIndex: steps.length,
      street: 'preflop',
      actor: villainLabel,
      isHero: false,
      actionType: 'call',
      amountBB: callAdd,
      potAfterBB: pot,
      toCallBB: callAdd,
      potOddsPct: callOdds,
      boardSoFar: '',
      summary: `${villainLabel} paga ${callAdd} BB · Pot Odds ${callOdds}%`
    });
  } else {
    const openSz = hand.potType === '3Bet' ? 8.5 : 2.5;
    pot = round1(pot + openSz);
    steps.push({
      stepIndex: steps.length,
      street: 'preflop',
      actor: villainLabel,
      isHero: false,
      actionType: 'raise',
      amountBB: openSz,
      potAfterBB: pot,
      toCallBB: 1.0,
      potOddsPct: null,
      boardSoFar: '',
      summary: `${villainLabel} sube a ${openSz} BB`
    });
    const toCall = hand.heroPos === 'BB' ? round1(openSz - 1) : openSz;
    const heroOdds = Math.round((toCall / (pot + toCall)) * 1000) / 10;
    pot = round1(pot + toCall);
    steps.push({
      stepIndex: steps.length,
      street: 'preflop',
      actor: heroLabel,
      isHero: true,
      actionType: 'call',
      amountBB: toCall,
      potAfterBB: pot,
      toCallBB: toCall,
      potOddsPct: heroOdds,
      boardSoFar: '',
      summary: `${heroLabel} defiende pagando ${toCall} BB · Pot Odds ${heroOdds}%`
    });
  }

  if (flopBoard) {
    steps.push({
      stepIndex: steps.length,
      street: 'flop',
      actor: 'Mesa',
      isHero: false,
      actionType: 'deal',
      amountBB: 0,
      potAfterBB: pot,
      toCallBB: 0,
      potOddsPct: null,
      boardSoFar: flopBoard,
      summary: `Flop [${flopBoard}] · Bote ${pot} BB`
    });

    const cbetAmt = round1(pot * 0.5);
    if (hand.cbet) {
      pot = round1(pot + cbetAmt);
      steps.push({
        stepIndex: steps.length,
        street: 'flop',
        actor: heroLabel,
        isHero: true,
        actionType: 'bet',
        amountBB: cbetAmt,
        potAfterBB: pot,
        toCallBB: 0,
        potOddsPct: null,
        boardSoFar: flopBoard,
        summary: `${heroLabel} hace C-Bet 50% (${cbetAmt} BB)`
      });
      if (hand.wentToShowdown || turnBoard.split(' ').length >= 4) {
        const odds = Math.round((cbetAmt / (pot + cbetAmt)) * 1000) / 10;
        pot = round1(pot + cbetAmt);
        steps.push({
          stepIndex: steps.length,
          street: 'flop',
          actor: villainLabel,
          isHero: false,
          actionType: 'call',
          amountBB: cbetAmt,
          potAfterBB: pot,
          toCallBB: cbetAmt,
          potOddsPct: odds,
          boardSoFar: flopBoard,
          summary: `${villainLabel} paga ${cbetAmt} BB · Pot Odds ${odds}%`
        });
      }
    } else {
      steps.push({
        stepIndex: steps.length,
        street: 'flop',
        actor: villainLabel,
        isHero: false,
        actionType: 'bet',
        amountBB: cbetAmt,
        potAfterBB: round1(pot + cbetAmt),
        toCallBB: 0,
        potOddsPct: null,
        boardSoFar: flopBoard,
        summary: `${villainLabel} apuesta ${cbetAmt} BB en Flop`
      });
      pot = round1(pot + cbetAmt);
      const odds = Math.round((cbetAmt / (pot + cbetAmt)) * 1000) / 10;
      if (hand.foldToCbet) {
        steps.push({
          stepIndex: steps.length,
          street: 'flop',
          actor: heroLabel,
          isHero: true,
          actionType: 'fold',
          amountBB: 0,
          potAfterBB: pot,
          toCallBB: cbetAmt,
          potOddsPct: odds,
          boardSoFar: flopBoard,
          summary: `${heroLabel} foldea ante C-Bet (${cbetAmt} BB · Pot Odds ${odds}%)`
        });
        return steps;
      }
      pot = round1(pot + cbetAmt);
      steps.push({
        stepIndex: steps.length,
        street: 'flop',
        actor: heroLabel,
        isHero: true,
        actionType: 'call',
        amountBB: cbetAmt,
        potAfterBB: pot,
        toCallBB: cbetAmt,
        potOddsPct: odds,
        boardSoFar: flopBoard,
        summary: `${heroLabel} paga ${cbetAmt} BB · Pot Odds ${odds}%`
      });
    }
  }

  if (turnBoard.split(/\s+/).filter(Boolean).length >= 4 && hand.wentToShowdown) {
    steps.push({
      stepIndex: steps.length,
      street: 'turn',
      actor: 'Mesa',
      isHero: false,
      actionType: 'deal',
      amountBB: 0,
      potAfterBB: pot,
      toCallBB: 0,
      potOddsPct: null,
      boardSoFar: turnBoard,
      summary: `Turn [${turnBoard}] · Bote ${pot} BB`
    });
    const turnBet = round1(pot * 0.66);
    pot = round1(pot + turnBet);
    steps.push({
      stepIndex: steps.length,
      street: 'turn',
      actor: villainLabel,
      isHero: false,
      actionType: 'bet',
      amountBB: turnBet,
      potAfterBB: pot,
      toCallBB: 0,
      potOddsPct: null,
      boardSoFar: turnBoard,
      summary: `${villainLabel} apuesta en Turn ${turnBet} BB (66% bote)`
    });
    const turnOdds = Math.round((turnBet / (pot + turnBet)) * 1000) / 10;
    pot = round1(pot + turnBet);
    steps.push({
      stepIndex: steps.length,
      street: 'turn',
      actor: heroLabel,
      isHero: true,
      actionType: 'call',
      amountBB: turnBet,
      potAfterBB: pot,
      toCallBB: turnBet,
      potOddsPct: turnOdds,
      boardSoFar: turnBoard,
      summary: `${heroLabel} paga ${turnBet} BB · Necesita ${turnOdds}% equity`
    });
  }

  if (riverBoard.split(/\s+/).filter(Boolean).length >= 5 && hand.wentToShowdown) {
    steps.push({
      stepIndex: steps.length,
      street: 'river',
      actor: 'Mesa',
      isHero: false,
      actionType: 'deal',
      amountBB: 0,
      potAfterBB: pot,
      toCallBB: 0,
      potOddsPct: null,
      boardSoFar: riverBoard,
      summary: `River [${riverBoard}] · Bote ${pot} BB`
    });
  }

  steps.push({
    stepIndex: steps.length,
    street: hand.wentToShowdown ? 'showdown' : flopBoard ? 'flop' : 'preflop',
    actor: hand.netWonBB >= 0 ? heroLabel : villainLabel,
    isHero: hand.netWonBB >= 0,
    actionType: 'collect',
    amountBB: pot,
    potAfterBB: pot,
    toCallBB: 0,
    potOddsPct: null,
    boardSoFar: riverBoard || turnBoard || flopBoard,
    summary:
      hand.netWonBB >= 0
        ? `${heroLabel} gana el bote (${pot} BB · Neto +${hand.netWonBB} BB)`
        : `${villainLabel} se lleva el bote (${pot} BB · Hero ${hand.netWonBB} BB)`
  });

  return steps;
}

export function filterHands(hands: ParsedHandRecord[], filter: Tracker2FilterKey): ParsedHandRecord[] {
  if (filter === 'ALL') return hands;
  if (filter === 'UTG' || filter === 'EP') {
    return hands.filter(h => h.heroPos === 'EP');
  }
  if (filter === 'MP' || filter === 'CO' || filter === 'BTN' || filter === 'SB' || filter === 'BB') {
    return hands.filter(h => h.heroPos === filter);
  }
  if (filter === 'SRP') return hands.filter(h => h.potType === 'SRP');
  if (filter === '3BET') return hands.filter(h => h.potType === '3Bet');
  if (filter === '4BET') return hands.filter(h => h.potType === '4Bet');
  if (filter === 'MULTIWAY') return hands.filter(h => h.potType === 'Multiway');
  if (filter === 'SHOWDOWN') return hands.filter(h => h.wentToShowdown);
  if (filter === 'WINS') return hands.filter(h => h.netWonBB > 0);
  if (filter === 'LOSSES') return hands.filter(h => h.netWonBB < 0);
  return hands;
}

export function buildTracker2ChartSeries(hands: ParsedHandRecord[]): Tracker2ChartPoint[] {
  const pts: Tracker2ChartPoint[] = [{ handIndex: 0, wonBB: 0, evAdjustedBB: 0, showdownBB: 0, nonShowdownBB: 0 }];
  let won = 0;
  let ev = 0;
  let sd = 0;
  let nsd = 0;

  for (let i = 0; i < hands.length; i++) {
    const h = hands[i];
    won += h.netWonBB;
    ev += h.evAdjustedBB;
    sd += h.showdownBB;
    nsd += h.nonShowdownBB;
    pts.push({
      handIndex: i + 1,
      wonBB: Math.round(won * 10) / 10,
      evAdjustedBB: Math.round(ev * 10) / 10,
      showdownBB: Math.round(sd * 10) / 10,
      nonShowdownBB: Math.round(nsd * 10) / 10
    });
  }
  return pts;
}

export function computeHudStats(hands: ParsedHandRecord[]): Tracker2HudStatSummary {
  const total = hands.length;
  if (total === 0) {
    return {
      hands: 0,
      vpip: 0,
      pfr: 0,
      threeBet: 0,
      foldToThreeBet: 0,
      cbet: 0,
      foldToCbet: 0,
      wtsd: 0,
      wsd: 0,
      af: 0,
      steal: 0,
      bbFoldVsSteal: 0,
      rfi: 0,
      netWonBB: 0,
      evAdjustedBB: 0,
      showdownWonBB: 0,
      nonShowdownWonBB: 0,
      bbPer100: 0,
      evBbPer100: 0,
      nashPrecisionPct: 0
    };
  }

  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : 0);

  const vpipCount = hands.filter(h => h.vpip).length;
  const pfrCount = hands.filter(h => h.pfr).length;
  const threeBetCount = hands.filter(h => h.threeBet).length;
  const realThreeBetOpps = hands.filter(h => h.threeBetOpportunity).length;
  const threeBetDen = realThreeBetOpps > 0 ? realThreeBetOpps : Math.max(1, Math.round(total * 0.4));
  const f3bList = hands.filter(h => h.foldToThreeBet !== null);
  const f3bCount = f3bList.filter(h => h.foldToThreeBet === true).length;
  const cbetList = hands.filter(h => h.cbet !== null);
  const cbetCount = cbetList.filter(h => h.cbet === true).length;
  const fcbList = hands.filter(h => h.foldToCbet !== null);
  const fcbCount = fcbList.filter(h => h.foldToCbet === true).length;
  const sawFlop = hands.filter(h => h.vpip).length;
  const sdList = hands.filter(h => h.wentToShowdown);
  const sdWins = sdList.filter(h => h.wonAtShowdown).length;
  const stealList = hands.filter(h => h.stealAttempt !== null);
  const stealCount = stealList.filter(h => h.stealAttempt === true).length;
  const bbList = hands.filter(h => h.bbFoldVsSteal !== null);
  const bbFoldCount = bbList.filter(h => h.bbFoldVsSteal === true).length;

  const totalAgg = hands.reduce((s, h) => s + h.aggressiveActions, 0);
  const totalCalls = Math.max(1, hands.reduce((s, h) => s + h.passiveCalls, 0));

  const netWonBB = Math.round(hands.reduce((s, h) => s + h.netWonBB, 0) * 10) / 10;
  const evAdjustedBB = Math.round(hands.reduce((s, h) => s + h.evAdjustedBB, 0) * 10) / 10;
  const showdownWonBB = Math.round(hands.reduce((s, h) => s + h.showdownBB, 0) * 10) / 10;
  const nonShowdownWonBB = Math.round(hands.reduce((s, h) => s + h.nonShowdownBB, 0) * 10) / 10;

  const vpip = pct(vpipCount, total);
  const pfr = pct(pfrCount, total);
  const gapPenalty = Math.max(0, Math.abs(vpip - pfr - 5) * 1.4);
  const winrateBonus = netWonBB >= 0 ? 6 : -4;
  const nashPrecisionPct = Math.max(38, Math.min(96, Math.round(78 - gapPenalty + winrateBonus)));

  return {
    hands: total,
    vpip,
    pfr,
    threeBet: pct(threeBetCount, threeBetDen),
    foldToThreeBet: pct(f3bCount, f3bList.length),
    cbet: pct(cbetCount, cbetList.length),
    foldToCbet: pct(fcbCount, fcbList.length),
    wtsd: pct(sdList.length, Math.max(1, sawFlop)),
    wsd: pct(sdWins, sdList.length),
    af: Math.round((totalAgg / totalCalls) * 100) / 100,
    steal: pct(stealCount, stealList.length),
    bbFoldVsSteal: pct(bbFoldCount, bbList.length),
    rfi: pfr,
    netWonBB,
    evAdjustedBB,
    showdownWonBB,
    nonShowdownWonBB,
    bbPer100: Math.round(((netWonBB / total) * 100) * 10) / 10,
    evBbPer100: Math.round(((evAdjustedBB / total) * 100) * 10) / 10,
    nashPrecisionPct
  };
}

export interface Tracker2PortableBackupPayload {
  schema: 'allin-school-tracker2-backup-v1' | 'lab-studio-pt4-backup-v1';
  exportedAt: number;
  activeDbId: string;
  hudTemplate: HudTemplateConfig;
  databases: Tracker2Database[];
}

export function createTracker2BackupPayload(
  dbs: Tracker2Database[] = loadTracker2Databases(),
  activeDbId: string = getActiveTracker2DatabaseId()
): Tracker2PortableBackupPayload {
  return {
    schema: 'allin-school-tracker2-backup-v1',
    exportedAt: Date.now(),
    activeDbId,
    hudTemplate: loadSavedHudTemplate(),
    databases: dbs.slice(0, MAX_TRACKER2_DATABASES)
  };
}

export async function exportTracker2BackupZip(
  dbs: Tracker2Database[] = loadTracker2Databases(),
  activeDbId: string = getActiveTracker2DatabaseId()
): Promise<{ blob: Blob; filename: string; handsCount: number; dbCount: number }> {
  const payload = createTracker2BackupPayload(dbs, activeDbId);
  const zip = new JSZip();
  zip.file('allin_tracker2_backup.json', JSON.stringify(payload));
  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  const dateTag = new Date().toISOString().slice(0, 10);
  const handsCount = payload.databases.reduce((acc, db) => acc + db.hands.length, 0);
  return {
    blob,
    filename: `allin-school-thetracker2-backup-${dateTag}.zip`,
    handsCount,
    dbCount: payload.databases.length
  };
}

export async function exportTracker2BackupGzip(
  dbs: Tracker2Database[] = loadTracker2Databases(),
  activeDbId: string = getActiveTracker2DatabaseId()
): Promise<{ blob: Blob; filename: string; isGzipped: boolean; handsCount: number; dbCount: number }> {
  const payload = createTracker2BackupPayload(dbs, activeDbId);
  const jsonText = JSON.stringify(payload);
  const dateTag = new Date().toISOString().slice(0, 10);
  const handsCount = payload.databases.reduce((acc, db) => acc + db.hands.length, 0);

  if (typeof CompressionStream !== 'undefined') {
    const encoded = new TextEncoder().encode(jsonText);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      }
    }).pipeThrough(new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
    const compressedBuf = await new Response(stream).arrayBuffer();
    return {
      blob: new Blob([compressedBuf], { type: 'application/gzip' }),
      filename: `allin-school-thetracker2-backup-${dateTag}.json.gz`,
      isGzipped: true,
      handsCount,
      dbCount: payload.databases.length
    };
  }

  return {
    blob: new Blob([jsonText], { type: 'application/json' }),
    filename: `allin-school-thetracker2-backup-${dateTag}.json`,
    isGzipped: false,
    handsCount,
    dbCount: payload.databases.length
  };
}

export function mergeTracker2BackupPayload(
  payload: Tracker2PortableBackupPayload
): { databases: Tracker2Database[]; addedHands: number; duplicateHands: number; addedDbs: number } {
  const validSchema =
    payload &&
    (payload.schema === 'allin-school-tracker2-backup-v1' || payload.schema === 'lab-studio-pt4-backup-v1') &&
    Array.isArray(payload.databases);
  if (!validSchema) {
    throw new Error('El archivo no corresponde a un respaldo válido de TheTracker2.');
  }

  if (payload.hudTemplate && Array.isArray(payload.hudTemplate.layoutRows)) {
    saveHudTemplate(payload.hudTemplate);
  }

  const current = loadTracker2Databases();
  const nextDbs: Tracker2Database[] = current.map(db => ({
    ...db,
    hands: [...db.hands],
    importedFiles: [...db.importedFiles]
  }));

  let addedHands = 0;
  let duplicateHands = 0;
  let addedDbs = 0;

  for (const incomingDb of payload.databases) {
    if (!incomingDb || !Array.isArray(incomingDb.hands)) continue;

    let target =
      nextDbs.find(d => d.id === incomingDb.id) ||
      nextDbs.find(d => d.name.trim().toLowerCase() === String(incomingDb.name || '').trim().toLowerCase());

    if (!target) {
      if (nextDbs.length < MAX_TRACKER2_DATABASES) {
        target = {
          id: incomingDb.id || `db-${Date.now()}-${nextDbs.length}`,
          name: String(incomingDb.name || `Base Importada #${nextDbs.length + 1}`).slice(0, 40),
          createdAt: Number(incomingDb.createdAt || Date.now()),
          updatedAt: Date.now(),
          hands: [],
          importedFiles: []
        };
        nextDbs.push(target);
        addedDbs++;
      } else {
        target = nextDbs[0];
      }
    }

    const existingKeys = new Set(target.hands.map(h => h.handKey));
    for (const h of incomingDb.hands) {
      if (!h || !h.handKey) continue;
      if (existingKeys.has(h.handKey)) {
        duplicateHands++;
      } else {
        existingKeys.add(h.handKey);
        target.hands.push(h);
        addedHands++;
      }
    }
    for (const fName of incomingDb.importedFiles || []) {
      if (!target.importedFiles.includes(fName)) {
        target.importedFiles.push(fName);
      }
    }
    target.updatedAt = Date.now();
  }

  saveTracker2Databases(nextDbs);
  return { databases: nextDbs, addedHands, duplicateHands, addedDbs };
}

export async function importTracker2BackupFromBytes(
  fileName: string,
  bytes: Uint8Array
): Promise<{ databases: Tracker2Database[]; addedHands: number; duplicateHands: number; addedDbs: number }> {
  const lower = fileName.toLowerCase();
  let jsonStr = '';

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(bytes);
    const backupEntry =
      zip.file('allin_tracker2_backup.json') ||
      zip.file('lab_pt4_backup.json') ||
      Object.values(zip.files).find(f => !f.dir && f.name.toLowerCase().endsWith('.json'));
    if (!backupEntry) {
      throw new Error('El archivo .zip no contiene un respaldo JSON de TheTracker2.');
    }
    jsonStr = await backupEntry.async('string');
  } else if (lower.endsWith('.gz') && typeof DecompressionStream !== 'undefined') {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      }
    }).pipeThrough(new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>);
    jsonStr = await new Response(stream).text();
  } else {
    jsonStr = new TextDecoder().decode(bytes);
  }

  const parsed = JSON.parse(jsonStr) as Tracker2PortableBackupPayload;
  return mergeTracker2BackupPayload(parsed);
}
