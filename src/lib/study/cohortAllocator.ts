/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Motor de Asignación Atómica de Cupos (100 FISH / 100 REG / 100 NIT = 300 Total).
 * Incluye lógica pura verificable en pruebas de concurrencia + reglas estrictas.
 */

import {
  DEFAULT_COHORT_QUOTA_PER_LEVEL,
  STUDY_DURATION_DAYS,
  type StudyCohortDoc,
  type StudyEnrollmentDoc,
  type StudyLevel
} from './studyTypes';
import { resolveEffectiveStudyLevel } from './levelConfig';

export interface CohortAllocationRequest {
  uid: string;
  requestedLevel: StudyLevel;
  hasActiveConsent: boolean;
  consentVersion: string;
  isAdult: boolean;
  adminOverrideLevel?: StudyLevel | 'none';
  nowMs?: number;
}

export interface CohortAllocationResult {
  accepted: boolean;
  outcome: 'enrolled' | 'waitlisted' | 'already_enrolled' | 'rejected_legal' | 'rejected_inactive';
  enrollment?: StudyEnrollmentDoc;
  updatedCohort?: StudyCohortDoc;
  message: string;
}

/**
 * Lógica pura transaccional usada dentro de `runTransaction` en Firestore y validada en tests de concurrencia.
 * Garantiza que `currentCount` nunca supera `maxQuota` (100 por nivel).
 */
export function allocateCohortSlotPure(
  cohort: StudyCohortDoc,
  existingEnrollment: StudyEnrollmentDoc | null,
  req: CohortAllocationRequest
): CohortAllocationResult {
  if (!req.hasActiveConsent || !req.isAdult) {
    return {
      accepted: false,
      outcome: 'rejected_legal',
      message: 'Se requiere consentimiento informado vigente y verificación >= 18 años.'
    };
  }

  if (!cohort.active) {
    return {
      accepted: false,
      outcome: 'rejected_inactive',
      message: 'La cohorte seleccionada se encuentra cerrada temporalmente.'
    };
  }

  if (existingEnrollment && existingEnrollment.status === 'active') {
    return {
      accepted: true,
      outcome: 'already_enrolled',
      enrollment: existingEnrollment,
      updatedCohort: cohort,
      message: `Ya estás inscrito en la cohorte ${existingEnrollment.cohortLevel.toUpperCase()}.`
    };
  }

  const nowMs = req.nowMs ?? Date.now();
  const maxQuota = Math.max(1, cohort.maxQuota || DEFAULT_COHORT_QUOTA_PER_LEVEL);
  const resolved = resolveEffectiveStudyLevel({
    adminOverrideLevel: req.adminOverrideLevel,
    cohortLevel: req.requestedLevel,
    selfSelectedLevel: req.requestedLevel
  });

  if (cohort.currentCount < maxQuota) {
    const updatedCohort: StudyCohortDoc = {
      ...cohort,
      maxQuota,
      currentCount: cohort.currentCount + 1
    };
    const enrollment: StudyEnrollmentDoc = {
      uid: req.uid,
      selfSelectedLevel: req.requestedLevel,
      cohortLevel: req.requestedLevel,
      adminOverrideLevel: req.adminOverrideLevel ?? 'none',
      effectiveLevel: resolved.effectiveLevel,
      levelSource: resolved.source,
      status: 'active',
      consentVersion: req.consentVersion,
      enrolledAtMs: nowMs,
      studyEndsAtMs: nowMs + STUDY_DURATION_DAYS * 24 * 60 * 60 * 1000,
      completedSurveys: []
    };
    return {
      accepted: true,
      outcome: 'enrolled',
      enrollment,
      updatedCohort,
      message: `Cupo asignado (${updatedCohort.currentCount}/${maxQuota}) en cohorte ${req.requestedLevel.toUpperCase()}.`
    };
  }

  // Cupo lleno (100/100) -> Lista de espera atómica sin desbordar maxQuota
  const updatedCohort: StudyCohortDoc = {
    ...cohort,
    maxQuota,
    waitlistCount: cohort.waitlistCount + 1
  };
  const enrollment: StudyEnrollmentDoc = {
    uid: req.uid,
    selfSelectedLevel: req.requestedLevel,
    cohortLevel: req.requestedLevel,
    adminOverrideLevel: req.adminOverrideLevel ?? 'none',
    effectiveLevel: resolved.effectiveLevel,
    levelSource: resolved.source,
    status: 'waitlisted',
    consentVersion: req.consentVersion,
    enrolledAtMs: nowMs,
    studyEndsAtMs: nowMs + STUDY_DURATION_DAYS * 24 * 60 * 60 * 1000,
    completedSurveys: []
  };
  return {
    accepted: true,
    outcome: 'waitlisted',
    enrollment,
    updatedCohort,
    message: `Cupos completos (${maxQuota}/${maxQuota}) para ${req.requestedLevel.toUpperCase()}. Quedaste registrado en lista de espera #${updatedCohort.waitlistCount}.`
  };
}
