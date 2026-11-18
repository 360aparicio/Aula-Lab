/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * TrainerMode: Entrenador Pro 6-Max en Vivo (V3.9 Beta / V4.0.1 SaaS).
 * - Distribución en 2 columnas: Mesa Visual 6-Max (UTG..BB) + acciones guiadas (izquierda)
 *   y Crónica Paso a Paso, Medidor EV, Fugas y Nivel (derecha).
 * - Todos los escenarios: SRP IP/OOP, 3-Bet IP/OOP, Squeeze, ROL, 4-Bet, Cold Call y Multiway (3+).
 * - Reto de 100 Manos Aleatorias en Vivo persistente por UID.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Card, SUIT_COLORS, SUIT_SYMBOLS } from '../engine/cards';
import {
  applyHeroDecision,
  createSimulatedHand,
  loadLiveChallengeState,
  resetLiveChallengeState,
  saveLiveChallengeState,
  SCENARIO_META,
  SIM_POSITIONS,
  type LiveChallengeState,
  type SimActionOption,
  type SimPosition,
  type SimScenarioType,
  type SimulatedHandState,
  type TablePoolPreset
} from '../engine/handSimulator';
import { buildDiagnosticFromLiveChallenge } from '../engine/diagnosticEngine';
import { AutoLearningEngine } from '../engine/autoLearningEngine';
import {
  incrementMissionProgress,
  loadExperienceMode,
  type ExperienceLevel
} from '../lib/experienceMode';
import { PokerGlossaryTip } from './PokerGlossaryTip';
import {
  Shuffle,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Award,
  TrendingUp,
  Layers,
  Lightbulb
} from 'lucide-react';

interface TrainerModeProps {
  drillTarget?: {
    pos: SimPosition | 'RANDOM';
    scenario: SimScenarioType | 'RANDOM';
    nonce: number;
  } | null;
  experienceLevel?: ExperienceLevel;
  onOpenDiagnostic?: () => void;
}

