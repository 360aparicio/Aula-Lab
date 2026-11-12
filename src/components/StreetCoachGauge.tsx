/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * StreetCoachGauge: IA Coach & Analizador de Decisiones de Calle.
 * Diagnóstico prescriptivo por calle (Preflop, Flop, Turn, River) indicando la acción
 * exacta recomendada (Check, Fold, Bet % pot y BB), con un visualizador 'Action Gauge'
 * y explicación "Paso a Paso para Dummies" (Lógica del Bote, Pot Odds, SPR, Equity Mínima y Perfil del Rival).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../engine/cards';
import { TablePosition } from './HandAndPositionBar';
import { OpponentProfile } from '../engine/preflopMatchups';
import { HandCategory } from '../engine/evaluator';
import { SolverMetaUpdater, SOLVER_META_UPDATE_EVENT } from '../engine/solverMetaUpdater';
import {
  Sparkles,
  Gauge,
  HelpCircle,
  Zap,
  Info,
  Globe
} from 'lucide-react';

export interface StreetCoachProps {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  heroPos: TablePosition;
  villainPos: TablePosition;
  heroCards: [Card, Card] | null;
  boardCards: Card[];
  potSizeBB: number;
  effectiveStackBB: number;
  opponentProfile: OpponentProfile;
  handCategory?: HandCategory | string | null;
  isHeroIP: boolean;
  onApplyAction?: (actionName: string, amountBB: number) => void;
}

