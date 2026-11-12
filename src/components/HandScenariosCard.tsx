/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HandScenariosCard: Explorador Dinámico de Todos los Posibles Escenarios de Mi Mano.
 * Analiza la mano exacta de Hero contra el rango del rival según la calle,
 * evaluando respuestas ante Check, Apuesta Pequeña, Apuesta Grande, Check-Raise y Runouts.
 */

import React, { useMemo } from 'react';
import { Card, cardToString, SUIT_SYMBOLS } from '../engine/cards';
import { evaluateCards, HandCategory } from '../engine/evaluator';
import { TablePosition, getPostflopRole } from './HandAndPositionBar';
import { PreflopActionContext } from '../engine/preflopMatchups';
import { NodeStrategyResult } from '../engine/dcfr';
import {
  Sparkles,
  ShieldAlert,
  TrendingUp,
  Target,
  ArrowRight,
  Flame,
  HelpCircle,
  CheckCircle2,
  AlertTriangle,
  Compass,
  Layers
} from 'lucide-react';

interface HandScenariosCardProps {
  heroCards: [Card, Card] | null;
  boardCards: Card[];
  heroPos: TablePosition;
  villainPos: TablePosition;
  preflopAction?: PreflopActionContext;
  street: 'flop' | 'turn' | 'river';
  strategyResult?: NodeStrategyResult | null;
  potChips?: number;
  onAdvanceStreet?: (nextStreet: 'flop' | 'turn' | 'river') => void;
}

