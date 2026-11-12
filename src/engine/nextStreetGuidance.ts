/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Next Street GTO Guidance Engine & Runout Analyzer.
 * Analyzes board textures, street transitions (Flop -> Turn -> River),
 * runout impact categories, and generates human-readable tactical plans.
 */

import { Card, Rank, Suit, RANKS, SUITS, RANK_VALUES, cardId, cardToString } from './cards';
import { evaluateCards, HandCategory, HAND_CATEGORY_NAMES } from './evaluator';

export type Street = 'flop' | 'turn' | 'river';

export type RunoutCategory = 'OVERCARD' | 'DRAW_COMPLETER' | 'PAIR_BOARD' | 'BRICK';

export interface BoardTextureAnalysis {
  highRank: Rank;
  highValue: number;
  isPaired: boolean;
  pairRank?: Rank;
  isMonotone: boolean; // 3+ of same suit
  isTwoTone: boolean;
  isRainbow: boolean;
  flushSuit?: Suit;
  flushCount: number;
  isConnected: boolean;
  textureLabel: string;
  summary: string;
}

export interface RunoutImpact {
  card: Card;
  category: RunoutCategory;
  categoryTitle: string;
  favorsRole: 'HERO' | 'VILLAIN' | 'NEUTRAL';
  favorsExplanation: string;
  equityShiftEstimate: number; // e.g. +5% or -8%
  recommendedAction: 'BET' | 'CHECK' | 'CALL' | 'FOLD' | 'CHECK_RAISE' | 'POT_CONTROL';
  recommendedBetSize: string;
  recommendedFrequencies: {
    bet: number;
    check: number;
    call?: number;
    fold?: number;
  };
  heroHandBefore?: string;
  heroHandAfter?: string;
  tacticalAdvice: string;
}

export interface StreetGuidancePlan {
  currentStreet: Street;
  nextStreet: Street | 'showdown';
  boardTexture: BoardTextureAnalysis;
  lineSummary: string;
  initiativeRole: 'HERO' | 'VILLAIN' | 'NEUTRAL';
  rangeAdvantage: string;
  coreObjectives: string[];
  runoutCategories: {
    category: RunoutCategory;
    title: string;
    description: string;
    heroStrategy: string;
    recommendedSizing: string;
    exampleCards: string;
  }[];
  tacticalHandMatrix: {
    categoryName: string;
    handsDescription: string;
    action: string;
    sizing: string;
    reasoning: string;
    color: string;
  }[];
}

/**
 * Analyzes the texture of the current community board.
 */
export function analyzeBoardTexture(board: Card[]): BoardTextureAnalysis {
  if (board.length === 0) {
    return {
      highRank: 'A',
      highValue: 12,
      isPaired: false,
      isMonotone: false,
      isTwoTone: false,
      isRainbow: false,
      flushCount: 0,
      isConnected: false,
      textureLabel: 'Preflop',
      summary: 'Sin cartas comunitarias.'
    };
  }

  // Find highest rank
  let maxVal = -1;
  let maxRank: Rank = '2';
  const rankCounts: Record<string, number> = {};
  const suitCounts: Record<Suit, number> = { s: 0, h: 0, d: 0, c: 0 };

  for (const c of board) {
    const val = RANK_VALUES[c.rank];
    if (val > maxVal) {
      maxVal = val;
      maxRank = c.rank;
    }
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1;
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
  }

  // Check pairs
  let isPaired = false;
  let pairRank: Rank | undefined;
  for (const [r, count] of Object.entries(rankCounts)) {
    if (count >= 2) {
      isPaired = true;
      pairRank = r as Rank;
      break;
    }
  }

  // Check suits
  let maxSuitCount = 0;
  let flushSuit: Suit | undefined;
  for (const s of SUITS) {
    if (suitCounts[s] > maxSuitCount) {
      maxSuitCount = suitCounts[s];
      flushSuit = s;
    }
  }

  const isMonotone = maxSuitCount >= 3;
  const isTwoTone = maxSuitCount === 2;
  const isRainbow = maxSuitCount === 1;

  // Check connectivity (differences between sorted unique ranks)
  const uniqueVals = Array.from(new Set(board.map(c => RANK_VALUES[c.rank]))).sort((a, b) => a - b);
  let isConnected = false;
  if (uniqueVals.length >= 2) {
    for (let i = 0; i < uniqueVals.length - 1; i++) {
      if (uniqueVals[i + 1] - uniqueVals[i] <= 2) {
        isConnected = true;
        break;
      }
    }
  }

  // Build descriptive label
  const parts: string[] = [];
  if (maxVal >= 11) parts.push(`${maxRank}-High`);
  else if (maxVal >= 8) parts.push(`Media (${maxRank}-High)`);
  else parts.push(`Baja (${maxRank}-High)`);

  if (isPaired) parts.push(`Pareado (${pairRank}${pairRank})`);
  else if (isMonotone) parts.push('Monocolor (3+ mismo palo)');
  else if (isTwoTone) parts.push('Dos Palos (Two-Tone)');
  else parts.push('Arcoíris (Rainbow)');

  if (isConnected && !isPaired) parts.push('Conectado');
  else if (!isConnected && !isPaired) parts.push('Seco / Desconectado');

  const textureLabel = parts.join(' · ');

  let summary = '';
  if (isMonotone) {
    summary = 'Tablero muy dinámico con proyecto de color completado o inminente. Las frecuencias de apuesta bajan y se prioriza el pot control.';
  } else if (isPaired) {
    summary = 'Tablero estático con reducción drástica de combinaciones ligadas por el rival. Favorable para c-bets pequeñas y faroles selectivos.';
  } else if (maxVal >= 11 && !isConnected) {
    summary = 'Tablero seco con cartas altas, con gran ventaja de rango para el agresor preflop. Alta frecuencia de c-bet pequeña.';
  } else if (isConnected) {
    summary = 'Tablero dinámico con muchos proyectos de escalera y combinaciones medias. Favorece rangos condensados de defensa.';
  } else {
    summary = 'Tablero neutral de textura media.';
  }

  return {
    highRank: maxRank,
    highValue: maxVal,
    isPaired,
    pairRank,
    isMonotone,
    isTwoTone,
    isRainbow,
    flushSuit,
    flushCount: maxSuitCount,
    isConnected,
    textureLabel,
    summary
  };
}

