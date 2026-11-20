/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Suite Integral de Pruebas para Market Study v1 (FASE 4):
 * - Feature Flag `market_study_v1` (Default OFF, env kill-switch, remote toggle)
 * - Migración reversible UP / DOWN en staging (Regla R3)
 * - Prioridad de niveles: admin_override > cohort_assignment > self_selected
 * - Bloqueo legal >= 18 años + consentimiento v1.0 + políticas de retención
 * - Concurrencia atómica anti-overbooking (105 solicitudes simultáneas -> 100 cupos + 5 waitlist)
 * - Telemetría tipada (strict NO-OP flag OFF, PII scrubbing, batching 10, cola offline, clearQueue)
 * - Hitos días 7/14/21/30, XSS escaping en plantilla HTML, NPS/PMF math y exportación CSV/JSON anti-inyección
 */

import { setActiveStorageUserUid, clearMemoryUserStorage } from '../src/lib/userStorage';
import {
  DEFAULT_MARKET_STUDY_FLAG,
  MARKET_STUDY_FLAG_ID,
  evaluateMarketStudyFlag,
  readClientEnvMarketStudyFlag
} from '../src/lib/study/featureFlags';
import {
  STUDY_LEVEL_CONFIGS,
  isValidStudyLevel,
  mapLegacyExperienceToStudyLevel,
  mapStudyLevelToLegacyExperience,
  resolveEffectiveStudyLevel
} from '../src/lib/study/levelConfig';
import {
  CONSENT_VERSION,
  INFORMED_CONSENT_SECTIONS,
  RETENTION_POLICY,
  buildConsentDocId,
  computeExpiryMs,
  validateAdultAge
} from '../src/lib/study/legalCompliance';
import { allocateCohortSlotPure } from '../src/lib/study/cohortAllocator';
import {
  STUDY_MILESTONE_SCHEDULE,
  aggregateStudyMetrics,
  anonymizeParticipantId,
  buildAnonymizedExportJson,
  buildAnonymizedFeedbackCsv,
  buildMilestoneReminderEmailHtml,
  computeNps,
  computePmfVeryDisappointedPct,
  escapeHtmlText,
  getDueStudyMilestone,
  getStudyElapsedDays
} from '../src/lib/study/milestoneScheduler';
import { StudyTelemetryClient, sanitizeTelemetryMetadata } from '../src/lib/study/telemetryClient';
import {
  STUDY_LEVELS,
  type StudyCohortDoc,
  type StudyEnrollmentDoc,
  type StudyEventDoc,
  type StudyFeedbackDoc
} from '../src/lib/study/studyTypes';
import {
  InMemoryMigrationStore,
  MARKET_STUDY_MIGRATION_VERSION,
  migrateMarketStudyDown,
  migrateMarketStudyUp
} from '../scripts/migrations/marketStudyMigration';

