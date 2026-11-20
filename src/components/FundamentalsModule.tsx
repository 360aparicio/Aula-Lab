/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FundamentalsModule: Módulo 0 — Fundamentos Interactivos & Misiones Diarias.
 * Pensado para jugadores nuevos y recreativos que quieren entender:
 * 1. Duelo interactivo de jerarquía de manos (evaluado en vivo con evaluateCards).
 * 2. Mapa de rentabilidad por asiento en mesa 6-Max (por qué BTN gana y BB/SB sangran).
 * 3. Calculadora visual interactiva de Pot Odds & Equity necesaria.
 * 4. Misiones Diarias & Racha de Estudio.
 */

import React, { useMemo, useState } from 'react';
import { Card, cardToString, FULL_DECK, parseCard, SUIT_SYMBOLS } from '../engine/cards';
import { PlayingCard } from './PlayingCard';
import { compareHands, evaluateCards, HandCategory } from '../engine/evaluator';
import {
  loadDailyMissions,
  incrementMissionProgress,
  type ExperienceLevel,
  EXPERIENCE_LEVEL_META
} from '../lib/experienceMode';
import { PokerGlossaryTip } from './PokerGlossaryTip';
import { WeeklyLeaksRadarCard } from './OnboardingAndLeaksBar';
import type { SimPosition, SimScenarioType } from '../engine/handSimulator';
import { fisherYatesShuffle } from '../lib/random';
import {
  Award,
  CheckCircle2,
  Compass,
  Flame,
  HelpCircle,
  Layers,
  Percent,
  Play,
  Shuffle,
  Sparkles,
  Trophy,
  XCircle
} from 'lucide-react';

interface FundamentalsModuleProps {
  experienceLevel: ExperienceLevel;
  onStartTrainer: () => void;
  onStartEvaluation: () => void;
  onLaunchDrill?: (pos: SimPosition | 'RANDOM', scenario: SimScenarioType | 'RANDOM') => void;
}

interface RankingDuelScenario {
  id: string;
  board: string[];
  handA: [string, string];
  handB: [string, string];
  lesson: string;
}

const RANKING_DUELS: RankingDuelScenario[] = [
  {
    id: 'duel-1',
    board: ['As', 'Ks', '8d', '4c', '2h'],
    handA: ['Ah', 'Qd'],
    handB: ['Kd', 'Kc'],
    lesson: 'Un Trío (Set de Reyes) vence siempre a Top Pair (Par de Ases con Q). No te enamores solo de tener el As.'
  },
  {
    id: 'duel-2',
    board: ['Qh', 'Jh', '9s', '5h', '2c'],
    handA: ['Ah', '3h'],
    handB: ['Qs', 'Qd'],
    lesson: 'El Color (Flush con dos corazones) derrota al Trío de Damas. Siempre vigila cuando hay 3 cartas del mismo palo.'
  },
  {
    id: 'duel-3',
    board: ['Ts', '9d', '8c', '7h', '2s'],
    handA: ['Js', '4d'],
    handB: ['Ac', 'As'],
    lesson: 'Una Escalera (7-8-9-T-J) gana al Par de Ases (AA). Con 4 cartas conectadas en la mesa, un solo Par pierde mucho valor.'
  },
  {
    id: 'duel-4',
    board: ['Kd', 'Kh', '7c', '7s', '3d'],
    handA: ['Ks', '2c'],
    handB: ['Ah', 'Ac'],
    lesson: 'Full House (KKK-77) aplasta a Doble Pareja (AA-77). Cuando la mesa está doblada, los tríos se convierten en Full.'
  },
  {
    id: 'duel-5',
    board: ['Ac', 'Jd', '8s', '4h', '2d'],
    handA: ['As', 'Th'],
    handB: ['Ah', 'Qh'],
    lesson: 'Ambos tienen Par de Ases, pero AQ gana por mejor Kicker (Q vence a T). Cuidado con pagar 3 calles con As-kicker débil.'
  }
];

const CATEGORY_ES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'Carta Alta',
  [HandCategory.OnePair]: 'Un Par',
  [HandCategory.TwoPair]: 'Doble Pareja',
  [HandCategory.ThreeOfAKind]: 'Trío / Set',
  [HandCategory.Straight]: 'Escalera',
  [HandCategory.Flush]: 'Color (Flush)',
  [HandCategory.FullHouse]: 'Full House',
  [HandCategory.FourOfAKind]: 'Poker (Quad)',
  [HandCategory.StraightFlush]: 'Escalera de Color'
};

