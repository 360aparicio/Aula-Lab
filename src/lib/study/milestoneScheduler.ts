/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Planificador de Hitos (Días 7 / 14 / 21 / 30), Generador de Plantillas HTML de Recordatorio,
 * Agregador de Métricas NPS/PMF y Exportador Anonimizado CSV/JSON.
 */

import type {
  DensityFeedbackOption,
  PmfAnswer,
  StudyEnrollmentDoc,
  StudyEventDoc,
  StudyFeedbackDoc,
  StudyLevel,
  StudyMilestone
} from './studyTypes.ts';
import { STUDY_LEVELS } from './studyTypes.ts';

export interface MilestoneScheduleEntry {
  milestone: StudyMilestone;
  dayNumber: number;
  label: string;
}

export const STUDY_MILESTONE_SCHEDULE: readonly MilestoneScheduleEntry[] = [
  { milestone: 'day7', dayNumber: 7, label: 'Semana 1 (Día 7)' },
  { milestone: 'day14', dayNumber: 14, label: 'Semana 2 (Día 14)' },
  { milestone: 'day21', dayNumber: 21, label: 'Semana 3 (Día 21)' },
  { milestone: 'day30', dayNumber: 30, label: 'Cierre de Estudio (Día 30)' }
] as const;

export function getStudyElapsedDays(enrolledAtMs: number, nowMs = Date.now()): number {
  if (!Number.isFinite(enrolledAtMs) || enrolledAtMs <= 0) return 0;
  return Math.max(0, Math.floor((nowMs - enrolledAtMs) / (24 * 60 * 60 * 1000)));
}

/**
 * Determina cuál encuesta periódica (7/14/21/30) está pendiente para el participante activo.
 */
export function getDueStudyMilestone(
  enrollment: Pick<StudyEnrollmentDoc, 'status' | 'enrolledAtMs' | 'completedSurveys'> | null,
  nowMs = Date.now()
): MilestoneScheduleEntry | null {
  if (!enrollment || enrollment.status !== 'active') return null;
  const elapsedDays = getStudyElapsedDays(enrollment.enrolledAtMs, nowMs);
  const completed = new Set(enrollment.completedSurveys || []);

  // Recorremos en orden inverso o secuencial: devolvemos el hito vencido más reciente sin responder
  let due: MilestoneScheduleEntry | null = null;
  for (const entry of STUDY_MILESTONE_SCHEDULE) {
    if (elapsedDays >= entry.dayNumber && !completed.has(entry.milestone)) {
      due = entry;
    }
  }
  return due;
}

