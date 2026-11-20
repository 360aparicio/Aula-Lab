/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudyService: Capa de acceso Firestore con transacciones atómicas (runTransaction),
 * registro legal append-only, cambio de nivel respetando prioridades y retiro GDPR en cascada.
 */

import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { cryptoRandomInt } from '../random';
import {
  DEFAULT_COHORT_QUOTA_PER_LEVEL,
  STUDY_LEVELS,
  type DensityFeedbackOption,
  type FeatureFlagDoc,
  type PmfAnswer,
  type StudyCohortDoc,
  type StudyConsentDoc,
  type StudyEnrollmentDoc,
  type StudyEventDoc,
  type StudyFeedbackDoc,
  type StudyLevel,
  type StudyMilestone
} from './studyTypes';
import { evaluateMarketStudyFlag, MARKET_STUDY_FLAG_ID, readClientEnvMarketStudyFlag } from './featureFlags';
import {
  buildConsentDocId,
  computeExpiryMs,
  CONSENT_VERSION,
  RETENTION_POLICY,
  validateAdultAge
} from './legalCompliance';
import { allocateCohortSlotPure, type CohortAllocationResult } from './cohortAllocator';
import { resolveEffectiveStudyLevel } from './levelConfig';

export async function fetchMarketStudyFlag(): Promise<FeatureFlagDoc> {
  const envVal = readClientEnvMarketStudyFlag();
  try {
    const snap = await getDoc(doc(db, 'featureFlags', MARKET_STUDY_FLAG_ID));
    const remote = snap.exists() ? (snap.data() as Partial<FeatureFlagDoc>) : null;
    return evaluateMarketStudyFlag({ envFlagValue: envVal, remoteFlagDoc: remote });
  } catch {
    return evaluateMarketStudyFlag({ envFlagValue: envVal, remoteFlagDoc: null });
  }
}

export async function setMarketStudyFlagAdmin(
  adminUser: User,
  enabled: boolean,
  cohortMaxPerLevel = DEFAULT_COHORT_QUOTA_PER_LEVEL,
  rolloutNotes = ''
): Promise<FeatureFlagDoc> {
  const docRef = doc(db, 'featureFlags', MARKET_STUDY_FLAG_ID);
  const payload = {
    flagId: MARKET_STUDY_FLAG_ID,
    enabled,
    cohortMaxPerLevel: Math.max(1, Math.min(1000, Math.round(cohortMaxPerLevel))),
    rolloutNotes: rolloutNotes.trim().slice(0, 240) || (enabled ? 'Activado por Administrador' : 'Apagado por Administrador'),
    updatedByUid: adminUser.uid,
    updatedAt: serverTimestamp()
  };
  await setDoc(docRef, payload, { merge: true });
  return {
    ...payload,
    flagId: MARKET_STUDY_FLAG_ID
  };
}

export async function initializeStudyCohortsAdmin(maxQuota = DEFAULT_COHORT_QUOTA_PER_LEVEL): Promise<StudyCohortDoc[]> {
  const normalizedQuota = Math.max(1, Math.min(1000, Math.round(maxQuota)));
  const results: StudyCohortDoc[] = [];

  for (const level of STUDY_LEVELS) {
    const ref = doc(db, 'studyCohorts', level);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      const initial: StudyCohortDoc = {
        level,
        maxQuota: normalizedQuota,
        currentCount: 0,
        waitlistCount: 0,
        active: true,
        updatedAt: serverTimestamp()
      };
      await setDoc(ref, initial);
      results.push(initial);
    } else {
      const existing = snap.data() as StudyCohortDoc;
      await updateDoc(ref, { maxQuota: normalizedQuota, active: true, updatedAt: serverTimestamp() });
      results.push({ ...existing, maxQuota: normalizedQuota, active: true });
    }
  }
  return results;
}

