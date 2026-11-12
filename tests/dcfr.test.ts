/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Discounted Counterfactual Regret Minimization (DCFR) Unit Tests
 */

import { parseCard } from '../src/engine/cards';
import { DCFRSolver } from '../src/engine/dcfr';
import { buildGameTree, TreeConfig } from '../src/engine/gameTree';
import { getRangeActiveCombos, parseRangeString } from '../src/engine/range';

export function runDCFRTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('Running DCFR Poker Solver Tests...');

  // Set up small, fast river scenario
  const board = ['As', 'Kd', '7c', '2h', '4s'].map(parseCard);
  const oopRange = parseRangeString('JJ,TT,99,ATs,AJo');
  const ipRange = parseRangeString('AA,AKs,65s,QTo:0.5');

  const oopCombos = getRangeActiveCombos(oopRange, board);
  const ipCombos = getRangeActiveCombos(ipRange, board);

  assert(oopCombos.length > 0, `OOP combos > 0 (got ${oopCombos.length})`);
  assert(ipCombos.length > 0, `IP combos > 0 (got ${ipCombos.length})`);

  const config: TreeConfig = {
    startingPot: 100,
    effectiveStack: 100,
    betSizes: [0.75],
    raiseSizes: [2.5],
    allowAllIn: true,
    maxRaises: 1,
    street: 'river'
  };

  const tree = buildGameTree(config);
  const solver = new DCFRSolver(tree, board, oopCombos, ipCombos, {
    algorithm: 'DCFR',
    alpha: 1.5,
    beta: 0.0,
    gamma: 2.0,
    iterations: 80
  });

  const result = solver.solve(80);

  // 1. Check result format
  assert(result.iterationsRun === 80, `80 iterations run (got ${result.iterationsRun})`);
  assert(result.elapsedMs >= 0, 'Elapsed time recorded');
  assert(result.nodeStrategies.size > 0, 'Node strategies extracted');

  // 2. Validate strategy probability normalization (sums to 1.0)
  for (const [nodeId, stratResult] of result.nodeStrategies.entries()) {
    let sum = 0;
    for (const freq of Object.values(stratResult.overallStrategy)) {
      sum += freq;
    }
    const diff = Math.abs(sum - 1.0);
    assert(
      diff < 0.02,
      `Overall strategy at node ${nodeId} sums to ~1.0 (got ${sum.toFixed(3)})`
    );

    // Also check canonical combo strategies
    for (const [canon, handStrat] of Object.entries(stratResult.canonicalStrategy)) {
      let handSum = 0;
      for (const f of Object.values(handStrat)) {
        handSum += f;
        assert(f >= 0 && f <= 1.0, `Frequency in [0, 1] for ${canon} (got ${f})`);
      }
      const handDiff = Math.abs(handSum - 1.0);
      assert(
        handDiff < 0.02,
        `Hand strategy for ${canon} at ${nodeId} sums to ~1.0 (got ${handSum.toFixed(3)})`
      );
    }
  }

  // 3. Test CFR+ variant as well
  const cfrPlusSolver = new DCFRSolver(tree, board, oopCombos, ipCombos, {
    algorithm: 'CFR_PLUS',
    iterations: 50
  });
  const cfrPlusResult = cfrPlusSolver.solve(50);
  assert(cfrPlusResult.nodeStrategies.size > 0, 'CFR+ variant solves successfully');

  return { passed, failed, errors };
}
