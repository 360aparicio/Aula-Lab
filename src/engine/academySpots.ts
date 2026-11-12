/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AcademySpots: Banco multi-variante (48+ manos únicas en 12 categorías) y generador
 * de Evaluación con Temas Fijos y Variables de Spot configurables.
 */

import { Card, cardId } from './cards';

export type AcademyCategory =
  | 'dry_flop'
  | 'wet_flop'
  | 'monotone_flop'
  | 'paired_flop'
  | 'three_bet_pot'
  | 'squeeze'
  | 'rol'
  | 'open_raise'
  | 'four_bet'
  | 'limp_reraise'
  | 'blind_defense'
  | 'bluff_catch';

export interface QuizScenario {
  id: string;
  category: AcademyCategory;
  categoryName: string;
  title: string;
  heroCards: [Card, Card];
  board: Card[];
  potBB: number;
  spr?: number;
  opponentProfile?: 'regular' | 'nit' | 'fish' | 'lag';
  potType?: 'srp' | '3bet' | '4bet' | 'squeeze';
  heroPos: string;
  villainPos: string;
  villainAction: string;
  correctAction: string;
  correctSizing?: string;
  gtoFrequency: number;
  options: { label: string; action: string; isCorrect: boolean; evLossPct: number }[];
  explanationDummies: string;
  leakWarning: string;
}

const c = (rank: Card['rank'], suit: Card['suit']): Card => ({
  rank,
  suit,
  id: cardId(rank, suit)
});