function generateRandomDuel(seq: number): RankingDuelScenario {
  const deck = fisherYatesShuffle(FULL_DECK);
  const boardCards = deck.slice(0, 5);
  const aCards = deck.slice(5, 7);
  const bCards = deck.slice(7, 9);

  const evalA = evaluateCards([...aCards, ...boardCards]);
  const evalB = evaluateCards([...bCards, ...boardCards]);
  const cmp = compareHands(aCards, bCards, boardCards);
  const winnerEval = cmp >= 0 ? evalA : evalB;
  const loserEval = cmp >= 0 ? evalB : evalA;

  let lesson = '';
  if (cmp === 0) {
    lesson = `Empate exacto (Split Pot): ambos forman la misma mejor jugada de 5 cartas (${CATEGORY_ES[evalA.category]}). El bote se reparte 50/50.`;
  } else if (winnerEval.category > loserEval.category) {
    lesson = `${CATEGORY_ES[winnerEval.category]} vence siempre a ${CATEGORY_ES[loserEval.category]}. Revisa primero si el board permite escaleras, colores o full antes de sobrevalorar tu mano.`;
  } else {
    lesson = `Misma categoría (${CATEGORY_ES[winnerEval.category]}), pero desempata la carta más alta / Kicker (${winnerEval.description} supera a ${loserEval.description}).`;
  }

  return {
    id: `rnd-${seq}-${Date.now()}`,
    board: boardCards.map(cardToString),
    handA: [cardToString(aCards[0]), cardToString(aCards[1])],
    handB: [cardToString(bCards[0]), cardToString(bCards[1])],
    lesson
  };
}

const SEAT_PROFITABILITY_GUIDE: Array<{
  pos: string;
  title: string;
  openRangePct: string;
  expectation: string;
  colorClass: string;
  advice: string;
}> = [
  {
    pos: 'UTG / EP',
    title: 'Primera Posición (Asiento Peligroso)',
    openRangePct: '15% – 18% de manos',
    expectation: 'Moderada (+10 a +18 bb/100)',
    colorClass: 'border-amber-500/40 text-amber-300',
    advice: 'Todavía quedan 5 rivales por hablar detrás de ti. Juega solo cartas sólidas: pares altos, broadways suited y Ases fuertes.'
  },
  {
    pos: 'MP',
    title: 'Posición Media',
    openRangePct: '20% – 22% de manos',
    expectation: 'Positiva (+15 a +24 bb/100)',
    colorClass: 'border-blue-500/40 text-blue-300',
    advice: 'Puedes añadir pares medianos (55+) y suited connectors fuertes (T9s, 98s) si nadie abrió antes.'
  },
  {
    pos: 'CO',
    title: 'Cutoff (Antes del Botón)',
    openRangePct: '28% – 32% de manos',
    expectation: 'Alta (+25 a +35 bb/100)',
    colorClass: 'border-cyan-500/40 text-cyan-300',
    advice: 'Muy rentable para robar ciegas. Si nadie subió antes, abre Ax suited, Kxs buenos y conectores.'
  },
  {
    pos: 'BTN',
    title: 'Button / Dealer (El Rey de la Mesa)',
    openRangePct: '42% – 48% de manos',
    expectation: 'Máxima (+38 a +55 bb/100)',
    colorClass: 'border-emerald-500/50 text-emerald-400',
    advice: 'Siempre actúas último después del flop. Aquí es donde debes imprimir dinero jugando agresivo y robando botes.'
  },
  {
    pos: 'SB',
    title: 'Ciega Pequeña (Asiento Trampa)',
    openRangePct: 'Paga muy poco · 3-Bet o Fold',
    expectation: 'Negativa (-12 a -18 bb/100)',
    colorClass: 'border-rose-500/40 text-rose-300',
    advice: 'Jugarás SIEMPRE sin posición (OOP) y además queda BB detrás para hacer Squeeze. Evita hacer call pasivo aquí.'
  },
  {
    pos: 'BB',
    title: 'Ciega Grande (Descuento Matemático)',
    openRangePct: 'Defiende amplio vs BTN/CO',
    expectation: 'Negativa controlada (-25 a -35 bb/100)',
    colorClass: 'border-rose-500/40 text-rose-300',
    advice: 'Como ya pusiste 1 BB obligatoria, necesitas menos equity para pagar subidas pequeñas (2x-2.5x). Objetivo: perder menos de -35 bb/100.'
  }
];

function MiniCardChip({ card }: { card: Card }) {
  return <PlayingCard card={card} size="sm" />;
}

