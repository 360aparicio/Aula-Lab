/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Contratos tipados para el Estudio de Mercado Controlado (market_study_v1).
 * Aislado completamente cuando el feature flag está OFF (Regla R1/R2).
 */

export type StudyLevel = 'fish' | 'reg' | 'nit';

export type LevelSource = 'self_selected' | 'cohort_assignment' | 'admin_override';

export type LegacyExperienceLevel = 'beginner' | 'recreational' | 'regular' | 'pro';

export type StudyEnrollmentStatus = 'active' | 'waitlisted' | 'withdrawn' | 'completed';

export type StudyMilestone = 'day7' | 'day14' | 'day21' | 'day30';

export type PmfAnswer = 'very_disappointed' | 'somewhat_disappointed' | 'not_disappointed';

export type DensityFeedbackOption = 'too_simple' | 'just_right' | 'too_complex';

export type StudyEventName =
  | 'study_enrolled'
  | 'study_withdrawn'
  | 'level_selected'
  | 'tab_viewed'
  | 'hand_simulated'
  | 'solver_calculated'
  | 'academy_evaluated'
  | 'tracker2_imported'
  | 'survey_submitted'
  | 'session_heartbeat';

export interface FeatureFlagDoc {
  flagId: 'market_study_v1';
  enabled: boolean;
  cohortMaxPerLevel: number;
  rolloutNotes: string;
  updatedByUid: string;
  updatedAt?: unknown;
}

export interface StudyCohortDoc {
  level: StudyLevel;
  maxQuota: number;
  currentCount: number;
  waitlistCount: number;
  active: boolean;
  updatedAt?: unknown;
}

export interface StudyConsentDoc {
  uid: string;
  consentVersion: string;
  accepted: boolean;
  isAdult: boolean;
  birthYear: number;
  jurisdiction: 'CO_1581_GDPR';
  ipHash: string;
  countryCode: string;
  userAgent: string;
  status: 'active' | 'revoked';
  acceptedAt?: unknown;
  revokedAt?: unknown;
}

export interface StudyEnrollmentDoc {
  uid: string;
  selfSelectedLevel: StudyLevel;
  cohortLevel: StudyLevel;
  adminOverrideLevel: StudyLevel | 'none';
  effectiveLevel: StudyLevel;
  levelSource: LevelSource;
  status: StudyEnrollmentStatus;
  consentVersion: string;
  enrolledAtMs: number;
  studyEndsAtMs: number;
  completedSurveys: StudyMilestone[];
  withdrawnAtMs?: number;
  purgeScheduledAtMs?: number;
  enrolledAt?: unknown;
  updatedAt?: unknown;
}

export interface StudyEventDoc {
  id?: string;
  uid: string;
  sessionId: string;
  cohortLevel: StudyLevel;
  effectiveLevel: StudyLevel;
  eventName: StudyEventName;
  module: string;
  durationMs: number;
  metadataJson: string;
  expiresAtMs: number;
  createdAt?: unknown;
}

export interface StudyFeedbackDoc {
  id?: string;
  uid: string;
  cohortLevel: StudyLevel;
  effectiveLevel: StudyLevel;
  milestone: StudyMilestone;
  npsScore: number;
  pmfAnswer: PmfAnswer;
  levelSatisfaction: number;
  densityFeedback: DensityFeedbackOption;
  openComment: string;
  expiresAtMs: number;
  createdAt?: unknown;
}

export const STUDY_LEVELS: readonly StudyLevel[] = ['fish', 'reg', 'nit'] as const;
export const DEFAULT_COHORT_QUOTA_PER_LEVEL = 100;
export const STUDY_DURATION_DAYS = 30;
