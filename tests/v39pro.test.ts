/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Allin School / Lab Studio Engine Tests:
 * - HandSimulator (9 scenarios including Multiway, no card collisions, showdown, UID isolation)
 * - TheTracker2Engine (multi-format parsing, exact deduplication, 4-series cumulative graph, HUD stats, JSON template)
 * - DiagnosticEngine (Live 100-Hand Challenge & TheTracker2 DB level/archetype/drill diagnosis)
 */

import { clearMemoryUserStorage, setActiveStorageUserUid } from '../src/lib/userStorage';
import {
  applyHeroDecision,
  createSimulatedHand,
  loadLiveChallengeState,
  resetLiveChallengeState,
  saveLiveChallengeState,
  SCENARIO_META,
  SIM_POSITIONS,
  type SimScenarioType
} from '../src/engine/handSimulator';
import {
  appendHandsToTracker2Database,
  buildTracker2ChartSeries,
  computeHudStats,
  DEFAULT_HUD_TEMPLATE,
  exportTracker2BackupZip,
  filterHands,
  generateSampleSessionHands,
  getHandActionSteps,
  HUD_PRESETS,
  importTracker2BackupFromBytes,
  loadTracker2Databases,
  parseHandHistoriesText,
  parseHudTemplateJson
} from '../src/engine/theTracker2Engine';
import {
  buildDiagnosticFromLiveChallenge,
  buildDiagnosticFromTracker2Hands
} from '../src/engine/diagnosticEngine';
import { buildArchetypeNodeLocks, DCFRSolver } from '../src/engine/dcfr';
import { buildGameTree, DEFAULT_TREE_CONFIG, getAllActionNodes } from '../src/engine/gameTree';
import { parseCard } from '../src/engine/cards';
import { getRangeActiveCombos, parseRangeString } from '../src/engine/range';
import {
  buildWeeklyLeaksRadar,
  loadOnboardingState,
  resetOnboardingState,
  saveOnboardingState
} from '../src/lib/experienceMode';

