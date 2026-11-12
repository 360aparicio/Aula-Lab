/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SolverMetaPanel: Centro de Auto-Actualización de Solvers, Tendencias de Internet
 * y Aprendizaje Colectivo de Usuarios.
 */

import React, { useEffect, useState } from 'react';
import {
  SolverMetaUpdater,
  SOLVER_META_UPDATE_EVENT,
  type SolverMetaState
} from '../engine/solverMetaUpdater';
import {
  Globe,
  RefreshCw,
  Users,
  Cpu,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  BookOpen
} from 'lucide-react';

const PRESET_TOPICS = [
  {
    label: 'Meta NL2–NL100 6-Max Actual',
    query: 'No Limit Holdem 6-max cash games GTO solver population tendencies exploitative adjustments NL10 NL50 2025'
  },
  {
    label: 'C-Bet 3-Bet Pots (PioSolver / GTO Wizard)',
    query: '6-max NLHE 3-bet pots flop cbet sizing 25% 33% solver frequency heuristics'
  },
  {
    label: 'Overbet Polarizado en Turn & River',
    query: 'GTO poker turn river overbet polarization 125% 150% pot solver strategy'
  },
  {
    label: 'Defensa BB vs BTN & Squeeze',
    query: '6-max BB defense vs BTN open raise squeeze sizing GTO solver ranges'
  }
];

