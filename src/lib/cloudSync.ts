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
import { loadTrainerStats, saveTrainerStats } from '../trainer/trainerState';
import { readScopedItem, writeScopedItem } from './userStorage';
import { cryptoRandomInt } from './random';
import {
  isValidDeckThemeId,
  loadDeckThemePreference,
  saveDeckThemePreference,
  type DeckThemeId
} from './deckTheme';
import {
  ACADEMY_STATS_STORAGE_KEY,
  CAREER_ROADMAP_STORAGE_KEY,
  INITIAL_ROADMAP,
  type RoadmapPhase
} from '../components/AcademyRoadmapDashboard';
import {
  EVAL_STATS_STORAGE_KEY,
  loadEvaluationStats,
  saveEvaluationStats,
  type LiveChallengeCloudSummary,
  type PT4CloudSummary,
  type SavedEvaluationSummary
} from '../components/EvaluationModule';
import type { DifficultyLevel } from '../engine/evaluationBank';
import {
  loadLiveChallengeState,
  saveLiveChallengeState,
  type LiveDecisionRecord
} from '../engine/handSimulator';
import { computeHudStats, getActiveTracker2DatabaseId, loadTracker2Databases } from '../engine/theTracker2Engine';

import {
  DEFAULT_PLAN_CONFIGS,
  getDefaultPlanPermissions,
  mergePlanConfig,
  type PlanConfigDoc,
  type PlanPermissions,
  type PlanTier
} from './planCatalog';

