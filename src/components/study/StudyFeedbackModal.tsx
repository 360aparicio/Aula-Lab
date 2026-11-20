/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Modal de Encuesta Periódica (Días 7 / 14 / 21 / 30) + Panel de Privacidad & Retiro GDPR.
 * - Captura NPS (0-10), Sean Ellis PMF, Satisfacción de Nivel (1-5) y Calibración de Densidad.
 * - Incluye botón "Retirarme del estudio" con confirmación en dos pasos sin window.confirm.
 */

import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  Star,
  X
} from 'lucide-react';
import {
  submitStudyMilestoneFeedback,
  withdrawFromMarketStudy
} from '../../lib/study/studyService';
import { STUDY_MILESTONE_SCHEDULE } from '../../lib/study/milestoneScheduler';
import { LEGAL_DPO_EMAIL, RETENTION_POLICY } from '../../lib/study/legalCompliance';
import type {
  DensityFeedbackOption,
  PmfAnswer,
  StudyEnrollmentDoc,
  StudyMilestone
} from '../../lib/study/studyTypes';

interface StudyFeedbackModalProps {
  open: boolean;
  user: User;
  enrollment: StudyEnrollmentDoc;
  initialMilestone?: StudyMilestone;
  initialTab?: 'survey' | 'privacy';
  onClose: () => void;
  onSubmitted: (milestone: StudyMilestone) => void;
  onWithdrawn: () => void;
}

