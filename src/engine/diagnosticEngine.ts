/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * DiagnosticEngine: Diagnóstico de Nivel Estimado (NL2 -> NL50+),
 * Arquetipo (TAG / LAG / Loose-Passive / Nit), métricas 6-Max por posición
 * y Plan de Mejoras Priorizado con lanzamiento directo de drills.
 */

import {
  SIM_POSITIONS,
  SCENARIO_META,
  type LiveChallengeState,
  type SimPosition,
  type SimScenarioType
} from './handSimulator';
import { computeHudStats, type ParsedHandRecord } from './theTracker2Engine';

export type EstimatedLimit = 'NL2' | 'NL5' | 'NL10' | 'NL25' | 'NL50+';
export type PlayerArchetype = 'TAG' | 'LAG' | 'Loose-Passive' | 'Nit';

export interface PositionalMetricRow {
  pos: SimPosition;
  hands: number;
  vpip: number;
  pfr: number;
  gtoAcc: number;
  bbPer100: number;
  status: 'Fuerte' | 'Estable' | 'Fuga';
}

export interface ImprovementPlanItem {
  id: string;
  priority: 'Alta' | 'Media' | 'Optimización';
  area: string;
  problem: string;
  actionStep: string;
  drillPos: SimPosition | 'RANDOM';
  drillScenario: SimScenarioType | 'RANDOM';
}

export interface LevelDiagnosticReport {
  source: 'live_100' | 'tracker2_db';
  sourceLabel: string;
  sampleHands: number;
  estimatedLevel: EstimatedLimit;
  archetype: PlayerArchetype;
  archetypeSummary: string;
  metrics: {
    vpip: number;
    pfr: number;
    threeBet: number;
    cbet: number;
    wtsd: number;
    wsd: number;
    gtoAccuracy: number;
    bbPer100: number;
  };
  positionalBreakdown: PositionalMetricRow[];
  characteristics: string[];
  strengths: string[];
  leaks: string[];
  improvementPlan: ImprovementPlanItem[];
}

function classifyArchetype(vpip: number, pfr: number): { archetype: PlayerArchetype; summary: string } {
  const gap = Math.max(0, vpip - pfr);
  if (vpip <= 18 && pfr <= 15) {
    return {
      archetype: 'Nit',
      summary: 'Estilo conservador extremo: pierdes pocas fichas en botes grandes, pero cedes demasiado robo de ciegas y folds ante presión.'
    };
  }
  if (vpip >= 28 && gap >= 8) {
    return {
      archetype: 'Loose-Passive',
      summary: 'Entras a demasiados botes haciendo Call en lugar de tomar la iniciativa preflop; vulnerable a C-bets y barriles múltiples.'
    };
  }
  if (vpip >= 27 && pfr >= 21) {
    return {
      archetype: 'LAG',
      summary: 'Agresivo suelto con alta presión en 3-bet y posiciones tardías; muy peligroso si mantienes disciplina postflop.'
    };
  }
  return {
    archetype: 'TAG',
    summary: 'Sólido Tight-Aggressive: buena selección preflop con iniciativa, ideal para escalar de NL10 a NL50+.'
  };
}

function estimateLimitFromStats(gtoAcc: number, bbPer100: number, sampleHands: number): EstimatedLimit {
  if (sampleHands < 15) return 'NL2';
  const score = gtoAcc * 0.75 + Math.max(-10, Math.min(20, bbPer100)) * 1.4;
  if (score >= 76) return 'NL50+';
  if (score >= 66) return 'NL25';
  if (score >= 56) return 'NL10';
  if (score >= 47) return 'NL5';
  return 'NL2';
}

