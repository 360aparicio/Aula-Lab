/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * AdminCloudSync: Operaciones administrativas en Firestore compartido entre
 * el Repositorio Administrativo Independiente (allin-studio-admin) y el
 * Repositorio Educativo (allin-school-edu).
 */

import type { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  DEFAULT_PLAN_CONFIGS,
  getDefaultPlanPermissions,
  mergePlanConfig,
  type PlanConfigDoc,
  type PlanPermissions,
  type PlanTier
} from './planCatalog';

export type UserRole = 'user' | 'admin';
export type DifficultyLevel = 1 | 2 | 3 | 4;

export interface SavedEvaluationSummary {
  lastMode: string;
  lastScorePct: number;
  bestScorePct: number;
  examsTaken: number;
  passedCount: number;
  currentLevel: DifficultyLevel;
  unlockedLevel: DifficultyLevel;
  xp: number;
  weakestCategory: string;
  strongestCategory: string;
  categoryPerf: Record<string, { attempts: number; correct: number }>;
  lastUpdatedAt: number;
}

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

export const BOOTSTRAPPED_ADMIN_EMAIL = '360aparicio@gmail.com';

export function isBootstrappedAdminUser(user: User | null): boolean {
  if (!user || !user.emailVerified || !user.email) return false;
  return user.email.trim().toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
}