export const ACADEMY_SCENARIO_BANK: Record<AcademyCategory, QuizScenario[]> = {
  dry_flop: [
    {
      id: 'dry-1',
      category: 'dry_flop',
      categoryName: 'Flop Seco (Dry)',
      title: 'C-Bet en Flop Seco K-high (BTN vs BB)',
      heroCards: [c('A', 's'), c('J', 'h')],
      board: [c('K', 'd'), c('7', 'c'), c('2', 's')],
      potBB: 6.5,
      spr: 14,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'BTN',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 33%',
      correctSizing: '2.1 BB',
      gtoFrequency: 82,
      options: [
        { label: 'Bet 33% Pot (2.1 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
        { label: 'Check Behind', action: 'CHECK', isCorrect: false, evLossPct: 3.8 },
        { label: 'Bet 75% Pot (4.9 BB)', action: 'BET_75', isCorrect: false, evLossPct: 6.2 }
      ],
      explanationDummies: 'En flops ultra secos K72r, BTN tiene gran ventaja de rango y sobre-cartas. Un 33% presiona barato y hace foldear el 60% de la basura de BB.',
      leakWarning: 'Fuga Común: Apostar 75%+ en mesas secas te aísla contra Reyes mejores y arriesga fichas innecesarias.'
    },
    {
      id: 'dry-2',
      category: 'dry_flop',
      categoryName: 'Flop Seco (Dry)',
      title: 'Top Pair Kicker Medio en A-8-3r (CO vs BB)',
      heroCards: [c('A', 'c'), c('T', 'd')],
      board: [c('A', 'h'), c('8', 's'), c('3', 'c')],
      potBB: 6.0,
      spr: 15,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'CO',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 33%',
      correctSizing: '2.0 BB',
      gtoFrequency: 86,
      options: [
        { label: 'Bet 33% Pot (2.0 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
        { label: 'Overbet 120% (7.2 BB)', action: 'BET_120', isCorrect: false, evLossPct: 6.9 },
        { label: 'Check Behind', action: 'CHECK', isCorrect: false, evLossPct: 4.5 }
      ],
      explanationDummies: 'Con Top Pair AT en A83r extraemos valor directo de 8x, parejas de bolsillo (44-77) y Ases peores con un tamaño cómodo de 1/3 del bote.',
      leakWarning: 'Fuga Común: Overbetear flops secos con kicker medio expulsa a las manos que te pagarían.'
    },
    {
      id: 'dry-3',
      category: 'dry_flop',
      categoryName: 'Flop Seco (Dry)',
      title: 'Flop Q-5-2r sin Conectar desde UTG vs BB',
      heroCards: [c('A', 'd'), c('K', 'c')],
      board: [c('Q', 'h'), c('5', 's'), c('2', 'd')],
      potBB: 6.5,
      spr: 14,
      opponentProfile: 'nit',
      potType: 'srp',
      heroPos: 'EP (UTG)',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 33%',
      correctSizing: '2.1 BB',
      gtoFrequency: 79,
      options: [
        { label: 'Bet 33% Pot (2.1 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
        { label: 'Check Behind', action: 'CHECK', isCorrect: false, evLossPct: 3.4 },
        { label: 'Bet 75% Pot (4.9 BB)', action: 'BET_75', isCorrect: false, evLossPct: 7.1 }
      ],
      explanationDummies: 'AK tiene 6 outs limpios + ventaja de overpairs de UTG (AA, KK, QQ). Contra un Nit en BB, apostar 33% logra folds masivos de manos como 76s, J9s o A4s.',
      leakWarning: 'Fuga Común: Rendirse automáticamente con AK cuando no conectas pareja en el flop.'
    },
    {
      id: 'dry-4',
      category: 'dry_flop',
      categoryName: 'Flop Seco (Dry)',
      title: 'Set en Flop Seco 9-4-2r contra Calling Station',
      heroCards: [c('9', 'h'), c('9', 'c')],
      board: [c('9', 'd'), c('4', 's'), c('2', 'c')],
      potBB: 6.5,
      spr: 14,
      opponentProfile: 'fish',
      potType: 'srp',
      heroPos: 'HJ (MP)',
      villainPos: 'BB (Fish)',
      villainAction: 'BB Checks',
      correctAction: 'BET 66% - 75%',
      correctSizing: '4.5 BB',
      gtoFrequency: 74,
      options: [
        { label: 'Bet 70% Pot (4.5 BB)', action: 'BET_70', isCorrect: true, evLossPct: 0 },
        { label: 'Check Slowplay', action: 'CHECK', isCorrect: false, evLossPct: 8.4 },
        { label: 'Bet 20% Pot (1.3 BB)', action: 'BET_20', isCorrect: false, evLossPct: 4.8 }
      ],
      explanationDummies: 'Regla Explotativa vs Calling Station: con Top Set olvídate del slowplay. Los Fish pagan cualquier apuesta con 4x, A-high y overcards; construye el bote rápido.',
      leakWarning: 'Fuga Común: Hacer slowplay ante jugadores pasivos desperdiciando 2 calles de valor gordo.'
    }
  ],

  wet_flop: [
    {
      id: 'wet-1',
      category: 'wet_flop',
      categoryName: 'Flop Coordinado (Wet)',
      title: 'Overpair TT en 9s-8s-6d (CO vs BTN)',
      heroCards: [c('T', 's'), c('T', 'h')],
      board: [c('9', 's'), c('8', 's'), c('6', 'd')],
      potBB: 7.0,
      spr: 13,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'CO',
      villainPos: 'BTN',
      villainAction: 'Hero actúa OOP primero',
      correctAction: 'BET 75%',
      correctSizing: '5.2 BB',
      gtoFrequency: 68,
      options: [
        { label: 'Bet 75% Pot (5.2 BB)', action: 'BET_75', isCorrect: true, evLossPct: 0 },
        { label: 'Bet 33% Pot (2.3 BB)', action: 'BET_33', isCorrect: false, evLossPct: 7.4 },
        { label: 'Check', action: 'CHECK', isCorrect: false, evLossPct: 5.1 }
      ],
      explanationDummies: 'Mesa saturada de proyectos de color y escalera. Apostar pequeño regala equity; el 75% cobra caro a todos los draws mientras proteges tu overpair.',
      leakWarning: 'Fuga Común: C-Bet de 33% por inercia en texturas conectadas.'
    },
    {
      id: 'wet-2',
      category: 'wet_flop',
      categoryName: 'Flop Coordinado (Wet)',
      title: 'Top Two Pair KQ en K-Q-J Two-Tone (BTN vs BB)',
      heroCards: [c('K', 'd'), c('Q', 'c')],
      board: [c('K', 'h'), c('Q', 'h'), c('J', 's')],
      potBB: 6.5,
      spr: 14,
      opponentProfile: 'fish',
      potType: 'srp',
      heroPos: 'BTN',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 75%',
      correctSizing: '4.9 BB',
      gtoFrequency: 77,
      options: [
        { label: 'Bet 75% Pot (4.9 BB)', action: 'BET_75', isCorrect: true, evLossPct: 0 },
        { label: 'Bet 25% Pot (1.6 BB)', action: 'BET_25', isCorrect: false, evLossPct: 6.1 },
        { label: 'Check Behind', action: 'CHECK', isCorrect: false, evLossPct: 9.2 }
      ],
      explanationDummies: 'Cualquier As, Diez, Nueve o Corazón cambia el bote dramáticamente. Extrae valor grueso ahora de Jx, Kx peor y proyectos de escalera/color.',
      leakWarning: 'Fuga Común: Proteger poco las dobles parejas en mesas broadway súper conectadas.'
    },
    {
      id: 'wet-3',
      category: 'wet_flop',
      categoryName: 'Flop Coordinado (Wet)',
      title: 'Combo Draw Nut (A♠Q♠) en J♠-T♠-4♦',
      heroCards: [c('A', 's'), c('Q', 's')],
      board: [c('J', 's'), c('T', 's'), c('4', 'd')],
      potBB: 6.5,
      spr: 14,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'CO',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 66% - 75%',
      correctSizing: '4.5 BB',
      gtoFrequency: 81,
      options: [
        { label: 'Bet 75% Pot Semi-Bluff (4.8 BB)', action: 'BET_75', isCorrect: true, evLossPct: 0 },
        { label: 'Check Pasivo', action: 'CHECK', isCorrect: false, evLossPct: 5.7 },
        { label: 'Bet 25% Pot (1.6 BB)', action: 'BET_25', isCorrect: false, evLossPct: 3.9 }
      ],
      explanationDummies: 'Tienes ~54% de equity pura (Proyecto de Color al As + Escalera abierta + 2 overcards). Apuesta grande como semi-farol agresivo para generar fold equity y construir el bote.',
      leakWarning: 'Fuga Común: Jugar pasivamente tus mejores proyectos combo en vez de presionar.'
    },
    {
      id: 'wet-4',
      category: 'wet_flop',
      categoryName: 'Flop Coordinado (Wet)',
      title: 'Aire Total OOP en 8♥-7♥-5♣ Multiway',
      heroCards: [c('A', 'c'), c('K', 'd')],
      board: [c('8', 'h'), c('7', 'h'), c('5', 'c')],
      potBB: 9.0,
      spr: 10,
      opponentProfile: 'lag',
      potType: 'srp',
      heroPos: 'EP (UTG)',
      villainPos: 'BTN + BB',
      villainAction: 'Multiway 3 jugadores',
      correctAction: 'CHECK-FOLD',
      correctSizing: '0 BB',
      gtoFrequency: 88,
      options: [
        { label: 'Check Control (Sin C-Bet)', action: 'CHECK', isCorrect: true, evLossPct: 0 },
        { label: 'Bet 75% Farol Multiway (6.7 BB)', action: 'BET_75', isCorrect: false, evLossPct: 10.6 },
        { label: 'Bet 33% Pot (3.0 BB)', action: 'BET_33', isCorrect: false, evLossPct: 6.4 }
      ],
      explanationDummies: 'El flop 875 favorece brutalmente a los rangos de BTN y BB (sets, dobles, escaleras, proyectos). En bote multiway OOP, AK high se rinde disciplinadamente.',
      leakWarning: 'Fuga Común: Intentar C-Bet de continuación por ego en flops bajos coordinados contra dos rivales.'
    }
  ],

  monotone_flop: [
    {
      id: 'mono-1',
      category: 'monotone_flop',
      categoryName: 'Flop Monótono (3 del mismo palo)',
      title: 'Overpair KK sin Blocker en Qh-9h-4h (UTG vs BB)',
      heroCards: [c('K', 's'), c('K', 'd')],
      board: [c('Q', 'h'), c('9', 'h'), c('4', 'h')],
      potBB: 6.0,
      spr: 15,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'UTG',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'CHECK',
      correctSizing: '0 BB',
      gtoFrequency: 75,
      options: [
        { label: 'Check Behind (Control de Bote)', action: 'CHECK', isCorrect: true, evLossPct: 0 },
        { label: 'Bet 33% Pot (2.0 BB)', action: 'BET_33', isCorrect: false, evLossPct: 4.2 },
        { label: 'Bet 75% Pot (4.5 BB)', action: 'BET_75', isCorrect: false, evLossPct: 11.5 }
      ],
      explanationDummies: 'Sin ningún corazón en la mano, la BB tiene muchísimos colores cerrados y draws al As. Pasar detrás evita check-raises desastrosos.',
      leakWarning: 'Fuga Común: Inflar el bote con Overpairs en flops monocolor sin el blocker del palo.'
    },
    {
      id: 'mono-2',
      category: 'monotone_flop',
      categoryName: 'Flop Monótono (3 del mismo palo)',
      title: 'Top Pair + As Blocker de Color (A♠J♣ en J♠-7♠-2♠)',
      heroCards: [c('A', 's'), c('J', 'c')],
      board: [c('J', 's'), c('7', 's'), c('2', 's')],
      potBB: 6.5,
      spr: 14,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'BTN',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 25% - 33%',
      correctSizing: '2.0 BB',
      gtoFrequency: 79,
      options: [
        { label: 'Bet 30% Pot (2.0 BB)', action: 'BET_30', isCorrect: true, evLossPct: 0 },
        { label: 'Bet 100% Overbet (6.5 BB)', action: 'BET_100', isCorrect: false, evLossPct: 7.9 },
        { label: 'Fold Directo', action: 'FOLD', isCorrect: false, evLossPct: 14.0 }
      ],
      explanationDummies: 'Tienes Top Pair y el As de picas (Nut Flush Draw blocker). Una apuesta pequeña (25-33%) protege contra cartas libres y presiona todo el rango sin color.',
      leakWarning: 'Fuga Común: Apostar tamaño gigante en mesas monótonas.'
    },
    {
      id: 'mono-3',
      category: 'monotone_flop',
      categoryName: 'Flop Monótono (3 del mismo palo)',
      title: 'Color Flopeado al Rey en K♦-9♦-4♦ (CO vs BB)',
      heroCards: [c('K', 's'), c('8', 'd')],
      board: [c('T', 'd'), c('7', 'd'), c('3', 'd')],
      potBB: 6.5,
      spr: 14,
      opponentProfile: 'fish',
      potType: 'srp',
      heroPos: 'CO',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 33%',
      correctSizing: '2.1 BB',
      gtoFrequency: 84,
      options: [
        { label: 'Bet 33% Pot (2.1 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
        { label: 'All-in Overbet', action: 'ALLIN', isCorrect: false, evLossPct: 12.8 },
        { label: 'Check Behind', action: 'CHECK', isCorrect: false, evLossPct: 4.9 }
      ],
      explanationDummies: 'Con color hecho en flop monótono usamos el tamaño de rango pequeño (25-33%) para que parejas medias y proyectos altos con el As o la Q nos paguen.',
      leakWarning: 'Fuga Común: Asustar al rival con apuestas masivas cuando ya tienes la jugada fuerte hecha.'
    },
    {
      id: 'mono-4',
      category: 'monotone_flop',
      categoryName: 'Flop Monótono (3 del mismo palo)',
      title: 'Aire sin Diamante en Q♦-8♦-5♦ vs Check-Raise',
      heroCards: [c('A', 'c'), c('T', 'h')],
      board: [c('Q', 'd'), c('8', 'd'), c('5', 'd')],
      potBB: 14.5,
      spr: 6.2,
      opponentProfile: 'nit',
      potType: 'srp',
      heroPos: 'BTN',
      villainPos: 'BB (Nit)',
      villainAction: 'Hero C-Bet 2 BB, BB Nit hace Check-Raise a 8 BB',
      correctAction: 'FOLD',
      correctSizing: '0 BB',
      gtoFrequency: 96,
      options: [
        { label: 'Fold Disciplinado', action: 'FOLD', isCorrect: true, evLossPct: 0 },
        { label: 'Call para flotar', action: 'CALL', isCorrect: false, evLossPct: 11.4 },
        { label: '3-Bet Bluff All-in', action: 'ALLIN', isCorrect: false, evLossPct: 24.5 }
      ],
      explanationDummies: 'Un jugador Nit que hace check-raise en tablero monótono representa color hecho o set. Sin ningún diamante y solo As alto, es un fold limpio instantáneo.',
      leakWarning: 'Fuga Común: Pagar check-raises de jugadores pasivos con overcards sin proyecto.'
    }
  ],

  paired_flop: [
    {
      id: 'pair-1',
      category: 'paired_flop',
      categoryName: 'Flop Emparejado',
      title: 'C-Bet en Flop Emparejado J-J-4 (CO vs BB)',
      heroCards: [c('A', 'c'), c('Q', 'd')],
      board: [c('J', 's'), c('J', 'h'), c('4', 'd')],
      potBB: 5.5,
      spr: 16,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'CO',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 33%',
      correctSizing: '1.8 BB',
      gtoFrequency: 85,
      options: [
        { label: 'Bet 33% Pot (1.8 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
        { label: 'Check Behind', action: 'CHECK', isCorrect: false, evLossPct: 4.1 },
        { label: 'Bet 100% Pot (5.5 BB)', action: 'BET_100', isCorrect: false, evLossPct: 9.3 }
      ],
      explanationDummies: 'Es estadísticamente rarísimo que el rival tenga una Jota. Una C-Bet barata del 33% derriba casi todas las manos sin pareja.',
      leakWarning: 'Fuga Común: Pensar que si no ligas pareja no puedes apostar en mesas emparejadas.'
    },
    {
      id: 'pair-2',
      category: 'paired_flop',
      categoryName: 'Flop Emparejado',
      title: 'Flop Bajo Emparejado 6-6-3r desde UTG vs BB',
      heroCards: [c('K', 's'), c('Q', 's')],
      board: [c('6', 'c'), c('6', 'd'), c('3', 'h')],
      potBB: 6.5,
      spr: 14,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'EP (UTG)',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 33%',
      correctSizing: '2.1 BB',
      gtoFrequency: 76,
      options: [
        { label: 'Bet 33% Pot (2.1 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
        { label: 'Bet 80% Pot (5.2 BB)', action: 'BET_80', isCorrect: false, evLossPct: 6.8 },
        { label: 'Check', action: 'CHECK', isCorrect: false, evLossPct: 3.5 }
      ],
      explanationDummies: 'En flops bajos emparejados UTG mantiene todas las overpairs (77-AA). Con KQs tienes dos overcards + backdoor color y presión máxima con 1/3 del bote.',
      leakWarning: 'Fuga Común: Apostar tamaño grande polarizado cuando 33% logra exactamente los mismos folds.'
    },
    {
      id: 'pair-3',
      category: 'paired_flop',
      categoryName: 'Flop Emparejado',
      title: 'Full House Flopeado (QQ en Q-7-7)',
      heroCards: [c('Q', 's'), c('Q', 'h')],
      board: [c('Q', 'd'), c('7', 'c'), c('7', 's')],
      potBB: 6.5,
      spr: 14,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'BTN',
      villainPos: 'BB',
      villainAction: 'BB Checks',
      correctAction: 'BET 25% - 33%',
      correctSizing: '1.8 BB',
      gtoFrequency: 82,
      options: [
        { label: 'Bet Pequeña 25-33% (1.8 BB)', action: 'BET_30', isCorrect: true, evLossPct: 0 },
        { label: 'Overbet 150% (9.7 BB)', action: 'BET_150', isCorrect: false, evLossPct: 8.5 },
        { label: 'Check-Fold', action: 'FOLD', isCorrect: false, evLossPct: 35.0 }
      ],
      explanationDummies: 'Tienes el Board bloqueado (solo quedan 1 Q y 2 Sietes). Apuesta pequeño para inducir floats de Ax/Kx y check-raises de farol del rival.',
      leakWarning: 'Fuga Común: Espantar con apuestas gigantescas cuando bloqueas casi todas las cartas fuertes.'
    },
    {
      id: 'pair-4',
      category: 'paired_flop',
      categoryName: 'Flop Emparejado',
      title: 'Defensa con Trips Debil (7-6s en K-7-7) en BB',
      heroCards: [c('7', 'h'), c('6', 'h')],
      board: [c('K', 's'), c('7', 'd'), c('7', 'c')],
      potBB: 8.5,
      spr: 11,
      opponentProfile: 'lag',
      potType: 'srp',
      heroPos: 'BB',
      villainPos: 'BTN (LAG)',
      villainAction: 'BTN apuesta 2.2 BB en flop K77',
      correctAction: 'CALL (Trap / Dejar Farolear)',
      correctSizing: '2.2 BB',
      gtoFrequency: 78,
      options: [
        { label: 'Call para Mantener Faroles', action: 'CALL', isCorrect: true, evLossPct: 0 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 28.0 },
        { label: 'Check-Raise 4x (9 BB)', action: 'RAISE', isCorrect: false, evLossPct: 4.4 }
      ],
      explanationDummies: 'Contra un LAG que C-betea casi todo su rango en K77, pagar en el flop mantiene dentro todos sus faroles en turn y river sin delatar tu trío.',
      leakWarning: 'Fuga Común: Hacer check-raise inmediato con tríos en mesas secas espantando al rival agresivo.'
    }
  ],

  three_bet_pot: [
    {
      id: '3b-1',
      category: 'three_bet_pot',
      categoryName: 'Botes 3-Bet',
      title: 'C-Bet en Bote 3-Bet A-7-3r (BB vs BTN)',
      heroCards: [c('A', 's'), c('K', 's')],
      board: [c('A', 'd'), c('7', 'c'), c('3', 's')],
      potBB: 20.0,
      spr: 4.5,
      opponentProfile: 'regular',
      potType: '3bet',
      heroPos: 'BB',
      villainPos: 'BTN',
      villainAction: 'Hero 3-Beteó preflop',
      correctAction: 'BET 33%',
      correctSizing: '6.6 BB',
      gtoFrequency: 78,
      options: [
        { label: 'Bet 33% Pot (6.6 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
        { label: 'Bet 75% Pot (15.0 BB)', action: 'BET_75', isCorrect: false, evLossPct: 5.8 },
        { label: 'Check', action: 'CHECK', isCorrect: false, evLossPct: 6.9 }
      ],
      explanationDummies: 'En botes 3-Bet el SPR ya es bajo (~4.5). Con 33% pot pagarán manos medias (JJ, TT, AQ) y dejas el stack preparado para meterlo todo en Turn/River.',
      leakWarning: 'Fuga Común: Apostar 75%+ en 3-Bet pots y hacer foldear todo excepto trío o dobles.'
    },
    {
      id: '3b-2',
      category: 'three_bet_pot',
      categoryName: 'Botes 3-Bet',
      title: 'Overpair QQ en Flop Bajo 8-5-2r (SB vs CO)',
      heroCards: [c('Q', 'h'), c('Q', 'c')],
      board: [c('8', 's'), c('5', 'd'), c('2', 'c')],
      potBB: 21.0,
      spr: 4.2,
      opponentProfile: 'regular',
      potType: '3bet',
      heroPos: 'SB',
      villainPos: 'CO',
      villainAction: 'Hero 3-Bet en SB, CO pagó',
      correctAction: 'BET 33% - 50%',
      correctSizing: '7.5 BB',
      gtoFrequency: 84,
      options: [
        { label: 'Bet 33% Pot (7.0 BB)', action: 'BET_33', isCorrect: true, evLossPct: 0 },
        { label: 'Check-Fold', action: 'FOLD', isCorrect: false, evLossPct: 32.0 },
        { label: 'Open Shove All-in (89 BB)', action: 'ALLIN', isCorrect: false, evLossPct: 9.4 }
      ],
      explanationDummies: 'Con SPR 4.2, apostar 1/3 en el flop compromete el bote cómodamente para turn y river manteniendo todas las parejas 99-JJ y AK/AQ pagando.',
      leakWarning: 'Fuga Común: Ir all-in directo en el flop regalando información y perdiendo calls de manos medias.'
    },
    {
      id: '3b-3',
      category: 'three_bet_pot',
      categoryName: 'Botes 3-Bet',
      title: 'Defensa IP ante C-Bet 33% con JTs en T-9-4',
      heroCards: [c('J', 's'), c('T', 's')],
      board: [c('T', 'd'), c('9', 'h'), c('4', 's')],
      potBB: 26.5,
      spr: 3.5,
      opponentProfile: 'lag',
      potType: '3bet',
      heroPos: 'BTN',
      villainPos: 'SB',
      villainAction: 'SB (3-Bettor) apuesta 6.5 BB en T94',
      correctAction: 'CALL (Top Pair + Backdoor)',
      correctSizing: '6.5 BB',
      gtoFrequency: 86,
      options: [
        { label: 'Call Defend (6.5 BB)', action: 'CALL', isCorrect: true, evLossPct: 0 },
        { label: 'Fold Top Pair', action: 'FOLD', isCorrect: false, evLossPct: 16.5 },
        { label: 'Min-Raise Bluff', action: 'RAISE', isCorrect: false, evLossPct: 6.2 }
      ],
      explanationDummies: 'En bote 3-Bet IP, Top Pair + proyectos backdoor tiene demasiada equity y valor de showdown para foldear y funciona mejor pagando para atrapar faroles (AK/AQ).',
      leakWarning: 'Fuga Común: Resubir por pánico con Top Pair en botes 3-Bet aislándote contra AA/KK/TT.'
    },
    {
      id: '3b-4',
      category: 'three_bet_pot',
      categoryName: 'Botes 3-Bet',
      title: 'Aire con Bloqueador (A♠5♠) en K-7-4r (3-Bet Pot)',
      heroCards: [c('A', 's'), c('5', 's')],
      board: [c('K', 'c'), c('7', 'd'), c('4', 's')],
      potBB: 19.5,
      spr: 4.5,
      opponentProfile: 'nit',
      potType: '3bet',
      heroPos: 'BB',
      villainPos: 'CO',
      villainAction: 'CO hace Check en posición OOP Hero',
      correctAction: 'BET 25% - 33%',
      correctSizing: '5.5 BB',
      gtoFrequency: 72,
      options: [
        { label: 'Bet Pequeña 25-33% (5.5 BB)', action: 'BET_30', isCorrect: true, evLossPct: 0 },
        { label: 'Check-Fold', action: 'CHECK', isCorrect: false, evLossPct: 4.1 },
        { label: 'Bet 100% Pot (19.5 BB)', action: 'BET_100', isCorrect: false, evLossPct: 7.7 }
      ],
      explanationDummies: 'En K74r el 3-bettor tiene todas las ventajas de rango (AA, KK, AK, KQ). Un bloqueo pequeño de 25-30% fuerza a foldear a parejas medias (99-JJ) y proyectos debiles sin arriesgar el stack.',
      leakWarning: 'Fuga Común: No continuar de farol barato cuando el board impacta fuertemente tu rango percibido.'
    }
  ],

  squeeze: [
    {
      id: 'sqz-1',
      category: 'squeeze',
      categoryName: 'Squeeze Spots',
      title: 'Squeeze con AQo en SB (CO Open + BTN Call)',
      heroCards: [c('A', 'h'), c('Q', 's')],
      board: [],
      potBB: 5.5,
      spr: 18,
      opponentProfile: 'regular',
      potType: 'squeeze',
      heroPos: 'SB',
      villainPos: 'CO + BTN',
      villainAction: 'CO abre 2.5 BB, BTN paga 2.5 BB',
      correctAction: 'SQUEEZE a 12-14 BB',
      correctSizing: '13 BB',
      gtoFrequency: 84,
      options: [
        { label: 'Squeeze Raise a 13 BB', action: 'RAISE_13', isCorrect: true, evLossPct: 0 },
        { label: 'Flat Call 2.5 BB', action: 'CALL', isCorrect: false, evLossPct: 8.2 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 14.5 }
      ],
      explanationDummies: 'Hay 5.5 BB de dinero muerto en el centro y el rango de BTN está capeado (rara vez tiene AA/KK/AK). Un Squeeze potente a 13 BB gana el bote preflop altísimas veces.',
      leakWarning: 'Fuga Común: Pagar pasivamente en SB jugando botes multiway OOP sin iniciativa.'
    },
    {
      id: 'sqz-2',
      category: 'squeeze',
      categoryName: 'Squeeze Spots',
      title: 'Squeeze desde BB con AJs (HJ Open + CO Call)',
      heroCards: [c('A', 'd'), c('J', 'd')],
      board: [],
      potBB: 6.5,
      spr: 15,
      opponentProfile: 'regular',
      potType: 'squeeze',
      heroPos: 'BB',
      villainPos: 'HJ + CO',
      villainAction: 'HJ abre 2.5 BB, CO paga 2.5 BB',
      correctAction: 'SQUEEZE a 13-14 BB',
      correctSizing: '13.5 BB',
      gtoFrequency: 78,
      options: [
        { label: 'Squeeze Raise a 13.5 BB', action: 'RAISE_135', isCorrect: true, evLossPct: 0 },
        { label: 'Call 1.5 BB', action: 'CALL', isCorrect: false, evLossPct: 4.3 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 12.1 }
      ],
      explanationDummies: 'AJs bloquea los rangos premium y juega genial tanto como squeeze por valor/presión como si recibes un call IP/OOP con proyecto de color máximo.',
      leakWarning: 'Fuga Común: Limitar el squeeze en BB solo a QQ+/AK.'
    },
    {
      id: 'sqz-3',
      category: 'squeeze',
      categoryName: 'Squeeze Spots',
      title: 'Squeeze Farol con K5s en BTN (UTG Open + MP Call)',
      heroCards: [c('K', 'c'), c('5', 'c')],
      board: [],
      potBB: 6.5,
      spr: 15,
      opponentProfile: 'nit',
      potType: 'squeeze',
      heroPos: 'BTN',
      villainPos: 'UTG + MP',
      villainAction: 'UTG abre 2.5 BB, MP paga 2.5 BB',
      correctAction: 'SQUEEZE a 11-12 BB',
      correctSizing: '11.5 BB',
      gtoFrequency: 65,
      options: [
        { label: 'Squeeze IP a 11.5 BB', action: 'RAISE_115', isCorrect: true, evLossPct: 0 },
        { label: 'Flat Call 2.5 BB', action: 'CALL', isCorrect: false, evLossPct: 5.5 },
        { label: 'All-in 100 BB', action: 'ALLIN', isCorrect: false, evLossPct: 38.0 }
      ],
      explanationDummies: 'En BTN tienes posición postflop garantizada y K5s bloquea KK/AK. Ante Nits o rangos capeados, 11.5 BB en posición genera alta rentabilidad.',
      leakWarning: 'Fuga Común: Hacer flat call con manos offsuit o suited dominadas en botes multiway.'
    },
    {
      id: 'sqz-4',
      category: 'squeeze',
      categoryName: 'Squeeze Spots',
      title: 'Cuándo NO hacer Squeeze: 72o en SB',
      heroCards: [c('7', 'h'), c('2', 'c')],
      board: [],
      potBB: 6.5,
      spr: 15,
      opponentProfile: 'fish',
      potType: 'squeeze',
      heroPos: 'SB',
      villainPos: 'UTG + BTN (Fish)',
      villainAction: 'UTG abre 3 BB, Fish BTN paga',
      correctAction: 'FOLD',
      correctSizing: '0 BB',
      gtoFrequency: 100,
      options: [
        { label: 'Fold Inmediato', action: 'FOLD', isCorrect: true, evLossPct: 0 },
        { label: 'Squeeze Bluff a 14 BB', action: 'RAISE_14', isCorrect: false, evLossPct: 15.2 },
        { label: 'Call 2.5 BB', action: 'CALL', isCorrect: false, evLossPct: 9.8 }
      ],
      explanationDummies: 'Un Fish en el bote rara vez foldea preflop y 72o no tiene ni blockers ni jugabilidad postflop. Nunca farolees sin blockers ni ante Calling Stations.',
      leakWarning: 'Fuga Común: Hacer squeezes suicidas con basura cuando hay un Calling Station involucrado.'
    }
  ],

  rol: [
    {
      id: 'rol-1',
      category: 'rol',
      categoryName: 'ROL (Raise Over Limpers)',
      title: 'Castigo al Limper con AJo (BTN vs UTG Fish)',
      heroCards: [c('A', 'd'), c('J', 's')],
      board: [],
      potBB: 2.5,
      spr: 40,
      opponentProfile: 'fish',
      potType: 'srp',
      heroPos: 'BTN',
      villainPos: 'UTG (Fish)',
      villainAction: 'UTG paga 1 BB (Open Limp)',
      correctAction: 'ROL Raise a 4.5 BB',
      correctSizing: '4.5 BB',
      gtoFrequency: 90,
      options: [
        { label: 'ROL Raise a 4.5 BB', action: 'RAISE_45', isCorrect: true, evLossPct: 0 },
        { label: 'Over-Limp 1 BB', action: 'CALL', isCorrect: false, evLossPct: 7.9 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 12.0 }
      ],
      explanationDummies: 'El limp señala una mano débil. Subiendo a 4.5 BB (3 BB + 1 BB por limper + extra posicional) te aíslas IP contra el rival más débil de la mesa.',
      leakWarning: 'Fuga Común: Limpear detrás con manos fuertes dejando entrar gratis a las ciegas.'
    },
    {
      id: 'rol-2',
      category: 'rol',
      categoryName: 'ROL (Raise Over Limpers)',
      title: 'Aislamiento ante 2 Limpers con QQ en CO',
      heroCards: [c('Q', 's'), c('Q', 'd')],
      board: [],
      potBB: 3.5,
      spr: 28,
      opponentProfile: 'fish',
      potType: 'srp',
      heroPos: 'CO',
      villainPos: 'EP + MP (Limpers)',
      villainAction: 'EP y MP hacen limp de 1 BB',
      correctAction: 'ROL Raise a 5.5 BB',
      correctSizing: '5.5 BB',
      gtoFrequency: 98,
      options: [
        { label: 'ROL Raise a 5.5 BB', action: 'RAISE_55', isCorrect: true, evLossPct: 0 },
        { label: 'ROL Pequeño 2.5 BB', action: 'RAISE_25', isCorrect: false, evLossPct: 6.3 },
        { label: 'Over-Limp 1 BB', action: 'CALL', isCorrect: false, evLossPct: 18.0 }
      ],
      explanationDummies: 'Con 2 limpers, aplica la fórmula 3 BB + 1 BB por cada limper (5 a 6 BB). Un min-raise invitaría a 4 jugadores al flop destruyendo tu equity.',
      leakWarning: 'Fuga Común: Subir demasiado pequeño cuando hay múltiples limpers.'
    },
    {
      id: 'rol-3',
      category: 'rol',
      categoryName: 'ROL (Raise Over Limpers)',
      title: 'ROL OOP desde SB ante Limper en BTN (KQs)',
      heroCards: [c('K', 'h'), c('Q', 'h')],
      board: [],
      potBB: 2.5,
      spr: 40,
      opponentProfile: 'fish',
      potType: 'srp',
      heroPos: 'SB',
      villainPos: 'BTN (Fish)',
      villainAction: 'BTN hace limp de 1 BB',
      correctAction: 'ROL Raise a 5.0 BB',
      correctSizing: '5.0 BB',
      gtoFrequency: 92,
      options: [
        { label: 'ROL Fuerte a 5.0 BB', action: 'RAISE_50', isCorrect: true, evLossPct: 0 },
        { label: 'Completar 0.5 BB', action: 'CALL', isCorrect: false, evLossPct: 6.4 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 15.0 }
      ],
      explanationDummies: 'Al estar fuera de posición en SB, sube un tamaño mayor (5 BB) para expulsar a la BB y jugar heads-up con iniciativa y mano dominante.',
      leakWarning: 'Fuga Común: Completar la SB con broadways fuertes contra limpers.'
    },
    {
      id: 'rol-4',
      category: 'rol',
      categoryName: 'ROL (Raise Over Limpers)',
      title: 'Disciplina ante Limper con Mano Especulativa (54s en BB)',
      heroCards: [c('5', 's'), c('4', 's')],
      board: [],
      potBB: 4.5,
      spr: 22,
      opponentProfile: 'fish',
      potType: 'srp',
      heroPos: 'BB',
      villainPos: 'UTG + CO + BTN (3 Limpers)',
      villainAction: '3 jugadores limpean hasta BB',
      correctAction: 'CHECK (Ver Flop Gratis)',
      correctSizing: '0 BB',
      gtoFrequency: 95,
      options: [
        { label: 'Check Gratis (Multiway Implícitas)', action: 'CHECK', isCorrect: true, evLossPct: 0 },
        { label: 'ROL a 7 BB', action: 'RAISE_7', isCorrect: false, evLossPct: 8.8 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 50.0 }
      ],
      explanationDummies: 'Con 54s en BB frente a 3 limpers ya ves el flop gratis con excelentes implied odds para dobles, escalera o color. No infles el bote OOP con una mano débil.',
      leakWarning: 'Fuga Común: Intentar aislar a múltiples Calling Stations con conectores pequeños OOP.'
    }
  ],

  open_raise: [
    {
      id: 'rfi-1',
      category: 'open_raise',
      categoryName: 'Open Raise (RFI)',
      title: 'Apertura Estándar desde Cutoff (KJs)',
      heroCards: [c('K', 's'), c('J', 's')],
      board: [],
      potBB: 1.5,
      spr: 66,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'CO',
      villainPos: 'BTN + Blinds',
      villainAction: 'Mesa foldea hasta CO',
      correctAction: 'Open Raise a 2.5 BB',
      correctSizing: '2.5 BB',
      gtoFrequency: 100,
      options: [
        { label: 'Open Raise a 2.5 BB', action: 'RAISE_25', isCorrect: true, evLossPct: 0 },
        { label: 'Open Limp 1 BB', action: 'CALL', isCorrect: false, evLossPct: 11.2 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 8.5 }
      ],
      explanationDummies: 'KJs es mano top del rango de CO. Siempre se abre subiendo (2.5 BB) para tomar iniciativa y cobrar ciegas.',
      leakWarning: 'Fuga Común: Open-limpear por miedo a recibir un 3-bet.'
    },
    {
      id: 'rfi-2',
      category: 'open_raise',
      categoryName: 'Open Raise (RFI)',
      title: 'Disciplina en UTG (EP) con KJo',
      heroCards: [c('K', 'd'), c('J', 'c')],
      board: [],
      potBB: 1.5,
      spr: 66,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'EP (UTG)',
      villainPos: '5 jugadores por hablar',
      villainAction: 'Inicio de mano en UTG 6-Max',
      correctAction: 'FOLD',
      correctSizing: '0 BB',
      gtoFrequency: 95,
      options: [
        { label: 'Fold Disciplinado', action: 'FOLD', isCorrect: true, evLossPct: 0 },
        { label: 'Open Raise 2.5 BB', action: 'RAISE_25', isCorrect: false, evLossPct: 4.1 },
        { label: 'Open Limp 1 BB', action: 'CALL', isCorrect: false, evLossPct: 9.5 }
      ],
      explanationDummies: 'KJo offsuit en UTG está fuertemente dominada por AK, KQ, AJ, QQ, JJ cuando te pagan o 3-betean las 5 posiciones restantes.',
      leakWarning: 'Fuga Común: Abrir demasiadas broadways offsuit desde Early Position.'
    },
    {
      id: 'rfi-3',
      category: 'open_raise',
      categoryName: 'Open Raise (RFI)',
      title: 'Robo en BTN con Suited Gapper (86s)',
      heroCards: [c('8', 'h'), c('6', 'h')],
      board: [],
      potBB: 1.5,
      spr: 66,
      opponentProfile: 'nit',
      potType: 'srp',
      heroPos: 'BTN',
      villainPos: 'SB + BB',
      villainAction: 'Todos foldean hasta Hero en Botón',
      correctAction: 'Open Raise 2.2 - 2.5 BB',
      correctSizing: '2.5 BB',
      gtoFrequency: 96,
      options: [
        { label: 'Open Raise 2.5 BB', action: 'RAISE_25', isCorrect: true, evLossPct: 0 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 4.7 },
        { label: 'Open Limp 1 BB', action: 'CALL', isCorrect: false, evLossPct: 8.9 }
      ],
      explanationDummies: 'En Botón el rango de apertura es ~45-50%. 86s tiene buena conectividad, color y ventaja posicional postflop contra ambas ciegas.',
      leakWarning: 'Fuga Común: Jugar demasiado tight desde el Botón regalando ciegas gratis.'
    },
    {
      id: 'rfi-4',
      category: 'open_raise',
      categoryName: 'Open Raise (RFI)',
      title: 'Apertura en SB vs BB con A4o',
      heroCards: [c('A', 'c'), c('4', 'd')],
      board: [],
      potBB: 1.5,
      spr: 66,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'SB',
      villainPos: 'BB',
      villainAction: 'Fold hasta Hero en Small Blind',
      correctAction: 'Open Raise a 3.0 BB',
      correctSizing: '3.0 BB',
      gtoFrequency: 89,
      options: [
        { label: 'Open Raise 3.0 BB', action: 'RAISE_30', isCorrect: true, evLossPct: 0 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 5.4 },
        { label: 'All-in 100 BB', action: 'ALLIN', isCorrect: false, evLossPct: 35.0 }
      ],
      explanationDummies: 'Blind vs Blind, A4o domina gran parte del rango de defensa de BB y el tamaño estándar 3 BB quita odds baratas a BB para pagar con posición.',
      leakWarning: 'Fuga Común: Abrir demasiado pequeño desde SB (2 BB) permitiendo a BB pagar con el 70% del mazo.'
    }
  ],

  four_bet: [
    {
      id: '4b-1',
      category: 'four_bet',
      categoryName: '4-Bet & Cold 4-Bet',
      title: '4-Bet Farol con Bloqueador A5s (BTN vs SB 3-Bet)',
      heroCards: [c('A', 's'), c('5', 's')],
      board: [],
      potBB: 13.5,
      spr: 7.4,
      opponentProfile: 'regular',
      potType: '4bet',
      heroPos: 'BTN',
      villainPos: 'SB',
      villainAction: 'Hero abrió 2.5 BB, SB 3-betea a 11 BB',
      correctAction: '4-Bet Bluff a 23 BB',
      correctSizing: '23 BB',
      gtoFrequency: 65,
      options: [
        { label: '4-Bet Bluff a 23 BB', action: 'RAISE_23', isCorrect: true, evLossPct: 0 },
        { label: 'Flat Call 11 BB', action: 'CALL', isCorrect: false, evLossPct: 5.4 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 4.8 }
      ],
      explanationDummies: 'A5s bloquea AA y AK de SB y conserva gran jugabilidad de color/wheel si pagan. Es el combo #1 para balancear 4-bets.',
      leakWarning: 'Fuga Común: Solo hacer 4-bet con AA/KK volviéndote 100% explotable.'
    },
    {
      id: '4b-2',
      category: 'four_bet',
      categoryName: '4-Bet & Cold 4-Bet',
      title: '4-Bet por Valor Puro con QQ (CO vs BTN 3-Bet)',
      heroCards: [c('Q', 's'), c('Q', 'c')],
      board: [],
      potBB: 11.5,
      spr: 8.6,
      opponentProfile: 'lag',
      potType: '4bet',
      heroPos: 'CO',
      villainPos: 'BTN (LAG)',
      villainAction: 'Hero abrió 2.5 BB, BTN 3-betea a 8 BB',
      correctAction: '4-Bet Value a 21 BB',
      correctSizing: '21 BB',
      gtoFrequency: 88,
      options: [
        { label: '4-Bet Value a 21 BB', action: 'RAISE_21', isCorrect: true, evLossPct: 0 },
        { label: 'Solo Call 8 BB', action: 'CALL', isCorrect: false, evLossPct: 5.2 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 42.0 }
      ],
      explanationDummies: 'Contra un BTN agresivo con 3-Bet amplio (12%+), QQ tiene ventaja aplastante OOP. Haz 4-bet por valor para cobrar a JJ, TT, AQs y faroles.',
      leakWarning: 'Fuga Común: Jugar pasivo con QQ fuera de posición permitiendo ver overcards baratas.'
    },
    {
      id: '4b-3',
      category: 'four_bet',
      categoryName: '4-Bet & Cold 4-Bet',
      title: 'Foldear ante 4-Bet de Jugador Nit con JJ',
      heroCards: [c('J', 'h'), c('J', 'd')],
      board: [],
      potBB: 33.5,
      spr: 2.9,
      opponentProfile: 'nit',
      potType: '4bet',
      heroPos: 'BTN',
      villainPos: 'UTG (Nit)',
      villainAction: 'UTG abre 2.5, BTN 3-bet a 8, UTG Nit 4-bet a 24 BB',
      correctAction: 'FOLD vs Nit 4-Bet',
      correctSizing: '0 BB',
      gtoFrequency: 82,
      options: [
        { label: 'Fold Explotativo', action: 'FOLD', isCorrect: true, evLossPct: 0 },
        { label: 'All-in 100 BB', action: 'ALLIN', isCorrect: false, evLossPct: 21.0 },
        { label: 'Call 16 BB', action: 'CALL', isCorrect: false, evLossPct: 7.4 }
      ],
      explanationDummies: 'Un jugador Nit que hace 4-Bet desde UTG tiene prácticamente QQ+, AK (rango 2.5%). Con JJ estás aplastado el 80% de las veces.',
      leakWarning: 'Fuga Común: Ir all-in preflop automáticamente con JJ/QQ contra el jugador más tight de la mesa.'
    },
    {
      id: '4b-4',
      category: 'four_bet',
      categoryName: '4-Bet & Cold 4-Bet',
      title: 'Cold 4-Bet con AKs (BTN vs UTG Open + MP 3-Bet)',
      heroCards: [c('A', 'h'), c('K', 'h')],
      board: [],
      potBB: 12.0,
      spr: 8.3,
      opponentProfile: 'regular',
      potType: '4bet',
      heroPos: 'BTN',
      villainPos: 'UTG + MP',
      villainAction: 'UTG abre 2.5 BB, MP 3-betea 8 BB',
      correctAction: 'Cold 4-Bet a 22 BB',
      correctSizing: '22 BB',
      gtoFrequency: 91,
      options: [
        { label: 'Cold 4-Bet a 22 BB', action: 'RAISE_22', isCorrect: true, evLossPct: 0 },
        { label: 'Cold Call 8 BB', action: 'CALL', isCorrect: false, evLossPct: 6.1 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 35.0 }
      ],
      explanationDummies: 'AKs bloquea AA y KK simultáneamente y evita jugar un bote 3-way con dinero muerto gigante. Toma el control con un Cold 4-Bet a 22 BB.',
      leakWarning: 'Fuga Común: Hacer Cold Call a 3-Bets con AKs delatando tu mano ante regs.'
    }
  ],

  limp_reraise: [
    {
      id: 'lrr-1',
      category: 'limp_reraise',
      categoryName: 'Limp Re-Raise (Trampa BvB)',
      title: 'Trampa Blind vs Blind con AA (SB vs BB)',
      heroCards: [c('A', 's'), c('A', 'h')],
      board: [],
      potBB: 5.0,
      spr: 20,
      opponentProfile: 'lag',
      potType: '3bet',
      heroPos: 'SB',
      villainPos: 'BB (Agresivo)',
      villainAction: 'Hero completa 1 BB, BB sube agresivo a 4 BB',
      correctAction: 'Limp Re-Raise a 13 BB',
      correctSizing: '13 BB',
      gtoFrequency: 85,
      options: [
        { label: 'Limp Re-Raise a 13 BB', action: 'RAISE_13', isCorrect: true, evLossPct: 0 },
        { label: 'Solo Call 4 BB', action: 'CALL', isCorrect: false, evLossPct: 6.2 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 45.0 }
      ],
      explanationDummies: 'Contra una BB que castiga demasiado los limps de SB, inducir el aislamiento con AA y resubir fuerte a 13 BB captura dinero muerto masivo.',
      leakWarning: 'Fuga Común: Hacer solo call al raise de BB con AA OOP.'
    },
    {
      id: 'lrr-2',
      category: 'limp_reraise',
      categoryName: 'Limp Re-Raise (Trampa BvB)',
      title: 'Balance de Limp-Raise BvB con Bloqueador A3s',
      heroCards: [c('A', 'd'), c('3', 'd')],
      board: [],
      potBB: 5.0,
      spr: 20,
      opponentProfile: 'regular',
      potType: '3bet',
      heroPos: 'SB',
      villainPos: 'BB',
      villainAction: 'Hero hace limp 1 BB, BB isola a 4 BB',
      correctAction: 'Limp Re-Raise a 13 BB',
      correctSizing: '13 BB',
      gtoFrequency: 58,
      options: [
        { label: 'Limp Re-Raise Bluff a 13 BB', action: 'RAISE_13', isCorrect: true, evLossPct: 0 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 4.5 },
        { label: 'All-in 100 BB', action: 'ALLIN', isCorrect: false, evLossPct: 26.0 }
      ],
      explanationDummies: 'Para que nuestro Limp Re-Raise con AA/KK reciba acción, el rango GTO incluye Ases bajos suited (A2s-A5s) como faroles balanceados con bloqueador.',
      leakWarning: 'Fuga Común: Tener un rango de Limp Re-Raise 100% compuesto solo por AA.'
    },
    {
      id: 'lrr-3',
      category: 'limp_reraise',
      categoryName: 'Limp Re-Raise (Trampa BvB)',
      title: 'Defensa de Limp en SB con T9s (No Resubir)',
      heroCards: [c('T', 's'), c('9', 's')],
      board: [],
      potBB: 4.5,
      spr: 22,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'SB',
      villainPos: 'BB',
      villainAction: 'Hero limpia 1 BB, BB sube estándar a 3.5 BB',
      correctAction: 'Call 2.5 BB (Retener Jugabilidad)',
      correctSizing: '2.5 BB',
      gtoFrequency: 89,
      options: [
        { label: 'Call 2.5 BB', action: 'CALL', isCorrect: true, evLossPct: 0 },
        { label: 'Fold T9s', action: 'FOLD', isCorrect: false, evLossPct: 7.4 },
        { label: 'Limp Re-Raise a 12 BB', action: 'RAISE_12', isCorrect: false, evLossPct: 5.6 }
      ],
      explanationDummies: 'T9s es demasiado fuerte y jugable para convertirlo en farol y foldear ante un 4-bet. Pagar 2.5 BB te permite flopear excelente postflop.',
      leakWarning: 'Fuga Común: Convertir manos medias conectadas en faroles de re-raise.'
    },
    {
      id: 'lrr-4',
      category: 'limp_reraise',
      categoryName: 'Limp Re-Raise (Trampa BvB)',
      title: 'Cuándo Rendir un Limp en SB (J4o)',
      heroCards: [c('J', 'c'), c('4', 'd')],
      board: [],
      potBB: 5.0,
      spr: 20,
      opponentProfile: 'lag',
      potType: 'srp',
      heroPos: 'SB',
      villainPos: 'BB',
      villainAction: 'Hero limpia 1 BB, BB sube fuerte a 4.5 BB',
      correctAction: 'FOLD',
      correctSizing: '0 BB',
      gtoFrequency: 96,
      options: [
        { label: 'Fold Inmediato', action: 'FOLD', isCorrect: true, evLossPct: 0 },
        { label: 'Call por "precio"', action: 'CALL', isCorrect: false, evLossPct: 6.9 },
        { label: 'Limp Re-Raise Bluff', action: 'RAISE', isCorrect: false, evLossPct: 14.5 }
      ],
      explanationDummies: 'J4o offsuit queda dominada y tiene pésima jugabilidad OOP ante un tamaño de 4.5 BB. Foldea sin remordimientos.',
      leakWarning: 'Fuga Común: Defender demasiadas manos offsuit débiles tras hacer limp en SB.'
    }
  ],

  blind_defense: [
    {
      id: 'bdef-1',
      category: 'blind_defense',
      categoryName: 'Steal & Blind Defense',
      title: 'Defensa de Big Blind ante Min-Robo (Q9o)',
      heroCards: [c('Q', 'd'), c('9', 's')],
      board: [],
      potBB: 4.0,
      spr: 25,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'BB',
      villainPos: 'BTN',
      villainAction: 'BTN abre 2.2 BB, SB foldea',
      correctAction: 'Call Defend (1.2 BB)',
      correctSizing: '1.2 BB',
      gtoFrequency: 88,
      options: [
        { label: 'Call Defend (1.2 BB)', action: 'CALL', isCorrect: true, evLossPct: 0 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 6.8 },
        { label: '3-Bet Raise a 10 BB', action: 'RAISE_10', isCorrect: false, evLossPct: 7.5 }
      ],
      explanationDummies: 'Las Pot Odds son casi de 4:1 (~22% equity requerida). Foldear Q9o ante un robo del BTN entrega dinero gratis a largo plazo.',
      leakWarning: 'Fuga Común: Sobre-foldear la Big Blind ante aperturas pequeñas de Late Position.'
    },
    {
      id: 'bdef-2',
      category: 'blind_defense',
      categoryName: 'Steal & Blind Defense',
      title: '3-Bet Polarizado desde BB con K5s (vs BTN Open)',
      heroCards: [c('K', 'h'), c('5', 'h')],
      board: [],
      potBB: 4.0,
      spr: 25,
      opponentProfile: 'lag',
      potType: '3bet',
      heroPos: 'BB',
      villainPos: 'BTN',
      villainAction: 'BTN abre 2.5 BB, SB foldea',
      correctAction: '3-Bet a 11 BB',
      correctSizing: '11 BB',
      gtoFrequency: 68,
      options: [
        { label: '3-Bet Bluff Polarizado (11 BB)', action: 'RAISE_11', isCorrect: true, evLossPct: 0 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 6.1 },
        { label: 'All-in 100 BB', action: 'ALLIN', isCorrect: false, evLossPct: 36.0 }
      ],
      explanationDummies: 'K5s bloquea KK/AK del BTN y prefiere tomar iniciativa en bote 3-Bet a tamaño sólido de 11 BB fuera de posición.',
      leakWarning: 'Fuga Común: Jugar demasiado pasivo desde BB sin castigar aperturas amplias del Botón.'
    },
    {
      id: 'bdef-3',
      category: 'blind_defense',
      categoryName: 'Steal & Blind Defense',
      title: 'Defensa en BB vs UTG 3x Open con 74o',
      heroCards: [c('7', 'c'), c('4', 's')],
      board: [],
      potBB: 4.5,
      spr: 22,
      opponentProfile: 'nit',
      potType: 'srp',
      heroPos: 'BB',
      villainPos: 'UTG',
      villainAction: 'UTG abre fuerte a 3.0 BB, todos foldean',
      correctAction: 'FOLD',
      correctSizing: '0 BB',
      gtoFrequency: 100,
      options: [
        { label: 'Fold Limpio', action: 'FOLD', isCorrect: true, evLossPct: 0 },
        { label: 'Call 2.0 BB', action: 'CALL', isCorrect: false, evLossPct: 7.2 },
        { label: '3-Bet Bluff 12 BB', action: 'RAISE_12', isCorrect: false, evLossPct: 14.0 }
      ],
      explanationDummies: 'Contra un rango estrecho de UTG y tamaño 3x, 74o no alcanza la equity realizada necesaria OOP. Foldear protege tu winrate en BB.',
      leakWarning: 'Fuga Común: Defender la BB con basura offsuit frente a aperturas fuertes de Early Position.'
    },
    {
      id: 'bdef-4',
      category: 'blind_defense',
      categoryName: 'Steal & Blind Defense',
      title: '3-Bet por Valor en BB vs CO Open con AQo',
      heroCards: [c('A', 's'), c('Q', 'd')],
      board: [],
      potBB: 4.0,
      spr: 25,
      opponentProfile: 'regular',
      potType: '3bet',
      heroPos: 'BB',
      villainPos: 'CO',
      villainAction: 'CO abre 2.5 BB, BTN y SB foldean',
      correctAction: '3-Bet Value a 11 BB',
      correctSizing: '11 BB',
      gtoFrequency: 89,
      options: [
        { label: '3-Bet Value a 11 BB', action: 'RAISE_11', isCorrect: true, evLossPct: 0 },
        { label: 'Flat Call 1.5 BB', action: 'CALL', isCorrect: false, evLossPct: 4.9 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 26.0 }
      ],
      explanationDummies: 'AQo domina gran parte de los calls de CO (AJ, AT, KQ, QJ). Resubiendo a 11 BB capturas la iniciativa y extraes mucho más valor que haciendo flat.',
      leakWarning: 'Fuga Común: Hacer solo call con manos premium/strong en BB por miedo.'
    }
  ],

  bluff_catch: [
    {
      id: 'bc-1',
      category: 'bluff_catch',
      categoryName: 'Bluff Catching en River',
      title: 'Caza de Faroles Top Pair vs Triple Barrel (Ad-8c-4s-2h-7d)',
      heroCards: [c('A', 's'), c('J', 'h')],
      board: [c('A', 'd'), c('8', 'c'), c('4', 's'), c('2', 'h'), c('7', 'd')],
      potBB: 24.0,
      spr: 1.5,
      opponentProfile: 'lag',
      potType: 'srp',
      heroPos: 'BB',
      villainPos: 'BTN (Agresivo)',
      villainAction: 'BTN dispara 3ª bala de 16 BB en river seco',
      correctAction: 'CALL (Bluff Catch)',
      correctSizing: '16 BB',
      gtoFrequency: 75,
      options: [
        { label: 'Call Bluff Catch (16 BB)', action: 'CALL', isCorrect: true, evLossPct: 0 },
        { label: 'Fold', action: 'FOLD', isCorrect: false, evLossPct: 8.9 },
        { label: 'All-in Raise', action: 'ALLIN', isCorrect: false, evLossPct: 15.2 }
      ],
      explanationDummies: 'Todos los proyectos (espadas, 65s, 75s) fallaron en el river. Con Top Pair buen kicker y sin bloquear picas fallidas, es un Call rentable por MDF.',
      leakWarning: 'Fuga Común: Foldear Top Pair automáticamente ante tres apuestas seguidas cuando fallaron todos los draws.'
    },
    {
      id: 'bc-2',
      category: 'bluff_catch',
      categoryName: 'Bluff Catching en River',
      title: 'Fold Disciplinado ante Nit Overbet en River',
      heroCards: [c('K', 's'), c('Q', 'c')],
      board: [c('K', 'd'), c('9', 'h'), c('5', 'h'), c('2', 'c'), c('A', 'h')],
      potBB: 30.0,
      spr: 1.4,
      opponentProfile: 'nit',
      potType: 'srp',
      heroPos: 'BB',
      villainPos: 'UTG (Nit)',
      villainAction: 'Se completa el color al A♥ y el Nit va All-in Overbet (42 BB)',
      correctAction: 'FOLD vs Nit River Overbet',
      correctSizing: '0 BB',
      gtoFrequency: 97,
      options: [
        { label: 'Fold Limpio', action: 'FOLD', isCorrect: true, evLossPct: 0 },
        { label: 'Hero Call (42 BB)', action: 'CALL', isCorrect: false, evLossPct: 24.5 },
        { label: 'Timebank Call', action: 'CALL_TB', isCorrect: false, evLossPct: 24.5 }
      ],
      explanationDummies: 'Los jugadores pasivos/Nit prácticamente NUNCA farolean overbets en el river cuando se completan Ases y colores. Tu KQ es un bluff catcher vencido.',
      leakWarning: 'Fuga Común: Pagar overbets de jugadores extremadamente pasivos por "curiosidad".'
    },
    {
      id: 'bc-3',
      category: 'bluff_catch',
      categoryName: 'Bluff Catching en River',
      title: 'Importancia de los Blockers en River (Q♠J♣ en K♠-T♠-4♦-3♣-2♠)',
      heroCards: [c('K', 'c'), c('T', 'h')],
      board: [c('K', 's'), c('T', 's'), c('4', 'd'), c('3', 'c'), c('2', 's')],
      potBB: 28.0,
      spr: 1.8,
      opponentProfile: 'regular',
      potType: 'srp',
      heroPos: 'BTN',
      villainPos: 'BB',
      villainAction: 'Completa la 3ª pica y BB Donk-Bet 75% (21 BB)',
      correctAction: 'CALL con Dobles Top (KTh)',
      correctSizing: '21 BB',
      gtoFrequency: 72,
      options: [
        { label: 'Call Defend (21 BB)', action: 'CALL', isCorrect: true, evLossPct: 0 },
        { label: 'Fold Dobles', action: 'FOLD', isCorrect: false, evLossPct: 10.4 },
        { label: 'All-in Value Raise', action: 'ALLIN', isCorrect: false, evLossPct: 14.8 }
      ],
      explanationDummies: 'Al no tener picas en mano no bloqueas los faroles con picas que fallaron ni tampoco es automático que el rival lleve color tras check-call. Paga para cazar faroles pero NO subas.',
      leakWarning: 'Fuga Común: Resubir dobles parejas en rivers donde se completó el color.'
    },
    {
      id: 'bc-4',
      category: 'bluff_catch',
      categoryName: 'Bluff Catching en River',
      title: 'Cero Faroles Puros vs Calling Station en River',
      heroCards: [c('Q', 's'), c('J', 's')],
      board: [c('9', 'd'), c('8', 'c'), c('2', 's'), c('4', 'h'), c('K', 'd')],
      potBB: 22.0,
      spr: 2.1,
      opponentProfile: 'fish',
      potType: 'srp',
      heroPos: 'BTN',
      villainPos: 'BB (Calling Station)',
      villainAction: 'Fish pagó flop y turn, hace Check en el River',
      correctAction: 'CHECK BEHIND (Rendición Total)',
      correctSizing: '0 BB',
      gtoFrequency: 100,
      options: [
        { label: 'Check Behind (No Bluff vs Fish)', action: 'CHECK', isCorrect: true, evLossPct: 0 },
        { label: 'Bet 75% Pot Farol (16.5 BB)', action: 'BET_75', isCorrect: false, evLossPct: 13.8 },
        { label: 'Overbet All-in Farol', action: 'ALLIN', isCorrect: false, evLossPct: 29.0 }
      ],
      explanationDummies: 'Regla de oro contra Calling Stations: cuando llegas al river con proyecto fallido (Q-high), chequea detrás. Un Fish pagará con cualquier par del 8, 9 o 4.',
      leakWarning: 'Fuga Común: Disparar terceras balas de farol en el river contra rivales que no saben foldear.'
    }
  ]
};

function shuffleScenarioOptions(sc: QuizScenario): QuizScenario {
  const opts = [...sc.options];
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return {
    ...sc,
    heroCards: [{ ...sc.heroCards[0] }, { ...sc.heroCards[1] }],
    board: sc.board.map(b => ({ ...b })),
    options: opts
  };
}

/**
 * Devuelve una mano garantizadamente distinta a `excludeId` dentro de la categoría,
 * asegurando que "Siguiente Mano Dinámica" siempre avance a un nuevo spot real
 * y que la ubicación de la respuesta correcta varíe aleatoriamente.
 */
export function getNextAcademyScenario(
  category: AcademyCategory,
  excludeId?: string
): QuizScenario {
  const pool = ACADEMY_SCENARIO_BANK[category] || ACADEMY_SCENARIO_BANK.dry_flop;
  const candidates = excludeId && pool.length > 1
    ? pool.filter(item => item.id !== excludeId)
    : pool;

  const picked = candidates[Math.floor(Math.random() * candidates.length)] || pool[0];
  return shuffleScenarioOptions(picked);
}

export function getAllAcademyScenarios(): QuizScenario[] {
  return Object.values(ACADEMY_SCENARIO_BANK).flat();
}

export interface EvaluationVariableFilter {
  potType: 'all' | 'srp' | '3bet' | '4bet' | 'squeeze';
  texture: 'all' | 'dry' | 'wet' | 'monotone' | 'paired' | 'preflop';
  opponent: 'all' | 'regular' | 'nit' | 'fish' | 'lag';
  questionCount: 5 | 8 | 12;
}

export function buildEvaluationExam(
  mode: 'fixed' | 'variable',
  filters: EvaluationVariableFilter
): QuizScenario[] {
  const all = getAllAcademyScenarios();

  if (mode === 'fixed') {
    const fixedIds = [
      'rfi-1',
      'bdef-1',
      'sqz-1',
      'dry-1',
      'wet-1',
      'mono-1',
      '3b-1',
      'bc-4'
    ];
    return fixedIds
      .map(id => all.find(s => s.id === id))
      .filter((s): s is QuizScenario => Boolean(s))
      .map(shuffleScenarioOptions);
  }

  let filtered = all.filter(sc => {
    if (filters.potType !== 'all' && sc.potType !== filters.potType) return false;
    if (filters.opponent !== 'all' && sc.opponentProfile !== filters.opponent) return false;
    if (filters.texture !== 'all') {
      if (filters.texture === 'dry' && sc.category !== 'dry_flop') return false;
      if (filters.texture === 'wet' && sc.category !== 'wet_flop') return false;
      if (filters.texture === 'monotone' && sc.category !== 'monotone_flop') return false;
      if (filters.texture === 'paired' && sc.category !== 'paired_flop') return false;
      if (filters.texture === 'preflop' && sc.board.length > 0) return false;
    }
    return true;
  });

  if (filtered.length < filters.questionCount) {
    const remaining = all.filter(s => !filtered.some(f => f.id === s.id));
    const shuffledRemaining = [...remaining].sort(() => Math.random() - 0.5);
    filtered = [...filtered, ...shuffledRemaining];
  }

  return [...filtered]
    .sort(() => Math.random() - 0.5)
    .slice(0, filters.questionCount)
    .map(shuffleScenarioOptions);
}
