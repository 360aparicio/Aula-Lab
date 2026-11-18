/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Comprehensive Lab Studio Nash Mathematical & Simulator Audit Regression Suite:
 * Verifies every invariant fixed across DCFR, GameTree, HandSimulator,
 * TheTracker2Engine, DiagnosticEngine, AutoLearningEngine, and Scenario Card Pools.
 */

import { clearMemoryUserStorage, setActiveStorageUserUid } from '../src/lib/userStorage';
import { parseCard } from '../src/engine/cards';
import { DCFRSolver } from '../src/engine/dcfr';
import { buildGameTree, DEFAULT_TREE_CONFIG, getAllActionNodes } from '../src/engine/gameTree';
import { getRangeActiveCombos, parseRangeString } from '../src/engine/range';
import {
  applyHeroDecision,
  createSimulatedHand,
  estimateHandStrengthCategory
} from '../src/engine/handSimulator';
import { buildDiagnosticFromLiveChallenge } from '../src/engine/diagnosticEngine';
import { parseHandHistoriesText } from '../src/engine/theTracker2Engine';
import { AutoLearningEngine } from '../src/engine/autoLearningEngine';
import { PREBUILT_SCENARIOS } from '../src/trainer/prebuiltScenarios';
import { getAllAcademyScenarios } from '../src/engine/academySpots';
import { MASTER_EVALUATION_BANK } from '../src/engine/evaluationBank';

