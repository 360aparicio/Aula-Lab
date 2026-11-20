/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FeatureFlagService para market_study_v1.
 * Regla R1: default estrictamente OFF (false).
 * Regla R2: Flag OFF = comportamiento exacto de Demo Final (v5.0.0).
 * Regla R8: Reversión instantánea (< 5 min) vía Firestore /featureFlags/market_study_v1 o env.
 */

import type { FeatureFlagDoc } from './studyTypes';

export const MARKET_STUDY_FLAG_ID = 'market_study_v1' as const;

export const DEFAULT_MARKET_STUDY_FLAG: FeatureFlagDoc = {
  flagId: MARKET_STUDY_FLAG_ID,
  enabled: false,
  cohortMaxPerLevel: 100,
  rolloutNotes: 'Default OFF (Regla R1). Activar únicamente tras verificación FASE 5.',
  updatedByUid: 'system'
};

export interface FlagEvaluationInputs {
  envFlagValue?: string | boolean | null;
  remoteFlagDoc?: Partial<FeatureFlagDoc> | null;
}

/**
 * Evalúa el estado efectivo del feature flag `market_study_v1`.
 * Precedencia determinista:
 * 1) Override explícito de entorno (`false` fuerza apagado de emergencia en < 1 min).
 * 2) Documento remoto `/featureFlags/market_study_v1` en Firestore.
 * 3) Default seguro: `false` (OFF).
 */
export function evaluateMarketStudyFlag(inputs: FlagEvaluationInputs): FeatureFlagDoc {
  const { envFlagValue, remoteFlagDoc } = inputs;

  // Hard emergency kill-switch via env ("false" or "0" always disables immediately)
  if (envFlagValue === false || envFlagValue === 'false' || envFlagValue === '0') {
    return {
      ...DEFAULT_MARKET_STUDY_FLAG,
      enabled: false,
      cohortMaxPerLevel: normalizeQuota(remoteFlagDoc?.cohortMaxPerLevel),
      rolloutNotes: 'Desactivado por variable de entorno (Kill-Switch R8).'
    };
  }

  if (remoteFlagDoc && typeof remoteFlagDoc.enabled === 'boolean') {
    return {
      flagId: MARKET_STUDY_FLAG_ID,
      enabled: remoteFlagDoc.enabled,
      cohortMaxPerLevel: normalizeQuota(remoteFlagDoc.cohortMaxPerLevel),
      rolloutNotes:
        typeof remoteFlagDoc.rolloutNotes === 'string' && remoteFlagDoc.rolloutNotes.trim()
          ? remoteFlagDoc.rolloutNotes.trim().slice(0, 240)
          : DEFAULT_MARKET_STUDY_FLAG.rolloutNotes,
      updatedByUid:
        typeof remoteFlagDoc.updatedByUid === 'string' && remoteFlagDoc.updatedByUid.trim()
          ? remoteFlagDoc.updatedByUid
          : 'admin',
      updatedAt: remoteFlagDoc.updatedAt
    };
  }

  if (envFlagValue === true || envFlagValue === 'true' || envFlagValue === '1') {
    return {
      ...DEFAULT_MARKET_STUDY_FLAG,
      enabled: true,
      rolloutNotes: 'Habilitado por variable de entorno.'
    };
  }

  return { ...DEFAULT_MARKET_STUDY_FLAG };
}

function normalizeQuota(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(1, Math.min(1000, Math.round(raw)));
  }
  return 100;
}

export function readClientEnvMarketStudyFlag(): string | undefined {
  try {
    const meta = import.meta as { env?: Record<string, string | undefined> };
    return meta?.env?.VITE_FEATURE_MARKET_STUDY_V1;
  } catch {
    return undefined;
  }
}
