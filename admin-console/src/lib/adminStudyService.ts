/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Self-contained Firestore & Analytics service for Market Study v1 inside Admin Console.
 * Uses client Firebase SDK directly on shared Firestore so it works on both Starter Tier and User-Owned projects.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './firebase';

export type StudyLevel = 'fish' | 'reg' | 'nit';
export type LevelSource = 'self_selected' | 'cohort_assignment' | 'admin_override';
export type StudyEnrollmentStatus = 'active' | 'waitlisted' | 'withdrawn' | 'completed';
export type StudyMilestone = 'day7' | 'day14' | 'day21' | 'day30';
export type PmfAnswer = 'very_disappointed' | 'somewhat_disappointed' | 'not_disappointed';
export type DensityFeedbackOption = 'too_simple' | 'just_right' | 'too_complex';

export const STUDY_LEVELS: readonly StudyLevel[] = ['fish', 'reg', 'nit'] as const;
export const MARKET_STUDY_FLAG_ID = 'market_study_v1' as const;

export interface AdminFeatureFlagDoc {
  flagId: 'market_study_v1';
  enabled: boolean;
  cohortMaxPerLevel: number;
  rolloutNotes: string;
  updatedByUid: string;
  updatedAt?: unknown;
}

export interface AdminStudyCohortDoc {
  level: StudyLevel;
  maxQuota: number;
  currentCount: number;
  waitlistCount: number;
  active: boolean;
  updatedAt?: unknown;
}

export interface AdminStudyEnrollmentDoc {
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
}

export interface AdminStudyFeedbackDoc {
  id: string;
  uid: string;
  cohortLevel: StudyLevel;
  effectiveLevel: StudyLevel;
  milestone: StudyMilestone;
  npsScore: number;
  pmfAnswer: PmfAnswer;
  levelSatisfaction: number;
  densityFeedback: DensityFeedbackOption;
  openComment: string;
}

export interface AdminStudyEventDoc {
  id: string;
  uid: string;
  sessionId: string;
  cohortLevel: StudyLevel;
  effectiveLevel: StudyLevel;
  eventName: string;
  module: string;
  durationMs: number;
}

export interface StudyLevelSummary {
  level: StudyLevel;
  quota: number;
  currentCount: number;
  waitlistCount: number;
  active: boolean;
  withdrawnCount: number;
  retentionRatePct: number;
  feedbackCount: number;
  npsScore: number;
  pmfVeryDisappointedPct: number;
  avgLevelSatisfaction: number;
  densityDistribution: Record<DensityFeedbackOption, number>;
  eventsCount: number;
}

export interface AdminStudyDashboardSnapshot {
  flag: AdminFeatureFlagDoc;
  cohorts: Record<StudyLevel, AdminStudyCohortDoc>;
  enrollments: AdminStudyEnrollmentDoc[];
  feedbacks: AdminStudyFeedbackDoc[];
  events: AdminStudyEventDoc[];
}

export interface AdminStudyAggregate {
  totalEnrolled: number;
  totalQuota: number;
  totalWaitlisted: number;
  totalWithdrawn: number;
  overallNps: number;
  overallPmfPct: number;
  totalEvents: number;
  byLevel: Record<StudyLevel, StudyLevelSummary>;
}

const DEFAULT_FLAG: AdminFeatureFlagDoc = {
  flagId: MARKET_STUDY_FLAG_ID,
  enabled: false,
  cohortMaxPerLevel: 100,
  rolloutNotes: 'Default OFF (Regla R1).',
  updatedByUid: 'system'
};

function defaultCohorts(maxQuota = 100): Record<StudyLevel, AdminStudyCohortDoc> {
  return {
    fish: { level: 'fish', maxQuota, currentCount: 0, waitlistCount: 0, active: true },
    reg: { level: 'reg', maxQuota, currentCount: 0, waitlistCount: 0, active: true },
    nit: { level: 'nit', maxQuota, currentCount: 0, waitlistCount: 0, active: true }
  };
}