/**
 * Builds the comprehensive tactical guide for the next street given the current street, board, and action line.
 */
export function buildStreetGuidancePlan(
  currentStreet: Street,
  board: Card[],
  heroPos: string,
  villainPos: string,
  heroRole: 'IP' | 'OOP',
  history: string[]
): StreetGuidancePlan {
  const nextStreet: Street | 'showdown' =
    currentStreet === 'flop' ? 'turn' : currentStreet === 'turn' ? 'river' : 'showdown';

  const boardTexture = analyzeBoardTexture(board);

  // Analyze the line taken
  const lastAction = history[history.length - 1] || 'root';
  const hasBets = history.some(a => a.toLowerCase().includes('bet') || a.toLowerCase().includes('raise'));
  const isCheckCheck = history.filter(a => a.toLowerCase().includes('check')).length >= 2 && !hasBets;
  const isBetCall = history.some(a => a.toLowerCase().includes('call')) && hasBets;

  let lineSummary = '';
  let initiativeRole: 'HERO' | 'VILLAIN' | 'NEUTRAL' = 'NEUTRAL';
  let rangeAdvantage = '';

  if (isCheckCheck) {
    lineSummary = 'Línea Pasiva (Check - Check): Bote no inflado, rangos amplios y relativamente intactos.';
    initiativeRole = heroRole === 'IP' ? 'HERO' : 'VILLAIN';
    rangeAdvantage = heroRole === 'IP'
      ? 'Como jugador en posición (IP), tomas el control. Tienes oportunidad de "Delayed C-Bet" ante cualquier debilidad en la siguiente calle.'
      : 'Estando fuera de posición (OOP) tras check-check, el rival en posición tiene ventaja de realización de equity. Mantén disciplina defensiva.';
  } else if (isBetCall) {
    lineSummary = 'Línea de Apuesta y Call: Bote inflado. Rango del agresor polarizado/no capeado; rango del pagador condensado.';
    initiativeRole = 'HERO'; // Assumes Hero will play the street
    rangeAdvantage = 'El agresor mantiene la ventaja de cartas fuertes (nuts y overpairs). El pagador retiene proyectos y parejas medias.';
  } else {
    lineSummary = `Línea Actual: ${history.join(' ➔ ') || 'Inicio de mano'}`;
    initiativeRole = heroRole === 'IP' ? 'HERO' : 'VILLAIN';
    rangeAdvantage = 'Ventaja dinámica según la posición y runout que caiga en la siguiente calle.';
  }

  const coreObjectives = [
    heroRole === 'IP'
      ? 'Aprovechar la posición (IP) para controlar el tamaño del bote y forzar decisiones difíciles al rival.'
      : 'Proteger rangos fuera de posición (OOP) utilizando check-raises selectivos y check-calls con odds correctas.',
    nextStreet === 'turn'
      ? 'Identificar si el Turn cambia la textura del tablero (Scare cards vs Bricks) antes de apostar.'
      : 'En el River no hay más cartas por venir: el rango debe estar estrictamente polarizado (valor puro o farol puro).',
    'Adecuar el tamaño de apuesta (33% para protección de rango amplio, 66%-75% para valor polarizado).'
  ];

  const runoutCategories = [
    {
      category: 'OVERCARD' as RunoutCategory,
      title: '🅰️ Sobrecartas (Ases, Reyes, Damas)',
      description: 'Cartas superiores a las del flop. Favorecen fuertemente al rango del agresor preflop (EP, MP, CO, BTN).',
      heroStrategy: heroRole === 'IP'
        ? 'Disparar un segundo barril (Double Barrel) con 65-75% de frecuencia. C-betear por valor con top pair y como farol con gutshots o overcards.'
        : 'Como OOP, respetar la sobrecarta: chequear el 80%+ de las veces y evitar flotar sin proyecto sólido.',
      recommendedSizing: '66% - 75% Pot (Polarizado)',
      exampleCards: 'A♠, K♦, Q♥'
    },
    {
      category: 'BRICK' as RunoutCategory,
      title: '🧱 Bricks / Cartas Bajas Neutras (2 - 7)',
      description: 'Cartas desconectadas y bajas que raramente mejoran la mano de ningún jugador.',
      heroStrategy: 'La distribución de ventaja permanece casi idéntica a la del Flop. Es el momento perfecto para seguir apostando con tus mejores manos y semi-faroles con equity residual (backdoors).',
      recommendedSizing: '50% - 66% Pot',
      exampleCards: '2♣, 4♦, 6♠'
    },
    {
      category: 'DRAW_COMPLETER' as RunoutCategory,
      title: '💧 Completadoras de Proyecto (Color o Escalera)',
      description: 'Cartas que completan el tercer o cuarto naipe de un palo o conectan escaleras abiertas (ej: 8-9-T-J).',
      heroStrategy: 'Precaución máxima (Pot Control). El rango del rival que hizo call en flop tiene muchos draws que ahora completaron. Reduce apuestas de una sola pareja y chequea manos medias.',
      recommendedSizing: '33% Pot o Check (Pot Control)',
      exampleCards: '8♦ (completa color), J♣ (completa escalera)'
    },
    {
      category: 'PAIR_BOARD' as RunoutCategory,
      title: '🎴 Tablero Pareado (Board Paired)',
      description: 'Una carta repite un rango ya presente en el tablero (ej: K-8-3 y cae otro 8).',
      heroStrategy: 'Disminuye dramáticamente la probabilidad de que el rival tenga trío y reduce sus combos de pares. Excelente spot para c-bets pequeñas y faroles de alta rentabilidad.',
      recommendedSizing: '33% Pot (Pequeño)',
      exampleCards: `${boardTexture.highRank}♠ o carta media repetida`
    }
  ];

  const tacticalHandMatrix = [
    {
      categoryName: '💎 Monstruos (Sets, Escaleras, Doble Pareja)',
      handsDescription: 'Manos hechas con más del 85% de equity.',
      action: 'Bet por Valor Agresivo (66% - 75% Pot) o Check-Raise',
      sizing: '66% - 80% Pot',
      reasoning: 'Construir el bote para comprometer el stack del rival en el river. No des cartas gratis en tableros con proyectos.',
      color: 'emerald'
    },
    {
      categoryName: '⚔️ Top Pair Fuerte (TPGK / Overpair)',
      handsDescription: 'Top pair con buen kicker o pareja en mano superior.',
      action: 'Bet de Protección / Valor Medio (50% - 66% Pot)',
      sizing: '50% - 66% Pot',
      reasoning: 'Cobrar de proyectos y segundas parejas. Si cae una scare card o el rival resube, cambiar a modo pot-control.',
      color: 'blue'
    },
    {
      categoryName: '🎯 Proyectos Fuertes (Flush Draw, OESD)',
      handsDescription: '8 a 15 outs para mejorar a la mejor mano.',
      action: 'Semi-Farol Agresivo si tienes posición; Check-Call si enfrentas apuesta',
      sizing: '66% Pot o Call según Pot Odds (>20%)',
      reasoning: 'Tienes fold equity inmediata más una gran equity de mejora en la última carta.',
      color: 'cyan'
    },
    {
      categoryName: '🛡️ Manos Marginales / Showdown Value',
      handsDescription: 'Segunda pareja, parejas medias de mano, kicker débil.',
      action: 'Check-Back o Check-Call Barato',
      sizing: 'Check / Call hasta 33% Pot',
      reasoning: 'Mantener el bote pequeño. Tu mano gana en showdown contra faroles pero no resiste apuestas grandes.',
      color: 'amber'
    },
    {
      categoryName: '🌪️ Aire Puro / Sin Equity (Sin Proyecto)',
      handsDescription: 'Cartas sin conectar que no han ligado nada.',
      action: 'Check-Fold (Rendirse) salvo Scare Card favorable',
      sizing: '0 (Fold) o Farol Polarizado en Scare Card',
      reasoning: 'Evitar quemar fichas en cartas que no ofrecen ventaja de rango creíble.',
      color: 'rose'
    }
  ];

  return {
    currentStreet,
    nextStreet,
    boardTexture,
    lineSummary,
    initiativeRole,
    rangeAdvantage,
    coreObjectives,
    runoutCategories,
    tacticalHandMatrix
  };
}