export function buildDiagnosticFromLiveChallenge(challenge: LiveChallengeState): LevelDiagnosticReport {
  const records = challenge.records;
  const n = records.length;

  if (n === 0) {
    return {
      source: 'live_100',
      sourceLabel: 'Reto de 100 Manos en Vivo',
      sampleHands: 0,
      estimatedLevel: 'NL2',
      archetype: 'TAG',
      archetypeSummary: 'Aún no hay decisiones registradas en el Reto en Vivo. Juega al menos 15 manos para calcular tu nivel real.',
      metrics: {
        vpip: 0,
        pfr: 0,
        threeBet: 0,
        cbet: 0,
        wtsd: 0,
        wsd: 0,
        gtoAccuracy: 0,
        bbPer100: 0
      },
      positionalBreakdown: SIM_POSITIONS.map(pos => ({
        pos,
        hands: 0,
        vpip: 0,
        pfr: 0,
        gtoAcc: 0,
        bbPer100: 0,
        status: 'Estable'
      })),
      characteristics: ['Sin muestra en vivo todavía. Inicia el Reto de 100 Manos en la Mesa 6-Max.'],
      strengths: ['Sesión lista para capturar decisiones sin sesgos previos.'],
      leaks: ['Completa al menos 15-30 manos para diagnosticar fugas por posición y escenario.'],
      improvementPlan: [
        {
          id: 'start-live',
          priority: 'Alta',
          area: 'Muestra Inicial',
          problem: 'Aún no has iniciado tu Reto de 100 Manos en Vivo.',
          actionStep: 'Lanza el entrenador 6-Max en modo aleatorio y completa tus primeras 25 manos.',
          drillPos: 'RANDOM',
          drillScenario: 'RANDOM'
        }
      ]
    };
  }

  const pct = (c: number, d: number) => (d > 0 ? Math.round((c / d) * 1000) / 10 : 0);
  const optimalCount = records.filter(r => r.isOptimal).length;
  const gtoAccuracy = pct(optimalCount, n);
  const vpip = pct(records.filter(r => r.vpipAction).length, n);
  const pfr = pct(records.filter(r => r.pfrAction).length, n);
  const threeBetOpps = records.filter(
    r => r.scenario === '3BET_IP' || r.scenario === '3BET_OOP' || r.scenario === 'SQUEEZE'
  ).length;
  const threeBetTaken = records.filter(r => r.threeBetSpot).length;
  const threeBet = threeBetOpps > 0 ? pct(threeBetTaken, n) : 0;
  const cbetOpps = records.filter(r => r.cbetOpportunity);
  const cbet = cbetOpps.length > 0 ? pct(cbetOpps.filter(r => r.cbetTaken).length, cbetOpps.length) : 0;
  const sdList = records.filter(r => r.wentToShowdown);
  const wtsd = pct(sdList.length, n);
  const wsd = sdList.length > 0 ? pct(sdList.filter(r => r.wonAtShowdown).length, sdList.length) : 0;
  const totalNet = records.reduce((s, r) => s + r.netBB, 0);
  const bbPer100 = Math.round(((totalNet / n) * 100) * 10) / 10;

  const { archetype, summary } = classifyArchetype(vpip, pfr);
  const estimatedLevel = estimateLimitFromStats(gtoAccuracy, bbPer100, n);

  const positionalBreakdown: PositionalMetricRow[] = SIM_POSITIONS.map(pos => {
    const pRecs = records.filter(r => r.heroPos === pos);
    const pn = pRecs.length;
    const pAcc = pn > 0 ? pct(pRecs.filter(r => r.isOptimal).length, pn) : 0;
    const pNet = pn > 0 ? Math.round(((pRecs.reduce((s, r) => s + r.netBB, 0) / pn) * 100) * 10) / 10 : 0;
    return {
      pos,
      hands: pn,
      vpip: pn > 0 ? pct(pRecs.filter(r => r.vpipAction).length, pn) : 0,
      pfr: pn > 0 ? pct(pRecs.filter(r => r.pfrAction).length, pn) : 0,
      gtoAcc: pAcc,
      bbPer100: pNet,
      status: pn === 0 ? 'Estable' : pAcc >= 75 ? 'Fuerte' : pAcc >= 58 ? 'Estable' : 'Fuga'
    };
  });

  // Identify weakest scenario & position
  const scenarioPerf = (Object.keys(SCENARIO_META) as SimScenarioType[])
    .map(sc => {
      const sRecs = records.filter(r => r.scenario === sc);
      return {
        sc,
        count: sRecs.length,
        acc: sRecs.length > 0 ? pct(sRecs.filter(r => r.isOptimal).length, sRecs.length) : 100,
        evLoss: sRecs.reduce((s, r) => s + r.evLossBB, 0)
      };
    })
    .filter(x => x.count > 0)
    .sort((a, b) => a.acc - b.acc);

  const weakPos = [...positionalBreakdown].filter(p => p.hands > 0).sort((a, b) => a.gtoAcc - b.gtoAcc)[0];
  const strongPos = [...positionalBreakdown].filter(p => p.hands > 0).sort((a, b) => b.gtoAcc - a.gtoAcc)[0];

  const characteristics: string[] = [
    `Arquetipo ${archetype} con ${gtoAccuracy}% de precisión Nash en ${n} decisiones registradas.`,
    `Tasa de C-Bet ${cbet}% y Winrate estimado de ${bbPer100 >= 0 ? '+' : ''}${bbPer100} bb/100.`,
    `Rendimiento destacado en ${strongPos?.pos || 'BTN'} (${strongPos?.gtoAcc || 0}% Acc).`
  ];

  const strengths: string[] = [];
  if (gtoAccuracy >= 72) strengths.push(`Alta consistencia matemática (${gtoAccuracy}% de aciertos óptimos).`);
  if (strongPos && strongPos.gtoAcc >= 70) strengths.push(`Sólido dominio en posición ${strongPos.pos} (${strongPos.gtoAcc}% precisión).`);
  if (cbet >= 50 && cbet <= 72) strengths.push(`Frecuencia de C-Bet equilibrada (${cbet}%) en rango óptimo 6-Max.`);
  if (strengths.length === 0) strengths.push('Disciplina activa registrando manos en tiempo real para corregir errores.');

  const leaks: string[] = [];
  if (weakPos && weakPos.gtoAcc < 65) {
    leaks.push(`Fuga posicional en ${weakPos.pos}: solo ${weakPos.gtoAcc}% de precisión Nash.`);
  }
  if (scenarioPerf[0] && scenarioPerf[0].acc < 70) {
    leaks.push(`Dificultad detectada en ${SCENARIO_META[scenarioPerf[0].sc].shortLabel} (${scenarioPerf[0].acc}% acierto, -${Math.round(scenarioPerf[0].evLoss * 10) / 10} BB EV).`);
  }
  if (cbet > 76) leaks.push('C-Bet excesivo (>76%): apuesta demasiado en boards coordinados y multiway.');
  if (leaks.length === 0) leaks.push('Sin fugas graves detectadas; enfócate en pulir sizings polarizados de Turn/River.');

  const improvementPlan: ImprovementPlanItem[] = [];
  if (scenarioPerf[0]) {
    improvementPlan.push({
      id: `imp-sc-${scenarioPerf[0].sc}`,
      priority: scenarioPerf[0].acc < 60 ? 'Alta' : 'Media',
      area: SCENARIO_META[scenarioPerf[0].sc].shortLabel,
      problem: `Precisión de ${scenarioPerf[0].acc}% en ${SCENARIO_META[scenarioPerf[0].sc].label}.`,
      actionStep: `Practica 20 spots enfocados en ${SCENARIO_META[scenarioPerf[0].sc].shortLabel} cuidando SPR y tamaño de apuesta.`,
      drillPos: weakPos?.pos || 'RANDOM',
      drillScenario: scenarioPerf[0].sc
    });
  }
  if (weakPos) {
    improvementPlan.push({
      id: `imp-pos-${weakPos.pos}`,
      priority: weakPos.gtoAcc < 62 ? 'Alta' : 'Media',
      area: `Posición ${weakPos.pos}`,
      problem: `Rendimiento de ${weakPos.gtoAcc}% Precisión Nash y ${weakPos.bbPer100} bb/100 desde ${weakPos.pos}.`,
      actionStep: `Ejecuta una serie de entrenamiento exclusivo en ${weakPos.pos} frente a todos los escenarios.`,
      drillPos: weakPos.pos,
      drillScenario: 'RANDOM'
    });
  }
  improvementPlan.push({
    id: 'imp-multiway',
    priority: 'Optimización',
    area: 'Control Multiway (3+ Jugadores)',
    problem: 'Evitar sobre-farolear cuando quedan 2 o más rivales en el flop.',
    actionStep: 'Lanza 15 manos filtradas en Botes Multiway y prioriza valor directo + equidad limpia.',
    drillPos: 'RANDOM',
    drillScenario: 'MULTIWAY'
  });

  return {
    source: 'live_100',
    sourceLabel: `Reto en Vivo (${n}/${challenge.targetHands} manos)`,
    sampleHands: n,
    estimatedLevel,
    archetype,
    archetypeSummary: summary,
    metrics: {
      vpip,
      pfr,
      threeBet,
      cbet,
      wtsd,
      wsd,
      gtoAccuracy,
      bbPer100
    },
    positionalBreakdown,
    characteristics,
    strengths,
    leaks,
    improvementPlan
  };
}

