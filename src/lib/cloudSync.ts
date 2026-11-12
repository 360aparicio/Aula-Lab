/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CloudSync: Sincronización privada en Firestore de Perfil, Planes, Niveles Educativos,
 * Mazo SM-2, Errores capturados (>5% EV) + Operaciones completas de Consola Admin & Audit Logs.
 */

import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { SpacedRepetitionManager, type SM2Item } from '../engine/spacedRepetition';
import { LearnerService, type LearnerMistakeRecord } from '../engine/learner';
import { AutoLearningEngine } from '../engine/autoLearningEngine';
import {
  EVAL_STATS_STORAGE_KEY,
  type SavedEvaluationSummary
} from '../components/EvaluationModule';
import type { DifficultyLevel } from '../engine/evaluationBank';

export type UserRole = 'user' | 'admin';
export type PlanTier = 'free' | 'pro' | 'elite';

export interface PlanPermissions {
  labPro: boolean;
  webBrain: boolean;
  unlimitedEval: boolean;
  pdfExport: boolean;
  planAdmin: boolean;
}

export function getDefaultPlanPermissions(tier: PlanTier, isRoleAdmin = false): PlanPermissions {
  if (tier === 'elite') {
    return { labPro: true, webBrain: true, unlimitedEval: true, pdfExport: true, planAdmin: isRoleAdmin };
  }
  if (tier === 'pro') {
    return { labPro: true, webBrain: true, unlimitedEval: true, pdfExport: false, planAdmin: isRoleAdmin };
  }
  return { labPro: true, webBrain: false, unlimitedEval: false, pdfExport: false, planAdmin: isRoleAdmin };
}

export const BOOTSTRAPPED_ADMIN_EMAIL = '360aparicio@gmail.com';

export interface UserProfileDoc {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  planTier: PlanTier;
  planActive: boolean;
  planPermissions: PlanPermissions;
  isManualPlaceholder?: boolean;
  elo: number;
  masteryScore: number;
  totalDecisions: number;
  totalMistakes: number;
  roadmapDoneIds: string[];
  categoryStats: Record<string, { attempts: number; correct: number }>;
  evaluationStats: SavedEvaluationSummary;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function computeInviteDocId(email: string): string {
  const normalized = email.trim().toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
  return `inv_${normalized}`.slice(0, 120);
}

export interface AdminUserDetails {
  profile: UserProfileDoc;
  sm2Items: Array<{
    id: string;
    itemType: string;
    title: string;
    category: string;
    intervalDays: number;
    repetitions: number;
    easeFactor: number;
  }>;
  mistakes: Array<{
    id: string;
    scenarioTitle: string;
    heroCombo: string;
    wetness: string;
    evLossPercentOfPot: number;
    chosenAction: string;
    bestAction: string;
    prescriptiveFix: string;
  }>;
}

export interface AdminAuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail: string;
  targetUid: string;
  targetLabel: string;
  action: string;
  detail: string;
  createdAt?: unknown;
}

export function isBootstrappedAdminUser(user: User | null): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return user.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
}

function clampString(value: string | undefined | null, maxLen: number, fallback = ''): string {
  const s = (value ?? fallback).toString().trim();
  if (!s) return fallback.slice(0, maxLen);
  return s.slice(0, maxLen);
}

function sanitizeDocId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 120);
  return cleaned.length > 0 ? cleaned : `id-${Date.now()}`;
}

export function getRoadmapDoneIdsFromLocal(): string[] {
  try {
    const raw = localStorage.getItem('gto_career_roadmap');
    if (!raw) return [];
    const phases = JSON.parse(raw) as Array<{ milestones?: Array<{ id: string; done: boolean }> }>;
    const doneIds: string[] = [];
    for (const p of phases) {
      for (const m of p.milestones || []) {
        if (m.done && typeof m.id === 'string') {
          doneIds.push(m.id.slice(0, 32));
        }
      }
    }
    return doneIds.slice(0, 32);
  } catch {
    return [];
  }
}

