/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AutoLearningEngine: Motor de Auto-Aprendizaje, Recopilación de Manos y Repetición Espaciada SM-2.
 * Registra y analiza todas las decisiones del usuario (en Trainer, Quizzes de Academia y Wizard),
 * actualizando el perfil dinámico del jugador, detectando fugas en vivo y autogenerando
 * flashcards con el algoritmo SuperMemo SM-2 para garantizar la retención a largo plazo.
 */

import { SpacedRepetitionManager } from './spacedRepetition';

export interface HandHistoryRecord {
  id: string;
  timestamp: number;
  heroPos: string;
  villainPos: string;
  heroCards: string;
  board: string;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  category: string;
  potBB: number;
  chosenAction: string;
  optimalAction: string;
  evLossPct: number;
  isMistake: boolean; // >3% EV Loss
  keyTakeaway: string;
  sm2CardId?: string;
  sm2Repetitions?: number;
  sm2IntervalDays?: number;
  sm2EaseFactor?: number;
}

export interface PlayerDecisionRecord {
  id: string;
  timestamp: number;
  street: 'preflop' | 'flop' | 'turn' | 'river';
  category: string;
  heroCards?: string;
  board?: string;
  chosenAction: string;
  optimalAction: string;
  evLossPct: number;
  isMistake: boolean; // >3% EV Loss
  potBB: number;
  notes?: string;
}

export interface PlayerLearningProfile {
  totalDecisions: number;
  totalMistakes: number; // >3% EV loss
  averageEvLossPct: number;
  masteryScore: number; // 0 to 100
  styleProfile: 'Demasiado Pasivo' | 'Demasiado Agresivo' | 'Ligeramente Desbalanceado' | 'GTO Sólido';
  leakCategoryCounts: Record<string, number>;
  primaryLeak: {
    title: string;
    description: string;
    prescriptiveFix: string;
    impact: 'Alta' | 'Media' | 'Crítica';
  };
  liveTipForCurrentSpot: string;
  history: PlayerDecisionRecord[];
  collectedHands: HandHistoryRecord[];
  sm2TotalCards: number;
  sm2DueCardsCount: number;
}

const STORAGE_KEY = 'lab_studio_player_learning_profile';
const SM2_STORAGE_KEY = 'lab_studio_sm2_flashcards';

const DEFAULT_PROFILE: PlayerLearningProfile = {
  totalDecisions: 24,
  totalMistakes: 4,
  averageEvLossPct: 3.2,
  masteryScore: 84,
  styleProfile: 'Ligeramente Desbalanceado',
  leakCategoryCounts: {
    'Botes 3-Bet': 2,
    'Flops Monótonos': 1,
    'Flops Secos': 0,
    'Squeeze': 1,
    'River Bluff Catching': 0
  },
  primaryLeak: {
    title: 'Sobre-apuesta de tamaño en Botes 3-Bet',
    description: 'En botes 3-Bet con SPR bajo (~4), tiendes a apostar 66%-75% del bote cuando la teoría óptima aconseja 25%-33% para mantener pagando al rango dominado.',
    prescriptiveFix: 'Reduce tu tamaño de C-Bet en 3-Bet pots a 1/3 del bote. Ahorras fichas y extraes más de manos medias rivales.',
    impact: 'Crítica'
  },
  liveTipForCurrentSpot: 'El sistema ha auto-aprendido: En esta situación, prioriza una C-Bet barata (33% pot) en vez de inflar el bote.',
  history: [],
  collectedHands: [
    {
      id: 'hh-seed-1',
      timestamp: Date.now() - 3600000 * 2,
      heroPos: 'BTN',
      villainPos: 'BB',
      heroCards: 'As Kd',
      board: 'Kh 7c 2s',
      street: 'flop',
      category: 'Flop Seco (Dry)',
      potBB: 6.5,
      chosenAction: 'Bet 33% Pot',
      optimalAction: 'Bet 33% Pot',
      evLossPct: 0,
      isMistake: false,
      keyTakeaway: 'C-Bet pequeña en flop seco con ventaja de rango y valor directo.',
      sm2Repetitions: 2,
      sm2IntervalDays: 6,
      sm2EaseFactor: 2.6
    },
    {
      id: 'hh-seed-2',
      timestamp: Date.now() - 3600000 * 5,
      heroPos: 'BB',
      villainPos: 'BTN',
      heroCards: 'Ad 5d',
      board: 'Ah 8s 3c',
      street: 'flop',
      category: 'Botes 3-Bet',
      potBB: 19.5,
      chosenAction: 'Bet 75% Pot',
      optimalAction: 'Bet 25% - 33% Pot',
      evLossPct: 6.8,
      isMistake: true,
      keyTakeaway: 'En botes 3-Bet el SPR es bajo; apostar grande aísla tu mano contra monstruos.',
      sm2Repetitions: 0,
      sm2IntervalDays: 1,
      sm2EaseFactor: 2.3
    }
  ],
  sm2TotalCards: 3,
  sm2DueCardsCount: 3
};

