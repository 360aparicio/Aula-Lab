/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * MarketStudyAdminPanel (FASE 3B):
 * - Control maestro del Feature Flag `market_study_v1` (ON/OFF + Rollback instantáneo < 5 min)
 * - Inicialización y monitoreo de cohortes 100 FISH / 100 REG / 100 NIT (300 jugadores)
 * - KPIs en vivo: Retención, NPS, PMF (Sean Ellis ≥ 40%), Densidad percibida, Eventos
 * - Selector de Admin Override por participante (prioridad máxima sobre cohorte/auto-selección)
 * - Previsualización segura de recordatorios (Día 7 / 14 / 21 / 30) y exportación CSV/JSON anonimizada
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  computeStudyAggregates,
  exportStudyAnonymizedCsv,
  exportStudyAnonymizedJson,
  fetchAdminStudyDashboardData,
  initializeCohortsAdmin,
  setParticipantAdminOverride,
  STUDY_LEVELS,
  toggleMarketStudyFlagAdmin,
  type AdminStudyDashboardSnapshot,
  type StudyLevel,
  type StudyMilestone
} from '../lib/adminStudyService';
import { getLabAppUrl } from '../lib/planCatalog';
import { useAdminAuth } from '../context/AdminAuthContext';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Download,
  FlaskConical,
  Mail,
  Power,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Users
} from 'lucide-react';

interface MarketStudyAdminPanelProps {
  onStatus: (msg: string) => void;
  onError: (err: string) => void;
}

const LEVEL_META: Record<StudyLevel, { code: string; label: string; badge: string; bar: string }> = {
  fish: {
    code: 'FISH',
    label: 'Novato · Simple',
    badge: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
    bar: 'bg-emerald-500'
  },
  reg: {
    code: 'REG',
    label: 'Intermedio · Balanceado',
    badge: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
    bar: 'bg-blue-500'
  },
  nit: {
    code: 'NIT',
    label: 'Avanzado · Analítico',
    badge: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
    bar: 'bg-amber-500'
  }
};

