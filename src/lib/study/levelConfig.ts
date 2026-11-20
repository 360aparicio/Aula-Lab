/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Arquitectura Central de Densidad Cognitiva por Nivel (FISH / REG / NIT).
 * Principio clave: El nivel determina DENSIDAD DE INFORMACIÓN, NUNCA permisos de suscripción.
 * Prioridad obligatoria: admin_override > cohort_assignment > self_selected.
 */

import type {
  LegacyExperienceLevel,
  LevelSource,
  StudyLevel
} from './studyTypes';

export type UiDensityMode = 'simple' | 'balanced' | 'analytical';

export interface LevelDensityConfig {
  level: StudyLevel;
  shortCode: 'FISH' | 'REG' | 'NIT';
  label: string;
  audienceTitle: string;
  description: string;
  densitySummary: string;
  densityMode: UiDensityMode;
  showPlainLanguageHints: boolean;
  showGlossaryTooltips: boolean;
  showAdvancedMath: boolean;
  showSecondaryMetrics: boolean;
  prioritizeFundamentals: boolean;
  simplifyHeader: boolean;
  defaultTab: 'fundamentals' | 'wizard' | 'solver';
  maxHintsVisible: number;
  accentClass: string;
}

export const STUDY_LEVEL_CONFIGS: Record<StudyLevel, LevelDensityConfig> = {
  fish: {
    level: 'fish',
    shortCode: 'FISH',
    label: 'FISH · Novato',
    audienceTitle: 'Estoy empezando o juego recreativo',
    description: 'Lenguaje claro, glosario integrado, Fundamentos Módulo 0 y guías paso a paso sin sobrecarga numérica.',
    densitySummary: 'Baja densidad visual · Máxima claridad didáctica',
    densityMode: 'simple',
    showPlainLanguageHints: true,
    showGlossaryTooltips: true,
    showAdvancedMath: false,
    showSecondaryMetrics: false,
    prioritizeFundamentals: true,
    simplifyHeader: true,
    defaultTab: 'fundamentals',
    maxHintsVisible: 3,
    accentClass: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
  },
  reg: {
    level: 'reg',
    shortCode: 'REG',
    label: 'REG · Intermedio',
    audienceTitle: 'Jugador Regular (NL10–NL50)',
    description: 'Balance entre asistente guiado, Mesa 6-Max en vivo, TheTracker2 y métricas clave de EV y posición.',
    densitySummary: 'Densidad equilibrada · Enfoque en ejecución y fugas',
    densityMode: 'balanced',
    showPlainLanguageHints: false,
    showGlossaryTooltips: true,
    showAdvancedMath: true,
    showSecondaryMetrics: true,
    prioritizeFundamentals: false,
    simplifyHeader: false,
    defaultTab: 'wizard',
    maxHintsVisible: 2,
    accentClass: 'text-blue-400 border-blue-500/40 bg-blue-500/10'
  },
  nit: {
    level: 'nit',
    shortCode: 'NIT',
    label: 'NIT · Avanzado',
    audienceTitle: 'Analítico / Estudioso de Rangos y Equilibrio',
    description: 'Máxima densidad técnica desde el primer segundo: árbol DCFR, EV%, SPR, matriz 13×13 y nodos completos.',
    densitySummary: 'Alta densidad analítica · Sin relleno introductorio',
    densityMode: 'analytical',
    showPlainLanguageHints: false,
    showGlossaryTooltips: false,
    showAdvancedMath: true,
    showSecondaryMetrics: true,
    prioritizeFundamentals: false,
    simplifyHeader: false,
    defaultTab: 'solver',
    maxHintsVisible: 0,
    accentClass: 'text-amber-400 border-amber-500/40 bg-amber-500/10'
  }
};

export interface LevelResolutionInput {
  adminOverrideLevel?: StudyLevel | 'none' | null;
  cohortLevel?: StudyLevel | null;
  selfSelectedLevel?: StudyLevel | null;
}

export interface ResolvedStudyLevel {
  effectiveLevel: StudyLevel;
  source: LevelSource;
  config: LevelDensityConfig;
}

/**
 * Resuelve el nivel efectivo respetando estrictamente la prioridad:
 * admin_override > cohort_assignment > self_selected
 */
export function resolveEffectiveStudyLevel(input: LevelResolutionInput): ResolvedStudyLevel {
  if (isValidStudyLevel(input.adminOverrideLevel)) {
    return {
      effectiveLevel: input.adminOverrideLevel,
      source: 'admin_override',
      config: STUDY_LEVEL_CONFIGS[input.adminOverrideLevel]
    };
  }
  if (isValidStudyLevel(input.cohortLevel)) {
    return {
      effectiveLevel: input.cohortLevel,
      source: 'cohort_assignment',
      config: STUDY_LEVEL_CONFIGS[input.cohortLevel]
    };
  }
  if (isValidStudyLevel(input.selfSelectedLevel)) {
    return {
      effectiveLevel: input.selfSelectedLevel,
      source: 'self_selected',
      config: STUDY_LEVEL_CONFIGS[input.selfSelectedLevel]
    };
  }
  return {
    effectiveLevel: 'reg',
    source: 'self_selected',
    config: STUDY_LEVEL_CONFIGS.reg
  };
}

export function isValidStudyLevel(val: unknown): val is StudyLevel {
  return val === 'fish' || val === 'reg' || val === 'nit';
}

export function mapLegacyExperienceToStudyLevel(legacy: LegacyExperienceLevel): StudyLevel {
  if (legacy === 'beginner' || legacy === 'recreational') return 'fish';
  if (legacy === 'pro') return 'nit';
  return 'reg';
}

export function mapStudyLevelToLegacyExperience(study: StudyLevel): LegacyExperienceLevel {
  if (study === 'fish') return 'beginner';
  if (study === 'nit') return 'pro';
  return 'regular';
}