/**
 * Analyzes the strategic impact of a specific candidate turn or river card.
 */
export function analyzeCandidateRunout(
  currentBoard: Card[],
  candidateCard: Card,
  heroCards?: [Card, Card] | null,
  heroRole: 'IP' | 'OOP' = 'IP',
  preflopAggressor: boolean = true
): RunoutImpact {
  const currentTexture = analyzeBoardTexture(currentBoard);
  const candVal = RANK_VALUES[candidateCard.rank];

  // Check category
  let category: RunoutCategory = 'BRICK';
  let categoryTitle = '🧱 Carta Neutra / Brick';
  let favorsRole: 'HERO' | 'VILLAIN' | 'NEUTRAL' = 'NEUTRAL';
  let equityShift = 0;
  let recommendedAction: RunoutImpact['recommendedAction'] = 'CHECK';
  let recommendedBetSize = '50% Pot';
  let recommendedFrequencies = { bet: 45, check: 55 };
  let tacticalAdvice = '';
  let favorsExplanation = '';

  const isPaired = currentBoard.some(c => c.rank === candidateCard.rank);
  const matchingSuits = currentBoard.filter(c => c.suit === candidateCard.suit).length;
  const isOvercard = candVal > currentTexture.highValue;

  if (isPaired) {
    category = 'PAIR_BOARD';
    categoryTitle = `🎴 Dobla el Tablero (${candidateCard.rank}${candidateCard.rank})`;
    favorsRole = preflopAggressor ? 'HERO' : 'NEUTRAL';
    equityShift = preflopAggressor ? 4 : 0;
    recommendedAction = 'BET';
    recommendedBetSize = '33% Pot (Pequeño)';
    recommendedFrequencies = { bet: 68, check: 32 };
    favorsExplanation = 'Al doblarse la carta, se reduce la cantidad de combinaciones que el rival pudo haber conectado en el flop.';
    tacticalAdvice = 'Apostar un tamaño pequeño (33% pot). El rival se verá forzado a foldear la mayoría de sus manos que no conectaron o flotaron sin proyecto.';
  } else if (matchingSuits >= 2) {
    // 3rd of suit
    category = 'DRAW_COMPLETER';
    categoryTitle = `💧 Completa Color Posible (${candidateCard.suit.toUpperCase()})`;
    favorsRole = heroRole === 'IP' ? 'NEUTRAL' : 'VILLAIN';
    equityShift = -5;
    recommendedAction = 'CHECK';
    recommendedBetSize = '33% Pot / Pot Control';
    recommendedFrequencies = { bet: 25, check: 75 };
    favorsExplanation = 'El jugador defensor que pagó en el flop suele tener una alta concentración de proyectos de color.';
    tacticalAdvice = 'Modo control de bote (Pot Control). Chequea manos de una sola pareja. Si tienes el color hecho, apuesta por valor pero no overbetee.';
  } else if (isOvercard) {
    category = 'OVERCARD';
    categoryTitle = `🅰️ Sobrecarta Alta (${candidateCard.rank} Alto)`;
    favorsRole = preflopAggressor ? 'HERO' : 'VILLAIN';
    equityShift = preflopAggressor ? 7 : -4;
    recommendedAction = 'BET';
    recommendedBetSize = '66% - 75% Pot (Polarizado)';
    recommendedFrequencies = { bet: 72, check: 28 };
    favorsExplanation = `La carta ${candidateCard.rank} impacta directamente el rango del agresor preflop (manos con A/K/Q altos).`;
    tacticalAdvice = `Disparar un segundo barril agresivo. La sobrecarta ${candidateCard.rank} ejerce una inmensa presión sobre las parejas medias del rival.`;
  } else {
    category = 'BRICK';
    categoryTitle = `🧱 Carta Neutra / Desconectada (${candidateCard.rank})`;
    favorsRole = heroRole === 'IP' ? 'HERO' : 'NEUTRAL';
    equityShift = 2;
    recommendedAction = heroRole === 'IP' ? 'BET' : 'CHECK';
    recommendedBetSize = '50% - 66% Pot';
    recommendedFrequencies = { bet: 52, check: 48 };
    favorsExplanation = 'No altera significativamente los rangos del flop; la iniciativa sigue en manos del jugador que apostó.';
    tacticalAdvice = 'Continuar la agresión con manos de valor fuerte y semi-faroles con proyectos backdoor. Rendirse con manos sin equity residual.';
  }

  // Hero hand evaluation before and after
  let heroHandBefore = '';
  let heroHandAfter = '';

  if (heroCards && heroCards.length === 2) {
    try {
      const evalBefore = evaluateCards([...heroCards, ...currentBoard]);
      heroHandBefore = `${evalBefore.categoryName}: ${evalBefore.description}`;

      const evalAfter = evaluateCards([...heroCards, ...currentBoard, candidateCard]);
      heroHandAfter = `${evalAfter.categoryName}: ${evalAfter.description}`;

      if (evalAfter.score > evalBefore.score) {
        tacticalAdvice += ` ¡Tu mano mejoró a ${evalAfter.categoryName}! Aumenta la agresividad por valor.`;
        favorsRole = 'HERO';
        equityShift += 12;
        recommendedAction = 'BET';
        recommendedBetSize = '66% - 75% Pot';
        recommendedFrequencies = { bet: 85, check: 15 };
      }
    } catch {
      // ignore
    }
  }

  return {
    card: candidateCard,
    category,
    categoryTitle,
    favorsRole,
    favorsExplanation,
    equityShiftEstimate: equityShift,
    recommendedAction,
    recommendedBetSize,
    recommendedFrequencies,
    heroHandBefore,
    heroHandAfter,
    tacticalAdvice
  };
}

