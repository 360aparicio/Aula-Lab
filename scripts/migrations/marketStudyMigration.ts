/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Migración Reversible UP / DOWN para market_study_v1 (Regla R3).
 * Diseñada sobre abstracción MigrationStore para ejecutarse en staging/Firestore
 * o validarse en tests automatizados con rollback garantizado (< 5 min).
 */

import { DEFAULT_MARKET_STUDY_FLAG, MARKET_STUDY_FLAG_ID } from '../../src/lib/study/featureFlags';
import { DEFAULT_COHORT_QUOTA_PER_LEVEL, STUDY_LEVELS } from '../../src/lib/study/studyTypes';

export interface MigrationStore {
  getDoc(collection: string, id: string): Promise<Record<string, unknown> | null>;
  setDoc(collection: string, id: string, data: Record<string, unknown>): Promise<void>;
  deleteDoc(collection: string, id: string): Promise<void>;
}

export interface MigrationResult {
  direction: 'up' | 'down';
  version: string;
  appliedDocs: string[];
  timestampIso: string;
}

export const MARKET_STUDY_MIGRATION_VERSION = '20261120_01_market_study_v1';

/**
 * Migración UP: crea el feature flag (default OFF) y las 3 cohortes vacías (100/100/100).
 * Idempotente: no sobrescribe contadores si una cohorte ya existe.
 */
export async function migrateMarketStudyUp(
  store: MigrationStore,
  maxQuotaPerLevel = DEFAULT_COHORT_QUOTA_PER_LEVEL
): Promise<MigrationResult> {
  const appliedDocs: string[] = [];
  const nowIso = new Date().toISOString();

  const existingFlag = await store.getDoc('featureFlags', MARKET_STUDY_FLAG_ID);
  if (!existingFlag) {
    await store.setDoc('featureFlags', MARKET_STUDY_FLAG_ID, {
      ...DEFAULT_MARKET_STUDY_FLAG,
      enabled: false,
      cohortMaxPerLevel: maxQuotaPerLevel,
      migrationVersion: MARKET_STUDY_MIGRATION_VERSION,
      createdAtIso: nowIso
    });
    appliedDocs.push(`featureFlags/${MARKET_STUDY_FLAG_ID}`);
  }

  for (const level of STUDY_LEVELS) {
    const existingCohort = await store.getDoc('studyCohorts', level);
    if (!existingCohort) {
      await store.setDoc('studyCohorts', level, {
        level,
        maxQuota: maxQuotaPerLevel,
        currentCount: 0,
        waitlistCount: 0,
        active: true,
        migrationVersion: MARKET_STUDY_MIGRATION_VERSION,
        createdAtIso: nowIso
      });
      appliedDocs.push(`studyCohorts/${level}`);
    }
  }

  return {
    direction: 'up',
    version: MARKET_STUDY_MIGRATION_VERSION,
    appliedDocs,
    timestampIso: nowIso
  };
}

/**
 * Migración DOWN: desactiva el feature flag inmediatamente y revierte los documentos de esquema
 * inicializados por UP sin afectar perfiles existentes ni datos de Demo Final.
 */
export async function migrateMarketStudyDown(store: MigrationStore): Promise<MigrationResult> {
  const appliedDocs: string[] = [];
  const nowIso = new Date().toISOString();

  const existingFlag = await store.getDoc('featureFlags', MARKET_STUDY_FLAG_ID);
  if (existingFlag) {
    await store.deleteDoc('featureFlags', MARKET_STUDY_FLAG_ID);
    appliedDocs.push(`featureFlags/${MARKET_STUDY_FLAG_ID}`);
  }

  for (const level of STUDY_LEVELS) {
    const existingCohort = await store.getDoc('studyCohorts', level);
    if (existingCohort) {
      await store.deleteDoc('studyCohorts', level);
      appliedDocs.push(`studyCohorts/${level}`);
    }
  }

  return {
    direction: 'down',
    version: MARKET_STUDY_MIGRATION_VERSION,
    appliedDocs,
    timestampIso: nowIso
  };
}

/**
 * In-memory staging adapter para pruebas deterministas UP -> Verify -> DOWN -> Verify.
 */
export class InMemoryMigrationStore implements MigrationStore {
  private readonly store = new Map<string, Record<string, unknown>>();

  async getDoc(collection: string, id: string): Promise<Record<string, unknown> | null> {
    return this.store.get(`${collection}/${id}`) ?? null;
  }

  async setDoc(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
    this.store.set(`${collection}/${id}`, { ...data });
  }

  async deleteDoc(collection: string, id: string): Promise<void> {
    this.store.delete(`${collection}/${id}`);
  }

  snapshotKeys(): string[] {
    return Array.from(this.store.keys()).sort();
  }
}
