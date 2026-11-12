/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * EvaluationBank: Base de datos masiva de 670+ preguntas únicas (216+ por modalidad)
 * sin repetición al repetir evaluaciones, con sistema progresivo por 4 Niveles de Estudio
 * (NL2 -> NL100) y centro educativo personalizado para cada jugador.
 */

import { Card, cardId, type Rank, type Suit } from './cards';
import type { AcademyCategory, QuizScenario } from './academySpots';

export type EvaluationMode = 'fixed' | 'levels' | 'variable';
export type DifficultyLevel = 1 | 2 | 3 | 4;

export interface EvaluationQuestion extends QuizScenario {
  mode: EvaluationMode;
  level: DifficultyLevel;
  levelLabel: string;
  conceptTag: string;
  dummiesTip: string;
  streetLabel: 'Preflop' | 'Flop' | 'Turn' | 'River';
}

export interface EvaluationFilters {
  potType: 'all' | 'srp' | '3bet' | '4bet' | 'squeeze';
  texture: 'all' | 'dry' | 'wet' | 'monotone' | 'paired' | 'preflop';
  opponent: 'all' | 'regular' | 'nit' | 'fish' | 'lag';
  level: 'all' | DifficultyLevel;
  questionCount: 5 | 8 | 12;
}

export interface LevelDefinition {
  level: DifficultyLevel;
  name: string;
  stakes: string;
  badge: string;
  description: string;
  xpRequired: number;
  passScorePct: number;
}

export const EDUCATIONAL_LEVELS: LevelDefinition[] = [
  {
    level: 1,
    name: 'Nivel 1 · Cimientos Sólidos',
    stakes: 'NL2 – NL5',
    badge: 'FUNDAMENTOS',
    description: 'Apertura RFI disciplinada, cero limps, valor directo contra Calling Stations y Pot Odds básicos.',
    xpRequired: 0,
    passScorePct: 75
  },
  {
    level: 2,
    name: 'Nivel 2 · Regulares Low-Stakes',
    stakes: 'NL10 – NL25',
    badge: 'TÉCNICO',
    description: 'C-Bet por texturas (33% vs 75%), Squeeze, ROL óptimo y defensa matemática de Big Blind.',
    xpRequired: 200,
    passScorePct: 75
  },
  {
    level: 3,
    name: 'Nivel 3 · Mid-Stakes GTO',
    stakes: 'NL50',
    badge: 'AVANZADO',
    description: 'Botes 3-Bet con SPR bajo, 4-Bet bluffs con bloqueadores, turn overbets y control monótono.',
    xpRequired: 500,
    passScorePct: 75
  },
  {
    level: 4,
    name: 'Nivel 4 · High-Stakes & Élite',
    stakes: 'NL100+',
    badge: 'ÉLITE GTO',
    description: 'Polarización river 150%, bluff-catching por bloqueadores exactos y explotación fina contra Regs/LAGs.',
    xpRequired: 900,
    passScorePct: 80
  }
];

const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
const RANKS_DESC: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function mkCard(rank: Rank, suit: Suit): Card {
  return { rank, suit, id: cardId(rank, suit) };
}

/**
 * Asigna de forma determinista cartas que jamás colisionen entre sí ni con cartas bloqueadas.
 */
function allocateHandAndBoard(
  heroSpecs: Array<[Rank, Suit]>,
  boardSpecs: Array<[Rank, Suit]>,
  suitOffset: number
): { heroCards: [Card, Card]; board: Card[] } {
  const used = new Set<number>();
  const shiftSuit = (s: Suit, offset: number): Suit => {
    const idx = SUITS.indexOf(s);
    return SUITS[(idx + offset) % SUITS.length];
  };

  const pickFree = (rank: Rank, baseSuit: Suit, offset: number): Card => {
    for (let attempt = 0; attempt < 4; attempt++) {
      const s = shiftSuit(baseSuit, offset + attempt);
      const id = cardId(rank, s);
      if (!used.has(id)) {
        used.add(id);
        return mkCard(rank, s);
      }
    }
    // Fallback if same rank saturated across 4 suits (step rank down safely)
    const rIdx = RANKS_DESC.indexOf(rank);
    for (let step = 1; step < RANKS_DESC.length; step++) {
      const altRank = RANKS_DESC[(rIdx + step) % RANKS_DESC.length];
      for (const s of SUITS) {
        const id = cardId(altRank, s);
        if (!used.has(id)) {
          used.add(id);
          return mkCard(altRank, s);
        }
      }
    }
    return mkCard(rank, baseSuit);
  };

  const h1 = pickFree(heroSpecs[0][0], heroSpecs[0][1], suitOffset);
  const h2 = pickFree(heroSpecs[1][0], heroSpecs[1][1], suitOffset);
  const board = boardSpecs.map(([r, s]) => pickFree(r, s, suitOffset));

  return { heroCards: [h1, h2], board };
}

interface SpotBlueprint {
  category: AcademyCategory;
  categoryName: string;
  conceptTag: string;
  level: DifficultyLevel;
  potType: 'srp' | '3bet' | '4bet' | 'squeeze';
  streetLabel: 'Preflop' | 'Flop' | 'Turn' | 'River';
  heroPos: string;
  villainPos: string;
  opponentProfile: 'regular' | 'nit' | 'fish' | 'lag';
  potBB: number;
  spr: number;
  heroCombos: Array<{ label: string; cards: [[Rank, Suit], [Rank, Suit]]; flavor: string }>;
  boardVariants: Array<{ label: string; cards: Array<[Rank, Suit]> }>;
  villainAction: string;
  correctAction: string;
  correctSizing: string;
  gtoFrequency: number;
  options: Array<{ label: string; action: string; isCorrect: boolean; evLossPct: number }>;
  explanationDummies: string;
  dummiesTip: string;
  leakWarning: string;
}