function CardMini({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) {
    return (
      <div className="w-9 h-12 rounded-lg bg-neutral-900 border border-neutral-700 flex items-center justify-center text-[10px] font-mono text-neutral-500">
        LS
      </div>
    );
  }
  const color = SUIT_COLORS[card.suit];
  return (
    <div
      className={`w-9 h-12 sm:w-11 sm:h-14 rounded-lg border ${color.bg} ${color.border} flex flex-col items-center justify-center font-mono font-bold shadow`}
    >
      <span className={`text-sm sm:text-base leading-none ${color.text}`}>{card.rank}</span>
      <span className={`text-xs sm:text-sm leading-none mt-0.5 ${color.text}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
    </div>
  );
}

export const TrainerMode: React.FC<TrainerModeProps> = ({
  drillTarget,
  experienceLevel: propExpLevel,
  onOpenDiagnostic
}) => {
  const experienceLevel = propExpLevel ?? loadExperienceMode();
  const showSimpleTips = experienceLevel === 'beginner' || experienceLevel === 'recreational';

  const [posFilter, setPosFilter] = useState<SimPosition | 'RANDOM'>(drillTarget?.pos || 'RANDOM');
  const [scenarioFilter, setScenarioFilter] = useState<SimScenarioType | 'RANDOM'>(
    drillTarget?.scenario || 'RANDOM'
  );
  const [includePreflop, setIncludePreflop] = useState<boolean>(true);
  const [tablePreset, setTablePreset] = useState<TablePoolPreset>('mixed');
  const [challenge, setChallenge] = useState<LiveChallengeState>(() => loadLiveChallengeState());
  const [handState, setHandState] = useState<SimulatedHandState>(() =>
    createSimulatedHand({
      handNumber: loadLiveChallengeState().completedHands + 1,
      positionFilter: drillTarget?.pos || 'RANDOM',
      scenarioFilter: drillTarget?.scenario || 'RANDOM',
      includePreflop: true,
      tablePreset: 'mixed'
    })
  );
  const [rightTab, setRightTab] = useState<'step' | 'ev' | 'leaks' | 'level'>('step');
  const [confirmResetChallenge, setConfirmResetChallenge] = useState(false);

  // React to incoming drill launches from LevelDiagnosticPanel
  useEffect(() => {
    if (!drillTarget) return;
    setPosFilter(drillTarget.pos);
    setScenarioFilter(drillTarget.scenario);
    setHandState(
      createSimulatedHand({
        handNumber: challenge.completedHands + 1,
        positionFilter: drillTarget.pos,
        scenarioFilter: drillTarget.scenario,
        includePreflop,
        tablePreset
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillTarget?.nonce]);

  const dealNextHand = (
    overridePos?: SimPosition | 'RANDOM',
    overrideSc?: SimScenarioType | 'RANDOM',
    overridePreflop?: boolean,
    overridePreset?: TablePoolPreset
  ) => {
    const nextNum = challenge.completedHands + 1;
    setHandState(
      createSimulatedHand({
        handNumber: nextNum,
        positionFilter: overridePos ?? posFilter,
        scenarioFilter: overrideSc ?? scenarioFilter,
        includePreflop: overridePreflop ?? includePreflop,
        tablePreset: overridePreset ?? tablePreset
      })
    );
  };

  const handleHeroOption = (opt: SimActionOption) => {
    if (handState.isFinished) return;
    const { nextState, decisionRecord } = applyHeroDecision(handState, opt);
    setHandState(nextState);

    const updatedChallenge: LiveChallengeState = {
      ...challenge,
      active: challenge.active || challenge.completedHands < challenge.targetHands,
      completedHands: nextState.isFinished ? challenge.completedHands + 1 : challenge.completedHands,
      records: [...challenge.records, decisionRecord],
      updatedAt: Date.now()
    };
    setChallenge(updatedChallenge);
    saveLiveChallengeState(updatedChallenge);
    if (nextState.isFinished) {
      incrementMissionProgress('m-hands', 1);
    }
  };

  const handleToggleChallenge = () => {
    const next = { ...challenge, active: !challenge.active, updatedAt: Date.now() };
    setChallenge(next);
    saveLiveChallengeState(next);
  };

  const handleResetChallenge = () => {
    const fresh = resetLiveChallengeState(true);
    setChallenge(fresh);
    setConfirmResetChallenge(false);
    setHandState(
      createSimulatedHand({
        handNumber: 1,
        positionFilter: posFilter,
        scenarioFilter: scenarioFilter,
        includePreflop,
        tablePreset
      })
    );
  };

  const liveDiagnostic = useMemo(() => buildDiagnosticFromLiveChallenge(challenge), [challenge]);
  const autoProfile = AutoLearningEngine.getInstance().getProfile();

  const sessionStats = useMemo(() => {
    const total = challenge.records.length;
    const optimal = challenge.records.filter(r => r.isOptimal).length;
    const blunders = challenge.records.filter(r => r.isBlunder).length;
    const evLost = Math.round(challenge.records.reduce((s, r) => s + r.evLossBB, 0) * 10) / 10;
    const acc = total > 0 ? Math.round((optimal / total) * 1000) / 10 : 100;
    return { total, optimal, blunders, evLost, acc };
  }, [challenge.records]);

  const progressPct = Math.min(100, Math.round((challenge.completedHands / Math.max(1, challenge.targetHands)) * 100));

  return (
    <div className="space-y-5">
      {/* FILTER & 100-HAND CHALLENGE CONTROL STRIP */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black border border-neutral-800 text-xs">
            <span className="text-neutral-500">Posición:</span>
            <select
              value={posFilter}
              onChange={e => {
                const v = e.target.value as SimPosition | 'RANDOM';
                setPosFilter(v);
                dealNextHand(v, scenarioFilter);
              }}
              aria-label="Filtrar posición"
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="RANDOM" className="bg-neutral-950">Aleatoria (6-Max)</option>
              {SIM_POSITIONS.map(p => (
                <option key={p} value={p} className="bg-neutral-950">
                  {p === 'EP' ? 'UTG / EP' : p}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black border border-neutral-800 text-xs">
            <span className="text-neutral-500">Escenario:</span>
            <select
              value={scenarioFilter}
              onChange={e => {
                const v = e.target.value as SimScenarioType | 'RANDOM';
                setScenarioFilter(v);
                dealNextHand(posFilter, v);
              }}
              aria-label="Filtrar escenario"
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="RANDOM" className="bg-neutral-950">Aleatorio (Todos los Spots)</option>
              {(Object.keys(SCENARIO_META) as SimScenarioType[]).map(sc => (
                <option key={sc} value={sc} className="bg-neutral-950">
                  {SCENARIO_META[sc].shortLabel}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black border border-neutral-800 text-xs">
            <span className="text-neutral-500">Mesa:</span>
            <select
              value={tablePreset}
              onChange={e => {
                const v = e.target.value as TablePoolPreset;
                setTablePreset(v);
                dealNextHand(posFilter, scenarioFilter, includePreflop, v);
              }}
              aria-label="Tipo de mesa"
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="mixed" className="bg-neutral-950">Mixta (Estándar)</option>
              <option value="recreational" className="bg-neutral-950">Recreativa (Más Fish)</option>
              <option value="reg_heavy" className="bg-neutral-950">Dura (Regulares / Nits)</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black border border-neutral-800 text-xs text-neutral-300 cursor-pointer">
            <input
              type="checkbox"
              checked={includePreflop}
              onChange={e => {
                const checked = e.target.checked;
                setIncludePreflop(checked);
                dealNextHand(posFilter, scenarioFilter, checked, tablePreset);
              }}
              className="accent-blue-500 rounded"
            />
            <span>Incluir Preflop</span>
          </label>

          <button
            type="button"
            onClick={() => dealNextHand()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>Nueva Mano</span>
          </button>
        </div>

        {/* 100-HAND CHALLENGE TRACKER */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-black border border-neutral-800">
            <div>
              <div className="text-[10px] font-mono uppercase text-neutral-500">Reto 100 Manos en Vivo</div>
              <div className="text-xs font-mono tabular-nums font-bold text-white">
                {challenge.completedHands} / {challenge.targetHands} manos ({progressPct}%)
              </div>
            </div>
            <div className="w-20 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
              <div style={{ width: `${progressPct}%` }} className="h-full bg-emerald-500 transition-all" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleChallenge}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer ${
              challenge.active
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-300 hover:text-white'
            }`}
          >
            {challenge.active ? 'Reto Activo' : 'Iniciar Reto'}
          </button>

          {confirmResetChallenge ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetChallenge}
                className="px-2.5 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-bold cursor-pointer"
              >
                Confirmar Reset
              </button>
              <button
                type="button"
                onClick={() => setConfirmResetChallenge(false)}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 text-neutral-300 text-xs cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmResetChallenge(true)}
              className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
              title="Reiniciar Reto de 100 Manos"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}

          {onOpenDiagnostic && (
            <button
              type="button"
              onClick={onOpenDiagnostic}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-blue-300 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Ver Diagnóstico</span>
            </button>
          )}
        </div>
      </div>

      {/* 2-COLUMN MAIN WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: 6-MAX VISUAL TABLE + ACTION BUTTONS */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 sm:p-5 space-y-4">
            {/* SPOT CONTEXT BAR */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-blue-400">Mano #{handState.handNumber}</span>
                <span className="text-neutral-500">·</span>
                <span className="font-semibold text-white">{SCENARIO_META[handState.scenario].label}</span>
              </div>
              <div className="font-mono text-neutral-400">
                Rival principal: <span className="text-amber-300 font-semibold">{handState.villainArchetype}</span>
              </div>
            </div>

            {/* 6-SEAT VISUAL RING (3 TOP SEATS + FELT + 3 BOTTOM SEATS) */}
            <div className="space-y-3">
              {/* Top 3 seats: UTG, MP, CO */}
              <div className="grid grid-cols-3 gap-2.5">
                {handState.seats.slice(0, 3).map(seat => (
                  <SeatCard key={seat.pos} seat={seat} showCards={handState.isFinished && seat.inHand} />
                ))}
              </div>

              {/* Poker Felt Table Center */}
              <div className="rounded-3xl bg-gradient-to-b from-emerald-950/60 to-black border-2 border-emerald-900/50 p-5 flex flex-col items-center justify-center gap-3.5 shadow-inner">
                <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono">
                  <span className="text-neutral-300 uppercase">Calle: <strong className="text-white">{handState.street}</strong></span>
                  <span className="text-neutral-500">·</span>
                  <span className="text-emerald-400 font-bold tabular-nums">Bote: {handState.potBB.toFixed(1)} BB</span>
                  {handState.facingBetBB > 0 && !handState.isFinished && (
                    <>
                      <span className="text-neutral-500">·</span>
                      <span className="text-amber-300 font-bold tabular-nums">Enfrentas Bet: {handState.facingBetBB.toFixed(1)} BB</span>
                    </>
                  )}
                </div>

                {/* Community Cards */}
                {handState.boardCards.length === 0 ? (
                  <div className="px-4 py-3 rounded-xl bg-black/50 border border-dashed border-neutral-700 text-xs font-mono text-blue-300 text-center">
                    Decisión Preflop en curso · Las 3 cartas del Flop caerán tras tu acción
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    {handState.boardCards.map(c => (
                      <CardMini key={c.id} card={c} />
                    ))}
                    {Array.from({ length: Math.max(0, 5 - handState.boardCards.length) }).map((_, i) => (
                      <div
                        key={i}
                        className="w-9 h-12 sm:w-11 sm:h-14 rounded-lg border border-dashed border-neutral-800 bg-black/30"
                      />
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-neutral-400 text-center max-w-md">
                  {SCENARIO_META[handState.scenario].description}
                </p>
              </div>

              {/* Bottom 3 seats: BTN, SB, BB */}
              <div className="grid grid-cols-3 gap-2.5">
                {handState.seats.slice(3, 6).map(seat => (
                  <SeatCard key={seat.pos} seat={seat} showCards={handState.isFinished && seat.inHand} />
                ))}
              </div>
            </div>

            {/* SHOWDOWN / FINISHED RESULT OR ACTION BAR */}
            {handState.isFinished ? (
              <div className="p-4 rounded-xl bg-black border border-neutral-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-mono uppercase text-neutral-400">Resultado de la Mano</div>
                    <div
                      className={`text-lg font-bold font-mono tabular-nums ${
                        handState.heroNetBB >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      Hero ({handState.heroPos}): {handState.heroNetBB >= 0 ? '+' : ''}
                      {handState.heroNetBB.toFixed(1)} BB
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => dealNextHand()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Siguiente Mano →</span>
                  </button>
                </div>

                {handState.showdownSummary && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-neutral-800">
                    {handState.showdownSummary.rankings.map(r => {
                      const isWinner = handState.showdownSummary?.winners.includes(r.pos);
                      return (
                        <div
                          key={r.pos}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs ${
                            isWinner
                              ? 'bg-emerald-950/30 border-emerald-500/40'
                              : 'bg-neutral-950 border-neutral-800'
                          }`}
                        >
                          <div>
                            <div className="font-mono font-bold text-white">
                              {r.pos} ({r.archetype}) {isWinner ? '· Ganador' : ''}
                            </div>
                            <div className="text-[11px] text-neutral-400">{r.handDesc}</div>
                          </div>
                          <div className="font-mono font-bold text-neutral-200">
                            {r.cards[0].rank}
                            {SUIT_SYMBOLS[r.cards[0].suit]} {r.cards[1].rank}
                            {SUIT_SYMBOLS[r.cards[1].suit]}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs text-neutral-400">
                  Tu turno en <strong className="text-white">{handState.heroPos}</strong> · Elige la acción óptima:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {handState.actions.map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleHeroOption(opt)}
                      className="p-3 rounded-xl bg-black hover:bg-blue-950/40 border border-neutral-800 hover:border-blue-500 text-left transition-all cursor-pointer"
                    >
                      <div className="text-xs font-bold text-white">{opt.label}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5 capitalize">{opt.actionType}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: PASO A PASO, MEDIDOR EV, FUGAS, NIVEL */}
        <div className="lg:col-span-5 bg-neutral-950 border border-neutral-800 rounded-2xl p-4 sm:p-5 flex flex-col gap-4">
          <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-black border border-neutral-800 text-[11px] font-semibold">
            {(
              [
                { id: 'step', label: 'Paso a Paso' },
                { id: 'ev', label: 'Medidor EV' },
                { id: 'leaks', label: 'Fugas' },
                { id: 'level', label: 'Nivel' }
              ] as const
            ).map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setRightTab(t.id)}
                className={`py-1.5 rounded-lg transition-colors cursor-pointer ${
                  rightTab === t.id ? 'bg-blue-600 text-white' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {rightTab === 'step' && (
            <div className="space-y-3 overflow-y-auto max-h-[540px] pr-1">
              {handState.chronicle.length === 0 ? (
                <div className="p-6 rounded-xl bg-black border border-neutral-800 text-center text-xs text-neutral-400 space-y-1.5">
                  <Layers className="w-5 h-5 text-blue-400 mx-auto" />
                  <div className="font-semibold text-white">Esperando tu primera decisión</div>
                  <p>
                    Al actuar en el Flop verás aquí la frecuencia Nash, Equity estimada, Pot Odds y ajuste explotativo frente a {handState.villainArchetype}.
                  </p>
                </div>
              ) : (
                handState.chronicle.map((st, idx) => {
                  const gradeColor =
                    st.grade === 'optimal'
                      ? 'text-emerald-400 border-emerald-500/30'
                      : st.grade === 'acceptable'
                      ? 'text-blue-400 border-blue-500/30'
                      : st.grade === 'inaccuracy'
                      ? 'text-amber-300 border-amber-500/30'
                      : 'text-rose-400 border-rose-500/30';
                  return (
                    <div key={idx} className={`p-3.5 rounded-xl bg-black border ${gradeColor} space-y-2`}>
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="uppercase font-bold text-white">{st.street}</span>
                        <span className="uppercase font-bold">{st.grade} · -{st.evLossBB} BB</span>
                      </div>
                      <div className="text-xs text-neutral-300">
                        Elegiste <strong className="text-white">{st.heroAction}</strong> · Óptima:{' '}
                        <strong className="text-emerald-400">{st.recommendedAction}</strong>
                      </div>
                      <div className="text-[11px] font-mono text-neutral-400 flex flex-wrap items-center gap-1.5">
                        <span>Equity ~{st.estimatedEquityPct}%</span>
                        <span>·</span>
                        <span>Pot Odds {st.potOddsPct}%</span>
                        <span>·</span>
                        <PokerGlossaryTip term="SPR" label={`SPR ${st.spr}`} />
                      </div>
                      {showSimpleTips && st.plainEnglishTip ? (
                        <div className="p-2.5 rounded-lg bg-blue-950/30 border border-blue-500/30 text-xs text-blue-100 flex items-start gap-2">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                          <span>{st.plainEnglishTip}</span>
                        </div>
                      ) : null}
                      <p className="text-xs text-neutral-200 leading-relaxed">{st.explanationDummies}</p>
                      <p className="text-[11px] text-cyan-300">{st.exploitativeNote}</p>
                      <div className="text-[11px] text-neutral-500 border-t border-neutral-800 pt-1.5">
                        Reacción rival: {st.villainAction}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {rightTab === 'ev' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-black border border-neutral-800">
                  <div className="text-[11px] text-neutral-500">Precisión Sesión</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-emerald-400 mt-1">
                    {sessionStats.acc.toFixed(1)}%
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-black border border-neutral-800">
                  <div className="text-[11px] text-neutral-500">EV Perdido Total</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-rose-400 mt-1">
                    -{sessionStats.evLost.toFixed(1)} BB
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-black border border-neutral-800">
                  <div className="text-[11px] text-neutral-500">Decisiones Óptimas</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white mt-1">
                    {sessionStats.optimal} / {sessionStats.total}
                  </div>
                </div>
                <div className="p-3.5 rounded-xl bg-black border border-neutral-800">
                  <div className="text-[11px] text-neutral-500">Tarjetas SM-2 Activas</div>
                  <div className="text-lg font-bold font-mono tabular-nums text-blue-400 mt-1">
                    {autoProfile.sm2TotalCards} ({autoProfile.sm2DueCardsCount} hoy)
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black border border-neutral-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-400">Termómetro de Precisión Nash</span>
                  <span className="font-mono font-bold tabular-nums text-white">{sessionStats.acc.toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                  <div
                    style={{ width: `${Math.min(100, Math.max(0, sessionStats.acc))}%` }}
                    className={`h-full transition-all ${
                      sessionStats.acc >= 80
                        ? 'bg-emerald-500'
                        : sessionStats.acc >= 60
                        ? 'bg-amber-400'
                        : 'bg-rose-500'
                    }`}
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-black border border-neutral-800 text-xs text-neutral-300 space-y-1">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <TrendingUp className="w-4 h-4 text-blue-400" />
                  <span>Dominio Global Auto-Learning</span>
                </div>
                <p>
                  Puntuación de Maestría actual: <strong className="font-mono text-white">{autoProfile.masteryScore}/100</strong> · Estilo:{' '}
                  <strong className="text-cyan-300">{autoProfile.styleProfile}</strong>.
                </p>
              </div>
            </div>
          )}

          {rightTab === 'leaks' && (
            <div className="space-y-2.5 overflow-y-auto max-h-[540px] pr-1">
              {challenge.records.filter(r => r.evLossPctPot > 3).length === 0 ? (
                <div className="p-6 rounded-xl bg-black border border-neutral-800 text-center text-xs text-neutral-400 space-y-1.5">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                  <div className="font-semibold text-white">Sin fugas graves (&gt;3% EV) en el Reto actual</div>
                  <p>Cada error superior al 3% del bote entra automáticamente aquí y a tu mazo SM-2.</p>
                </div>
              ) : (
                challenge.records
                  .filter(r => r.evLossPctPot > 3)
                  .slice(-12)
                  .reverse()
                  .map(rec => (
                    <div key={rec.id} className="p-3 rounded-xl bg-black border border-rose-500/30 text-xs space-y-1">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-white font-bold">
                          Mano #{rec.handNumber} · {rec.heroPos} ({SCENARIO_META[rec.scenario].shortLabel})
                        </span>
                        <span className="text-rose-400 font-bold">-{rec.evLossBB} BB</span>
                      </div>
                      <div className="text-neutral-300">
                        Elegiste <strong>{rec.chosenAction}</strong> · Mejor: <strong className="text-emerald-400">{rec.bestAction}</strong>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {rightTab === 'level' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-black border border-neutral-800 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-mono uppercase text-neutral-500">Nivel Estimado en Vivo</div>
                  <div className="text-2xl font-black font-mono text-white mt-0.5">{liveDiagnostic.estimatedLevel}</div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-mono uppercase text-neutral-500">Arquetipo</div>
                  <div className="text-base font-bold text-blue-400 mt-0.5">{liveDiagnostic.archetype}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 text-xs font-mono tabular-nums">
                <div className="p-3 rounded-xl bg-black border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px]">VPIP / PFR</span>
                  <span className="text-white font-bold">
                    {liveDiagnostic.metrics.vpip.toFixed(1)}% / {liveDiagnostic.metrics.pfr.toFixed(1)}%
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-black border border-neutral-800">
                  <span className="text-neutral-500 block text-[10px]">Winrate Estimado</span>
                  <span className="text-emerald-400 font-bold">
                    {liveDiagnostic.metrics.bbPer100 >= 0 ? '+' : ''}
                    {liveDiagnostic.metrics.bbPer100.toFixed(1)} bb/100
                  </span>
                </div>
              </div>

              <p className="text-xs text-neutral-300 leading-relaxed">{liveDiagnostic.archetypeSummary}</p>

              {liveDiagnostic.leaks[0] && (
                <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{liveDiagnostic.leaks[0]}</span>
                </div>
              )}

              {onOpenDiagnostic && (
                <button
                  type="button"
                  onClick={onOpenDiagnostic}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Award className="w-4 h-4" />
                  <span>Abrir Diagnóstico Completo &amp; Plan</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function SeatCard({
  seat,
  showCards
}: {
  seat: SimulatedHandState['seats'][number];
  showCards: boolean;
}) {
  return (
    <div
      className={`p-2.5 rounded-xl border flex flex-col gap-2 transition-all ${
        seat.isHero
          ? 'bg-blue-950/30 border-blue-500/70'
          : seat.inHand
          ? 'bg-black border-neutral-700'
          : 'bg-black/40 border-neutral-800/60 opacity-50'
      }`}
    >
      <div className="flex items-center justify-between gap-1 text-[11px] font-mono">
        <span className={`font-bold ${seat.isHero ? 'text-blue-300' : 'text-white'}`}>
          {seat.pos === 'EP' ? 'UTG / EP' : seat.pos} {seat.isHero ? '(HERO)' : ''} {seat.pos === 'BTN' ? '[D]' : ''}
        </span>
        <span className="text-neutral-400 tabular-nums">{seat.stackBB.toFixed(0)} BB</span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {seat.holeCards ? (
            <>
              <CardMini card={seat.holeCards[0]} hidden={!seat.isHero && !showCards} />
              <CardMini card={seat.holeCards[1]} hidden={!seat.isHero && !showCards} />
            </>
          ) : (
            <span className="text-[11px] text-neutral-600 font-mono">Fold</span>
          )}
        </div>
        <div className="text-right min-w-0">
          <div className="text-[10px] text-neutral-400 truncate">{seat.archetype}</div>
          <div className="text-[11px] font-semibold text-amber-300 truncate">{seat.lastAction}</div>
        </div>
      </div>
    </div>
  );
}