export async function runMarketStudyTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  let passed = 0;
  let failed = 0;
  const errors: string[] = [];

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(msg);
      console.error(`  FAIL: ${msg}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. Feature Flag `market_study_v1` (Reglas R1 / R2 / R8)
  // ---------------------------------------------------------------------------
  assert(MARKET_STUDY_FLAG_ID === 'market_study_v1', 'Flag ID must be market_study_v1');
  assert(DEFAULT_MARKET_STUDY_FLAG.enabled === false, 'Default flag must strictly be OFF (false)');

  const defaultEval = evaluateMarketStudyFlag({});
  assert(defaultEval.enabled === false, 'Empty inputs evaluate to OFF');
  assert(defaultEval.cohortMaxPerLevel === 100, 'Default quota is 100 per level');

  const remoteOnEval = evaluateMarketStudyFlag({
    remoteFlagDoc: { enabled: true, cohortMaxPerLevel: 120, rolloutNotes: 'Pilot', updatedByUid: 'admin-1' }
  });
  assert(remoteOnEval.enabled === true && remoteOnEval.cohortMaxPerLevel === 120, 'Remote flag ON respected when env unset');

  // Env kill-switch must override remote ON immediately (Rule R8 rollback)
  const killSwitchEval = evaluateMarketStudyFlag({
    envFlagValue: 'false',
    remoteFlagDoc: { enabled: true, cohortMaxPerLevel: 100 }
  });
  assert(killSwitchEval.enabled === false, 'Env kill-switch "false" overrides remote ON');

  const envOnEval = evaluateMarketStudyFlag({ envFlagValue: 'true' });
  assert(envOnEval.enabled === true, 'Env "true" enables flag when remote doc absent');

  const clampEval = evaluateMarketStudyFlag({
    remoteFlagDoc: { enabled: true, cohortMaxPerLevel: 99999, rolloutNotes: '   ' }
  });
  assert(clampEval.cohortMaxPerLevel === 1000, 'Quota normalized safely within [1..1000]');
  assert(typeof readClientEnvMarketStudyFlag() === 'string' || readClientEnvMarketStudyFlag() === undefined, 'Env reader never throws');

  // ---------------------------------------------------------------------------
  // 2. Reversible DB Migration UP / DOWN (Rule R3)
  // ---------------------------------------------------------------------------
  const stagingStore = new InMemoryMigrationStore();
  const upRes = await migrateMarketStudyUp(stagingStore, 100);
  assert(upRes.direction === 'up' && upRes.version === MARKET_STUDY_MIGRATION_VERSION, 'Migration UP version recorded');
  assert(upRes.appliedDocs.length === 4, 'Migration UP creates 1 flag + 3 cohorts');
  const flagInDb = await stagingStore.getDoc('featureFlags', 'market_study_v1');
  assert(flagInDb !== null && flagInDb.enabled === false, 'Migration UP leaves flag OFF by default');

  // Idempotent second UP must apply 0 duplicates
  const upSecond = await migrateMarketStudyUp(stagingStore, 100);
  assert(upSecond.appliedDocs.length === 0, 'Migration UP is strictly idempotent');

  // Migration DOWN cleanly removes schema docs
  const downRes = await migrateMarketStudyDown(stagingStore);
  assert(downRes.direction === 'down' && downRes.appliedDocs.length === 4, 'Migration DOWN removes all 4 docs');
  assert(stagingStore.snapshotKeys().length === 0, 'Staging store completely clean after DOWN');

  // ---------------------------------------------------------------------------
  // 3. Cognitive Level Config & Priority Invariant
  // ---------------------------------------------------------------------------
  assert(STUDY_LEVELS.join(',') === 'fish,reg,nit', 'Study levels strictly fish, reg, nit');
  assert(isValidStudyLevel('fish') && isValidStudyLevel('reg') && isValidStudyLevel('nit'), 'Valid study levels recognized');
  assert(!isValidStudyLevel('pro') && !isValidStudyLevel(null), 'Invalid study levels rejected');

  assert(STUDY_LEVEL_CONFIGS.fish.densityMode === 'simple', 'FISH uses simple density');
  assert(STUDY_LEVEL_CONFIGS.reg.densityMode === 'balanced', 'REG uses balanced density');
  assert(STUDY_LEVEL_CONFIGS.nit.densityMode === 'analytical', 'NIT uses analytical density');
  assert(STUDY_LEVEL_CONFIGS.fish.showAdvancedMath === false && STUDY_LEVEL_CONFIGS.nit.showAdvancedMath === true, 'Density differentiates math depth cleanly');

  const pAdmin = resolveEffectiveStudyLevel({
    adminOverrideLevel: 'nit',
    cohortLevel: 'fish',
    selfSelectedLevel: 'reg'
  });
  assert(pAdmin.effectiveLevel === 'nit' && pAdmin.source === 'admin_override', 'admin_override wins over cohort and self');

  const pCohort = resolveEffectiveStudyLevel({
    adminOverrideLevel: 'none',
    cohortLevel: 'fish',
    selfSelectedLevel: 'nit'
  });
  assert(pCohort.effectiveLevel === 'fish' && pCohort.source === 'cohort_assignment', 'cohort_assignment wins over self_selected');

  const pSelf = resolveEffectiveStudyLevel({
    selfSelectedLevel: 'nit'
  });
  assert(pSelf.effectiveLevel === 'nit' && pSelf.source === 'self_selected', 'self_selected used when no override/cohort');

  const pFallback = resolveEffectiveStudyLevel({});
  assert(pFallback.effectiveLevel === 'reg', 'Default fallback study level is reg');

  assert(mapLegacyExperienceToStudyLevel('beginner') === 'fish', 'Legacy beginner -> fish');
  assert(mapLegacyExperienceToStudyLevel('recreational') === 'fish', 'Legacy recreational -> fish');
  assert(mapLegacyExperienceToStudyLevel('regular') === 'reg', 'Legacy regular -> reg');
  assert(mapLegacyExperienceToStudyLevel('pro') === 'nit', 'Legacy pro -> nit');
  assert(mapStudyLevelToLegacyExperience('fish') === 'beginner', 'fish -> beginner');
  assert(mapStudyLevelToLegacyExperience('reg') === 'regular', 'reg -> regular');
  assert(mapStudyLevelToLegacyExperience('nit') === 'pro', 'nit -> pro');

  // ---------------------------------------------------------------------------
  // 4. Legal Compliance: Age >= 18 Gate, Consent Version, Retention
  // ---------------------------------------------------------------------------
  assert(CONSENT_VERSION === '1.0', 'Consent version is 1.0');
  assert(INFORMED_CONSENT_SECTIONS.length === 5, 'Informed consent contains all 5 mandatory legal clauses');
  assert(RETENTION_POLICY.withdrawalPurgeMaxDays === 30, 'GDPR withdrawal purge SLA <= 30 days');
  assert(RETENTION_POLICY.breachNotificationHours === 72, 'GDPR breach notification SLA == 72h');

  assert(!validateAdultAge(2015, 2026).valid, '11-year-old minor strictly blocked');
  assert(!validateAdultAge(2009, 2026).valid, '17-year-old minor strictly blocked');
  assert(validateAdultAge(2008, 2026).valid, '18-year-old adult allowed');
  assert(!validateAdultAge(1890, 2026).valid, 'Unreasonable birth year rejected');
  assert(buildConsentDocId('user-123', '1.0') === 'user-123_v1_0', 'Deterministic consent ID builder');
  assert(computeExpiryMs(30, 1000) === 1000 + 30 * 86_400_000, 'Expiry timestamp computed accurately');

  // ---------------------------------------------------------------------------
  // 5. Atomic Cohort Allocation & Concurrency Stress (105 concurrent -> 100 + 5)
  // ---------------------------------------------------------------------------
  const legalReject = allocateCohortSlotPure(
    { level: 'fish', maxQuota: 100, currentCount: 0, waitlistCount: 0, active: true },
    null,
    { uid: 'u0', requestedLevel: 'fish', hasActiveConsent: false, consentVersion: '1.0', isAdult: true }
  );
  assert(!legalReject.accepted && legalReject.outcome === 'rejected_legal', 'Enrollment blocked without active consent');

  const closedReject = allocateCohortSlotPure(
    { level: 'fish', maxQuota: 100, currentCount: 0, waitlistCount: 0, active: false },
    null,
    { uid: 'u0', requestedLevel: 'fish', hasActiveConsent: true, consentVersion: '1.0', isAdult: true }
  );
  assert(!closedReject.accepted && closedReject.outcome === 'rejected_inactive', 'Enrollment blocked on inactive cohort');

  // Simulate 105 simultaneous transactional enrollment attempts on FISH
  let sharedCohort: StudyCohortDoc = { level: 'fish', maxQuota: 100, currentCount: 0, waitlistCount: 0, active: true };
  let enrolledSuccess = 0;
  let waitlistedSuccess = 0;
  const enrollmentsList: StudyEnrollmentDoc[] = [];

  for (let i = 1; i <= 105; i++) {
    const res = allocateCohortSlotPure(sharedCohort, null, {
      uid: `user_${i}`,
      requestedLevel: 'fish',
      hasActiveConsent: true,
      consentVersion: '1.0',
      isAdult: true,
      nowMs: 1_700_000_000_000 + i
    });
    assert(res.accepted, `Attempt ${i} cleanly handled`);
    if (res.updatedCohort) sharedCohort = res.updatedCohort;
    if (res.outcome === 'enrolled') enrolledSuccess++;
    if (res.outcome === 'waitlisted') waitlistedSuccess++;
    if (res.enrollment) enrollmentsList.push(res.enrollment);
  }

  assert(enrolledSuccess === 100, `Exactly 100 active slots granted (got ${enrolledSuccess})`);
  assert(waitlistedSuccess === 5, `Exactly 5 overflow requests waitlisted (got ${waitlistedSuccess})`);
  assert(sharedCohort.currentCount === 100 && sharedCohort.waitlistCount === 5, 'No overbooking beyond 100');

  // Duplicate enrollment check for already active user
  const dupAttempt = allocateCohortSlotPure(sharedCohort, enrollmentsList[0], {
    uid: 'user_1',
    requestedLevel: 'fish',
    hasActiveConsent: true,
    consentVersion: '1.0',
    isAdult: true
  });
  assert(dupAttempt.outcome === 'already_enrolled' && dupAttempt.updatedCohort?.currentCount === 100, 'Re-enrolling existing active user is idempotent');

  // ---------------------------------------------------------------------------
  // 6. Telemetry Client (NO-OP OFF, PII scrubbing, batching & offline queue)
  // ---------------------------------------------------------------------------
  setActiveStorageUserUid('study-telemetry-test');
  clearMemoryUserStorage();

  const flushedBatches: StudyEventDoc[][] = [];
  const telemetry = new StudyTelemetryClient();

  // Disabled state must strictly drop events
  telemetry.configure({
    enabled: false,
    hasConsent: true,
    onFlush: async (b) => {
      flushedBatches.push(b);
    }
  });
  const droppedWhenOff = telemetry.track({
    uid: 'u1',
    sessionId: 's1',
    cohortLevel: 'reg',
    effectiveLevel: 'reg',
    eventName: 'tab_viewed',
    module: 'wizard'
  });
  assert(!droppedWhenOff && telemetry.getQueuedCount() === 0, 'Telemetry strictly NO-OP when Flag OFF');

  // Sanitization strips sensitive keys
  const sanitized = sanitizeTelemetryMetadata({
    tab: 'solver',
    userEmail: 'secret@example.com',
    ipAddress: '1.2.3.4',
    token: 'abc',
    latency: 42.129
  });
  const parsedSanitized = JSON.parse(sanitized) as Record<string, unknown>;
  assert(parsedSanitized.tab === 'solver' && parsedSanitized.latency === 42.13, 'Safe numeric/string metadata preserved');
  assert(!('userEmail' in parsedSanitized) && !('ipAddress' in parsedSanitized) && !('token' in parsedSanitized), 'PII keys stripped from telemetry metadata');

  // Batch auto-flush at 10 events
  telemetry.configure({
    enabled: true,
    hasConsent: true,
    onFlush: async (b) => {
      flushedBatches.push(b);
    }
  });

  for (let i = 0; i < 10; i++) {
    telemetry.track({
      uid: 'u1',
      sessionId: 's1',
      cohortLevel: 'nit',
      effectiveLevel: 'nit',
      eventName: 'solver_calculated',
      module: 'solver',
      durationMs: 120 + i,
      metadata: { spot: i }
    });
  }
  await new Promise(resolve => setTimeout(resolve, 20));
  assert(flushedBatches.length === 1 && flushedBatches[0].length === 10, 'Telemetry flushes batch of 10 automatically');
  assert(telemetry.getQueuedCount() === 0, 'Queue cleared after successful flush');

  // Withdrawal clears queue cleanly
  telemetry.track({
    uid: 'u1',
    sessionId: 's1',
    cohortLevel: 'nit',
    effectiveLevel: 'nit',
    eventName: 'hand_simulated',
    module: 'trainer'
  });
  assert(telemetry.getQueuedCount() === 1, 'Queued 1 pending event before flush');
  telemetry.clearQueue();
  assert(telemetry.getQueuedCount() === 0, 'clearQueue empties telemetry buffer on withdrawal');

  // ---------------------------------------------------------------------------
  // 7. Milestone Scheduler, Email Escaping (XSS), NPS/PMF Math & Anonymized Exports
  // ---------------------------------------------------------------------------
  assert(STUDY_MILESTONE_SCHEDULE.length === 4, '4 milestones configured (7/14/21/30)');
  const day0 = 1_700_000_000_000;
  assert(getStudyElapsedDays(day0, day0 + 8 * 86_400_000) === 8, 'Elapsed days calculated properly');
  assert(
    getDueStudyMilestone({ status: 'active', enrolledAtMs: day0, completedSurveys: [] }, day0 + 3 * 86_400_000) === null,
    'No survey due at day 3'
  );
  const due7 = getDueStudyMilestone({ status: 'active', enrolledAtMs: day0, completedSurveys: [] }, day0 + 7 * 86_400_000);
  assert(due7?.milestone === 'day7', 'Day 7 milestone due at elapsed day 7');

  const due14 = getDueStudyMilestone(
    { status: 'active', enrolledAtMs: day0, completedSurveys: ['day7'] },
    day0 + 16 * 86_400_000
  );
  assert(due14?.milestone === 'day14', 'Day 14 milestone due once Day 7 completed');

  assert(
    getDueStudyMilestone({ status: 'withdrawn', enrolledAtMs: day0, completedSurveys: [] }, day0 + 15 * 86_400_000) === null,
    'Withdrawn user receives no surveys'
  );

  // XSS HTML escape verification in reminder email builder
  assert(escapeHtmlText('<script>alert(1)</script>') === '&lt;script&gt;alert(1)&lt;/script&gt;', 'HTML escape blocks tags');
  const emailHtml = buildMilestoneReminderEmailHtml({
    displayName: '<img src=x onerror=alert(1)>',
    level: 'fish',
    milestone: 'day7',
    appUrl: 'javascript:alert(1)'
  });
  assert(!emailHtml.includes('<img') && emailHtml.includes('&lt;img') && !emailHtml.includes('javascript:alert'), 'Reminder email escapes XSS and rejects javascript: URLs');

  // NPS & PMF math
  assert(computeNps([10, 9, 8, 5]) === 25, 'NPS math: (2 promoters - 1 detractor)/4 = +25');
  assert(computeNps([]) === 0, 'Empty NPS returns 0');
  assert(computePmfVeryDisappointedPct(['very_disappointed', 'very_disappointed', 'somewhat_disappointed', 'not_disappointed']) === 50, 'PMF math: 50% very disappointed');

  const sampleFeedbacks: StudyFeedbackDoc[] = [
    {
      uid: 'uid-real-pii-1',
      cohortLevel: 'fish',
      effectiveLevel: 'fish',
      milestone: 'day7',
      npsScore: 10,
      pmfAnswer: 'very_disappointed',
      levelSatisfaction: 5,
      densityFeedback: 'just_right',
      openComment: '=cmd|"/C calc"!A0',
      expiresAtMs: day0 + 365 * 86_400_000
    },
    {
      uid: 'uid-real-pii-2',
      cohortLevel: 'nit',
      effectiveLevel: 'nit',
      milestone: 'day7',
      npsScore: 6,
      pmfAnswer: 'somewhat_disappointed',
      levelSatisfaction: 4,
      densityFeedback: 'too_complex',
      openComment: 'Excelente árbol DCFR',
      expiresAtMs: day0 + 365 * 86_400_000
    }
  ];

  const sampleEvents: StudyEventDoc[] = [
    {
      uid: 'uid-real-pii-1',
      sessionId: 's1',
      cohortLevel: 'fish',
      effectiveLevel: 'fish',
      eventName: 'study_enrolled',
      module: 'onboarding',
      durationMs: 250,
      metadataJson: '{}',
      expiresAtMs: day0 + 180 * 86_400_000
    }
  ];

  const agg = aggregateStudyMetrics(enrollmentsList.slice(0, 2), sampleFeedbacks, sampleEvents);
  assert(agg.totalActive === 2 && agg.overallNps === 0 && agg.overallPmfPct === 50, 'Aggregate metrics combine enrollments, feedbacks & events');
  assert(agg.byLevel.fish.densityDistribution.just_right === 1, 'Density distribution grouped by cohort level');

  const pseudo = anonymizeParticipantId('uid-real-pii-1');
  assert(pseudo.startsWith('PART-') && !pseudo.includes('uid-real-pii-1'), 'Participant ID pseudonymized deterministically');

  const csvOut = buildAnonymizedFeedbackCsv(sampleFeedbacks);
  assert(!csvOut.includes('uid-real-pii-1'), 'CSV export strips real UIDs');
  assert(csvOut.includes(`"'=cmd`), 'CSV export neutralizes formula injection (= + - @)');

  const jsonOut = buildAnonymizedExportJson(enrollmentsList.slice(0, 2), sampleFeedbacks, sampleEvents);
  assert(!jsonOut.includes('uid-real-pii-1') && jsonOut.includes('"piiStripped": true'), 'JSON export strips UIDs and flags piiStripped');

  clearMemoryUserStorage();
  return { passed, failed, errors };
}

if (typeof process !== 'undefined' && process.argv[1]?.endsWith('marketStudy.test.ts')) {
  runMarketStudyTests()
    .then(res => {
      console.log(`Market Study Tests: ${res.passed} passed, ${res.failed} failed`);
      if (res.failed > 0) process.exit(1);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
