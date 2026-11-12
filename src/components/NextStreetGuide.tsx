/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Next Street Guidance & Runout Playbook Component.
 * Guides the user on how to navigate the upcoming street (Flop -> Turn -> River),
 * breaks down runout archetypes, provides hand category tactical plans,
 * and allows interactive simulation and 1-click advancement to the next street.
 */

import React, { useState, useMemo } from 'react';
import { Card, SUIT_COLORS, SUIT_SYMBOLS, cardToString, cardId, RANKS, SUITS } from '../engine/cards';
import {
  Street,
  buildStreetGuidancePlan,
  analyzeCandidateRunout,
  getCandidateRunoutArchetypes,
  RunoutImpact
} from '../engine/nextStreetGuidance';
import {
  Compass,
  Layers,
  ArrowRight,
  Sparkles,
  Zap,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Play
} from 'lucide-react';

interface NextStreetGuideProps {
  currentStreet: Street;
  boardCards: Card[];
  heroPos: string;
  villainPos: string;
  heroRole: 'IP' | 'OOP';
  nodeHistory: string[];
  heroCards?: [Card, Card] | null;
  onAdvanceStreet?: (nextStreet: Street, newCard: Card) => void;
  compact?: boolean;
}

export const NextStreetGuide: React.FC<NextStreetGuideProps> = ({
  currentStreet,
  boardCards,
  heroPos,
  villainPos,
  heroRole,
  nodeHistory,
  heroCards,
  onAdvanceStreet,
  compact = false
}) => {
  const [activeTab, setActiveTab] = useState<'plan' | 'runouts' | 'hands' | 'simulator'>('plan');

  const plan = useMemo(() => {
    return buildStreetGuidancePlan(
      currentStreet,
      boardCards,
      heroPos,
      villainPos,
      heroRole,
      nodeHistory
    );
  }, [currentStreet, boardCards, heroPos, villainPos, heroRole, nodeHistory]);

  const candidates = useMemo(() => {
    return getCandidateRunoutArchetypes(boardCards);
  }, [boardCards]);

  const [selectedCandidate, setSelectedCandidate] = useState<Card | null>(() => {
    return candidates.length > 0 ? candidates[0].card : null;
  });

  // Calculate runout impact
  const runoutImpact: RunoutImpact | null = useMemo(() => {
    if (!selectedCandidate) return null;
    return analyzeCandidateRunout(
      boardCards,
      selectedCandidate,
      heroCards,
      heroRole,
      heroRole === 'IP' // Preflop aggressor estimate
    );
  }, [boardCards, selectedCandidate, heroCards, heroRole]);

  const nextStreetName =
    currentStreet === 'flop' ? 'Turn' : currentStreet === 'turn' ? 'River' : 'Showdown';

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4 text-xs shadow-lg">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span>Guía Táctica: ¿Qué hacer en el {nextStreetName.toUpperCase()}?</span>
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-950 border border-emerald-800/60 text-emerald-300">
                {currentStreet.toUpperCase()} ➔ {nextStreetName.toUpperCase()}
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Plan estratégico ideal, texturas de runouts y adaptación de líneas según la siguiente carta.
            </p>
          </div>
        </div>

        {/* Action Line Pill */}
        <div className="flex items-center gap-2 bg-neutral-950 px-3 py-1.5 rounded-lg border border-neutral-800 text-[11px] font-mono text-neutral-300 shrink-0">
          <span className="text-neutral-500">Línea:</span>
          <span className="text-emerald-400 font-semibold">
            {nodeHistory.length > 0 ? nodeHistory.slice(-2).join(' ➔ ') : 'Raíz'}
          </span>
          <span className="text-neutral-600">|</span>
          <span className={heroRole === 'IP' ? 'text-cyan-400' : 'text-amber-400'}>
            Hero {heroPos} ({heroRole})
          </span>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('plan')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors whitespace-nowrap ${
            activeTab === 'plan'
              ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Estrategia & Rango</span>
        </button>

        <button
          onClick={() => setActiveTab('runouts')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors whitespace-nowrap ${
            activeTab === 'runouts'
              ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Catálogo de Runouts</span>
        </button>

        <button
          onClick={() => setActiveTab('hands')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors whitespace-nowrap ${
            activeTab === 'hands'
              ? 'bg-neutral-800 text-emerald-400 shadow-sm border border-neutral-700'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Plan por Tipo de Mano</span>
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-xs transition-colors whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'bg-emerald-600 text-white shadow-sm font-bold'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Simulador de Runouts</span>
        </button>
      </div>

      {/* TAB 1: ESTRATEGIA & RANGO */}
      {activeTab === 'plan' && (
        <div className="space-y-4">
          {/* Board Texture & Line Analysis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Textura del Tablero
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-emerald-400 border border-neutral-800">
                  {plan.boardTexture.textureLabel}
                </span>
              </div>
              <p className="text-neutral-300 leading-relaxed">
                {plan.boardTexture.summary}
              </p>
            </div>

            <div className="bg-neutral-950 p-3 rounded-lg border border-neutral-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                  Dinámica de Rangos
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-900 text-cyan-400 border border-neutral-800">
                  {heroRole === 'IP' ? 'Iniciativa en Posición' : 'Defensa Fuera de Posición'}
                </span>
              </div>
              <p className="text-neutral-300 leading-relaxed">
                {plan.rangeAdvantage}
              </p>
            </div>
          </div>

          {/* Core Objectives List */}
          <div className="bg-neutral-950/80 p-3.5 rounded-lg border border-neutral-800/80 space-y-2">
            <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Objetivos Clave para la Siguiente Calle ({nextStreetName}):</span>
            </div>
            <ul className="space-y-1.5 text-neutral-300">
              {plan.coreObjectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold shrink-0">{i + 1}.</span>
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* TAB 2: CATÁLOGO DE RUNOUTS */}
      {activeTab === 'runouts' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {plan.runoutCategories.map((rc, idx) => (
            <div
              key={idx}
              className="bg-neutral-950 p-3.5 rounded-xl border border-neutral-800 flex flex-col justify-between gap-2.5 hover:border-neutral-700 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-white text-xs">{rc.title}</h4>
                  <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 px-1.5 py-0.5 rounded border border-neutral-800">
                    {rc.exampleCards}
                  </span>
                </div>
                <p className="text-neutral-400 text-[11px] leading-relaxed">
                  {rc.description}
                </p>
                <div className="pt-1.5 border-t border-neutral-900">
                  <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-0.5">
                    Plan Táctico Ideal:
                  </div>
                  <p className="text-neutral-200 text-[11px] leading-relaxed">
                    {rc.heroStrategy}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-neutral-900 text-[10px] text-neutral-400">
                <span>Sizing recomendado:</span>
                <span className="font-bold text-emerald-400 font-mono">{rc.recommendedSizing}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 3: PLAN POR TIPO DE MANO */}
      {activeTab === 'hands' && (
        <div className="space-y-2">
          {plan.tacticalHandMatrix.map((item, idx) => (
            <div
              key={idx}
              className="bg-neutral-950 p-3 rounded-xl border border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-neutral-700 transition-colors"
            >
              <div className="space-y-0.5 max-w-md">
                <div className="font-bold text-white text-xs">{item.categoryName}</div>
                <div className="text-[11px] text-neutral-400">{item.handsDescription}</div>
                <div className="text-[11px] text-neutral-300 italic pt-1">{item.reasoning}</div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
                    Acción Recomendada
                  </div>
                  <div className="font-bold text-emerald-400 text-xs">{item.action}</div>
                  <div className="text-[10px] text-neutral-400 font-mono">Sizing: {item.sizing}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 4: SIMULADOR DE RUNOUTS */}
      {activeTab === 'simulator' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
              Selecciona o Simula una Carta para el {nextStreetName}:
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {candidates.map((cand, i) => {
                const isSelected = selectedCandidate?.id === cand.card.id;
                const suitColor = SUIT_COLORS[cand.card.suit];
                return (
                  <button
                    key={i}
                    onClick={() => setSelectedCandidate(cand.card)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition-all ${
                      isSelected
                        ? 'bg-neutral-800 border-emerald-500 text-white shadow-md'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-medium text-neutral-400">{cand.label}</div>
                      <div className="text-xs font-bold text-white flex items-center gap-1 font-mono">
                        <span>{cand.card.rank}</span>
                        <span className={suitColor.text}>{SUIT_SYMBOLS[cand.card.suit]}</span>
                      </div>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Runout Impact Detailed Card */}
          {runoutImpact && (
            <div className="bg-neutral-950 p-4 rounded-xl border border-emerald-900/40 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-neutral-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-11 bg-neutral-900 border border-neutral-700 rounded flex flex-col items-center justify-center font-bold text-sm">
                    <span>{runoutImpact.card.rank}</span>
                    <span className={SUIT_COLORS[runoutImpact.card.suit].text}>
                      {SUIT_SYMBOLS[runoutImpact.card.suit]}
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">{runoutImpact.categoryTitle}</h4>
                    <p className="text-[11px] text-neutral-400">{runoutImpact.favorsExplanation}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded text-[11px] font-bold ${
                      runoutImpact.favorsRole === 'HERO'
                        ? 'bg-emerald-950 border border-emerald-800 text-emerald-400'
                        : runoutImpact.favorsRole === 'VILLAIN'
                        ? 'bg-rose-950 border border-rose-800 text-rose-400'
                        : 'bg-neutral-900 border border-neutral-800 text-neutral-400'
                    }`}
                  >
                    {runoutImpact.favorsRole === 'HERO'
                      ? 'Favorable a Hero'
                      : runoutImpact.favorsRole === 'VILLAIN'
                      ? 'Favorable a Villano'
                      : 'Impacto Neutral'}
                  </span>
                </div>
              </div>

              {/* Hand Evaluation Change if Hero has cards */}
              {runoutImpact.heroHandBefore && runoutImpact.heroHandAfter && (
                <div className="p-2.5 bg-neutral-900/60 rounded-lg border border-neutral-800 text-[11px] space-y-1">
                  <div className="text-neutral-400 font-medium">Evolución de tu Mano (Hero):</div>
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-400">{runoutImpact.heroHandBefore}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <span className="font-bold text-emerald-400">{runoutImpact.heroHandAfter}</span>
                  </div>
                </div>
              )}

              {/* Tactical Recommendations */}
              <div className="space-y-1.5">
                <div className="text-[11px] font-bold text-neutral-300">Plan de Acción Recomendado:</div>
                <p className="text-neutral-200 text-xs leading-relaxed bg-neutral-900 p-2.5 rounded-lg border border-neutral-800">
                  {runoutImpact.tacticalAdvice}
                </p>
              </div>

              {/* Action & Sizing Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800">
                  <div className="text-[10px] text-neutral-500 font-medium">Acción Principal</div>
                  <div className="font-bold text-emerald-400 text-xs font-mono">
                    {runoutImpact.recommendedAction}
                  </div>
                </div>
                <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800">
                  <div className="text-[10px] text-neutral-500 font-medium">Tamaño Sugerido</div>
                  <div className="font-bold text-cyan-400 text-xs font-mono">
                    {runoutImpact.recommendedBetSize}
                  </div>
                </div>
                <div className="p-2 bg-neutral-900 rounded-lg border border-neutral-800 col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-neutral-500 font-medium">Frecuencia Ideal</div>
                  <div className="font-bold text-amber-400 text-xs font-mono">
                    {runoutImpact.recommendedFrequencies.bet}% Bet / {runoutImpact.recommendedFrequencies.check}% Check
                  </div>
                </div>
              </div>

              {/* 1-Click Advance Street Button */}
              {onAdvanceStreet && currentStreet !== 'river' && (
                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (selectedCandidate) {
                        onAdvanceStreet(nextStreetName.toLowerCase() as Street, selectedCandidate);
                      }
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>
                      Aplicar {runoutImpact.card.rank}
                      {SUIT_SYMBOLS[runoutImpact.card.suit]} al Tablero y Avanzar al {nextStreetName}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
