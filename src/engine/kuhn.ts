/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Kuhn Poker Mathematical Reference Benchmark Solver.
 * Used to verify CFR / DCFR convergence against analytical Nash Equilibrium.
 * 
 * Analytical Nash Family in Kuhn Poker:
 * Player 1:
 * - Card J: Bet with probability alpha in [0, 1/3] (often 1/3 as bluff), else Check
 * - Card Q: Always Check
 * - Card K: Bet with probability 3*alpha (often 3 * 1/3 = 1.0), else Check
 * Player 2:
 * - When facing Bet:
 *   - Card J: Always Fold
 *   - Card Q: Call with probability 1/3
 *   - Card K: Always Call
 * - When facing Check:
 *   - Card J: Bet with probability 1/3 (bluff), else Check
 *   - Card Q: Always Check
 *   - Card K: Always Bet
 * 
 * Analytical Value of the Game for P1 = -1/18 ≈ -0.05555...
 */

export interface KuhnNode {
  infoSet: string;
  regrets: [number, number]; // [action 0, action 1]
  cumStrategy: [number, number];
}

export class KuhnSolver {
  private nodes: Map<string, KuhnNode> = new Map();

  private getNode(infoSet: string): KuhnNode {
    let node = this.nodes.get(infoSet);
    if (!node) {
      node = {
        infoSet,
        regrets: [0, 0],
        cumStrategy: [0, 0]
      };
      this.nodes.set(infoSet, node);
    }
    return node;
  }

  private getStrategy(node: KuhnNode): [number, number] {
    const r0 = Math.max(0, node.regrets[0]);
    const r1 = Math.max(0, node.regrets[1]);
    const sum = r0 + r1;
    if (sum > 0) {
      return [r0 / sum, r1 / sum];
    }
    return [0.5, 0.5];
  }

  /**
   * Recursive CFR on Kuhn Poker
   * history string:
   * "" -> P1 to act (0: check, 1: bet)
   * "c" -> P2 to act (0: check, 1: bet)
   * "b" -> P2 to act (0: fold, 1: call)
   * "cb" -> P1 to act (0: fold, 1: call)
   * Terminal: "cc" (showdown), "cbf" (P2 wins), "cbc" (showdown), "bf" (P1 wins), "bc" (showdown)
   */
  /**
   * Recursive CFR on Kuhn Poker
   * Returns utility for Player 0 (P1)
   */
  private cfr(
    cards: [number, number], // [p1 card, p2 card], 0=J, 1=Q, 2=K
    history: string,
    p0: number,
    p1: number
  ): number {
    const plays = history.length;
    const player = plays % 2; // 0 for P1, 1 for P2

    // Check terminal states: all payoffs computed from P1's perspective
    if (history === 'cc') {
      return cards[0] > cards[1] ? 1 : -1;
    }
    if (history === 'cbf') {
      // P1 checked, P2 bet, P1 folded -> P1 loses 1
      return -1;
    }
    if (history === 'cbc') {
      // Showdown after bet & call -> pot 4
      return cards[0] > cards[1] ? 2 : -2;
    }
    if (history === 'bf') {
      // P1 bet, P2 folded -> P1 wins 1
      return 1;
    }
    if (history === 'bc') {
      // Showdown after bet & call -> pot 4
      return cards[0] > cards[1] ? 2 : -2;
    }

    // InfoSet: player card + history
    const cardChar = cards[player] === 0 ? 'J' : cards[player] === 1 ? 'Q' : 'K';
    const infoSet = `${cardChar}${history}`;
    const node = this.getNode(infoSet);
    const strategy = this.getStrategy(node);

    // Two possible actions: 0 or 1
    const util: [number, number] = [0, 0];
    let nodeUtil = 0;

    for (let a = 0; a < 2; a++) {
      let nextHistory = history;
      if (history === '') {
        nextHistory = a === 0 ? 'c' : 'b';
      } else if (history === 'c') {
        nextHistory = a === 0 ? 'cc' : 'cb';
      } else if (history === 'b') {
        nextHistory = a === 0 ? 'bf' : 'bc';
      } else if (history === 'cb') {
        nextHistory = a === 0 ? 'cbf' : 'cbc';
      }

      if (player === 0) {
        util[a] = this.cfr(cards, nextHistory, p0 * strategy[a], p1);
      } else {
        util[a] = this.cfr(cards, nextHistory, p0, p1 * strategy[a]);
      }
      nodeUtil += strategy[a] * util[a];
    }

    // Regret update:
    // If player === 0, player wants to maximize P0 utility (util[a] - nodeUtil)
    // If player === 1, player wants to minimize P0 utility / maximize P1 utility (nodeUtil - util[a])
    for (let a = 0; a < 2; a++) {
      const reg = player === 0 ? util[a] - nodeUtil : nodeUtil - util[a];
      const oppReach = player === 0 ? p1 : p0;
      node.regrets[a] += oppReach * reg;
      const myReach = player === 0 ? p0 : p1;
      node.cumStrategy[a] += myReach * strategy[a];
    }

    return nodeUtil;
  }

  public train(iterations = 10000): {
    p1Value: number;
    strategies: Record<string, { action0: number; action1: number }>;
  } {
    const deck = [0, 1, 2]; // J, Q, K
    let utilSum = 0;

    for (let i = 0; i < iterations; i++) {
      // Shuffle 3 cards
      const c1 = Math.floor(Math.random() * 3);
      let c2 = Math.floor(Math.random() * 2);
      if (c2 >= c1) c2++;
      const cards: [number, number] = [c1, c2];

      utilSum += this.cfr(cards, '', 1, 1);
    }

    const strategies: Record<string, { action0: number; action1: number }> = {};
    for (const [infoSet, node] of this.nodes.entries()) {
      const sum = node.cumStrategy[0] + node.cumStrategy[1];
      if (sum > 0) {
        strategies[infoSet] = {
          action0: Math.round((node.cumStrategy[0] / sum) * 1000) / 1000,
          action1: Math.round((node.cumStrategy[1] / sum) * 1000) / 1000
        };
      } else {
        strategies[infoSet] = { action0: 0.5, action1: 0.5 };
      }
    }

    return {
      p1Value: utilSum / iterations,
      strategies
    };
  }
}