/**
 * Returns a list of candidate cards from unblocked deck for the user to simulate.
 */
export function getCandidateRunoutArchetypes(currentBoard: Card[]): {
  label: string;
  card: Card;
  type: RunoutCategory;
}[] {
  const currentTexture = analyzeBoardTexture(currentBoard);
  const boardIds = new Set(currentBoard.map(c => c.id));

  const candidates: { label: string; card: Card; type: RunoutCategory }[] = [];

  // 1. Overcard (Ace of spades or clubs if available)
  const aceSuits: Suit[] = ['s', 'c', 'h', 'd'];
  for (const s of aceSuits) {
    const id = cardId('A', s);
    if (!boardIds.has(id)) {
      candidates.push({
        label: 'Sobrecarta As (A♠/A♣)',
        card: { rank: 'A', suit: s, id },
        type: 'OVERCARD'
      });
      break;
    }
  }

  // 2. Brick / Low card (2 or 4 of unused suit)
  for (const r of ['2', '4', '6'] as Rank[]) {
    let found = false;
    for (const s of ['s', 'h', 'd', 'c'] as Suit[]) {
      const id = cardId(r, s);
      if (!boardIds.has(id)) {
        candidates.push({
          label: `Brick Neutro (${r})`,
          card: { rank: r, suit: s, id },
          type: 'BRICK'
        });
        found = true;
        break;
      }
    }
    if (found) break;
  }

  // 3. Flush Completer (card of dominant suit if board has 2 of suit)
  if (currentTexture.flushSuit) {
    for (const r of ['8', 'T', 'J', '9'] as Rank[]) {
      const id = cardId(r, currentTexture.flushSuit);
      if (!boardIds.has(id)) {
        candidates.push({
          label: `Carta de Color (${currentTexture.flushSuit.toUpperCase()})`,
          card: { rank: r, suit: currentTexture.flushSuit, id },
          type: 'DRAW_COMPLETER'
        });
        break;
      }
    }
  }

  // 4. Paired card
  if (currentBoard.length > 0) {
    const pairRank = currentBoard[0].rank;
    for (const s of ['s', 'h', 'd', 'c'] as Suit[]) {
      const id = cardId(pairRank, s);
      if (!boardIds.has(id)) {
        candidates.push({
          label: `Carta Pareada (${pairRank})`,
          card: { rank: pairRank, suit: s, id },
          type: 'PAIR_BOARD'
        });
        break;
      }
    }
  }

  return candidates;
}
