/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Master Test Runner for Allin School · Lab Studio Engine & Mathematics.
 */

import { runEvaluatorTests } from './evaluator.test';
import { runRangeTests } from './range.test';
import { runGameTreeTests } from './gameTree.test';
import { runKuhnTests } from './kuhn.test';
import { runDCFRTests } from './dcfr.test';
import { runPersonalizationTests } from './personalization.test';
import { runV39ProTests } from './v39pro.test';
import { runGtoAuditTests } from './gto_audit.test';

async function runAll() {
  console.log('====================================================');
  console.log('     ALLIN SCHOOL MATHEMATICAL & ENGINE SUITE       ');
  console.log('====================================================\n');

  let totalPassed = 0;
  let totalFailed = 0;
  const allErrors: string[] = [];

  const suites = [
    { name: '7-Card Hand Evaluator', fn: runEvaluatorTests },
    { name: '13x13 Range Matrix & Blockers', fn: runRangeTests },
    { name: 'Game Decision Tree Builder', fn: runGameTreeTests },
    { name: 'Kuhn Poker Nash Reference', fn: runKuhnTests },
    { name: 'Discounted CFR (DCFR) Subgame Solver', fn: runDCFRTests },
    { name: 'Per-User Isolation & Non-Repeating Pools', fn: runPersonalizationTests },
    { name: 'Allin School Simulator, TheTracker2 & Diagnostic Suite', fn: runV39ProTests },
    { name: 'Lab Studio Nash Mathematical Audit Suite', fn: runGtoAuditTests },
  ];

  for (const suite of suites) {
    console.log(`\n--- Test Suite: ${suite.name} ---`);
    const res = await suite.fn();
    totalPassed += res.passed;
    totalFailed += res.failed;
    allErrors.push(...res.errors);
    console.log(`Result: ${res.passed} passed, ${res.failed} failed`);
  }

  console.log('\n====================================================');
  console.log(`TOTAL PASSED: ${totalPassed}`);
  console.log(`TOTAL FAILED: ${totalFailed}`);
  console.log('====================================================');

  if (totalFailed > 0) {
    console.error('\nFailures encountered:');
    allErrors.forEach(err => console.error(` - ${err}`));
    process.exit(1);
  } else {
    console.log('\nALL ENGINE & MATHEMATICAL TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  }
}

runAll().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