export const SolverMetaPanel: React.FC = () => {
  const [meta, setMeta] = useState<SolverMetaState>(() => SolverMetaUpdater.getInstance().getState());
  const [customQuery, setCustomQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    void SolverMetaUpdater.getInstance().fetchFromServer().then(setMeta);
    const onUpdate = () => setMeta(SolverMetaUpdater.getInstance().getState());
    window.addEventListener(SOLVER_META_UPDATE_EVENT, onUpdate);
    return () => window.removeEventListener(SOLVER_META_UPDATE_EVENT, onUpdate);
  }, []);

  const handleSync = async (topic?: string) => {
    setIsSyncing(true);
    setSyncMessage(null);
    const result = await SolverMetaUpdater.getInstance().syncWithInternet(topic || customQuery || undefined);
    setMeta(result.state);
    setIsSyncing(false);

    if (result.ok) {
      setSyncMessage({
        type: 'ok',
        text: 'Heurísticas actualizadas en vivo desde literatura moderna de solvers e internet.'
      });
    } else {
      setSyncMessage({
        type: 'err',
        text: result.error || 'No se pudo completar la consulta web en este momento.'
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-blue-500/10 rounded-xl border border-blue-500/30 text-blue-400 shrink-0">
            <Globe className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">
              Inteligencia Solver Auto-Actualizable (Internet + Usuarios + DCFR)
            </h2>
            <p className="text-xs text-neutral-400 mt-1 max-w-2xl leading-relaxed">
              Combina el equilibrio matemático local DCFR con fugas reales aprendidas de los usuarios y búsqueda en vivo
              sobre tendencias de solvers (GTO Wizard / PioSolver) para recalibrar al Coach automáticamente.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleSync()}
          disabled={isSyncing}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            isSyncing
              ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/25'
          }`}
        >
          <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Consultando Internet...' : 'Sincronizar Solvers & Internet'}</span>
        </button>
      </div>

      {/* Custom Topic Query + Presets */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <input
            type="text"
            value={customQuery}
            onChange={(e) => setCustomQuery(e.target.value)}
            placeholder="Ej: Estrategia GTO en flops monótonos BTN vs BB o sizing de 4-bet..."
            className="flex-1 bg-neutral-900 border border-neutral-800 focus:border-blue-500 rounded-xl px-4 py-2 text-xs text-white placeholder-neutral-500 outline-none"
          />
          <button
            type="button"
            onClick={() => void handleSync(customQuery)}
            disabled={isSyncing}
            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            Consultar Spot en Web
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-500 font-medium">Consultas rápidas:</span>
          {PRESET_TOPICS.map(preset => (
            <button
              key={preset.label}
              type="button"
              onClick={() => {
                setCustomQuery(preset.query);
                void handleSync(preset.query);
              }}
              disabled={isSyncing}
              className="px-3 py-1 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-blue-500/40 text-neutral-300 rounded-lg transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {syncMessage && (
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            syncMessage.type === 'ok'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
              : 'bg-amber-950/40 border-amber-800 text-amber-200'
          }`}>
            {syncMessage.type === 'ok' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{syncMessage.text}</span>
          </div>
        )}

        <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-xl text-xs text-neutral-300 leading-relaxed">
          <strong className="text-blue-400 block mb-1">Resumen del Meta Actual:</strong>
          {meta.internetQuerySummary}
        </div>
      </div>

      {/* Main Split: Learned Adaptive Rules + Collective User Leaks */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Adaptive Rules (7 cols) */}
        <div className="lg:col-span-7 bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-400" />
              <span>Reglas Activas Inyectadas al Coach ({meta.rules.length})</span>
            </h3>
            <span className="text-[11px] font-mono text-neutral-500">
              {meta.lastInternetSyncAt
                ? `Última sync: ${new Date(meta.lastInternetSyncAt).toLocaleTimeString()}`
                : 'Base GTO + Colectiva'}
            </span>
          </div>

          <div className="space-y-3">
            {meta.rules.map(rule => (
              <div key={rule.id} className="p-4 bg-neutral-900 border border-neutral-800 rounded-xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-white">{rule.topic}</div>
                    <div className="text-[11px] text-neutral-400 font-mono mt-0.5">
                      Calle: {rule.street.toUpperCase()} · Textura: {rule.texture} · Frec GTO: {rule.gtoFrequencyPct}%
                    </div>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                    rule.sourceOrigin === 'internet_solver'
                      ? 'bg-blue-950/70 text-blue-300 border-blue-800'
                      : rule.sourceOrigin === 'collective_users'
                      ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                      : 'bg-emerald-950/70 text-emerald-300 border-emerald-800'
                  }`}>
                    {rule.sourceOrigin === 'internet_solver'
                      ? 'Internet + Solver'
                      : rule.sourceOrigin === 'collective_users'
                      ? 'Usuarios Reales'
                      : 'DCFR Local'}
                  </span>
                </div>

                <div className="text-xs font-semibold text-emerald-400">
                  Acción Óptima: {rule.recommendedAction} (Sizing ~{rule.sizingPctPot}% Pot)
                </div>

                <p className="text-[11px] text-neutral-300 leading-relaxed">
                  {rule.exploitativeAdjustment}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Collective Learning & Citations (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Aprendizaje Colectivo ({meta.totalUserSamplesLearned} manos)</span>
              </h3>
              <Cpu className="w-4 h-4 text-neutral-500" />
            </div>

            {meta.collectiveLeaks.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Cada mano jugada en Práctica o Quiz alimenta este radar colectivo de errores frecuentes.
              </p>
            ) : (
              <div className="space-y-2.5">
                {meta.collectiveLeaks.map((leak, idx) => (
                  <div key={`${leak.texture}-${idx}`} className="p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <strong className="text-white">{leak.texture} ({leak.street.toUpperCase()})</strong>
                      <span className="font-mono text-rose-400 font-bold tabular-nums">
                        -{leak.avgEvLossPct}% EV ({leak.sampleCount} muestras)
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      Error común: <span className="text-rose-300">{leak.topMistakeAction}</span> → Corrección:{' '}
                      <span className="text-emerald-300 font-semibold">{leak.optimalCounterAction}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <span>Fuentes Web Verificadas</span>
            </h3>
            {meta.citations.length === 0 ? (
              <p className="text-xs text-neutral-500">
                Al ejecutar una sincronización con internet aparecerán aquí los artículos y fuentes consultadas.
              </p>
            ) : (
              <ul className="space-y-2 text-xs">
                {meta.citations.map((cit, i) => (
                  <li key={`${cit.url}-${i}`}>
                    <a
                      href={cit.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 p-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <span className="truncate">{cit.title}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
