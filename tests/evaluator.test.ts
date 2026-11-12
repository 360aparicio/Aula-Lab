/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Texas Hold'em 7-Card Evaluator Test Suite
 */

import { parseCard, Card } from '../src/engine/cards';
import { evaluateCards, compareHands, HandCategory } from '../src/engine/evaluator';

export function runEvaluatorTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('Running Hand Evaluator Tests...');

  // 1. Royal Flush
  const royalCards = ['As', 'Ks', 'Qs', 'Js', 'Ts', '2d', '3c'].map(parseCard);
  const royalEval = evaluateCards(royalCards);
  assert(royalEval.category === HandCategory.StraightFlush, 'Royal flush detected as StraightFlush');
  assert(royalEval.description.includes('Royal Flush'), `Royal flush description contains Royal Flush (got: ${royalEval.description})`);

  // 2. Straight Flush (9 High)
  const sfCards = ['9h', '8h', '7h', '6h', '5h', 'Kd', 'Ac'].map(parseCard);
  const sfEval = evaluateCards(sfCards);
  assert(sfEval.category === HandCategory.StraightFlush, '9-high straight flush recognized');

  // 3. Four of a Kind
  const quadCards = ['8s', '8h', '8d', '8c', 'As', 'Kd', '2c'].map(parseCard);
  const quadEval = evaluateCards(quadCards);
  assert(quadEval.category === HandCategory.FourOfAKind, 'Quads recognized');
  assert(quadEval.description.includes('8'), 'Quads are 8s');

  // 4. Full House
  const fhCards = ['Kh', 'Kd', 'Ks', 'Ac', 'Ad', '7s', '2h'].map(parseCard);
  const fhEval = evaluateCards(fhCards);
  assert(fhEval.category === HandCategory.FullHouse, 'Full House recognized');
  assert(
    fhEval.description.includes('Ks full of As') || fhEval.description.includes('Kings full of Aces'),
    `Full house description: ${fhEval.description}`
  );

  // 5. Flush
  const flushCards = ['As', 'Js', '8s', '6s', '2s', 'Kh', 'Qd'].map(parseCard);
  const flushEval = evaluateCards(flushCards);
  assert(flushEval.category === HandCategory.Flush, 'Flush recognized');

  // 6. Straight - Broadway
  const broadway = ['Ah', 'Kd', 'Qc', 'Js', 'Ts', '3c', '2d'].map(parseCard);
  const bwEval = evaluateCards(broadway);
  assert(bwEval.category === HandCategory.Straight, 'Broadway straight recognized');

  // 7. Straight - Wheel (5-4-3-2-A)
  const wheel = ['5s', '4d', '3h', '2c', 'As', 'Kd', 'Qc'].map(parseCard);
  const wheelEval = evaluateCards(wheel);
  assert(wheelEval.category === HandCategory.Straight, 'Wheel A-2-3-4-5 straight recognized');
  assert(wheelEval.description.includes('5 High'), `Wheel is 5 high: ${wheelEval.description}`);

  // 8. Three of a Kind
  const trips = ['7s', '7h', '7d', 'As', 'Kd', '4c', '2s'].map(parseCard);
  const tripsEval = evaluateCards(trips);
  assert(tripsEval.category === HandCategory.ThreeOfAKind, 'Trips recognized');

  // 9. Two Pair
  const twoPair = ['As', 'Ah', 'Kd', 'Kc', 'Qh', '4d', '2s'].map(parseCard);
  const tpEval = evaluateCards(twoPair);
  assert(tpEval.category === HandCategory.TwoPair, 'Two Pair recognized');

  // 10. One Pair
  const onePair = ['Js', 'Jh', 'Ad', 'Kc', 'Qh', '4d', '2s'].map(parseCard);
  const opEval = evaluateCards(onePair);
  assert(opEval.category === HandCategory.OnePair, 'One Pair recognized');

  // 11. High Card
  const highCard = ['As', 'Kd', 'Qh', 'Jc', '9s', '4d', '2c'].map(parseCard);
  const hcEval = evaluateCards(highCard);
  assert(hcEval.category === HandCategory.HighCard, 'High card recognized');

  // 12. Tie Breakers: Trips kicker comparison
  const tripsHighKicker = ['Kh', 'Kd', 'Ks', 'Ac', '7d'].map(parseCard);
  const tripsLowKicker = ['Kh', 'Kd', 'Ks', 'Qc', 'Jd'].map(parseCard);
  const cmpTrips = evaluateCards(tripsHighKicker).score - evaluateCards(tripsLowKicker).score;
  assert(cmpTrips > 0, 'Trips with Ace kicker strictly beats trips with Queen kicker');

  // 13. Tie Breakers: Split Pot on identical board
  const board = ['As', 'Kd', 'Qc', 'Jh', 'Ts'].map(parseCard); // Broadway straight on board
  const p1Hand = ['2c', '3c'].map(parseCard);
  const p2Hand = ['4d', '5d'].map(parseCard);
  const cmpSplit = compareHands(p1Hand, p2Hand, board);
  assert(cmpSplit === 0, 'Split pot when playing board straight');

  // 14. 6-high straight beats 5-high straight (wheel)
  const sixHigh = ['6s', '5d', '4h', '3c', '2s', 'Jd', 'Kd'].map(parseCard);
  const cmpStraights = evaluateCards(sixHigh).score - wheelEval.score;
  assert(cmpStraights > 0, '6-high straight strictly beats 5-high wheel straight');

  return { passed, failed, errors };
}
