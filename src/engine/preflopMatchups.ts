/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Preflop Position & Matchup Dynamic Range Engine.
 * Automatically computes standard opening, defending, and 3-bet ranges
 * based on Hero's position, prior action (opened or faced open), and Villain's position.
 */

import { TablePosition, getPostflopRole } from '../components/HandAndPositionBar';
import { PlayerRole } from './gameTree';

export type PreflopActionContext = 
  | 'RFI'          // Nadie abrió antes; Hero abre la mano (Raise First In)
  | 'FACING_OPEN'  // Rival abrió previo a Hero; Hero defiende pagando (Call / Cold Call)
  | 'HERO_3BET'    // Rival abrió previo a Hero; Hero resube a 3-Bet
  | 'FACING_3BET'  // Hero abrió la mano; Rival resubió a 3-Bet y Hero paga
  | 'BVB_LIMP';    // SB completa la ciega (Limp), BB pasa

export type OpponentProfile = 'nit' | 'regular' | 'fish';

export interface OpponentProfileInfo {
  id: OpponentProfile;
  name: string;
  tag: string;
  desc: string;
  exploitHint: string;
  tendencies: string[];
}

export const OPPONENT_PROFILES: Record<OpponentProfile, OpponentProfileInfo> = {
  nit: {
    id: 'nit',
    name: 'Nit (Tight-Pasivo / Roca)',
    tag: 'Roca',
    desc: 'Solo juega manos premium. Rara vez farolea en calles avanzadas; sus apuestas representan las nuts casi siempre.',
    exploitHint: 'Roba sus ciegas agresivamente. C-bet pequeña frecuente; si resube o apuesta fuerte, foldea manos de un par.',
    tendencies: ['VPIP bajo (12-16%)', 'PFR bajo (10-14%)', '3-Bet solo QQ+, AK', 'Cero faroles en river']
  },
  regular: {
    id: 'regular',
    name: 'Regular (TAG / GTO Equilibrado)',
    tag: 'GTO Equilibrado',
    desc: 'Jugador competente con frecuencias balanceadas de valor y semi-faroles según teoría de juegos.',
    exploitHint: 'Juega líneas óptimas GTO, mezclando apuestas con blockers y protegiendo rangos de check.',
    tendencies: ['VPIP estándar (22-26%)', 'PFR equilibrado (18-22%)', '3-Bet polarizado (7-9%)', 'Defensa sólida']
  },
  fish: {
    id: 'fish',
    name: 'Fish (Loose-Pasivo / Ballena)',
    tag: 'Calling Station',
    desc: 'Juega demasiadas manos preflop. Paga apuestas postflop sin odds con proyectos débiles y parejas bajas.',
    exploitHint: 'Aumenta el sizing de valor (75%+ pot o overbets). Reduce faroles puros en river porque rara vez foldea.',
    tendencies: ['VPIP alto (35-55%+)', 'PFR bajo (5-12%)', 'Paga de más en todas las calles', 'Calling station']
  }
};

export interface PreflopMatchupConfig {
  heroPos: TablePosition;
  villainPos: TablePosition;
  preflopAction: PreflopActionContext;
  opponentProfile: OpponentProfile;
  opponentInfo: OpponentProfileInfo;
  exploitHint: string;
  potChips: number;
  potBB: number;
  effectiveStackBB: number;
  heroRangeStr: string;
  villainRangeStr: string;
  heroRole: PlayerRole; // 'IP' | 'OOP'
  villainRole: PlayerRole; // 'IP' | 'OOP'
  aggressor: 'HERO' | 'VILLAIN' | 'NONE';
  spotLabel: string;
  summaryExplanation: string;
  suggestedHeroHands: string[];
}

/**
 * Baseline Preflop Range Definitions (Standard 100BB 6-Max Optimal Strategies)
 */