export const StreetCoachGauge: React.FC<StreetCoachProps> = ({
  street,
  heroPos,
  villainPos,
  heroCards,
  boardCards,
  potSizeBB,
  effectiveStackBB,
  opponentProfile,
  handCategory,
  isHeroIP
}) => {
  const [metaVersion, setMetaVersion] = useState(0);

  useEffect(() => {
    const onMetaUpdate = () => setMetaVersion(v => v + 1);
    window.addEventListener(SOLVER_META_UPDATE_EVENT, onMetaUpdate);
    return () => window.removeEventListener(SOLVER_META_UPDATE_EVENT, onMetaUpdate);
  }, []);

  const adaptiveMetaRule = useMemo(() => {
    void metaVersion;
    return SolverMetaUpdater.getInstance().getAdaptiveRuleForSpot(street);
  }, [street, metaVersion]);

  // Calculate dynamic SPR
  const spr = useMemo(() => {
    if (potSizeBB <= 0) return 10;
    return Number((effectiveStackBB / potSizeBB).toFixed(2));
  }, [effectiveStackBB, potSizeBB]);

  // Prescriptive Coach Decision Logic
  const recommendation = useMemo(() => {
    const pot = Math.max(1, potSizeBB);

    // Heuristics grounded in GTO & Exploitative rules
    const isMonster = handCategory === HandCategory.StraightFlush ||
      handCategory === HandCategory.FourOfAKind ||
      handCategory === HandCategory.FullHouse ||
      handCategory === HandCategory.Flush ||
      handCategory === HandCategory.Straight;

    const isStrong = handCategory === HandCategory.ThreeOfAKind ||
      handCategory === HandCategory.TwoPair ||
      (handCategory === HandCategory.OnePair && (heroCards?.[0].rank === 'A' || heroCards?.[0].rank === 'K'));

    const isMedium = handCategory === HandCategory.OnePair;

    let primaryAction: 'CHECK' | 'BET' | 'CALL' | 'FOLD' = 'CHECK';
    let betPctPot = 0;
    let betBB = 0;
    let confidence = 88;
    let rationaleShort = '';
    let rationaleDummies = '';
    let gaugePosition = 0; // 0 to 100 on gauge scale

    if (street === 'preflop') {
      const isPremium = heroCards && (
        (heroCards[0].rank === heroCards[1].rank && ['A', 'K', 'Q', 'J', 'T'].includes(heroCards[0].rank)) ||
        (heroCards[0].rank === 'A' && ['K', 'Q', 'J'].includes(heroCards[1].rank))
      );
      if (isPremium) {
        primaryAction = 'BET';
        betPctPot = 100;
        betBB = Number((2.5).toFixed(1));
        gaugePosition = 70;
        confidence = 96;
        rationaleShort = 'Subida estándar de apertura (RFI 2.5 BB) o 3-Bet por valor puro.';
        rationaleDummies = 'Tienes una mano monstruo o premium antes del flop. Queremos construir un bote grande de inmediato contra jugadores pasivos y cobrar a las manos peores.';
      } else {
        primaryAction = 'CHECK';
        gaugePosition = 20;
        rationaleShort = 'Línea de cautela: Limp o Check según posición.';
        rationaleDummies = 'Mano marginal o especulativa. No infles el bote fuera de posición; mantén la inversión barata.';
      }
    } else if (street === 'flop') {
      if (isMonster || isStrong) {
        if (opponentProfile === 'fish') {
          primaryAction = 'BET';
          betPctPot = 75;
          betBB = Number((pot * 0.75).toFixed(1));
          gaugePosition = 85;
          confidence = 94;
          rationaleShort = 'Apuesta grande por valor (75% del bote). Explotación máxima contra Calling Station.';
          rationaleDummies = 'Tienes una mano dominante contra un rival Fish que no sabe foldear. No hagas slowplay: apuéstale el 75% del bote para extraer el máximo de fichas.';
        } else {
          primaryAction = 'BET';
          betPctPot = 33;
          betBB = Number((pot * 0.33).toFixed(1));
          gaugePosition = 45;
          confidence = 91;
          rationaleShort = 'C-bet pequeña estándar de GTO (33% del bote). Presión en todo el rango con ventaja de equity.';
          rationaleDummies = 'Una apuesta pequeña de 1/3 del bote ejerce presión barata sobre todo el rango rival, negando equity a cartas overcard y cobrando poco riesgo.';
        }
      } else if (isMedium) {
        primaryAction = 'CHECK';
        gaugePosition = 15;
        confidence = 82;
        rationaleShort = 'Check para control de bote y bluff catching en calles posteriores.';
        rationaleDummies = 'Tienes una mano de valor medio. Si apuestas y te suben, estarás en problemas. Si pasas, controlas el tamaño del bote y dejas que el rival intente farolearte.';
      } else {
        // Farol selectivo o Check
        if (isHeroIP && opponentProfile === 'nit') {
          primaryAction = 'BET';
          betPctPot = 33;
          betBB = Number((pot * 0.33).toFixed(1));
          gaugePosition = 40;
          confidence = 78;
          rationaleShort = 'C-Bet de robo barata (33% pot) explotando el sobre-fold del Nit.';
          rationaleDummies = 'El rival Nit se retira demasiado ante cualquier muestra de agresión. Con 1/3 del bote solo necesitas que foldee un 25% de las veces para ganar fichas gratis.';
        } else {
          primaryAction = 'CHECK';
          gaugePosition = 10;
          confidence = 86;
          rationaleShort = 'Check / Fold prudente. Textura desfavorable sin suficientes proyectos.';
          rationaleDummies = 'No tenemos mano hecha ni proyectos claros. Pasa gratis y no desperdicies fichas.';
        }
      }
    } else if (street === 'turn') {
      if (isMonster) {
        primaryAction = 'BET';
        betPctPot = 75;
        betBB = Number((pot * 0.75).toFixed(1));
        gaugePosition = 85;
        confidence = 95;
        rationaleShort = 'Segunda bala pesada (75% pot) polarizando el rango y construyendo el all-in del river.';
        rationaleDummies = 'El turn es la calle donde se define el bote. Si llevas la mejor mano, carga con fuerza para que el SPR te permita ir all-in cómodamente en el river.';
      } else if (isStrong) {
        primaryAction = 'BET';
        betPctPot = 50;
        betBB = Number((pot * 0.50).toFixed(1));
        gaugePosition = 60;
        confidence = 88;
        rationaleShort = 'Apuesta media de protección (50% pot) cobrando caro a proyectos de color/escalera.';
        rationaleDummies = 'Protege tu mano hecha. Un tamaño de medio bote hace que los proyectos del rival paguen un precio matemáticamente incorrecto.';
      } else {
        primaryAction = 'CHECK';
        gaugePosition = 15;
        confidence = 85;
        rationaleShort = 'Check de control. La textura del turn no permite faroles sin blockers.';
        rationaleDummies = 'Mantén la calma. Pasar es gratis y te permite ver el river sin arriesgar tu stack.';
      }
    } else {
      // River
      if (isMonster) {
        if (spr <= 1.8) {
          primaryAction = 'BET';
          betPctPot = 100;
          betBB = Number(effectiveStackBB.toFixed(1));
          gaugePosition = 98;
          confidence = 98;
          rationaleShort = 'All-in directo por valor en River. SPR ultra bajo de compromiso total.';
          rationaleDummies = '¡El bote es gigante y tu mano es indestructible! Empuja todo tu stack al centro: el rival pagará con sus mejores segundos lugares.';
        } else {
          primaryAction = 'BET';
          betPctPot = 75;
          betBB = Number((pot * 0.75).toFixed(1));
          gaugePosition = 85;
          confidence = 92;
          rationaleShort = 'Apuesta pesada de valor (75% pot) apuntando a pagar de top pairs y dobles.';
          rationaleDummies = 'Extrae el máximo antes del showdown. Un 75% del bote maximiza la ganancia esperada contra el rango que llegó hasta el final.';
        }
      } else if (isStrong) {
        primaryAction = 'BET';
        betPctPot = 33;
        betBB = Number((pot * 0.33).toFixed(1));
        gaugePosition = 45;
        confidence = 84;
        rationaleShort = 'Apuesta fina de bloqueo/valor (Block bet 33% pot).';
        rationaleDummies = 'Pon tu propio precio barato. Apuestas poco para cobrar a manos peores e impides que el rival te apueste un tamaño enorme.';
      } else if (isMedium) {
        primaryAction = 'CHECK';
        gaugePosition = 20;
        confidence = 90;
        rationaleShort = 'Check-Showdown. Mano de valor de showdown que no puede apostar por valor.';
        rationaleDummies = 'Pasa para ir directamente a enseñar las cartas (showdown). Si apuestas, solo te pagarán manos mejores que la tuya.';
      } else {
        primaryAction = 'CHECK';
        gaugePosition = 5;
        confidence = 93;
        rationaleShort = 'Rendición / Check-Fold. No intentes faroles suicidas sin blockers de nuts.';
        rationaleDummies = 'No te quemes los dedos. Rendirse a tiempo es la decisión más rentable a largo plazo en el póker.';
      }
    }

    return {
      primaryAction,
      betPctPot,
      betBB,
      confidence,
      gaugePosition,
      rationaleShort,
      rationaleDummies
    };
  }, [street, potSizeBB, effectiveStackBB, opponentProfile, handCategory, heroCards, isHeroIP, spr]);

  // Pot Odds calculation helper for Dummies
  const potOddsTable = useMemo(() => {
    return [
      { size: '33% Pot', cost: '1/3 Pot', reqEquity: '20.0%', ratio: '4:1', dummyRule: 'Necesitas ganar 1 de cada 5 veces' },
      { size: '50% Pot', cost: '1/2 Pot', reqEquity: '25.0%', ratio: '3:1', dummyRule: 'Necesitas ganar 1 de cada 4 veces' },
      { size: '75% Pot', cost: '3/4 Pot', reqEquity: '30.0%', ratio: '2.3:1', dummyRule: 'Necesitas ganar ~1 de cada 3.3 veces' },
      { size: '100% Pot', cost: 'Bote Entero', reqEquity: '33.3%', ratio: '2:1', dummyRule: 'Necesitas ganar 1 de cada 3 veces' }
    ];
  }, []);

  return (
    <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl p-5 shadow-xl space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-gradient-to-br from-amber-500/20 to-emerald-500/20 rounded-xl border border-amber-500/30 text-amber-300">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              IA Coach & Analizador de Decisiones
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-neutral-800 text-emerald-400 border border-emerald-900 font-semibold">
                Calle: {street.toUpperCase()}
              </span>
            </h3>
            <p className="text-xs text-neutral-400">
              Diagnóstico prescriptivo GTO & Explotativo en tiempo real
            </p>
          </div>
        </div>

        {/* Action Badge */}
        <div className="flex items-center gap-2 bg-neutral-950 px-3.5 py-1.5 rounded-xl border border-neutral-800">
          <span className="text-xs text-neutral-400">Acción Sugerida:</span>
          <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded-md ${
            recommendation.primaryAction === 'BET'
              ? 'bg-emerald-500 text-neutral-950 font-extrabold shadow-sm'
              : recommendation.primaryAction === 'CHECK'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
              : 'bg-red-500/20 text-red-300 border border-red-500/30'
          }`}>
            {recommendation.primaryAction} {recommendation.primaryAction === 'BET' ? `${recommendation.betPctPot}% (${recommendation.betBB} BB)` : ''}
          </span>
        </div>
      </div>

      {/* Main Grid: Action Gauge on Left, Prescription on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Left Column: Visual Action Gauge (4 Cols) */}
        <div className="lg:col-span-5 flex flex-col items-center justify-center p-4 bg-neutral-950/60 rounded-xl border border-neutral-800">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-neutral-300 uppercase tracking-wide mb-3">
            <Gauge className="w-4 h-4 text-emerald-400" />
            <span>Action Gauge (Medidor de Sizing)</span>
          </div>

          {/* SVG Gauge Graphic */}
          <div className="relative w-56 h-32 flex items-center justify-center">
            <svg viewBox="0 0 200 110" className="w-full h-full">
              {/* Background Arc: Check/Fold -> Small Bet -> Medium Bet -> Large Bet -> All-in */}
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />    {/* Check/Fold (Blue) */}
                  <stop offset="35%" stopColor="#10b981" />   {/* Bet 33% (Green) */}
                  <stop offset="65%" stopColor="#f59e0b" />   {/* Bet 75% (Amber) */}
                  <stop offset="100%" stopColor="#ef4444" />  {/* All-in (Red) */}
                </linearGradient>
              </defs>

              {/* Base Track */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="#262626"
                strokeWidth="16"
                strokeLinecap="round"
              />

              {/* Colored Gradient Track */}
              <path
                d="M 20 100 A 80 80 0 0 1 180 100"
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                opacity="0.85"
              />

              {/* Tick Marks & Labels */}
              <text x="18" y="108" fill="#9ca3af" fontSize="9" fontFamily="monospace" textAnchor="middle">CHECK</text>
              <text x="65" y="42" fill="#34d399" fontSize="9" fontFamily="monospace" textAnchor="middle">33%</text>
              <text x="100" y="24" fill="#fbbf24" fontSize="9" fontFamily="monospace" textAnchor="middle">75%</text>
              <text x="182" y="108" fill="#f87171" fontSize="9" fontFamily="monospace" textAnchor="middle">ALL-IN</text>

              {/* Needle based on gaugePosition (0 to 100) */}
              {(() => {
                const angleDeg = -180 + (recommendation.gaugePosition / 100) * 180;
                const rad = (angleDeg * Math.PI) / 180;
                const needleLength = 65;
                const nx = 100 + needleLength * Math.cos(rad);
                const ny = 100 + needleLength * Math.sin(rad);

                return (
                  <>
                    <line
                      x1="100"
                      y1="100"
                      x2={nx}
                      y2={ny}
                      stroke="#ffffff"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                    <circle cx="100" cy="100" r="7" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                  </>
                );
              })()}
            </svg>
          </div>

          <div className="mt-2 text-center">
            <span className="text-xs font-mono text-neutral-400">
              Presión Óptima: <strong className="text-emerald-400">{recommendation.gaugePosition}%</strong> de agresividad
            </span>
            <div className="text-[11px] text-neutral-500 mt-0.5">
              Confianza del modelo: <strong>{recommendation.confidence}%</strong>
            </div>
          </div>
        </div>

        {/* Right Column: Prescriptive Advice & Breakdown (7 Cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Main Action Box */}
          <div className="p-4 bg-emerald-950/30 border border-emerald-500/30 rounded-xl">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Zap className="w-4 h-4" />
              <span>Diagnóstico Exacto:</span>
            </div>
            <p className="text-sm font-semibold text-white leading-relaxed">
              {recommendation.rationaleShort}
            </p>
          </div>

          {/* Dummies Breakdown Box */}
          <div className="p-4 bg-neutral-950/70 border border-neutral-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider">
              <HelpCircle className="w-4 h-4" />
              <span>Explicación Paso a Paso para Dummies:</span>
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed font-sans">
              {recommendation.rationaleDummies}
            </p>
          </div>

          {/* Adaptive Meta & Collective Learning Rule */}
          {adaptiveMetaRule && (
            <div className="p-3.5 bg-blue-950/30 border border-blue-800/50 rounded-xl space-y-1">
              <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-blue-300 uppercase tracking-wide">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Meta Solver &amp; Aprendizaje Colectivo: {adaptiveMetaRule.topic}</span>
                </span>
                <span className="font-mono text-[10px] text-cyan-300">
                  {adaptiveMetaRule.sizingPctPot}% Pot · {adaptiveMetaRule.gtoFrequencyPct}% GTO
                </span>
              </div>
              <p className="text-[11px] text-neutral-300 leading-relaxed font-sans">
                {adaptiveMetaRule.exploitativeAdjustment}
              </p>
            </div>
          )}

          {/* Context Pillars Tags */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-neutral-800/80 rounded-lg border border-neutral-700">
              <span className="text-[10px] text-neutral-400 block">Bote / Stack:</span>
              <strong className="text-white font-mono">{potSizeBB} BB / {effectiveStackBB} BB</strong>
            </div>
            <div className="p-2 bg-neutral-800/80 rounded-lg border border-neutral-700">
              <span className="text-[10px] text-neutral-400 block">SPR Actual:</span>
              <strong className={`font-mono ${spr < 2.5 ? 'text-red-400' : spr <= 6.5 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {spr} ({spr < 2.5 ? 'Bajo' : spr <= 6.5 ? 'Medio' : 'Alto'})
              </strong>
            </div>
            <div className="p-2 bg-neutral-800/80 rounded-lg border border-neutral-700">
              <span className="text-[10px] text-neutral-400 block">Posición:</span>
              <strong className="text-white">{isHeroIP ? 'In Position (IP)' : 'Out of Pos (OOP)'}</strong>
            </div>
            <div className="p-2 bg-neutral-800/80 rounded-lg border border-neutral-700">
              <span className="text-[10px] text-neutral-400 block">Perfil Rival:</span>
              <strong className="text-cyan-300 capitalize">{opponentProfile}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Accordion / Cheat Section: Lógica del Bote y Pot Odds para Dummies */}
      <div className="pt-2 border-t border-neutral-800/80">
        <details className="group">
          <summary className="flex items-center justify-between text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer py-1.5 transition-colors">
            <span className="flex items-center gap-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <span>Ver Tabla Rápida de Pot Odds & Equity Mínima Requerida</span>
            </span>
            <span className="text-[10px] text-neutral-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
            {potOddsTable.map((item, idx) => (
              <div key={idx} className="p-3 bg-neutral-950/80 rounded-xl border border-neutral-800 text-xs space-y-1">
                <div className="flex items-center justify-between font-mono font-bold text-white">
                  <span>{item.size}</span>
                  <span className="text-emerald-400">{item.reqEquity}</span>
                </div>
                <div className="text-[11px] text-neutral-400">
                  Ratio: <strong className="text-neutral-200">{item.ratio}</strong>
                </div>
                <p className="text-[10px] text-neutral-500 font-sans italic pt-1 border-t border-neutral-800/60">
                  {item.dummyRule}
                </p>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
};
