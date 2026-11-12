/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * SpacedRepetition (SM-2 Engine): Motor universal del Algoritmo SuperMemo SM-2.
 * Gestiona la retención a largo plazo tanto de conceptos teóricos (estrategias, sizings,
 * reglas por textura en AcademyRoadmapDashboard) como del historial de manos recopiladas.
 * Permite que el usuario marque activamente la dificultad de recuerdo (0 a 5) y calcula
 * la fecha óptima del próximo repaso según la curva de olvido de Ebbinghaus.
 */

export type SM2ItemType = 'concept' | 'hand' | 'scenario';

export interface SM2ReviewLog {
  timestamp: number;
  quality: number; // 0 to 5
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}

export interface SM2Item {
  id: string;
  type: SM2ItemType;
  title: string;
  category: string;
  content: {
    prompt: string;
    explanation: string;
    rule: string;
    context?: string;
  };
  handData?: {
    heroCards: string;
    board: string;
    heroPos: string;
    villainPos: string;
    potBB: number;
    chosenAction: string;
    optimalAction: string;
    evLossPct: number;
    isMistake: boolean;
  };
  intervalDays: number;
  repetitions: number;
  easeFactor: number; // Minimum 1.3, default 2.5
  nextReviewDate: number; // timestamp
  createdDate: number;
  lastReviewedDate?: number;
  reviewCount: number;
  history: SM2ReviewLog[];
}

export interface SM2Stats {
  totalItems: number;
  totalConcepts: number;
  totalHands: number;
  dueTodayCount: number;
  masteredCount: number; // repetitions >= 3 and easeFactor >= 2.4
  averageEaseFactor: number;
  retentionRatePct: number;
}

export const SM2_QUALITY_RATINGS = [
  {
    grade: 0,
    label: '0: Olvido Total',
    shortDesc: 'Blackout absoluto',
    detail: 'No recordaba el concepto ni la línea en absoluto. Repaso inmediato hoy.',
    badgeClass: 'bg-red-950 text-red-300 border-red-800 hover:bg-red-900',
    scheduleText: 'Repasar Hoy'
  },
  {
    grade: 1,
    label: '1: Error Grave',
    shortDesc: 'Fallo sustancial',
    detail: 'Elegí la acción contraria; la solución me resulta conocida pero no la dominaba. Repaso hoy.',
    badgeClass: 'bg-red-900/60 text-red-200 border-red-700 hover:bg-red-900/80',
    scheduleText: 'Repasar Hoy'
  },
  {
    grade: 2,
    label: '2: Dudé y Fallé',
    shortDesc: 'Duda incorrecta',
    detail: 'Estaba entre dos opciones y me equivoqué por falta de fundamentos claros. Repaso hoy.',
    badgeClass: 'bg-amber-950 text-amber-300 border-amber-800 hover:bg-amber-900',
    scheduleText: 'Repasar Hoy'
  },
  {
    grade: 3,
    label: '3: Correcto Difícil',
    shortDesc: 'Acierto con esfuerzo',
    detail: 'Acerté la línea óptima pero necesité tiempo y esfuerzo mental para deducirla.',
    badgeClass: 'bg-blue-950 text-blue-300 border-blue-800 hover:bg-blue-900',
    scheduleText: '+1 a +6 días'
  },
  {
    grade: 4,
    label: '4: Correcto Ligero',
    shortDesc: 'Acierto con poca duda',
    detail: 'Respuesta correcta tras breve vacilación. Concepto afianzado en la memoria.',
    badgeClass: 'bg-emerald-950 text-emerald-300 border-emerald-800 hover:bg-emerald-900',
    scheduleText: 'Intervalo Expandido'
  },
  {
    grade: 5,
    label: '5: Memoria Perfecta',
    shortDesc: 'Instantáneo',
    detail: 'Respuesta inmediata e inequívoca sin dudar. Dominio pleno del spot.',
    badgeClass: 'bg-emerald-900 text-emerald-100 border-emerald-600 hover:bg-emerald-800',
    scheduleText: 'Intervalo Máximo'
  }
] as const;

