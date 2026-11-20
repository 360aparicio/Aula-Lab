/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Onboarding Adaptativo de 3 Pasos (FASE 2A) — Activo únicamente con market_study_v1 = ON.
 * Paso 1: Consentimiento Informado (Ley 1581/2012 + GDPR) & Gate estricto >= 18 años.
 * Paso 2: Selección de perfil cognitivo (FISH / REG / NIT) con vista previa de densidad.
 * Paso 3: Confirmación y asignación atómica de cupo (100 por nivel).
 */

import React, { useState } from 'react';
import type { User } from 'firebase/auth';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Compass,
  Layers,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X
} from 'lucide-react';
import {
  CONSENT_VERSION,
  INFORMED_CONSENT_SECTIONS,
  LEGAL_CONTROLLER_NAME,
  LEGAL_DPO_EMAIL,
  validateAdultAge
} from '../../lib/study/legalCompliance';
import { STUDY_LEVEL_CONFIGS } from '../../lib/study/levelConfig';
import { acceptConsentAndEnrollStudy } from '../../lib/study/studyService';
import type { StudyCohortDoc, StudyEnrollmentDoc, StudyLevel } from '../../lib/study/studyTypes';
import { STUDY_LEVELS } from '../../lib/study/studyTypes';

interface AdaptiveOnboardingModalProps {
  open: boolean;
  user: User;
  cohorts: Record<StudyLevel, StudyCohortDoc>;
  onClose: () => void;
  onEnrolled: (enrollment: StudyEnrollmentDoc, effectiveLevel: StudyLevel) => void;
}

