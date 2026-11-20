/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AcademyRunout: Motor multi-calle para la Academia Allin School.
 * Permite jugar y analizar la mano completa hasta Turn, River y Showdown de 7 cartas
 * siempre que ninguno de los jugadores foldee, partiendo desde cualquier spot
 * (Preflop, Flop o River) sin repetir secuencias gracias a Crypto.getRandomValues.
 */

import { Card, FULL_DECK, SUIT_SYMBOLS } from './cards';
import { evaluateCards, type HandEvaluation } from './evaluator';
import { analyzeBoardTexture } from './nextStreetGuidance';
import { estimateHandStrengthCategory, pickTrueRandomDeckIndex } from './handSimulator';
import { fisherYatesShuffle } from '../lib/random';
import type { QuizScenario } from './academySpots';

export type AcademyStreetStage = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'folded';

export interface AcademyStreetOption {
  label: string;
  action: string;
  isCorrect: boolean;
  evLossPct: number;
}

export interface AcademyStreetStep {
  stage: 'preflop' | 'flop' | 'turn' | 'river';
  visibleBoard: Card[];
  newCardAdded?: Card;
  potBB: number;
  facingBetBB: number;
  villainAction: string;
  correctAction: string;
  correctSizing: string;
  gtoFrequency: number;
  heroHandLabel: string;
  boardSummary: string;
  options: AcademyStreetOption[];
  explanationDummies: string;
  leakWarning: string;
}

export interface AcademyStreetRecord {
  stage: 'preflop' | 'flop' | 'turn' | 'river';
  visibleBoard: Card[];
  potBBBefore: number;
  potBBAfter: number;
  villainAction: string;
  chosenLabel: string;
  chosenAction: string;
  optimalLabel: string;
  isCorrect: boolean;
  evLossPct: number;
  heroHandLabel: string;
  explanationDummies: string;
  leakWarning: string;
}

export interface AcademyShowdownResult {
  winner: 'hero' | 'villain' | 'split';
  heroEval: HandEvaluation;
  villainEval: HandEvaluation;
  finalPotBB: number;
  totalEvLossPct: number;
  summaryText: string;
}

export interface AcademyHandSession {
  scenario: QuizScenario;
  stage: AcademyStreetStage;
  heroCards: [Card, Card];
  villainCards: [Card, Card];
  fullBoard: [Card, Card, Card, Card, Card];
  currentStep: AcademyStreetStep;
  currentStepAnswered: boolean;
  selectedOptionIdx: number | null;
  lastChosenAction: string | null;
  potBB: number;
  heroHasInitiative: boolean;
  streetHistory: AcademyStreetRecord[];
  showdown: AcademyShowdownResult | null;
}

function drawCSPRNGCard(pool: Card[]): Card {
  if (pool.length === 0) {
    throw new Error('No hay cartas disponibles en el mazo para repartir.');
  }
  const idx = pickTrueRandomDeckIndex(pool.length);
  const [picked] = pool.splice(idx, 1);
  return picked;
}