export async function fetchAdminStudyDashboardData(): Promise<AdminStudyDashboardSnapshot> {
  const [flagSnap, cohortsSnap, enrollSnap, fbSnap, evSnap] = await Promise.all([
    getDoc(doc(db, 'featureFlags', MARKET_STUDY_FLAG_ID)),
    getDocs(query(collection(db, 'studyCohorts'), limit(10))),
    getDocs(query(collection(db, 'studyEnrollments'), orderBy('enrolledAtMs', 'desc'), limit(400))),
    getDocs(query(collection(db, 'studyFeedback'), limit(500))),
    getDocs(query(collection(db, 'studyEvents'), limit(500)))
  ]);

  const flagData = flagSnap.exists() ? (flagSnap.data() as Partial<AdminFeatureFlagDoc>) : null;
  const flag: AdminFeatureFlagDoc = {
    flagId: MARKET_STUDY_FLAG_ID,
    enabled: flagData?.enabled === true,
    cohortMaxPerLevel: typeof flagData?.cohortMaxPerLevel === 'number' ? flagData.cohortMaxPerLevel : 100,
    rolloutNotes: typeof flagData?.rolloutNotes === 'string' ? flagData.rolloutNotes : DEFAULT_FLAG.rolloutNotes,
    updatedByUid: typeof flagData?.updatedByUid === 'string' ? flagData.updatedByUid : 'system',
    updatedAt: flagData?.updatedAt
  };

  const cohorts = defaultCohorts(flag.cohortMaxPerLevel);
  for (const d of cohortsSnap.docs) {
    if (d.id === 'fish' || d.id === 'reg' || d.id === 'nit') {
      const data = d.data() as Partial<AdminStudyCohortDoc>;
      cohorts[d.id] = {
        level: d.id,
        maxQuota: typeof data.maxQuota === 'number' ? data.maxQuota : flag.cohortMaxPerLevel,
        currentCount: typeof data.currentCount === 'number' ? data.currentCount : 0,
        waitlistCount: typeof data.waitlistCount === 'number' ? data.waitlistCount : 0,
        active: typeof data.active === 'boolean' ? data.active : true,
        updatedAt: data.updatedAt
      };
    }
  }

  return {
    flag,
    cohorts,
    enrollments: enrollSnap.docs.map(d => d.data() as AdminStudyEnrollmentDoc),
    feedbacks: fbSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AdminStudyFeedbackDoc, 'id'>) })),
    events: evSnap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<AdminStudyEventDoc, 'id'>) }))
  };
}

export async function toggleMarketStudyFlagAdmin(
  enabled: boolean,
  cohortMaxPerLevel = 100,
  rolloutNotes?: string
): Promise<AdminFeatureFlagDoc> {
  const actorUid = auth.currentUser?.uid || 'admin';
  const normalizedQuota = Math.max(1, Math.min(1000, Math.round(cohortMaxPerLevel)));
  const notes =
    rolloutNotes?.trim().slice(0, 240) ||
    (enabled ? 'Estudio activado desde Consola Admin' : 'Rollback instantáneo ejecutado desde Consola Admin');

  await setDoc(
    doc(db, 'featureFlags', MARKET_STUDY_FLAG_ID),
    {
      flagId: MARKET_STUDY_FLAG_ID,
      enabled,
      cohortMaxPerLevel: normalizedQuota,
      rolloutNotes: notes,
      updatedByUid: actorUid,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );

  return {
    flagId: MARKET_STUDY_FLAG_ID,
    enabled,
    cohortMaxPerLevel: normalizedQuota,
    rolloutNotes: notes,
    updatedByUid: actorUid
  };
}

export async function initializeCohortsAdmin(maxQuota = 100): Promise<void> {
  const normalizedQuota = Math.max(1, Math.min(1000, Math.round(maxQuota)));
  for (const level of STUDY_LEVELS) {
    const ref = doc(db, 'studyCohorts', level);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        level,
        maxQuota: normalizedQuota,
        currentCount: 0,
        waitlistCount: 0,
        active: true,
        updatedAt: serverTimestamp()
      });
    } else {
      await updateDoc(ref, {
        maxQuota: normalizedQuota,
        active: true,
        updatedAt: serverTimestamp()
      });
    }
  }
}

export async function setParticipantAdminOverride(
  uid: string,
  overrideLevel: StudyLevel | 'none'
): Promise<void> {
  const ref = doc(db, 'studyEnrollments', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Inscripción no encontrada en /studyEnrollments.');
  }
  const current = snap.data() as AdminStudyEnrollmentDoc;

  // Priority invariant: admin_override > cohort_assignment > self_selected
  let effectiveLevel: StudyLevel = current.selfSelectedLevel || 'reg';
  let levelSource: LevelSource = 'self_selected';
  if (overrideLevel !== 'none') {
    effectiveLevel = overrideLevel;
    levelSource = 'admin_override';
  } else if (current.cohortLevel) {
    effectiveLevel = current.cohortLevel;
    levelSource = 'cohort_assignment';
  }

  await updateDoc(ref, {
    adminOverrideLevel: overrideLevel,
    effectiveLevel,
    levelSource,
    updatedAt: serverTimestamp()
  });
}

