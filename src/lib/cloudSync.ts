/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CloudSync: Sincronización privada en Firestore de Perfil, Mazo SM-2,
 * Errores capturados (>5% EV) e Hitos de Carrera por usuario autenticado.
 */

import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
  query,
  where,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { SpacedRepetitionManager, type SM2Item } from '../engine/spacedRepetition';
import { LearnerService, type LearnerMistakeRecord } from '../engine/learner';
import { AutoLearningEngine } from '../engine/autoLearningEngine';

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

export async function syncUserProfileToCloud(user: User): Promise<void> {
  if (!user.uid || !user.emailVerified) return;

  const userPath = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const learningProfile = AutoLearningEngine.getInstance().getProfile();
  const elo = getTrainerEloFromLocal();
  const roadmapDoneIds = getRoadmapDoneIdsFromLocal();
  const categoryStats = getCategoryStatsFromLocal();

  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        displayName: clampString(user.displayName, 80, 'Jugador GTO'),
        ...(user.photoURL ? { photoURL: clampString(user.photoURL, 512) } : {}),
        elo,
        masteryScore: Math.max(0, Math.min(100, Math.round(learningProfile.masteryScore || 80))),
        totalDecisions: Math.max(0, Math.round(learningProfile.totalDecisions || 0)),
        totalMistakes: Math.max(0, Math.round(learningProfile.totalMistakes || 0)),
        roadmapDoneIds,
        categoryStats,
        createdAt: serverTimestamp(),
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
        updatedAt: serverTimestamp()
      });
    }
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
          heroCombo: clampString(m.heroCombo, 16, 'AsKd'),
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
  elo?: number;
  cloudSm2Count: number;
  cloudMistakeCount: number;
}> {
  if (!user.uid || !user.emailVerified) {
    return { cloudSm2Count: 0, cloudMistakeCount: 0 };
  }

  const userPath = `users/${user.uid}`;
  let elo: number | undefined;
  try {
    const profileSnap = await getDoc(doc(db, 'users', user.uid));
    if (profileSnap.exists()) {
      const data = profileSnap.data();
      if (typeof data.elo === 'number') {
        elo = data.elo;
      }
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

  return { elo, cloudSm2Count, cloudMistakeCount };
}

export async function runFullCloudSync(user: User): Promise<{
  sm2Synced: number;
  mistakesSynced: number;
}> {
  await syncUserProfileToCloud(user);
  const [sm2Synced, mistakesSynced] = await Promise.all([
    syncSM2ItemsToCloud(user),
    syncRecentMistakesToCloud(user)
  ]);
  return { sm2Synced, mistakesSynced };
}
