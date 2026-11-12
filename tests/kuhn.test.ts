/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Kuhn Poker Analytical Benchmark Unit Test
 */

import { KuhnSolver } from '../src/engine/kuhn';

export function runKuhnTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('Running Kuhn Poker Game Theory Benchmark Tests...');

  const solver = new KuhnSolver();
  const result = solver.train(25000);

  // 1. Analytical value of the game for Player 1 is -1/18 ≈ -0.05555
  const expectedValue = -1 / 18;
  const valDiff = Math.abs(result.p1Value - expectedValue);
  assert(
    valDiff < 0.05,
    `Kuhn Poker P1 value converges near -0.0555 (got ${result.p1Value.toFixed(4)}, diff ${valDiff.toFixed(4)})`
  );

  // 2. Player 1 with Queen should almost always Check (action 0) when acting first
  const qOpen = result.strategies['Q'];
  if (qOpen) {
    assert(
      qOpen.action0 > 0.85,
      `P1 with Queen checks with high frequency (got check: ${qOpen.action0}, bet: ${qOpen.action1})`
    );
  } else {
    assert(false, 'InfoSet "Q" not found in Kuhn result');
  }

  // 3. Player 2 facing Bet with King should always Call (action 1)
  const kFacingBet = result.strategies['Kb'];
  if (kFacingBet) {
    assert(
      kFacingBet.action1 > 0.90,
      `P2 facing bet with King always calls (got call: ${kFacingBet.action1})`
    );
  }

  // 4. Player 2 facing Bet with Jack should always Fold (action 0)
  const jFacingBet = result.strategies['Jb'];
  if (jFacingBet) {
    assert(
      jFacingBet.action0 > 0.90,
      `P2 facing bet with Jack always folds (got fold: ${jFacingBet.action0})`
    );
  }

  return { passed, failed, errors };
}