function computeNps(scores: number[]): number {
  if (scores.length === 0) return 0;
  let promoters = 0;
  let detractors = 0;
  for (const s of scores) {
    if (s >= 9) promoters++;
    else if (s <= 6) detractors++;
  }
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

function computePmf(answers: PmfAnswer[]): number {
  if (answers.length === 0) return 0;
  const very = answers.filter(a => a === 'very_disappointed').length;
  return Math.round((very / answers.length) * 1000) / 10;
}

export function computeStudyAggregates(snapshot: AdminStudyDashboardSnapshot): AdminStudyAggregate {
  const byLevel = {} as Record<StudyLevel, StudyLevelSummary>;

  for (const level of STUDY_LEVELS) {
    const cohort = snapshot.cohorts[level];
    const levelEnrolls = snapshot.enrollments.filter(e => e.cohortLevel === level);
    const activeCount = levelEnrolls.filter(e => e.status === 'active' || e.status === 'completed').length;
    const withdrawnCount = levelEnrolls.filter(e => e.status === 'withdrawn').length;
    const denom = activeCount + withdrawnCount;
    const retentionRatePct = denom > 0 ? Math.round((activeCount / denom) * 1000) / 10 : 100;

    const levelFbs = snapshot.feedbacks.filter(f => f.cohortLevel === level);
    const avgLevelSatisfaction =
      levelFbs.length > 0
        ? Math.round((levelFbs.reduce((s, f) => s + f.levelSatisfaction, 0) / levelFbs.length) * 100) / 100
        : 0;

    const densityDistribution: Record<DensityFeedbackOption, number> = {
      too_simple: 0,
      just_right: 0,
      too_complex: 0
    };
    for (const f of levelFbs) {
      densityDistribution[f.densityFeedback] = (densityDistribution[f.densityFeedback] || 0) + 1;
    }

    const eventsCount = snapshot.events.filter(ev => ev.cohortLevel === level).length;

    byLevel[level] = {
      level,
      quota: cohort.maxQuota,
      currentCount: Math.max(cohort.currentCount, activeCount),
      waitlistCount: cohort.waitlistCount,
      active: cohort.active,
      withdrawnCount,
      retentionRatePct,
      feedbackCount: levelFbs.length,
      npsScore: computeNps(levelFbs.map(f => f.npsScore)),
      pmfVeryDisappointedPct: computePmf(levelFbs.map(f => f.pmfAnswer)),
      avgLevelSatisfaction,
      densityDistribution,
      eventsCount
    };
  }

  return {
    totalEnrolled: STUDY_LEVELS.reduce((sum, l) => sum + byLevel[l].currentCount, 0),
    totalQuota: STUDY_LEVELS.reduce((sum, l) => sum + byLevel[l].quota, 0),
    totalWaitlisted: STUDY_LEVELS.reduce((sum, l) => sum + byLevel[l].waitlistCount, 0),
    totalWithdrawn: STUDY_LEVELS.reduce((sum, l) => sum + byLevel[l].withdrawnCount, 0),
    overallNps: computeNps(snapshot.feedbacks.map(f => f.npsScore)),
    overallPmfPct: computePmf(snapshot.feedbacks.map(f => f.pmfAnswer)),
    totalEvents: snapshot.events.length,
    byLevel
  };
}

function anonymizeUid(uid: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < uid.length; i++) {
    h ^= uid.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `PART-${(h >>> 0).toString(16).padStart(8, '0').toUpperCase()}`;
}

function csvSafeCell(val: unknown): string {
  const s = String(val ?? '').replace(/"/g, '""');
  return `"${/^[=+\-@]/.test(s) ? `'${s}` : s}"`;
}

export function exportStudyAnonymizedCsv(snapshot: AdminStudyDashboardSnapshot): string {
  const header = [
    'participantId',
    'cohortLevel',
    'effectiveLevel',
    'milestone',
    'npsScore',
    'pmfAnswer',
    'levelSatisfaction',
    'densityFeedback',
    'openComment'
  ].join(',');
  const rows = snapshot.feedbacks.map(f =>
    [
      csvSafeCell(anonymizeUid(f.uid)),
      csvSafeCell(f.cohortLevel),
      csvSafeCell(f.effectiveLevel),
      csvSafeCell(f.milestone),
      csvSafeCell(f.npsScore),
      csvSafeCell(f.pmfAnswer),
      csvSafeCell(f.levelSatisfaction),
      csvSafeCell(f.densityFeedback),
      csvSafeCell(f.openComment)
    ].join(',')
  );
  return [header, ...rows].join('\n');
}

export function exportStudyAnonymizedJson(snapshot: AdminStudyDashboardSnapshot): string {
  return JSON.stringify(
    {
      exportedAtIso: new Date().toISOString(),
      piiStripped: true,
      aggregate: computeStudyAggregates(snapshot),
      participants: snapshot.enrollments.map(e => ({
        participantId: anonymizeUid(e.uid),
        cohortLevel: e.cohortLevel,
        effectiveLevel: e.effectiveLevel,
        levelSource: e.levelSource,
        status: e.status,
        completedSurveys: e.completedSurveys,
        enrolledAtIso: new Date(e.enrolledAtMs).toISOString()
      })),
      feedbacks: snapshot.feedbacks.map(f => ({
        participantId: anonymizeUid(f.uid),
        cohortLevel: f.cohortLevel,
        effectiveLevel: f.effectiveLevel,
        milestone: f.milestone,
        npsScore: f.npsScore,
        pmfAnswer: f.pmfAnswer,
        levelSatisfaction: f.levelSatisfaction,
        densityFeedback: f.densityFeedback,
        openComment: f.openComment
      }))
    },
    null,
    2
  );
}
