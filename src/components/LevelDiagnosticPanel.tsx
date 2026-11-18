/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * LevelDiagnosticPanel: Diagnóstico de Nivel Estimado (NL2 -> NL50+), Arquetipo,
 * Métricas por Posición (UTG..BB), Fortalezas, Fugas y Plan de Mejoras con
 * lanzamiento directo de drills hacia el Entrenador Pro 6-Max.
 */

import React, { useMemo, useState } from 'react';
import {
  buildDiagnosticFromLiveChallenge,
  buildDiagnosticFromTracker2Hands,
  type LevelDiagnosticReport
} from '../engine/diagnosticEngine';
import {
  loadLiveChallengeState,
  SCENARIO_META,
  type SimPosition,
  type SimScenarioType
} from '../engine/handSimulator';
import {
  loadTracker2Databases,
  getActiveTracker2DatabaseId,
  type Tracker2Database
} from '../engine/theTracker2Engine';
import { AutoLearningEngine } from '../engine/autoLearningEngine';
import { incrementMissionProgress } from '../lib/experienceMode';
import { WeeklyLeaksRadarCard } from './OnboardingAndLeaksBar';
import {
  Activity,
  Target,
  ShieldCheck,
  AlertTriangle,
  Compass,
  RefreshCw,
  Database,
  Play,
  Bookmark
} from 'lucide-react';

interface LevelDiagnosticPanelProps {
  activeTracker2Db?: Tracker2Database | null;
  onLaunchDrill: (pos: SimPosition | 'RANDOM', scenario: SimScenarioType | 'RANDOM') => void;
  onGoToTrainer?: () => void;
}