export function getCategoryStatsFromLocal(): Record<string, { attempts: number; correct: number }> {
  try {
    const raw = localStorage.getItem('gto_academy_stats');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getTrainerEloFromLocal(): number {
  try {
    const raw = localStorage.getItem('gto_trainer_stats');
    if (!raw) return 1200;
    const parsed = JSON.parse(raw);
    return typeof parsed?.elo === 'number' ? Math.max(0, Math.min(5000, Math.round(parsed.elo))) : 1200;
  } catch {
    return 1200;
  }
}

function defaultEvaluationStats(): SavedEvaluationSummary {
  return {
    lastMode: 'levels',
    lastScorePct: 0,
    bestScorePct: 0,
    examsTaken: 0,
    passedCount: 0,
    currentLevel: 1,
    unlockedLevel: 1,
    xp: 0,
    weakestCategory: 'Sin datos aún',
    strongestCategory: 'Sin datos aún',
    categoryPerf: {},
    lastUpdatedAt: Date.now()
  };
}

export function getEvaluationStatsFromLocal(): SavedEvaluationSummary {
  const fallback = defaultEvaluationStats();
  try {
    const raw = localStorage.getItem(EVAL_STATS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SavedEvaluationSummary>;
      return {
        lastMode: typeof parsed.lastMode === 'string' ? parsed.lastMode : fallback.lastMode,
        lastScorePct: typeof parsed.lastScorePct === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.lastScorePct))) : 0,
        bestScorePct: typeof parsed.bestScorePct === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.bestScorePct))) : 0,
        examsTaken: typeof parsed.examsTaken === 'number' ? Math.max(0, Math.round(parsed.examsTaken)) : 0,
        passedCount: typeof parsed.passedCount === 'number' ? Math.max(0, Math.round(parsed.passedCount)) : 0,
        currentLevel: parsed.currentLevel && [1, 2, 3, 4].includes(parsed.currentLevel) ? (parsed.currentLevel as DifficultyLevel) : 1,
        unlockedLevel: parsed.unlockedLevel && [1, 2, 3, 4].includes(parsed.unlockedLevel) ? (parsed.unlockedLevel as DifficultyLevel) : 1,
        xp: typeof parsed.xp === 'number' ? Math.max(0, Math.round(parsed.xp)) : 0,
        weakestCategory: clampString(parsed.weakestCategory, 64, 'Sin datos aún'),
        strongestCategory: clampString(parsed.strongestCategory, 64, 'Sin datos aún'),
        categoryPerf: parsed.categoryPerf && typeof parsed.categoryPerf === 'object' ? parsed.categoryPerf : {},
        lastUpdatedAt: typeof parsed.lastUpdatedAt === 'number' ? parsed.lastUpdatedAt : Date.now()
      };
    }
  } catch {
    // ignore
  }
  return fallback;
}

function parsePlanPermissions(raw: unknown, fallbackTier: PlanTier, role: UserRole): PlanPermissions {
  const isRoleAdmin = role === 'admin';
  const defaults = getDefaultPlanPermissions(fallbackTier, isRoleAdmin);
  if (!raw || typeof raw !== 'object') return defaults;
  const obj = raw as Record<string, unknown>;
  return {
    labPro: typeof obj.labPro === 'boolean' ? obj.labPro : defaults.labPro,
    webBrain: typeof obj.webBrain === 'boolean' ? obj.webBrain : defaults.webBrain,
    unlimitedEval: typeof obj.unlimitedEval === 'boolean' ? obj.unlimitedEval : defaults.unlimitedEval,
    pdfExport: typeof obj.pdfExport === 'boolean' ? obj.pdfExport : defaults.pdfExport,
    planAdmin: typeof obj.planAdmin === 'boolean' ? obj.planAdmin : isRoleAdmin
  };
}

