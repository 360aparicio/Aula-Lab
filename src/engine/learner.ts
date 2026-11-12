/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * LearnerService: Motor de Captura de Errores y Detección de Patrones de Debilidad.
 * Captura las decisiones del usuario en TrainerModule.tsx cuando el Mistake Threshold
 * supera el 5% EV, almacenándolas en localStorage junto con el análisis de la textura
 * del board para identificar patrones recurrentes de vulnerabilidad.
 */

import { Card } from './cards';
import { SpacedRepetitionManager } from './spacedRepetition';
import { SolverMetaUpdater } from './solverMetaUpdater';

export interface BoardTextureAnalysis {
  wetness: 'Seco (Dry)' | 'Coordinado (Wet)' | 'Monótono (Monotone)' | 'Emparejado (Paired)' | 'Preflop';
  suitPattern: 'Rainbow' | 'Two-tone' | 'Monotone' | '4-Flush';
  highCard: 'A' | 'K' | 'Q' | 'J' | 'T' | 'Baja (9-)';
  isPaired: boolean;
  summary: string;
}

export interface LearnerMistakeRecord {
  id: string;
  timestamp: number;
  scenarioTitle: string;
  heroCombo: string;
  boardCards: string[];
  boardTexture: BoardTextureAnalysis;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  heroPos: string;
  villainPos: string;
  potBB: number;
  chosenAction: string;
  bestAction: string;
  chosenFrequency: number;
  bestFrequency: number;
  evLossBB: number;
  evLossChips: number;
  evLossPercentOfPot: number; // e.g. 7.5%
  isMistakeThresholdExceeded: boolean; // >5% EV
  grade: string;
  leakCategory: string;
  prescriptiveFix: string;
}

export interface WeaknessPattern {
  patternId: string;
  title: string;
  textureType: string;
  mistakeCount: number;
  totalEvLossBB: number;
  averageEvLossPercent: number;
  frequencyPct: number; // % del total de errores
  severity: 'Crítica' | 'Alta' | 'Media';
  diagnosis: string;
  recommendation: string;
}

export interface LearnerSummary {
  totalRecordedDecisions: number;
  criticalMistakesCount: number; // >5% EV Loss
  totalEvLossBBLost: number;
  worstTexture: string;
  worstPosition: string;
  topWeaknessPatterns: WeaknessPattern[];
}

export const LEARNER_STORAGE_KEY = 'lab_studio_learner_mistakes';
export const LEARNER_UPDATE_EVENT = 'learner-state-updated';

/**
 * Analiza la textura geométrica de las cartas comunitarias
 */
export function analyzeBoardTexture(cards: (Card | string)[]): BoardTextureAnalysis {
  if (!cards || cards.length === 0) {
    return {
      wetness: 'Preflop',
      suitPattern: 'Rainbow',
      highCard: 'Baja (9-)',
      isPaired: false,
      summary: 'Bote Preflop antes de cartas comunitarias'
    };
  }

  const parsedRanks: string[] = [];
  const parsedSuits: string[] = [];

  for (const c of cards) {
    if (typeof c === 'string') {
      parsedRanks.push(c.charAt(0).toUpperCase());
      parsedSuits.push(c.charAt(1).toLowerCase());
    } else {
      parsedRanks.push(c.rank.toUpperCase());
      parsedSuits.push(c.suit.toLowerCase());
    }
  }

  // Suits analysis
  const suitCounts: Record<string, number> = {};
  parsedSuits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
  const maxSuitCount = Math.max(...Object.values(suitCounts), 0);

  let suitPattern: BoardTextureAnalysis['suitPattern'] = 'Rainbow';
  if (maxSuitCount >= 4) {
    suitPattern = '4-Flush';
  } else if (maxSuitCount === 3) {
    suitPattern = 'Monotone';
  } else if (maxSuitCount === 2) {
    suitPattern = 'Two-tone';
  }

  // Ranks analysis
  const rankCounts: Record<string, number> = {};
  parsedRanks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
  const isPaired = Object.values(rankCounts).some(cnt => cnt >= 2);

  // High card
  const rankOrder = '23456789TJQKA';
  let highestRankVal = -1;
  let highestRankChar = '2';

  parsedRanks.forEach(r => {
    const val = rankOrder.indexOf(r);
    if (val > highestRankVal) {
      highestRankVal = val;
      highestRankChar = r;
    }
  });

  let highCard: BoardTextureAnalysis['highCard'] = 'Baja (9-)';
  if (highestRankChar === 'A') highCard = 'A';
  else if (highestRankChar === 'K') highCard = 'K';
  else if (highestRankChar === 'Q') highCard = 'Q';
  else if (highestRankChar === 'J') highCard = 'J';
  else if (highestRankChar === 'T') highCard = 'T';

  // Wetness classification
  let wetness: BoardTextureAnalysis['wetness'] = 'Seco (Dry)';
  if (suitPattern === 'Monotone' || suitPattern === '4-Flush') {
    wetness = 'Monótono (Monotone)';
  } else if (isPaired) {
    wetness = 'Emparejado (Paired)';
  } else {
    // Check rank connectivity (e.g. 9-8-7 or J-T-8)
    const indices = parsedRanks.map(r => rankOrder.indexOf(r)).sort((a, b) => b - a);
    let gaps = 0;
    for (let i = 0; i < indices.length - 1; i++) {
      gaps += Math.max(0, indices[i] - indices[i + 1] - 1);
    }
    if (gaps <= 2 && indices.length >= 3) {
      wetness = 'Coordinado (Wet)';
    } else {
      wetness = 'Seco (Dry)';
    }
  }

  const summary = `${wetness} · ${highCard}-high · ${suitPattern}${isPaired ? ' · Par en mesa' : ''}`;

  return {
    wetness,
    suitPattern,
    highCard,
    isPaired,
    summary
  };
}