export const PREFLOP_RANGES = {
  // Opening Ranges (RFI)
  EP_OPEN: 'AA-77,AKs-ATs,KQs-KTs,QJs-QTs,JTs,T9s,98s,AKo-AQo,AJo:0.5,KQo:0.5',
  MP_OPEN: 'AA-55,AKs-A8s,KQs-KTs,QJs-QTs,JTs-J9s,T9s,98s,87s,AKo-AJo,KQo,KJo:0.5',
  CO_OPEN: 'AA-22,AKs-A2s,KQs-K9s,QJs-Q9s,JTs-J9s,T9s-T8s,98s,87s,76s,65s,AKo-ATo,KQo-KTo,QJo-QTo,JTo',
  BTN_OPEN: 'AA-22,AKs-A2s,KQs-K2s,QJs-Q4s,JTs-J6s,T9s-T6s,98s-96s,87s-85s,76s-74s,65s-64s,54s-53s,43s,AKo-A7o,KQo-K9o,QJo-Q9o,JTo-J9o,T9o,98o',
  SB_OPEN: 'AA-22,AKs-A2s,KQs-K6s,QJs-Q7s,JTs-J8s,T9s-T8s,98s-97s,87s,76s,65s,54s,AKo-A8o,KQo-KTo,QJo-QTo,JTo',

  // Big Blind Defend vs Single Raise
  BB_DEF_VS_EP: 'TT-22,AQs-A2s,KQs-KTs,QJs-QTs,JTs,T9s,98s,87s,76s,AQo-AJo,KQo',
  BB_DEF_VS_MP: 'JJ-22,AJs-A2s,KQs-K7s,QJs-Q8s,JTs-J8s,T9s,98s,87s,76s,65s,AJo-ATo,KQo-KJo,QJo',
  BB_DEF_VS_CO: 'TT-22,ATs-A2s,KJs-K2s,QJs-Q6s,JTs-J7s,T9s-T7s,98s-97s,87s,76s,65s,54s,AJo-A7o,KQo-KTo,QJo-QTo,JTo-J9o',
  BB_DEF_VS_BTN: '99-22,A9s-A2s,KTs-K2s,QTs-Q2s,JTs-J4s,T9s-T6s,98s-96s,87s-85s,76s-75s,65s-64s,54s,ATo-A4o,KTo-K7o,QTo-Q8o,JTo-J8o,T9o,98o,87o',
  BB_DEF_VS_SB: 'TT-22,ATs-A2s,KTs-K2s,QJs-Q4s,JTs-J6s,T9s-T7s,98s-96s,87s-85s,76s-75s,65s,54s,ATo-A5o,KTo-K8o,QTo-Q9o,JTo-J9o,T9o,98o',

  // Position Flat Calling Ranges
  BTN_FLAT_CO: 'TT-66,AQs-ATs,KQs-KTs,QJs,JTs,T9s,98s,87s,AQo',
  BTN_FLAT_MP: 'JJ-77,AQs-AJs,KQs-KJs,QJs,JTs,T9s,AQo',
  SB_DEF_VS_BTN: 'TT-66,AQs-A9s,KQs-KTs,QJs-QTs,JTs,T9s,98s,AQo',

  // 3-Bet Ranges
  BTN_3BET_VS_CO: 'AA-JJ,AKs,AKo,A5s-A2s,KJs:0.5,QJs:0.5,87s,76s,65s',
  CO_DEF_VS_3BET: 'TT-77,AQs-AJs,KQs,QJs,JTs,T9s,AQo',
  BB_3BET_VS_BTN: 'AA-TT,AKs-AJs,AKo,AQo,A5s-A2s,KQs,KJs,QJs,T9s,87s,65s',
  BTN_DEF_VS_3BET: 'JJ-66,AQs-ATs,KQs-KTs,QJs,JTs,T9s,98s,AQo',
  SB_3BET_VS_BTN: 'AA-TT,AKs-AJs,AKo,AQo,A5s-A3s,KQs,QJs,JTs,87s',
  BB_3BET_VS_SB: 'AA-99,AKs-ATs,AKo,AQo,AJo:0.5,A5s-A2s,KQs,KJs,QJs,87s,76s,65s'
};

/**
 * Calculates preflop matchup profile automatically
 */
