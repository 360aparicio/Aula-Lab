/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Poker Decision Tree Builder & Legal Action Transition Unit Tests
 */

import { buildGameTree, getAllActionNodes, TreeConfig } from '../src/engine/gameTree';

export function runGameTreeTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('Running Game Tree Tests...');

  const config: TreeConfig = {
    startingPot: 100,
    effectiveStack: 100,
    betSizes: [0.5],
    raiseSizes: [2.5],
    allowAllIn: true,
    maxRaises: 2,
    street: 'river'
  };

  const root = buildGameTree(config);

  // 1. Root properties
  assert(root.nodeType === 'action', 'Root is an action node');
  assert(root.player === 'OOP', 'OOP acts first postflop');
  assert(root.pot === 100, 'Starting pot is 100');
  assert(root.stacks.OOP === 100, 'OOP stack is 100');
  assert(root.stacks.IP === 100, 'IP stack is 100');

  // 2. Legal actions at root
  const actionTypes = root.actions.map(a => a.type);
  assert(actionTypes.includes('CHECK'), 'Root has CHECK action');
  assert(actionTypes.includes('BET'), 'Root has BET action');
  assert(actionTypes.includes('ALLIN'), 'Root has ALLIN action');

  // 3. Check -> Check transition terminates at Showdown
  const checkChild = root.children['CHECK'];
  assert(checkChild && checkChild.nodeType === 'action', 'After OOP check, IP acts');
  if (checkChild.nodeType === 'action') {
    assert(checkChild.player === 'IP', 'IP is the player at checkChild');
    const ipCheckChild = checkChild.children['CHECK'];
    assert(ipCheckChild && ipCheckChild.nodeType === 'showdown', 'Check-Check line leads to Showdown terminal');
    assert(ipCheckChild.pot === 100, 'Showdown pot remains 100 after checks');
  }

  // 4. Bet -> Fold transition terminates at Fold
  const betKey = Object.keys(root.children).find(k => k.startsWith('BET')) || 'BET_50';
  const betChild = root.children[betKey];
  assert(betChild && betChild.nodeType === 'action', 'Bet child exists');
  if (betChild && betChild.nodeType === 'action') {
    assert(betChild.player === 'IP', 'IP faces the bet');
    const foldNode = betChild.children['FOLD'];
    assert(foldNode && foldNode.nodeType === 'fold', 'Fold action leads to Fold terminal node');
    if (foldNode && foldNode.nodeType === 'fold') {
      assert(foldNode.folder === 'IP', 'Folder is IP');
      assert(foldNode.winner === 'OOP', 'Winner is OOP');
    }

    const callNode = betChild.children['CALL'];
    assert(callNode && callNode.nodeType === 'showdown', 'Bet-Call line leads to Showdown terminal');
    assert(callNode && callNode.pot === 200, `Bet 50 + Call 50 on pot 100 = 200 (got ${callNode?.pot})`);
  }

  // 5. Action nodes traversal
  const allActionNodes = getAllActionNodes(root);
  assert(allActionNodes.length > 2, `Multiple action nodes generated (got ${allActionNodes.length})`);

  return { passed, failed, errors };
}