export class LearnerService {
  private static instance: LearnerService;
  private mistakes: LearnerMistakeRecord[] = [];
  private totalRecordedDecisions: number = 0;

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): LearnerService {
    if (!LearnerService.instance) {
      LearnerService.instance = new LearnerService();
    }
    return LearnerService.instance;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(LEARNER_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.mistakes = parsed;
          this.totalRecordedDecisions = parsed.length;
          return;
        }
      }
    } catch (e) {
      // fallback
    }

    // Default Seed Mistakes for initial patterns
    this.mistakes = [
      {
        id: 'seed-mistake-1',
        timestamp: Date.now() - 3600000 * 3,
        scenarioTitle: 'Bote 3-Bet BTN vs BB (A83r)',
        heroCombo: 'Ad5d',
        boardCards: ['Ah', '8s', '3c'],
        boardTexture: {
          wetness: 'Seco (Dry)',
          suitPattern: 'Rainbow',
          highCard: 'A',
          isPaired: false,
          summary: 'Seco (Dry) · A-high · Rainbow'
        },
        street: 'flop',
        heroPos: 'BB',
        villainPos: 'BTN',
        potBB: 19.5,
        chosenAction: 'Bet 75% Pot',
        bestAction: 'Bet 33% Pot',
        chosenFrequency: 0.04,
        bestFrequency: 0.78,
        evLossBB: 1.45,
        evLossChips: 2.9,
        evLossPercentOfPot: 7.4,
        isMistakeThresholdExceeded: true,
        grade: 'blunder',
        leakCategory: 'Sobre-apuesta en Botes 3-Bet',
        prescriptiveFix: 'En 3-bet pots con As alto y SPR bajo (~4), apuesta 25-33% pot para mantener pagando a manos dominadas.'
      },
      {
        id: 'seed-mistake-2',
        timestamp: Date.now() - 3600000 * 6,
        scenarioTitle: 'Flop Monocolor (Kh 8h 3h)',
        heroCombo: 'KdQc',
        boardCards: ['Kh', '8h', '3h'],
        boardTexture: {
          wetness: 'Monótono (Monotone)',
          suitPattern: 'Monotone',
          highCard: 'K',
          isPaired: false,
          summary: 'Monótono (Monotone) · K-high · Monotone'
        },
        street: 'flop',
        heroPos: 'CO',
        villainPos: 'BB',
        potBB: 6.5,
        chosenAction: 'Bet 75% Pot',
        bestAction: 'Check Behind',
        chosenFrequency: 0.02,
        bestFrequency: 0.84,
        evLossBB: 0.95,
        evLossChips: 1.9,
        evLossPercentOfPot: 6.2,
        isMistakeThresholdExceeded: true,
        grade: 'blunder',
        leakCategory: 'Sobre-inversión en Mesas Monocolor sin Blocker',
        prescriptiveFix: 'En mesas con 3 cartas del mismo palo, pasa detrás con parejas altas que no tengan el As del color para controlar el bote.'
      }
    ];
    this.totalRecordedDecisions = this.mistakes.length;
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(LEARNER_STORAGE_KEY, JSON.stringify(this.mistakes));
      window.dispatchEvent(new Event(LEARNER_UPDATE_EVENT));
    } catch (e) {
      // ignore
    }
  }

  /**
   * Captura una decisión del usuario en TrainerModule.tsx.
   * Si supera el Mistake Threshold (> 5.0% EV Loss) o si es un error grave, la almacena.
   */
  public recordTrainerDecision(params: {
    scenarioTitle: string;
    heroCombo: string;
    boardCards: (Card | string)[];
    street?: 'preflop' | 'flop' | 'turn' | 'river';
    heroPos: string;
    villainPos: string;
    potBB: number;
    chosenAction: string;
    bestAction: string;
    chosenFrequency: number;
    bestFrequency: number;
    evLossBB: number;
    evLossChips: number;
    evLossPercentOfPot: number;
    isMistakeThresholdExceeded?: boolean;
    grade: string;
  }): LearnerMistakeRecord | null {
    this.totalRecordedDecisions += 1;

    // Mistake Threshold: > 5.0% EV loss o marcado explícitamente
    const isExceeded = params.isMistakeThresholdExceeded ?? (params.evLossPercentOfPot > 5.0 || params.grade === 'blunder');

    if (!isExceeded && params.evLossPercentOfPot < 5.0) {
      return null; // Solo guardamos las decisiones que superan el umbral del 5% EV
    }

    const texture = analyzeBoardTexture(params.boardCards);
    const street = params.street || (params.boardCards.length === 0 ? 'preflop' : params.boardCards.length === 3 ? 'flop' : params.boardCards.length === 4 ? 'turn' : 'river');

    // Determinar categoría de fuga y recomendación prescriptiva
    let leakCategory = 'Desviación de Sizing Postflop';
    let prescriptiveFix = 'Ajusta tu tamaño de apuesta según la textura del board y el SPR.';

    if (texture.wetness === 'Monótono (Monotone)') {
      leakCategory = 'Sobre-inversión en Mesas Monótonas';
      prescriptiveFix = 'En mesas de 1 solo palo sin blocker de color, prioriza el check para evitar check-raises devastadores.';
    } else if (params.potBB > 14) {
      leakCategory = 'Sizing excesivo en Botes 3-Bet / 4-Bet';
      prescriptiveFix = 'Con SPR bajo (< 4.5), no necesitas apostar grande; C-Bets de 25-33% pot comprometen stacks eficientemente.';
    } else if (texture.wetness === 'Seco (Dry)') {
      leakCategory = 'Desbalance en Flops Secos';
      prescriptiveFix = 'En texturas secas desconectadas, usa C-Bets pequeñas (33%) a alta frecuencia en vez de líneas polarizadas grandes.';
    } else if (texture.wetness === 'Coordinado (Wet)') {
      leakCategory = 'Falta de Protección en Boards Dinámicos';
      prescriptiveFix = 'En mesas coordinadas con draws abundantes, apuesta fuerte (66-75%) o haz check-raise para cobrar a los proyectos.';
    }

    const record: LearnerMistakeRecord = {
      id: `mistake-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      scenarioTitle: params.scenarioTitle,
      heroCombo: params.heroCombo,
      boardCards: params.boardCards.map(c => typeof c === 'string' ? c : `${c.rank}${c.suit}`),
      boardTexture: texture,
      street,
      heroPos: params.heroPos,
      villainPos: params.villainPos,
      potBB: params.potBB,
      chosenAction: params.chosenAction,
      bestAction: params.bestAction,
      chosenFrequency: params.chosenFrequency,
      bestFrequency: params.bestFrequency,
      evLossBB: params.evLossBB,
      evLossChips: params.evLossChips,
      evLossPercentOfPot: params.evLossPercentOfPot,
      isMistakeThresholdExceeded: true,
      grade: params.grade,
      leakCategory,
      prescriptiveFix
    };

    this.mistakes = [record, ...this.mistakes].slice(0, 150);
    this.saveToStorage();

    // Auto-sincronizar con el motor SM-2 de Spaced Repetition para programar el repaso
    try {
      SpacedRepetitionManager.getInstance().registerHand({
        heroCards: params.heroCombo,
        board: record.boardCards.join(' '),
        heroPos: params.heroPos,
        villainPos: params.villainPos,
        potBB: params.potBB,
        chosenAction: params.chosenAction,
        optimalAction: params.bestAction,
        evLossPct: params.evLossPercentOfPot,
        isMistake: true,
        category: leakCategory,
        keyTakeaway: prescriptiveFix
      });
    } catch (e) {}

    // Auto-sincronizar con el aprendizaje colectivo del servidor (/api/solver/learn-from-users)
    try {
      void SolverMetaUpdater.getInstance().reportUserDecision({
        texture: texture.wetness,
        street,
        chosenAction: params.chosenAction,
        bestAction: params.bestAction,
        evLossPct: params.evLossPercentOfPot
      });
    } catch (e) {}

    return record;
  }

  public getMistakes(): LearnerMistakeRecord[] {
    return [...this.mistakes];
  }

  public getCriticalMistakes(): LearnerMistakeRecord[] {
    return this.mistakes.filter(m => m.isMistakeThresholdExceeded || m.evLossPercentOfPot > 5.0);
  }

  /**
   * Agrupa los errores capturados e identifica patrones recurrentes de debilidad
   */
  public getWeaknessPatterns(): WeaknessPattern[] {
    if (this.mistakes.length === 0) return [];

    const textureGroups: Record<string, { count: number; totalEvLossBB: number; totalEvPct: number; records: LearnerMistakeRecord[] }> = {};

    this.mistakes.forEach(m => {
      const key = m.boardTexture.wetness;
      if (!textureGroups[key]) {
        textureGroups[key] = { count: 0, totalEvLossBB: 0, totalEvPct: 0, records: [] };
      }
      textureGroups[key].count += 1;
      textureGroups[key].totalEvLossBB += m.evLossBB;
      textureGroups[key].totalEvPct += m.evLossPercentOfPot;
      textureGroups[key].records.push(m);
    });

    const totalMistakes = this.mistakes.length;
    const patterns: WeaknessPattern[] = [];

    for (const [textureType, group] of Object.entries(textureGroups)) {
      const avgEvPct = Number((group.totalEvPct / group.count).toFixed(1));
      const freqPct = Math.round((group.count / totalMistakes) * 100);

      let severity: WeaknessPattern['severity'] = 'Media';
      if (group.count >= 3 || avgEvPct > 8.0) severity = 'Crítica';
      else if (group.count >= 2 || avgEvPct > 5.5) severity = 'Alta';

      let diagnosis = `Tiendes a cometer desviaciones con frecuencia en texturas de tipo ${textureType}.`;
      let recommendation = 'Repasa las reglas de sizing y frecuencias GTO para esta textura.';

      if (textureType.includes('Monótono')) {
        diagnosis = 'Sobre-apuestas parejas altas en boards monocolor cuando el rival puede tener color cerrado o proyecto nut.';
        recommendation = 'Check behind de control de bote con manos marginales. Reserva apuestas solo para manos con blocker As de ese palo.';
      } else if (textureType.includes('Coordinado')) {
        diagnosis = 'Apuestas demasiado pequeño o pasas en exceso en boards conectados, dando precio barato a los proyectos rivales.';
        recommendation = 'Aplica apuestas pesadas de 75% o check-raise polarizado para cobrar equity a los proyectos.';
      } else if (textureType.includes('Seco')) {
        diagnosis = 'Inclinación a polarizar con apuestas grandes en flops secos donde la ventaja de rango aconseja apuestas del 25-33%.';
        recommendation = 'Usa apuestas pequeñas de 1/3 pot con alta frecuencia para forzar el fold de las manos basura rivales.';
      } else if (textureType.includes('Emparejado')) {
        diagnosis = 'Dificultad para manejar botes con pares en mesa y determinar quién tiene ventaja de tríos y overpairs.';
        recommendation = 'C-bet de 25-33% pot para extraer valor de pares inferiores sin arriesgar fichas de más.';
      }

      patterns.push({
        patternId: `pat-${textureType.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
        title: `Fuga Recurrente en ${textureType}`,
        textureType,
        mistakeCount: group.count,
        totalEvLossBB: Number(group.totalEvLossBB.toFixed(2)),
        averageEvLossPercent: avgEvPct,
        frequencyPct: freqPct,
        severity,
        diagnosis,
        recommendation
      });
    }

    // Ordenar de mayor a menor número de errores y pérdida de EV
    return patterns.sort((a, b) => b.mistakeCount - a.mistakeCount || b.totalEvLossBB - a.totalEvLossBB);
  }

  public getLearnerSummary(): LearnerSummary {
    const patterns = this.getWeaknessPatterns();
    const critical = this.getCriticalMistakes();
    const totalLost = critical.reduce((acc, m) => acc + m.evLossBB, 0);

    const worstTexture = patterns.length > 0 ? patterns[0].textureType : 'Ninguna (Juego Sólido)';

    // Position analysis
    const posCounts: Record<string, number> = {};
    critical.forEach(m => {
      posCounts[m.heroPos] = (posCounts[m.heroPos] || 0) + 1;
    });
    let worstPosition = 'Sin datos';
    let maxPosCount = -1;
    for (const [pos, cnt] of Object.entries(posCounts)) {
      if (cnt > maxPosCount) {
        maxPosCount = cnt;
        worstPosition = pos;
      }
    }

    return {
      totalRecordedDecisions: this.totalRecordedDecisions,
      criticalMistakesCount: critical.length,
      totalEvLossBBLost: Number(totalLost.toFixed(2)),
      worstTexture,
      worstPosition,
      topWeaknessPatterns: patterns
    };
  }

  public clearMistakes(): void {
    this.mistakes = [];
    this.saveToStorage();
  }
}
