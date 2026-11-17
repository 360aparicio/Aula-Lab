/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * PlanCatalog (Admin Repo Copy): Contrato compartido con el Repositorio Educativo (Aula/Lab).
 */

export type PlanTier = 'free' | 'pro' | 'elite';

export type LabSectionId =
  | 'wizard'
  | 'solver'
  | 'trainer'
  | 'cheatsheet'
  | 'academy'
  | 'solver_meta'
  | 'ranges'
  | 'scenarios'
  | 'benchmarks';

export interface PlanPermissions {
  labPro: boolean;
  webBrain: boolean;
  unlimitedEval: boolean;
  pdfExport: boolean;
  planAdmin: boolean;
}

export type VisibleSectionsMap = Record<LabSectionId, boolean>;

export interface PlanConfigDoc {
  planTier: PlanTier;
  displayName: string;
  tagline: string;
  priceLabel: string;
  maxDailyEvaluations: number;
  hideLockedSections: boolean;
  visibleSections: VisibleSectionsMap;
  defaultPermissions: PlanPermissions;
  benefits: string[];
  updatedByUid?: string;
  updatedAt?: unknown;
}

export const LAB_SECTION_META: Array<{
  id: LabSectionId;
  label: string;
  shortDesc: string;
}> = [
  { id: 'wizard', label: 'Paso a Paso', shortDesc: 'Asistente guiado Preflop ➔ River con guardados en 1 clic' },
  { id: 'solver', label: 'Lab Studio', shortDesc: 'Árbol DCFR de equilibrio Nash, distribución EV y Matriz 13×13' },
  { id: 'trainer', label: 'Mesa 6-Max', shortDesc: 'Simulador multi-calle en vivo (Flop ➔ Turn ➔ River ➔ Showdown)' },
  { id: 'cheatsheet', label: 'Manual 6-Max', shortDesc: 'Guía posicional completa de 6 posiciones Equilibrio & Explotativo' },
  { id: 'academy', label: 'Academia D3', shortDesc: 'Evaluación por Niveles (720+ preguntas), SM-2 y Progreso D3.js' },
  { id: 'solver_meta', label: 'Radar Web', shortDesc: 'Tendencias actuales de internet y aprendizaje colectivo' },
  { id: 'ranges', label: 'Rangos', shortDesc: 'Inspector y matriz 13×13 OOP / IP con bloqueadores activos' },
  { id: 'scenarios', label: 'Spots', shortDesc: 'Biblioteca de escenarios preconstruidos e importación JSON' },
  { id: 'benchmarks', label: 'Mates', shortDesc: 'Benchmarks Nash Kuhn Poker, motor Lab Studio y auditoría técnica' }
];

export function getDefaultPlanPermissions(tier: PlanTier, isRoleAdmin = false): PlanPermissions {
  if (tier === 'elite') {
    return { labPro: true, webBrain: true, unlimitedEval: true, pdfExport: true, planAdmin: isRoleAdmin };
  }
  if (tier === 'pro') {
    return { labPro: true, webBrain: true, unlimitedEval: true, pdfExport: false, planAdmin: isRoleAdmin };
  }
  return { labPro: true, webBrain: false, unlimitedEval: false, pdfExport: false, planAdmin: isRoleAdmin };
}

export const DEFAULT_PLAN_CONFIGS: Record<PlanTier, PlanConfigDoc> = {
  free: {
    planTier: 'free',
    displayName: 'Plan Free · Inicio',
    tagline: 'Bases esenciales 6-Max, asistente guiado y aprendizaje cognitivo SM-2.',
    priceLabel: '$0 / mes',
    maxDailyEvaluations: 15,
    hideLockedSections: false,
    visibleSections: {
      wizard: true,
      solver: false,
      trainer: true,
      cheatsheet: true,
      academy: true,
      solver_meta: false,
      ranges: true,
      scenarios: false,
      benchmarks: false
    },
    defaultPermissions: getDefaultPlanPermissions('free', false),
    benefits: [
      'Asistente Paso a Paso Preflop ➔ River',
      'Práctica interactiva Multi-Calle básica y captura >5% EV',
      'Manual Posicional 6-Max e Inspector de Rangos 13×13',
      'Academia D3 + Mazo SuperMemo SM-2 y hasta 15 evaluaciones/día'
    ]
  },
  pro: {
    planTier: 'pro',
    displayName: 'Plan Pro · Jugador Regular',
    tagline: 'Acceso total a Lab Studio, TheTracker2 Pro y Radar Web en vivo.',
    priceLabel: '$29 / mes',
    maxDailyEvaluations: 0,
    hideLockedSections: false,
    visibleSections: {
      wizard: true,
      solver: true,
      trainer: true,
      cheatsheet: true,
      academy: true,
      solver_meta: true,
      ranges: true,
      scenarios: true,
      benchmarks: false
    },
    defaultPermissions: getDefaultPlanPermissions('pro', false),
    benefits: [
      'Todas las ventajas de Free + Motor Lab Studio completo',
      'Evaluaciones Ilimitadas en los 4 Niveles (720+ preguntas sin repetir)',
      'Acceso en vivo a Radar Web + Biblioteca completa de Spots',
      'Sincronización en tiempo real de ELO, XP y fugas en la nube'
    ]
  },
  elite: {
    planTier: 'elite',
    displayName: 'Plan Elite · High Stakes & Coaching',
    tagline: 'Plataforma sin restricciones, Exportación PDF Pro y Auditoría Matemática.',
    priceLabel: '$79 / mes',
    maxDailyEvaluations: 0,
    hideLockedSections: false,
    visibleSections: {
      wizard: true,
      solver: true,
      trainer: true,
      cheatsheet: true,
      academy: true,
      solver_meta: true,
      ranges: true,
      scenarios: true,
      benchmarks: true
    },
    defaultPermissions: getDefaultPlanPermissions('elite', false),
    benefits: [
      'Acceso 100% ilimitado a las 9 secciones del Aula y Laboratorio',
      'Exportación PDF oficial de Progreso D3.js y Manual 6-Max',
      'Benchmarks matemáticos Kuhn Nash & Auditoría DCFR completa',
      'Prioridad en métricas adaptativas Web & soporte multi-nivel NL100+'
    ]
  }
};