function mapSnapshotToUserProfile(id: string, data: Record<string, unknown>): UserProfileDoc {
  const evalRaw = (data.evaluationStats && typeof data.evaluationStats === 'object'
    ? data.evaluationStats
    : {}) as Partial<SavedEvaluationSummary>;
  const planTier: PlanTier = data.planTier === 'elite' || data.planTier === 'pro' ? data.planTier : 'free';
  const role: UserRole = data.role === 'admin' ? 'admin' : 'user';

  return {
    uid: typeof data.uid === 'string' ? data.uid : id,
    email: typeof data.email === 'string' ? data.email : '',
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Jugador GTO',
    ...(typeof data.photoURL === 'string' ? { photoURL: data.photoURL } : {}),
    role,
    planTier,
    planActive: typeof data.planActive === 'boolean' ? data.planActive : true,
    planPermissions: parsePlanPermissions(data.planPermissions, planTier, role),
    ...(data.isManualPlaceholder === true ? { isManualPlaceholder: true } : {}),
    elo: typeof data.elo === 'number' ? data.elo : 1200,
    masteryScore: typeof data.masteryScore === 'number' ? data.masteryScore : 80,
    totalDecisions: typeof data.totalDecisions === 'number' ? data.totalDecisions : 0,
    totalMistakes: typeof data.totalMistakes === 'number' ? data.totalMistakes : 0,
    roadmapDoneIds: Array.isArray(data.roadmapDoneIds) ? (data.roadmapDoneIds as string[]) : [],
    categoryStats: (data.categoryStats && typeof data.categoryStats === 'object'
      ? data.categoryStats
      : {}) as Record<string, { attempts: number; correct: number }>,
    evaluationStats: {
      lastMode: typeof evalRaw.lastMode === 'string' ? evalRaw.lastMode : 'levels',
      lastScorePct: typeof evalRaw.lastScorePct === 'number' ? evalRaw.lastScorePct : 0,
      bestScorePct: typeof evalRaw.bestScorePct === 'number' ? evalRaw.bestScorePct : 0,
      examsTaken: typeof evalRaw.examsTaken === 'number' ? evalRaw.examsTaken : 0,
      passedCount: typeof evalRaw.passedCount === 'number' ? evalRaw.passedCount : 0,
      currentLevel: evalRaw.currentLevel && [1, 2, 3, 4].includes(evalRaw.currentLevel) ? (evalRaw.currentLevel as DifficultyLevel) : 1,
      unlockedLevel: evalRaw.unlockedLevel && [1, 2, 3, 4].includes(evalRaw.unlockedLevel) ? (evalRaw.unlockedLevel as DifficultyLevel) : 1,
      xp: typeof evalRaw.xp === 'number' ? evalRaw.xp : 0,
      weakestCategory: typeof evalRaw.weakestCategory === 'string' ? evalRaw.weakestCategory : 'Sin datos aún',
      strongestCategory: typeof evalRaw.strongestCategory === 'string' ? evalRaw.strongestCategory : 'Sin datos aún',
      categoryPerf: evalRaw.categoryPerf && typeof evalRaw.categoryPerf === 'object' ? evalRaw.categoryPerf : {},
      lastUpdatedAt: typeof evalRaw.lastUpdatedAt === 'number' ? evalRaw.lastUpdatedAt : Date.now()
    },
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

export async function syncUserProfileToCloud(user: User): Promise<UserProfileDoc | null> {
  if (!user.uid || !user.emailVerified) return null;

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const learningProfile = AutoLearningEngine.getInstance().getProfile();
  const elo = getTrainerEloFromLocal();
  const roadmapDoneIds = getRoadmapDoneIdsFromLocal();
  const categoryStats = getCategoryStatsFromLocal();
  const evaluationStats = getEvaluationStatsFromLocal();
  const isBootstrappedAdmin = isBootstrappedAdminUser(user);
  const safeEmail = clampString(user.email, 160, 'jugador@labstudio.app');

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      const normalizedEmail = safeEmail.trim().toLowerCase();
      const inviteId = computeInviteDocId(normalizedEmail);
      let pendingInvite: Record<string, unknown> | null = null;
      if (!isBootstrappedAdmin) {
        try {
          const inviteSnap = await getDoc(doc(db, 'userInvites', inviteId));
          if (inviteSnap.exists()) {
            const invData = inviteSnap.data() as Record<string, unknown>;
            if (invData.status === 'pending' && String(invData.email || '').toLowerCase() === normalizedEmail) {
              pendingInvite = invData;
            }
          }
        } catch {
          // No pending invite or not readable; proceed with default user registration
        }
      }

      const assignedRole: UserRole = isBootstrappedAdmin
        ? 'admin'
        : pendingInvite?.role === 'admin'
        ? 'admin'
        : 'user';
      const assignedTier: PlanTier = isBootstrappedAdmin
        ? 'elite'
        : pendingInvite?.planTier === 'elite' || pendingInvite?.planTier === 'pro'
        ? (pendingInvite.planTier as PlanTier)
        : 'free';
      const assignedActive: boolean = isBootstrappedAdmin
        ? true
        : typeof pendingInvite?.planActive === 'boolean'
        ? pendingInvite.planActive
        : true;
      const assignedDisplayName = clampString(
        typeof pendingInvite?.displayName === 'string' && pendingInvite.displayName.trim()
          ? pendingInvite.displayName
          : user.displayName,
        80,
        'Jugador GTO'
      );

      const newUserPayload: Record<string, unknown> = {
        uid: user.uid,
        email: normalizedEmail,
        displayName: assignedDisplayName,
        ...(user.photoURL ? { photoURL: clampString(user.photoURL, 512) } : {}),
        role: assignedRole,
        planTier: assignedTier,
        planActive: assignedActive,
        elo,
        masteryScore: Math.max(0, Math.min(100, Math.round(learningProfile.masteryScore || 80))),
        totalDecisions: Math.max(0, Math.round(learningProfile.totalDecisions || 0)),
        totalMistakes: Math.max(0, Math.round(learningProfile.totalMistakes || 0)),
        roadmapDoneIds,
        categoryStats,
        evaluationStats,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (pendingInvite && pendingInvite.planPermissions && typeof pendingInvite.planPermissions === 'object') {
        newUserPayload.planPermissions = parsePlanPermissions(
          pendingInvite.planPermissions,
          assignedTier,
          assignedRole
        );
      }

      await setDoc(userRef, newUserPayload);

      if (pendingInvite) {
        try {
          await updateDoc(doc(db, 'userInvites', inviteId), {
            status: 'claimed',
            claimedUid: user.uid,
            updatedAt: serverTimestamp()
          });
        } catch {
          // Non-fatal if invite status already transitioned
        }
      }
    } else {
      const existingData = snap.data() as Record<string, unknown>;
      const hasV32Fields =
        typeof existingData.email === 'string' &&
        typeof existingData.role === 'string' &&
        typeof existingData.planTier === 'string' &&
        typeof existingData.planActive === 'boolean' &&
        typeof existingData.evaluationStats === 'object';

      if (!hasV32Fields) {
        await updateDoc(userRef, {
          email: typeof existingData.email === 'string' && existingData.email.length >= 3 ? existingData.email : safeEmail,
          displayName: clampString(user.displayName, 80, 'Jugador GTO'),
          ...(user.photoURL ? { photoURL: clampString(user.photoURL, 512) } : {}),
          role: isBootstrappedAdmin ? 'admin' : 'user',
          planTier: isBootstrappedAdmin ? 'elite' : 'free',
          planActive: true,
          elo,
          masteryScore: Math.max(0, Math.min(100, Math.round(learningProfile.masteryScore || 80))),
          totalDecisions: Math.max(0, Math.round(learningProfile.totalDecisions || 0)),
          totalMistakes: Math.max(0, Math.round(learningProfile.totalMistakes || 0)),
          roadmapDoneIds,
          categoryStats,
          evaluationStats,
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(userRef, {
          displayName: clampString(user.displayName, 80, 'Jugador GTO'),
          ...(user.photoURL ? { photoURL: clampString(user.photoURL, 512) } : {}),
          elo,
          masteryScore: Math.max(0, Math.min(100, Math.round(learningProfile.masteryScore || 80))),
          totalDecisions: Math.max(0, Math.round(learningProfile.totalDecisions || 0)),
          totalMistakes: Math.max(0, Math.round(learningProfile.totalMistakes || 0)),
          roadmapDoneIds,
          categoryStats,
          evaluationStats,
          updatedAt: serverTimestamp()
        });
      }
    }

    const updatedSnap = await getDoc(userRef);
    if (updatedSnap.exists()) {
      return mapSnapshotToUserProfile(updatedSnap.id, updatedSnap.data() as Record<string, unknown>);
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export async function syncSM2ItemsToCloud(user: User, maxItems = 25): Promise<number> {
  if (!user.uid || !user.emailVerified) return 0;

  const items: SM2Item[] = SpacedRepetitionManager.getInstance().getAllItems().slice(0, maxItems);
  let synced = 0;

  for (const item of items) {
    const safeId = sanitizeDocId(item.id);
    const itemPath = `users/${user.uid}/sm2Items/${safeId}`;
    const itemRef = doc(db, 'users', user.uid, 'sm2Items', safeId);

    try {
      const snap = await getDoc(itemRef);
      if (!snap.exists()) {
        await setDoc(itemRef, {
          ownerId: user.uid,
          itemType: item.type,
          title: clampString(item.title, 160, 'Spot SM-2'),
          category: clampString(item.category, 80, 'General'),
          prompt: clampString(item.content.prompt, 600, ''),
          explanation: clampString(item.content.explanation, 1200, ''),
          rule: clampString(item.content.rule, 600, ''),
          intervalDays: Math.max(0, Math.min(3650, item.intervalDays)),
          repetitions: Math.max(0, Math.min(500, item.repetitions)),
          easeFactor: Math.max(1.3, Math.min(5.0, item.easeFactor)),
          nextReviewDate: Math.max(0, item.nextReviewDate),
          reviewCount: Math.max(0, item.reviewCount),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(itemRef, {
          title: clampString(item.title, 160, 'Spot SM-2'),
          category: clampString(item.category, 80, 'General'),
          prompt: clampString(item.content.prompt, 600, ''),
          explanation: clampString(item.content.explanation, 1200, ''),
          rule: clampString(item.content.rule, 600, ''),
          intervalDays: Math.max(0, Math.min(3650, item.intervalDays)),
          repetitions: Math.max(0, Math.min(500, item.repetitions)),
          easeFactor: Math.max(1.3, Math.min(5.0, item.easeFactor)),
          nextReviewDate: Math.max(0, item.nextReviewDate),
          reviewCount: Math.max(0, item.reviewCount),
          updatedAt: serverTimestamp()
        });
      }
      synced += 1;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, itemPath);
    }
  }

  return synced;
}

export async function syncRecentMistakesToCloud(user: User, maxItems = 15): Promise<number> {
  if (!user.uid || !user.emailVerified) return 0;

  const mistakes: LearnerMistakeRecord[] = LearnerService.getInstance().getCriticalMistakes().slice(0, maxItems);
  let synced = 0;

  for (const m of mistakes) {
    const safeId = sanitizeDocId(m.id);
    const mistakePath = `users/${user.uid}/mistakes/${safeId}`;
    const mistakeRef = doc(db, 'users', user.uid, 'mistakes', safeId);

    try {
      const snap = await getDoc(mistakeRef);
      if (!snap.exists()) {
        await setDoc(mistakeRef, {
          ownerId: user.uid,
          scenarioTitle: clampString(m.scenarioTitle, 160, 'Trainer Spot'),
          heroCombo: clampString(m.heroCombo, 16, 'AsKd').padEnd(2, 'x'),
          wetness: clampString(m.boardTexture?.wetness, 48, 'Seco (Dry)'),
          evLossPercentOfPot: Math.max(0, Math.min(500, m.evLossPercentOfPot)),
          chosenAction: clampString(m.chosenAction, 80, 'Bet'),
          bestAction: clampString(m.bestAction, 80, 'Check'),
          prescriptiveFix: clampString(m.prescriptiveFix, 600, 'Ajusta el sizing.'),
          createdAt: serverTimestamp()
        });
        synced += 1;
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, mistakePath);
    }
  }

  return synced;
}

export async function fetchUserCloudSummary(user: User): Promise<{
  profile: UserProfileDoc | null;
  elo?: number;
  cloudSm2Count: number;
  cloudMistakeCount: number;
}> {
  if (!user.uid || !user.emailVerified) {
    return { profile: null, cloudSm2Count: 0, cloudMistakeCount: 0 };
  }

  const userPath = `users/${user.uid}`;
  let profile: UserProfileDoc | null = null;
  let elo: number | undefined;
  try {
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    if (profileSnap.exists()) {
      const data = profileSnap.data() as Record<string, unknown>;
      profile = mapSnapshotToUserProfile(profileSnap.id, data);
      elo = profile.elo;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  let cloudSm2Count = 0;
  const sm2ColPath = `users/${user.uid}/sm2Items`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'sm2Items'),
      where('ownerId', '==', user.uid),
      limit(50)
    );
    const snap = await getDocs(q);
    cloudSm2Count = snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, sm2ColPath);
  }

  let cloudMistakeCount = 0;
  const mistakesColPath = `users/${user.uid}/mistakes`;
  try {
    const q = query(
      collection(db, 'users', user.uid, 'mistakes'),
      where('ownerId', '==', user.uid),
      limit(50)
    );
    const snap = await getDocs(q);
    cloudMistakeCount = snap.size;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, mistakesColPath);
  }

  return { profile, elo, cloudSm2Count, cloudMistakeCount };
}

export async function runFullCloudSync(user: User): Promise<{
  profile: UserProfileDoc | null;
  sm2Synced: number;
  mistakesSynced: number;
}> {
  const profile = await syncUserProfileToCloud(user);
  const [sm2Synced, mistakesSynced] = await Promise.all([
    syncSM2ItemsToCloud(user),
    syncRecentMistakesToCloud(user)
  ]);
  return { profile, sm2Synced, mistakesSynced };
}

/**
 * ADMIN ONLY OPERATIONS & AUDIT LOGS
 */
export async function recordAdminAuditLog(
  targetUid: string,
  targetLabel: string,
  action: string,
  detail: string
): Promise<void> {
  const actor = auth.currentUser;
  if (!actor) return;
  const logId = sanitizeDocId(`log-${Date.now()}-${Math.floor(Math.random() * 10000)}`);
  const logPath = `adminAuditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'adminAuditLogs', logId), {
      actorUid: actor.uid,
      actorEmail: clampString(actor.email, 160, 'admin@labstudio.app'),
      targetUid: clampString(targetUid, 128, 'system'),
      targetLabel: clampString(targetLabel, 160, 'Usuario'),
      action: clampString(action, 64, 'UPDATE'),
      detail: clampString(detail, 300, 'Acción administrativa'),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, logPath);
  }
}

export async function fetchAdminAuditLogs(maxLogs = 40): Promise<AdminAuditLogEntry[]> {
  const path = 'adminAuditLogs';
  try {
    const q = query(collection(db, 'adminAuditLogs'), orderBy('createdAt', 'desc'), limit(maxLogs));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        actorUid: String(data.actorUid || ''),
        actorEmail: String(data.actorEmail || ''),
        targetUid: String(data.targetUid || ''),
        targetLabel: String(data.targetLabel || ''),
        action: String(data.action || ''),
        detail: String(data.detail || ''),
        createdAt: data.createdAt
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchAllUsersForAdmin(): Promise<UserProfileDoc[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, 'users'));
    const allDocs = snap.docs.map(d => mapSnapshotToUserProfile(d.id, d.data() as Record<string, unknown>));
    const realEmails = new Set(
      allDocs
        .filter(u => !u.isManualPlaceholder && !u.uid.startsWith('manual_'))
        .map(u => u.email.trim().toLowerCase())
    );

    const list: UserProfileDoc[] = [];
    for (const u of allDocs) {
      const isPlaceholder = u.isManualPlaceholder === true || u.uid.startsWith('manual_');
      if (isPlaceholder && realEmails.has(u.email.trim().toLowerCase())) {
        // Real user signed in and claimed their profile; remove stale placeholder best-effort
        void deleteDoc(doc(db, 'users', u.uid)).catch(() => {});
        continue;
      }
      list.push(u);
    }

    return list.sort((a, b) => {
      if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
      return b.elo - a.elo;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function fetchUserDetailsForAdmin(targetUid: string): Promise<AdminUserDetails> {
  const userPath = `users/${targetUid}`;
  let profile: UserProfileDoc;
  try {
    const snap = await getDoc(doc(db, 'users', targetUid));
    if (!snap.exists()) {
      throw new Error(`No existe el perfil ${targetUid}`);
    }
    profile = mapSnapshotToUserProfile(snap.id, snap.data() as Record<string, unknown>);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  let sm2Items: AdminUserDetails['sm2Items'] = [];
  const sm2Path = `users/${targetUid}/sm2Items`;
  try {
    const snap = await getDocs(query(collection(db, 'users', targetUid, 'sm2Items'), limit(30)));
    sm2Items = snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        itemType: String(data.itemType || 'concept'),
        title: String(data.title || 'Ítem SM-2'),
        category: String(data.category || 'General'),
        intervalDays: Number(data.intervalDays || 1),
        repetitions: Number(data.repetitions || 0),
        easeFactor: Number(data.easeFactor || 2.5)
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, sm2Path);
  }

  let mistakes: AdminUserDetails['mistakes'] = [];
  const mistakesPath = `users/${targetUid}/mistakes`;
  try {
    const snap = await getDocs(query(collection(db, 'users', targetUid, 'mistakes'), limit(30)));
    mistakes = snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        scenarioTitle: String(data.scenarioTitle || 'Spot'),
        heroCombo: String(data.heroCombo || ''),
        wetness: String(data.wetness || ''),
        evLossPercentOfPot: Number(data.evLossPercentOfPot || 0),
        chosenAction: String(data.chosenAction || ''),
        bestAction: String(data.bestAction || ''),
        prescriptiveFix: String(data.prescriptiveFix || '')
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, mistakesPath);
  }

  return { profile, sm2Items, mistakes };
}

export async function adminUpdateUserPlan(
  targetUid: string,
  updates: {
    planTier?: PlanTier;
    planActive?: boolean;
    planPermissions?: PlanPermissions;
    role?: UserRole;
    elo?: number;
    evaluationStats?: SavedEvaluationSummary;
  },
  auditMeta?: { targetLabel: string; action: string; detail: string }
): Promise<void> {
  const userPath = `users/${targetUid}`;
  try {
    const cleanUpdates: Record<string, unknown> = {
      updatedAt: serverTimestamp()
    };
    if (updates.planTier) cleanUpdates.planTier = updates.planTier;
    if (typeof updates.planActive === 'boolean') cleanUpdates.planActive = updates.planActive;
    if (updates.planPermissions) {
      cleanUpdates.planPermissions = {
        labPro: Boolean(updates.planPermissions.labPro),
        webBrain: Boolean(updates.planPermissions.webBrain),
        unlimitedEval: Boolean(updates.planPermissions.unlimitedEval),
        pdfExport: Boolean(updates.planPermissions.pdfExport),
        planAdmin: Boolean(updates.planPermissions.planAdmin)
      };
    }
    if (updates.role) cleanUpdates.role = updates.role;
    if (typeof updates.elo === 'number') cleanUpdates.elo = updates.elo;
    if (updates.evaluationStats) cleanUpdates.evaluationStats = updates.evaluationStats;

    await updateDoc(doc(db, 'users', targetUid), cleanUpdates);

    // If updating a manual placeholder prior to first Google sign-in, sync pending invite too
    if (targetUid.startsWith('manual_')) {
      const inviteId = targetUid.replace(/^manual_/, '');
      const inviteUpdates: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (cleanUpdates.planTier) inviteUpdates.planTier = cleanUpdates.planTier;
      if (typeof cleanUpdates.planActive === 'boolean') inviteUpdates.planActive = cleanUpdates.planActive;
      if (cleanUpdates.planPermissions) inviteUpdates.planPermissions = cleanUpdates.planPermissions;
      if (cleanUpdates.role) inviteUpdates.role = cleanUpdates.role;
      try {
        await updateDoc(doc(db, 'userInvites', inviteId), inviteUpdates);
      } catch {
        // Ignore if invite doc was already claimed or deleted
      }
    }

    if (auditMeta) {
      await recordAdminAuditLog(targetUid, auditMeta.targetLabel, auditMeta.action, auditMeta.detail);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export interface ManualUserInput {
  email: string;
  displayName: string;
  planTier: PlanTier;
  planActive: boolean;
  planPermissions: PlanPermissions;
  role: UserRole;
}

export async function adminCreateOrUpdateManualUser(input: ManualUserInput): Promise<{
  uid: string;
  isExistingRealUser: boolean;
}> {
  const actor = auth.currentUser;
  if (!actor) {
    throw new Error('Debes iniciar sesión como Administrador.');
  }

  const normalizedEmail = clampString(input.email, 160, '').toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Ingresa un correo electrónico válido.');
  }
  const safeName = clampString(input.displayName, 80, normalizedEmail.split('@')[0] || 'Jugador GTO');
  const cleanPerms: PlanPermissions = {
    labPro: Boolean(input.planPermissions.labPro),
    webBrain: Boolean(input.planPermissions.webBrain),
    unlimitedEval: Boolean(input.planPermissions.unlimitedEval),
    pdfExport: Boolean(input.planPermissions.pdfExport),
    planAdmin: input.role === 'admin' || Boolean(input.planPermissions.planAdmin)
  };
  const finalRole: UserRole = cleanPerms.planAdmin ? 'admin' : 'user';

  // Check if a real user account already exists with this email
  try {
    const existingSnap = await getDocs(
      query(collection(db, 'users'), where('email', '==', normalizedEmail), limit(5))
    );
    const realDoc = existingSnap.docs.find(d => !d.id.startsWith('manual_') && d.data().isManualPlaceholder !== true);
    if (realDoc) {
      await adminUpdateUserPlan(
        realDoc.id,
        {
          planTier: input.planTier,
          planActive: input.planActive,
          planPermissions: cleanPerms,
          role: finalRole
        },
        {
          targetLabel: normalizedEmail,
          action: 'MANUAL_USER_UPDATED',
          detail: `Cuenta existente actualizada manualmente (${input.planTier.toUpperCase()} · ${input.planActive ? 'ACTIVO' : 'INACTIVO'}${finalRole === 'admin' ? ' · ADMIN PLAN' : ''})`
        }
      );
      return { uid: realDoc.id, isExistingRealUser: true };
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, 'users');
  }

  const inviteId = computeInviteDocId(normalizedEmail);
  const manualUid = `manual_${inviteId}`.slice(0, 128);
  const userPath = `users/${manualUid}`;
  const invitePath = `userInvites/${inviteId}`;

  try {
    const existingManualSnap = await getDoc(doc(db, 'users', manualUid));
    if (existingManualSnap.exists()) {
      await updateDoc(doc(db, 'users', manualUid), {
        displayName: safeName,
        role: finalRole,
        planTier: input.planTier,
        planActive: input.planActive,
        planPermissions: cleanPerms,
        isManualPlaceholder: true,
        updatedAt: serverTimestamp()
      });
    } else {
      await setDoc(doc(db, 'users', manualUid), {
        uid: manualUid,
        email: normalizedEmail,
        displayName: safeName,
        role: finalRole,
        planTier: input.planTier,
        planActive: input.planActive,
        planPermissions: cleanPerms,
        isManualPlaceholder: true,
        elo: 1200,
        masteryScore: 80,
        totalDecisions: 0,
        totalMistakes: 0,
        roadmapDoneIds: [],
        categoryStats: {},
        evaluationStats: defaultEvaluationStats(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, userPath);
  }

  try {
    await setDoc(doc(db, 'userInvites', inviteId), {
      email: normalizedEmail,
      displayName: safeName,
      role: finalRole,
      planTier: input.planTier,
      planActive: input.planActive,
      planPermissions: cleanPerms,
      status: 'pending',
      manualUserDocId: manualUid,
      createdByUid: actor.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, invitePath);
  }

  await recordAdminAuditLog(
    manualUid,
    normalizedEmail,
    'MANUAL_USER_CREATED',
    `Usuario agregado manualmente (${input.planTier.toUpperCase()} · ${input.planActive ? 'ACTIVO' : 'INACTIVO'}${finalRole === 'admin' ? ' · ADMIN PLAN' : ''})`
  );

  return { uid: manualUid, isExistingRealUser: false };
}

export async function adminDeleteManualUser(targetUid: string, email: string): Promise<void> {
  const userPath = `users/${targetUid}`;
  try {
    await deleteDoc(doc(db, 'users', targetUid));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, userPath);
  }

  const inviteId = computeInviteDocId(email);
  try {
    await deleteDoc(doc(db, 'userInvites', inviteId));
  } catch {
    // Non-fatal if invite already absent
  }

  await recordAdminAuditLog(
    targetUid,
    email,
    'MANUAL_USER_DELETED',
    `Registro manual pendiente eliminado (${email})`
  );
}

export interface MonthlyCohortPoint {
  monthKey: string;
  label: string;
  newUsers: number;
  cumulativeUsers: number;
  retainedUsers: number;
  retentionPct: number;
}

export interface DatabaseCollectionMetric {
  collection: string;
  label: string;
  documents: number;
  estimatedKB: number;
}

export interface DatabaseUsageMetrics {
  totalDocuments: number;
  estimatedStorageKB: number;
  quotaLimitKB: number;
  latencyMs: number;
  collections: DatabaseCollectionMetric[];
  monthlyCohorts: MonthlyCohortPoint[];
  avgRetentionPct: number;
  sampledAt: number;
}

function toEpochMs(ts: unknown): number | null {
  if (!ts) return null;
  if (typeof ts === 'number' && Number.isFinite(ts)) return ts;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof (ts as { toMillis: () => number }).toMillis === 'function') {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().getTime();
  }
  return null;
}

export function computeMonthlyCohorts(users: UserProfileDoc[]): {
  cohorts: MonthlyCohortPoint[];
  avgRetentionPct: number;
} {
  const now = new Date();
  const months: Array<{ year: number; month: number; key: string; label: string; endMs: number; startMs: number }> = [];
  const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  for (let offset = 5; offset >= 0; offset--) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const startMs = d.getTime();
    const endMs = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
    months.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${monthNames[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
      startMs,
      endMs
    });
  }

  const parsedUsers = users.map(u => {
    const createdMs = toEpochMs(u.createdAt) ?? toEpochMs(u.updatedAt) ?? now.getTime();
    const updatedMs = toEpochMs(u.updatedAt) ?? u.evaluationStats?.lastUpdatedAt ?? createdMs;
    return { u, createdMs, updatedMs };
  });

  const firstMonthStart = months[0].startMs;
  const cohorts: MonthlyCohortPoint[] = months.map((m) => {
    const newUsers = parsedUsers.filter(p => p.createdMs >= m.startMs && p.createdMs <= m.endMs).length;
    const totalThroughMonth = parsedUsers.filter(p => p.createdMs <= m.endMs).length;
    const activeInOrAfterMonth = parsedUsers.filter(
      p => p.createdMs <= m.endMs && p.updatedMs >= m.startMs && p.u.planActive
    ).length;

    const retentionPct =
      totalThroughMonth > 0
        ? Math.min(100, Math.round((activeInOrAfterMonth / totalThroughMonth) * 100))
        : 0;

    return {
      monthKey: m.key,
      label: m.label,
      newUsers: m.startMs === firstMonthStart
        ? parsedUsers.filter(p => p.createdMs <= m.endMs).length
        : newUsers,
      cumulativeUsers: totalThroughMonth,
      retainedUsers: activeInOrAfterMonth,
      retentionPct
    };
  });

  const nonZeroCohorts = cohorts.filter(c => c.cumulativeUsers > 0);
  const avgRetentionPct =
    nonZeroCohorts.length > 0
      ? Math.round(nonZeroCohorts.reduce((acc, c) => acc + c.retentionPct, 0) / nonZeroCohorts.length)
      : 100;

  return { cohorts, avgRetentionPct };
}

export async function fetchDatabaseUsageMetricsForAdmin(users: UserProfileDoc[]): Promise<DatabaseUsageMetrics> {
  const t0 = performance.now();

  let auditLogsCount = 0;
  try {
    const logsSnap = await getDocs(query(collection(db, 'adminAuditLogs'), limit(500)));
    auditLogsCount = logsSnap.size;
  } catch {
    auditLogsCount = 0;
  }

  // Sample SM-2 items and mistakes across all active/sampled users (up to 40 users)
  const usersToInspect = users.slice(0, 40);
  let sm2Count = 0;
  let mistakesCount = 0;

  await Promise.all(
    usersToInspect.map(async (u) => {
      try {
        const [sm2Snap, mSnap] = await Promise.all([
          getDocs(query(collection(db, 'users', u.uid, 'sm2Items'), limit(100))),
          getDocs(query(collection(db, 'users', u.uid, 'mistakes'), limit(100)))
        ]);
        sm2Count += sm2Snap.size;
        mistakesCount += mSnap.size;
      } catch {
        // Ignore individual user subcollection errors gracefully
      }
    })
  );

  const latencyMs = Math.max(1, Math.round(performance.now() - t0));

  const collections: DatabaseCollectionMetric[] = [
    {
      collection: 'users',
      label: 'Perfiles (/users)',
      documents: users.length,
      estimatedKB: Math.round(users.length * 1.8 * 10) / 10
    },
    {
      collection: 'sm2Items',
      label: 'Repasos SM-2 (/sm2Items)',
      documents: sm2Count,
      estimatedKB: Math.round(sm2Count * 0.95 * 10) / 10
    },
    {
      collection: 'mistakes',
      label: 'Fugas >5% EV (/mistakes)',
      documents: mistakesCount,
      estimatedKB: Math.round(mistakesCount * 0.75 * 10) / 10
    },
    {
      collection: 'adminAuditLogs',
      label: 'Auditoría (/adminAuditLogs)',
      documents: auditLogsCount,
      estimatedKB: Math.round(auditLogsCount * 0.45 * 10) / 10
    }
  ];

  const totalDocuments = collections.reduce((s, c) => s + c.documents, 0);
  const estimatedStorageKB = Math.round(collections.reduce((s, c) => s + c.estimatedKB, 0) * 10) / 10;
  const { cohorts, avgRetentionPct } = computeMonthlyCohorts(users);

  return {
    totalDocuments,
    estimatedStorageKB,
    quotaLimitKB: 1048576, // 1 GiB Spark/Cloud Firestore free tier baseline
    latencyMs,
    collections,
    monthlyCohorts: cohorts,
    avgRetentionPct,
    sampledAt: Date.now()
  };
}

export { mapSnapshotToUserProfile, defaultEvaluationStats };