export async function runV39ProTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
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
  setActiveStorageUserUid('v39_tester_uid');

  // 1. HandSimulator: test all 9 scenarios + zero card collision
  const scenarios = Object.keys(SCENARIO_META) as SimScenarioType[];
  assert(scenarios.length === 9, 'SCENARIO_META defines all 9 poker scenarios');

  for (const sc of scenarios) {
    const pos = SIM_POSITIONS[scenarios.indexOf(sc) % SIM_POSITIONS.length];
    const hand = createSimulatedHand({ handNumber: 1, positionFilter: pos, scenarioFilter: sc });
    assert(hand.heroPos === pos, `Hero pos matches ${pos}`);
    assert(hand.scenario === sc, `Scenario matches ${sc}`);
    assert(hand.boardCards.length === 3 && hand.fullRunout.length === 5, `Flop & 5-card runout valid for ${sc}`);
    assert(hand.actions.length >= 3, `Decision actions generated for ${sc}`);

    const seenIds = new Set<number>();
    hand.fullRunout.forEach(c => seenIds.add(c.id));
    hand.seats.forEach(s => {
      if (s.holeCards) {
        seenIds.add(s.holeCards[0].id);
        seenIds.add(s.holeCards[1].id);
      }
    });
    const activeSeated = hand.seats.filter(s => s.inHand && s.holeCards).length;
    assert(seenIds.size === 5 + activeSeated * 2, `No card collisions across table in ${sc}`);

    if (sc === 'MULTIWAY') {
      assert(activeSeated >= 3, 'MULTIWAY deals 3+ active contenders');
    }
  }

  // 2. Play hand to showdown cleanly
  let sim = createSimulatedHand({ handNumber: 2, positionFilter: 'BTN', scenarioFilter: 'MULTIWAY' });
  let steps = 0;
  while (!sim.isFinished && steps < 5) {
    const nonFold = sim.actions.find(a => a.actionType !== 'fold') || sim.actions[0];
    const res = applyHeroDecision(sim, nonFold);
    sim = res.nextState;
    steps++;
    assert(!Number.isNaN(res.decisionRecord.evLossBB), 'evLossBB is valid number');
  }
  assert(sim.isFinished, 'Simulated hand finishes within river showdown');

  // 3. UID isolation of Reto 100 Manos
  const reset = resetLiveChallengeState(true);
  reset.completedHands = 20;
  saveLiveChallengeState(reset);
  setActiveStorageUserUid('v39_other_uid');
  assert(loadLiveChallengeState().completedHands === 0, 'Other UID starts with 0 completed challenge hands');
  setActiveStorageUserUid('v39_tester_uid');
  assert(loadLiveChallengeState().completedHands === 20, 'Tester UID keeps 20 completed challenge hands');

  // 4. TheTracker2Engine parsing, deduplication & 4-series cumulative chart
  const dbs = loadTracker2Databases();
  assert(dbs.length === 1, 'Initial TheTracker2 user starts with 1 DB');
  const dbId = dbs[0].id;
  const sample250 = generateSampleSessionHands(250, 'unitbatch');
  assert(sample250.length === 250, 'Demo generator creates 250 hands');

  const firstImport = appendHandsToTracker2Database(dbId, sample250, 'demo.txt');
  assert(firstImport.addedCount === 250 && firstImport.duplicateCount === 0, 'First import adds 250 unique hands');

  const secondImport = appendHandsToTracker2Database(dbId, sample250, 'demo.txt');
  assert(secondImport.addedCount === 0 && secondImport.duplicateCount === 250, 'Second import skips all 250 duplicates');

  const parsedText = parseHandHistoriesText(
    `PokerStars Hand #999888777: Hold'em No Limit ($0.05/$0.10 USD)\nSeat 1: BTNHero ($10 in chips) (BTN)\nDealt to BTNHero [As Kd]\nBTNHero: raises $0.25 to $0.25\n*** FLOP *** [Ah 7d 2c]\nBTNHero: bets $0.30\n*** SHOW DOWN ***\nBTNHero collected $1.10 from pot`
  );
  assert(parsedText.length === 1 && parsedText[0].handKey === '999888777', 'Parses raw PokerStars hand text accurately');

  const series = buildTracker2ChartSeries(filterHands(secondImport.databases[0].hands, 'ALL'));
  assert(series.length === 251, 'Chart series includes origin + 250 hands');
  const hud = computeHudStats(secondImport.databases[0].hands);
  assert(hud.hands === 250 && hud.vpip > 0 && hud.pfr > 0, 'HUD stats computed properly');

  const tpl = parseHudTemplateJson(JSON.stringify(DEFAULT_HUD_TEMPLATE));
  assert(tpl.layoutRows.length === 3, 'HUD template JSON roundtrips cleanly');
  assert(HUD_PRESETS.length === 3, 'HUD_PRESETS exposes 3 built-in HUD configurations');

  const parsedXml = parseHandHistoriesText(
    '<hand id="XML1" netWonBB="-4.5"><player pos="(BTN)" /><action>raise</action><street>showdown</street></hand>',
    'export.xml'
  );
  assert(
    parsedXml.length === 1 && parsedXml[0].handKey === 'XML1' && parsedXml[0].netWonBB === -4.5 && parsedXml[0].wentToShowdown,
    'Parses XML hand history exports accurately'
  );

  // 5. DiagnosticEngine report checks
  const tracker2Diag = buildDiagnosticFromTracker2Hands(secondImport.databases[0].hands, 'Test DB');
  assert(tracker2Diag.positionalBreakdown.length === 6, 'Diagnostic evaluates all 6 positions UTG..BB');
  assert(tracker2Diag.improvementPlan.length >= 1, 'Diagnostic builds actionable drill improvement plan');

  const liveDiag = buildDiagnosticFromLiveChallenge(loadLiveChallengeState());
  assert(liveDiag.source === 'live_100', 'Live diagnostic builds cleanly');

  // 6. Preflop street hand + table preset + plainEnglishTip
  const preHand = createSimulatedHand({
    handNumber: 1,
    positionFilter: 'BTN',
    scenarioFilter: 'SRP_IP',
    includePreflop: true,
    tablePreset: 'recreational'
  });
  assert(preHand.street === 'preflop' && preHand.boardCards.length === 0, 'Preflop mode starts before Flop with 0 board cards');
  const afterPre = applyHeroDecision(preHand, preHand.actions.find(a => a.actionType !== 'fold') || preHand.actions[0]);
  assert(
    afterPre.nextState.street === 'flop' &&
      afterPre.nextState.boardCards.length === 3 &&
      Boolean(afterPre.nextState.chronicle[0]?.plainEnglishTip),
    'Preflop transition reveals 3 Flop cards and plainEnglishTip'
  );

  // 7. Seat button position inference, Euro blinds & true All-In EV calculation
  const euroHand = parseHandHistoriesText(
    `PokerStars Hand #888777666: Hold'em No Limit (€0.05/€0.10 EUR)
Table 'Madrid' 6-max Seat #3 is the button
Seat 1: UTGPlayer (€10 in chips)
Seat 2: MPPlayer (€10 in chips)
Seat 3: BTNHero (€10 in chips)
Seat 4: SBPlayer (€10 in chips)
Seat 5: BBVillain (€10 in chips)
Dealt to BTNHero [As Ah]
UTGPlayer: folds
MPPlayer: folds
BTNHero: raises €0.25 to €0.25
SBPlayer: folds
BBVillain: raises €1.00 to €1.05
BTNHero: calls €0.80
*** FLOP *** [Kh 7d 2c]
*** SHOW DOWN ***
BTNHero: shows [As Ah]
BBVillain: shows [Kc Qd]
BTNHero collected €2.15 from pot`
  );
  assert(
    euroHand.length === 1 &&
      euroHand[0].heroPos === 'BTN' &&
      euroHand[0].villainCardsStr === 'Kc Qd' &&
      euroHand[0].evAdjustedBB > 0 &&
      euroHand[0].netWonBB > 0,
    'TheTracker2 parser detects Seat #3 button pos (BTN), € blinds, and real AA vs KK equity EV'
  );

  // 8. DCFR Solver with Rake %, Multi-Street Runout Equity, and Node-Locking
  const testBoard = ['As', '7d', '2c'].map(parseCard);
  const testTree = buildGameTree({ ...DEFAULT_TREE_CONFIG, street: 'flop', betSizes: [0.5] });
  const oopC = getRangeActiveCombos(parseRangeString('AA,KK,QQ', 'OOP'), testBoard);
  const ipC = getRangeActiveCombos(parseRangeString('AA,KK,AKs', 'IP'), testBoard);
  const rootActionKey = testTree.actions[0].actionKey || testTree.actions[0].type;
  const solverPro = new DCFRSolver(testTree, testBoard, oopC, ipC, {
    iterations: 15,
    algorithm: 'DCFR',
    rakePct: 0.05,
    rakeCapChips: 12,
    simulateFutureStreets: true,
    nodeLocks: {
      [testTree.id]: { [rootActionKey]: 1 }
    }
  });
  const solveProRes = solverPro.solve();
  const rootRes = solveProRes.nodeStrategies.get(testTree.id);
  const lockedStrat = rootRes?.overallStrategy?.[rootActionKey] ?? 0;
  assert(
    solveProRes.iterationsRun === 15 && Math.abs(lockedStrat - 1) < 0.001,
    'DCFRSolver honors Rake %, simulateFutureStreets, and exploitative Node-Locking'
  );

  // 9. Chronological TheTracker2 Street-by-Street Replayer with Dynamic Pot & Pot Odds
  const replayParse = parseHandHistoriesText(
    `PokerStars Hand #777666555: Hold'em No Limit ($0.05/$0.10 USD)
Table 'Madrid' 6-max Seat #3 is the button
Seat 3: BTNHero ($10 in chips)
Seat 5: BBVillain ($10 in chips)
BTNHero: posts small blind $0.05
BBVillain: posts big blind $0.10
*** HOLE CARDS ***
Dealt to BTNHero [As Kd]
BTNHero: raises $0.20 to $0.25
BBVillain: calls $0.15
*** FLOP *** [Ah 7d 2c]
BBVillain: bets $0.30
BTNHero: calls $0.30
*** TURN *** [Ah 7d 2c] [Ks]
BBVillain: checks
BTNHero: bets $0.80
BBVillain: folds
BTNHero collected $1.10 from pot`
  );
  const replaySteps = getHandActionSteps(replayParse[0]);
  const callFlopStep = replaySteps.find(st => st.street === 'flop' && st.actionType === 'call');
  const turnDealStep = replaySteps.find(st => st.street === 'turn' && st.actionType === 'deal');
  assert(
    replaySteps.length >= 8 &&
      Boolean(callFlopStep) &&
      callFlopStep!.toCallBB > 0 &&
      callFlopStep!.potOddsPct !== null &&
      callFlopStep!.boardSoFar === 'Ah 7d 2c' &&
      turnDealStep?.boardSoFar === 'Ah 7d 2c Ks',
    'TheTracker2 Replayer parses Preflop->Flop->Turn progressive board, dynamic pot BB, and exact Pot Odds'
  );

  // 10. Multi-Street GameTree (Flop -> Turn -> River) + Mixed Percentage Node-Locking & Archetype Presets
  const multiTree = buildGameTree({
    ...DEFAULT_TREE_CONFIG,
    street: 'flop',
    betSizes: [0.5],
    maxRaises: 1,
    multiStreetMode: true
  });
  const multiNodes = getAllActionNodes(multiTree);
  const hasTurnNode = multiNodes.some(n => n.street === 'turn');
  const hasRiverNode = multiNodes.some(n => n.street === 'river');
  assert(hasTurnNode && hasRiverNode, 'multiStreetMode creates Flop, Turn, and River ActionNodes in single tree');

  const mixedSolver = new DCFRSolver(multiTree, testBoard, oopC, ipC, {
    iterations: 15,
    nodeLocks: {
      [multiTree.id]: { CHECK: 0.7, BET_50: 0.3 }
    }
  });
  const mixedRes = mixedSolver.solve();
  const mixedRoot = mixedRes.nodeStrategies.get(multiTree.id);
  const chkFreq = mixedRoot?.overallStrategy?.['CHECK'] ?? 0;
  const betFreq = mixedRoot?.overallStrategy?.['BET_50'] ?? 0;
  assert(
    Math.abs(chkFreq - 0.7) < 0.02 && Math.abs(betFreq - 0.3) < 0.02,
    `Mixed percentage Node-Lock converges to 70% Check / 30% Bet (got ${chkFreq}/${betFreq})`
  );

  const overfoldLocks = buildArchetypeNodeLocks(multiTree, 'overfold_cbet');
  assert(Object.keys(overfoldLocks).length > 0, 'Archetype node-lock preset populates multiple facing-bet nodes');

  // 11. Portable ZIP Backup Export/Import roundtrip with deduplication
  const zipBundle = await exportTracker2BackupZip();
  const zipBytes = new Uint8Array(await zipBundle.blob.arrayBuffer());
  const restoreRes = await importTracker2BackupFromBytes(zipBundle.filename, zipBytes);
  assert(
    restoreRes.addedHands === 0 && restoreRes.duplicateHands >= 250,
    'Portable ZIP backup restores cleanly and skips exact duplicate hands across devices'
  );

  // 12. 60s Onboarding Persistence + Plain-Spanish Weekly Leaks Radar
  resetOnboardingState();
  assert(loadOnboardingState().completed === false, 'Onboarding resets cleanly per UID');
  saveOnboardingState({ completed: true, dismissed: false, goal: 'analyze_hands', completedAt: Date.now() });
  assert(loadOnboardingState().goal === 'analyze_hands', 'Onboarding goal persists per UID');
  const weeklyRadar = buildWeeklyLeaksRadar();
  assert(Array.isArray(weeklyRadar) && weeklyRadar.length <= 3, 'Weekly Leaks Radar builds up to 3 prioritized leaks');

  return { passed, failed, errors };
}
