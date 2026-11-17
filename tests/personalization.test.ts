/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Per-User Storage Isolation & Non-Repeating Question/Scenario Engine Tests
 */

import {
  clearMemoryUserStorage,
  setActiveStorageUserUid
} from '../src/lib/userStorage';
import { SpacedRepetitionManager } from '../src/engine/spacedRepetition';
import { LearnerService } from '../src/engine/learner';
import { AutoLearningEngine } from '../src/engine/autoLearningEngine';
import {
  generateNonRepeatingExam,
  getBankCountsByMode,
  loadSeenQuestionIds,
  markQuestionIdsSeen
} from '../src/engine/evaluationBank';
import {
  ACADEMY_SCENARIO_BANK,
  getNextAcademyScenario
} from '../src/engine/academySpots';
import {
  dealRandomHeroHand,
  loadTrainerStats,
  loadTrainingAttempts,
  saveTrainerStats,
  saveTrainingAttempt
} from '../src/trainer/trainerState';
import { parseRangeString, getRangeActiveCombos } from '../src/engine/range';
import { parseCard } from '../src/engine/cards';

export function runPersonalizationTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('Running Personalization, Isolation & Non-Repetition Tests...');

  clearMemoryUserStorage();

  // 1. Fresh user starts clean & isolated from other users
  setActiveStorageUserUid('user_alpha');
  const sm2 = SpacedRepetitionManager.getInstance();
  const learner = LearnerService.getInstance();
  const autoEngine = AutoLearningEngine.getInstance();
  sm2.reloadForActiveUser();
  learner.reloadForActiveUser();
  autoEngine.reloadForActiveUser();

  assert(
    learner.getLearnerSummary().criticalMistakesCount === 0,
    'Fresh user_alpha starts with 0 fake critical mistakes'
  );
  assert(
    autoEngine.getProfile().totalDecisions === 0 && autoEngine.getProfile().collectedHands.length === 0,
    'Fresh user_alpha starts with 0 fake decisions and 0 fake collectedHands'
  );

  // Mutate user_alpha data across engines + trainer + evaluation seen bank
  sm2.registerOrUpdateConcept({
    id: 'alpha-only-concept',
    title: 'Alpha Custom Concept',
    category: 'Botes 3-Bet',
    prompt: 'Spot privado de Alpha',
    explanation: 'Explicacion privada',
    rule: 'Regla Alpha',
    initialQuality: 2
  });
  learner.recordTrainerDecision({
    scenarioTitle: 'Alpha Trainer Spot',
    heroCombo: 'AsKs',
    boardCards: ['Kd', '7c', '2s'],
    heroPos: 'BTN',
    villainPos: 'BB',
    potBB: 6.5,
    chosenAction: 'FOLD',
    bestAction: 'BET_33',
    chosenFrequency: 0,
    bestFrequency: 0.9,
    evLossBB: 3.2,
    evLossChips: 6.4,
    evLossPercentOfPot: 49.2,
    isMistakeThresholdExceeded: true,
    grade: 'blunder'
  });
  autoEngine.collectHand({
    heroPos: 'BTN',
    villainPos: 'BB',
    heroCards: 'A♠ K♠',
    board: 'K♦ 7♣ 2♠',
    street: 'flop',
    category: 'Flops Secos (Dry)',
    potBB: 6.5,
    chosenAction: 'FOLD',
    optimalAction: 'BET 33%',
    evLossPct: 12.0,
    isMistake: true,
    keyTakeaway: 'Alpha private leak'
  });
  saveTrainerStats({
    ...loadTrainerStats(),
    elo: 1580,
    handsPlayed: 14,
    blunders: 1
  });
  saveTrainingAttempt({
    id: 'alpha-att-1',
    timestamp: Date.now(),
    scenarioTitle: 'Alpha Scenario',
    nodeHistory: [],
    heroCombo: 'AsKs',
    board: ['Kd', '7c', '2s'],
    chosenAction: 'Fold',
    bestAction: 'Bet 33%',
    grade: 'blunder',
    chosenFrequency: 0,
    bestFrequency: 0.9,
    evLossBB: 3.2,
    eloChange: -15,
    newElo: 1580
  });

  // Switch to user_beta
  setActiveStorageUserUid('user_beta');
  sm2.reloadForActiveUser();
  learner.reloadForActiveUser();
  autoEngine.reloadForActiveUser();

  assert(!sm2.getItem('alpha-only-concept'), 'user_beta does NOT see user_alpha SM-2 items');
  assert(learner.getCriticalMistakes().length === 0, 'user_beta does NOT inherit user_alpha learner mistakes');
  assert(autoEngine.getProfile().collectedHands.length === 0, 'user_beta does NOT inherit user_alpha collectedHands');
  assert(loadTrainerStats().elo === 1200 && loadTrainerStats().handsPlayed === 0, 'user_beta starts with fresh 1200 ELO and 0 hands');
  assert(loadTrainingAttempts().length === 0, 'user_beta starts with empty trainer attempt log');
  assert(loadSeenQuestionIds().levels.length === 0, 'user_beta has clean seen evaluation history');

  // Switch back to user_alpha and confirm state remained intact
  setActiveStorageUserUid('user_alpha');
  sm2.reloadForActiveUser();
  learner.reloadForActiveUser();
  autoEngine.reloadForActiveUser();

  assert(Boolean(sm2.getItem('alpha-only-concept')), 'user_alpha retains its own SM-2 item after user switch');
  assert(learner.getCriticalMistakes().length >= 1, 'user_alpha retains its own recorded mistakes');
  assert(loadTrainerStats().elo === 1580 && loadTrainerStats().handsPlayed === 14, 'user_alpha retains its 1580 ELO');
  assert(loadTrainingAttempts().length === 1, 'user_alpha retains its trainer attempts');

  // 2. Evaluation Bank Size & Non-Repetition + Option Shuffling
  setActiveStorageUserUid('exam_tester');
  const bankCounts = getBankCountsByMode();
  assert(
    bankCounts.levels >= 240 && bankCounts.fixed >= 240 && bankCounts.variable >= 240,
    `Evaluation bank exceeds 240 questions per mode (levels=${bankCounts.levels}, fixed=${bankCounts.fixed}, variable=${bankCounts.variable})`
  );

  for (const mode of ['levels', 'fixed', 'variable'] as const) {
    const batch1 = generateNonRepeatingExam(mode, 1, {
      potType: 'all',
      texture: 'all',
      opponent: 'all',
      level: 'all',
      questionCount: 12
    });
    markQuestionIdsSeen(
      mode,
      batch1.questions.map(q => q.id)
    );
    const batch2 = generateNonRepeatingExam(mode, 1, {
      potType: 'all',
      texture: 'all',
      opponent: 'all',
      level: 'all',
      questionCount: 12
    });

    const ids1 = new Set(batch1.questions.map(q => q.id));
    const overlap = batch2.questions.filter(q => ids1.has(q.id));
    assert(
      overlap.length === 0,
      `Mode "${mode}" returns 0 repeated questions across consecutive batches (overlap=${overlap.length})`
    );
  }

  const sampleBatch = generateNonRepeatingExam('fixed', 2, {
    potType: 'all',
    texture: 'all',
    opponent: 'all',
    level: 'all',
    questionCount: 12
  });
  const correctIndices = new Set(
    sampleBatch.questions.map(q => q.options.findIndex(o => o.isCorrect))
  );
  assert(
    correctIndices.size >= 2,
    `Correct answer positions are varied across options (distinct indices=${Array.from(correctIndices).join(',')})`
  );

  // 3. Academy Scenario Unseen Deck Cycle
  setActiveStorageUserUid('academy_tester');
  const dryTotal = ACADEMY_SCENARIO_BANK.dry_flop.length;
  const seenDryIds: string[] = [];
  for (let i = 0; i < dryTotal; i++) {
    const sc = getNextAcademyScenario('dry_flop', seenDryIds[seenDryIds.length - 1]);
    seenDryIds.push(sc.id);
  }
  assert(
    new Set(seenDryIds).size === dryTotal,
    `getNextAcademyScenario covers all ${dryTotal} dry_flop spots without repeat in a full cycle (unique=${new Set(seenDryIds).size})`
  );
  const nextCycleFirst = getNextAcademyScenario('dry_flop', seenDryIds[seenDryIds.length - 1]);
  assert(
    nextCycleFirst.id !== seenDryIds[seenDryIds.length - 1],
    'getNextAcademyScenario does not repeat excludeId immediately upon cycle rollover'
  );

  // 4. Trainer random hero hand exclusion
  const board = ['Kd', '7c', '2s'].map(parseCard);
  const range = parseRangeString('AA,KK,QQ', 'Test');
  const combos = getRangeActiveCombos(range, board);
  const excludeList = combos.slice(0, combos.length - 1).map(c => c.combo.key);
  const remainingExpected = combos[combos.length - 1].combo.key;
  const picked = dealRandomHeroHand(combos, excludeList);
  assert(
    picked !== null && picked.combo.key === remainingExpected,
    `dealRandomHeroHand excludes recently dealt combos (expected ${remainingExpected}, got ${picked?.combo.key})`
  );

  setActiveStorageUserUid(null);
  clearMemoryUserStorage();

  return { passed, failed, errors };
}
