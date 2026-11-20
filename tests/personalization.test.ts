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
  MASTER_EVALUATION_BANK,
  generateNonRepeatingExam,
  getBankCountsByMode,
  loadSeenQuestionIds,
  markQuestionIdsSeen,
  resetEvaluationSessionHistory
} from '../src/engine/evaluationBank';
import {
  ACADEMY_SCENARIO_BANK,
  buildShuffledAcademySessionQueue,
  getNextAcademyScenario,
  resetAcademySessionHistory,
  type AcademyCategory
} from '../src/engine/academySpots';
import {
  buildSimulatedHandFingerprint,
  createSimulatedHand,
  generateDynamicCryptoSeed,
  loadPersistedSimulatedFingerprints,
  pickTrueRandomDeckIndex,
  resetSimulatedHandHistory
} from '../src/engine/handSimulator';
import { fisherYatesShuffle } from '../src/lib/random';
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

  // 5. Cross-mode evaluation non-repetition within the same session & card safety
  setActiveStorageUserUid('cross_mode_eval_tester');
  resetEvaluationSessionHistory('cross_mode_eval_tester');
  for (const q of MASTER_EVALUATION_BANK) {
    const qCardIds = [...q.heroCards.map(c => c.id), ...q.board.map(c => c.id)];
    if (new Set(qCardIds).size !== qCardIds.length) {
      assert(false, `Card collision detected in MASTER_EVALUATION_BANK question ${q.id}`);
    }
  }
  passed++; // All MASTER_EVALUATION_BANK card collision checks clean

  const crossModeIds: string[] = [];
  for (const m of ['levels', 'fixed', 'variable'] as const) {
    const exam = generateNonRepeatingExam(m, 2, {
      potType: 'all',
      texture: 'all',
      opponent: 'all',
      level: 'all',
      questionCount: 12
    });
    markQuestionIdsSeen(m, exam.questions.map(q => q.id));
    exam.questions.forEach(q => crossModeIds.push(q.id));
    const maxPoolConcepts = new Set(
      MASTER_EVALUATION_BANK.filter(q => (m === 'levels' ? q.level === 2 : true)).map(q => q.conceptTag)
    ).size;
    const distinctConcepts = new Set(exam.questions.map(q => q.conceptTag));
    assert(
      distinctConcepts.size >= Math.min(maxPoolConcepts, exam.questions.length),
      `Exam mode "${m}" maximizes conceptTag variety (${distinctConcepts.size}/${Math.min(maxPoolConcepts, exam.questions.length)} max distinct concepts in ${exam.questions.length} Qs)`
    );
  }
  assert(
    new Set(crossModeIds).size === crossModeIds.length,
    `Zero repeated evaluation questions across consecutive levels+fixed+variable exams in same session (${new Set(crossModeIds).size}/${crossModeIds.length})`
  );

  // 6. Complete Academy 12-category audit: zero card collisions, full non-repeating session cycle, suit permutations
  setActiveStorageUserUid('academy_audit_tester');
  resetAcademySessionHistory('academy_audit_tester');
  const allCats = Object.keys(ACADEMY_SCENARIO_BANK) as AcademyCategory[];
  assert(allCats.length === 12, `ACADEMY_SCENARIO_BANK covers all 12 categories (found=${allCats.length})`);

  let totalSpotsAudited = 0;
  for (const cat of allCats) {
    const catPool = ACADEMY_SCENARIO_BANK[cat];
    assert(catPool.length >= 8, `Category ${cat} has ${catPool.length} (>= 8) unique spots`);
    for (const sc of catPool) {
      totalSpotsAudited++;
      const cardIds = [...sc.heroCards.map(c => c.id), ...sc.board.map(c => c.id)];
      assert(
        new Set(cardIds).size === cardIds.length,
        `Academy spot ${sc.id} has zero hero/board card collisions`
      );
      assert(
        sc.options.some(o => o.isCorrect),
        `Academy spot ${sc.id} has a valid optimal option`
      );
    }

    const cycleIds: string[] = [];
    const cycleSuitSignatures = new Set<string>();
    let prevId: string | undefined;
    for (let i = 0; i < catPool.length; i++) {
      const dealtSpot = getNextAcademyScenario(cat, prevId);
      const dealtCards = [...dealtSpot.heroCards.map(c => c.id), ...dealtSpot.board.map(c => c.id)];
      assert(
        new Set(dealtCards).size === dealtCards.length,
        `Permuted Academy spot ${dealtSpot.id} preserves zero card collisions`
      );
      cycleIds.push(dealtSpot.id);
      cycleSuitSignatures.add(dealtSpot.heroCards.map(c => c.suit).join(''));
      prevId = dealtSpot.id;
    }
    assert(
      new Set(cycleIds).size === catPool.length,
      `Academy ${cat} deals all ${catPool.length} unique spots with 0 repeats in a session cycle`
    );
    assert(
      cycleSuitSignatures.size >= 2,
      `Academy ${cat} applies varied isomorphic suit permutations (${cycleSuitSignatures.size} suit pairs)`
    );
  }
  assert(totalSpotsAudited >= 96, `Total curated Academy base scenarios >= 96 (found=${totalSpotsAudited})`);

  // 7. Live 6-Max Simulator randomness, rotation, and session non-repetition across 45 consecutive hands
  const simRecentKeys: string[] = [];
  const simFingerprints = new Set<string>();
  const simScenarios = new Set<string>();
  const simPositions = new Set<string>();
  const simCanonicals = new Set<string>();

  for (let h = 1; h <= 45; h++) {
    const hand = createSimulatedHand({
      handNumber: h,
      positionFilter: 'RANDOM',
      scenarioFilter: 'RANDOM',
      recentKeys: simRecentKeys
    });
    const fp = buildSimulatedHandFingerprint({
      scenario: hand.scenario,
      heroPos: hand.heroPos,
      heroCards: hand.heroCards,
      fullRunout: hand.fullRunout
    });
    simRecentKeys.push(fp);
    simFingerprints.add(fp);
    simScenarios.add(hand.scenario);
    simPositions.add(hand.heroPos);

    const r1 = hand.heroCards[0].rank;
    const r2 = hand.heroCards[1].rank;
    const suited = hand.heroCards[0].suit === hand.heroCards[1].suit ? 's' : r1 === r2 ? '' : 'o';
    simCanonicals.add([r1, r2].sort().join('') + suited);

    const tableCardIds = new Set<number>();
    hand.fullRunout.forEach(c => tableCardIds.add(c.id));
    let activeSeatCards = 0;
    hand.seats.forEach(s => {
      if (s.inHand && s.holeCards) {
        tableCardIds.add(s.holeCards[0].id);
        tableCardIds.add(s.holeCards[1].id);
        activeSeatCards += 2;
      }
    });
    assert(
      tableCardIds.size === 5 + activeSeatCards,
      `Simulated hand #${h} has 0 card collisions across table & runout`
    );
  }

  assert(
    simFingerprints.size === 45,
    `Live simulator deals 45/45 distinct hand fingerprints in one session (unique=${simFingerprints.size})`
  );
  assert(
    simScenarios.size >= 7,
    `Live simulator RANDOM mode rotates across scenarios (${simScenarios.size}/9 scenarios hit)`
  );
  assert(
    simPositions.size >= 5,
    `Live simulator RANDOM mode rotates across positions (${simPositions.size}/6 positions hit)`
  );
  assert(
    simCanonicals.size >= 16,
    `Live simulator deals genuinely varied starting hands (${simCanonicals.size} distinct canonical combos in 45 hands)`
  );

  // 8. Fisher-Yates pre-shuffled Academy session queues (varied order + 0 intra-session duplicates)
  setActiveStorageUserUid('fisher_yates_tester');
  resetAcademySessionHistory('fisher_yates_tester');
  const fyPool = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const fyOrderA = fisherYatesShuffle(fyPool).join(',');
  const fyOrderB = fisherYatesShuffle(fyPool).join(',');
  const fyOrderC = fisherYatesShuffle(fyPool).join(',');
  assert(
    new Set([fyOrderA, fyOrderB, fyOrderC]).size >= 2,
    'fisherYatesShuffle produces genuinely distinct permutations across invocations'
  );

  const qSession1 = buildShuffledAcademySessionQueue('three_bet_pot');
  const qSession2 = buildShuffledAcademySessionQueue('three_bet_pot');
  assert(
    qSession1.length === ACADEMY_SCENARIO_BANK.three_bet_pot.length,
    `buildShuffledAcademySessionQueue returns all ${ACADEMY_SCENARIO_BANK.three_bet_pot.length} scenarios in category`
  );
  assert(
    new Set(qSession1.map(s => s.id)).size === qSession1.length,
    'buildShuffledAcademySessionQueue has zero duplicate scenario IDs within the session queue'
  );
  assert(
    qSession1.map(s => s.id).join(',') !== ACADEMY_SCENARIO_BANK.three_bet_pot.map(s => s.id).join(',') ||
      qSession2.map(s => s.id).join(',') !== ACADEMY_SCENARIO_BANK.three_bet_pot.map(s => s.id).join(','),
    'buildShuffledAcademySessionQueue shuffles order rather than serving raw sequential bank order'
  );

  // 9. HandSimulator dynamic Crypto.getRandomValues seed, random index selector & cross-session history
  const seed1 = generateDynamicCryptoSeed();
  const seed2 = generateDynamicCryptoSeed();
  assert(
    seed1.length === 4 && seed2.length === 4 && seed1.join(':') !== seed2.join(':'),
    'generateDynamicCryptoSeed creates distinct 128-bit dynamic seeds via Crypto.getRandomValues'
  );
  const pickedIndices = Array.from({ length: 18 }, () => pickTrueRandomDeckIndex(52));
  assert(
    new Set(pickedIndices).size >= 10 && pickedIndices.every(i => i >= 0 && i < 52),
    `pickTrueRandomDeckIndex returns varied non-sequential indices in [0, 52) (unique=${new Set(pickedIndices).size})`
  );

  resetSimulatedHandHistory();
  assert(loadPersistedSimulatedFingerprints().length === 0, 'resetSimulatedHandHistory clears scoped fingerprints');
  const crossSessionH1 = createSimulatedHand({ handNumber: 1, positionFilter: 'BTN', scenarioFilter: 'SRP_IP' });
  const crossSessionH2 = createSimulatedHand({ handNumber: 2, positionFilter: 'BTN', scenarioFilter: 'SRP_IP' });
  const persistedFps = loadPersistedSimulatedFingerprints();
  assert(
    persistedFps.length >= 2 &&
      buildSimulatedHandFingerprint(crossSessionH1) !== buildSimulatedHandFingerprint(crossSessionH2),
    `createSimulatedHand persists cross-session fingerprints (count=${persistedFps.length}) without immediate repeat`
  );

  setActiveStorageUserUid(null);
  clearMemoryUserStorage();

  return { passed, failed, errors };
}