export const StudyFeedbackModal: React.FC<StudyFeedbackModalProps> = ({
  open,
  user,
  enrollment,
  initialMilestone = 'day7',
  initialTab = 'survey',
  onClose,
  onSubmitted,
  onWithdrawn
}) => {
  const [activeTab, setActiveTab] = useState<'survey' | 'privacy'>(initialTab);
  const [milestone, setMilestone] = useState<StudyMilestone>(initialMilestone);
  const [npsScore, setNpsScore] = useState<number>(9);
  const [pmfAnswer, setPmfAnswer] = useState<PmfAnswer>('very_disappointed');
  const [levelSatisfaction, setLevelSatisfaction] = useState<number>(5);
  const [densityFeedback, setDensityFeedback] = useState<DensityFeedbackOption>('just_right');
  const [openComment, setOpenComment] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [confirmWithdrawStep, setConfirmWithdrawStep] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmitting(true);
    try {
      await submitStudyMilestoneFeedback({
        user,
        cohortLevel: enrollment.cohortLevel,
        effectiveLevel: enrollment.effectiveLevel,
        milestone,
        npsScore,
        pmfAnswer,
        levelSatisfaction,
        densityFeedback,
        openComment,
        currentCompletedSurveys: enrollment.completedSurveys || []
      });
      setSuccessMsg('¡Gracias! Tu feedback quedó registrado de forma segura.');
      onSubmitted(milestone);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar tu respuesta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await withdrawFromMarketStudy(user);
      onWithdrawn();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo completar el retiro del estudio.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Feedback del Estudio de Mercado y Privacidad"
    >
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between gap-3 bg-neutral-900/50">
          <div className="flex items-center gap-2.5">
            <ClipboardCheck className="w-5 h-5 text-blue-400 shrink-0" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Estudio de Mercado 30 Días · Cohorte {enrollment.cohortLevel.toUpperCase()}
              </h2>
              <p className="text-[11px] text-neutral-400">
                Encuestas de calibración (Días 7/14/21/30) y control total de tus datos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subtabs */}
        <div className="px-6 pt-3 border-b border-neutral-800 flex items-center gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('survey')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'survey'
                ? 'border-blue-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Encuesta de Satisfacción &amp; PMF
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'privacy'
                ? 'border-rose-500 text-white'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            Privacidad &amp; Retiro del Estudio
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-700 text-rose-200">
              {errorMsg}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'survey' ? (
            <form onSubmit={(e) => void handleSubmitSurvey(e)} className="space-y-5">
              {/* Milestone Selector */}
              <div className="space-y-1.5">
                <label className="block font-semibold text-neutral-200">Hito del estudio</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STUDY_MILESTONE_SCHEDULE.map(item => {
                    const done = enrollment.completedSurveys?.includes(item.milestone);
                    return (
                      <button
                        key={item.milestone}
                        type="button"
                        onClick={() => setMilestone(item.milestone)}
                        className={`px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                          milestone === item.milestone
                            ? 'bg-blue-950/40 border-blue-500 text-white font-bold'
                            : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        <div className="text-[11px]">{item.label}</div>
                        <div className="text-[10px] text-emerald-400 font-mono">
                          {done ? 'Respondida' : 'Pendiente'}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NPS 0-10 */}
              <div className="space-y-2">
                <label className="block font-semibold text-neutral-200">
                  1. ¿Qué probabilidad hay de que recomiendes Allin School a otro jugador? (NPS 0–10)
                </label>
                <div className="grid grid-cols-11 gap-1">
                  {Array.from({ length: 11 }, (_, i) => i).map(score => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setNpsScore(score)}
                      className={`py-2 rounded-lg font-mono font-bold border transition-colors cursor-pointer ${
                        npsScore === score
                          ? 'bg-blue-600 border-blue-400 text-white'
                          : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sean Ellis PMF */}
              <div className="space-y-2">
                <label className="block font-semibold text-neutral-200">
                  2. ¿Cómo te sentirías si ya no pudieras usar esta plataforma para estudiar? (PMF)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'very_disappointed' as const, label: 'Muy decepcionado/a' },
                    { id: 'somewhat_disappointed' as const, label: 'Algo decepcionado/a' },
                    { id: 'not_disappointed' as const, label: 'Nada decepcionado/a' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPmfAnswer(opt.id)}
                      className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                        pmfAnswer === opt.id
                          ? 'bg-blue-950/40 border-blue-500 text-white font-bold'
                          : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Level Satisfaction + Density */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block font-semibold text-neutral-200">
                    3. Utilidad de tu perfil ({enrollment.effectiveLevel.toUpperCase()})
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setLevelSatisfaction(star)}
                        className={`flex-1 py-2 rounded-xl border flex items-center justify-center gap-1 cursor-pointer ${
                          levelSatisfaction >= star
                            ? 'bg-amber-500/15 border-amber-500/50 text-amber-300'
                            : 'bg-black border-neutral-800 text-neutral-500'
                        }`}
                      >
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span className="font-mono font-bold">{star}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block font-semibold text-neutral-200">
                    4. Densidad visual e información
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { id: 'too_simple' as const, label: 'Muy simple' },
                      { id: 'just_right' as const, label: 'Justo bien' },
                      { id: 'too_complex' as const, label: 'Muy denso' }
                    ].map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setDensityFeedback(opt.id)}
                        className={`py-2 px-2 rounded-xl border text-[11px] cursor-pointer ${
                          densityFeedback === opt.id
                            ? 'bg-blue-600 border-blue-400 text-white font-bold'
                            : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Open Comment */}
              <div className="space-y-1.5">
                <label htmlFor="study-open-comment" className="block font-semibold text-neutral-200">
                  5. ¿Qué mejorarías o qué fue lo más valioso esta semana? (opcional)
                </label>
                <textarea
                  id="study-open-comment"
                  rows={3}
                  maxLength={800}
                  value={openComment}
                  onChange={(e) => setOpenComment(e.target.value)}
                  placeholder="Comparte sugerencias concretas sobre claridad, velocidad o herramientas..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-neutral-800 focus:border-blue-500 text-white outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-semibold cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold cursor-pointer disabled:opacity-60"
                >
                  {submitting ? 'Guardando...' : 'Enviar Encuesta'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 space-y-2">
                <div className="font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Derecho al Olvido &amp; Revocación Inmediata (Ley 1581 / GDPR Art. 17)</span>
                </div>
                <p className="text-neutral-400 leading-relaxed">
                  Si decides retirarte del estudio de mercado: (1) tu consentimiento pasará inmediatamente a estado revocado; (2) tu cupo en la cohorte se liberará; (3) tus eventos de telemetría y respuestas de encuesta se eliminarán en cascada en un máximo de {RETENTION_POLICY.withdrawalPurgeMaxDays} días (los eventos activos se purgan de inmediato). Tu cuenta académica normal en Allin School permanece intacta.
                </p>
                <p className="text-[11px] text-neutral-500 font-mono">
                  Contacto DPO: {LEGAL_DPO_EMAIL}
                </p>
              </div>

              {!confirmWithdrawStep ? (
                <button
                  type="button"
                  onClick={() => setConfirmWithdrawStep(true)}
                  className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-700/70 text-rose-200 font-bold cursor-pointer"
                >
                  Retirarme del estudio
                </button>
              ) : (
                <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-700 space-y-3">
                  <div className="flex items-start gap-2.5 text-rose-200">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>
                      ¿Confirmas la revocación de tu consentimiento y el borrado de tu telemetría/feedback del estudio? Esta acción no se puede deshacer.
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleWithdraw()}
                      disabled={submitting}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer disabled:opacity-60"
                    >
                      {submitting ? 'Procesando retiro...' : 'Sí, retirar y borrar datos del estudio'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWithdrawStep(false)}
                      disabled={submitting}
                      className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