export function computeInviteDocId(email: string): string {
  const normalized = email.trim().toLowerCase().replace(/[^a-zA-Z0-9_\-]/g, '_');
  return `inv_${normalized}`.slice(0, 120);
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

export function defaultEvaluationStats(): SavedEvaluationSummary {
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
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Alumno Allin School',
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

export async function verifyAdminProfileForSession(user: User): Promise<UserProfileDoc | null> {
  if (!user.uid || !user.emailVerified) return null;
  const userRef = doc(db, 'users', user.uid);

  let snap = null;
  try {
    snap = await getDoc(userRef);
  } catch {
    // Brief retry for cold IndexedDB/Firestore channel immediately after / -> /admin/ switch
    await new Promise(resolve => setTimeout(resolve, 450));
    snap = await getDoc(userRef);
  }

  if (snap.exists()) {
    const profile = mapSnapshotToUserProfile(snap.id, snap.data() as Record<string, unknown>);
    if (isBootstrappedAdminUser(user) && (profile.role !== 'admin' || !profile.planPermissions?.planAdmin || !profile.planActive)) {
      const upgradedPerms = { ...profile.planPermissions, planAdmin: true };
      void updateDoc(userRef, {
        role: 'admin',
        planActive: true,
        planPermissions: upgradedPerms,
        updatedAt: serverTimestamp()
      }).catch(() => {});
      return { ...profile, role: 'admin', planActive: true, planPermissions: upgradedPerms };
    }
    return profile;
  }

  if (isBootstrappedAdminUser(user)) {
    const email = clampString(user.email, 160, BOOTSTRAPPED_ADMIN_EMAIL).toLowerCase();
    const newProfile: Record<string, unknown> = {
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
      evaluationStats: defaultEvaluationStats(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(userRef, newProfile);
    const reloaded = await getDoc(userRef);
    if (reloaded.exists()) {
      return mapSnapshotToUserProfile(reloaded.id, reloaded.data() as Record<string, unknown>);
    }
    return buildBootstrappedAdminProfile(user);
  }

  return null;
}

function secureRandomInt(bound: number): number {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    c.getRandomValues(arr);
    return arr[0] % Math.max(1, bound);
  }
  return Date.now() % Math.max(1, bound);
}

export async function recordAdminAuditLog(
  targetUid: string,
  targetLabel: string,
  action: string,
  detail: string
): Promise<void> {
  const actor = auth.currentUser;
  if (!actor) return;
  const logId = sanitizeDocId(`log-${Date.now()}-${secureRandomInt(10000)}`);
  const logPath = `adminAuditLogs/${logId}`;
  const safeTargetUid = clampString(targetUid, 128, 'system_target').padEnd(6, '_');
  try {
    await setDoc(doc(db, 'adminAuditLogs', logId), {
      actorUid: actor.uid,
      actorEmail: clampString(actor.email, 160, 'admin@labstudio.app'),
      targetUid: safeTargetUid,
      targetLabel: clampString(targetLabel, 160, 'Usuario'),
      action: clampString(action, 64, 'UPDATE'),
      detail: clampString(detail, 300, 'Acción administrativa'),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, logPath);
  }
}

export async function fetchAdminAuditLogs(maxLogs = 50): Promise<AdminAuditLogEntry[]> {
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
  const safeName = clampString(input.displayName, 80, normalizedEmail.split('@')[0] || 'Alumno Allin School');
  const cleanPerms: PlanPermissions = {
    labPro: Boolean(input.planPermissions.labPro),
    webBrain: Boolean(input.planPermissions.webBrain),
    unlimitedEval: Boolean(input.planPermissions.unlimitedEval),
    pdfExport: Boolean(input.planPermissions.pdfExport),
    planAdmin: input.role === 'admin' || Boolean(input.planPermissions.planAdmin)
  };
  const finalRole: UserRole = cleanPerms.planAdmin ? 'admin' : 'user';

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
    // Non-fatal
  }

  await recordAdminAuditLog(
    targetUid,
    email,
    'MANUAL_USER_DELETED',
    `Registro manual pendiente eliminado (${email})`
  );
}

/**
 * PLAN CATALOG MANAGEMENT (/planConfigs/{free|pro|elite})
 * Controla secciones visibles del Aula/Lab, límites y beneficios de cada plan en vivo.
 */
export async function fetchAllPlanConfigsForAdmin(): Promise<Record<PlanTier, PlanConfigDoc>> {
  const result: Record<PlanTier, PlanConfigDoc> = {
    free: { ...DEFAULT_PLAN_CONFIGS.free },
    pro: { ...DEFAULT_PLAN_CONFIGS.pro },
    elite: { ...DEFAULT_PLAN_CONFIGS.elite }
  };

  const colPath = 'planConfigs';
  try {
    const snap = await getDocs(query(collection(db, 'planConfigs'), limit(10)));
    for (const d of snap.docs) {
      if (d.id === 'free' || d.id === 'pro' || d.id === 'elite') {
        result[d.id] = mergePlanConfig(d.id, d.data() as Record<string, unknown>);
      }
    }
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
}

export async function adminSavePlanConfig(
  config: PlanConfigDoc,
  auditDetail?: string
): Promise<PlanConfigDoc> {
  const actor = auth.currentUser;
  if (!actor) {
    throw new Error('Debes iniciar sesión como Administrador para guardar configuraciones de plan.');
  }

  const normalized = mergePlanConfig(config.planTier, config as unknown as Record<string, unknown>);
  const cleanBenefits = normalized.benefits
    .map(b => clampString(b, 140, ''))
    .filter(b => b.length > 0)
    .slice(0, 15);

  const docPath = `planConfigs/${normalized.planTier}`;
  const payload = {
    planTier: normalized.planTier,
    displayName: clampString(normalized.displayName, 48, DEFAULT_PLAN_CONFIGS[normalized.planTier].displayName),
    tagline: clampString(normalized.tagline, 160, ''),
    priceLabel: clampString(normalized.priceLabel, 32, DEFAULT_PLAN_CONFIGS[normalized.planTier].priceLabel),
    maxDailyEvaluations: Math.max(0, Math.min(1000, Math.round(normalized.maxDailyEvaluations))),
    hideLockedSections: Boolean(normalized.hideLockedSections),
    visibleSections: {
      wizard: Boolean(normalized.visibleSections.wizard),
      solver: Boolean(normalized.visibleSections.solver),
      trainer: Boolean(normalized.visibleSections.trainer),
      cheatsheet: Boolean(normalized.visibleSections.cheatsheet),
      academy: Boolean(normalized.visibleSections.academy),
      solver_meta: Boolean(normalized.visibleSections.solver_meta),
      ranges: Boolean(normalized.visibleSections.ranges),
      scenarios: Boolean(normalized.visibleSections.scenarios),
      benchmarks: Boolean(normalized.visibleSections.benchmarks)
    },
    defaultPermissions: {
      labPro: Boolean(normalized.defaultPermissions.labPro),
      webBrain: Boolean(normalized.defaultPermissions.webBrain),
      unlimitedEval: Boolean(normalized.defaultPermissions.unlimitedEval),
      pdfExport: Boolean(normalized.defaultPermissions.pdfExport),
      planAdmin: Boolean(normalized.defaultPermissions.planAdmin)
    },
    benefits: cleanBenefits,
    updatedByUid: actor.uid,
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'planConfigs', normalized.planTier), payload);

    const enabledCount = Object.values(payload.visibleSections).filter(Boolean).length;
    await recordAdminAuditLog(
      `plan_catalog_${normalized.planTier}`,
      normalized.displayName,
      'PLAN_CATALOG_UPDATED',
      auditDetail ||
        `Catálogo ${normalized.planTier.toUpperCase()} actualizado: ${enabledCount}/9 secciones habilitadas, ${cleanBenefits.length} beneficios, ${payload.hideLockedSections ? 'oculta bloqueadas' : 'muestra candado'}.`
    );

    return {
      ...normalized,
      benefits: cleanBenefits,
      updatedByUid: actor.uid,
      updatedAt: Date.now()
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, docPath);
  }
}

export async function adminSeedDefaultPlanConfigs(): Promise<Record<PlanTier, PlanConfigDoc>> {
  const tiers: PlanTier[] = ['free', 'pro', 'elite'];
  const next = { ...DEFAULT_PLAN_CONFIGS };
  for (const tier of tiers) {
    next[tier] = await adminSavePlanConfig(
      DEFAULT_PLAN_CONFIGS[tier],
      `Restaurado catálogo por defecto del plan ${tier.toUpperCase()}.`
    );
  }
  return next;
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
  let planConfigsCount = 0;
  let invitesCount = 0;
  let billingCount = 0;
  let announcementsCount = 0;
  let ticketsCount = 0;

  await Promise.all([
    getDocs(query(collection(db, 'adminAuditLogs'), limit(500))).then(s => { auditLogsCount = s.size; }).catch(() => {}),
    getDocs(query(collection(db, 'planConfigs'), limit(10))).then(s => { planConfigsCount = s.size; }).catch(() => {}),
    getDocs(query(collection(db, 'userInvites'), limit(200))).then(s => { invitesCount = s.size; }).catch(() => {}),
    getDocs(query(collection(db, 'billingTransactions'), limit(500))).then(s => { billingCount = s.size; }).catch(() => {}),
    getDocs(query(collection(db, 'platformAnnouncements'), limit(100))).then(s => { announcementsCount = s.size; }).catch(() => {}),
    getDocs(query(collection(db, 'supportTickets'), limit(200))).then(s => { ticketsCount = s.size; }).catch(() => {})
  ]);

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
      collection: 'planConfigs',
      label: 'Catálogo Planes (/planConfigs)',
      documents: planConfigsCount,
      estimatedKB: Math.round(planConfigsCount * 1.2 * 10) / 10
    },
    {
      collection: 'userInvites',
      label: 'Pre-registros (/userInvites)',
      documents: invitesCount,
      estimatedKB: Math.round(invitesCount * 0.55 * 10) / 10
    },
    {
      collection: 'billingTransactions',
      label: 'Ingresos (/billingTransactions)',
      documents: billingCount,
      estimatedKB: Math.round(billingCount * 0.65 * 10) / 10
    },
    {
      collection: 'platformAnnouncements',
      label: 'Anuncios (/platformAnnouncements)',
      documents: announcementsCount,
      estimatedKB: Math.round(announcementsCount * 0.45 * 10) / 10
    },
    {
      collection: 'supportTickets',
      label: 'Soporte (/supportTickets)',
      documents: ticketsCount,
      estimatedKB: Math.round(ticketsCount * 0.6 * 10) / 10
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
    quotaLimitKB: 1048576,
    latencyMs,
    collections,
    monthlyCohorts: cohorts,
    avgRetentionPct,
    sampledAt: Date.now()
  };
}

/**
 * USER INVITES & REGISTRATIONS (/userInvites)
 */
export interface UserInviteEntry {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  planTier: PlanTier;
  planActive: boolean;
  planPermissions: PlanPermissions;
  status: 'pending' | 'claimed';
  manualUserDocId: string;
  createdByUid: string;
  claimedUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function fetchUserInvitesForAdmin(maxRows = 150): Promise<UserInviteEntry[]> {
  const path = 'userInvites';
  try {
    const q = query(collection(db, 'userInvites'), orderBy('updatedAt', 'desc'), limit(maxRows));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      const tier: PlanTier = data.planTier === 'elite' || data.planTier === 'pro' ? data.planTier : 'free';
      const role: UserRole = data.role === 'admin' ? 'admin' : 'user';
      return {
        id: d.id,
        email: String(data.email || ''),
        displayName: String(data.displayName || 'Alumno Allin School'),
        role,
        planTier: tier,
        planActive: Boolean(data.planActive ?? true),
        planPermissions: parsePlanPermissions(data.planPermissions, tier, role),
        status: data.status === 'claimed' ? 'claimed' : 'pending',
        manualUserDocId: String(data.manualUserDocId || ''),
        createdByUid: String(data.createdByUid || ''),
        ...(typeof data.claimedUid === 'string' ? { claimedUid: data.claimedUid } : {}),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminRevokeUserInvite(invite: UserInviteEntry): Promise<void> {
  const path = `userInvites/${invite.id}`;
  try {
    await deleteDoc(doc(db, 'userInvites', invite.id));
    if (invite.status === 'pending' && invite.manualUserDocId.startsWith('manual_')) {
      try {
        await deleteDoc(doc(db, 'users', invite.manualUserDocId));
      } catch {
        // Non-fatal if placeholder already removed
      }
    }
    await recordAdminAuditLog(
      invite.manualUserDocId || invite.id,
      invite.email,
      'INVITE_REVOKED',
      `Invitación y pre-registro revocado para ${invite.email}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * BILLING TRANSACTIONS & REVENUE LEDGER (/billingTransactions)
 */
export type BillingPaymentMethod = 'Stripe' | 'Transferencia' | 'PayPal' | 'Efectivo' | 'Cortesía';
export type BillingStatus = 'paid' | 'pending' | 'refunded';

export interface BillingTransactionEntry {
  id: string;
  userUid: string;
  userEmail: string;
  userName: string;
  planTier: PlanTier;
  amountUsd: number;
  currency: 'USD';
  paymentMethod: BillingPaymentMethod;
  status: BillingStatus;
  billingPeriod: string;
  referenceCode: string;
  notes: string;
  recordedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CreateBillingTransactionInput {
  userUid: string;
  userEmail: string;
  userName: string;
  planTier: PlanTier;
  amountUsd: number;
  paymentMethod: BillingPaymentMethod;
  status: BillingStatus;
  billingPeriod: string;
  referenceCode: string;
  notes: string;
  alsoActivatePlan?: boolean;
}

export async function fetchBillingTransactionsForAdmin(maxRows = 150): Promise<BillingTransactionEntry[]> {
  const path = 'billingTransactions';
  try {
    const q = query(collection(db, 'billingTransactions'), orderBy('createdAt', 'desc'), limit(maxRows));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      const tier: PlanTier = data.planTier === 'elite' || data.planTier === 'pro' ? data.planTier : 'free';
      const methodRaw = String(data.paymentMethod || 'Stripe');
      const paymentMethod: BillingPaymentMethod =
        methodRaw === 'Transferencia' || methodRaw === 'PayPal' || methodRaw === 'Efectivo' || methodRaw === 'Cortesía'
          ? methodRaw
          : 'Stripe';
      const statusRaw = String(data.status || 'paid');
      const status: BillingStatus =
        statusRaw === 'pending' || statusRaw === 'refunded' ? statusRaw : 'paid';
      return {
        id: d.id,
        userUid: String(data.userUid || ''),
        userEmail: String(data.userEmail || ''),
        userName: String(data.userName || ''),
        planTier: tier,
        amountUsd: Number(data.amountUsd || 0),
        currency: 'USD',
        paymentMethod,
        status,
        billingPeriod: String(data.billingPeriod || ''),
        referenceCode: String(data.referenceCode || ''),
        notes: String(data.notes || ''),
        recordedByUid: String(data.recordedByUid || ''),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminCreateBillingTransaction(
  input: CreateBillingTransactionInput
): Promise<BillingTransactionEntry> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Sesión de Administrador requerida.');

  const txId = sanitizeDocId(`tx-${Date.now()}-${secureRandomInt(10000)}`);
  const path = `billingTransactions/${txId}`;
  const cleanAmount = Math.max(0, Math.min(100000, Math.round(Number(input.amountUsd) * 100) / 100));
  const cleanPeriod = clampString(input.billingPeriod, 16, new Date().toISOString().slice(0, 7));
  const payload = {
    userUid: clampString(input.userUid, 128, 'manual_tx').padEnd(4, '_'),
    userEmail: clampString(input.userEmail, 160, 'alumno@allinschool.app').toLowerCase(),
    userName: clampString(input.userName, 80, 'Alumno Allin School'),
    planTier: input.planTier,
    amountUsd: cleanAmount,
    currency: 'USD' as const,
    paymentMethod: input.paymentMethod,
    status: input.status,
    billingPeriod: cleanPeriod.length >= 7 ? cleanPeriod : new Date().toISOString().slice(0, 7),
    referenceCode: clampString(input.referenceCode, 64, ''),
    notes: clampString(input.notes, 240, ''),
    recordedByUid: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'billingTransactions', txId), payload);

    if (input.alsoActivatePlan && input.userUid && !input.userUid.startsWith('ext_')) {
      try {
        await updateDoc(doc(db, 'users', input.userUid), {
          planTier: input.planTier,
          planActive: input.status !== 'refunded',
          updatedAt: serverTimestamp()
        });
      } catch {
        // Non-fatal if userUid is external reference
      }
    }

    await recordAdminAuditLog(
      payload.userUid,
      payload.userEmail,
      'BILLING_RECORDED',
      `Registro financiero ${input.status.toUpperCase()} $${cleanAmount} USD (${input.planTier.toUpperCase()} · ${input.paymentMethod})`
    );

    return {
      id: txId,
      ...payload,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminUpdateBillingStatus(
  tx: BillingTransactionEntry,
  nextStatus: BillingStatus
): Promise<void> {
  const path = `billingTransactions/${tx.id}`;
  try {
    await updateDoc(doc(db, 'billingTransactions', tx.id), {
      status: nextStatus,
      updatedAt: serverTimestamp()
    });
    await recordAdminAuditLog(
      tx.userUid,
      tx.userEmail,
      'BILLING_STATUS_CHANGED',
      `Transacción ${tx.id} ($${tx.amountUsd} USD) actualizada de ${tx.status.toUpperCase()} a ${nextStatus.toUpperCase()}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * PLATFORM ANNOUNCEMENTS (/platformAnnouncements)
 */
export type AnnouncementSeverity = 'info' | 'success' | 'warning';
export type AnnouncementTargetPlan = 'all' | PlanTier;

export interface PlatformAnnouncementEntry {
  id: string;
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  targetPlan: AnnouncementTargetPlan;
  active: boolean;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function fetchAnnouncementsForAdmin(): Promise<PlatformAnnouncementEntry[]> {
  const path = 'platformAnnouncements';
  try {
    const q = query(collection(db, 'platformAnnouncements'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      const sev = data.severity === 'success' || data.severity === 'warning' ? data.severity : 'info';
      const tp = data.targetPlan === 'free' || data.targetPlan === 'pro' || data.targetPlan === 'elite' ? data.targetPlan : 'all';
      return {
        id: d.id,
        title: String(data.title || 'Anuncio'),
        message: String(data.message || ''),
        severity: sev,
        targetPlan: tp,
        active: Boolean(data.active),
        createdByUid: String(data.createdByUid || ''),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminCreateAnnouncement(input: {
  title: string;
  message: string;
  severity: AnnouncementSeverity;
  targetPlan: AnnouncementTargetPlan;
  active: boolean;
}): Promise<PlatformAnnouncementEntry> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Sesión de Administrador requerida.');
  const annId = sanitizeDocId(`ann-${Date.now()}-${secureRandomInt(1000)}`);
  const path = `platformAnnouncements/${annId}`;
  const title = clampString(input.title, 90, 'Comunicado Oficial');
  const message = clampString(input.message, 300, 'Actualización en Allin School.');
  const payload = {
    title: title.length >= 2 ? title : 'Aviso',
    message: message.length >= 4 ? message : 'Novedades disponibles en el Laboratorio.',
    severity: input.severity,
    targetPlan: input.targetPlan,
    active: Boolean(input.active),
    createdByUid: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'platformAnnouncements', annId), payload);
    await recordAdminAuditLog(
      annId,
      payload.title,
      'ANNOUNCEMENT_CREATED',
      `Anuncio "${payload.title}" publicado para ${payload.targetPlan.toUpperCase()} (${payload.active ? 'VISIBLE' : 'BORRADOR'})`
    );
    return { id: annId, ...payload, createdAt: Date.now(), updatedAt: Date.now() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminToggleAnnouncementActive(ann: PlatformAnnouncementEntry): Promise<void> {
  const path = `platformAnnouncements/${ann.id}`;
  const nextActive = !ann.active;
  try {
    await updateDoc(doc(db, 'platformAnnouncements', ann.id), {
      active: nextActive,
      updatedAt: serverTimestamp()
    });
    await recordAdminAuditLog(
      ann.id,
      ann.title,
      'ANNOUNCEMENT_TOGGLED',
      `Anuncio "${ann.title}" marcado como ${nextActive ? 'ACTIVO' : 'PAUSADO'}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteAnnouncement(ann: PlatformAnnouncementEntry): Promise<void> {
  const path = `platformAnnouncements/${ann.id}`;
  try {
    await deleteDoc(doc(db, 'platformAnnouncements', ann.id));
    await recordAdminAuditLog(ann.id, ann.title, 'ANNOUNCEMENT_DELETED', `Anuncio "${ann.title}" eliminado.`);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * SUPPORT TICKETS (/supportTickets)
 */
export type TicketCategory = 'Acceso' | 'Pagos' | 'Duda Técnica' | 'Otro';
export type TicketPriority = 'low' | 'medium' | 'high';
export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export interface SupportTicketEntry {
  id: string;
  userUid: string;
  userEmail: string;
  userName: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  adminNotes: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function fetchSupportTicketsForAdmin(): Promise<SupportTicketEntry[]> {
  const path = 'supportTickets';
  try {
    const q = query(collection(db, 'supportTickets'), orderBy('updatedAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => {
      const data = d.data() as Record<string, unknown>;
      const catRaw = String(data.category || 'Otro');
      const category: TicketCategory =
        catRaw === 'Acceso' || catRaw === 'Pagos' || catRaw === 'Duda Técnica' ? catRaw : 'Otro';
      const prio: TicketPriority = data.priority === 'high' || data.priority === 'medium' ? data.priority : 'low';
      const st: TicketStatus = data.status === 'resolved' || data.status === 'in_progress' ? data.status : 'open';
      return {
        id: d.id,
        userUid: String(data.userUid || ''),
        userEmail: String(data.userEmail || ''),
        userName: String(data.userName || ''),
        subject: String(data.subject || ''),
        description: String(data.description || ''),
        category,
        priority: prio,
        status: st,
        adminNotes: String(data.adminNotes || ''),
        createdByUid: String(data.createdByUid || ''),
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function adminCreateSupportTicket(input: {
  userUid: string;
  userEmail: string;
  userName: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
}): Promise<SupportTicketEntry> {
  const actor = auth.currentUser;
  if (!actor) throw new Error('Sesión de Administrador requerida.');
  const ticketId = sanitizeDocId(`tkt-${Date.now()}-${secureRandomInt(1000)}`);
  const path = `supportTickets/${ticketId}`;
  const subject = clampString(input.subject, 120, 'Seguimiento de cuenta');
  const description = clampString(input.description, 600, 'Nota administrativa.');
  const payload = {
    userUid: clampString(input.userUid, 128, actor.uid).padEnd(4, '_'),
    userEmail: clampString(input.userEmail, 160, actor.email || 'admin@allinschool.app').toLowerCase(),
    userName: clampString(input.userName, 80, 'Alumno Allin School'),
    subject: subject.length >= 2 ? subject : 'Ticket',
    description: description.length >= 4 ? description : 'Seguimiento',
    category: input.category,
    priority: input.priority,
    status: 'open' as TicketStatus,
    adminNotes: '',
    createdByUid: actor.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, 'supportTickets', ticketId), payload);
    await recordAdminAuditLog(
      payload.userUid,
      payload.userEmail,
      'TICKET_CREATED',
      `Ticket "${payload.subject}" creado (${payload.category} · ${payload.priority.toUpperCase()})`
    );
    return { id: ticketId, ...payload, createdAt: Date.now(), updatedAt: Date.now() };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function adminUpdateSupportTicket(
  ticket: SupportTicketEntry,
  updates: { status: TicketStatus; priority: TicketPriority; adminNotes: string }
): Promise<void> {
  const path = `supportTickets/${ticket.id}`;
  try {
    await updateDoc(doc(db, 'supportTickets', ticket.id), {
      status: updates.status,
      priority: updates.priority,
      adminNotes: clampString(updates.adminNotes, 400, ''),
      updatedAt: serverTimestamp()
    });
    await recordAdminAuditLog(
      ticket.userUid,
      ticket.userEmail,
      'TICKET_UPDATED',
      `Ticket "${ticket.subject}" actualizado a ${updates.status.toUpperCase()}`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function adminDeleteSupportTicket(ticket: SupportTicketEntry): Promise<void> {
  const path = `supportTickets/${ticket.id}`;
  try {
    await deleteDoc(doc(db, 'supportTickets', ticket.id));
    await recordAdminAuditLog(
      ticket.userUid,
      ticket.userEmail,
      'TICKET_DELETED',
      `Ticket "${ticket.subject}" eliminado.`
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