export function buildDiagnosticFromTracker2Hands(
  hands: ParsedHandRecord[],
  dbName: string
): LevelDiagnosticReport {
  const hud = computeHudStats(hands);
  const { archetype, summary } = classifyArchetype(hud.vpip, hud.pfr);
  const estimatedLevel = estimateLimitFromStats(hud.nashPrecisionPct, hud.bbPer100, hands.length);

  const positionalBreakdown: PositionalMetricRow[] = SIM_POSITIONS.map(pos => {
    const pHands = hands.filter(h => h.heroPos === pos);
    const pStats = computeHudStats(pHands);
    return {
      pos,
      hands: pHands.length,
      vpip: pStats.vpip,
      pfr: pStats.pfr,
      gtoAcc: pStats.nashPrecisionPct,
      bbPer100: pStats.bbPer100,
      status: pHands.length === 0 ? 'Estable' : pStats.bbPer100 >= 0 ? 'Fuerte' : pStats.bbPer100 >= -18 ? 'Estable' : 'Fuga'
    };
  });

  const weakPos = [...positionalBreakdown].filter(p => p.hands > 0).sort((a, b) => a.bbPer100 - b.bbPer100)[0];
  const strongPos = [...positionalBreakdown].filter(p => p.hands > 0).sort((a, b) => b.bbPer100 - a.bbPer100)[0];

  const characteristics: string[] = [
    `Base "${dbName}" con ${hands.length} manos importadas (${hud.bbPer100 >= 0 ? '+' : ''}${hud.bbPer100} bb/100 · EV ${hud.evBbPer100} bb/100).`,
    `Arquetipo detectado: ${archetype} (VPIP ${hud.vpip}% / PFR ${hud.pfr}% / 3-Bet ${hud.threeBet}%).`,
    `Showdown vs Non-Showdown: ${hud.showdownWonBB} BB SD / ${hud.nonShowdownWonBB} BB Red Line.`
  ];

  const strengths: string[] = [];
  if (hud.bbPer100 > 3) strengths.push(`Winrate ganador sólido (${hud.bbPer100} bb/100 reales).`);
  if (hud.wsd >= 51) strengths.push(`Buena selección de manos en Showdown (${hud.wsd}% W$SD).`);
  if (strongPos) strengths.push(`Mejor silla rentable: ${strongPos.pos} (${strongPos.bbPer100} bb/100).`);
  if (strengths.length === 0) strengths.push('Base de datos lista para optimización de rangos preflop y C-bet.');

  const leaks: string[] = [];
  if (hud.vpip - hud.pfr > 7) leaks.push(`Gap VPIP-PFR amplio (${Math.round((hud.vpip - hud.pfr) * 10) / 10}%): exceso de cold-call pasivo.`);
  if (hud.foldToThreeBet > 62) leaks.push(`Fold to 3-Bet alto (${hud.foldToThreeBet}%): vulnerable a 3-bets light.`);
  if (hud.bbFoldVsSteal > 64) leaks.push(`BB Fold vs Steal elevado (${hud.bbFoldVsSteal}%): defiendes poco tu Big Blind.`);
  if (weakPos && weakPos.bbPer100 < -15) leaks.push(`Pérdida acentuada en ${weakPos.pos} (${weakPos.bbPer100} bb/100).`);
  if (leaks.length === 0) leaks.push('Estadísticas equilibradas; enfócate en botes 3-Bet y botes Multiway.');

  const improvementPlan: ImprovementPlanItem[] = [];
  if (hud.foldToThreeBet > 60) {
    improvementPlan.push({
      id: 't2-3bet-def',
      priority: 'Alta',
      area: 'Defensa vs 3-Bet IP/OOP',
      problem: `Fold to 3-Bet de ${hud.foldToThreeBet}% (óptimo 48%–58%).`,
      actionStep: 'Entrena Botes 3-Bet OOP/IP para aprender qué manos deben pagar y cuáles 4-betear.',
      drillPos: 'BTN',
      drillScenario: '3BET_IP'
    });
  }
  if (weakPos) {
    improvementPlan.push({
      id: 't2-weak-pos',
      priority: 'Alta',
      area: `Posición ${weakPos.pos}`,
      problem: `Winrate de ${weakPos.bbPer100} bb/100 en ${weakPos.hands} manos desde ${weakPos.pos}.`,
      actionStep: `Lanza un drill dirigido exclusivamente desde ${weakPos.pos} para ajustar defensa y C-bet.`,
      drillPos: weakPos.pos,
      drillScenario: weakPos.pos === 'BB' ? 'SRP_OOP' : 'SRP_IP'
    });
  }
  improvementPlan.push({
    id: 't2-cbet',
    priority: 'Media',
    area: 'Frecuencia y Sizing de C-Bet',
    problem: `C-Bet actual de ${hud.cbet}% frente a objetivo 55%–68%.`,
    actionStep: 'Refuerza botes SRP en posición para diferenciar boards secos (33%) de conectados (72%).',
    drillPos: 'CO',
    drillScenario: 'SRP_IP'
  });

  return {
    source: 'tracker2_db',
    sourceLabel: `Base TheTracker2: ${dbName}`,
    sampleHands: hands.length,
    estimatedLevel,
    archetype,
    archetypeSummary: summary,
    metrics: {
      vpip: hud.vpip,
      pfr: hud.pfr,
      threeBet: hud.threeBet,
      cbet: hud.cbet,
      wtsd: hud.wtsd,
      wsd: hud.wsd,
      gtoAccuracy: hud.nashPrecisionPct,
      bbPer100: hud.bbPer100
    },
    positionalBreakdown,
    characteristics,
    strengths,
    leaks,
    improvementPlan
  };
}