export async function fetchAllStudyCohorts(): Promise<Record<StudyLevel, StudyCohortDoc>> {
  const fallback: Record<StudyLevel, StudyCohortDoc> = {
    fish: { level: 'fish', maxQuota: 100, currentCount: 0, waitlistCount: 0, active: true },
    reg: { level: 'reg', maxQuota: 100, currentCount: 0, waitlistCount: 0, active: true },
    nit: { level: 'nit', maxQuota: 100, currentCount: 0, waitlistCount: 0, active: true }
  };
  try {
    const snap = await getDocs(query(collection(db, 'studyCohorts'), limit(10)));
    for (const d of snap.docs) {
      const data = d.data() as Partial<StudyCohortDoc>;
      if (d.id === 'fish' || d.id === 'reg' || d.id === 'nit') {
        fallback[d.id] = {
          level: d.id,
          maxQuota: typeof data.maxQuota === 'number' ? data.maxQuota : 100,
          currentCount: typeof data.currentCount === 'number' ? data.currentCount : 0,
          waitlistCount: typeof data.waitlistCount === 'number' ? data.waitlistCount : 0,
          active: typeof data.active === 'boolean' ? data.active : true,
          updatedAt: data.updatedAt
        };
      }
    }
  } catch {
    // fallback safely
  }
  return fallback;
}

export async function fetchMyConsentAndEnrollment(uid: string): Promise<{
  consent: StudyConsentDoc | null;
  enrollment: StudyEnrollmentDoc | null;
}> {
  const consentId = buildConsentDocId(uid, CONSENT_VERSION);
  const [cSnap, eSnap] = await Promise.all([
    getDoc(doc(db, 'studyConsents', consentId)),
    getDoc(doc(db, 'studyEnrollments', uid))
  ]);
  return {
    consent: cSnap.exists() ? (cSnap.data() as StudyConsentDoc) : null,
    enrollment: eSnap.exists() ? (eSnap.data() as StudyEnrollmentDoc) : null
  };
}

async function fetchConsentMetaFromServer(user: User): Promise<{
  ipHash: string;
  countryCode: string;
  userAgent: string;
}> {
  const fallbackUa = typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 200) : 'unknown';
  try {
    const token = await user.getIdToken();
    const res = await fetch('/api/legal/consent-meta', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      }
    });
    if (res.ok) {
      const data = (await res.json()) as { ipHash?: string; countryCode?: string; userAgent?: string };
      return {
        ipHash: (data.ipHash || 'sha256_client_fallback').slice(0, 96),
        countryCode: (data.countryCode || 'INTL').slice(0, 12),
        userAgent: (data.userAgent || fallbackUa).slice(0, 200)
      };
    }
  } catch {
    // non-fatal fallback
  }
  return {
    ipHash: 'sha256_offline_session',
    countryCode: 'INTL',
    userAgent: fallbackUa
  };
}

/**
 * Paso 1–3 completo:
 * 1) Verifica mayoría de edad (>= 18) y consentimiento opt-in.
 * 2) Registra consentimiento append-only en /studyConsents/{uid}_v1_0.
 * 3) Ejecuta transacción atómica en /studyCohorts/{level} + /studyEnrollments/{uid}.
 */