const BLUEPRINTS: SpotBlueprint[] = [
  // 1. RFI UTG / HJ (Level 1)
  {
    category: 'open_raise',
    categoryName: 'Open Raise (RFI)',
    conceptTag: 'Rango de Apertura Posicional EP',
    level: 1,
    potType: 'srp',
    streetLabel: 'Preflop',
    heroPos: 'UTG (EP)',
    villainPos: 'Mesa completa',
    opponentProfile: 'regular',
    potBB: 1.5,
    spr: 40,
    heroCombos: [
      { label: 'AQs', cards: [['A', 's'], ['Q', 's']], flavor: 'Broadway suited de élite' },
      { label: 'KQs', cards: [['K', 'h'], ['Q', 'h']], flavor: 'Conector alto con gran jugabilidad' },
      { label: 'AJs', cards: [['A', 'd'], ['J', 'd']], flavor: 'As suited fuerte para abrir' },
      { label: 'JJ', cards: [['J', 's'], ['J', 'c']], flavor: 'Pareja alta con gran valor preflop' },
      { label: 'TT', cards: [['T', 'h'], ['T', 'd']], flavor: 'Pareja media-alta rentable' },
      { label: 'ATs', cards: [['A', 'c'], ['T', 'c']], flavor: 'As suited con potencial de escalera y color' }
    ],
    boardVariants: [{ label: 'Preflop Sin Mesa', cards: [] }],
    villainAction: 'Mesa llega limpia (Fold general hasta UTG)',
    correctAction: 'Open Raise a 2.5 BB',
    correctSizing: '2.5 BB',
    gtoFrequency: 100,
    options: [
      { label: 'Open Raise a 2.5 BB', action: 'RAISE_25', isCorrect: true, evLossPct: 0 },
      { label: 'Open Limp (Solo 1 BB)', action: 'CALL', isCorrect: false, evLossPct: 9.8 },
      { label: 'Fold Conservador', action: 'FOLD', isCorrect: false, evLossPct: 7.2 }
    ],
    explanationDummies: 'Nunca entres pagando la ciega (Open Limp) primero. Con manos fuertes desde UTG, subir a 2.5 BB toma el control del bote, cobra dinero muerto a las ciegas y evita que 4 jugadores vean el flop gratis.',
    dummiesTip: 'Regla de Oro Nivel 1: Si decides jugar una mano siendo el primero en entrar, ¡entra SIEMPRE subiendo!',
    leakWarning: 'Fuga Común: Hacer Open Limp por miedo a recibir un 3-Bet.'
  },
  // 2. RFI BTN Steal (Level 1)
  {
    category: 'open_raise',
    categoryName: 'Open Raise (RFI)',
    conceptTag: 'Robo desde el Botón (BTN Steal)',
    level: 1,
    potType: 'srp',
    streetLabel: 'Preflop',
    heroPos: 'BTN',
    villainPos: 'SB + BB',
    opponentProfile: 'nit',
    potBB: 1.5,
    spr: 40,
    heroCombos: [
      { label: 'K9s', cards: [['K', 's'], ['9', 's']], flavor: 'Rey suited jugable IP' },
      { label: 'Q9s', cards: [['Q', 'h'], ['9', 'h']], flavor: 'Dama suited ideal para robar' },
      { label: '98s', cards: [['9', 'd'], ['8', 'd']], flavor: 'Conector suited con mucha equity postflop' },
      { label: 'A4s', cards: [['A', 'c'], ['4', 'c']], flavor: 'As suited bloqueador de AA/AK' },
      { label: 'KTo', cards: [['K', 's'], ['T', 'd']], flavor: 'Broadway offsuit sólido en BTN' },
      { label: '76s', cards: [['7', 'h'], ['6', 'h']], flavor: 'Conector bajo explosivo en posición' }
    ],
    boardVariants: [{ label: 'Preflop BvB', cards: [] }],
    villainAction: 'Todos foldean hasta Hero en el Botón (BTN)',
    correctAction: 'Open Raise Robo a 2.2 - 2.5 BB',
    correctSizing: '2.2 BB',
    gtoFrequency: 96,
    options: [
      { label: 'Robo Open Raise (2.2 BB)', action: 'RAISE_22', isCorrect: true, evLossPct: 0 },
      { label: 'Fold Pasivo', action: 'FOLD', isCorrect: false, evLossPct: 6.4 },
      { label: 'Limp 1 BB', action: 'CALL', isCorrect: false, evLossPct: 8.9 }
    ],
    explanationDummies: 'En el Botón siempre jugarás con ventaja de posición (actuarás último después del flop) y solo quedan dos ciegas por detrás. Robar a 2.2 BB gana las 1.5 BB del bote sin oposición más de la mitad de las veces.',
    dummiesTip: 'El Botón es la silla más rentable del póker: abre amplio (40%–48%) cuando el bote llegue limpio.',
    leakWarning: 'Fuga Común: Foldear manos suited conectadas o reyes suited en el BTN ante ciegas Nits.'
  },
  // 3. Dry Flop C-Bet (Level 2)
  {
    category: 'dry_flop',
    categoryName: 'Flop Seco (Dry)',
    conceptTag: 'C-Bet Rango Pequeña 33% en Textura Seca',
    level: 2,
    potType: 'srp',
    streetLabel: 'Flop',
    heroPos: 'BTN',
    villainPos: 'BB',
    opponentProfile: 'regular',
    potBB: 6.5,
    spr: 14,
    heroCombos: [
      { label: 'AJ', cards: [['A', 's'], ['J', 'h']], flavor: 'Overcards con bloqueo al As' },
      { label: 'KQ', cards: [['K', 'c'], ['Q', 'd']], flavor: 'Top Pair o Dos Overcards sólidas' },
      { label: 'AT', cards: [['A', 'd'], ['T', 's']], flavor: 'As con kicker medio fuerte' },
      { label: '88', cards: [['8', 'h'], ['8', 'c']], flavor: 'Pareja media necesitando negar equity' },
      { label: 'KJ', cards: [['K', 's'], ['J', 'c']], flavor: 'Broadway fuerte de rango BTN' },
      { label: 'AQ', cards: [['A', 'h'], ['Q', 'c']], flavor: 'Combo premium de apertura IP' }
    ],
    boardVariants: [
      { label: 'K♦-7♣-2♠ (Arcoíris Seco)', cards: [['K', 'd'], ['7', 'c'], ['2', 's']] },
      { label: 'Q♠-6♦-2♣ (Seco Dama Alto)', cards: [['Q', 's'], ['6', 'd'], ['2', 'c']] },
      { label: 'A♣-9♦-3♥ (As Seco)', cards: [['A', 'c'], ['9', 'd'], ['3', 'h']] }
    ],
    villainAction: 'BB hace Check rápido',
    correctAction: 'C-Bet Pequeña 33% Pot',
    correctSizing: '2.1 BB',
    gtoFrequency: 84,
    options: [
      { label: 'Bet 33% Pot (2.1 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
      { label: 'Bet 75% Pot (4.9 BB)', action: 'BET_75', isCorrect: false, evLossPct: 6.1 },
      { label: 'Check Behind Automático', action: 'CHECK', isCorrect: false, evLossPct: 4.3 }
    ],
    explanationDummies: 'En mesas secas sin proyectos de color ni escalera, una apuesta barata de 1/3 del bote solo necesita que el rival foldee 1 de cada 4 veces para ser rentable automáticamente contra toda su basura.',
    dummiesTip: 'Fórmula Secos: Mesa desconectada con una carta alta = C-Bet pequeña (25%–33%) casi con toda tu baraja.',
    leakWarning: 'Fuga Común: Usar tamaños enormes (75%+) en flops secos regalando valor al hacer foldear lo peor.'
  },
  // 4. Dry Flop Set vs Calling Station (Level 1)
  {
    category: 'dry_flop',
    categoryName: 'Flop Seco (Dry)',
    conceptTag: 'Extracción de Valor Gordo vs Calling Station',
    level: 1,
    potType: 'srp',
    streetLabel: 'Flop',
    heroPos: 'CO',
    villainPos: 'BB (Calling Station)',
    opponentProfile: 'fish',
    potBB: 6.0,
    spr: 15,
    heroCombos: [
      { label: '99', cards: [['9', 'h'], ['9', 'c']], flavor: 'Trío máximo (Top Set) o Overpair' },
      { label: 'AA', cards: [['A', 's'], ['A', 'h']], flavor: 'Pareja de Ases máxima' },
      { label: 'KK', cards: [['K', 's'], ['K', 'h']], flavor: 'Pareja de Reyes dominante' },
      { label: 'QQ', cards: [['Q', 'h'], ['Q', 'c']], flavor: 'Overpair sólida en mesa baja' },
      { label: '88', cards: [['8', 'h'], ['8', 'd']], flavor: 'Trío o pareja alta vs Fish' },
      { label: 'JJ', cards: [['J', 'c'], ['J', 'd']], flavor: 'Overpair de valor puro' }
    ],
    boardVariants: [
      { label: '9♦-4♠-2♣ (Seco Bajo)', cards: [['9', 'd'], ['4', 's'], ['2', 'c']] },
      { label: '8♣-5♦-2♠ (Arcoíris Bajo)', cards: [['8', 'c'], ['5', 'd'], ['2', 's']] },
      { label: '7♠-4♣-2♥ (Mesa muy baja)', cards: [['7', 's'], ['4', 'c'], ['2', 'h']] }
    ],
    villainAction: 'El jugador recreacional (Fish) hace Check',
    correctAction: 'Value Bet Fuerte 75% Pot',
    correctSizing: '4.5 BB',
    gtoFrequency: 92,
    options: [
      { label: 'Bet 75% Valor Puro (4.5 BB)', action: 'BET_75', isCorrect: true, evLossPct: 0 },
      { label: 'Check Slowplay (Trampa)', action: 'CHECK', isCorrect: false, evLossPct: 9.4 },
      { label: 'Min-Bet 20% (1.2 BB)', action: 'BET_20', isCorrect: false, evLossPct: 5.2 }
    ],
    explanationDummies: 'Regla Explotativa Nivel 1: ¡A los jugadores Calling Station no se les hace trampa (Slowplay)! Ellos pagan con cualquier pareja del 4, As alto o dos overcards sin importar cuánto apuestes. Cóbrales grande desde el Flop.',
    dummiesTip: 'Contra Fish pasivo = NO slowplayees manos gigantes, ¡construye el bote grande de inmediato!',
    leakWarning: 'Fuga Común: Pasar con monstruos esperando que un jugador pasivo apueste por ti.'
  },
  // 5. Wet Flop Protection (Level 2)
  {
    category: 'wet_flop',
    categoryName: 'Flop Coordinado (Wet)',
    conceptTag: 'Sizing Polarizado y Protección en Boards Mojados',
    level: 2,
    potType: 'srp',
    streetLabel: 'Flop',
    heroPos: 'CO',
    villainPos: 'BTN',
    opponentProfile: 'regular',
    potBB: 7.0,
    spr: 13,
    heroCombos: [
      { label: 'TT', cards: [['T', 's'], ['T', 'h']], flavor: 'Overpair vulnerable a múltiples proyectos' },
      { label: 'JJ', cards: [['J', 's'], ['J', 'd']], flavor: 'Pareja de Jotas buscando protegerse' },
      { label: 'QQ', cards: [['Q', 's'], ['Q', 'c']], flavor: 'Overpair fuerte necesitando cobrar caro' },
      { label: 'A♠Q♠', cards: [['A', 's'], ['Q', 's']], flavor: 'Combo draw con proyectos de color y overcards' },
      { label: 'K♠Q♠', cards: [['K', 's'], ['Q', 's']], flavor: 'Proyecto fuerte semi-farol agresivo' },
      { label: '9♠7♠', cards: [['9', 's'], ['7', 's']], flavor: 'Pareja + proyecto abierto de escalera y color' }
    ],
    boardVariants: [
      { label: '9♠-8♠-6♦ (Ultra Coordinado)', cards: [['9', 's'], ['8', 's'], ['6', 'd']] },
      { label: 'J♠-T♠-5♦ (Broadway Mojado)', cards: [['J', 's'], ['T', 's'], ['5', 'd']] },
      { label: '8♥-7♥-4♣ (Conectado Dos Palos)', cards: [['8', 'h'], ['7', 'h'], ['4', 'c']] }
    ],
    villainAction: 'Hero actúa primero tras abrir preflop',
    correctAction: 'Bet Fuerte 75% Pot',
    correctSizing: '5.2 BB',
    gtoFrequency: 74,
    options: [
      { label: 'Bet 75% Pot (5.2 BB)', action: 'BET_75', isCorrect: true, evLossPct: 0 },
      { label: 'Bet 33% Pot (2.3 BB)', action: 'BET_33', isCorrect: false, evLossPct: 7.6 },
      { label: 'Check Pasivo', action: 'CHECK', isCorrect: false, evLossPct: 5.4 }
    ],
    explanationDummies: 'Cuando la mesa está llena de proyectos de escalera y color, una apuesta pequeña (33%) le da precio barato al rival para ver el Turn y superarte. Apuesta fuerte (75%) para cobrarle caro los proyectos.',
    dummiesTip: 'Mesa con cartas conectadas y dos del mismo palo = ¡Apuesta Grande (66%-75%) o Check, evita el 33%!',
    leakWarning: 'Fuga Común: Hacer C-bet mínima automática en mesas peligrosas y regalar cartas gratis.'
  },
  // 6. Wet Flop Multiway OOP Check-Fold (Level 2)
  {
    category: 'wet_flop',
    categoryName: 'Flop Coordinado (Wet)',
    conceptTag: 'Control Multiway con Aire Total',
    level: 2,
    potType: 'srp',
    streetLabel: 'Flop',
    heroPos: 'UTG',
    villainPos: 'BTN + BB',
    opponentProfile: 'lag',
    potBB: 9.0,
    spr: 10,
    heroCombos: [
      { label: 'AKo', cards: [['A', 'c'], ['K', 'd']], flavor: 'Cartas altas sin conexión ni proyecto' },
      { label: 'AQo', cards: [['A', 's'], ['Q', 'c']], flavor: 'Overcards vulnerables contra 2 rivales' },
      { label: 'KQo', cards: [['K', 's'], ['Q', 'd']], flavor: 'Sin par ni proyecto de color en mesa baja' },
      { label: 'KJs', cards: [['K', 'c'], ['J', 'c']], flavor: 'Mano sin impacto directo en tabla baja' },
      { label: 'AJo', cards: [['A', 'd'], ['J', 'c']], flavor: 'Aire total en bote 3-way' },
      { label: 'QJs', cards: [['Q', 'd'], ['J', 'd']], flavor: 'Sin respaldo ante 2 jugadores' }
    ],
    boardVariants: [
      { label: '8♥-7♥-5♣ (Conectado Bajo)', cards: [['8', 'h'], ['7', 'h'], ['5', 'c']] },
      { label: '9♣-6♣-4♦ (Muy favorable a BB)', cards: [['9', 'c'], ['6', 'c'], ['4', 'd']] },
      { label: '7♠-6♠-3♥ (Coordinado Bajo)', cards: [['7', 's'], ['6', 's'], ['3', 'h']] }
    ],
    villainAction: 'Bote Multiway (3 jugadores). Hero sin posición',
    correctAction: 'CHECK-FOLD Disciplinado',
    correctSizing: '0 BB',
    gtoFrequency: 90,
    options: [
      { label: 'Check (No Farolear Multiway)', action: 'CHECK', isCorrect: true, evLossPct: 0 },
      { label: 'C-Bet Farol 75% (6.8 BB)', action: 'BET_75', isCorrect: false, evLossPct: 12.1 },
      { label: 'Overbet All-in Farol', action: 'ALLIN', isCorrect: false, evLossPct: 31.0 }
    ],
    explanationDummies: 'En un bote con 2 o más rivales (Multiway) en mesa baja conectada, alguien casi siempre conectó dobles, trío o proyecto fuerte. Hacer C-Bet de farol con aire puro OOP contra varios rivales es quemar dinero.',
    dummiesTip: 'En botes multiway, tu frecuencia de farol debe caer en picado: juega directo por valor y equity real.',
    leakWarning: 'Fuga Común: Hacer C-Bet de farol automática cuando hay 3 o más jugadores en la mano.'
  },
  // 7. Monotone Overpair Check (Level 3)
  {
    category: 'monotone_flop',
    categoryName: 'Flop Monótono',
    conceptTag: 'Overpair sin Blocker en Mesa de 1 Palo',
    level: 3,
    potType: 'srp',
    streetLabel: 'Flop',
    heroPos: 'UTG',
    villainPos: 'BB',
    opponentProfile: 'regular',
    potBB: 6.5,
    spr: 14,
    heroCombos: [
      { label: 'KK (Sin ♥)', cards: [['K', 's'], ['K', 'd']], flavor: 'Overpair alta pero sin blocker del color' },
      { label: 'AA (Sin ♥)', cards: [['A', 's'], ['A', 'c']], flavor: 'Ases sin corazón protector' },
      { label: 'QQ (Sin ♣)', cards: [['Q', 's'], ['Q', 'd']], flavor: 'Damas vulnerables al palo monótono' },
      { label: 'JJ (Sin ♠)', cards: [['J', 'd'], ['J', 'c']], flavor: 'Jotas sin carta del palo del flop' },
      { label: 'KQs (Sin ♥)', cards: [['K', 'c'], ['Q', 'c']], flavor: 'Top Pair sin proyecto de color' },
      { label: 'AQs (Sin ♥)', cards: [['A', 'd'], ['Q', 'd']], flavor: 'Top Pair vulnerable sin blocker de triunfo' }
    ],
    boardVariants: [
      { label: 'Q♥-9♥-4♥ (Todo Corazones)', cards: [['Q', 'h'], ['9', 'h'], ['4', 'h']] },
      { label: 'J♥-8♥-3♥ (Monótono Bajo-Medio)', cards: [['J', 'h'], ['8', 'h'], ['3', 'h']] },
      { label: 'T♥-6♥-2♥ (Monótono Conectado)', cards: [['T', 'h'], ['6', 'h'], ['2', 'h']] }
    ],
    villainAction: 'BB hace Check esperando nuestra reacción',
    correctAction: 'CHECK (Control de Bote)',
    correctSizing: '0 BB',
    gtoFrequency: 78,
    options: [
      { label: 'Check Behind (Control)', action: 'CHECK', isCorrect: true, evLossPct: 0 },
      { label: 'Bet 75% Pot (4.9 BB)', action: 'BET_75', isCorrect: false, evLossPct: 10.6 },
      { label: 'Overbet 125% (8.1 BB)', action: 'BET_125', isCorrect: false, evLossPct: 16.4 }
    ],
    explanationDummies: 'En flops donde salen las 3 cartas del mismo palo (Monótonos) y NO tienes ninguna carta de ese palo, la BB tiene muchos colores ya hechos y proyectos al As/Rey. Pasar controla el tamaño del bote y evita un Check-Raise mortal.',
    dummiesTip: 'Si hay 3 cartas del mismo palo en mesa y NO tienes ninguna en tu mano, frena el pie del acelerador.',
    leakWarning: 'Fuga Común: Sobrevalorar Overpairs en boards monótonos sin carta de bloqueo.'
  },
  // 8. Paired Flop Range Bet (Level 2)
  {
    category: 'paired_flop',
    categoryName: 'Flop Emparejado',
    conceptTag: 'Frecuencia Alta 33% en Boards Emparejados',
    level: 2,
    potType: 'srp',
    streetLabel: 'Flop',
    heroPos: 'CO',
    villainPos: 'BB',
    opponentProfile: 'regular',
    potBB: 5.5,
    spr: 16,
    heroCombos: [
      { label: 'AQo', cards: [['A', 'c'], ['Q', 'd']], flavor: 'Overcards limpias buscando folds' },
      { label: 'KQs', cards: [['K', 's'], ['Q', 's']], flavor: 'Dos overcards + backdoor flush' },
      { label: 'AJo', cards: [['A', 'h'], ['J', 'c']], flavor: 'As alto agresivo de rango CO' },
      { label: '66', cards: [['6', 's'], ['6', 'h']], flavor: 'Pareja de bolsillo pequeña para proteger' },
      { label: 'KTs', cards: [['K', 'd'], ['T', 'd']], flavor: 'Broadway con backdoors sólidos' },
      { label: 'QTs', cards: [['Q', 'c'], ['T', 'c']], flavor: 'Mano especulativa ideal para presión barata' }
    ],
    boardVariants: [
      { label: 'J♠-J♥-4♦ (Doble Jota Seca)', cards: [['J', 's'], ['J', 'h'], ['4', 'd']] },
      { label: 'T♠-T♥-3♦ (Doble Diez Seco)', cards: [['T', 's'], ['T', 'h'], ['3', 'd']] },
      { label: 'K♠-K♥-5♦ (Doble Rey Seco)', cards: [['K', 's'], ['K', 'h'], ['5', 'd']] }
    ],
    villainAction: 'BB Checks',
    correctAction: 'C-Bet Pequeña 33% Pot',
    correctSizing: '1.8 BB',
    gtoFrequency: 86,
    options: [
      { label: 'Bet 33% Pot (1.8 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
      { label: 'Check Behind Pasivo', action: 'CHECK', isCorrect: false, evLossPct: 4.1 },
      { label: 'Bet 100% Pot (5.5 BB)', action: 'BET_100', isCorrect: false, evLossPct: 8.9 }
    ],
    explanationDummies: 'Cuando hay una pareja en la mesa (ej. J-J-4), es dificilísimo que el rival haya ligado un trío (solo quedan 2 Jotas en todo el mazo). Una apuesta pequeña de 1/3 gana el bote de inmediato barriendo manos que no ligaron nada.',
    dummiesTip: 'Mesa Emparejada = casi nadie conectó. Una pequeña apuesta de 33% es una mina de fichas gratis.',
    leakWarning: 'Fuga Común: Creer que necesitas llevar pareja o trío para apostar en flops emparejados.'
  },
  // 9. 3-Bet Pot Low SPR (Level 3)
  {
    category: 'three_bet_pot',
    categoryName: 'Botes 3-Bet',
    conceptTag: 'C-Bet Geométrica 33% en Bote 3-Bet (SPR ~4)',
    level: 3,
    potType: '3bet',
    streetLabel: 'Flop',
    heroPos: 'BB',
    villainPos: 'BTN',
    opponentProfile: 'regular',
    potBB: 20.0,
    spr: 4.5,
    heroCombos: [
      { label: 'AKs', cards: [['A', 's'], ['K', 's']], flavor: 'Top Pair Top Kicker de manual' },
      { label: 'QQ', cards: [['Q', 'h'], ['Q', 'd']], flavor: 'Overpair o 2ª pareja en bote grande' },
      { label: 'AQs', cards: [['A', 'h'], ['Q', 'h']], flavor: 'Broadway premium con gran equity' },
      { label: 'JJ', cards: [['J', 's'], ['J', 'c']], flavor: 'Pareja media-alta con SPR corto' },
      { label: 'KQs', cards: [['K', 'c'], ['Q', 'c']], flavor: 'Broadway suited agresiva' },
      { label: 'TT', cards: [['T', 'd'], ['T', 'c']], flavor: 'Pareja controlando rango rival' }
    ],
    boardVariants: [
      { label: 'A♦-7♣-3♠ (As Seco 3-Bet)', cards: [['A', 'd'], ['7', 'c'], ['3', 's']] },
      { label: 'K♦-8♣-2♠ (Rey Seco 3-Bet)', cards: [['K', 'd'], ['8', 'c'], ['2', 's']] },
      { label: 'Q♦-6♣-2♥ (Dama Seca 3-Bet)', cards: [['Q', 'd'], ['6', 'c'], ['2', 'h']] }
    ],
    villainAction: 'Hero hizo 3-Bet preflop OOP y llega primero al Flop',
    correctAction: 'C-Bet 33% Pot (SPR Bajo)',
    correctSizing: '6.6 BB',
    gtoFrequency: 82,
    options: [
      { label: 'Bet 33% Pot (6.6 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
      { label: 'Bet 80% Pot (16 BB)', action: 'BET_80', isCorrect: false, evLossPct: 6.4 },
      { label: 'Check-Fold', action: 'CHECK', isCorrect: false, evLossPct: 8.7 }
    ],
    explanationDummies: 'En un bote 3-Bet ya hay 20 BB en el centro y solo quedan ~90 BB detrás (SPR bajo ~4.5). Con apuestas pequeñas de 33% en Flop, Turn y River metes todo el stack cómodamente sin asustar al rango peor del rival.',
    dummiesTip: 'Bote 3-Bet + Board Seco = Bet 33% (es más fácil ir all-in en 3 calles suaves que con un pelotazo gigante).',
    leakWarning: 'Fuga Común: Usar sizings de bote (75%–100%) en botes 3-Bet secos OOP.'
  },
  // 10. Squeeze Preflop (Level 2)
  {
    category: 'squeeze',
    categoryName: 'Squeeze Spots',
    conceptTag: 'Squeeze Polarizado / Valor contra Open + Call',
    level: 2,
    potType: 'squeeze',
    streetLabel: 'Preflop',
    heroPos: 'SB',
    villainPos: 'CO + BTN',
    opponentProfile: 'regular',
    potBB: 6.0,
    spr: 16,
    heroCombos: [
      { label: 'AQo', cards: [['A', 'h'], ['Q', 's']], flavor: 'Broadway fuerte que sufre multiway OOP' },
      { label: 'AJs', cards: [['A', 's'], ['J', 's']], flavor: 'As suited dominador' },
      { label: 'KQs', cards: [['K', 'h'], ['Q', 'h']], flavor: 'Mano alta conectada con bloqueadores' },
      { label: 'TT', cards: [['T', 's'], ['T', 'd']], flavor: 'Pareja que prefiere aislar 1v1' },
      { label: 'JJ', cards: [['J', 'h'], ['J', 'd']], flavor: 'Premium media buscando fold equity' },
      { label: 'A5s', cards: [['A', 'd'], ['5', 'd']], flavor: 'Squeeze semibluff con bloqueador al As' }
    ],
    boardVariants: [{ label: 'Preflop Multiway Dead Money', cards: [] }],
    villainAction: 'CO abre 2.5 BB y BTN hace Call pasivo 2.5 BB',
    correctAction: 'SQUEEZE a 12 - 14 BB',
    correctSizing: '13 BB',
    gtoFrequency: 85,
    options: [
      { label: 'Squeeze Raise a 13 BB', action: 'RAISE_13', isCorrect: true, evLossPct: 0 },
      { label: 'Flat Call 2.5 BB', action: 'CALL', isCorrect: false, evLossPct: 8.3 },
      { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 14.2 }
    ],
    explanationDummies: 'Cuando uno abre y otro solo paga (Call pasivo), el que pagó tiene una mano débil/media que NO aguanta presión, y hay 6 BB muertas en el bote. Un Squeeze fuerte a 13 BB suele llevarse el bote directo sin jugar sin posición.',
    dummiesTip: 'Fórmula Squeeze: 3x de la subida inicial + 1x por cada jugador que pagó + extra por estar sin posición (12-14 BB).',
    leakWarning: 'Fuga Común: Hacer solo Call en ciegas con manos buenas y entrar 3-way sin posición.'
  },
  // 11. ROL vs Fish Limpers (Level 1)
  {
    category: 'rol',
    categoryName: 'ROL (Raise Over Limpers)',
    conceptTag: 'Aislamiento (ROL) contra Jugador Pasivo',
    level: 1,
    potType: 'srp',
    streetLabel: 'Preflop',
    heroPos: 'BTN',
    villainPos: 'MP (Fish)',
    opponentProfile: 'fish',
    potBB: 2.5,
    spr: 40,
    heroCombos: [
      { label: 'AJo', cards: [['A', 'd'], ['J', 's']], flavor: 'Mano dominante contra rango de limp' },
      { label: 'KQo', cards: [['K', 'h'], ['Q', 'c']], flavor: 'Broadway superior para aislar Fish' },
      { label: 'KJs', cards: [['K', 's'], ['J', 's']], flavor: 'Suited broadway con enorme ventaja' },
      { label: 'ATs', cards: [['A', 'c'], ['T', 'c']], flavor: 'As fuerte para jugar IP 1v1' },
      { label: '88', cards: [['8', 's'], ['8', 'd']], flavor: 'Pareja media buscando 1v1 con ventaja' },
      { label: 'QJs', cards: [['Q', 'd'], ['J', 'd']], flavor: 'Conectada fuerte en posición' }
    ],
    boardVariants: [{ label: 'Preflop 1 Limper', cards: [] }],
    villainAction: 'Jugador recreacional entra pagando solo 1 BB (Open Limp)',
    correctAction: 'ROL Raise a 4.0 BB',
    correctSizing: '4.0 BB',
    gtoFrequency: 93,
    options: [
      { label: 'ROL Raise a 4.0 BB', action: 'RAISE_40', isCorrect: true, evLossPct: 0 },
      { label: 'Over-Limp (Pagar 1 BB)', action: 'CALL', isCorrect: false, evLossPct: 7.9 },
      { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 11.5 }
    ],
    explanationDummies: 'El jugador que hace "Limp" (pagar 1 ciega) anuncia una mano débil o especulativa. Sube a 4 BB (3 BB base + 1 BB por cada limper) para echar a las ciegas y quedarte mano a mano en posición contra el jugador más débil.',
    dummiesTip: 'Fórmula ROL: 3 BB + 1 BB por cada limper (en posición). ¡Nunca limpees detrás con manos fuertes!',
    leakWarning: 'Fuga Común: Contagiarse del juego pasivo haciendo limp detrás en vez de aislar.'
  },
  // 12. Blind Defense BB vs BTN (Level 2)
  {
    category: 'blind_defense',
    categoryName: 'Defensa de Ciegas',
    conceptTag: 'Defensa Matemática BB por Pot Odds & MDF',
    level: 2,
    potType: 'srp',
    streetLabel: 'Preflop',
    heroPos: 'BB',
    villainPos: 'BTN',
    opponentProfile: 'regular',
    potBB: 4.0,
    spr: 22,
    heroCombos: [
      { label: 'Q9o', cards: [['Q', 'd'], ['9', 's']], flavor: 'Suficiente equity contra rango amplio BTN' },
      { label: 'K7s', cards: [['K', 'c'], ['7', 'c']], flavor: 'Rey suited con excelente jugabilidad' },
      { label: 'J8s', cards: [['J', 'h'], ['8', 'h']], flavor: 'Mano suited conectada ideal para defender BB' },
      { label: 'T7s', cards: [['T', 's'], ['7', 's']], flavor: 'Conector con proyectos implícitos' },
      { label: '64s', cards: [['6', 'd'], ['4', 'd']], flavor: 'Suited gapper con buen precio de call' },
      { label: 'A2o', cards: [['A', 'h'], ['2', 'd']], flavor: 'As offsuit rentable ante min-open 2.2 BB' }
    ],
    boardVariants: [{ label: 'Preflop Defend Price', cards: [] }],
    villainAction: 'BTN sube barato a 2.2 BB y SB foldea',
    correctAction: 'CALL Defend (Pagar 1.2 BB)',
    correctSizing: '1.2 BB',
    gtoFrequency: 90,
    options: [
      { label: 'Call Defend (1.2 BB)', action: 'CALL', isCorrect: true, evLossPct: 0 },
      { label: 'Fold Automático', action: 'FOLD', isCorrect: false, evLossPct: 6.8 },
      { label: 'All-in 100 BB', action: 'ALLIN', isCorrect: false, evLossPct: 38.0 }
    ],
    explanationDummies: 'Ya pusiste 1 BB obligatoria en la mesa; solo necesitas poner 1.2 BB extra para ganar un bote de 4.7 BB (necesitas ganar apenas el ~25% del tiempo). Foldear manos decentes aquí regala fichas automáticas al Botón.',
    dummiesTip: 'Cuanto más pequeño suba el rival en el Botón (2x–2.2x), más amplio debes pagar desde la Ciega Grande.',
    leakWarning: 'Fuga Común: Sobre-foldear la Big Blind convirtiéndose en cajero automático para robos.'
  },
  // 13. 4-Bet Bluff con Bloqueadores (Level 3)
  {
    category: 'four_bet',
    categoryName: '4-Bet Pots',
    conceptTag: '4-Bet Farol Polarizado con Bloqueador al As',
    level: 3,
    potType: '4bet',
    streetLabel: 'Preflop',
    heroPos: 'BTN',
    villainPos: 'SB (Agresivo)',
    opponentProfile: 'lag',
    potBB: 13.5,
    spr: 8,
    heroCombos: [
      { label: 'A5s', cards: [['A', 's'], ['5', 's']], flavor: 'Rey de los 4-Bet bluffs por bloqueo + Wheel' },
      { label: 'A4s', cards: [['A', 'h'], ['4', 'h']], flavor: 'Bloqueador AA/AK con equity de color' },
      { label: 'A3s', cards: [['A', 'd'], ['3', 'd']], flavor: 'Combo polarizado ideal vs 3-Bet alto' },
      { label: 'KQs', cards: [['K', 'c'], ['Q', 'c']], flavor: 'Bloquea KK/QQ/AK en rango rival' },
      { label: 'KJs', cards: [['K', 'd'], ['J', 'd']], flavor: 'Bloqueadores de Reyes y Jotas altos' },
      { label: 'ATs', cards: [['A', 'c'], ['T', 'c']], flavor: 'Excelente candidato 4-Bet IP vs ciegas' }
    ],
    boardVariants: [{ label: 'Preflop vs SB 3-Bet', cards: [] }],
    villainAction: 'Hero abrió 2.5 BB en BTN y SB lanza 3-Bet agresivo a 11 BB',
    correctAction: '4-Bet Bluff a 23 BB',
    correctSizing: '23 BB',
    gtoFrequency: 68,
    options: [
      { label: '4-Bet Bluff a 23 BB', action: 'RAISE_23', isCorrect: true, evLossPct: 0 },
      { label: 'Fold ante 3-Bet', action: 'FOLD', isCorrect: false, evLossPct: 5.5 },
      { label: 'All-in Directo 100 BB', action: 'ALLIN', isCorrect: false, evLossPct: 17.5 }
    ],
    explanationDummies: 'Tener un As o Rey suited en tu mano reduce las probabilidades de que el rival tenga AA, KK o AK. Subiendo a 23 BB presionas todos sus 3-Bets faroles y conservas color al As si te paga.',
    dummiesTip: 'Para farolear con 4-Bet usa Ases pequeños suited (A5s-A3s): bloquean sus monstruos y juegan bien si te pagan.',
    leakWarning: 'Fuga Común: Hacer 4-Bet únicamente con AA y KK.'
  },
  // 14. Limp Re-Raise Trampa BvB (Level 3)
  {
    category: 'limp_reraise',
    categoryName: 'Limp Re-Raise',
    conceptTag: 'Inducción y Castigo Blind vs Blind',
    level: 3,
    potType: '3bet',
    streetLabel: 'Preflop',
    heroPos: 'SB',
    villainPos: 'BB (LAG)',
    opponentProfile: 'lag',
    potBB: 5.0,
    spr: 18,
    heroCombos: [
      { label: 'AA', cards: [['A', 's'], ['A', 'h']], flavor: 'Ases induciendo agresión en BvB' },
      { label: 'KK', cards: [['K', 's'], ['K', 'd']], flavor: 'Reyes castigando aislamiento rival' },
      { label: 'QQ', cards: [['Q', 'h'], ['Q', 'c']], flavor: 'Damas premium en guerra de ciegas' },
      { label: 'AKs', cards: [['A', 'd'], ['K', 'd']], flavor: 'Combo máximo suited en BvB' },
      { label: 'JJ', cards: [['J', 's'], ['J', 'h']], flavor: 'Pareja fuerte vs aislamiento amplio' },
      { label: 'AQs', cards: [['A', 'c'], ['Q', 'c']], flavor: 'Dominadora del rango de ROL de BB' }
    ],
    boardVariants: [{ label: 'Preflop Blind vs Blind', cards: [] }],
    villainAction: 'Hero completa 1 BB en SB, BB sube agresivo a 4 BB',
    correctAction: 'Limp Re-Raise a 13 BB',
    correctSizing: '13 BB',
    gtoFrequency: 86,
    options: [
      { label: 'Limp Re-Raise a 13 BB', action: 'RAISE_13', isCorrect: true, evLossPct: 0 },
      { label: 'Solo Call 4 BB OOP', action: 'CALL', isCorrect: false, evLossPct: 6.5 },
      { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 39.0 }
    ],
    explanationDummies: 'En guerra de ciegas contra un rival agresivo que castiga todos los limps, completar para luego resubir (Limp Re-Raise) construye botes enormes desde antes del flop mientras tienes la ventaja máxima.',
    dummiesTip: 'Si completas en SB para tender trampa a un rival agresivo, ¡ejecuta la resubida cuando él muerda el anzuelo!',
    leakWarning: 'Fuga Común: Solo pagar fuera de posición dejando que la BB vea cartas gratis.'
  },
  // 15. Turn Polarized Overbet (Level 4)
  {
    category: 'wet_flop',
    categoryName: 'Polarización en Turn',
    conceptTag: 'Overbet 125% en Turn con Ventaja de Nuts IP',
    level: 4,
    potType: 'srp',
    streetLabel: 'Turn',
    heroPos: 'BTN',
    villainPos: 'BB',
    opponentProfile: 'regular',
    potBB: 14.0,
    spr: 5.5,
    heroCombos: [
      { label: 'KQs (Set/Top Two)', cards: [['K', 's'], ['Q', 's']], flavor: 'Mano nutizada polarizada IP' },
      { label: 'A5s (Nut Draw)', cards: [['A', 'd'], ['5', 'd']], flavor: 'Farol polarizado con bloqueo y proyecto máximo' },
      { label: '66 (Trío)', cards: [['6', 's'], ['6', 'c']], flavor: 'Trío buscando maximizar valor en 2 calles' },
      { label: 'J9s (Escalera)', cards: [['J', 'h'], ['9', 'h']], flavor: 'Nuts absolutas en el turn' },
      { label: 'A2s (Combo Draw)', cards: [['A', 'c'], ['2', 'c']], flavor: 'Semi-farol de altísima presión IP' },
      { label: 'QQ (Trío)', cards: [['Q', 'h'], ['Q', 'd']], flavor: 'Monstruo inmune en textura favorable a IP' }
    ],
    boardVariants: [
      { label: 'K♦-8♠-6♥ · Q♣ (Turn Broadway)', cards: [['K', 'd'], ['8', 's'], ['6', 'h'], ['Q', 'c']] },
      { label: 'T♠-7♣-3♦ · A♥ (Turn Overcard As)', cards: [['T', 's'], ['7', 'c'], ['3', 'd'], ['A', 'h']] },
      { label: '9♣-5♦-2♠ · K♥ (Turn Rey Seco)', cards: [['9', 'c'], ['5', 'd'], ['2', 's'], ['K', 'h']] }
    ],
    villainAction: 'BB hizo Check-Call en flop y pasa de nuevo en Turn favorable a Hero',
    correctAction: 'Overbet 125% Pot en Turn',
    correctSizing: '17.5 BB',
    gtoFrequency: 72,
    options: [
      { label: 'Overbet 125% Pot (17.5 BB)', action: 'OVERBET_125', isCorrect: true, evLossPct: 0 },
      { label: 'Bet 25% Minúscula (3.5 BB)', action: 'BET_25', isCorrect: false, evLossPct: 6.9 },
      { label: 'Check Behind Pasivo', action: 'CHECK', isCorrect: false, evLossPct: 8.1 }
    ],
    explanationDummies: 'En el Turn aparecen cartas altas (As/Rey/Dama) que favorecen muchísimo al agresor preflop y NO a la BB que solo defendió manos medias. Al tener rango polarizado (Nuts o Semi-bluff fuertes), el Overbet 125% pone máxima presión matemática.',
    dummiesTip: 'Nivel 4 GTO: Cuando tienes mucho más "Nuts" que el rival en el Turn, ¡rompe la barrera del 100% del bote!',
    leakWarning: 'Fuga Común: Apostar siempre 50% por costumbre en el Turn dejando valor y fold equity en la mesa.'
  },
  // 16. River Bluff Catching vs Missed Draws (Level 3)
  {
    category: 'bluff_catch',
    categoryName: 'Bluff Catching en River',
    conceptTag: 'Caza de Faroles ante Draws Fallidos',
    level: 3,
    potType: 'srp',
    streetLabel: 'River',
    heroPos: 'BB',
    villainPos: 'BTN (LAG)',
    opponentProfile: 'lag',
    potBB: 24.0,
    spr: 1.5,
    heroCombos: [
      { label: 'AJ (Sin picas)', cards: [['A', 'h'], ['J', 'c']], flavor: 'Top Pair + sin bloquear proyectos fallidos' },
      { label: 'KQ (Sin trébol)', cards: [['K', 'h'], ['Q', 'd']], flavor: 'Bluff catcher perfecto sin bloqueadores malos' },
      { label: 'AT (Sin diamantes)', cards: [['A', 'c'], ['T', 'h']], flavor: 'Mano media-alta frente a múltiples draws rotos' },
      { label: 'KJ (Sin corazones)', cards: [['K', 'd'], ['J', 'c']], flavor: 'No bloquea el flush fallido rival' },
      { label: 'AQ (Sin picas)', cards: [['A', 'c'], ['Q', 'h']], flavor: 'Top Pair excelente contra triple barrel' },
      { label: 'KT (Sin diamantes)', cards: [['K', 'h'], ['T', 'c']], flavor: 'Desbloquea todos los faroles del LAG' }
    ],
    boardVariants: [
      { label: 'A♠-8♠-4♦-2♣-7♥ (Color Picas Fallido)', cards: [['A', 's'], ['8', 's'], ['4', 'd'], ['2', 'c'], ['7', 'h']] },
      { label: 'K♦-9♦-5♣-2♠-6♥ (Proyectos Rotos)', cards: [['K', 'd'], ['9', 'd'], ['5', 'c'], ['2', 's'], ['6', 'h']] },
      { label: 'A♣-7♣-3♠-2♦-8♥ (Tréboles Fallidos)', cards: [['A', 'c'], ['7', 'c'], ['3', 's'], ['2', 'd'], ['8', 'h']] }
    ],
    villainAction: 'BTN LAG dispara 3ª bala de 16 BB en river ladrillo',
    correctAction: 'CALL Bluff Catch (16 BB)',
    correctSizing: '16 BB',
    gtoFrequency: 76,
    options: [
      { label: 'Call Bluff Catch (16 BB)', action: 'CALL', isCorrect: true, evLossPct: 0 },
      { label: 'Fold Asustado', action: 'FOLD', isCorrect: false, evLossPct: 9.2 },
      { label: 'Check-Raise All-in Farol', action: 'ALLIN', isCorrect: false, evLossPct: 18.4 }
    ],
    explanationDummies: 'Todos los proyectos de color y escalera del flop fallaron en el river. Además NO tienes cartas de esos palos fallidos (así que el rival SÍ puede llevarlos como farol). Pagar caza todos sus bluffs rotos.',
    dummiesTip: 'Bluff Catch Regla de Oro: Paga cuando NO bloqueas los proyectos que fallaron en el board.',
    leakWarning: 'Fuga Común: Foldear Top Pair por pánico ante la tercera apuesta en mesas donde todo falló.'
  },
  // 17. River Fold Disciplinado vs Nit Overbet (Level 4)
  {
    category: 'bluff_catch',
    categoryName: 'Bluff Catching en River',
    conceptTag: 'Explotación Extrema: Fold ante Nit Overbet',
    level: 4,
    potType: 'srp',
    streetLabel: 'River',
    heroPos: 'BB',
    villainPos: 'UTG (Nit)',
    opponentProfile: 'nit',
    potBB: 30.0,
    spr: 1.4,
    heroCombos: [
      { label: 'KQ (Top Pair)', cards: [['K', 's'], ['Q', 'c']], flavor: 'Buen Top Pair pero vencido ante rango Nit' },
      { label: 'KJ (1 Par)', cards: [['K', 'c'], ['J', 'd']], flavor: 'Bluff catcher insuficiente vs Nit Overbet' },
      { label: 'QQ (Sin Color)', cards: [['Q', 's'], ['Q', 'c']], flavor: 'Overpair superada por Ases y Colores' },
      { label: 'JJ (2ª Pareja)', cards: [['J', 's'], ['J', 'd']], flavor: 'Pareja incapaz de vencer rango de valor Nit' },
      { label: 'KT', cards: [['K', 'c'], ['T', 'd']], flavor: 'Pareja de Reyes dominada en river peligroso' },
      { label: 'QJ', cards: [['Q', 'c'], ['J', 's']], flavor: 'Bluff catcher marginal ante jugador pasivo' }
    ],
    boardVariants: [
      { label: 'K♦-9♥-5♥-2♣-A♥ (Completa A + Color ♥)', cards: [['K', 'd'], ['9', 'h'], ['5', 'h'], ['2', 'c'], ['A', 'h']] },
      { label: 'Q♠-8♣-4♣-3♦-A♣ (Completa A + Color ♣)', cards: [['Q', 's'], ['8', 'c'], ['4', 'c'], ['3', 'd'], ['A', 'c']] },
      { label: 'J♦-7♠-4♠-2♥-A♠ (Completa A + Color ♠)', cards: [['J', 'd'], ['7', 's'], ['4', 's'], ['2', 'h'], ['A', 's']] }
    ],
    villainAction: 'Se completa el As + Color en el River y el rival Nit va All-in (42 BB)',
    correctAction: 'FOLD Disciplinado',
    correctSizing: '0 BB',
    gtoFrequency: 98,
    options: [
      { label: 'Fold Limpio (Respeta Nit)', action: 'FOLD', isCorrect: true, evLossPct: 0 },
      { label: 'Hero Call por Curiosidad (42 BB)', action: 'CALL', isCorrect: false, evLossPct: 24.5 },
      { label: 'Call Rápido', action: 'CALL_FAST', isCorrect: false, evLossPct: 24.5 }
    ],
    explanationDummies: 'Un jugador ultra conservador (Nit) prácticamente NUNCA convierte su mano en farol masivo cuando se completan el As y el Color al mismo tiempo en el river. Ahorrar esas 42 BB es pura rentabilidad en High Stakes.',
    dummiesTip: 'Cuando un jugador pasivo/Nit apuesta gigante en un river aterrador, ¡créele y foldea rápido!',
    leakWarning: 'Fuga Común: Pagar overbets de jugadores Nits diciendo "es que no le creo".'
  },
  // 18. River Zero Bluff vs Calling Station (Level 1)
  {
    category: 'bluff_catch',
    categoryName: 'Control River vs Fish',
    conceptTag: 'Cero Faroles Puros contra Calling Station',
    level: 1,
    potType: 'srp',
    streetLabel: 'River',
    heroPos: 'BTN',
    villainPos: 'BB (Calling Station)',
    opponentProfile: 'fish',
    potBB: 22.0,
    spr: 2.0,
    heroCombos: [
      { label: 'QJs (Fallado)', cards: [['Q', 's'], ['J', 's']], flavor: 'Proyecto fallido en el river sin pareja' },
      { label: 'JTs (Fallado)', cards: [['J', 'c'], ['T', 'c']], flavor: 'Aire en el river vs jugador que no foldea' },
      { label: 'T9s (Fallado)', cards: [['T', 's'], ['9', 's']], flavor: 'Escalera abierta no completada' },
      { label: '76s (Fallado)', cards: [['7', 's'], ['6', 's']], flavor: 'Proyecto sin ligar pareja final' },
      { label: 'KQs (Fallado)', cards: [['K', 'c'], ['Q', 'c']], flavor: 'Dama-Rey sin impacto vs Fish' },
      { label: 'A5s (Fallado)', cards: [['A', 'c'], ['5', 'c']], flavor: 'As alto sin pareja en mesa conectada' }
    ],
    boardVariants: [
      { label: '9♦-8♣-2♠-4♥-K♦', cards: [['9', 'd'], ['8', 'c'], ['2', 's'], ['4', 'h'], ['K', 'd']] },
      { label: '9♥-7♦-3♣-2♠-A♣', cards: [['9', 'h'], ['7', 'd'], ['3', 'c'], ['2', 's'], ['A', 'c']] },
      { label: '8♦-6♣-2♥-5♠-K♠', cards: [['8', 'd'], ['6', 'c'], ['2', 'h'], ['5', 's'], ['K', 's']] }
    ],
    villainAction: 'Fish pagó flop y turn, hace Check rápido en River',
    correctAction: 'CHECK BEHIND (No Farolear al Fish)',
    correctSizing: '0 BB',
    gtoFrequency: 100,
    options: [
      { label: 'Check Behind (Ahorrar Fichas)', action: 'CHECK', isCorrect: true, evLossPct: 0 },
      { label: 'Bet 75% Farol (16.5 BB)', action: 'BET_75', isCorrect: false, evLossPct: 13.8 },
      { label: 'All-in Farol (44 BB)', action: 'ALLIN', isCorrect: false, evLossPct: 28.5 }
    ],
    explanationDummies: 'Mandamiento #1 contra Calling Stations: ¡NO farolees el river con aire cuando fallaste tus proyectos! Un Calling Station pagará con cualquier par del 8, 9 o incluso 4 por curiosidad.',
    dummiesTip: 'Contra jugadores que pagan todo: apuesta solo tus manos buenas y ríndete gratis cuando falles.',
    leakWarning: 'Fuga Común: Intentar "tirar" del bote a jugadores recreacionales que nunca foldean pareja.'
  },
  // 19. 4-Bet Value / Stack-off IP (Level 4)
  {
    category: 'four_bet',
    categoryName: '4-Bet Pots',
    conceptTag: 'Thin Value C-Bet IP en Bote 4-Bet SPR ~1.6',
    level: 4,
    potType: '4bet',
    streetLabel: 'Flop',
    heroPos: 'BTN',
    villainPos: 'BB',
    opponentProfile: 'regular',
    potBB: 46.0,
    spr: 1.7,
    heroCombos: [
      { label: 'QQ', cards: [['Q', 's'], ['Q', 'h']], flavor: 'Overpair fuerte con SPR mínimo' },
      { label: 'KK', cards: [['K', 'h'], ['K', 'c']], flavor: 'Overpair dominante en bote 4-Bet' },
      { label: 'AA', cards: [['A', 'c'], ['A', 'd']], flavor: 'Top Pair o Overpair imparable' },
      { label: 'JJ', cards: [['J', 's'], ['J', 'c']], flavor: 'Pareja buscando comprometer stacks en mesa baja' },
      { label: 'AKs', cards: [['A', 's'], ['K', 's']], flavor: 'A/K conectado con backdoor nuts' },
      { label: 'TT', cards: [['T', 'h'], ['T', 'd']], flavor: 'Overpair fuerte en tabla ultra baja' }
    ],
    boardVariants: [
      { label: '9♣-5♦-2♠ (Ultra Seco 4-Bet)', cards: [['9', 'c'], ['5', 'd'], ['2', 's']] },
      { label: '8♦-4♣-2♥ (Mesa Baja 4-Bet)', cards: [['8', 'd'], ['4', 'c'], ['2', 'h']] },
      { label: '7♠-3♦-2♣ (Micro Tabla 4-Bet)', cards: [['7', 's'], ['3', 'd'], ['2', 'c']] }
    ],
    villainAction: 'BB pagó 4-Bet preflop y hace Check OOP',
    correctAction: 'Bet Pequeña 25% Pot (11.5 BB)',
    correctSizing: '11.5 BB',
    gtoFrequency: 89,
    options: [
      { label: 'Bet 25% Pot (11.5 BB)', action: 'BET_25', isCorrect: true, evLossPct: 0 },
      { label: 'Overbet Shove Inmediato', action: 'ALLIN', isCorrect: false, evLossPct: 4.9 },
      { label: 'Check Behind', action: 'CHECK', isCorrect: false, evLossPct: 6.2 }
    ],
    explanationDummies: 'En un bote 4-Bet el bote ya es gigante (46 BB) respecto al stack restante (~78 BB). Una apuesta de apenas 25% del bote ata el resto del dinero fácil en el Turn, permitiendo extraer de parejas menores y AK/AQ.',
    dummiesTip: 'Cuanto más grande fue la guerra preflop (3-Bet/4-Bet), más pequeño (20%–33%) necesitas apostar en flops secos.',
    leakWarning: 'Fuga Común: Ir all-in gigante en el flop del bote 4-bet expulsando todos los bluffs y manos dominadas.'
  },
  // 20. Thin Value River IP vs Regular (Level 4)
  {
    category: 'bluff_catch',
    categoryName: 'Thin Value River',
    conceptTag: 'Apuesta Fina de Valor (33%) IP en River Seguro',
    level: 4,
    potType: '3bet',
    streetLabel: 'River',
    heroPos: 'BTN',
    villainPos: 'BB',
    opponentProfile: 'regular',
    potBB: 28.0,
    spr: 1.6,
    heroCombos: [
      { label: 'AQo (TPTK)', cards: [['A', 'd'], ['Q', 'h']], flavor: 'Top Pair buen kicker en runout seco' },
      { label: 'KQs (Top Pair)', cards: [['K', 's'], ['Q', 'c']], flavor: 'Rey-Dama por valor fino IP' },
      { label: 'AJs', cards: [['A', 'h'], ['J', 'd']], flavor: 'As-Jota extrayendo de 2ª pareja' },
      { label: 'KK (Overpair)', cards: [['K', 'c'], ['K', 'd']], flavor: 'Reyes cobrando de pares medios' },
      { label: 'JJ (Overpair)', cards: [['J', 's'], ['J', 'h']], flavor: 'Jotas extrayendo valor bloqueado' },
      { label: 'TT (2ª Pareja Fuerte)', cards: [['T', 's'], ['T', 'd']], flavor: 'Valor fino contra rango capeado de check' }
    ],
    boardVariants: [
      { label: '9♠-6♦-2♣-4♥-3♠ (Ladrillo Total)', cards: [['9', 's'], ['6', 'd'], ['2', 'c'], ['4', 'h'], ['3', 's']] },
      { label: '8♣-5♦-2♥-3♠-4♦ (Mesa Baja Estable)', cards: [['8', 'c'], ['5', 'd'], ['2', 'h'], ['3', 's'], ['4', 'd']] },
      { label: 'T♣-5♠-2♦-3♥-4♣ (Sin Proyectos Completos)', cards: [['T', 'c'], ['5', 's'], ['2', 'd'], ['3', 'h'], ['4', 'c']] }
    ],
    villainAction: 'BB hace Check rápido en el River tras haber pagado Flop y Turn',
    correctAction: 'Thin Value Bet 33% Pot (9.2 BB)',
    correctSizing: '9.2 BB',
    gtoFrequency: 78,
    options: [
      { label: 'Thin Value Bet 33% (9.2 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
      { label: 'Check Behind por Miedo', action: 'CHECK', isCorrect: false, evLossPct: 5.8 },
      { label: 'Overbet 150% (42 BB)', action: 'OVERBET_150', isCorrect: false, evLossPct: 11.4 }
    ],
    explanationDummies: 'El rival pasó en un river completamente inofensivo, limitando su rango a parejas medias (9x, 88, 6x). Una apuesta pequeña del 33% induce llamadas cómodas de esas manos peores maximizando tu winrate en bb/100.',
    dummiesTip: 'Apuesta Fina (Thin Value): Un 33% en el river parece barato para el rival, haciendo que pague con segundos pares.',
    leakWarning: 'Fuga Común: Hacer Check Behind con manos medias-fuertes dejando ganar decenas de cajas al mes.'
  }
];

function buildExpandedPool(): EvaluationQuestion[] {
  const pool: EvaluationQuestion[] = [];

  for (let bIdx = 0; bIdx < BLUEPRINTS.length; bIdx++) {
    const bp = BLUEPRINTS[bIdx];
    const levelDef = EDUCATIONAL_LEVELS.find(l => l.level === bp.level)!;

    // For each blueprint, generate deterministic variations across heroCombos x boardVariants x suitOffsets
    // Target: ~34-36 distinct valid variations per blueprint -> ~680 total unique questions
    let variantCount = 0;
    for (let hIdx = 0; hIdx < bp.heroCombos.length; hIdx++) {
      for (let brdIdx = 0; brdIdx < bp.boardVariants.length; brdIdx++) {
        const rotationsNeeded = bp.boardVariants.length === 1 ? 6 : 2;
        for (let rot = 0; rot < rotationsNeeded; rot++) {
          variantCount += 1;
          const hc = bp.heroCombos[hIdx];
          const bv = bp.boardVariants[brdIdx];
          const { heroCards, board } = allocateHandAndBoard(hc.cards, bv.cards, (bIdx + hIdx + rot) % 4);

          // Rotate assignment neatly between 'fixed', 'levels', and 'variable' so EVERY modality has >= 215 unique questions!
          const globalSeq = pool.length;
          const modeMod = globalSeq % 3;
          const mode: EvaluationMode = modeMod === 0 ? 'fixed' : modeMod === 1 ? 'levels' : 'variable';
          const prefix = mode === 'fixed' ? 'F' : mode === 'levels' ? `N${bp.level}` : 'S';

          pool.push({
            id: `${prefix}-${bIdx + 1}-${variantCount}-${globalSeq + 1}`,
            mode,
            level: bp.level,
            levelLabel: `${levelDef.name} (${levelDef.stakes})`,
            conceptTag: bp.conceptTag,
            dummiesTip: bp.dummiesTip,
            streetLabel: bp.streetLabel,
            category: bp.category,
            categoryName: bp.categoryName,
            title: `${bp.categoryName} · ${hc.label} en ${bp.heroPos} vs ${bp.villainPos} (${bv.label})`,
            heroCards,
            board,
            potBB: Number((bp.potBB + (rot % 2) * 0.5).toFixed(1)),
            spr: bp.spr,
            opponentProfile: bp.opponentProfile,
            potType: bp.potType,
            heroPos: bp.heroPos,
            villainPos: bp.villainPos,
            villainAction: `${bp.villainAction} · [${hc.flavor}]`,
            correctAction: bp.correctAction,
            correctSizing: bp.correctSizing,
            gtoFrequency: bp.gtoFrequency,
            options: bp.options.map(o => ({ ...o })),
            explanationDummies: bp.explanationDummies,
            leakWarning: bp.leakWarning
          });
        }
      }
    }
  }

  return pool;
}

export const MASTER_EVALUATION_BANK: EvaluationQuestion[] = buildExpandedPool();

export function getBankCountsByMode(): { fixed: number; levels: number; variable: number; total: number; perLevel: Record<DifficultyLevel, number> } {
  const fixed = MASTER_EVALUATION_BANK.filter(q => q.mode === 'fixed').length;
  const levels = MASTER_EVALUATION_BANK.filter(q => q.mode === 'levels').length;
  const variable = MASTER_EVALUATION_BANK.filter(q => q.mode === 'variable').length;
  const perLevel: Record<DifficultyLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const q of MASTER_EVALUATION_BANK) {
    perLevel[q.level] += 1;
  }
  return { fixed, levels, variable, total: MASTER_EVALUATION_BANK.length, perLevel };
}

const SEEN_STORAGE_KEY = 'lab_studio_eval_seen_v2';

type SeenStore = Record<EvaluationMode, string[]>;

export function loadSeenQuestionIds(): SeenStore {
  try {
    const raw = localStorage.getItem(SEEN_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SeenStore>;
      return {
        fixed: Array.isArray(parsed.fixed) ? parsed.fixed : [],
        levels: Array.isArray(parsed.levels) ? parsed.levels : [],
        variable: Array.isArray(parsed.variable) ? parsed.variable : []
      };
    }
  } catch {
    // ignore
  }
  return { fixed: [], levels: [], variable: [] };
}

export function markQuestionIdsSeen(mode: EvaluationMode, ids: string[]): SeenStore {
  const store = loadSeenQuestionIds();
  const merged = Array.from(new Set([...store[mode], ...ids]));
  const next: SeenStore = { ...store, [mode]: merged };
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function resetSeenQuestionIds(mode: EvaluationMode): SeenStore {
  const store = loadSeenQuestionIds();
  const next: SeenStore = { ...store, [mode]: [] };
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Construye una evaluación garantizando preguntas SIN REPETICIÓN respecto a sesiones anteriores.
 * Prioriza preguntas del modo elegido que el jugador NO ha visto aún.
 */
export function generateNonRepeatingExam(
  mode: EvaluationMode,
  userLevel: DifficultyLevel,
  filters: EvaluationFilters
): {
  questions: EvaluationQuestion[];
  unseenPoolRemaining: number;
  modePoolTotal: number;
  cycleResetOccurred: boolean;
} {
  let pool = MASTER_EVALUATION_BANK.filter(q => q.mode === mode);

  if (mode === 'levels') {
    const levelFiltered = pool.filter(q => q.level === userLevel);
    // Keep all 216+ questions accessible while emphasizing the user's current level first
    const otherLevelQuestions = MASTER_EVALUATION_BANK.filter(q => q.level === userLevel && q.mode !== mode);
    pool = [...levelFiltered, ...otherLevelQuestions];
  } else if (mode === 'variable') {
    let customFiltered = MASTER_EVALUATION_BANK.filter(q => {
      if (filters.potType !== 'all' && q.potType !== filters.potType) return false;
      if (filters.opponent !== 'all' && q.opponentProfile !== filters.opponent) return false;
      if (filters.level !== 'all' && q.level !== filters.level) return false;
      if (filters.texture !== 'all') {
        if (filters.texture === 'dry' && q.category !== 'dry_flop') return false;
        if (filters.texture === 'wet' && q.category !== 'wet_flop') return false;
        if (filters.texture === 'monotone' && q.category !== 'monotone_flop') return false;
        if (filters.texture === 'paired' && q.category !== 'paired_flop') return false;
        if (filters.texture === 'preflop' && q.board.length > 0) return false;
      }
      return true;
    });
    if (customFiltered.length < filters.questionCount) {
      // Relax mode restriction first, keep filters if possible, then expand safely
      const broad = pool.length >= filters.questionCount ? pool : MASTER_EVALUATION_BANK;
      const missingIds = new Set(customFiltered.map(x => x.id));
      customFiltered = [...customFiltered, ...broad.filter(x => !missingIds.has(x.id))];
    }
    pool = customFiltered;
  }

  const count = mode === 'fixed' ? filters.questionCount : mode === 'levels' ? 8 : filters.questionCount;
  const seenStore = loadSeenQuestionIds();
  const seenSet = new Set(seenStore[mode]);

  let unseen = pool.filter(q => !seenSet.has(q.id));
  let cycleResetOccurred = false;

  if (unseen.length < count) {
    // Only reset this mode's seen history once exhausted
    resetSeenQuestionIds(mode);
    unseen = pool;
    cycleResetOccurred = true;
  }

  // Pick diverse categories first before random fill so every exam feels well-rounded
  const shuffledUnseen = shuffle(unseen);
  const picked: EvaluationQuestion[] = [];
  const usedCategoriesInExam = new Set<string>();

  for (const q of shuffledUnseen) {
    if (picked.length >= count) break;
    if (!usedCategoriesInExam.has(q.category)) {
      picked.push(q);
      usedCategoriesInExam.add(q.category);
    }
  }

  if (picked.length < count) {
    const pickedIds = new Set(picked.map(p => p.id));
    for (const q of shuffledUnseen) {
      if (picked.length >= count) break;
      if (!pickedIds.has(q.id)) {
        picked.push(q);
        pickedIds.add(q.id);
      }
    }
  }

  const randomizedQuestions = picked.map(q => ({
    ...q,
    options: shuffle(q.options)
  }));

  return {
    questions: randomizedQuestions,
    unseenPoolRemaining: Math.max(0, unseen.length - picked.length),
    modePoolTotal: pool.length,
    cycleResetOccurred
  };
}