export function isFoldActionCode(actionCode: string): boolean {
  const upper = actionCode.toUpperCase();
  return upper === 'FOLD' || upper.startsWith('FOLD_') || upper.includes('FOLD');
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function estimateActionPotContribution(actionCode: string, label: string, potBB: number, facingBetBB: number): number {
  const upper = actionCode.toUpperCase();
  if (isFoldActionCode(upper) || upper.includes('CHECK')) {
    return 0;
  }
  if (upper.includes('CALL')) {
    const bet = facingBetBB > 0 ? facingBetBB : round1(potBB * 0.45);
    return bet;
  }
  // Extract BB value from label if present e.g. "(4.9 BB)" or "22 BB"
  const bbMatch = label.match(/(\d+(?:\.\d+)?)\s*BB/i);
  if (bbMatch) {
    const parsed = parseFloat(bbMatch[1]);
    if (Number.isFinite(parsed) && parsed > 0) {
      return round1(parsed * 2); // Hero bet + Villain call so hand advances
    }
  }
  if (upper.includes('ALL_IN') || upper.includes('ALLIN')) {
    return round1(Math.min(60, potBB * 1.4));
  }
  if (upper.includes('OVERBET') || upper.includes('120') || upper.includes('125') || upper.includes('130')) {
    return round1(potBB * 1.2 * 2);
  }
  if (upper.includes('75') || upper.includes('66') || upper.includes('80') || upper.includes('RAISE') || upper.includes('3BET') || upper.includes('4BET')) {
    return round1(potBB * 0.72 * 2);
  }
  if (upper.includes('50')) {
    return round1(potBB * 0.5 * 2);
  }
  return round1(potBB * 0.33 * 2);
}

function buildInitialStepFromScenario(scenario: QuizScenario): AcademyStreetStep {
  const initialStage: 'preflop' | 'flop' | 'turn' | 'river' =
    scenario.board.length === 0
      ? 'preflop'
      : scenario.board.length === 3
      ? 'flop'
      : scenario.board.length === 4
      ? 'turn'
      : 'river';

  const handLabel =
    scenario.board.length >= 3
      ? estimateHandStrengthCategory(scenario.heroCards, scenario.board).label
      : 'Rango Preflop';

  const boardSummary =
    scenario.board.length >= 3
      ? analyzeBoardTexture(scenario.board).summary
      : 'Fase preflop antes de ver el flop.';

  const facingMatch = scenario.villainAction.match(/(\d+(?:\.\d+)?)\s*BB/i);
  const facingBetBB = facingMatch ? parseFloat(facingMatch[1]) : 0;

  return {
    stage: initialStage,
    visibleBoard: [...scenario.board],
    potBB: scenario.potBB,
    facingBetBB,
    villainAction: scenario.villainAction,
    correctAction: scenario.correctAction,
    correctSizing: scenario.correctSizing || 'Estándar',
    gtoFrequency: scenario.gtoFrequency,
    heroHandLabel: handLabel,
    boardSummary,
    options: scenario.options.map(o => ({ ...o })),
    explanationDummies: scenario.explanationDummies,
    leakWarning: scenario.leakWarning
  };
}

function buildDynamicStreetStep(params: {
  stage: 'flop' | 'turn' | 'river';
  heroCards: [Card, Card];
  villainCards: [Card, Card];
  visibleBoard: Card[];
  newCardAdded?: Card;
  potBB: number;
  heroHasInitiative: boolean;
  opponentProfile: 'regular' | 'nit' | 'fish' | 'lag';
  heroPos: string;
  villainPos: string;
}): AcademyStreetStep {
  const {
    stage,
    heroCards,
    villainCards,
    visibleBoard,
    newCardAdded,
    potBB,
    heroHasInitiative,
    opponentProfile,
    heroPos,
    villainPos
  } = params;

  const strength = estimateHandStrengthCategory(heroCards, visibleBoard);
  const villainStrength = estimateHandStrengthCategory(villainCards, visibleBoard);
  const texture = analyzeBoardTexture(visibleBoard);
  const isWet = texture.isMonotone || texture.isConnected || texture.isTwoTone;
  const remainingEffBB = Math.max(8, round1(100 - potBB * 0.5));
  const spr = round1(remainingEffBB / Math.max(1, potBB));

  // Decide if Villain leads/bets on this street
  const villainLeads =
    (!heroHasInitiative &&
      (villainStrength.tier === 'monster' ||
        villainStrength.tier === 'strong' ||
        (opponentProfile === 'lag' && (stage === 'turn' || stage === 'river')) ||
        (stage === 'river' && villainStrength.tier === 'air' && !texture.isPaired))) ||
    (stage === 'river' && villainStrength.tier === 'monster' && opponentProfile !== 'nit');

  const cardNote = newCardAdded
    ? `La carta del ${stage === 'turn' ? 'Turn' : stage === 'river' ? 'River' : 'Flop'} es ${newCardAdded.rank}${SUIT_SYMBOLS[newCardAdded.suit]}. `
    : '';

  if (villainLeads) {
    const betFrac = villainStrength.tier === 'monster' || isWet ? 0.66 : 0.45;
    const betBB = Math.max(1.5, round1(potBB * betFrac));
    const raiseBB = round1(Math.min(remainingEffBB, betBB * 2.7));
    const potOddsPct = Math.round((betBB / (potBB + betBB * 2)) * 100);

    let best: 'FOLD' | 'CALL' | 'RAISE' = 'CALL';
    if (strength.tier === 'monster' && (stage === 'river' || spr <= 3.5 || isWet)) {
      best = 'RAISE';
    } else if (strength.tier === 'monster' || strength.tier === 'strong') {
      best = stage === 'river' && strength.tier === 'monster' ? 'RAISE' : 'CALL';
    } else if (strength.tier === 'draw' && stage !== 'river') {
      best = strength.equityPct >= potOddsPct - 4 ? 'CALL' : 'FOLD';
    } else if (strength.tier === 'medium') {
      best = betFrac <= 0.55 || opponentProfile === 'lag' ? 'CALL' : 'FOLD';
    } else {
      best = 'FOLD';
    }

    const options: AcademyStreetOption[] = [
      {
        label: 'Fold (Retirarse)',
        action: 'FOLD',
        isCorrect: best === 'FOLD',
        evLossPct:
          best === 'FOLD'
            ? 0
            : strength.tier === 'monster'
            ? 14.5
            : strength.tier === 'strong'
            ? 8.4
            : 3.6
      },
      {
        label: `Call (${betBB} BB)`,
        action: 'CALL',
        isCorrect: best === 'CALL',
        evLossPct:
          best === 'CALL'
            ? 0
            : best === 'FOLD'
            ? 4.8
            : 2.6
      },
      {
        label: raiseBB >= remainingEffBB * 0.85 ? `All-In (${remainingEffBB} BB)` : `Raise (${raiseBB} BB)`,
        action: 'RAISE',
        isCorrect: best === 'RAISE',
        evLossPct:
          best === 'RAISE'
            ? 0
            : strength.tier === 'air'
            ? 7.2
            : strength.tier === 'medium'
            ? 5.1
            : 2.9
      }
    ];

    const explanationDummies =
      best === 'RAISE'
        ? `${cardNote}Tienes ${strength.label} (~${strength.equityPct}% equity) ante una apuesta de ${betBB} BB en textura "${texture.textureLabel}". Subir a ${raiseBB} BB maximiza el valor contra proyectos y manos peores.`
        : best === 'CALL'
        ? `${cardNote}Tu mano (${strength.label}, ~${strength.equityPct}% equity) supera claramente las Pot Odds necesarias (~${potOddsPct}%) frente a la apuesta de ${betBB} BB. Pagar mantiene sus bluffs y manos peores en el bote.`
        : `${cardNote}Con ${strength.label} en este board (${texture.textureLabel}), tu equity (~${strength.equityPct}%) no cubre las Pot Odds (~${potOddsPct}%) frente a la apuesta de ${betBB} BB. Foldear evita quemar fichas en ${stage.toUpperCase()}.`;

    const leakWarning =
      best === 'FOLD'
        ? `Fuga en ${stage.toUpperCase()}: Pagar apuestas con manos débiles sin equity suficiente genera pérdidas acumuladas graves en el largo plazo.`
        : best === 'RAISE'
        ? `Fuga en ${stage.toUpperCase()}: Hacer solo call con manos monstruo en boards dinámicos deja dinero en la mesa y permite cartas gratis.`
        : `Fuga en ${stage.toUpperCase()}: Foldear demasiado pronto manos con valor de showdown o buena equity de proyecto te hace explotable.`;

    return {
      stage,
      visibleBoard,
      newCardAdded,
      potBB,
      facingBetBB: betBB,
      villainAction: `${villainPos} Bets ${betBB} BB (${Math.round(betFrac * 100)}% Pot)`,
      correctAction: best === 'RAISE' ? `RAISE ${raiseBB} BB` : best === 'CALL' ? `CALL ${betBB} BB` : 'FOLD',
      correctSizing: best === 'RAISE' ? `${raiseBB} BB` : best === 'CALL' ? `${betBB} BB` : '0 BB',
      gtoFrequency: best === 'CALL' ? 74 : 78,
      heroHandLabel: strength.label,
      boardSummary: texture.summary,
      options,
      explanationDummies,
      leakWarning
    };
  }

  // Villain checks to Hero
  const smallBB = Math.max(1.0, round1(potBB * 0.33));
  const largeBB = Math.max(2.0, round1(potBB * 0.72));

  let best: 'CHECK' | 'BET_33' | 'BET_75' = 'CHECK';
  if (strength.tier === 'monster') {
    best = isWet || stage === 'river' || spr <= 2.5 ? 'BET_75' : 'BET_33';
  } else if (strength.tier === 'strong') {
    best = isWet ? 'BET_75' : 'BET_33';
  } else if (strength.tier === 'draw' && stage !== 'river') {
    best = opponentProfile === 'fish' ? 'CHECK' : 'BET_75';
  } else if (strength.tier === 'medium') {
    best = 'CHECK';
  } else {
    // Air / bluff candidate on good runout
    best = stage === 'turn' && !isWet && heroHasInitiative && opponentProfile === 'nit' ? 'BET_33' : 'CHECK';
  }

  const options: AcademyStreetOption[] = [
    {
      label: 'Check (Pasar)',
      action: 'CHECK',
      isCorrect: best === 'CHECK',
      evLossPct:
        best === 'CHECK'
          ? 0
          : strength.tier === 'monster'
          ? 5.8
          : strength.tier === 'strong'
          ? 3.7
          : 2.9
    },
    {
      label: `Bet 33% Pot (${smallBB} BB)`,
      action: 'BET_33',
      isCorrect: best === 'BET_33',
      evLossPct:
        best === 'BET_33'
          ? 0
          : best === 'CHECK' && strength.tier === 'air'
          ? 3.4
          : 2.1
    },
    {
      label: `Bet 72% Pot (${largeBB} BB)`,
      action: 'BET_75',
      isCorrect: best === 'BET_75',
      evLossPct:
        best === 'BET_75'
          ? 0
          : strength.tier === 'medium'
          ? 5.2
          : strength.tier === 'air'
          ? 6.4
          : 2.4
    }
  ];

  const explanationDummies =
    best === 'BET_75'
      ? `${cardNote}Con ${strength.label} en ${stage.toUpperCase()} (${texture.textureLabel}, SPR ${spr}), apostar grande (${largeBB} BB / 72% Pot) cobra máximo valor de parejas/proyectos y protege tu mano.`
      : best === 'BET_33'
      ? `${cardNote}Con ${strength.label} en textura "${texture.textureLabel}", una apuesta pequeña de 33% (${smallBB} BB) extrae valor fino de manos peores y mantiene presión eficiente sobre el rango de ${villainPos}.`
      : `${cardNote}Tu mano (${strength.label}) funciona mejor jugando Check en ${stage.toUpperCase()}: controlas el tamaño del bote, evitas inflarlo contra manos mejores y proteges tu rango de check de ${heroPos}.`;

  const leakWarning =
    best === 'CHECK'
      ? `Fuga en ${stage.toUpperCase()}: Convertir manos de valor medio en faroles o apostar grande sin ventaja polarizada te aísla contra manos superiores.`
      : `Fuga en ${stage.toUpperCase()}: Hacer check pasivo con valor claro o draws fuertes regala cartas gratis y reduce el valor esperado de tus mejores combos.`;

  return {
    stage,
    visibleBoard,
    newCardAdded,
    potBB,
    facingBetBB: 0,
    villainAction: `${villainPos} Checks`,
    correctAction: best === 'BET_75' ? 'BET 72%' : best === 'BET_33' ? 'BET 33%' : 'CHECK',
    correctSizing: best === 'BET_75' ? `${largeBB} BB` : best === 'BET_33' ? `${smallBB} BB` : '0 BB',
    gtoFrequency: best === 'CHECK' ? 76 : 74,
    heroHandLabel: strength.label,
    boardSummary: texture.summary,
    options,
    explanationDummies,
    leakWarning
  };
}

export function initAcademyHandSession(scenario: QuizScenario): AcademyHandSession {
  const deadIds = new Set<number>([
    scenario.heroCards[0].id,
    scenario.heroCards[1].id,
    ...scenario.board.map(c => c.id)
  ]);

  const pool = fisherYatesShuffle(FULL_DECK.filter(c => !deadIds.has(c.id)));
  const villainCards: [Card, Card] = [drawCSPRNGCard(pool), drawCSPRNGCard(pool)];

  const boardCards: Card[] = [...scenario.board];
  while (boardCards.length < 5) {
    boardCards.push(drawCSPRNGCard(pool));
  }
  const fullBoard: [Card, Card, Card, Card, Card] = [
    boardCards[0],
    boardCards[1],
    boardCards[2],
    boardCards[3],
    boardCards[4]
  ];

  const initialStep = buildInitialStepFromScenario(scenario);
  const hasInit = !scenario.villainAction.toLowerCase().includes('bets') && !scenario.villainAction.toLowerCase().includes('opens');

  return {
    scenario,
    stage: initialStep.stage,
    heroCards: scenario.heroCards,
    villainCards,
    fullBoard,
    currentStep: initialStep,
    currentStepAnswered: false,
    selectedOptionIdx: null,
    lastChosenAction: null,
    potBB: scenario.potBB,
    heroHasInitiative: hasInit,
    streetHistory: [],
    showdown: null
  };
}

export function getNextAcademyStage(
  currentStage: 'preflop' | 'flop' | 'turn' | 'river',
  chosenAction: string
): AcademyStreetStage {
  if (isFoldActionCode(chosenAction)) {
    return 'folded';
  }
  if (currentStage === 'preflop') return 'flop';
  if (currentStage === 'flop') return 'turn';
  if (currentStage === 'turn') return 'river';
  return 'showdown';
}

export function submitAcademyStreetDecision(
  session: AcademyHandSession,
  optionIdx: number
): AcademyHandSession {
  if (session.currentStepAnswered) return session;
  const chosen = session.currentStep.options[optionIdx];
  if (!chosen) return session;

  const optimal = session.currentStep.options.find(o => o.isCorrect) || session.currentStep.options[0];
  const contrib = estimateActionPotContribution(
    chosen.action,
    chosen.label,
    session.potBB,
    session.currentStep.facingBetBB
  );
  const potAfter = round1(session.potBB + contrib);

  const heroAggressive =
    chosen.action.toUpperCase().includes('BET') ||
    chosen.action.toUpperCase().includes('RAISE') ||
    chosen.action.toUpperCase().includes('OPEN') ||
    chosen.action.toUpperCase().includes('3BET') ||
    chosen.action.toUpperCase().includes('4BET') ||
    chosen.action.toUpperCase().includes('SQUEEZE') ||
    chosen.action.toUpperCase().includes('ROL');

  const record: AcademyStreetRecord = {
    stage: session.currentStep.stage,
    visibleBoard: [...session.currentStep.visibleBoard],
    potBBBefore: session.potBB,
    potBBAfter: potAfter,
    villainAction: session.currentStep.villainAction,
    chosenLabel: chosen.label,
    chosenAction: chosen.action,
    optimalLabel: optimal.label,
    isCorrect: chosen.isCorrect,
    evLossPct: chosen.evLossPct,
    heroHandLabel: session.currentStep.heroHandLabel,
    explanationDummies: session.currentStep.explanationDummies,
    leakWarning: session.currentStep.leakWarning
  };

  const folded = isFoldActionCode(chosen.action);
  return {
    ...session,
    stage: folded ? 'folded' : session.stage,
    potBB: potAfter,
    heroHasInitiative: folded ? false : heroAggressive ? true : session.heroHasInitiative,
    currentStepAnswered: true,
    selectedOptionIdx: optionIdx,
    lastChosenAction: chosen.action,
    streetHistory: [...session.streetHistory, record]
  };
}

export function advanceAcademyHandStreet(session: AcademyHandSession): AcademyHandSession {
  if (!session.currentStepAnswered || session.stage === 'folded' || session.stage === 'showdown') {
    return session;
  }

  const nextStage = getNextAcademyStage(
    session.currentStep.stage,
    session.lastChosenAction || ''
  );

  if (nextStage === 'folded' || nextStage === 'preflop') {
    return {
      ...session,
      stage: nextStage
    };
  }

  if (nextStage === 'showdown') {
    const heroEval = evaluateCards([...session.heroCards, ...session.fullBoard]);
    const villainEval = evaluateCards([...session.villainCards, ...session.fullBoard]);
    const winner: 'hero' | 'villain' | 'split' =
      heroEval.score > villainEval.score ? 'hero' : heroEval.score < villainEval.score ? 'villain' : 'split';

    const totalEvLossPct = round1(
      session.streetHistory.reduce((acc, step) => acc + step.evLossPct, 0)
    );
    const perfectCount = session.streetHistory.filter(s => s.isCorrect).length;
    const summaryText =
      winner === 'hero'
        ? `Hero gana el bote de ${session.potBB} BB con ${heroEval.description} frente a ${villainEval.description}. Acertaste ${perfectCount}/${session.streetHistory.length} calles (EV Loss acumulado: -${totalEvLossPct}%).`
        : winner === 'villain'
        ? `Villano gana el bote de ${session.potBB} BB con ${villainEval.description} frente a tu ${heroEval.description}. Precisión calle a calle: ${perfectCount}/${session.streetHistory.length} (EV Loss acumulado: -${totalEvLossPct}%).`
        : `Bote dividido (${session.potBB} BB) con ${heroEval.description}. Precisión calle a calle: ${perfectCount}/${session.streetHistory.length}.`;

    return {
      ...session,
      stage: 'showdown',
      showdown: {
        winner,
        heroEval,
        villainEval,
        finalPotBB: session.potBB,
        totalEvLossPct,
        summaryText
      }
    };
  }

  // Deal Flop (3), Turn (4) or River (5)
  const cardCount = nextStage === 'flop' ? 3 : nextStage === 'turn' ? 4 : 5;
  const visibleBoard = session.fullBoard.slice(0, cardCount);
  const newCardAdded =
    nextStage === 'turn' ? session.fullBoard[3] : nextStage === 'river' ? session.fullBoard[4] : undefined;

  const nextStep = buildDynamicStreetStep({
    stage: nextStage,
    heroCards: session.heroCards,
    villainCards: session.villainCards,
    visibleBoard,
    newCardAdded,
    potBB: session.potBB,
    heroHasInitiative: session.heroHasInitiative,
    opponentProfile: session.scenario.opponentProfile || 'regular',
    heroPos: session.scenario.heroPos,
    villainPos: session.scenario.villainPos
  });

  return {
    ...session,
    stage: nextStage,
    currentStep: nextStep,
    currentStepAnswered: false,
    selectedOptionIdx: null,
    lastChosenAction: null
  };
}