export function getAutoMatchupProfile(
  heroPos: TablePosition,
  villainPos: TablePosition,
  preflopAction: PreflopActionContext = 'RFI',
  opponentProfile: OpponentProfile = 'regular'
): PreflopMatchupConfig {
  const heroRole = getPostflopRole(heroPos, villainPos);
  const villainRole = heroRole === 'IP' ? 'OOP' : 'IP';

  let potBB = 5.5;
  let aggressor: 'HERO' | 'VILLAIN' | 'NONE' = 'HERO';
  let heroRangeStr = PREFLOP_RANGES.BTN_OPEN;
  let villainRangeStr = PREFLOP_RANGES.BB_DEF_VS_BTN;
  let spotLabel = `${heroPos} vs ${villainPos}`;
  let summaryExplanation = '';
  let suggestedHeroHands = ['AhKd', 'QhQc', 'JhTh', '8h8d', '7h6h'];

  // Case 1: Hero Opens (RFI)
  if (preflopAction === 'RFI') {
    aggressor = 'HERO';
    potBB = villainPos === 'BB' ? 5.5 : 6.0;

    // Pick Hero Range based on Hero Position
    if (heroPos === 'EP') {
      heroRangeStr = PREFLOP_RANGES.EP_OPEN;
      suggestedHeroHands = ['AsKs', 'AhQh', 'KhQh', 'JdJs', 'AcJd'];
    } else if (heroPos === 'MP') {
      heroRangeStr = PREFLOP_RANGES.MP_OPEN;
      suggestedHeroHands = ['AsKd', 'KhQs', 'TdTs', '9h8h', 'AcTd'];
    } else if (heroPos === 'CO') {
      heroRangeStr = PREFLOP_RANGES.CO_OPEN;
      suggestedHeroHands = ['AhQd', 'KdJd', '9s9h', '8s7s', 'Ad5d'];
    } else if (heroPos === 'BTN') {
      heroRangeStr = PREFLOP_RANGES.BTN_OPEN;
      suggestedHeroHands = ['AhKh', 'KdQd', '7h6h', 'Ad4d', 'JcTc'];
    } else if (heroPos === 'SB') {
      heroRangeStr = PREFLOP_RANGES.SB_OPEN;
      potBB = 6.0;
      suggestedHeroHands = ['AhJd', 'KdTs', '6h6d', '5h4h', 'Ad9d'];
    } else {
      // BB opens is rare (limp/iso or walk), default to linear
      heroRangeStr = PREFLOP_RANGES.BTN_OPEN;
    }

    // Pick Villain Defend Range based on matchup
    if (villainPos === 'BB') {
      if (heroPos === 'EP') villainRangeStr = PREFLOP_RANGES.BB_DEF_VS_EP;
      else if (heroPos === 'MP') villainRangeStr = PREFLOP_RANGES.BB_DEF_VS_MP;
      else if (heroPos === 'CO') villainRangeStr = PREFLOP_RANGES.BB_DEF_VS_CO;
      else if (heroPos === 'BTN') villainRangeStr = PREFLOP_RANGES.BB_DEF_VS_BTN;
      else if (heroPos === 'SB') villainRangeStr = PREFLOP_RANGES.BB_DEF_VS_SB;
    } else if (villainPos === 'BTN') {
      villainRangeStr = heroPos === 'CO' ? PREFLOP_RANGES.BTN_FLAT_CO : PREFLOP_RANGES.BTN_FLAT_MP;
    } else {
      villainRangeStr = PREFLOP_RANGES.BB_DEF_VS_CO;
    }

    spotLabel = `Hero abrió en ${heroPos} (RFI) vs Call de ${villainPos}`;
    summaryExplanation = `Bote subido estándar (Single Raised Pot). Hero tiene iniciativa y ventaja de rango con las cartas altas.`;
  }
  // Case 2: Facing Open (Rival abrió y Hero paga)
  else if (preflopAction === 'FACING_OPEN') {
    aggressor = 'VILLAIN';
    potBB = heroPos === 'BB' ? 5.5 : 6.0;

    // Villain is the raiser
    if (villainPos === 'EP') villainRangeStr = PREFLOP_RANGES.EP_OPEN;
    else if (villainPos === 'MP') villainRangeStr = PREFLOP_RANGES.MP_OPEN;
    else if (villainPos === 'CO') villainRangeStr = PREFLOP_RANGES.CO_OPEN;
    else if (villainPos === 'BTN') villainRangeStr = PREFLOP_RANGES.BTN_OPEN;
    else if (villainPos === 'SB') villainRangeStr = PREFLOP_RANGES.SB_OPEN;

    // Hero is the defender
    if (heroPos === 'BB') {
      if (villainPos === 'EP') heroRangeStr = PREFLOP_RANGES.BB_DEF_VS_EP;
      else if (villainPos === 'MP') heroRangeStr = PREFLOP_RANGES.BB_DEF_VS_MP;
      else if (villainPos === 'CO') heroRangeStr = PREFLOP_RANGES.BB_DEF_VS_CO;
      else if (villainPos === 'BTN') heroRangeStr = PREFLOP_RANGES.BB_DEF_VS_BTN;
      else heroRangeStr = PREFLOP_RANGES.BB_DEF_VS_SB;
      suggestedHeroHands = ['JhTd', '9h8h', '6h6d', 'Ad8d', 'QdTs'];
    } else if (heroPos === 'BTN') {
      heroRangeStr = PREFLOP_RANGES.BTN_FLAT_CO;
      suggestedHeroHands = ['TdTs', 'AhJd', 'QhJd', '8h7h', 'KhQd'];
    } else {
      heroRangeStr = PREFLOP_RANGES.BB_DEF_VS_BTN;
      suggestedHeroHands = ['Th9h', '8h8d', 'KdJd', 'AdTd', '7h6h'];
    }

    spotLabel = `${villainPos} abrió vs Call de Hero en ${heroPos}`;
    summaryExplanation = `Hero defiende con rango condensado/conectado. El rival tiene iniciativa con el rango de apertura.`;
  }
  // Case 3: Hero 3-Bets (Rival abrió y Hero resubió)
  else if (preflopAction === 'HERO_3BET') {
    aggressor = 'HERO';
    potBB = 19.5; // typical 3-bet pot 9-10bb x 2 + blinds

    if (heroPos === 'BTN') {
      heroRangeStr = PREFLOP_RANGES.BTN_3BET_VS_CO;
      villainRangeStr = PREFLOP_RANGES.CO_DEF_VS_3BET;
      suggestedHeroHands = ['AhKh', 'QhQd', 'Ad5d', '7h6h', 'KhJd'];
    } else if (heroPos === 'BB') {
      heroRangeStr = PREFLOP_RANGES.BB_3BET_VS_BTN;
      villainRangeStr = PREFLOP_RANGES.BTN_DEF_VS_3BET;
      suggestedHeroHands = ['AhKh', 'JhJd', 'Ad4d', 'KhQh', '8h7h'];
    } else {
      heroRangeStr = PREFLOP_RANGES.SB_3BET_VS_BTN;
      villainRangeStr = PREFLOP_RANGES.BTN_DEF_VS_3BET;
      suggestedHeroHands = ['AhQd', 'KhKd', 'Ad3d', 'QhJd', '9h9d'];
    }

    spotLabel = `Bote 3-Bet: Hero 3-Betea desde ${heroPos} vs ${villainPos}`;
    summaryExplanation = `Bote inflado (~20 BB). Hero tiene un rango polarizado con monstruos y faroles con blockers (Ax suited, conectores).`;
  }
  // Case 4: Facing 3-Bet (Hero abrió y Rival resubió)
  else if (preflopAction === 'FACING_3BET') {
    aggressor = 'VILLAIN';
    potBB = 20.0;

    if (heroPos === 'CO') {
      heroRangeStr = PREFLOP_RANGES.CO_DEF_VS_3BET;
      villainRangeStr = PREFLOP_RANGES.BTN_3BET_VS_CO;
      suggestedHeroHands = ['JhJd', 'AhQd', 'KhQd', 'Th9h', '8h8d'];
    } else if (heroPos === 'BTN') {
      heroRangeStr = PREFLOP_RANGES.BTN_DEF_VS_3BET;
      villainRangeStr = PREFLOP_RANGES.BB_3BET_VS_BTN;
      suggestedHeroHands = ['ThTd', 'AhJd', 'KhJd', '9h8h', 'QhTd'];
    } else {
      heroRangeStr = PREFLOP_RANGES.BTN_DEF_VS_3BET;
      villainRangeStr = PREFLOP_RANGES.BB_3BET_VS_BTN;
      suggestedHeroHands = ['JhJd', 'AhQh', 'Th9h', '7h7d', 'KhQd'];
    }

    spotLabel = `Hero defiende en bote 3-Bet vs ${villainPos}`;
    summaryExplanation = `Bote 3-Bet en defensa. Hero defiende con manos con buena jugabilidad postflop.`;
  }
  // Case 5: BvB Limp
  else {
    aggressor = 'NONE';
    potBB = 2.5;
    heroRangeStr = 'AA-22,AKs-A2s,KQs-K2s,QJs-Q2s,JTs-J2s,T9s-T4s,98s-95s,87s-85s,76s-74s,65s-64s,54s-53s,43s,AKo-A2o,KQo-K2o,QJo-Q4o,JTo-J6o,T9o-T6o,98o-96o,87o';
    villainRangeStr = 'AA-22,AKs-A2s,KQs-K2s,QJs-Q2s,JTs-J2s,T9s-T4s,98s-95s,87s-85s,76s-74s,65s-64s,54s-53s,43s,AKo-A2o,KQo-K2o,QJo-Q4o,JTo-J6o,T9o-T6o,98o-96o,87o';
    spotLabel = `Guerra de Ciegas Limpeada (SB vs BB)`;
    summaryExplanation = `Bote pequeño sin agresor preflop. Rangos muy amplios con mucha interacción en pares medios y basura.`;
    suggestedHeroHands = ['Kh7d', 'Qd8s', '6h4h', '9s7d', 'Jd4d'];
  }

  // Adjust Villain Range and Exploit hints based on Opponent Profile (Nit, Regular, Fish)
  const opponentInfo = OPPONENT_PROFILES[opponentProfile] || OPPONENT_PROFILES.regular;
  let exploitHint = opponentInfo.exploitHint;

  if (opponentProfile === 'nit') {
    if (aggressor === 'VILLAIN') {
      villainRangeStr = 'AA-99,AKs-AJs,KQs,AKo,AQo';
    } else {
      villainRangeStr = 'JJ-77,AQs-AJs,KQs,QJs,AQo';
    }
    summaryExplanation += ` · [Perfil Rival: Nit]: Rango sumamente cerrado y honesto. Rara vez farolea turn y river; sus apuestas grandes denotan monstruos.`;
  } else if (opponentProfile === 'fish') {
    if (aggressor === 'VILLAIN') {
      villainRangeStr = 'AA-22,AKs-A2s,KQs-K2s,QJs-Q2s,JTs-J2s,T9s-T5s,98s-96s,87s-85s,76s,65s,AKo-A6o,KQo-K8o,QJo-Q8o,JTo-J8o,T9o';
    } else {
      villainRangeStr = 'AA-22,AKs-A2s,KQs-K2s,QJs-Q2s,JTs-J2s,T9s-T4s,98s-94s,87s-84s,76s-73s,65s-62s,54s-52s,ATo-A2o,KTo-K2o,QTo-Q4o,JTo-J6o,T9o,98o,87o';
    }
    summaryExplanation += ` · [Perfil Rival: Fish]: Calling station preflop y postflop. Paga apuestas fuera de odds; extrae valor máximo (75%+ pot) y no farolees el river.`;
  }

  // 1 BB = 10 chips in standard solver tree (or 2 chips per BB)
  // Let's use 10 chips per BB for clean pot representation (55 chips = 5.5 BB, 200 chips = 20 BB)
  const potChips = Math.round(potBB * 10);
  const effectiveStackBB = 100 - (potBB / 2);

  return {
    heroPos,
    villainPos,
    preflopAction,
    opponentProfile,
    opponentInfo,
    exploitHint,
    potChips,
    potBB,
    effectiveStackBB,
    heroRangeStr,
    villainRangeStr,
    heroRole,
    villainRole,
    aggressor,
    spotLabel,
    summaryExplanation,
    suggestedHeroHands
  };
}