export function mergePlanConfig(tier: PlanTier, raw?: Record<string, unknown> | null): PlanConfigDoc {
  const base = DEFAULT_PLAN_CONFIGS[tier];
  if (!raw || typeof raw !== 'object') return base;

  const rawVis = (raw.visibleSections && typeof raw.visibleSections === 'object'
    ? raw.visibleSections
    : {}) as Record<string, unknown>;

  const visibleSections: VisibleSectionsMap = {
    wizard: typeof rawVis.wizard === 'boolean' ? rawVis.wizard : base.visibleSections.wizard,
    solver: typeof rawVis.solver === 'boolean' ? rawVis.solver : base.visibleSections.solver,
    trainer: typeof rawVis.trainer === 'boolean' ? rawVis.trainer : base.visibleSections.trainer,
    cheatsheet: typeof rawVis.cheatsheet === 'boolean' ? rawVis.cheatsheet : base.visibleSections.cheatsheet,
    academy: typeof rawVis.academy === 'boolean' ? rawVis.academy : base.visibleSections.academy,
    solver_meta: typeof rawVis.solver_meta === 'boolean' ? rawVis.solver_meta : base.visibleSections.solver_meta,
    ranges: typeof rawVis.ranges === 'boolean' ? rawVis.ranges : base.visibleSections.ranges,
    scenarios: typeof rawVis.scenarios === 'boolean' ? rawVis.scenarios : base.visibleSections.scenarios,
    benchmarks: typeof rawVis.benchmarks === 'boolean' ? rawVis.benchmarks : base.visibleSections.benchmarks
  };

  const rawPerms = (raw.defaultPermissions && typeof raw.defaultPermissions === 'object'
    ? raw.defaultPermissions
    : {}) as Record<string, unknown>;

  const defaultPermissions: PlanPermissions = {
    labPro: typeof rawPerms.labPro === 'boolean' ? rawPerms.labPro : base.defaultPermissions.labPro,
    webBrain: typeof rawPerms.webBrain === 'boolean' ? rawPerms.webBrain : base.defaultPermissions.webBrain,
    unlimitedEval: typeof rawPerms.unlimitedEval === 'boolean' ? rawPerms.unlimitedEval : base.defaultPermissions.unlimitedEval,
    pdfExport: typeof rawPerms.pdfExport === 'boolean' ? rawPerms.pdfExport : base.defaultPermissions.pdfExport,
    planAdmin: typeof rawPerms.planAdmin === 'boolean' ? rawPerms.planAdmin : base.defaultPermissions.planAdmin
  };

  const benefits = Array.isArray(raw.benefits)
    ? raw.benefits.filter((b): b is string => typeof b === 'string' && b.trim().length > 0).slice(0, 15)
    : base.benefits;

  return {
    planTier: tier,
    displayName: typeof raw.displayName === 'string' && raw.displayName.trim() ? raw.displayName.trim().slice(0, 48) : base.displayName,
    tagline: typeof raw.tagline === 'string' ? raw.tagline.trim().slice(0, 160) : base.tagline,
    priceLabel: typeof raw.priceLabel === 'string' && raw.priceLabel.trim() ? raw.priceLabel.trim().slice(0, 32) : base.priceLabel,
    maxDailyEvaluations:
      typeof raw.maxDailyEvaluations === 'number' && Number.isFinite(raw.maxDailyEvaluations)
        ? Math.max(0, Math.min(1000, Math.round(raw.maxDailyEvaluations)))
        : base.maxDailyEvaluations,
    hideLockedSections: typeof raw.hideLockedSections === 'boolean' ? raw.hideLockedSections : base.hideLockedSections,
    visibleSections,
    defaultPermissions,
    benefits: benefits.length > 0 ? benefits : base.benefits,
    updatedByUid: typeof raw.updatedByUid === 'string' ? raw.updatedByUid : undefined,
    updatedAt: raw.updatedAt
  };
}

/**
 * URL del Repositorio Educativo (Aula/Lab) enlazado.
 */
export function getLabAppUrl(): string {
  const envObj = (import.meta as { env?: Record<string, string | undefined> }).env;
  const configured = envObj?.VITE_LAB_APP_URL;
  const raw = typeof configured === 'string' && configured.trim().length > 0 ? configured.trim() : '/';
  if (typeof window !== 'undefined' && !/^https?:\/\//i.test(raw)) {
    try {
      return new URL(raw, window.location.origin).toString();
    } catch {
      return raw;
    }
  }
  return raw;
}