export const AdaptiveOnboardingModal: React.FC<AdaptiveOnboardingModalProps> = ({
  open,
  user,
  cohorts,
  onClose,
  onEnrolled
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [birthYearInput, setBirthYearInput] = useState<string>('');
  const [acceptedConsent, setAcceptedConsent] = useState<boolean>(false);
  const [selectedLevel, setSelectedLevel] = useState<StudyLevel>('reg');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completionMessage, setCompletionMessage] = useState<string | null>(null);

  if (!open) return null;

  const parsedBirthYear = Number.parseInt(birthYearInput.trim(), 10);
  const ageValidation = Number.isInteger(parsedBirthYear)
    ? validateAdultAge(parsedBirthYear)
    : { valid: false, ageYears: 0, reason: 'Ingresa tu año de nacimiento (4 dígitos).' };

  const handleNextFromStep1 = () => {
    setErrorMsg(null);
    if (!ageValidation.valid) {
      setErrorMsg(ageValidation.reason || 'Acceso restringido a mayores de 18 años.');
      return;
    }
    if (!acceptedConsent) {
      setErrorMsg('Debes marcar manualmente la casilla de consentimiento informado para continuar.');
      return;
    }
    setStep(2);
  };

  const handleEnroll = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const result = await acceptConsentAndEnrollStudy({
        user,
        birthYear: parsedBirthYear,
        acceptedConsent,
        requestedLevel: selectedLevel
      });
      if (!result.accepted || !result.enrollment) {
        setErrorMsg(result.message);
        return;
      }
      setCompletionMessage(result.message);
      onEnrolled(result.enrollment, result.enrollment.effectiveLevel);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo completar tu inscripción al estudio.');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedConfig = STUDY_LEVEL_CONFIGS[selectedLevel];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Inscripción al Estudio de Mercado Allin School"
    >
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between gap-4 bg-neutral-900/50">
          <div className="space-y-0.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-blue-400 font-semibold">
              Estudio Controlado 30 Días · Paso {step} de 3
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              {step === 1 && 'Consentimiento Informado y Verificación de Edad (>= 18)'}
              {step === 2 && 'Elige tu Perfil de Densidad Cognitiva (FISH / REG / NIT)'}
              {step === 3 && 'Confirmación de Cohorte y Espacio Adaptado'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar asistente de estudio"
            className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 pt-4 grid grid-cols-3 gap-2">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`h-1.5 rounded-full transition-colors ${
                step >= n ? 'bg-blue-500' : 'bg-neutral-800'
              }`}
            />
          ))}
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-700 text-rose-200 font-medium">
              {errorMsg}
            </div>
          )}

          {completionMessage && (
            <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{completionMessage}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-neutral-900/70 border border-neutral-800 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-white">
                    Marco Dual: Ley 1581 de 2012 (Colombia) &amp; GDPR · Versión {CONSENT_VERSION}
                  </div>
                  <p className="text-neutral-400 leading-relaxed">
                    Responsable: <strong className="text-neutral-200">{LEGAL_CONTROLLER_NAME}</strong> · Contacto DPO:{' '}
                    <span className="font-mono text-blue-300">{LEGAL_DPO_EMAIL}</span>.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                {INFORMED_CONSENT_SECTIONS.map(sec => (
                  <div key={sec.id} className="p-3.5 rounded-xl bg-black border border-neutral-800 space-y-1">
                    <div className="font-bold text-white">{sec.title}</div>
                    <p className="text-neutral-400 leading-relaxed">{sec.body}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label htmlFor="study-birth-year" className="block font-semibold text-neutral-200">
                    Año de nacimiento (obligatorio, debes ser mayor de 18 años)
                  </label>
                  <input
                    id="study-birth-year"
                    type="number"
                    min={1920}
                    max={new Date().getUTCFullYear()}
                    placeholder="Ej: 1995"
                    value={birthYearInput}
                    onChange={(e) => setBirthYearInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black border border-neutral-800 focus:border-blue-500 text-white font-mono outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 cursor-pointer select-none w-full">
                    <input
                      type="checkbox"
                      checked={acceptedConsent}
                      onChange={(e) => setAcceptedConsent(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-blue-600 cursor-pointer shrink-0"
                    />
                    <span className="text-[11px] text-neutral-300 leading-snug">
                      Confirmo que soy mayor de 18 años y otorgo mi consentimiento explícito (v{CONSENT_VERSION}) para participar en el estudio educativo de 30 días.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-neutral-400 leading-relaxed">
                Tu nivel determina únicamente la <strong className="text-white">densidad visual y claridad del vocabulario</strong>. Todos los permisos de tu suscripción actual se mantienen intactos.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {STUDY_LEVELS.map(lvl => {
                  const cfg = STUDY_LEVEL_CONFIGS[lvl];
                  const cohort = cohorts[lvl];
                  const remaining = Math.max(0, (cohort?.maxQuota ?? 100) - (cohort?.currentCount ?? 0));
                  const isSelected = selectedLevel === lvl;

                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSelectedLevel(lvl)}
                      className={`p-4 rounded-xl border text-left flex flex-col justify-between gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-950/30 border-blue-500 shadow-lg shadow-blue-500/10'
                          : 'bg-black border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`font-mono text-xs font-extrabold px-2 py-0.5 rounded border ${cfg.accentClass}`}>
                            {cfg.shortCode}
                          </span>
                          <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
                            {remaining > 0 ? `${remaining} cupos` : 'Lista de espera'}
                          </span>
                        </div>
                        <div className="text-sm font-bold text-white">{cfg.audienceTitle}</div>
                        <p className="text-neutral-400 leading-relaxed">{cfg.description}</p>
                      </div>
                      <div className="pt-2 border-t border-neutral-800/80 text-[11px] text-neutral-300 font-medium">
                        {cfg.densitySummary}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="p-5 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-3">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                  <div className="text-sm font-bold text-white">Resumen de tu Experiencia Adaptada</div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-xl bg-black border border-neutral-800 space-y-1">
                    <div className="text-[11px] text-neutral-500 uppercase font-mono">Cohorte Asignada</div>
                    <div className="text-sm font-bold text-white">{selectedConfig.label}</div>
                    <div className="text-[11px] text-neutral-400">{selectedConfig.densitySummary}</div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-black border border-neutral-800 space-y-1">
                    <div className="text-[11px] text-neutral-500 uppercase font-mono">Vista Inicial</div>
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Compass className="w-4 h-4 text-blue-400" />
                      <span>
                        {selectedConfig.defaultTab === 'fundamentals'
                          ? 'Módulo 0 · Fundamentos'
                          : selectedConfig.defaultTab === 'solver'
                          ? 'Lab Studio · Árbol DCFR'
                          : 'Paso a Paso · Guía 6-Max'}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-400">
                      Cambiable en cualquier momento desde la barra superior.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-neutral-400 pt-1">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    Consentimiento v{CONSENT_VERSION} verificado (&gt;= 18 años) · Retiro libre en 1 clic desde tu perfil de estudio.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-black/70 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setStep((step - 1) as 1 | 2);
              }}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-200 cursor-pointer disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
            >
              Decidir después
            </button>
          )}

          {step === 1 && (
            <button
              type="button"
              onClick={handleNextFromStep1}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
            >
              <span>Continuar al Perfil</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 2 && (
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setStep(3);
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold text-white cursor-pointer"
            >
              <span>Revisar y Confirmar</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 3 && (
            <button
              type="button"
              onClick={() => void handleEnroll()}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer disabled:opacity-60"
            >
              <Layers className="w-4 h-4" />
              <span>{submitting ? 'Asignando cupo...' : 'Confirmar e Iniciar Estudio'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