export const LevelDiagnosticPanel: React.FC<LevelDiagnosticPanelProps> = ({
  activeTracker2Db,
  onLaunchDrill,
  onGoToTrainer
}) => {
  const [source, setSource] = useState<'live_100' | 'tracker2_db'>(() => {
    if (activeTracker2Db && activeTracker2Db.hands.length > 0 && loadLiveChallengeState().records.length === 0) {
      return 'tracker2_db';
    }
    return 'live_100';
  });
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [savedSm2Ids, setSavedSm2Ids] = useState<Record<string, boolean>>({});

  const resolvedTracker2Db = useMemo(() => {
    void refreshNonce;
    if (activeTracker2Db) return activeTracker2Db;
    const all = loadTracker2Databases();
    const activeId = getActiveTracker2DatabaseId();
    return all.find(d => d.id === activeId) || all[0];
  }, [activeTracker2Db, refreshNonce]);

  const liveChallenge = useMemo(() => {
    void refreshNonce;
    return loadLiveChallengeState();
  }, [refreshNonce]);

  const report: LevelDiagnosticReport = useMemo(() => {
    if (source === 'tracker2_db') {
      return buildDiagnosticFromTracker2Hands(
        resolvedTracker2Db?.hands || [],
        resolvedTracker2Db?.name || 'Base Principal'
      );
    }
    return buildDiagnosticFromLiveChallenge(liveChallenge);
  }, [source, resolvedTracker2Db, liveChallenge]);

  const metricCards = [
    { label: 'VPIP', value: `${report.metrics.vpip.toFixed(1)}%` },
    { label: 'PFR', value: `${report.metrics.pfr.toFixed(1)}%` },
    { label: '3-Bet', value: `${report.metrics.threeBet.toFixed(1)}%` },
    { label: 'C-Bet', value: `${report.metrics.cbet.toFixed(1)}%` },
    { label: 'WTSD', value: `${report.metrics.wtsd.toFixed(1)}%` },
    { label: 'W$SD', value: `${report.metrics.wsd.toFixed(1)}%` },
    { label: 'Precisión Nash', value: `${report.metrics.gtoAccuracy.toFixed(1)}%` },
    {
      label: 'bb/100',
      value: `${report.metrics.bbPer100 >= 0 ? '+' : ''}${report.metrics.bbPer100.toFixed(1)}`
    }
  ];

  return (
    <div className="space-y-6">
      {/* SOURCE SWITCHER HEADER */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
            <Activity className="w-4 h-4" />
            <span>Diagnóstico Técnico de Nivel &amp; Plan de Mejoras</span>
          </div>
          <h2 className="text-lg font-bold text-white">{report.sourceLabel}</h2>
          <p className="text-xs text-neutral-400">
            Evalúa tu nivel estimado (NL2 → NL50+), detecta fugas por silla 6-Max y lanza drills corregidos en 1 clic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 rounded-xl bg-black border border-neutral-800">
            <button
              type="button"
              onClick={() => setSource('live_100')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                source === 'live_100'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Reto 100 Manos ({liveChallenge.completedHands}/{liveChallenge.targetHands})
            </button>
            <button
              type="button"
              onClick={() => setSource('tracker2_db')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                source === 'tracker2_db'
                  ? 'bg-blue-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Base TheTracker2 ({resolvedTracker2Db?.hands.length || 0})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setRefreshNonce(n => n + 1)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-medium text-neutral-200 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
            <span>Actualizar</span>
          </button>

          {onGoToTrainer && (
            <button
              type="button"
              onClick={onGoToTrainer}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Ir a Mesa 6-Max</span>
            </button>
          )}
        </div>
      </div>

      {/* HERO VERDICT + 8 KPI METRICS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Nivel Estimado Actual
              </div>
              <div className="text-3xl font-black text-white font-mono tabular-nums mt-1">
                {report.estimatedLevel}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                Arquetipo Detectado
              </div>
              <div className="text-xl font-bold text-blue-400 mt-1">{report.archetype}</div>
            </div>
          </div>

          <p className="text-xs text-neutral-300 leading-relaxed bg-black border border-neutral-800 rounded-xl p-3.5">
            {report.archetypeSummary}
          </p>

          <div className="flex items-center justify-between text-xs text-neutral-400 border-t border-neutral-800/80 pt-3">
            <span>Muestra Analizada</span>
            <span className="font-mono tabular-nums text-white font-bold">{report.sampleHands} manos / spots</span>
          </div>
        </div>

        <div className="lg:col-span-7 bg-neutral-950 border border-neutral-800 rounded-2xl p-5">
          <div className="text-xs font-semibold text-neutral-300 mb-3">
            Métricas Clave 6-Max (Actual vs Objetivo)
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {metricCards.map(m => (
              <div key={m.label} className="p-3 rounded-xl bg-black border border-neutral-800">
                <div className="text-[11px] font-mono uppercase text-neutral-500">{m.label}</div>
                <div className="text-lg font-bold font-mono tabular-nums text-white mt-1">{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 6-MAX POSITIONAL BREAKDOWN TABLE */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-white">Rendimiento Detallado por Posición (UTG → BB)</h3>
          <span className="text-xs text-neutral-500">Haz clic en &quot;Practicar&quot; para corregir una silla débil</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 font-mono uppercase text-[11px]">
                <th className="py-2.5 pr-3">Posición</th>
                <th className="py-2.5 px-3">Manos</th>
                <th className="py-2.5 px-3">VPIP</th>
                <th className="py-2.5 px-3">PFR</th>
                <th className="py-2.5 px-3">Precisión Nash</th>
                <th className="py-2.5 px-3">bb/100</th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 pl-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {report.positionalBreakdown.map(row => {
                const statusColor =
                  row.status === 'Fuerte'
                    ? 'text-emerald-400'
                    : row.status === 'Fuga'
                    ? 'text-rose-400'
                    : 'text-amber-300';
                return (
                  <tr key={row.pos} className="hover:bg-neutral-900/50 transition-colors">
                    <td className="py-2.5 pr-3 font-mono font-bold text-white">{row.pos}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-300">{row.hands}</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-300">{row.vpip.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-neutral-300">{row.pfr.toFixed(1)}%</td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-blue-300">{row.gtoAcc.toFixed(1)}%</td>
                    <td
                      className={`py-2.5 px-3 font-mono tabular-nums font-semibold ${
                        row.bbPer100 >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {row.bbPer100 >= 0 ? '+' : ''}
                      {row.bbPer100.toFixed(1)}
                    </td>
                    <td className={`py-2.5 px-3 font-semibold ${statusColor}`}>{row.status}</td>
                    <td className="py-2.5 pl-3 text-right">
                      <button
                        type="button"
                        onClick={() => onLaunchDrill(row.pos, 'RANDOM')}
                        className="px-2.5 py-1 rounded-lg bg-neutral-900 hover:bg-blue-600 border border-neutral-800 hover:border-blue-500 text-[11px] font-semibold text-neutral-200 hover:text-white transition-colors cursor-pointer"
                      >
                        Practicar {row.pos}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUALITATIVE INSIGHTS: CHARACTERISTICS, STRENGTHS, LEAKS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-400">
            <Compass className="w-4 h-4" />
            <span>Características del Perfil</span>
          </div>
          <ul className="space-y-2 text-xs text-neutral-300 leading-relaxed">
            {report.characteristics.map((item, idx) => (
              <li key={idx} className="p-2.5 rounded-xl bg-black border border-neutral-800/80">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Fortalezas Confirmadas</span>
          </div>
          <ul className="space-y-2 text-xs text-neutral-300 leading-relaxed">
            {report.strengths.map((item, idx) => (
              <li key={idx} className="p-2.5 rounded-xl bg-black border border-neutral-800/80">
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-rose-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Fugas Prioritarias</span>
          </div>
          <ul className="space-y-2 text-xs text-neutral-300 leading-relaxed">
            {report.leaks.map((item, idx) => (
              <li key={idx} className="p-2.5 rounded-xl bg-black border border-neutral-800/80">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* IMPROVEMENT PLAN WITH DIRECT DRILL LAUNCH */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">Plan de Mejoras Priorizado (Drills Directos)</h3>
          </div>
          <span className="text-xs text-neutral-500">Cada botón abre el Entrenador 6-Max pre-filtrado en el spot exacto</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {report.improvementPlan.map(item => {
            const prioColor =
              item.priority === 'Alta'
                ? 'text-rose-400'
                : item.priority === 'Media'
                ? 'text-amber-300'
                : 'text-emerald-400';
            const scenarioLabel =
              item.drillScenario === 'RANDOM'
                ? 'Todos los Escenarios'
                : SCENARIO_META[item.drillScenario].shortLabel;

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-black border border-neutral-800 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className={`font-bold uppercase ${prioColor}`}>Prioridad {item.priority}</span>
                    <span className="text-neutral-500">
                      {item.drillPos} · {scenarioLabel}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white">{item.area}</div>
                  <p className="text-xs text-neutral-400">{item.problem}</p>
                  <p className="text-xs text-neutral-200 pt-1 border-t border-neutral-800/80">
                    {item.actionStep}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onLaunchDrill(item.drillPos, item.drillScenario)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Lanzar Drill</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      AutoLearningEngine.getInstance().collectHand({
                        heroPos: item.drillPos === 'RANDOM' ? 'BTN' : item.drillPos,
                        villainPos: 'BB',
                        heroCards: 'A♠ Q♠',
                        board: 'K♦ 9♣ 4♥',
                        street: 'flop',
                        category: item.area,
                        potBB: 6,
                        chosenAction: item.problem,
                        optimalAction: item.actionStep,
                        evLossPct: item.priority === 'Alta' ? 8.5 : item.priority === 'Media' ? 5.0 : 2.5,
                        isMistake: item.priority === 'Alta' || item.priority === 'Media',
                        keyTakeaway: `${item.area}: ${item.actionStep}`
                      });
                      incrementMissionProgress('m-sm2', 1);
                      setSavedSm2Ids(prev => ({ ...prev, [item.id]: true }));
                    }}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                      savedSm2Ids[item.id]
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-emerald-300'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{savedSm2Ids[item.id] ? 'Guardado ✓' : 'SM-2'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RADAR DE FUGAS SEMANAL EN ESPAÑOL CLARO */}
      <WeeklyLeaksRadarCard onLaunchDrill={onLaunchDrill} />
    </div>
  );
};