export function escapeHtmlText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildMilestoneReminderEmailHtml(params: {
  displayName: string;
  level: StudyLevel;
  milestone: StudyMilestone;
  appUrl: string;
}): string {
  const safeName = escapeHtmlText(params.displayName.trim() || 'Jugador');
  const safeLevel = escapeHtmlText(params.level.toUpperCase());
  const schedule = STUDY_MILESTONE_SCHEDULE.find(m => m.milestone === params.milestone) ?? STUDY_MILESTONE_SCHEDULE[0];
  const safeUrl = /^https?:\/\//i.test(params.appUrl) ? escapeHtmlText(params.appUrl) : 'https://allinstudio.edu';

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Recordatorio ${escapeHtmlText(schedule.label)} · Allin School</title></head>
<body style="margin:0;padding:24px;background:#0a0a0a;color:#f5f5f5;font-family:Inter,Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#141414;border:1px solid #262626;border-radius:16px;padding:24px;">
    <p style="font-size:12px;color:#60a5fa;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px 0;">
      Estudio de Mercado 30 Días · Cohorte ${safeLevel}
    </p>
    <h1 style="font-size:20px;margin:0 0 12px 0;color:#ffffff;">
      Hola ${safeName}, llegaste a ${escapeHtmlText(schedule.label)}
    </h1>
    <p style="font-size:14px;line-height:1.6;color:#d4d4d4;margin:0 0 16px 0;">
      Tu opinión de 60 segundos nos ayuda a calibrar la claridad y densidad de Allin School para el perfil <strong>${safeLevel}</strong>.
    </p>
    <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;font-weight:700;border-radius:10px;font-size:14px;">
      Responder Encuesta (${escapeHtmlText(schedule.label)})
    </a>
    <p style="font-size:11px;color:#737373;margin:20px 0 0 0;line-height:1.5;">
      Software estrictamente educativo (No apuestas). Puedes revocar tu consentimiento y retirarte en cualquier momento desde la barra de Estudio en la plataforma.
    </p>
  </div>
</body>
</html>`;
}

export interface StudyLevelMetrics {
  level: StudyLevel;
  enrolledCount: number;
  waitlistedCount: number;
  withdrawnCount: number;
  retentionRatePct: number;
  feedbackCount: number;
  npsScore: number; // -100 a +100
  pmfVeryDisappointedPct: number;
  avgLevelSatisfaction: number;
  densityDistribution: Record<DensityFeedbackOption, number>;
  eventsCount: number;
}

export interface StudyAggregateReport {
  generatedAtMs: number;
  totalActive: number;
  totalWaitlisted: number;
  totalWithdrawn: number;
  overallNps: number;
  overallPmfPct: number;
  byLevel: Record<StudyLevel, StudyLevelMetrics>;
}

export function computeNps(scores: number[]): number {
  if (scores.length === 0) return 0;
  let promoters = 0;
  let detractors = 0;
  for (const s of scores) {
    if (s >= 9) promoters++;
    else if (s <= 6) detractors++;
  }
  return Math.round(((promoters - detractors) / scores.length) * 100);
}

export function computePmfVeryDisappointedPct(answers: PmfAnswer[]): number {
  if (answers.length === 0) return 0;
  const very = answers.filter(a => a === 'very_disappointed').length;
  return Math.round((very / answers.length) * 1000) / 10;
}

export function aggregateStudyMetrics(
  enrollments: StudyEnrollmentDoc[],
  feedbacks: StudyFeedbackDoc[],
  events: StudyEventDoc[]
): StudyAggregateReport {
  const byLevel = {} as Record<StudyLevel, StudyLevelMetrics>;

  for (const level of STUDY_LEVELS) {
    const levelEnrollments = enrollments.filter(e => e.cohortLevel === level);
    const active = levelEnrollments.filter(e => e.status === 'active' || e.status === 'completed').length;
    const waitlisted = levelEnrollments.filter(e => e.status === 'waitlisted').length;
    const withdrawn = levelEnrollments.filter(e => e.status === 'withdrawn').length;
    const totalAttempted = active + withdrawn;
    const retentionRatePct = totalAttempted > 0 ? Math.round((active / totalAttempted) * 1000) / 10 : 100;

    const levelFeedbacks = feedbacks.filter(f => f.cohortLevel === level);
    const npsScore = computeNps(levelFeedbacks.map(f => f.npsScore));
    const pmfVeryDisappointedPct = computePmfVeryDisappointedPct(levelFeedbacks.map(f => f.pmfAnswer));
    const avgLevelSatisfaction =
      levelFeedbacks.length > 0
        ? Math.round((levelFeedbacks.reduce((acc, f) => acc + f.levelSatisfaction, 0) / levelFeedbacks.length) * 100) / 100
        : 0;

    const densityDistribution: Record<DensityFeedbackOption, number> = {
      too_simple: 0,
      just_right: 0,
      too_complex: 0
    };
    for (const f of levelFeedbacks) {
      densityDistribution[f.densityFeedback] = (densityDistribution[f.densityFeedback] || 0) + 1;
    }

    const eventsCount = events.filter(ev => ev.cohortLevel === level).length;

    byLevel[level] = {
      level,
      enrolledCount: active,
      waitlistedCount: waitlisted,
      withdrawnCount: withdrawn,
      retentionRatePct,
      feedbackCount: levelFeedbacks.length,
      npsScore,
      pmfVeryDisappointedPct,
      avgLevelSatisfaction,
      densityDistribution,
      eventsCount
    };
  }

  return {
    generatedAtMs: Date.now(),
    totalActive: STUDY_LEVELS.reduce((sum, l) => sum + byLevel[l].enrolledCount, 0),
    totalWaitlisted: STUDY_LEVELS.reduce((sum, l) => sum + byLevel[l].waitlistedCount, 0),
    totalWithdrawn: STUDY_LEVELS.reduce((sum, l) => sum + byLevel[l].withdrawnCount, 0),
    overallNps: computeNps(feedbacks.map(f => f.npsScore)),
    overallPmfPct: computePmfVeryDisappointedPct(feedbacks.map(f => f.pmfAnswer)),
    byLevel
  };
}

/**
 * Seudonimización determinista sin exponer UID ni email en exportaciones analíticas.
 */
export function anonymizeParticipantId(uid: string): string {
  let h1 = 0x811c9dc5;
  for (let i = 0; i < uid.length; i++) {
    h1 ^= uid.charCodeAt(i);
    h1 = Math.imul(h1, 0x01000193);
  }
  const hex = (h1 >>> 0).toString(16).padStart(8, '0').toUpperCase();
  return `PART-${hex}`;
}

export function buildAnonymizedExportJson(
  enrollments: StudyEnrollmentDoc[],
  feedbacks: StudyFeedbackDoc[],
  events: StudyEventDoc[]
): string {
  const payload = {
    exportedAtIso: new Date().toISOString(),
    piiStripped: true,
    summary: aggregateStudyMetrics(enrollments, feedbacks, events),
    participants: enrollments.map(e => ({
      participantId: anonymizeParticipantId(e.uid),
      cohortLevel: e.cohortLevel,
      effectiveLevel: e.effectiveLevel,
      levelSource: e.levelSource,
      status: e.status,
      consentVersion: e.consentVersion,
      completedSurveys: e.completedSurveys,
      enrolledAtIso: new Date(e.enrolledAtMs).toISOString()
    })),
    feedbacks: feedbacks.map(f => ({
      participantId: anonymizeParticipantId(f.uid),
      cohortLevel: f.cohortLevel,
      effectiveLevel: f.effectiveLevel,
      milestone: f.milestone,
      npsScore: f.npsScore,
      pmfAnswer: f.pmfAnswer,
      levelSatisfaction: f.levelSatisfaction,
      densityFeedback: f.densityFeedback,
      openComment: f.openComment
    }))
  };
  return JSON.stringify(payload, null, 2);
}

function csvCell(val: unknown): string {
  const str = String(val ?? '').replace(/"/g, '""');
  // Prevent CSV formula injection
  const safe = /^[=+\-@]/.test(str) ? `'${str}` : str;
  return `"${safe}"`;
}

export function buildAnonymizedFeedbackCsv(feedbacks: StudyFeedbackDoc[]): string {
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

  const rows = feedbacks.map(f =>
    [
      csvCell(anonymizeParticipantId(f.uid)),
      csvCell(f.cohortLevel),
      csvCell(f.effectiveLevel),
      csvCell(f.milestone),
      csvCell(f.npsScore),
      csvCell(f.pmfAnswer),
      csvCell(f.levelSatisfaction),
      csvCell(f.densityFeedback),
      csvCell(f.openComment)
    ].join(',')
  );

  return [header, ...rows].join('\n');
}
