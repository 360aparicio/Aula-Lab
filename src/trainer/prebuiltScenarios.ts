/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Prebuilt Poker Scenarios and Benchmarks for instant analysis & training.
 * Rich database of real-game spots: Single Raised Pots, 3-Bet Pots, Blind vs Blind,
 * across all board textures (Dry, Wet, Paired, Monotone, Scare cards, River show-downs).
 */

import { TreeConfig } from '../engine/gameTree';

export interface PrebuiltScenario {
  id: string;
  title: string;
  description: string;
  street: 'flop' | 'turn' | 'river';
  boardCards: string[]; // e.g. ["As", "Kd", "7c", "2h", "4s"]
  oopRangeStr: string;
  ipRangeStr: string;
  config: TreeConfig;
  defaultHero: 'OOP' | 'IP';
  category?: 'single-raised' | 'three-bet' | 'blind-vs-blind' | 'turn-probe' | 'river-decision';
}

export const PREBUILT_SCENARIOS: PrebuiltScenario[] = [
  // 1. Dry Ace-High BTN vs BB
  {
    id: 'dry-ace-cbet',
    title: 'Flop A♠ 7♦ 2♣ (Seco) — BTN Open vs BB Defend',
    description: 'Bote subido estándar (Single Raised Pot). Tablero seco con As-alto. Ventaja de rango masiva para el Botón (BTN); alta frecuencia de apuesta de continuación (C-bet 33%).',
    street: 'flop',
    boardCards: ['As', '7d', '2c'],
    oopRangeStr: '99-22,A8s-A2s,KTs-K7s,QJs-Q8s,JTs-J8s,T9s,98s,87s,76s,65s,KJo-K9o,QJo,JTo',
    ipRangeStr: 'AA-22,AKs-A2s,KQs-K9s,QJs-Q9s,JTs-J9s,T9s,98s,87s,76s,AKo-ATo,KQo-KTo,QJo',
    config: {
      startingPot: 55,
      effectiveStack: 180,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'single-raised'
  },

  // 2. Wet Two-Tone Board BTN vs BB
  {
    id: 'wet-flop-connected',
    title: 'Flop 9♠ 8♠ 4♦ (Mojado / Wet) — BTN vs BB',
    description: 'Tablero dinámico muy conectado con proyectos de color y escalera abierta. La defensa de BB conecta fuertemente con pares medios y dobles; BTN debe polarizar su sizing (66-75%).',
    street: 'flop',
    boardCards: ['9s', '8s', '4d'],
    oopRangeStr: 'TT-22,ATs-A2s,KTs-K6s,QJs-Q8s,JTs-J7s,T9s-T7s,98s-96s,87s-85s,76s-74s,65s,AJo-A7o,KJo-K8o,QJo-Q9o,JTo-J8o,T9o-T8o,98o',
    ipRangeStr: 'AA-22,AKs-A2s,KQs-K7s,QJs-Q8s,JTs-J8s,T9s-T8s,98s,87s,76s,65s,AKo-ATo,KQo-KJo,QJo,JTo',
    config: {
      startingPot: 55,
      effectiveStack: 180,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'single-raised'
  },

  // 3. Paired Board BTN vs BB
  {
    id: 'paired-board-cbet',
    title: 'Flop Q♥ Q♦ 5♣ (Emparejado) — BTN vs BB',
    description: 'Tablero emparejado con Dama alta. Pocas combinaciones de trío en ambos rangos. BTN utiliza sizings pequeños a alta frecuencia (33% pot) para negar equity barata.',
    street: 'flop',
    boardCards: ['Qh', 'Qd', '5c'],
    oopRangeStr: 'JJ-22,A9s-A2s,KTs-K5s,JTs-J7s,T9s-T7s,98s-96s,87s,76s,65s,54s,A9o-A6o,KTo-K7o,QTo-Q8o,JTo-J8o,T9o',
    ipRangeStr: 'AA-22,AKs-A2s,KQs-K6s,QJs-Q7s,JTs-J8s,T9s,98s,87s,AKo-A8o,KQo-K9o,QJo-QTo,JTo',
    config: {
      startingPot: 55,
      effectiveStack: 180,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'single-raised'
  },

  // 4. Monotone Board BTN vs BB
  {
    id: 'monotone-flush-draw',
    title: 'Flop J♠ 7♠ 2♠ (Monocolor) — BTN vs BB',
    description: 'Tres cartas del mismo palo en el flop. Los colores ya completados y los proyectos con el As de picas cambian radicalmente la agresividad. Frecuencia de check más alta.',
    street: 'flop',
    boardCards: ['Js', '7s', '2s'],
    oopRangeStr: 'TT-22,ATs-A2s,KTs-K4s,QJs-Q7s,JTs-J6s,T9s-T7s,98s-96s,87s-85s,76s,65s,54s,AJo-A7o,KTo-K8o,QTo-Q8o,JTo',
    ipRangeStr: 'AA-22,AKs-A2s,KQs-K7s,QJs-Q7s,JTs-J8s,T9s-T8s,98s,87s,76s,65s,AKo-A9o,KQo-KTo,QJo-QTo,JTo',
    config: {
      startingPot: 55,
      effectiveStack: 180,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'single-raised'
  },

  // 5. Early Position (EP) Open vs BB Defend
  {
    id: 'ep-open-bb-defend',
    title: 'Flop K♠ 8♦ 3♣ — EP (UTG) Open vs BB Defend',
    description: 'Apertura desde posición temprana (EP/UTG) con rango lineal compacto contra defensa de BB. Board seco con Rey-alto; EP domina con overpairs (AA, KK) y top pairs fuertes (AK, KQ).',
    street: 'flop',
    boardCards: ['Ks', '8d', '3c'],
    oopRangeStr: 'TT-22,ATs-A2s,KTs-K7s,QJs-Q9s,JTs-J9s,T9s,98s,87s,76s,65s,AJo-A8o,KJo-K9o,QJo-QTo,JTo',
    ipRangeStr: 'AA-77,AKs-ATs,KQs-KTs,QJs,JTs,T9s,98s,AKo,AQo,AJo,KQo',
    config: {
      startingPot: 50,
      effectiveStack: 190,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'single-raised'
  },

  // 6. Cutoff vs BTN Flat Call (CO OOP vs BTN IP)
  {
    id: 'co-open-btn-call',
    title: 'Flop T♠ 9♦ 6♣ — CO Open vs BTN Flat (Hero OOP)',
    description: 'Hero abrió en Cutoff y el Botón pagó con posición. Tablero intermedio de alta conectividad. Hero debe jugar fuera de posición con precaución ante el rango condensado de BTN.',
    street: 'flop',
    boardCards: ['Ts', '9d', '6c'],
    oopRangeStr: 'AA-55,AKs-A8s,KQs-KTs,QJs-QTs,JTs-J9s,T9s,98s,87s,76s,AKo-ATo,KQo-KTo,QJo-QTo,JTo',
    ipRangeStr: 'JJ-66,AQs-ATs,KQs-KTs,QJs,JTs,T9s,98s,87s,76s,AQo-AJo,KQo',
    config: {
      startingPot: 65,
      effectiveStack: 180,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'OOP',
    category: 'single-raised'
  },

  // 7. Blind vs Blind (SB Open vs BB Defend)
  {
    id: 'sb-open-bb-defend',
    title: 'Flop J♥ 8♠ 4♦ — Guerra de Ciegas (SB vs BB)',
    description: 'SB abrió y BB pagó en posición. Rangos más amplios de la mesa. Textura dinámica que conecta fuertemente con pares medios y conectores de ambos jugadores.',
    street: 'flop',
    boardCards: ['Jh', '8s', '4d'],
    oopRangeStr: 'AA-22,AKs-A2s,KQs-K4s,QJs-Q5s,JTs-J6s,T9s-T6s,98s-96s,87s-85s,76s,65s,54s,AKo-A6o,KQo-K8o,QJo-Q8o,JTo-J8o,T9o',
    ipRangeStr: 'TT-22,ATs-A2s,KTs-K2s,QJs-Q4s,JTs-J6s,T9s-T7s,98s-96s,87s-85s,76s-75s,65s,54s,ATo-A5o,KTo-K8o,QTo-Q9o,JTo-J9o,T9o',
    config: {
      startingPot: 60,
      effectiveStack: 180,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'OOP',
    category: 'blind-vs-blind'
  },

  // 8. BvB Limped Pot (SB Limp / BB Check)
  {
    id: 'bvb-limped-pot',
    title: 'Flop 7♠ 5♦ 2♣ — Bote Limpeado SB Completa / BB Pasa',
    description: 'Bote mínimo de 2 BB sin agresor preflop. Rangos ilimitados con combinaciones de cartas bajas. Dificultad para extraer valor; el bluff probing es muy común.',
    street: 'flop',
    boardCards: ['7s', '5d', '2c'],
    oopRangeStr: 'AA-22,AKs-A2s,KQs-K2s,QJs-Q2s,JTs-J2s,T9s-T4s,98s-95s,87s-84s,76s-74s,65s-63s,54s,AKo-A2o,KQo-K2o,QJo-Q4o,JTo-J6o,T9o',
    ipRangeStr: 'AA-22,AKs-A2s,KQs-K2s,QJs-Q2s,JTs-J2s,T9s-T4s,98s-95s,87s-84s,76s-74s,65s-63s,54s,AKo-A2o,KQo-K2o,QJo-Q4o,JTo-J6o,T9o',
    config: {
      startingPot: 25,
      effectiveStack: 190,
      betSizes: [0.33, 0.5],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'OOP',
    category: 'blind-vs-blind'
  },

  // 9. 3-Bet Pot: BTN 3-Bet vs CO Open (Hero IP)
  {
    id: 'btn-3bet-vs-co',
    title: 'Flop Q♠ J♥ 5♦ — Bote 3-Bet BTN vs CO (Hero IP)',
    description: 'Hero resubió preflop a 3-Bet en BTN y CO pagó fuera de posición. Bote grande (~20 BB). Hero tiene ventaja con overpairs y combinaciones dominantes (AK, AQ, AA, KK, QQ).',
    street: 'flop',
    boardCards: ['Qs', 'Jh', '5d'],
    oopRangeStr: 'TT-66,AQs-AJs,KQs,QJs,JTs,T9s,AQo',
    ipRangeStr: 'AA-JJ,AKs,AKo,A5s-A2s,KJs:0.5,QJs:0.5,87s,76s,65s',
    config: {
      startingPot: 200,
      effectiveStack: 110,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'three-bet'
  },

  // 10. 3-Bet Pot: BB 3-Bet vs BTN Open (Hero OOP)
  {
    id: 'bb-3bet-vs-btn',
    title: 'Flop A♥ K♠ 4♦ — Bote 3-Bet BB vs BTN (Hero OOP)',
    description: 'BB hizo 3-Bet y BTN pagó en posición. El flop As-Rey conecta masivamente con el rango del 3-beteador (AA, KK, AK). Apuesta de presión obligatoria.',
    street: 'flop',
    boardCards: ['Ah', 'Ks', '4d'],
    oopRangeStr: 'AA-TT,AKs-AJs,AKo,AQo,A5s-A2s,KQs,KJs,QJs,T9s,87s,65s',
    ipRangeStr: 'JJ-66,AQs-ATs,KQs-KTs,QJs,JTs,T9s,98s,AQo',
    config: {
      startingPot: 200,
      effectiveStack: 110,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'flop'
    },
    defaultHero: 'OOP',
    category: 'three-bet'
  },

  // 11. Turn Wet Double Barrel
  {
    id: 'wet-turn-probe',
    title: 'Turn J♥ 9♠ 4♦ 2♣ — Segunda Bala en Turn Seco/Mojado',
    description: 'Hero en posición apostó el flop y rival pagó. El Turn es un 2♣ inocuo (brick). Decisión de continuar con una segunda bala (barrel 66-75%) o controlar el bote.',
    street: 'turn',
    boardCards: ['Jh', '9s', '4d', '2c'],
    oopRangeStr: 'JJ,99,44,KJs,QJs,JTs,T9s,98s,87s,AJo',
    ipRangeStr: 'QQ,JJ,99,AJs,KJs,QJs,T9s,87s,QTs,A5s,KQo',
    config: {
      startingPot: 90,
      effectiveStack: 150,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'turn'
    },
    defaultHero: 'IP',
    category: 'turn-probe'
  },

  // 12. Turn Flush Completes Runout
  {
    id: 'turn-flush-completes',
    title: 'Turn K♥ J♠ 8♦ 4♥ — Segunda Carta de Corazones (Flush Draw)',
    description: 'El turn trae el 4♥ abriendo o completando proyectos de color. El jugador agresor debe polarizarse fuertemente y pasar con manos de valor marginal.',
    street: 'turn',
    boardCards: ['Kh', 'Js', '8d', '4h'],
    oopRangeStr: 'TT-77,KTs-K7s,QJs,JTs,T9s,98s,87s,KQo,KJo',
    ipRangeStr: 'AA-JJ,AKs,A5s,A4s,KQs,QJs,JTs,T9s,AKo,AQo',
    config: {
      startingPot: 100,
      effectiveStack: 140,
      betSizes: [0.5, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'turn'
    },
    defaultHero: 'IP',
    category: 'turn-probe'
  },

  // 13. Turn Paired Board Runout
  {
    id: 'turn-paired-probe',
    title: 'Turn 9♥ 7♦ 4♠ 7♣ — El Turn Dobla el 7 (Board Emparejado)',
    description: 'La 4ª carta dobla el siete, reduciendo las combinaciones de dos parejas posibles en el board y fortaleciendo las overpairs puras (AA, KK, QQ, JJ, TT).',
    street: 'turn',
    boardCards: ['9h', '7d', '4s', '7c'],
    oopRangeStr: '99,88,77,66,55,T9s,98s,87s,76s,65s,A9o',
    ipRangeStr: 'AA-TT,99,A9s,K9s,Q9s,87s,AKo,AQo',
    config: {
      startingPot: 90,
      effectiveStack: 150,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'turn'
    },
    defaultHero: 'IP',
    category: 'turn-probe'
  },

  // 14. River Polarized Shove vs Bluff Catcher
  {
    id: 'river-bluff-catcher',
    title: 'River A♠ K♦ 7♣ 2♥ 4♠ — All-In Polarizado vs Bluff Catcher',
    description: 'Tablero seco completado. IP polariza su rango entre monstruos (sets, dobles parejas) y faroles con proyectos fallidos. OOP tiene un bluff catcher puro (par medio).',
    street: 'river',
    boardCards: ['As', 'Kd', '7c', '2h', '4s'],
    oopRangeStr: 'JJ,TT,99,88,ATs,KTs,QJs,JTs,AJo,KQo:0.5',
    ipRangeStr: 'AA,KK,77,44,AKs,AKo,65s,QTo:0.5,JTo:0.5',
    config: {
      startingPot: 120,
      effectiveStack: 100,
      betSizes: [0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'river'
    },
    defaultHero: 'OOP',
    category: 'river-decision'
  },

  // 15. River Thin Value Extraction
  {
    id: 'river-thin-value',
    title: 'River Q♠ J♦ 8♣ 4♥ 2♦ — Extracción Fina de Valor en River',
    description: 'En el river no se completaron proyectos de color ni escaleras milagrosas. Hero con Top Pair fuerte o overpair debe decidir si apostar un sizing fino (33%) o pasar.',
    street: 'river',
    boardCards: ['Qs', 'Jd', '8c', '4h', '2d'],
    oopRangeStr: 'JJ,TT,99,88,QJs,JTs,T9s,98s,AJo,KJo',
    ipRangeStr: 'AA,KK,QQ,AQo,KQo,AJs,KJs,QJs',
    config: {
      startingPot: 110,
      effectiveStack: 120,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'river'
    },
    defaultHero: 'IP',
    category: 'river-decision'
  },

  // 16. River Missed Draw Bluff Spot
  {
    id: 'river-missed-draw-bluff',
    title: 'River K♠ T♥ 6♦ 3♠ 2♣ — Farol Puro con Proyecto Fallido',
    description: 'Los proyectos de color y escalera no conectaron en el river. El agresor decide si meter un tercer cañonazo (triple barrel bluff) para forzar el fold de pares medios.',
    street: 'river',
    boardCards: ['Ks', 'Th', '6d', '3s', '2c'],
    oopRangeStr: 'TT,66,KTs,QTs,JTs,T9s,KJo,QJo',
    ipRangeStr: 'AA,KK,TT,AKs,AKo,QJs,98s,87s',
    config: {
      startingPot: 130,
      effectiveStack: 95,
      betSizes: [0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'river'
    },
    defaultHero: 'IP',
    category: 'river-decision'
  },

  // 17. SRP: BTN vs BB - Wheel Board
  {
    id: 'srp-btn-bb-wheel',
    title: 'Flop 5♣ 4♠ 2♦ — Tablero Bajo / Rueda (Wheel Draw)',
    description: 'Tablero bajo y muy conectado donde BB conecta con todas las escaleras de rueda (A3, 36) y dobles parejas bajas (54, 42). BTN debe tener cuidado con sobreapostar overpairs.',
    street: 'flop',
    boardCards: ['5c', '4s', '2d'],
    oopRangeStr: '77-22,A5s-A2s,65s,64s,54s,53s,43s,32s,76s,87s,98s,A5o-A2o,65o,54o',
    ipRangeStr: 'AA-22,AKs-A2s,KQs-K9s,QJs-Q9s,JTs,T9s,98s,87s,76s,65s,54s,AKo-ATo,KQo',
    config: {
      startingPot: 55,
      effectiveStack: 180,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'single-raised'
  },

  // 18. SRP: CO vs BB - Monotone Diamond Flop
  {
    id: 'srp-co-bb-monotone',
    title: 'Flop A♦ 8♦ 3♦ — Monocolor de Diamantes en Bote Subido',
    description: 'Flop monocolor con el As de diamantes en mesa. La posesión del Rey o Dama de diamantes como blocker define los rangos de semi-farol y agresividad.',
    street: 'flop',
    boardCards: ['Ad', '8d', '3d'],
    oopRangeStr: 'TT-22,KQs,KJs,KTs,QJs,QTs,JTs,T9s,98s,87s,76s,KJo,QJo,JTo',
    ipRangeStr: 'AA-66,AKs-ATs,KQs-KTs,QJs,JTs,T9s,98s,87s,AKo-AJo,KQo',
    config: {
      startingPot: 55,
      effectiveStack: 180,
      betSizes: [0.25, 0.5],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'single-raised'
  },

  // 19. SRP: UTG vs BB - Broadway Connectors
  {
    id: 'srp-utg-bb-broadway',
    title: 'Flop K♠ Q♦ T♣ — Broadway Pesado UTG vs BB',
    description: 'Tablero sumamente pesado que impacta fuertemente ambos rangos. Escaleras hechas posibles (AJ). Altísima densidad de top pairs, dobles parejas y proyectos masivos.',
    street: 'flop',
    boardCards: ['Ks', 'Qd', 'Tc'],
    oopRangeStr: 'JJ-22,AJs-ATs,KTs-K9s,QJs-QTs,JTs-J9s,T9s,98s,AJo,ATo,KJo,QJo,JTo',
    ipRangeStr: 'AA-TT,AKs-AJs,KQs,QJs,JTs,AKo,AQo,AJo,KQo',
    config: {
      startingPot: 50,
      effectiveStack: 190,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'single-raised'
  },

  // 20. SRP: SB Open vs BB - Paired High Kings
  {
    id: 'srp-sb-bb-paired-high',
    title: 'Flop K♥ K♣ 7♦ — Tablero Emparejado Rey en Guerra de Ciegas',
    description: 'Rey doblado en el flop. Muy pocas combinaciones de tríos en ambos jugadores. SB tiene una frecuencia muy alta de C-bet barata (25-33%) para negar equity.',
    street: 'flop',
    boardCards: ['Kh', 'Kc', '7d'],
    oopRangeStr: 'AA-22,AKs-A2s,KQs-K2s,QJs-Q6s,JTs-J7s,T9s,98s,87s,76s,AKo-A7o,KQo-K8o,QJo',
    ipRangeStr: 'TT-22,ATs-A2s,KTs-K5s,QJs-Q7s,JTs-J7s,T9s,98s,87s,76s,ATo-A7o,KTo-K7o,QJo-Q9o,JTo',
    config: {
      startingPot: 60,
      effectiveStack: 180,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 2,
      street: 'flop'
    },
    defaultHero: 'OOP',
    category: 'blind-vs-blind'
  },

  // 21. 3-Bet Pot: SB 3-Bet vs BTN Open - Dry Jack High
  {
    id: 'three-bet-btn-sb-jack',
    title: 'Flop J♠ 8♥ 3♣ — Bote 3-Bet SB vs BTN (Hero OOP)',
    description: 'SB resubió preflop a 3-bet y BTN pagó en posición. El flop J-8-3 conecta moderadamente; SB puede disparar sizing pequeño (33%) o pasar para atrapar faroles.',
    street: 'flop',
    boardCards: ['Js', '8h', '3c'],
    oopRangeStr: 'AA-99,AKs-AJs,KQs,A5s-A4s,AKo,AQo',
    ipRangeStr: 'TT-66,AQs-ATs,KQs-KTs,QJs,JTs,T9s,98s,AQo',
    config: {
      startingPot: 190,
      effectiveStack: 110,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'flop'
    },
    defaultHero: 'OOP',
    category: 'three-bet'
  },

  // 22. 3-Bet Pot: BB 3-Bet vs UTG Open - Low Rag Board
  {
    id: 'three-bet-bb-utg-low',
    title: 'Flop 7♦ 4♠ 2♣ — Bote 3-Bet BB vs UTG (Hero OOP)',
    description: 'BB resubió al open-raiser temprano de UTG. El flop 7-4-2 seco favorece las overpairs puras de ambos (AA, KK, QQ, JJ, TT). BB debe continuar con cautela.',
    street: 'flop',
    boardCards: ['7d', '4s', '2c'],
    oopRangeStr: 'AA-TT,AKs,AQs,A5s,A4s,AKo',
    ipRangeStr: 'QQ-88,AKs,AQs,KQs,AKo',
    config: {
      startingPot: 180,
      effectiveStack: 120,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'flop'
    },
    defaultHero: 'OOP',
    category: 'three-bet'
  },

  // 23. 3-Bet Pot: BTN 3-Bet vs CO Open - Two-Tone Dynamic
  {
    id: 'three-bet-co-btn-dynamic',
    title: 'Flop T♥ 9♥ 4♣ — Bote 3-Bet Dos Tonos Dinámico BTN vs CO',
    description: 'Flop de alta tensión con color y proyectos de escalera abierta. BTN en posición tiene ventaja posicional decisiva y alta presión con rango polarizado.',
    street: 'flop',
    boardCards: ['Th', '9h', '4c'],
    oopRangeStr: 'JJ-77,AQs-ATs,KQs-KTs,QJs,JTs,AQo',
    ipRangeStr: 'AA-TT,AKs-ATs,KQs,QJs,JTs,87s,AKo,AQo',
    config: {
      startingPot: 200,
      effectiveStack: 110,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'flop'
    },
    defaultHero: 'IP',
    category: 'three-bet'
  },

  // 24. 3-Bet Pot: SB 3-Bet vs BB Defense - Monotone Queen
  {
    id: 'three-bet-sb-bb-monotone',
    title: 'Flop Q♠ 9♠ 4♠ — 3-Bet Monocolor Picas SB vs BB',
    description: 'Tres picas en el flop en bote 3-bet. El jugador con la A♠ o K♠ tiene enorme ventaja de presión y capacidad de farolear en calles futuras.',
    street: 'flop',
    boardCards: ['Qs', '9s', '4s'],
    oopRangeStr: 'AA-JJ,AKs-ATs,KQs,A5s-A3s,AKo,AQo',
    ipRangeStr: 'TT-77,AJs-ATs,KQs-KTs,QJs,JTs,T9s,AQo',
    config: {
      startingPot: 190,
      effectiveStack: 110,
      betSizes: [0.25, 0.5],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'flop'
    },
    defaultHero: 'OOP',
    category: 'three-bet'
  },

  // 25. Turn: Ace Scare Card Runout
  {
    id: 'turn-scare-ace',
    title: 'Turn J♠ 8♦ 3♣ A♥ — As Peligroso (Scare Card) en el Turn',
    description: 'El Turn trae el As de corazones. El rango del agresor preflop se fortalece enormemente, convirtiendo manos como AK y AQ en top pair top kicker e incrementando faroles.',
    street: 'turn',
    boardCards: ['Js', '8d', '3c', 'Ah'],
    oopRangeStr: 'JJ,88,QJs,JTs,T9s,98s,AJo,KJo',
    ipRangeStr: 'AA,JJ,AKs,AQs,AJs,ATs,KQs,QJs,AKo,AQo',
    config: {
      startingPot: 90,
      effectiveStack: 150,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'turn'
    },
    defaultHero: 'IP',
    category: 'turn-probe'
  },

  // 26. Turn: Straight Completer Runout
  {
    id: 'turn-straight-draw-completes',
    title: 'Turn 9♠ 8♦ 4♣ 7♥ — El Turn Conecta Escaleras con el 7♥',
    description: 'La 4ª carta completa escaleras con Diez-Seis (T6), Jota-Diez (JT) y Seis-Cinco (65). La ventaja de nuts bascula hacia quien defendió con conectores.',
    street: 'turn',
    boardCards: ['9s', '8d', '4c', '7h'],
    oopRangeStr: '99,88,77,T9s,98s,87s,76s,65s,JTo',
    ipRangeStr: 'AA-TT,99,88,AKs,JTs,T9s,98s,87s,AKo',
    config: {
      startingPot: 95,
      effectiveStack: 145,
      betSizes: [0.5, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'turn'
    },
    defaultHero: 'OOP',
    category: 'turn-probe'
  },

  // 27. Turn: Double Paired Board Runout
  {
    id: 'turn-double-paired',
    title: 'Turn K♠ 9♦ 4♣ 9♥ — El 9 se Empareja en el Turn',
    description: 'El Turn dobla el 9. Reduce las combinaciones de dobles parejas de 9-4 o K-9, y fortalece enormemente los overpairs de Reyes (KK, AK, KQ).',
    street: 'turn',
    boardCards: ['Ks', '9d', '4c', '9h'],
    oopRangeStr: '99,44,K9s,Q9s,J9s,T9s,98s,A4s,KJo',
    ipRangeStr: 'AA,KK,99,AKs,KQs,KJs,AKo,AQo',
    config: {
      startingPot: 90,
      effectiveStack: 150,
      betSizes: [0.33, 0.67],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'turn'
    },
    defaultHero: 'IP',
    category: 'turn-probe'
  },

  // 28. Turn: 4-Flush Runout
  {
    id: 'turn-four-flush',
    title: 'Turn Q♠ 7♠ 3♠ 9♠ — 4ª Pica en el Turn',
    description: 'Cualquier carta de picas ahora otorga color. La carta más alta de picas en mano (A♠ o K♠) se convierte en el factor determinante de la acción.',
    street: 'turn',
    boardCards: ['Qs', '7s', '3s', '9s'],
    oopRangeStr: 'QQ,99,77,AJs,KJs,QJs,JTs,T9s,87s',
    ipRangeStr: 'AA,KK,QQ,AKs,A5s,KQs,JTs,AKo',
    config: {
      startingPot: 100,
      effectiveStack: 140,
      betSizes: [0.25, 0.5],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'turn'
    },
    defaultHero: 'IP',
    category: 'turn-probe'
  },

  // 29. River: Four-Flush River Overbet Shove
  {
    id: 'river-four-flush-overbet',
    title: 'River 8♥ 6♥ 2♣ T♥ A♥ — 4 Corazones en el River',
    description: 'Cinco cartas comunitarias con 4 corazones. En showdown, quien tenga la A♥ o K♥ posee las nuts absolutas y puede amenazar all-in polarizado.',
    street: 'river',
    boardCards: ['8h', '6h', '2c', 'Th', 'Ah'],
    oopRangeStr: 'TT,88,66,ATs,KTs,QJs,JTs,T9s,98s',
    ipRangeStr: 'AA,TT,AKs,A5s,KQs,KJs,QJs,AKo',
    config: {
      startingPot: 130,
      effectiveStack: 90,
      betSizes: [0.5, 1.2],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'river'
    },
    defaultHero: 'IP',
    category: 'river-decision'
  },

  // 30. River: Paired Top Card River Showdown
  {
    id: 'river-paired-top-trips',
    title: 'River J♠ 8♦ 4♣ 2♥ J♦ — El River Dobla la Jota',
    description: 'El River empareja la carta más alta del flop (Jota). Las overpairs puras (QQ, KK, AA) se mantienen como manos de valor sólido capaces de pagar o apostar fino.',
    street: 'river',
    boardCards: ['Js', '8d', '4c', '2h', 'Jd'],
    oopRangeStr: '88,44,QJs,JTs,T9s,98s,AJo,KJo',
    ipRangeStr: 'AA,KK,QQ,AJs,KJs,QJs,AKo,AQo',
    config: {
      startingPot: 120,
      effectiveStack: 100,
      betSizes: [0.33, 0.75],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'river'
    },
    defaultHero: 'IP',
    category: 'river-decision'
  },

  // 31. River: 4-to-Straight Nut vs 2nd Nut
  {
    id: 'river-four-to-straight',
    title: 'River 9♠ 8♦ 6♣ 5♥ 7♦ — 4 Cartas Consecutivas en Board',
    description: 'Cualquier Diez (T) o Cuatro (4) hace escalera. Quien posea el T tiene las nuts más altas posibles. Decisión de repartir bote (chop) o forzar fold con el blocker del Diez.',
    street: 'river',
    boardCards: ['9s', '8d', '6c', '5h', '7d'],
    oopRangeStr: 'TT,99,88,77,66,T9s,98s,87s,76s,65s',
    ipRangeStr: 'AA,KK,QQ,JJ,TT,AKs,JTs,T9s,98s,87s',
    config: {
      startingPot: 125,
      effectiveStack: 95,
      betSizes: [0.5, 1.0],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'river'
    },
    defaultHero: 'OOP',
    category: 'river-decision'
  },

  // 32. River: 3-Bet Pot Triple Barrel Shove
  {
    id: 'river-3bet-triple-barrel-shove',
    title: 'River A♦ Q♠ 4♣ 9♥ 3♦ — All-In Triple Bala en Bote 3-Bet',
    description: 'SPR menor a 1. El agresor de 3-bet llega al river habiendo disparado flop y turn. Momento crucial para meter el resto con AK/AQ o con un farol creíble con blocker de AQ.',
    street: 'river',
    boardCards: ['Ad', 'Qs', '4c', '9h', '3d'],
    oopRangeStr: 'QQ,99,44,AQs,AJs,KQs,QJs,AQo',
    ipRangeStr: 'AA,QQ,AKs,AQs,AKo,KJs:0.5,JTs:0.5',
    config: {
      startingPot: 150,
      effectiveStack: 70,
      betSizes: [0.5, 1.0],
      raiseSizes: [2.5],
      allowAllIn: true,
      maxRaises: 1,
      street: 'river'
    },
    defaultHero: 'IP',
    category: 'river-decision'
  }
];
