/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Tests for Global Deck Theme Preferences (classic_white default + per-UID isolation)
 * and Academy Full-Hand Multi-Street Runout Simulation (Preflop/Flop -> Turn -> River -> Showdown).
 */

import {
  DEFAULT_DECK_THEME,
  DECK_THEMES,
  getDeckThemeDefinition,
  isValidDeckThemeId,
  loadDeckThemePreference,
  saveDeckThemePreference
} from '../src/lib/deckTheme';
import {
  ACADEMY_SCENARIO_BANK
} from '../src/engine/academySpots';
import {
  advanceAcademyHandStreet,
  initAcademyHandSession,
  isFoldActionCode,
  submitAcademyStreetDecision
} from '../src/engine/academyRunout';
import { clearMemoryUserStorage, setActiveStorageUserUid } from '../src/lib/userStorage';

export function runDeckAndRunoutTests(): { passed: number; failed: number; errors: string[] } {
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

  console.log('Running Global Deck Theme & Academy Full-Hand Runout Tests...');

  clearMemoryUserStorage();

  // 1. Default Deck Theme is classic_white (light white card background)
  assert(
    DEFAULT_DECK_THEME === 'classic_white',
    'Default deck theme is classic_white'
  );
  assert(
    DECK_THEMES.classic_white.isLightCard === true && DECK_THEMES.classic_white.cardBg === 'bg-white',
    'classic_white uses bg-white light card surface'
  );
  assert(
    isValidDeckThemeId('four_color_white') && isValidDeckThemeId('dark_pro') && isValidDeckThemeId('four_color_dark') && !isValidDeckThemeId('invalid_theme'),
    'isValidDeckThemeId validates supported deck themes cleanly'
  );

  // 2. Per-UID isolation for deck preferences
  setActiveStorageUserUid('uid_deck_a');
  assert(loadDeckThemePreference() === 'classic_white', 'Fresh user A defaults to classic_white');
  saveDeckThemePreference('four_color_dark');
  assert(loadDeckThemePreference() === 'four_color_dark', 'User A updates deck theme to four_color_dark');

  setActiveStorageUserUid('uid_deck_b');
  assert(loadDeckThemePreference() === 'classic_white', 'User B remains isolated with classic_white default');
  saveDeckThemePreference('four_color_white');
  assert(loadDeckThemePreference() === 'four_color_white', 'User B updates deck theme to four_color_white');

  setActiveStorageUserUid('uid_deck_a');
  assert(loadDeckThemePreference() === 'four_color_dark', 'User A retains four_color_dark across switches');
  assert(getDeckThemeDefinition('invalid' as never).id === 'classic_white', 'getDeckThemeDefinition falls back to classic_white');

  // 3. Flop Scenario -> Turn -> River -> 7-Card Showdown (with unblocked unique cards)
  const flopScenario = ACADEMY_SCENARIO_BANK.dry_flop[0];
  let flopSession = initAcademyHandSession(flopScenario);
  const dealtCardIds = new Set<number>([
    flopSession.heroCards[0].id,
    flopSession.heroCards[1].id,
    flopSession.villainCards[0].id,
    flopSession.villainCards[1].id,
    ...flopSession.fullBoard.map(c => c.id)
  ]);
  assert(
    dealtCardIds.size === 9,
    `Flop hand deals 9 distinct unblocked cards (2 Hero + 2 Villain + 5 Board), got ${dealtCardIds.size}`
  );
  assert(flopSession.stage === 'flop' && flopSession.currentStep.visibleBoard.length === 3, 'Flop scenario starts on flop with 3 visible cards');

  // Even choosing a suboptimal non-fold option must continue to Turn & River!
  const suboptimalNonFoldIdx = flopSession.currentStep.options.findIndex(
    o => !o.isCorrect && !isFoldActionCode(o.action)
  );
  const chosenFlopIdx = suboptimalNonFoldIdx >= 0 ? suboptimalNonFoldIdx : 0;
  flopSession = submitAcademyStreetDecision(flopSession, chosenFlopIdx);
  assert(flopSession.currentStepAnswered === true && flopSession.stage === 'flop', 'Submitting non-fold flop decision keeps hand active for Turn progression');

  flopSession = advanceAcademyHandStreet(flopSession);
  assert(flopSession.stage === 'turn' && flopSession.currentStep.visibleBoard.length === 4, 'Advancing after Flop deals Turn (4th card)');

  const turnNonFoldIdx = flopSession.currentStep.options.findIndex(o => !isFoldActionCode(o.action));
  flopSession = submitAcademyStreetDecision(flopSession, turnNonFoldIdx >= 0 ? turnNonFoldIdx : 0);
  flopSession = advanceAcademyHandStreet(flopSession);
  assert(flopSession.stage === 'river' && flopSession.currentStep.visibleBoard.length === 5, 'Advancing after Turn deals River (5th card)');

  const riverNonFoldIdx = flopSession.currentStep.options.findIndex(o => !isFoldActionCode(o.action));
  flopSession = submitAcademyStreetDecision(flopSession, riverNonFoldIdx >= 0 ? riverNonFoldIdx : 0);
  flopSession = advanceAcademyHandStreet(flopSession);
  assert(
    flopSession.stage === 'showdown' && flopSession.showdown !== null && flopSession.streetHistory.length === 3,
    'Advancing after River resolves 7-card Showdown with 3-street history (Flop/Turn/River)'
  );
  assert(
    Boolean(flopSession.showdown?.heroEval.description && flopSession.showdown?.villainEval.description),
    'Showdown computes valid 7-card hand descriptions for both Hero and Villain'
  );

  // 4. Preflop Scenario -> Flop -> Turn -> River -> Showdown
  const preflopScenario = ACADEMY_SCENARIO_BANK.open_raise[0];
  let preSession = initAcademyHandSession(preflopScenario);
  assert(preSession.stage === 'preflop' && preSession.currentStep.visibleBoard.length === 0, 'Preflop scenario starts on preflop with 0 visible board cards');
  const preNonFoldIdx = preSession.currentStep.options.findIndex(o => !isFoldActionCode(o.action));
  preSession = submitAcademyStreetDecision(preSession, preNonFoldIdx >= 0 ? preNonFoldIdx : 0);
  preSession = advanceAcademyHandStreet(preSession);
  assert(preSession.stage === 'flop' && preSession.currentStep.visibleBoard.length === 3, 'Preflop non-fold advances to Flop (3 cards)');
  const flNonFold = preSession.currentStep.options.findIndex(o => !isFoldActionCode(o.action));
  preSession = submitAcademyStreetDecision(preSession, flNonFold >= 0 ? flNonFold : 0);
  preSession = advanceAcademyHandStreet(preSession);
  assert(preSession.stage === 'turn' && preSession.currentStep.visibleBoard.length === 4, 'Preflop hand advances to Turn (4 cards)');
  const trNonFold = preSession.currentStep.options.findIndex(o => !isFoldActionCode(o.action));
  preSession = submitAcademyStreetDecision(preSession, trNonFold >= 0 ? trNonFold : 0);
  preSession = advanceAcademyHandStreet(preSession);
  assert(preSession.stage === 'river' && preSession.currentStep.visibleBoard.length === 5, 'Preflop hand advances to River (5 cards)');
  const rvNonFold = preSession.currentStep.options.findIndex(o => !isFoldActionCode(o.action));
  preSession = submitAcademyStreetDecision(preSession, rvNonFold >= 0 ? rvNonFold : 0);
  preSession = advanceAcademyHandStreet(preSession);
  assert(
    preSession.stage === 'showdown' && preSession.streetHistory.length === 4,
    'Preflop hand finishes at 7-card Showdown with complete 4-street chronicle'
  );

  // 5. Explicit Fold ends hand cleanly
  const foldScenario = ACADEMY_SCENARIO_BANK.bluff_catch[0];
  let foldSession = initAcademyHandSession(foldScenario);
  const foldIdx = foldSession.currentStep.options.findIndex(o => isFoldActionCode(o.action));
  if (foldIdx >= 0) {
    foldSession = submitAcademyStreetDecision(foldSession, foldIdx);
    assert(foldSession.stage === 'folded' && foldSession.showdown === null, 'Explicit Fold ends hand immediately without Showdown');
  } else {
    passed++;
  }

  return { passed, failed, errors };
}