export const SM2_STORAGE_KEY = 'lab_studio_spaced_repetition_items';
export const SM2_UPDATE_EVENT = 'spaced-repetition-updated';

/**
 * Función matemática pura del algoritmo SuperMemo SM-2:
 * 
 * EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
 * Con EF' >= 1.3
 * 
 * Si q >= 3:
 *   repeticiones == 0 -> intervalo = 1 día
 *   repeticiones == 1 -> intervalo = 6 días
 *   repeticiones >= 2 -> intervalo = round(intervalo_anterior * EF')
 *   repeticiones += 1
 * Si q < 3:
 *   repeticiones = 0
 *   intervalo = 1 día (repaso forzado hoy / mañana)
 */
export function calculateSM2NextState(
  currentState: { intervalDays: number; repetitions: number; easeFactor: number },
  quality: number
): { intervalDays: number; repetitions: number; easeFactor: number; nextReviewDate: number } {
  let { intervalDays, repetitions, easeFactor } = currentState;

  if (quality >= 3) {
    if (repetitions === 0) {
      intervalDays = 1;
    } else if (repetitions === 1) {
      intervalDays = 6;
    } else {
      intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    intervalDays = 1;
  }

  // Actualizar Factor de Facilidad (Ease Factor)
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

const SEED_ITEMS: SM2Item[] = [
  {
    id: 'sm2-concept-dry-flop',
    type: 'concept',
    title: 'Sizing en Flop Seco K-high (K72r)',
    category: 'Flops Secos (Dry)',
    content: {
      prompt: 'Hero en BTN vs BB en mesa K72r tras pasar el rival. ¿Qué sizing y lógica aplicamos?',
      explanation: 'Hero tiene una ventaja aplastante de overcards y parejas altas. Una C-Bet de 33% del bote (pequeña) extrae valor de flotaciones y fuerza a BB a foldear hasta el 60% de su basura sin arriesgar fichas de más.',
      rule: 'En mesas secas con ventaja de rango, apuesta pequeño (25-33%) a alta frecuencia.',
      context: 'Single Raised Pot (SRP) BTN vs BB, SPR ~14'
    },
    intervalDays: 1,
    repetitions: 0,
    easeFactor: 2.5,
    nextReviewDate: Date.now(),
    createdDate: Date.now() - 86400000,
    reviewCount: 0,
    history: []
  },
  {
    id: 'sm2-concept-3bet-pot',
    type: 'concept',
    title: 'Sizing en Botes 3-Bet con SPR Bajo (~4)',
    category: 'Botes 3-Bet',
    content: {
      prompt: 'En bote 3-Bet con As en el flop (A83r), ¿por qué se desaconseja apostar 75% pot?',
      explanation: 'El SPR ya está reducido a ~4.5. Apostar grande aísla tu mano únicamente contra monstruos superiores y hace foldear manos peores que pagarían una apuesta pequeña de 25-33% pot.',
      rule: 'En botes 3-Bet con SPR bajo, una apuesta de 1/3 del bote basta para comprometer stacks.',
      context: '3-Bet Pot Preflop, rangos condensados'
    },
    intervalDays: 1,
    repetitions: 0,
    easeFactor: 2.5,
    nextReviewDate: Date.now(),
    createdDate: Date.now() - 86400000,
    reviewCount: 0,
    history: []
  },
  {
    id: 'sm2-concept-river-station',
    type: 'concept',
    title: 'Explotación en River ante Calling Stations',
    category: 'River & Explotación',
    content: {
      prompt: 'Llegas al River con draw fallido (aire puro) ante un jugador pasivo que pagó Flop y Turn. ¿Acción?',
      explanation: 'Rendición absoluta (Check-Fold). Los Calling Stations carecen de botón de fold; intentar faroles en el river contra perfiles pasivos es la fuga de dinero más costosa del poker.',
      rule: 'Cero faroles puros en el river contra jugadores que no foldean pares débiles.',
      context: 'River Showdown vs rival pasivo con WTSD > 38%'
    },
    intervalDays: 2,
    repetitions: 1,
    easeFactor: 2.6,
    nextReviewDate: Date.now(),
    createdDate: Date.now() - 172800000,
    reviewCount: 1,
    history: []
  }
];

export class SpacedRepetitionManager {
  private static instance: SpacedRepetitionManager;
  private items: Map<string, SM2Item> = new Map();

  private constructor() {
    this.loadFromStorage();
  }

  public static getInstance(): SpacedRepetitionManager {
    if (!SpacedRepetitionManager.instance) {
      SpacedRepetitionManager.instance = new SpacedRepetitionManager();
    }
    return SpacedRepetitionManager.instance;
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(SM2_STORAGE_KEY);
      if (raw) {
        const parsed: SM2Item[] = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.items.clear();
          parsed.forEach(item => this.items.set(item.id, item));
          return;
        }
      }
    } catch (e) {
      // fallback
    }

    // Seed defaults
    this.items.clear();
    SEED_ITEMS.forEach(item => this.items.set(item.id, item));
    this.saveToStorage();
  }

  private saveToStorage(): void {
    try {
      const list = Array.from(this.items.values());
      localStorage.setItem(SM2_STORAGE_KEY, JSON.stringify(list));
      window.dispatchEvent(new Event(SM2_UPDATE_EVENT));
    } catch (e) {
      // ignore
    }
  }

  public getAllItems(): SM2Item[] {
    return Array.from(this.items.values());
  }

  public getItem(id: string): SM2Item | undefined {
    return this.items.get(id);
  }

  public getItemsByType(type: SM2ItemType): SM2Item[] {
    return this.getAllItems().filter(i => i.type === type);
  }

  public getDueItems(): SM2Item[] {
    const now = Date.now();
    return this.getAllItems().filter(i => i.nextReviewDate <= now);
  }

  public getStats(): SM2Stats {
    const all = this.getAllItems();
    const now = Date.now();
    const dueCount = all.filter(i => i.nextReviewDate <= now).length;
    const mastered = all.filter(i => i.repetitions >= 3 && i.easeFactor >= 2.4).length;
    const totalEF = all.reduce((acc, i) => acc + i.easeFactor, 0);
    const concepts = all.filter(i => i.type === 'concept').length;
    const hands = all.filter(i => i.type === 'hand').length;

    return {
      totalItems: all.length,
      totalConcepts: concepts,
      totalHands: hands,
      dueTodayCount: dueCount,
      masteredCount: mastered,
      averageEaseFactor: Number((totalEF / Math.max(1, all.length)).toFixed(2)),
      retentionRatePct: all.length > 0 ? Math.round((mastered / all.length) * 100) : 0
    };
  }

  /**
   * Registra o actualiza la dificultad de un concepto aprendido
   */
  public rateItem(itemId: string, quality: number): SM2Item | null {
    const item = this.items.get(itemId);
    if (!item) return null;

    const nextState = calculateSM2NextState(
      {
        intervalDays: item.intervalDays,
        repetitions: item.repetitions,
        easeFactor: item.easeFactor
      },
      quality
    );

    const log: SM2ReviewLog = {
      timestamp: Date.now(),
      quality,
      intervalDays: nextState.intervalDays,
      easeFactor: nextState.easeFactor,
      repetitions: nextState.repetitions
    };

    const updatedItem: SM2Item = {
      ...item,
      intervalDays: nextState.intervalDays,
      repetitions: nextState.repetitions,
      easeFactor: nextState.easeFactor,
      nextReviewDate: nextState.nextReviewDate,
      lastReviewedDate: Date.now(),
      reviewCount: item.reviewCount + 1,
      history: [log, ...item.history].slice(0, 50)
    };

    this.items.set(itemId, updatedItem);
    this.saveToStorage();
    return updatedItem;
  }

  /**
   * Registra o sincroniza un concepto desde AcademyRoadmapDashboard
   */
  public registerOrUpdateConcept(concept: {
    id: string;
    title: string;
    category: string;
    prompt: string;
    explanation: string;
    rule: string;
    context?: string;
    initialQuality?: number;
  }): SM2Item {
    const existing = this.items.get(concept.id);

    if (existing) {
      if (concept.initialQuality !== undefined) {
        return this.rateItem(concept.id, concept.initialQuality) || existing;
      }
      return existing;
    }

    const newItem: SM2Item = {
      id: concept.id,
      type: 'concept',
      title: concept.title,
      category: concept.category,
      content: {
        prompt: concept.prompt,
        explanation: concept.explanation,
        rule: concept.rule,
        context: concept.context
      },
      intervalDays: 1,
      repetitions: 0,
      easeFactor: 2.5,
      nextReviewDate: Date.now(),
      createdDate: Date.now(),
      reviewCount: 0,
      history: []
    };

    if (concept.initialQuality !== undefined) {
      const nextState = calculateSM2NextState(
        { intervalDays: 1, repetitions: 0, easeFactor: 2.5 },
        concept.initialQuality
      );
      newItem.intervalDays = nextState.intervalDays;
      newItem.repetitions = nextState.repetitions;
      newItem.easeFactor = nextState.easeFactor;
      newItem.nextReviewDate = nextState.nextReviewDate;
      newItem.lastReviewedDate = Date.now();
      newItem.reviewCount = 1;
      newItem.history = [{
        timestamp: Date.now(),
        quality: concept.initialQuality,
        intervalDays: nextState.intervalDays,
        easeFactor: nextState.easeFactor,
        repetitions: nextState.repetitions
      }];
    }

    this.items.set(newItem.id, newItem);
    this.saveToStorage();
    return newItem;
  }

  /**
   * Registra una mano en el sistema de repetición espaciada
   */
  public registerHand(hand: {
    heroCards: string;
    board: string;
    heroPos: string;
    villainPos: string;
    potBB: number;
    chosenAction: string;
    optimalAction: string;
    evLossPct: number;
    isMistake: boolean;
    category: string;
    keyTakeaway: string;
  }): SM2Item {
    const id = `sm2-hand-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newItem: SM2Item = {
      id,
      type: 'hand',
      title: `Mano [${hand.category}]: ${hand.heroPos} vs ${hand.villainPos} (${hand.heroCards})`,
      category: hand.category,
      content: {
        prompt: `Hero con ${hand.heroCards} en ${hand.heroPos} contra ${hand.villainPos}. Board: ${hand.board || 'Preflop'}. Bote: ${hand.potBB} BB. ¿Acción óptima?`,
        explanation: `Línea Óptima: ${hand.optimalAction}. Tu decisión: "${hand.chosenAction}" (Pérdida EV: ${hand.evLossPct.toFixed(1)}%).`,
        rule: hand.keyTakeaway,
        context: `Bote: ${hand.potBB} BB · Posiciones: ${hand.heroPos} vs ${hand.villainPos}`
      },
      handData: {
        heroCards: hand.heroCards,
        board: hand.board,
        heroPos: hand.heroPos,
        villainPos: hand.villainPos,
        potBB: hand.potBB,
        chosenAction: hand.chosenAction,
        optimalAction: hand.optimalAction,
        evLossPct: hand.evLossPct,
        isMistake: hand.isMistake
      },
      intervalDays: 1,
      repetitions: 0,
      easeFactor: hand.isMistake ? 2.3 : 2.5,
      nextReviewDate: Date.now(), // Pendiente para repasar hoy
      createdDate: Date.now(),
      reviewCount: 0,
      history: []
    };

    this.items.set(id, newItem);
    this.saveToStorage();
    return newItem;
  }

  public deleteItem(id: string): boolean {
    const deleted = this.items.delete(id);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }
}
