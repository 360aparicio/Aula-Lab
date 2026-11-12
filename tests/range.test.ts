/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 13x13 Range Matrix, Combo Expansion & Blocker Unit Tests
 */

import { parseCard } from '../src/engine/cards';
import { CANONICAL_MAP, getActiveCombos, createConcreteComboFromCards } from '../src/engine/combos';
import { calculateRangeMetrics, parseRangeString } from '../src/engine/range';

export function runRangeTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('Running Range & Combo Tests...');

  // 1. Total canonical hands count = 169
  assert(CANONICAL_MAP.size === 169, `Canonical hands size is 169 (got ${CANONICAL_MAP.size})`);

  // 2. Count pairs, suited, offsuit
  let pairCount = 0;
  let suitedCount = 0;
  let offsuitCount = 0;
  let totalCombos = 0;

  for (const hand of CANONICAL_MAP.values()) {
    if (hand.type === 'pair') {
      pairCount++;
      assert(hand.combos.length === 6, `${hand.name} has 6 combos`);
    } else if (hand.type === 'suited') {
      suitedCount++;
      assert(hand.combos.length === 4, `${hand.name} has 4 combos`);
    } else {
      offsuitCount++;
      assert(hand.combos.length === 12, `${hand.name} has 12 combos`);
    }
    totalCombos += hand.combos.length;
  }

  assert(pairCount === 13, `13 pocket pairs (got ${pairCount})`);
  assert(suitedCount === 78, `78 suited hands (got ${suitedCount})`);
  assert(offsuitCount === 78, `78 offsuit hands (got ${offsuitCount})`);
  assert(totalCombos === 1326, `Total 1326 holdem combos (got ${totalCombos})`);

  // 3. Range parser
  const parsedRange = parseRangeString('AA,KK,AKs,AKo:0.5');
  assert(parsedRange.weights['AA'] === 1.0, 'AA parsed with weight 1.0');
  assert(parsedRange.weights['KK'] === 1.0, 'KK parsed with weight 1.0');
  assert(parsedRange.weights['AKs'] === 1.0, 'AKs parsed with weight 1.0');
  assert(parsedRange.weights['AKo'] === 0.5, 'AKo parsed with weight 0.5');

  // 4. Dash range expansion (e.g. JJ-88)
  const dashRange = parseRangeString('JJ-88');
  assert(dashRange.weights['JJ'] === 1.0, 'JJ in JJ-88');
  assert(dashRange.weights['TT'] === 1.0, 'TT in JJ-88');
  assert(dashRange.weights['99'] === 1.0, '99 in JJ-88');
  assert(dashRange.weights['88'] === 1.0, '88 in JJ-88');
  assert(!dashRange.weights['77'], '77 not in JJ-88');
  assert(!dashRange.weights['QQ'], 'QQ not in JJ-88');

  // 5. Blocker removal
  // Board has As: AA should have 3 combos remaining instead of 6
  const boardWithAs = [parseCard('As'), parseCard('Kd'), parseCard('7c')];
  const aaCombos = getActiveCombos('AA', boardWithAs);
  assert(aaCombos.length === 3, `AA with As on board has 3 combos (got ${aaCombos.length})`);

  // AKs: AsKs dead (As dead, Ks not dead), AhKh dead (Kd on board not Kh, wait Kd is dead so AhKd dead, but Kh is alive:
  // Let's verify exactly: board has As, Kd, 7c
  // AKs has 4 combos: AsKs (blocked by As), AhKh (alive), AdKd (blocked by Kd), AcKc (alive)
  // So 2 combos remaining!
  const aksCombos = getActiveCombos('AKs', boardWithAs);
  assert(aksCombos.length === 2, `AKs with As, Kd on board has 2 combos (got ${aksCombos.length})`);

  // 6. Metrics calculation
  const metrics = calculateRangeMetrics(parsedRange, []);
  assert(metrics.totalCombos > 0, 'Range metrics totalCombos > 0');
  assert(metrics.percentage > 0 && metrics.percentage <= 100, 'Range metrics percentage in (0, 100]');

  // 7. Custom combo creation
  const customCombo = createConcreteComboFromCards(parseCard('As'), parseCard('Kh'));
  assert(customCombo.canonicalName === 'AKo', `AsKh produces canonical AKo (got ${customCombo.canonicalName})`);
  assert(customCombo.key === 'AsKh', `AsKh key matches (got ${customCombo.key})`);

  return { passed, failed, errors };
}