export const MarketStudyAdminPanel: React.FC<MarketStudyAdminPanelProps> = ({ onStatus, onError }) => {
  const { getIdToken } = useAdminAuth();
  const [snapshot, setSnapshot] = useState<AdminStudyDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [quotaInput, setQuotaInput] = useState<number>(100);
  const [rolloutNotes, setRolloutNotes] = useState<string>('');
  const [previewMilestone, setPreviewMilestone] = useState<StudyMilestone>('day7');
  const [previewLevel, setPreviewLevel] = useState<StudyLevel>('fish');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAdminStudyDashboardData();
      setSnapshot(data);
      setQuotaInput(data.flag.cohortMaxPerLevel || 100);
      setRolloutNotes(data.flag.rolloutNotes || '');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo cargar la telemetría del estudio.');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const aggregates = useMemo(() => (snapshot ? computeStudyAggregates(snapshot) : null), [snapshot]);

  const handleToggleFlag = async (nextEnabled: boolean) => {
    setBusyAction('flag');
    try {
      await toggleMarketStudyFlagAdmin(nextEnabled, quotaInput, rolloutNotes);
      onStatus(
        nextEnabled
          ? 'Feature flag `market_study_v1` ACTIVADO en vivo para cohortes de estudio.'
          : 'Rollback ejecutado: `market_study_v1` APAGADO al instante (comportamiento Demo Final v5.0.0 restaurado).'
      );
      await loadSnapshot();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error actualizando feature flag.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleInitCohorts = async () => {
    setBusyAction('init');
    try {
      await initializeCohortsAdmin(quotaInput);
      onStatus(`Cohortes FISH / REG / NIT inicializadas con cupo ${quotaInput}/${quotaInput}/${quotaInput}.`);
      await loadSnapshot();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error inicializando cohortes.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleOverrideChange = async (uid: string, override: StudyLevel | 'none') => {
    setBusyAction(`ovr_${uid}`);
    try {
      await setParticipantAdminOverride(uid, override);
      onStatus(`Override de nivel actualizado para participante (${override.toUpperCase()}).`);
      await loadSnapshot();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error aplicando override.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleGenerateReminderPreview = async () => {
    setLoadingPreview(true);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/study/reminder-preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          displayName: 'Participante Estudio',
          level: previewLevel,
          milestone: previewMilestone,
          appUrl: getLabAppUrl()
        })
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || `Error ${res.status}`);
      }
      const data = (await res.json()) as { html?: string };
      setPreviewHtml(data.html || '');
      onStatus(`Plantilla de recordatorio ${previewMilestone.toUpperCase()} generada desde backend.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'No se pudo generar vista previa del recordatorio.');
    } finally {
      setLoadingPreview(false);
    }
  };

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Feature Flag Control */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <FlaskConical className="w-5 h-5 text-blue-400" />
              <h2 className="text-base font-bold text-white">
                Estudio de Mercado Controlado 30 Días (`market_study_v1`)
              </h2>
              <span
                className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                  snapshot?.flag.enabled
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-neutral-900 border-neutral-700 text-neutral-400'
                }`}
              >
                {snapshot?.flag.enabled ? 'FLAG: ON (ESTUDIO ACTIVO)' : 'FLAG: OFF (DEMO FINAL INTACTA)'}
              </span>
            </div>
            <p className="text-xs text-neutral-400">
              100 FISH + 100 REG + 100 NIT (300 total). Prioridad de densidad:{' '}
              <span className="font-mono text-neutral-200">admin_override &gt; cohort_assignment &gt; self_selected</span>.
              Reversión instantánea en &lt; 5 minutos sin redeploy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void loadSnapshot()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-200 rounded-xl cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={() => void handleInitCohorts()}
              disabled={busyAction !== null}
              className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-blue-500/40 text-xs font-semibold text-blue-300 rounded-xl cursor-pointer"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Inicializar Cupos ({quotaInput}/nivel)</span>
            </button>
            {snapshot?.flag.enabled ? (
              <button
                type="button"
                onClick={() => void handleToggleFlag(false)}
                disabled={busyAction !== null}
                className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Rollback Instantáneo (OFF)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleToggleFlag(true)}
                disabled={busyAction !== null}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Activar Estudio (`market_study_v1` ON)</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-neutral-900 text-xs">
          <div>
            <label className="text-[11px] text-neutral-400 block mb-1">Cupo máximo por nivel</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={quotaInput}
              onChange={(e) => setQuotaInput(Math.max(1, Number(e.target.value) || 100))}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white font-mono outline-none focus:border-blue-500"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[11px] text-neutral-400 block mb-1">Notas de despliegue / auditoría</label>
            <input
              type="text"
              value={rolloutNotes}
              onChange={(e) => setRolloutNotes(e.target.value)}
              placeholder="Ej: Cohorte piloto mes 1 · Verificada Regla R1–R8"
              className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Executive KPIs */}
      {aggregates && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl">
            <span className="text-neutral-400 block">Inscritos Activos</span>
            <strong className="text-2xl text-white font-mono mt-1 block">
              {aggregates.totalEnrolled}/{aggregates.totalQuota}
            </strong>
            <span className="text-[10px] text-neutral-500">Cupo total estudio</span>
          </div>
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl">
            <span className="text-neutral-400 block">Lista de Espera</span>
            <strong className="text-2xl text-amber-300 font-mono mt-1 block">
              {aggregates.totalWaitlisted}
            </strong>
            <span className="text-[10px] text-neutral-500">Anti-overbooking activo</span>
          </div>
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl">
            <span className="text-neutral-400 block">Retiros (GDPR Art.17)</span>
            <strong className="text-2xl text-rose-400 font-mono mt-1 block">
              {aggregates.totalWithdrawn}
            </strong>
            <span className="text-[10px] text-neutral-500">Purga &le; 30 días</span>
          </div>
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl">
            <span className="text-neutral-400 block">NPS Global</span>
            <strong className={`text-2xl font-mono mt-1 block ${aggregates.overallNps >= 30 ? 'text-emerald-400' : 'text-blue-400'}`}>
              {aggregates.overallNps > 0 ? `+${aggregates.overallNps}` : aggregates.overallNps}
            </strong>
            <span className="text-[10px] text-neutral-500">Escala -100 a +100</span>
          </div>
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl">
            <span className="text-neutral-400 block">PMF (Sean Ellis)</span>
            <strong className={`text-2xl font-mono mt-1 block ${aggregates.overallPmfPct >= 40 ? 'text-emerald-400' : 'text-amber-300'}`}>
              {aggregates.overallPmfPct}%
            </strong>
            <span className="text-[10px] text-neutral-500">Meta PMF: &ge; 40%</span>
          </div>
          <div className="p-4 bg-neutral-950 border border-neutral-800 rounded-2xl">
            <span className="text-neutral-400 block">Eventos Telemetría</span>
            <strong className="text-2xl text-cyan-300 font-mono mt-1 block">
              {aggregates.totalEvents}
            </strong>
            <span className="text-[10px] text-neutral-500">Cero PII registrada</span>
          </div>
        </div>
      )}

      {/* Cohort Cards by Level (FISH / REG / NIT) */}
      {aggregates && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {STUDY_LEVELS.map(level => {
            const meta = LEVEL_META[level];
            const stat = aggregates.byLevel[level];
            const fillPct = Math.min(100, Math.round((stat.currentCount / Math.max(1, stat.quota)) * 100));
            return (
              <div key={level} className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className={`inline-block font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${meta.badge}`}>
                      {meta.code}
                    </span>
                    <h3 className="text-sm font-bold text-white mt-1.5">{meta.label}</h3>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-lg font-bold text-white">
                      {stat.currentCount}/{stat.quota}
                    </div>
                    <div className="text-[10px] text-neutral-500">Espera: {stat.waitlistCount}</div>
                  </div>
                </div>

                <div className="h-2 bg-neutral-900 rounded-full overflow-hidden border border-neutral-800">
                  <div className={`h-full ${meta.bar}`} style={{ width: `${fillPct}%` }} />
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono">
                  <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <span className="text-[10px] text-neutral-500 block">Retención</span>
                    <strong className="text-emerald-400">{stat.retentionRatePct}%</strong>
                  </div>
                  <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <span className="text-[10px] text-neutral-500 block">NPS / PMF</span>
                    <strong className="text-blue-300">
                      {stat.npsScore} / {stat.pmfVeryDisappointedPct}%
                    </strong>
                  </div>
                  <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <span className="text-[10px] text-neutral-500 block">Satisfacción</span>
                    <strong className="text-white">{stat.avgLevelSatisfaction || '—'} / 5</strong>
                  </div>
                  <div className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl">
                    <span className="text-[10px] text-neutral-500 block">Eventos</span>
                    <strong className="text-cyan-300">{stat.eventsCount}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-neutral-900 text-[11px] text-neutral-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Densidad muy simple:</span>
                    <strong className="text-neutral-200 font-mono">{stat.densityDistribution.too_simple}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Densidad adecuada:</span>
                    <strong className="text-emerald-300 font-mono">{stat.densityDistribution.just_right}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Densidad sobrecargada:</span>
                    <strong className="text-amber-300 font-mono">{stat.densityDistribution.too_complex}</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Exports & Reminder Email Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Exportación Anonimizada (Sin PII · Ley 1581 / GDPR)</h3>
          </div>
          <p className="text-neutral-400 leading-relaxed">
            Genera reportes listos para análisis externo con identificadores seudonimizados (<code className="text-blue-300">PART-XXXXXXXX</code>)
            y protección anti-inyección CSV en comentarios abiertos.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!snapshot}
              onClick={() =>
                snapshot &&
                triggerDownload(
                  `market-study-v1-feedback-${new Date().toISOString().slice(0, 10)}.csv`,
                  exportStudyAnonymizedCsv(snapshot),
                  'text/csv;charset=utf-8'
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Feedback CSV</span>
            </button>
            <button
              type="button"
              disabled={!snapshot}
              onClick={() =>
                snapshot &&
                triggerDownload(
                  `market-study-v1-report-${new Date().toISOString().slice(0, 10)}.json`,
                  exportStudyAnonymizedJson(snapshot),
                  'application/json;charset=utf-8'
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-100 font-semibold rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Descargar Snapshot JSON</span>
            </button>
          </div>
        </div>

        <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-3 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Previsualizador de Recordatorios (Día 7/14/21/30)</h3>
            </div>
            <button
              type="button"
              onClick={() => void handleGenerateReminderPreview()}
              disabled={loadingPreview}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl cursor-pointer disabled:opacity-50"
            >
              {loadingPreview ? 'Generando...' : 'Generar Plantilla HTML'}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={previewMilestone}
              onChange={(e) => setPreviewMilestone(e.target.value as StudyMilestone)}
              className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
            >
              <option value="day7">Hito Día 7 (Semana 1)</option>
              <option value="day14">Hito Día 14 (Semana 2)</option>
              <option value="day21">Hito Día 21 (Semana 3)</option>
              <option value="day30">Hito Día 30 (Cierre)</option>
            </select>
            <select
              value={previewLevel}
              onChange={(e) => setPreviewLevel(e.target.value as StudyLevel)}
              className="bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-white outline-none"
            >
              <option value="fish">Cohorte FISH</option>
              <option value="reg">Cohorte REG</option>
              <option value="nit">Cohorte NIT</option>
            </select>
          </div>
          {previewHtml && (
            <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-900">
              <iframe
                title="Vista previa recordatorio estudio"
                srcDoc={previewHtml}
                sandbox=""
                className="w-full h-44 border-0"
              />
            </div>
          )}
        </div>
      </div>

      {/* Participants Table + Admin Override */}
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white">
              Participantes Inscritos ({snapshot?.enrollments.length ?? 0}) &amp; Override Administrativo
            </h3>
          </div>
          <span className="text-[11px] text-neutral-500">
            El Override fuerza la densidad visual sin alterar permisos de plan ni cupo de cohorte.
          </span>
        </div>

        {!snapshot || snapshot.enrollments.length === 0 ? (
          <div className="p-6 text-center text-neutral-500 border border-dashed border-neutral-800 rounded-xl">
            Aún no hay participantes inscritos en el estudio controlado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-[11px] text-neutral-400 uppercase font-mono">
                  <th className="py-2 pr-3">UID</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Cohorte</th>
                  <th className="py-2 pr-3">Efectivo</th>
                  <th className="py-2 pr-3">Origen</th>
                  <th className="py-2 pr-3">Hitos</th>
                  <th className="py-2 text-right">Admin Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {snapshot.enrollments.slice(0, 100).map(e => (
                  <tr key={e.uid} className="hover:bg-neutral-900/40">
                    <td className="py-2.5 pr-3 font-mono text-neutral-300">{e.uid.slice(0, 12)}…</td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono text-[10px] uppercase ${
                          e.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : e.status === 'waitlisted'
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {e.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                        {e.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 font-mono uppercase text-white">{e.cohortLevel}</td>
                    <td className="py-2.5 pr-3 font-mono uppercase text-blue-300 font-bold">{e.effectiveLevel}</td>
                    <td className="py-2.5 pr-3 font-mono text-neutral-400">{e.levelSource}</td>
                    <td className="py-2.5 pr-3 font-mono text-neutral-300">
                      {e.completedSurveys?.length ? e.completedSurveys.join(', ') : '—'}
                    </td>
                    <td className="py-2.5 text-right">
                      <select
                        value={e.adminOverrideLevel || 'none'}
                        disabled={busyAction === `ovr_${e.uid}`}
                        onChange={(ev) => void handleOverrideChange(e.uid, ev.target.value as StudyLevel | 'none')}
                        className="bg-neutral-900 border border-neutral-800 rounded-lg px-2 py-1 text-white font-mono text-[11px] outline-none focus:border-blue-500"
                      >
                        <option value="none">Sin override (Cohorte)</option>
                        <option value="fish">Forzar FISH</option>
                        <option value="reg">Forzar REG</option>
                        <option value="nit">Forzar NIT</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