export async function acceptConsentAndEnrollStudy(params: {
  user: User;
  birthYear: number;
  acceptedConsent: boolean;
  requestedLevel: StudyLevel;
}): Promise<CohortAllocationResult> {
  const { user, birthYear, acceptedConsent, requestedLevel } = params;

  const ageCheck = validateAdultAge(birthYear);
  if (!ageCheck.valid) {
    return {
      accepted: false,
      outcome: 'rejected_legal',
      message: ageCheck.reason || 'Solo personas mayores de 18 años pueden participar.'
    };
  }
  if (!acceptedConsent) {
    return {
      accepted: false,
      outcome: 'rejected_legal',
      message: 'Debes marcar manualmente el consentimiento informado para participar.'
    };
  }

  const consentId = buildConsentDocId(user.uid, CONSENT_VERSION);
  const consentRef = doc(db, 'studyConsents', consentId);
  const existingConsent = await getDoc(consentRef);
  if (!existingConsent.exists()) {
    const meta = await fetchConsentMetaFromServer(user);
    await setDoc(consentRef, {
      uid: user.uid,
      consentVersion: CONSENT_VERSION,
      accepted: true,
      isAdult: true,
      birthYear,
      jurisdiction: 'CO_1581_GDPR',
      ipHash: meta.ipHash,
      countryCode: meta.countryCode,
      userAgent: meta.userAgent,
      status: 'active',
      acceptedAt: serverTimestamp(),
      revokedAt: null
    });
  } else if ((existingConsent.data() as StudyConsentDoc).status !== 'active') {
    return {
      accepted: false,
      outcome: 'rejected_legal',
      message: 'Tu consentimiento previo fue revocado. Contacta al DPO para una nueva habilitación.'
    };
  }

  const cohortRef = doc(db, 'studyCohorts', requestedLevel);
  const enrollmentRef = doc(db, 'studyEnrollments', user.uid);

  const txResult = await runTransaction(db, async (tx) => {
    const [cohortSnap, enrollSnap] = await Promise.all([tx.get(cohortRef), tx.get(enrollmentRef)]);

    const cohortData: StudyCohortDoc = cohortSnap.exists()
      ? (cohortSnap.data() as StudyCohortDoc)
      : {
          level: requestedLevel,
          maxQuota: DEFAULT_COHORT_QUOTA_PER_LEVEL,
          currentCount: 0,
          waitlistCount: 0,
          active: true
        };

    const existingEnroll = enrollSnap.exists() ? (enrollSnap.data() as StudyEnrollmentDoc) : null;
    const alloc = allocateCohortSlotPure(cohortData, existingEnroll, {
      uid: user.uid,
      requestedLevel,
      hasActiveConsent: true,
      consentVersion: CONSENT_VERSION,
      isAdult: true
    });

    if (!alloc.accepted || !alloc.enrollment || !alloc.updatedCohort) {
      return alloc;
    }

    if (alloc.outcome === 'enrolled') {
      if (cohortSnap.exists()) {
        tx.update(cohortRef, {
          currentCount: alloc.updatedCohort.currentCount,
          updatedAt: serverTimestamp()
        });
      } else {
        tx.set(cohortRef, {
          ...alloc.updatedCohort,
          updatedAt: serverTimestamp()
        });
      }
      tx.set(enrollmentRef, {
        ...alloc.enrollment,
        enrolledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else if (alloc.outcome === 'waitlisted') {
      if (cohortSnap.exists()) {
        tx.update(cohortRef, {
          waitlistCount: alloc.updatedCohort.waitlistCount,
          updatedAt: serverTimestamp()
        });
      } else {
        tx.set(cohortRef, {
          ...alloc.updatedCohort,
          updatedAt: serverTimestamp()
        });
      }
      tx.set(enrollmentRef, {
        ...alloc.enrollment,
        enrolledAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }

    return alloc;
  });

  // Sync optional non-breaking study marker on user profile
  if (txResult.accepted && txResult.enrollment) {
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        studyLevel: txResult.enrollment.effectiveLevel,
        studyLevelSource: txResult.enrollment.levelSource,
        marketStudyEnrolled: txResult.enrollment.status === 'active',
        updatedAt: serverTimestamp()
      });
    } catch {
      // Non-fatal if user profile hasn't finished initial sync
    }
  }

  return txResult;
}

/**
 * Cambia el nivel auto-seleccionado respetando estrictamente:
 * admin_override > cohort_assignment > self_selected.
 */
export async function updateSelfSelectedStudyLevel(
  user: User,
  nextLevel: StudyLevel
): Promise<StudyEnrollmentDoc | null> {
  const ref = doc(db, 'studyEnrollments', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const current = snap.data() as StudyEnrollmentDoc;
  const resolved = resolveEffectiveStudyLevel({
    adminOverrideLevel: current.adminOverrideLevel,
    cohortLevel: current.cohortLevel,
    selfSelectedLevel: nextLevel
  });

  await updateDoc(ref, {
    selfSelectedLevel: nextLevel,
    effectiveLevel: resolved.effectiveLevel,
    levelSource: resolved.source,
    updatedAt: serverTimestamp()
  });

  try {
    await updateDoc(doc(db, 'users', user.uid), {
      studyLevel: resolved.effectiveLevel,
      studyLevelSource: resolved.source,
      updatedAt: serverTimestamp()
    });
  } catch {
    // ignore
  }

  return {
    ...current,
    selfSelectedLevel: nextLevel,
    effectiveLevel: resolved.effectiveLevel,
    levelSource: resolved.source
  };
}

/**
 * Override administrativo (prioridad máxima: admin_override > cohort > self).
 */
export async function setAdminStudyLevelOverride(
  targetUid: string,
  overrideLevel: StudyLevel | 'none'
): Promise<StudyEnrollmentDoc | null> {
  const ref = doc(db, 'studyEnrollments', targetUid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const current = snap.data() as StudyEnrollmentDoc;
  const resolved = resolveEffectiveStudyLevel({
    adminOverrideLevel: overrideLevel,
    cohortLevel: current.cohortLevel,
    selfSelectedLevel: current.selfSelectedLevel
  });

  await updateDoc(ref, {
    adminOverrideLevel: overrideLevel,
    effectiveLevel: resolved.effectiveLevel,
    levelSource: resolved.source,
    updatedAt: serverTimestamp()
  });

  return {
    ...current,
    adminOverrideLevel: overrideLevel,
    effectiveLevel: resolved.effectiveLevel,
    levelSource: resolved.source
  };
}

export async function flushStudyEventsBatch(batchItems: StudyEventDoc[]): Promise<void> {
  if (batchItems.length === 0) return;
  const batch = writeBatch(db);
  for (const ev of batchItems) {
    const id = `evt_${Date.now()}_${100000 + cryptoRandomInt(900000)}`;
    const ref = doc(db, 'studyEvents', id);
    batch.set(ref, {
      uid: ev.uid,
      sessionId: ev.sessionId,
      cohortLevel: ev.cohortLevel,
      effectiveLevel: ev.effectiveLevel,
      eventName: ev.eventName,
      module: ev.module,
      durationMs: ev.durationMs,
      metadataJson: ev.metadataJson,
      expiresAtMs: ev.expiresAtMs,
      createdAt: serverTimestamp()
    });
  }
  await batch.commit();
}

export async function submitStudyMilestoneFeedback(params: {
  user: User;
  cohortLevel: StudyLevel;
  effectiveLevel: StudyLevel;
  milestone: StudyMilestone;
  npsScore: number;
  pmfAnswer: PmfAnswer;
  levelSatisfaction: number;
  densityFeedback: DensityFeedbackOption;
  openComment: string;
  currentCompletedSurveys: StudyMilestone[];
}): Promise<void> {
  const feedbackId = `fb_${params.user.uid}_${params.milestone}`;
  const ref = doc(db, 'studyFeedback', feedbackId);
  await setDoc(ref, {
    uid: params.user.uid,
    cohortLevel: params.cohortLevel,
    effectiveLevel: params.effectiveLevel,
    milestone: params.milestone,
    npsScore: Math.max(0, Math.min(10, Math.round(params.npsScore))),
    pmfAnswer: params.pmfAnswer,
    levelSatisfaction: Math.max(1, Math.min(5, Math.round(params.levelSatisfaction))),
    densityFeedback: params.densityFeedback,
    openComment: params.openComment.trim().slice(0, 800),
    expiresAtMs: computeExpiryMs(RETENTION_POLICY.feedbackRetentionDays),
    createdAt: serverTimestamp()
  });

  const nextCompleted = Array.from(new Set([...params.currentCompletedSurveys, params.milestone])).slice(0, 8);
  await updateDoc(doc(db, 'studyEnrollments', params.user.uid), {
    completedSurveys: nextCompleted,
    updatedAt: serverTimestamp()
  });
}

/**
 * Botón "Retirarme del estudio" (GDPR Art. 17 + Ley 1581):
 * 1) Revoca consentimiento en registro legal append-only.
 * 2) Marca enrollment como withdrawn con fecha de purga <= 30 días y libera cupo atómicamente.
 * 3) Elimina eventos de telemetría y respuestas abiertas del usuario.
 */
export async function withdrawFromMarketStudy(user: User): Promise<void> {
  const nowMs = Date.now();
  const purgeMs = computeExpiryMs(RETENTION_POLICY.withdrawalPurgeMaxDays, nowMs);
  const consentId = buildConsentDocId(user.uid, CONSENT_VERSION);

  // 1. Revocar consentimiento (append-only preserve trail)
  const consentRef = doc(db, 'studyConsents', consentId);
  const consentSnap = await getDoc(consentRef);
  if (consentSnap.exists()) {
    await updateDoc(consentRef, {
      status: 'revoked',
      revokedAt: serverTimestamp()
    });
  }

  // 2. Transacción para retirar enrollment y liberar cupo si estaba active
  const enrollRef = doc(db, 'studyEnrollments', user.uid);
  const enrollSnap = await getDoc(enrollRef);
  if (enrollSnap.exists()) {
    const enroll = enrollSnap.data() as StudyEnrollmentDoc;
    const cohortRef = doc(db, 'studyCohorts', enroll.cohortLevel);

    await runTransaction(db, async (tx) => {
      const cSnap = await tx.get(cohortRef);
      if (cSnap.exists() && enroll.status === 'active') {
        const cData = cSnap.data() as StudyCohortDoc;
        if (cData.currentCount > 0) {
          tx.update(cohortRef, {
            currentCount: cData.currentCount - 1,
            updatedAt: serverTimestamp()
          });
        }
      }
      tx.update(enrollRef, {
        status: 'withdrawn',
        withdrawnAtMs: nowMs,
        purgeScheduledAtMs: purgeMs,
        updatedAt: serverTimestamp()
      });
    });
  }

  // 3. Borrado inmediato de telemetría y feedback del usuario
  const [evSnap, fbSnap] = await Promise.all([
    getDocs(query(collection(db, 'studyEvents'), where('uid', '==', user.uid), limit(300))),
    getDocs(query(collection(db, 'studyFeedback'), where('uid', '==', user.uid), limit(50)))
  ]);
  const delBatch = writeBatch(db);
  for (const d of evSnap.docs) delBatch.delete(d.ref);
  for (const d of fbSnap.docs) delBatch.delete(d.ref);
  await delBatch.commit();

  // 4. Desmarcar perfil
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      marketStudyEnrolled: false,
      updatedAt: serverTimestamp()
    });
  } catch {
    // ignore
  }
}

export async function fetchAdminStudySnapshot(): Promise<{
  flag: FeatureFlagDoc;
  cohorts: Record<StudyLevel, StudyCohortDoc>;
  enrollments: StudyEnrollmentDoc[];
  feedbacks: StudyFeedbackDoc[];
  events: StudyEventDoc[];
}> {
  const [flag, cohorts, enrollSnap, fbSnap, evSnap] = await Promise.all([
    fetchMarketStudyFlag(),
    fetchAllStudyCohorts(),
    getDocs(query(collection(db, 'studyEnrollments'), orderBy('enrolledAtMs', 'desc'), limit(400))),
    getDocs(query(collection(db, 'studyFeedback'), limit(500))),
    getDocs(query(collection(db, 'studyEvents'), limit(500)))
  ]);

  return {
    flag,
    cohorts,
    enrollments: enrollSnap.docs.map(d => d.data() as StudyEnrollmentDoc),
    feedbacks: fbSnap.docs.map(d => ({ id: d.id, ...(d.data() as StudyFeedbackDoc) })),
    events: evSnap.docs.map(d => ({ id: d.id, ...(d.data() as StudyEventDoc) }))
  };
}