export const FundamentalsModule: React.FC<FundamentalsModuleProps> = ({
  experienceLevel,
  onStartTrainer,
  onStartEvaluation,
  onLaunchDrill
}) => {
  const [duelDeck, setDuelDeck] = useState<RankingDuelScenario[]>(() => fisherYatesShuffle(RANKING_DUELS));
  const [duelIdx, setDuelIdx] = useState(0);
  const [customDuel, setCustomDuel] = useState<RankingDuelScenario | null>(null);
  const [duelGuess, setDuelGuess] = useState<'A' | 'B' | null>(null);
  const [selectedSeatPos, setSelectedSeatPos] = useState<string>('BTN');
  const [potBB, setPotBB] = useState<number>(10);
  const [betBB, setBetBB] = useState<number>(5);
  const [missionsState, setMissionsState] = useState(() => loadDailyMissions());

  const activeDuel = customDuel || duelDeck[duelIdx % duelDeck.length];

  const duelEval = useMemo(() => {
    const board = activeDuel.board.map(parseCard);
    const aCards = activeDuel.handA.map(parseCard);
    const bCards = activeDuel.handB.map(parseCard);
    const evalA = evaluateCards([...aCards, ...board]);
    const evalB = evaluateCards([...bCards, ...board]);
    const cmp = compareHands(aCards, bCards, board);
    return {
      board,
      aCards,
      bCards,
      evalA,
      evalB,
      winner: cmp > 0 ? 'A' : cmp < 0 ? 'B' : 'TIE'
    };
  }, [activeDuel]);

  const handleDuelGuess = (pick: 'A' | 'B') => {
    setDuelGuess(pick);
    const updated = incrementMissionProgress('m-fund', 1);
    setMissionsState(updated);
  };

  const handleNextDuel = () => {
    setCustomDuel(null);
    if (duelIdx + 1 >= duelDeck.length) {
      const currentId = duelDeck[duelIdx]?.id;
      const reshuffled = fisherYatesShuffle(RANKING_DUELS);
      if (reshuffled.length > 1 && reshuffled[0].id === currentId) {
        [reshuffled[0], reshuffled[reshuffled.length - 1]] = [reshuffled[reshuffled.length - 1], reshuffled[0]];
      }
      setDuelDeck(reshuffled);
      setDuelIdx(0);
    } else {
      setDuelIdx(prev => prev + 1);
    }
    setDuelGuess(null);
  };

  const handleRandomDuel = () => {
    setCustomDuel(generateRandomDuel(Date.now()));
    setDuelGuess(null);
  };

  const activeSeat = SEAT_PROFITABILITY_GUIDE.find(s => s.pos === selectedSeatPos) || SEAT_PROFITABILITY_GUIDE[3];

  const betPctOfPot = potBB > 0 ? Math.round((betBB / potBB) * 100) : 0;
  const requiredEquityPct = potBB + betBB > 0 ? Math.round((betBB / (potBB + betBB * 2)) * 1000) / 10 : 0;
  const mdfPct = potBB + betBB > 0 ? Math.round((potBB / (potBB + betBB)) * 1000) / 10 : 100;
  const outsNeededApprox = Math.max(1, Math.min(20, Math.round(requiredEquityPct / 4)));

  return (
    <div className="space-y-7">
      {/* HEADER + DAILY MISSIONS STRIP */}
      <div className="bg-neutral-900/55 border border-neutral-800/80 rounded-2xl p-6 sm:p-7 shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.03] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-blue-400">
            <Compass className="w-4 h-4" />
            <span>Módulo 0 · Academia Visual de Fundamentos 6-Max</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Domina las Bases Antes de Apostar una Sola Ciega
          </h1>
          <p className="text-xs sm:text-sm text-neutral-400 max-w-2xl leading-relaxed">
            Modo activo:{' '}
            <strong className="text-blue-300">{EXPERIENCE_LEVEL_META[experienceLevel].label}</strong>. Aquí entiendes
            quién gana en cada mano, por qué la posición manda y cuánta{' '}
            <PokerGlossaryTip term="MDF" label="defensa" /> o Pot Odds necesitas en segundos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onStartTrainer}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm shadow-black/30 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Practicar en Mesa 6-Max</span>
          </button>
          <button
            type="button"
            onClick={onStartEvaluation}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>Evaluar Nivel (NL2+)</span>
          </button>
        </div>
      </div>

      {/* DAILY MISSIONS & STREAK */}
      <div className="bg-neutral-900/55 border border-neutral-800/80 rounded-2xl p-6 shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.03] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold tracking-tight text-white">Misiones Diarias de Progreso</h2>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
            <span className="flex items-center gap-1.5 text-amber-300 font-bold">
              <Flame className="w-4 h-4" />
              <span>Racha: {missionsState.streakDays} día(s)</span>
            </span>
            <span className="text-neutral-400">
              Mejor récord: <strong className="text-white">{Math.max(missionsState.bestStreakDays || 1, missionsState.streakDays)} d</strong>
            </span>
            <span className="text-emerald-400 font-bold">
              {missionsState.missions.filter(m => m.completed).length}/{missionsState.missions.length} completadas
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {missionsState.missions.map(m => {
            const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
            return (
              <div
                key={m.id}
                className={`p-3.5 rounded-xl border space-y-2 ${
                  m.completed ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-black border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-white">{m.title}</span>
                  {m.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <span className="font-mono text-amber-300 tabular-nums">+25 XP</span>
                  )}
                </div>
                <p className="text-[11px] text-neutral-400">{m.detail}</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-neutral-900 overflow-hidden">
                    <div
                      style={{ width: `${pct}%` }}
                      className={`h-full ${m.completed ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    />
                  </div>
                  <span className="text-[11px] font-mono tabular-nums text-neutral-300">
                    {m.progress}/{m.target}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* GRID: LAB 1 (HAND DUEL) + LAB 2 (POT ODDS SLIDER) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LAB 1: INTERACTIVE HAND RANKING DUEL */}
        <div className="lg:col-span-6 bg-neutral-900/55 border border-neutral-800/80 rounded-2xl p-6 shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.03] space-y-5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <span>Lab 1: ¿Quién Gana esta Mano al Showdown?</span>
              </h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Haz clic en la mano ganadora usando las 5 cartas comunitarias.
              </p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={handleRandomDuel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-semibold text-blue-200 cursor-pointer whitespace-nowrap"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>Duelo Aleatorio</span>
              </button>
              <button
                type="button"
                onClick={handleNextDuel}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-200 cursor-pointer whitespace-nowrap"
              >
                <Shuffle className="w-3.5 h-3.5 text-blue-400" />
                <span>Siguiente</span>
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-b from-emerald-950/50 to-black border border-emerald-900/40 flex flex-col items-center gap-2">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400">Board Comunitario</span>
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {duelEval.board.map(c => (
                <MiniCardChip key={c.id} card={c} />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {(
              [
                { side: 'A' as const, label: 'Jugador A', cards: duelEval.aCards, desc: duelEval.evalA.description },
                { side: 'B' as const, label: 'Jugador B', cards: duelEval.bCards, desc: duelEval.evalB.description }
              ] as const
            ).map(opt => {
              const isWinner = duelEval.winner === opt.side;
              const isPicked = duelGuess === opt.side;
              return (
                <button
                  key={opt.side}
                  type="button"
                  onClick={() => handleDuelGuess(opt.side)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer space-y-2.5 ${
                    duelGuess
                      ? isWinner
                        ? 'bg-emerald-950/30 border-emerald-500/60'
                        : isPicked
                        ? 'bg-rose-950/30 border-rose-500/60'
                        : 'bg-black border-neutral-800 opacity-75'
                      : 'bg-black border-neutral-800 hover:border-blue-500'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span>{opt.label}</span>
                    {duelGuess && isWinner && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {duelGuess && isPicked && !isWinner && <XCircle className="w-4 h-4 text-rose-400" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <MiniCardChip card={opt.cards[0]} />
                    <MiniCardChip card={opt.cards[1]} />
                  </div>
                  {duelGuess && <div className="text-[11px] font-mono text-cyan-300">{opt.desc}</div>}
                </button>
              );
            })}
          </div>

          {duelGuess && (
            <div className="p-3.5 rounded-xl bg-black border border-blue-500/40 text-xs text-neutral-200 space-y-1">
              <div className="font-bold text-blue-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>
                  {duelGuess === duelEval.winner
                    ? '¡Exacto! Leíste bien las 5 mejores cartas.'
                    : `Cuidado: ganó el Jugador ${duelEval.winner}.`}
                </span>
              </div>
              <p className="text-neutral-300 leading-relaxed">{activeDuel.lesson}</p>
            </div>
          )}
        </div>

        {/* LAB 2: INTERACTIVE POT ODDS & EQUITY SLIDER */}
        <div className="lg:col-span-6 bg-neutral-900/55 border border-neutral-800/80 rounded-2xl p-6 shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.03] space-y-5">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Percent className="w-4 h-4 text-emerald-400" />
              <span>Lab 2: Simulador Visual de Pot Odds (¿Es Rentable Pagar?)</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Mueve el tamaño del bote y de la apuesta rival para ver qué porcentaje necesitas ganar.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-black border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Bote Actual</span>
                <span className="font-mono font-bold tabular-nums text-white">{potBB} BB</span>
              </div>
              <input
                type="range"
                min={2}
                max={60}
                step={1}
                value={potBB}
                onChange={e => setPotBB(Number(e.target.value))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-black border border-neutral-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-neutral-400">Apuesta del Rival</span>
                <span className="font-mono font-bold tabular-nums text-amber-300">
                  {betBB} BB ({betPctOfPot}% del bote)
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={60}
                step={1}
                value={betBB}
                onChange={e => setBetBB(Number(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-3 rounded-xl bg-black border border-neutral-800">
              <span className="text-[10px] font-mono uppercase text-neutral-500 block">Equity Requerida</span>
              <span className="text-xl font-black font-mono tabular-nums text-emerald-400 mt-1 block">
                {requiredEquityPct}%
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black border border-neutral-800">
              <span className="text-[10px] font-mono uppercase text-neutral-500 block">Outs en Flop (~)</span>
              <span className="text-xl font-black font-mono tabular-nums text-blue-400 mt-1 block">
                {outsNeededApprox} outs
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black border border-neutral-800">
              <span className="text-[10px] font-mono uppercase text-neutral-500 block">
                <PokerGlossaryTip term="MDF" />
              </span>
              <span className="text-xl font-black font-mono tabular-nums text-cyan-300 mt-1 block">{mdfPct}%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-black border border-neutral-800 text-xs text-neutral-300 leading-relaxed space-y-1">
            <div className="font-bold text-white flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
              <span>Traducción Sencilla:</span>
            </div>
            <p>
              Para pagar esta apuesta de <strong className="text-amber-300">{betBB} BB</strong> en un bote de{' '}
              <strong className="text-white">{potBB} BB</strong>, necesitas ganar al menos{' '}
              <strong className="text-emerald-400">{requiredEquityPct}%</strong> de las veces (por ejemplo un proyecto de
              color tiene 9 outs ≈ 35% del flop al river).
            </p>
          </div>
        </div>
      </div>

      {/* LAB 3: 6-MAX POSITIONAL PROFITABILITY MAP */}
      <div className="bg-neutral-900/55 border border-neutral-800/80 rounded-2xl p-6 shadow-sm shadow-black/30 ring-1 ring-inset ring-white/[0.03] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white">
              Lab 3: Mapa de Rentabilidad por Asiento 6-Max (<PokerGlossaryTip term="IP" /> vs{' '}
              <PokerGlossaryTip term="OOP" />)
            </h2>
            <p className="text-xs text-neutral-400 mt-0.5">
              Haz clic en cada asiento de la mesa para entender qué tan amplio abrir y por qué unos asientos ganan más.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
          {SEAT_PROFITABILITY_GUIDE.map(seat => {
            const selected = seat.pos === selectedSeatPos;
            return (
              <button
                key={seat.pos}
                type="button"
                onClick={() => setSelectedSeatPos(seat.pos)}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  selected
                    ? 'bg-blue-950/40 border-blue-500 text-white'
                    : 'bg-black border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-white'
                }`}
              >
                <div className="text-xs font-mono font-bold">{seat.pos}</div>
                <div className="text-[11px] truncate mt-0.5">{seat.openRangePct}</div>
              </button>
            );
          })}
        </div>

        <div className={`p-4 rounded-xl bg-black border ${activeSeat.colorClass} grid grid-cols-1 md:grid-cols-12 gap-4 text-xs`}>
          <div className="md:col-span-4 space-y-1">
            <div className="font-mono uppercase text-[11px] opacity-80">{activeSeat.pos}</div>
            <div className="text-base font-bold text-white">{activeSeat.title}</div>
            <div className="font-mono text-emerald-400 font-semibold">{activeSeat.expectation}</div>
          </div>
          <div className="md:col-span-8 space-y-1.5 text-neutral-200 leading-relaxed">
            <div className="font-semibold text-white">Rango recomendado: {activeSeat.openRangePct}</div>
            <p>{activeSeat.advice}</p>
          </div>
        </div>
      </div>

      {/* RADAR DE FUGAS EN ESPAÑOL CLARO */}
      <WeeklyLeaksRadarCard
        onLaunchDrill={(pos, sc) => {
          if (onLaunchDrill) onLaunchDrill(pos, sc);
          else onStartTrainer();
        }}
      />
    </div>
  );
};