export function runGtoAuditTests(): { passed: number; failed: number; errors: string[] } {
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

  clearMemoryUserStorage();
  setActiveStorageUserUid('gto_audit_tester_uid');

  // 1. Zero card collisions across all 32 Prebuilt scenarios, 48 Academy spots, and 720 Evaluation questions
  let collisionCount = 0;
  for (const sc of PREBUILT_SCENARIOS) {
    if (new Set(sc.boardCards).size !== sc.boardCards.length) collisionCount++;
  }
  for (const sp of getAllAcademyScenarios()) {
    const ids = [...sp.heroCards, ...sp.board].map(c => c.id);
    if (new Set(ids).size !== ids.length) collisionCount++;
  }
  for (const q of MASTER_EVALUATION_BANK) {
    const ids = [...q.heroCards, ...q.board].map(c => c.id);
    if (new Set(ids).size !== ids.length) collisionCount++;
  }
  assert(
    collisionCount === 0,
    `Zero duplicate card collisions across all Prebuilt (32), Academy (48), and Evaluation (720) scenarios (got ${collisionCount})`
  );

  // 2. HandSimulator strength grading edge cases
  // 2a: Board trips KKK42 + unpaired 7h 6h must NOT be graded as Hero's monster
  const boardTripsRes = estimateHandStrengthCategory(
    [parseCard('7h'), parseCard('6h')],
    ['Ks', 'Kd', 'Kh', '4s', '2c'].map(parseCard)
  );
  assert(
    boardTripsRes.tier !== 'monster',
    `Board trips KKK42 with 7h6h is not falsely graded as monster (got ${boardTripsRes.tier})`
  );

  // 2b: Counterfeit / board-paired AA7 + 22 must NOT be graded as monster Two Pair
  const boardPairedRes = estimateHandStrengthCategory(
    [parseCard('2s'), parseCard('2h')],
    ['As', 'Ad', '7c'].map(parseCard)
  );
  assert(
    boardPairedRes.tier === 'medium',
    `Pocket 22 on AsAd7c is graded medium bluff-catcher, not monster two-pair (got ${boardPairedRes.tier})`
  );

  // 2c: Wheel straight draw A-2-3-4 detected on Flop
  const wheelDrawRes = estimateHandStrengthCategory(
    [parseCard('As'), parseCard('5c')],
    ['2d', '3h', 'Jc'].map(parseCard)
  );
  assert(
    wheelDrawRes.tier === 'draw',
    `Wheel straight draw A5 on 23J Flop is detected as draw (got ${wheelDrawRes.tier})`
  );

  // 2d: Missed flush/straight draw on 5-card River has 0 draw outs -> must NOT be classified as draw
  const riverMissedRes = estimateHandStrengthCategory(
    [parseCard('8h'), parseCard('7h')],
    ['Kh', 'Qh', '4c', '2d', '9s'].map(parseCard)
  );
  assert(
    riverMissedRes.tier === 'air',
    `Missed 4-flush + gutshot on 5-card River has 0 outs and classifies as air (got ${riverMissedRes.tier})`
  );

  // 3. Preflop pot accounting & VPIP fold accounting in HandSimulator
  const btnPre = createSimulatedHand({
    handNumber: 1,
    positionFilter: 'BTN',
    scenarioFilter: 'SRP_IP',
    includePreflop: true
  });
  const foldOpt = btnPre.actions.find(a => a.actionType === 'fold')!;
  const afterFold = applyHeroDecision(btnPre, foldOpt);
  assert(
    afterFold.decisionRecord.vpipAction === false && afterFold.nextState.isFinished,
    'Preflop Fold sets vpipAction = false and finishes hand'
  );

  const btnPre2 = createSimulatedHand({
    handNumber: 2,
    positionFilter: 'BTN',
    scenarioFilter: 'SRP_IP',
    includePreflop: true
  });
  const openOpt = btnPre2.actions.find(a => a.actionType === 'raise')!;
  const afterOpen = applyHeroDecision(btnPre2, openOpt);
  // Real 6-max SRP vs BB/OOP: BTN raises 2.5 + Villain already in blinds (if BB=1.0 adds 1.5, else adds 2.5) -> max 6.5, vs BB exact 5.5 BB
  assert(
    afterOpen.nextState.potBB >= 5.5 && afterOpen.nextState.potBB <= 6.5,
    `Preflop Open Raise pot transitions to realistic Flop SRP pot without double-counting (got ${afterOpen.nextState.potBB} BB)`
  );

  // 4. DiagnosticEngine returns 0 (never hardcoded 7.5 / 60 / 52) when opportunities are 0
  const zeroOppDiag = buildDiagnosticFromLiveChallenge({
    active: true,
    targetHands: 100,
    completedHands: 1,
    records: [afterFold.decisionRecord],
    startedAt: Date.now(),
    updatedAt: Date.now()
  });
  assert(
    zeroOppDiag.metrics.threeBet === 0 && zeroOppDiag.metrics.cbet === 0 && zeroOppDiag.metrics.wsd === 0,
    `DiagnosticEngine returns 0 when 3Bet/CBet/SD opportunities are zero (got ${zeroOppDiag.metrics.threeBet}/${zeroOppDiag.metrics.cbet}/${zeroOppDiag.metrics.wsd})`
  );

  // 5. GameTree multiStreetMode supports downstream raises on Turn/River
  const multiTree = buildGameTree({
    ...DEFAULT_TREE_CONFIG,
    startingPot: 100,
    effectiveStack: 400,
    street: 'flop',
    betSizes: [0.5],
    raiseSizes: [2.5],
    maxRaises: 2,
    multiStreetMode: true
  });
  const allMultiNodes = getAllActionNodes(multiTree);
  const turnBetNode = allMultiNodes.find(
    n => n.street === 'turn' && n.actions.some(a => a.type === 'RAISE')
  );
  assert(
    Boolean(turnBetNode),
    'multiStreetMode builds downstream Turn raise/check-raise action nodes'
  );

  // 6. DCFRSolver computes real non-zero p1EV / p2EV and simulates Flop/Turn future streets by default
  const board3 = ['As', '7d', '2c'].map(parseCard);
  const flopTree = buildGameTree({ ...DEFAULT_TREE_CONFIG, street: 'flop', betSizes: [0.5] });
  const oopC = getRangeActiveCombos(parseRangeString('JJ-99,AQs,KQs', 'OOP'), board3);
  const ipC = getRangeActiveCombos(parseRangeString('AA-QQ,AKs,QJs', 'IP'), board3);
  const solver = new DCFRSolver(flopTree, board3, oopC, ipC, { iterations: 20 });
  const res = solver.solve();
  assert(
    res.p1EV !== 0 || res.p2EV !== 0,
    `DCFRSolver computes real non-zero root p1EV/p2EV (got p1=${res.p1EV}, p2=${res.p2EV})`
  );

  // 7. TheTracker2 parser accuracy: opener folded to 3-bet + Villain donk-bet on Flop must not credit Hero CBet
  const hhEdgeText = `PokerStars Hand #555444333: Hold'em No Limit ($0.05/$0.10 USD)
Table 'Paris' 6-max Seat #3 is the button
Seat 3: HeroPlayer ($10 in chips)
Seat 5: VillainBB ($10 in chips)
HeroPlayer: posts small blind $0.05
VillainBB: posts big blind $0.10
*** HOLE CARDS ***
Dealt to HeroPlayer [Kh Qd]
HeroPlayer: raises $0.20 to $0.25
VillainBB: calls $0.15
*** FLOP *** [As 8d 3c]
VillainBB: bets $0.30
HeroPlayer: calls $0.30
*** TURN *** [As 8d 3c] [2h]
VillainBB: checks
HeroPlayer: checks
*** RIVER *** [As 8d 3c 2h] [9s]
VillainBB: checks
HeroPlayer: checks
*** SHOW DOWN ***
VillainBB: shows [Ac 7d]
HeroPlayer: mucks hand
VillainBB collected $1.05 from pot`;

  const parsedEdge = parseHandHistoriesText(hhEdgeText);
  assert(
    parsedEdge.length === 1 &&
      parsedEdge[0].threeBet === false &&
      parsedEdge[0].cbet === false &&
      parsedEdge[0].heroInvestedBB === 5.5,
    `TheTracker2 parser distinguishes Villain donk vs Hero CBet and counts incremental Hero investment accurately (got 3bet=${parsedEdge[0]?.threeBet}, cbet=${parsedEdge[0]?.cbet}, inv=${parsedEdge[0]?.heroInvestedBB})`
  );

  // 8. AutoLearningEngine clean play must not emit false "Botes 3-Bet" leak
  const al = AutoLearningEngine.getInstance();
  al.resetStats();
  const cleanProf = al.recordDecision({
    street: 'flop',
    category: 'C-Bet IP',
    heroCards: 'AsKs',
    board: 'Ad7c2h',
    chosenAction: 'Bet 33%',
    optimalAction: 'Bet 33%',
    evLossPct: 0.4,
    isMistake: false,
    potBB: 6
  });
  assert(
    !cleanProf.liveTipForCurrentSpot.includes('Botes 3-Bet'),
    'AutoLearningEngine does not fabricate Botes 3-Bet leak when zero mistakes exist'
  );

  return { passed, failed, errors };
}