export const HandScenariosCard: React.FC<HandScenariosCardProps> = ({
  heroCards,
  boardCards,
  heroPos,
  villainPos,
  preflopAction = 'RFI',
  street,
  strategyResult,
  potChips = 60,
  onAdvanceStreet
}) => {
  const heroRole = getPostflopRole(heroPos, villainPos);

  // Evaluate current hand strength
  const handEval = useMemo(() => {
    if (!heroCards || !boardCards || boardCards.length < 3) return null;
    try {
      return evaluateCards([heroCards[0], heroCards[1], ...boardCards]);
    } catch {
      return null;
    }
  }, [heroCards, boardCards]);

  // Hand classification
  const classification = useMemo(() => {
    if (!handEval) {
      return {
        tier: 'unknown',
        title: 'Mano no seleccionada',
        color: 'text-neutral-400',
        bg: 'bg-neutral-900',
        badge: 'Sin Cartas',
        description: 'Selecciona tus 2 cartas de mano para ver todos los posibles escenarios.'
      };
    }

    const cat = handEval.category;
    if (cat >= HandCategory.FullHouse) {
      return {
        tier: 'monster',
        title: 'Mano Monstruo / Nuts Absolutas',
        color: 'text-amber-400',
        bg: 'bg-amber-950/40 border-amber-500/50',
        badge: '★ Monstruo',
        description: 'Tienes las nuts o una mano virtualmente invencible. El objetivo principal es construir el bote más grande posible (apuestas fuertes y raises).'
      };
    }
    if (cat >= HandCategory.TwoPair) {
      return {
        tier: 'strong-value',
        title: 'Mano de Valor Fuerte',
        color: 'text-emerald-400',
        bg: 'bg-emerald-950/40 border-emerald-500/50',
        badge: 'Valor Fuerte',
        description: 'Mano de valor dominante. Excelente para apostar por valor (66-75% pot) y extraer fichas de top pairs y proyectos del rival.'
      };
    }
    if (cat === HandCategory.OnePair) {
      return {
        tier: 'medium-pair',
        title: 'Mano de Valor Medio / Bluff Catcher',
        color: 'text-cyan-400',
        bg: 'bg-cyan-950/40 border-cyan-500/50',
        badge: 'Showdown Medio',
        description: 'Tienes un par con valor en showdown. Busca controlar el tamaño del bote (check/call) y atrapar faroles sin inflar el pozo innecesariamente.'
      };
    }
    return {
      tier: 'draw-or-air',
      title: 'Proyecto o Aire Puro (Farol Potencial)',
      color: 'text-rose-400',
      bg: 'bg-rose-950/40 border-rose-500/50',
      badge: 'Farol / Semifarol',
      description: 'Sin valor de showdown en este momento. Si tienes proyectos a escalera o color, juega agresivo como semifarol; de lo contrario, pasa y ríndete ante apuestas.'
    };
  }, [handEval]);

  // Calculate scenarios
  const scenarios = useMemo(() => {
    if (!heroCards || !boardCards || boardCards.length < 3) return null;

    const potBB = Math.max(2, Math.round(potChips / 10));
    const smallBetBB = Math.max(1, Math.round(potBB * 0.33));
    const bigBetBB = Math.max(2, Math.round(potBB * 0.75));

    // Scenario 1: Rival checks
    let scenarioCheckTitle = 'Rival pasa (Check)';
    let scenarioCheckAction = '';
    let scenarioCheckDesc = '';
    if (heroRole === 'IP') {
      if (classification.tier === 'monster' || classification.tier === 'strong-value') {
        scenarioCheckAction = 'Apostar 66% - 75% pot (C-Bet de Valor)';
        scenarioCheckDesc = 'Extrae valor máximo del rango de pago del rival antes de que se completen proyectos.';
      } else if (classification.tier === 'medium-pair') {
        scenarioCheckAction = 'Pasar detrás (Check Behind) o C-Bet pequeña (33%)';
        scenarioCheckDesc = 'Controla el bote con valor medio para no aislarte contra las mejores manos del rival.';
      } else {
        scenarioCheckAction = 'C-Bet 33% (Farol de Rango) o Check con aire';
        scenarioCheckDesc = 'Aprovecha la ventaja posicional para robar el bote si el rival tiene rango débil.';
      }
    } else {
      scenarioCheckTitle = 'Hero actúa primero (OOP)';
      if (classification.tier === 'monster' || classification.tier === 'strong-value') {
        scenarioCheckAction = 'Check-Raise o Apuesta 66% pot';
        scenarioCheckDesc = 'Pasa para inducir farol del rival en posición y resubir fuerte.';
      } else {
        scenarioCheckAction = 'Pasar (Check) por defecto';
        scenarioCheckDesc = 'Línea estándar óptima fuera de posición para proteger todo tu rango de defensa.';
      }
    }

    // Scenario 2: Rival bets small (33%)
    let scenarioSmallBetAction = '';
    let scenarioSmallBetDesc = '';
    if (classification.tier === 'monster') {
      scenarioSmallBetAction = 'Subir (Raise a 2.5x - 3x)';
      scenarioSmallBetDesc = 'Construye el bote de inmediato contra el rango amplio del rival.';
    } else if (classification.tier === 'strong-value' || classification.tier === 'medium-pair') {
      scenarioSmallBetAction = 'Pagar (Call) — Pot odds 20%';
      scenarioSmallBetDesc = 'Con 20% de pot odds requeridas, pagar con pares y proyectos es altamente rentable.';
    } else {
      scenarioSmallBetAction = 'Foldear con aire puro / Raise si bloqueas nuts';
      scenarioSmallBetDesc = 'No regales fichas sin equity ni blockers de escalera o color.';
    }

    // Scenario 3: Rival bets big (75%)
    let scenarioBigBetAction = '';
    let scenarioBigBetDesc = '';
    if (classification.tier === 'monster') {
      scenarioBigBetAction = 'Subir All-In o Pagar para atrapar';
      scenarioBigBetDesc = 'Rival se ha polarizado fuertemente; maximiza tu expectativa de fichas.';
    } else if (classification.tier === 'strong-value') {
      scenarioBigBetAction = 'Pagar (Call) — Pot odds 30%';
      scenarioBigBetDesc = 'Tu mano es lo bastante fuerte para aguantar la presión de una apuesta grande.';
    } else if (classification.tier === 'medium-pair') {
      scenarioBigBetAction = 'Evaluar rival: Bluff Catcher puro';
      scenarioBigBetDesc = 'Paga solo si el rival tiene suficiente frecuencia de faroles en su rango; de lo contrario, fold.';
    } else {
      scenarioBigBetAction = 'Fold Inmediato';
      scenarioBigBetDesc = 'Sin mano ni odds favorables, abandonar el bote preserva tu stack.';
    }

    return {
      potBB,
      smallBetBB,
      bigBetBB,
      scenarioCheck: {
        title: scenarioCheckTitle,
        action: scenarioCheckAction,
        desc: scenarioCheckDesc
      },
      scenarioSmall: {
        title: `Rival apuesta pequeño (${smallBetBB} BB · 33% pot)`,
        action: scenarioSmallBetAction,
        desc: scenarioSmallBetDesc
      },
      scenarioBig: {
        title: `Rival apuesta fuerte (${bigBetBB} BB · 75% pot)`,
        action: scenarioBigBetAction,
        desc: scenarioBigBetDesc
      }
    };
  }, [heroCards, boardCards, heroRole, classification, potChips]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 shadow-xl flex flex-col gap-4">
      {/* Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <Compass className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
              <span>Posibles Escenarios de Mi Mano</span>
              {handEval && (
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${classification.color} ${classification.bg}`}>
                  {classification.badge}
                </span>
              )}
            </h3>
            <p className="text-[11px] text-neutral-400">
              Calle actual: <strong className="text-white uppercase">{street}</strong> · Hero en <strong className="text-emerald-400">{heroPos}</strong> ({heroRole}) vs Rival en <strong className="text-rose-400">{villainPos}</strong>
            </p>
          </div>
        </div>

        {/* Hero Hole Cards Visual Preview */}
        {heroCards && (
          <div className="flex items-center gap-1.5 bg-neutral-950 px-3 py-1.5 rounded-xl border border-neutral-800">
            <span className="text-[10px] text-neutral-400 font-mono">Hero:</span>
            {heroCards.map((c, i) => {
              const isRed = c.suit === 'h' || c.suit === 'd';
              return (
                <span
                  key={i}
                  className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800 ${
                    isRed ? 'text-rose-400' : 'text-neutral-100'
                  }`}
                >
                  {c.rank}{SUIT_SYMBOLS[c.suit]}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Hand Diagnosis Banner */}
      {handEval ? (
        <div className={`p-3.5 rounded-xl border ${classification.bg} space-y-1`}>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider ${classification.color} flex items-center gap-1.5`}>
              <Sparkles className="w-3.5 h-3.5" />
              <span>{handEval.description}</span>
            </span>
            <span className="text-[10px] font-mono font-semibold text-neutral-300">
              Categoría: {handEval.categoryName}
            </span>
          </div>
          <p className="text-xs text-neutral-200 leading-relaxed">
            {classification.description}
          </p>
        </div>
      ) : (
        <div className="p-4 bg-neutral-950/60 rounded-xl border border-neutral-800 text-xs text-neutral-400 text-center">
          Introduce tus cartas de mano y el board para activar el análisis exhaustivo de escenarios.
        </div>
      )}

      {/* Action Scenarios Grid */}
      {scenarios && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Scenario 1: Check */}
          <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2 hover:border-emerald-500/40 transition-colors">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                <span>{scenarios.scenarioCheck.title}</span>
              </div>
              <div className="mt-2 text-xs font-bold text-emerald-400">
                {scenarios.scenarioCheck.action}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                {scenarios.scenarioCheck.desc}
              </p>
            </div>
            <div className="pt-2 border-t border-neutral-800/80 text-[10px] font-mono text-neutral-500">
              Escenario de control / iniciativa
            </div>
          </div>

          {/* Scenario 2: Bet Small */}
          <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2 hover:border-emerald-500/40 transition-colors">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                <span>{scenarios.scenarioSmall.title}</span>
              </div>
              <div className="mt-2 text-xs font-bold text-cyan-300">
                {scenarios.scenarioSmall.action}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                {scenarios.scenarioSmall.desc}
              </p>
            </div>
            <div className="pt-2 border-t border-neutral-800/80 text-[10px] font-mono text-emerald-400">
              Pot Odds Requeridas: ~20%
            </div>
          </div>

          {/* Scenario 3: Bet Big */}
          <div className="p-3.5 bg-neutral-950/80 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2 hover:border-emerald-500/40 transition-colors">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                <span>{scenarios.scenarioBig.title}</span>
              </div>
              <div className="mt-2 text-xs font-bold text-rose-300">
                {scenarios.scenarioBig.action}
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                {scenarios.scenarioBig.desc}
              </p>
            </div>
            <div className="pt-2 border-t border-neutral-800/80 text-[10px] font-mono text-rose-400">
              Pot Odds Requeridas: ~30%
            </div>
          </div>
        </div>
      )}

      {/* Street Progression Shortcut */}
      {street !== 'river' && onAdvanceStreet && (
        <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-800 flex items-center justify-between text-xs flex-wrap gap-2">
          <div className="text-neutral-400 text-[11px]">
            ¿Se jugó la acción en el {street.toUpperCase()}? Avanza a la siguiente carta comunitaria:
          </div>
          <button
            type="button"
            onClick={() => onAdvanceStreet(street === 'flop' ? 'turn' : 'river')}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
          >
            <span>Ver Siguiente Calle ({street === 'flop' ? 'El Turn' : 'El River'})</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