export type UserRole = 'user' | 'admin';
export type { PlanTier, PlanPermissions, PlanConfigDoc };
export { getDefaultPlanPermissions, DEFAULT_PLAN_CONFIGS, mergePlanConfig };

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
  studyLevel?: 'fish' | 'reg' | 'nit';
  studyLevelSource?: 'self_selected' | 'cohort_assignment' | 'admin_override';
  marketStudyEnrolled?: boolean;
  deckTheme?: DeckThemeId;
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
    const raw = readScopedItem(CAREER_ROADMAP_STORAGE_KEY);
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
    const raw = readScopedItem(ACADEMY_STATS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getTrainerEloFromLocal(): number {
  try {
    const stats = loadTrainerStats();
    return typeof stats?.elo === 'number' ? Math.max(0, Math.min(5000, Math.round(stats.elo))) : 1200;
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

function buildCompactLiveChallengeSummary(): LiveChallengeCloudSummary | undefined {
  try {
    const state = loadLiveChallengeState();
    if (!state.active && state.completedHands === 0 && state.records.length === 0) return undefined;
    return {
      active: Boolean(state.active),
      completedHands: Math.max(0, Math.round(state.completedHands)),
      targetHands: Math.max(10, Math.round(state.targetHands || 100)),
      updatedAt: state.updatedAt || Date.now(),
      records: state.records.slice(-40).map(r => ({
        id: clampString(r.id, 64, `rec-${Date.now()}`),
        handNumber: Math.max(1, Math.round(r.handNumber)),
        heroPos: clampString(r.heroPos, 12, 'BTN'),
        scenario: clampString(r.scenario, 24, 'SRP_IP'),
        street: clampString(r.street, 16, 'flop'),
        chosenAction: clampString(r.chosenAction, 48, 'Call'),
        bestAction: clampString(r.bestAction, 48, 'Check'),
        isOptimal: Boolean(r.isOptimal),
        isBlunder: Boolean(r.isBlunder),
        evLossBB: Number(r.evLossBB || 0),
        evLossPctPot: Number(r.evLossPctPot || 0),
        timestamp: Number(r.timestamp || Date.now())
      }))
    };
  } catch {
    return undefined;
  }
}

function buildCompactPT4Summary(): PT4CloudSummary | undefined {
  try {
    const dbs = loadTracker2Databases();
    const activeId = getActiveTracker2DatabaseId();
    const activeDb = dbs.find(d => d.id === activeId) || dbs[0];
    if (!activeDb || activeDb.hands.length === 0) return undefined;
    const stats = computeHudStats(activeDb.hands);
    return {
      totalDatabases: dbs.length,
      activeDbName: clampString(activeDb.name, 48, 'Base Principal'),
      totalHands: stats.hands,
      netWonBB: stats.netWonBB,
      evAdjustedBB: stats.evAdjustedBB,
      vpip: stats.vpip,
      pfr: stats.pfr,
      threeBet: stats.threeBet,
      updatedAt: activeDb.updatedAt || Date.now()
    };
  } catch {
    return undefined;
  }
}

export function getEvaluationStatsFromLocal(): SavedEvaluationSummary {
  const fallback = defaultEvaluationStats();
  const liveChallengeSummary = buildCompactLiveChallengeSummary();
  const pt4Summary = buildCompactPT4Summary();
  try {
    const raw = readScopedItem(EVAL_STATS_STORAGE_KEY);
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
        lastUpdatedAt: typeof parsed.lastUpdatedAt === 'number' ? parsed.lastUpdatedAt : Date.now(),
        ...(liveChallengeSummary ? { liveChallengeSummary } : parsed.liveChallengeSummary ? { liveChallengeSummary: parsed.liveChallengeSummary } : {}),
        ...(pt4Summary ? { pt4Summary } : parsed.pt4Summary ? { pt4Summary: parsed.pt4Summary } : {})
      };
    }
  } catch {
    // ignore
  }
  return {
    ...fallback,
    ...(liveChallengeSummary ? { liveChallengeSummary } : {}),
    ...(pt4Summary ? { pt4Summary } : {})
  };
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

export function mapSnapshotToUserProfile(id: string, data: Record<string, unknown>): UserProfileDoc {
  const evalRaw = (data.evaluationStats && typeof data.evaluationStats === 'object'
    ? data.evaluationStats
    : {}) as Partial<SavedEvaluationSummary>;
  const planTier: PlanTier = data.planTier === 'elite' || data.planTier === 'pro' ? data.planTier : 'free';
  const role: UserRole = data.role === 'admin' ? 'admin' : 'user';

  return {
    uid: typeof data.uid === 'string' ? data.uid : id,
    email: typeof data.email === 'string' ? data.email : '',
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Jugador Allin School',
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
      lastUpdatedAt: typeof evalRaw.lastUpdatedAt === 'number' ? evalRaw.lastUpdatedAt : Date.now(),
      ...(evalRaw.liveChallengeSummary ? { liveChallengeSummary: evalRaw.liveChallengeSummary } : {}),
      ...(evalRaw.pt4Summary ? { pt4Summary: evalRaw.pt4Summary } : {})
    },
    ...(data.studyLevel === 'fish' || data.studyLevel === 'reg' || data.studyLevel === 'nit'
      ? { studyLevel: data.studyLevel }
      : {}),
    ...(data.studyLevelSource === 'self_selected' ||
    data.studyLevelSource === 'cohort_assignment' ||
    data.studyLevelSource === 'admin_override'
      ? { studyLevelSource: data.studyLevelSource }
      : {}),
    ...(typeof data.marketStudyEnrolled === 'boolean'
      ? { marketStudyEnrolled: data.marketStudyEnrolled }
      : {}),
    ...(isValidDeckThemeId(data.deckTheme) ? { deckTheme: data.deckTheme } : {}),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}

export function buildBootstrappedAdminProfile(user: User): UserProfileDoc {
  const email = clampString(user.email, 160, BOOTSTRAPPED_ADMIN_EMAIL).toLowerCase();
  return {
    uid: user.uid,
    email,
    displayName: clampString(user.displayName, 80, 'Administrador Principal'),
    ...(user.photoURL ? { photoURL: clampString(user.photoURL, 512) } : {}),
    role: 'admin',
    planTier: 'elite',
    planActive: true,
    planPermissions: getDefaultPlanPermissions('elite', true),
    elo: 1400,
    masteryScore: 95,
    totalDecisions: 0,
    totalMistakes: 0,
    roadmapDoneIds: [],
    categoryStats: {},
    evaluationStats: defaultEvaluationStats()
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
  const safeEmail = clampString(user.email, 160, 'jugador@allinschool.app');

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
        'Jugador Allin School'
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
        deckTheme: loadDeckThemePreference(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (isBootstrappedAdmin) {
        newUserPayload.planPermissions = getDefaultPlanPermissions('elite', true);
      } else if (pendingInvite && pendingInvite.planPermissions && typeof pendingInvite.planPermissions === 'object') {
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

      const existingPerms = (existingData.planPermissions && typeof existingData.planPermissions === 'object'
        ? existingData.planPermissions
        : {}) as Record<string, unknown>;
      const needsAdminUpgrade =
        isBootstrappedAdmin &&
        (existingData.role !== 'admin' ||
          existingData.planTier !== 'elite' ||
          existingData.planActive !== true ||
          existingPerms.planAdmin !== true);

      if (!hasV32Fields || needsAdminUpgrade) {
        await updateDoc(userRef, {
          email: typeof existingData.email === 'string' && existingData.email.length >= 3 ? existingData.email : safeEmail,
          displayName: clampString(user.displayName, 80, 'Jugador Allin School'),
          ...(user.photoURL ? { photoURL: clampString(user.photoURL, 512) } : {}),
          role: isBootstrappedAdmin ? 'admin' : existingData.role === 'admin' ? 'admin' : 'user',
          planTier: isBootstrappedAdmin
            ? 'elite'
            : existingData.planTier === 'pro' || existingData.planTier === 'elite'
            ? existingData.planTier
            : 'free',
          planActive: isBootstrappedAdmin ? true : typeof existingData.planActive === 'boolean' ? existingData.planActive : true,
          ...(isBootstrappedAdmin ? { planPermissions: getDefaultPlanPermissions('elite', true) } : {}),
          elo,
          masteryScore: Math.max(0, Math.min(100, Math.round(learningProfile.masteryScore || 0))),
          totalDecisions: Math.max(0, Math.round(learningProfile.totalDecisions || 0)),
          totalMistakes: Math.max(0, Math.round(learningProfile.totalMistakes || 0)),
          roadmapDoneIds,
          categoryStats,
          evaluationStats,
          deckTheme: loadDeckThemePreference(),
          updatedAt: serverTimestamp()
        });
      } else {
        await updateDoc(userRef, {
          displayName: clampString(user.displayName, 80, 'Jugador Allin School'),
          ...(user.photoURL ? { photoURL: clampString(user.photoURL, 512) } : {}),
          elo,
          masteryScore: Math.max(0, Math.min(100, Math.round(learningProfile.masteryScore || 0))),
          totalDecisions: Math.max(0, Math.round(learningProfile.totalDecisions || 0)),
          totalMistakes: Math.max(0, Math.round(learningProfile.totalMistakes || 0)),
          roadmapDoneIds,
          categoryStats,
          evaluationStats,
          deckTheme: loadDeckThemePreference(),
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

/**
 * Hidrata el almacenamiento local aislado por UID desde Firestore antes de subir cambios,
 * garantizando que cada estudiante conserve su progreso al entrar desde otro dispositivo o cambiar de cuenta.
 */
export async function hydrateLocalStateFromCloud(user: User): Promise<UserProfileDoc | null> {
  if (!user.uid || !user.emailVerified) return null;

  let profile: UserProfileDoc | null = null;
  try {
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    if (!profileSnap.exists()) return null;
    profile = mapSnapshotToUserProfile(profileSnap.id, profileSnap.data() as Record<string, unknown>);
  } catch {
    return null;
  }

  // 1. Trainer ELO
  const localTrainer = loadTrainerStats();
  if (localTrainer.handsPlayed === 0 && localTrainer.elo === 1200 && profile.elo !== 1200) {
    saveTrainerStats({ ...localTrainer, elo: profile.elo });
  }

  // 2. Evaluation Stats (XP, Nivel desbloqueado, notas y categorías)
  const localEval = loadEvaluationStats();
  const cloudEval = profile.evaluationStats;
  if (
    cloudEval &&
    (cloudEval.xp > localEval.xp ||
      cloudEval.examsTaken > localEval.examsTaken ||
      cloudEval.unlockedLevel > localEval.unlockedLevel ||
      Boolean(cloudEval.liveChallengeSummary) ||
      Boolean(cloudEval.pt4Summary))
  ) {
    saveEvaluationStats({
      ...localEval,
      ...cloudEval,
      categoryPerf: { ...cloudEval.categoryPerf, ...localEval.categoryPerf },
      liveChallengeSummary: cloudEval.liveChallengeSummary ?? localEval.liveChallengeSummary,
      pt4Summary: cloudEval.pt4Summary ?? localEval.pt4Summary
    });
  }

  // 2b. Hydrate Reto 100 Manos across devices if cloud holds newer/more progress
  if (cloudEval?.liveChallengeSummary) {
    const localLive = loadLiveChallengeState();
    const cloudLive = cloudEval.liveChallengeSummary;
    if (
      cloudLive.completedHands > localLive.completedHands ||
      (localLive.records.length === 0 && cloudLive.records.length > 0)
    ) {
      saveLiveChallengeState({
        active: cloudLive.active,
        startedAt: cloudLive.updatedAt || Date.now(),
        completedHands: cloudLive.completedHands,
        targetHands: cloudLive.targetHands || 100,
        updatedAt: cloudLive.updatedAt || Date.now(),
        records: cloudLive.records as unknown as LiveDecisionRecord[]
      });
    }
  }

  // 3. Academy Category Stats
  const localCatStats = getCategoryStatsFromLocal();
  const cloudCatEntries = Object.entries(profile.categoryStats || {});
  if (cloudCatEntries.length > 0) {
    const mergedCatStats = { ...localCatStats };
    let changed = false;
    for (const [cat, cStat] of cloudCatEntries) {
      const lStat = mergedCatStats[cat];
      if (!lStat || cStat.attempts > lStat.attempts) {
        mergedCatStats[cat] = { attempts: cStat.attempts, correct: cStat.correct };
        changed = true;
      }
    }
    if (changed) {
      writeScopedItem(ACADEMY_STATS_STORAGE_KEY, JSON.stringify(mergedCatStats));
    }
  }

  // 4. Career Roadmap Milestones
  if (Array.isArray(profile.roadmapDoneIds) && profile.roadmapDoneIds.length > 0) {
    try {
      const rawRoadmap = readScopedItem(CAREER_ROADMAP_STORAGE_KEY);
      const currentPhases: RoadmapPhase[] = rawRoadmap ? JSON.parse(rawRoadmap) : INITIAL_ROADMAP;
      const doneSet = new Set(profile.roadmapDoneIds);
      const hydratedPhases = currentPhases.map(phase => ({
        ...phase,
        milestones: (phase.milestones || []).map(m => ({
          ...m,
          done: m.done || doneSet.has(m.id)
        }))
      }));
      writeScopedItem(CAREER_ROADMAP_STORAGE_KEY, JSON.stringify(hydratedPhases));
    } catch {
      // ignore roadmap hydration error
    }
  }

  // 5. AutoLearningEngine Summary + Deck Theme Preference
  AutoLearningEngine.getInstance().hydrateSummaryFromCloud({
    totalDecisions: profile.totalDecisions,
    totalMistakes: profile.totalMistakes,
    masteryScore: profile.masteryScore
  });
  if (profile.deckTheme && isValidDeckThemeId(profile.deckTheme)) {
    saveDeckThemePreference(profile.deckTheme);
  }

  // 6. SM-2 Items Subcollection
  try {
    const sm2Snap = await getDocs(
      query(collection(db, 'users', user.uid, 'sm2Items'), where('ownerId', '==', user.uid), limit(50))
    );
    const cloudSm2Items: SM2Item[] = sm2Snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        type: (data.itemType === 'hand' || data.itemType === 'scenario' ? data.itemType : 'concept') as SM2Item['type'],
        title: String(data.title || 'Spot SM-2'),
        category: String(data.category || 'General'),
        content: {
          prompt: String(data.prompt || ''),
          explanation: String(data.explanation || ''),
          rule: String(data.rule || '')
        },
        intervalDays: Number(data.intervalDays || 1),
        repetitions: Number(data.repetitions || 0),
        easeFactor: Number(data.easeFactor || 2.5),
        nextReviewDate: Number(data.nextReviewDate || Date.now()),
        createdDate: Date.now(),
        reviewCount: Number(data.reviewCount || 0),
        history: []
      };
    });
    SpacedRepetitionManager.getInstance().mergeItemsFromCloud(cloudSm2Items);
  } catch {
    // Non-fatal
  }

  // 7. Critical Mistakes Subcollection
  try {
    const mSnap = await getDocs(
      query(collection(db, 'users', user.uid, 'mistakes'), where('ownerId', '==', user.uid), limit(30))
    );
    const cloudMistakes: LearnerMistakeRecord[] = mSnap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        timestamp: Date.now(),
        scenarioTitle: String(data.scenarioTitle || 'Spot'),
        heroCombo: String(data.heroCombo || 'AsKd'),
        boardCards: [],
        boardTexture: {
          wetness: (typeof data.wetness === 'string' ? data.wetness : 'Seco (Dry)') as LearnerMistakeRecord['boardTexture']['wetness'],
          suitPattern: 'Rainbow',
          highCard: 'A',
          isPaired: false,
          summary: String(data.wetness || 'Seco (Dry)')
        },
        street: 'flop',
        heroPos: 'BTN',
        villainPos: 'BB',
        potBB: 6,
        chosenAction: String(data.chosenAction || 'Bet'),
        bestAction: String(data.bestAction || 'Check'),
        chosenFrequency: 0,
        bestFrequency: 1,
        evLossBB: 1,
        evLossChips: 2,
        evLossPercentOfPot: Number(data.evLossPercentOfPot || 0),
        isMistakeThresholdExceeded: true,
        grade: 'mistake',
        leakCategory: String(data.wetness || 'Seco (Dry)'),
        prescriptiveFix: String(data.prescriptiveFix || '')
      };
    });
    LearnerService.getInstance().mergeMistakesFromCloud(cloudMistakes);
  } catch {
    // Non-fatal
  }

  return profile;
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
  const logId = sanitizeDocId(`log-${Date.now()}-${cryptoRandomInt(10000)}`);
  const logPath = `adminAuditLogs/${logId}`;
  try {
    await setDoc(doc(db, 'adminAuditLogs', logId), {
      actorUid: actor.uid,
      actorEmail: clampString(actor.email, 160, 'admin@allinschool.app'),
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
  const safeName = clampString(input.displayName, 80, normalizedEmail.split('@')[0] || 'Jugador Allin School');
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

export interface StudentSupportTicket {
  id: string;
  userUid: string;
  userEmail: string;
  userName: string;
  subject: string;
  description: string;
  category: 'Acceso' | 'Pagos' | 'Duda Técnica' | 'Otro';
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  adminNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function submitStudentSupportTicket(
  user: User,
  input: {
    subject: string;
    description: string;
    category: 'Acceso' | 'Pagos' | 'Duda Técnica' | 'Otro';
    priority: 'low' | 'medium' | 'high';
  }
): Promise<string> {
  if (!user.uid || !user.emailVerified) {
    throw new Error('Debes iniciar sesión con una cuenta Google verificada.');
  }
  const cleanSubject = clampString(input.subject, 120, '');
  const cleanDescription = clampString(input.description, 600, '');
  if (cleanSubject.length < 2) {
    throw new Error('El asunto debe tener al menos 2 caracteres.');
  }
  if (cleanDescription.length < 4) {
    throw new Error('Describe tu consulta con al menos 4 caracteres.');
  }

  const ticketId = sanitizeDocId(`tkt-${Date.now()}-${cryptoRandomInt(10000)}`);
  const ticketPath = `supportTickets/${ticketId}`;
  try {
    await setDoc(doc(db, 'supportTickets', ticketId), {
      userUid: user.uid,
      userEmail: clampString(user.email, 160, 'alumno@allinschool.app').toLowerCase(),
      userName: clampString(user.displayName, 80, 'Alumno Allin School'),
      subject: cleanSubject,
      description: cleanDescription,
      category: input.category,
      priority: input.priority,
      status: 'open',
      adminNotes: '',
      createdByUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return ticketId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, ticketPath);
  }
}

export async function fetchMySupportTickets(user: User): Promise<StudentSupportTicket[]> {
  if (!user.uid || !user.emailVerified) return [];
  const path = 'supportTickets';
  try {
    const q = query(
      collection(db, 'supportTickets'),
      where('userUid', '==', user.uid),
      limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      const status =
        data.status === 'resolved' || data.status === 'in_progress' ? data.status : 'open';
      const priority =
        data.priority === 'high' || data.priority === 'low' ? data.priority : 'medium';
      const category =
        data.category === 'Acceso' ||
        data.category === 'Pagos' ||
        data.category === 'Duda Técnica' ||
        data.category === 'Otro'
          ? data.category
          : 'Otro';
      return {
        id: d.id,
        userUid: String(data.userUid || ''),
        userEmail: String(data.userEmail || ''),
        userName: String(data.userName || ''),
        subject: String(data.subject || ''),
        description: String(data.description || ''),
        category,
        priority,
        status,
        adminNotes: String(data.adminNotes || ''),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export { defaultEvaluationStats };