/**
 * Función matemática SM-2 pura
 */
export function calculateSM2(
  quality: number, // 0 to 5
  previousInterval: number,
  previousRepetitions: number,
  previousEaseFactor: number
): { intervalDays: number; repetitions: number; easeFactor: number; nextReviewDate: number } {
  let intervalDays = previousInterval;
  let repetitions = previousRepetitions;
  let easeFactor = previousEaseFactor;

  if (quality >= 3) {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(previousInterval * easeFactor);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    intervalDays = 1;
  }

  // Factor de Facilidad: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  const qDiff = 5 - quality;
  easeFactor = easeFactor + (0.1 - qDiff * (0.08 + qDiff * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;

  const nextReviewDate = Date.now() + intervalDays * 86400000;

  return {
    intervalDays,
    repetitions,
    easeFactor: Number(easeFactor.toFixed(2)),
    nextReviewDate
  };
}

export class AutoLearningEngine {
  private static instance: AutoLearningEngine;
  private profile: PlayerLearningProfile;

  private constructor() {
    this.profile = this.loadProfile();
    this.updateSM2Counts();
  }

  public static getInstance(): AutoLearningEngine {
    if (!AutoLearningEngine.instance) {
      AutoLearningEngine.instance = new AutoLearningEngine();
    }
    return AutoLearningEngine.instance;
  }

  private loadProfile(): PlayerLearningProfile {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        return {
          ...DEFAULT_PROFILE,
          ...parsed,
          collectedHands: parsed.collectedHands || DEFAULT_PROFILE.collectedHands,
          leakCategoryCounts: parsed.leakCategoryCounts || DEFAULT_PROFILE.leakCategoryCounts
        };
      }
    } catch (e) {
      // fallback
    }
    return DEFAULT_PROFILE;
  }

  private saveProfile(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      // ignore
    }
  }

  public getProfile(): PlayerLearningProfile {
    this.updateSM2Counts();
    return { ...this.profile };
  }

  /**
   * Actualiza el conteo de tarjetas SM-2 sincronizadas en localStorage
   */
  public updateSM2Counts(): void {
    try {
      const raw = localStorage.getItem(SM2_STORAGE_KEY);
      if (raw) {
        const cards = JSON.parse(raw);
        if (Array.isArray(cards)) {
          this.profile.sm2TotalCards = cards.length;
          this.profile.sm2DueCardsCount = cards.filter(
            (c: { nextReviewDate?: number }) => (c.nextReviewDate || 0) <= Date.now()
          ).length;
        }
      }
    } catch (e) {}
  }

  /**
   * Registra una decisión puntual (ej. click en Quiz o Trainer)
   */
  public recordDecision(decision: Omit<PlayerDecisionRecord, 'id' | 'timestamp'>): PlayerLearningProfile {
    const fullRecord: PlayerDecisionRecord = {
      ...decision,
      id: `dec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now()
    };

    const newHistory = [fullRecord, ...this.profile.history].slice(0, 100);
    const newTotalDecisions = this.profile.totalDecisions + 1;
    const isMistake = decision.evLossPct > 3.0;
    const newTotalMistakes = this.profile.totalMistakes + (isMistake ? 1 : 0);

    // Update leak categories
    const newLeakCounts = { ...this.profile.leakCategoryCounts };
    if (isMistake) {
      newLeakCounts[decision.category] = (newLeakCounts[decision.category] || 0) + 1;
    }

    // Compute average EV loss
    const totalEvLoss = newHistory.reduce((acc, h) => acc + h.evLossPct, 0);
    const newAverageEvLoss = Number((totalEvLoss / Math.max(1, newHistory.length)).toFixed(2));

    // Compute Mastery Score
    const accuracyPct = Math.max(0, 100 - (newTotalMistakes / Math.max(1, newTotalDecisions)) * 100);
    const newMastery = Math.round(accuracyPct * 0.7 + (100 - Math.min(100, newAverageEvLoss * 10)) * 0.3);

    // Determine style profile
    let style: PlayerLearningProfile['styleProfile'] = 'GTO Sólido';
    if (newAverageEvLoss > 8.0) {
      style = 'Demasiado Pasivo';
    } else if (newAverageEvLoss > 4.5) {
      style = 'Ligeramente Desbalanceado';
    }

    // Find highest leak category
    let maxLeakCat = 'Botes 3-Bet';
    let maxCount = -1;
    for (const [cat, cnt] of Object.entries(newLeakCounts)) {
      if (cnt > maxCount) {
        maxCount = cnt;
        maxLeakCat = cat;
      }
    }

    const primaryLeak = this.getLeakDetails(maxLeakCat);

    this.profile = {
      ...this.profile,
      totalDecisions: newTotalDecisions,
      totalMistakes: newTotalMistakes,
      averageEvLossPct: newAverageEvLoss,
      masteryScore: newMastery,
      styleProfile: style,
      leakCategoryCounts: newLeakCounts,
      primaryLeak,
      liveTipForCurrentSpot: `Auto-Learning: Detectada vulnerabilidad en ${maxLeakCat}. ${primaryLeak.prescriptiveFix}`,
      history: newHistory
    };

    this.saveProfile();
    return this.profile;
  }

  /**
   * Recopila una mano analizada o jugada (desde Wizard, Quizzes o Trainer).
   * Si es un error o el usuario pide guardarla, crea o actualiza automáticamente una tarjeta SM-2.
   */
  public collectHand(hand: Omit<HandHistoryRecord, 'id' | 'timestamp'>): HandHistoryRecord {
    const id = `hh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const fullHand: HandHistoryRecord = {
      ...hand,
      id,
      timestamp: Date.now()
    };

    // Auto-generar tarjeta SM-2 en localStorage para que el usuario repase este spot
    const sm2CardId = this.autoSyncToSM2Flashcard(fullHand);
    fullHand.sm2CardId = sm2CardId;

    // Registrar también en el nuevo motor universal SpacedRepetitionManager
    try {
      SpacedRepetitionManager.getInstance().registerHand({
        heroCards: hand.heroCards,
        board: hand.board,
        heroPos: hand.heroPos,
        villainPos: hand.villainPos,
        potBB: hand.potBB,
        chosenAction: hand.chosenAction,
        optimalAction: hand.optimalAction,
        evLossPct: hand.evLossPct,
        isMistake: hand.isMistake,
        category: hand.category,
        keyTakeaway: hand.keyTakeaway
      });
    } catch (e) {}

    const updatedHands = [fullHand, ...(this.profile.collectedHands || [])].slice(0, 150);
    this.profile.collectedHands = updatedHands;

    // Registrar también la decisión general
    this.recordDecision({
      street: hand.street,
      category: hand.category,
      heroCards: hand.heroCards,
      board: hand.board,
      chosenAction: hand.chosenAction,
      optimalAction: hand.optimalAction,
      evLossPct: hand.evLossPct,
      isMistake: hand.isMistake,
      potBB: hand.potBB,
      notes: hand.keyTakeaway
    });

    this.updateSM2Counts();
    this.saveProfile();
    return fullHand;
  }

  /**
   * Inserta o actualiza una tarjeta en la base de datos SM-2 automáticamente
   */
  private autoSyncToSM2Flashcard(hand: HandHistoryRecord): string {
    try {
      const raw = localStorage.getItem(SM2_STORAGE_KEY);
      const cards = raw ? JSON.parse(raw) : [];

      const cardId = `fc-auto-${Date.now()}`;
      const newCard = {
        id: cardId,
        question: `Spot [${hand.category}] ${hand.heroPos} vs ${hand.villainPos} | Hero: ${hand.heroCards} | Board: ${hand.board || 'Preflop'} | Bote: ${hand.potBB} BB. ¿Cuál es la acción y sizing matemáticamente óptimo?`,
        answer: `Acción Óptima: ${hand.optimalAction} (Tu elección fue: "${hand.chosenAction}" con pérdida de EV: ${hand.evLossPct.toFixed(1)}%).`,
        category: hand.category,
        situationContext: `Calle: ${hand.street.toUpperCase()} · Posiciones: Hero (${hand.heroPos}) vs Villano (${hand.villainPos}) · Bote: ${hand.potBB} BB`,
        keyRule: hand.keyTakeaway || 'Aplica la regla de oro GTO para esta textura y tamaño de bote.',
        intervalDays: 1,
        repetitions: 0,
        easeFactor: 2.5,
        nextReviewDate: Date.now(), // Pendiente para repasar HOY
        createdDate: Date.now(),
        isAutoCaptured: true,
        evLossPct: hand.evLossPct
      };

      // Si ya existía una parecida, la ponemos al frente con review pendiente
      const filtered = cards.filter((c: { question?: string }) => c.question !== newCard.question);
      localStorage.setItem(SM2_STORAGE_KEY, JSON.stringify([newCard, ...filtered]));
      return cardId;
    } catch (e) {
      return `fc-fallback-${Date.now()}`;
    }
  }

  private getLeakDetails(category: string): PlayerLearningProfile['primaryLeak'] {
    if (category.includes('3-Bet')) {
      return {
        title: 'Sizing descalibrado en Botes 3-Bet',
        description: 'Apuestas demasiado fuerte en botes 3-Bet, provocando que los peores rivales foldeen y solo te paguen manos superiores.',
        prescriptiveFix: 'Usa C-Bets de 25% a 33% del bote en 3-Bet pots para mantener el SPR manejable y comprometer al rival con sus segundas parejas.',
        impact: 'Crítica'
      };
    } else if (category.includes('Monótono') || category.includes('monotone')) {
      return {
        title: 'Sobre-inversión en Flops Monocolor sin Blocker',
        description: 'Continuar apostando manos como parejas altas sin la carta del palo del color expone tu stack a check-raises devastadores.',
        prescriptiveFix: 'Chequea detrás para control de bote en mesas de 3 cartas del mismo palo a menos que tengas el As de ese palo.',
        impact: 'Alta'
      };
    } else if (category.includes('Seco') || category.includes('dry')) {
      return {
        title: 'Falta de agresividad en Mesas Secas (Dry)',
        description: 'Pasar en flops secos donde Hero tiene clara ventaja de cartas altas pierde valor inmediato.',
        prescriptiveFix: 'Apuesta 33% del bote con alta frecuencia (>75%) en texturas secas con As o Rey alto.',
        impact: 'Media'
      };
    } else if (category.includes('Bluff') || category.includes('River')) {
      return {
        title: 'Bluff-Catching desbalanceado en River',
        description: 'Pagas apuestas grandes en river sin considerar si los draws fallidos tienen sentido en el rango del villano.',
        prescriptiveFix: 'Compara las pot odds: si necesitas 30% de equity, asegúrate de que el villano tenga al menos 1 combo de farol creíble por cada 2 de valor.',
        impact: 'Alta'
      };
    }

    return {
      title: 'Desviación en selección de sizings postflop',
      description: 'Tendencia a aplicar sizings estáticos sin calibrar la textura ni el perfil del oponente.',
      prescriptiveFix: 'Adapta tu sizing: 33% en secos y 3-Bet pots; 75% en mesas coordinadas contra Calling Stations.',
      impact: 'Media'
    };
  }

  public resetStats(): void {
    this.profile = {
      ...DEFAULT_PROFILE,
      history: [],
      collectedHands: []
    };
    this.saveProfile();
  }
}
