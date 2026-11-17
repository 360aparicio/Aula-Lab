/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Discounted Counterfactual Regret Minimization (DCFR) & CFR+ Engine.
 * Formulated according to Brown & Sandholm (2019):
 * alpha = 1.5, beta = 0.0, gamma = 2.0.
 */

import { Card, FULL_DECK } from './cards';
import { compareHands } from './evaluator';
import { ActionNode, GameNode, getOtherPlayer, PlayerRole } from './gameTree';
import { ConcreteHandWithWeight } from './range';

export interface DCFRConfig {
  algorithm: 'DCFR' | 'CFR_PLUS';
  alpha: number; // default 1.5
  beta: number;  // default 0.0
  gamma: number; // default 2.0
  iterations: number;
  rakePct?: number; // 0..0.15 (e.g., 0.05 = 5% rake)
  rakeCapChips?: number; // max rake per pot in chips (0 = uncapped)
  simulateFutureStreets?: boolean; // when true & board < 5, average equity over stratified runouts
  nodeLocks?: Record<string, Record<string, number>>; // nodeId -> actionKey -> forced frequency
}

export const DEFAULT_DCFR_CONFIG: DCFRConfig = {
  algorithm: 'DCFR',
  alpha: 1.5,
  beta: 0.0,
  gamma: 2.0,
  iterations: 300,
  rakePct: 0,
  rakeCapChips: 0,
  simulateFutureStreets: true,
  nodeLocks: {}
};

export interface InfoSetStrategy {
  actionWeights: Record<string, number>; // actionKey -> normalized frequency (0.0 - 1.0)
  actionEVs: Record<string, number>;     // actionKey -> EV
  ev: number;
}

export interface NodeStrategyResult {
  nodeId: string;
  player: PlayerRole;
  actions: string[];
  actionLabels: Record<string, string>;
  // Overall frequency across all combos in range
  overallStrategy: Record<string, number>;
  // Strategy per concrete combo: comboKey -> { actionKey: frequency }
  comboStrategy: Record<string, Record<string, number>>;
  // Strategy grouped by canonical hand e.g. "AA": { actionKey: frequency }
  canonicalStrategy: Record<string, Record<string, number>>;
  comboEV: Record<string, number>;
  // Expected Values per action (in chips)
  comboActionEVs: Record<string, Record<string, number>>;
  canonicalActionEVs: Record<string, Record<string, number>>;
  overallActionEVs: Record<string, number>;
  // Convergence and Regret tracking
  maxRegret: number;
  avgRegret: number;
  localExploitability: number;
}

export interface SolveResult {
  iterationsRun: number;
  elapsedMs: number;
  averageExploitability: number;
  nodeStrategies: Map<string, NodeStrategyResult>;
  p1EV: number; // OOP EV
  p2EV: number; // IP EV
}

export class DCFRSolver {
  private treeRoot: ActionNode;
  private board: Card[];
  private oopCombos: ConcreteHandWithWeight[];
  private ipCombos: ConcreteHandWithWeight[];
  private config: DCFRConfig;

  // Precomputed showdown matrix: oopComboIdx x ipComboIdx -> outcome (+1 OOP win, -1 IP win, 0 tie)
  // undefined if combos conflict (share card)
  private showdownMatrix: (number | null)[][];

  // Regrets: key `${nodeId}:${player}:${comboIdx}` -> number[] (one per action)
  private regrets: Map<string, Float64Array> = new Map();
  // Cumulative Strategy: key `${nodeId}:${player}:${comboIdx}` -> Float64Array
  private cumStrategy: Map<string, Float64Array> = new Map();
  // Action EVs per combo: key `${nodeId}:${player}:${comboIdx}` -> Float64Array
  private lastActionEVs: Map<string, Float64Array> = new Map();

  constructor(
    treeRoot: ActionNode,
    board: Card[],
    oopCombos: ConcreteHandWithWeight[],
    ipCombos: ConcreteHandWithWeight[],
    config: Partial<DCFRConfig> = {}
  ) {
    this.treeRoot = treeRoot;
    this.board = board;
    this.oopCombos = oopCombos;
    this.ipCombos = ipCombos;
    this.config = { ...DEFAULT_DCFR_CONFIG, ...config };

    this.showdownMatrix = this.precomputeShowdowns();
  }

  private precomputeShowdowns(): (number | null)[][] {
    const matrix: (number | null)[][] = [];
    const useRunouts = Boolean(this.config.simulateFutureStreets && this.board.length >= 3 && this.board.length < 5);
    let runoutBoards: Card[][] = [this.board];

    if (useRunouts) {
      const boardIds = new Set(this.board.map(c => c.id));
      const remainingDeck = FULL_DECK.filter(c => !boardIds.has(c.id));
      const totalPairs = this.oopCombos.length * this.ipCombos.length;
      runoutBoards = [];

      if (this.board.length === 4) {
        // Turn (4 cards): exact over all remaining cards for focused ranges, else 16 stratified cards
        const sampleCount = totalPairs <= 1200 ? remainingDeck.length : 16;
        const step = Math.max(1, Math.floor(remainingDeck.length / sampleCount));
        for (let idx = 0; idx < remainingDeck.length && runoutBoards.length < sampleCount; idx += step) {
          runoutBoards.push([...this.board, remainingDeck[idx]]);
        }
      } else {
        // Flop (3 cards): stratified turn + river pairs with higher resolution
        const sampleCount = totalPairs > 4500 ? 6 : 12;
        const step = Math.max(1, Math.floor(remainingDeck.length / sampleCount));
        for (let idx = 0; idx < remainingDeck.length - 1 && runoutBoards.length < sampleCount; idx += step) {
          const turnCard = remainingDeck[idx];
          const riverCard = remainingDeck[(idx + 13) % remainingDeck.length];
          if (turnCard.id !== riverCard.id) {
            runoutBoards.push([...this.board, turnCard, riverCard]);
          }
        }
      }
      if (runoutBoards.length === 0) runoutBoards = [this.board];
    }

    for (let o = 0; o < this.oopCombos.length; o++) {
      const oopHand = [this.oopCombos[o].combo.card1, this.oopCombos[o].combo.card2];
      const row: (number | null)[] = [];

      for (let i = 0; i < this.ipCombos.length; i++) {
        const ipHand = [this.ipCombos[i].combo.card1, this.ipCombos[i].combo.card2];

        // Check card conflicts
        if (
          oopHand[0].id === ipHand[0].id ||
          oopHand[0].id === ipHand[1].id ||
          oopHand[1].id === ipHand[0].id ||
          oopHand[1].id === ipHand[1].id
        ) {
          row.push(null); // card conflict
        } else if (!useRunouts) {
          const cmp = compareHands(oopHand, ipHand, this.board);
          row.push(cmp > 0 ? 1 : cmp < 0 ? -1 : 0);
        } else {
          let sumAdv = 0;
          let validRuns = 0;
          for (const rb of runoutBoards) {
            let conflict = false;
            for (let bIdx = this.board.length; bIdx < rb.length; bIdx++) {
              const rc = rb[bIdx];
              if (
                rc.id === oopHand[0].id ||
                rc.id === oopHand[1].id ||
                rc.id === ipHand[0].id ||
                rc.id === ipHand[1].id
              ) {
                conflict = true;
                break;
              }
            }
            if (conflict) continue;
            const cmp = compareHands(oopHand, ipHand, rb);
            sumAdv += cmp > 0 ? 1 : cmp < 0 ? -1 : 0;
            validRuns++;
          }
          if (validRuns > 0) {
            row.push(sumAdv / validRuns);
          } else {
            const cmp = compareHands(oopHand, ipHand, this.board);
            row.push(cmp > 0 ? 1 : cmp < 0 ? -1 : 0);
          }
        }
      }
      matrix.push(row);
    }

    return matrix;
  }

  private getStrategy(
    node: ActionNode,
    player: PlayerRole,
    comboIdx: number
  ): Float64Array {
    const numActions = node.actions.length;
    const lockMap = this.config.nodeLocks?.[node.id];
    if (lockMap) {
      const locked = new Float64Array(numActions);
      let lockSum = 0;
      for (let a = 0; a < numActions; a++) {
        const key = node.actions[a].actionKey || node.actions[a].type;
        const val = Math.max(0, Number(lockMap[key] ?? 0));
        locked[a] = val;
        lockSum += val;
      }
      if (lockSum > 1e-9) {
        for (let a = 0; a < numActions; a++) locked[a] /= lockSum;
        return locked;
      }
    }

    const key = `${node.id}:${player}:${comboIdx}`;
    let r = this.regrets.get(key);
    if (!r) {
      r = new Float64Array(numActions);
      this.regrets.set(key, r);
    }

    const strat = new Float64Array(numActions);
    let positiveSum = 0;

    for (let a = 0; a < numActions; a++) {
      const reg = r[a];
      if (reg > 0) {
        strat[a] = reg;
        positiveSum += reg;
      } else {
        strat[a] = 0;
      }
    }

    if (positiveSum > 1e-12) {
      for (let a = 0; a < numActions; a++) {
        strat[a] /= positiveSum;
      }
    } else {
      const uniform = 1.0 / numActions;
      for (let a = 0; a < numActions; a++) {
        strat[a] = uniform;
      }
    }

    return strat;
  }

  /**
   * Discount regrets and strategy accumulation per iteration according to DCFR
   */
  private applyDiscounts(t: number) {
    if (this.config.algorithm !== 'DCFR' || t <= 1) return;

    const alpha = this.config.alpha;
    const beta = this.config.beta;
    const gamma = this.config.gamma;

    const posFactor = Math.pow(t, alpha) / (Math.pow(t, alpha) + 1.0);
    const negFactor = Math.pow(t, beta) / (Math.pow(t, beta) + 1.0);
    const stratFactor = Math.pow(t / (t + 1.0), gamma);

    for (const r of this.regrets.values()) {
      for (let a = 0; a < r.length; a++) {
        if (r[a] > 0) {
          r[a] *= posFactor;
        } else if (r[a] < 0) {
          r[a] *= negFactor;
        }
      }
    }

    for (const s of this.cumStrategy.values()) {
      for (let a = 0; a < s.length; a++) {
        s[a] *= stratFactor;
      }
    }
  }

  /**
   * Recursive CFR traversal
   */
  private cfr(
    node: GameNode,
    probOOP: Float64Array,
    probIP: Float64Array,
    t: number
  ): { evOOP: Float64Array; evIP: Float64Array } {
    // Base Case 1: Fold
    if (node.nodeType === 'fold') {
      const folder = node.folder;
      const oopLen = this.oopCombos.length;
      const ipLen = this.ipCombos.length;
      const evOOP = new Float64Array(oopLen);
      const evIP = new Float64Array(ipLen);

      const oopBet = node.playerBets.OOP;
      const ipBet = node.playerBets.IP;
      const startingPot = Math.max(0, node.pot - oopBet - ipBet);

      if (folder === 'OOP') {
        // OOP folded: OOP lost postflop oopBet; IP wins entire pot net of ipBet = startingPot + oopBet
        for (let o = 0; o < oopLen; o++) {
          let oppReach = 0;
          for (let i = 0; i < ipLen; i++) {
            if (this.showdownMatrix[o][i] !== null) {
              oppReach += probIP[i];
            }
          }
          evOOP[o] = -oopBet * oppReach;
        }
        for (let i = 0; i < ipLen; i++) {
          let oppReach = 0;
          for (let o = 0; o < oopLen; o++) {
            if (this.showdownMatrix[o][i] !== null) {
              oppReach += probOOP[o];
            }
          }
          evIP[i] = (startingPot + oopBet) * oppReach;
        }
      } else {
        // IP folded: IP lost postflop ipBet; OOP wins entire pot net of oopBet = startingPot + ipBet
        for (let o = 0; o < oopLen; o++) {
          let oppReach = 0;
          for (let i = 0; i < ipLen; i++) {
            if (this.showdownMatrix[o][i] !== null) {
              oppReach += probIP[i];
            }
          }
          evOOP[o] = (startingPot + ipBet) * oppReach;
        }
        for (let i = 0; i < ipLen; i++) {
          let oppReach = 0;
          for (let o = 0; o < oopLen; o++) {
            if (this.showdownMatrix[o][i] !== null) {
              oppReach += probOOP[o];
            }
          }
          evIP[i] = -ipBet * oppReach;
        }
      }

      return { evOOP, evIP };
    }

    // Base Case 2: Showdown
    if (node.nodeType === 'showdown') {
      const oopLen = this.oopCombos.length;
      const ipLen = this.ipCombos.length;
      const evOOP = new Float64Array(oopLen);
      const evIP = new Float64Array(ipLen);

      const oopBet = node.playerBets.OOP;
      const ipBet = node.playerBets.IP;
      const rakePct = Math.max(0, Math.min(0.15, this.config.rakePct ?? 0));
      const rawRake = node.pot * rakePct;
      const rakeCap = this.config.rakeCapChips && this.config.rakeCapChips > 0 ? this.config.rakeCapChips : Infinity;
      const rake = Math.min(rakeCap, rawRake);
      const effectivePot = Math.max(0, node.pot - rake);

      for (let o = 0; o < oopLen; o++) {
        let evSum = 0;
        for (let i = 0; i < ipLen; i++) {
          const outcome = this.showdownMatrix[o][i];
          if (outcome === null) continue; // blocked cards
          const reach = probIP[i];
          const pOopWin = (outcome + 1) * 0.5;
          evSum += (pOopWin * effectivePot - oopBet) * reach;
        }
        evOOP[o] = evSum;
      }

      for (let i = 0; i < ipLen; i++) {
        let evSum = 0;
        for (let o = 0; o < oopLen; o++) {
          const outcome = this.showdownMatrix[o][i];
          if (outcome === null) continue;
          const reach = probOOP[o];
          const pIpWin = (1 - outcome) * 0.5;
          evSum += (pIpWin * effectivePot - ipBet) * reach;
        }
        evIP[i] = evSum;
      }

      return { evOOP, evIP };
    }

    // Action Node
    const actionNode = node as ActionNode;
    const player = actionNode.player;
    const numActions = actionNode.actions.length;
    const oopLen = this.oopCombos.length;
    const ipLen = this.ipCombos.length;

    const actionEVsOOP: Float64Array[] = [];
    const actionEVsIP: Float64Array[] = [];

    // Strategies at this node for current player's combos
    const currentCombosLen = player === 'OOP' ? oopLen : ipLen;
    const currentStrats: Float64Array[] = [];

    for (let c = 0; c < currentCombosLen; c++) {
      currentStrats.push(this.getStrategy(actionNode, player, c));
    }

    // Recurse on each action
    for (let a = 0; a < numActions; a++) {
      const action = actionNode.actions[a];
      const actKey = action.actionKey || action.type;
      const child = actionNode.children[actKey] || actionNode.children[action.type] || Object.values(actionNode.children)[a];
      if (!child) continue;

      // Update reach probabilities for child
      if (player === 'OOP') {
        const nextProbOOP = new Float64Array(oopLen);
        for (let o = 0; o < oopLen; o++) {
          nextProbOOP[o] = probOOP[o] * currentStrats[o][a];
        }
        const res = this.cfr(child, nextProbOOP, probIP, t);
        actionEVsOOP.push(res.evOOP);
        actionEVsIP.push(res.evIP);
      } else {
        const nextProbIP = new Float64Array(ipLen);
        for (let i = 0; i < ipLen; i++) {
          nextProbIP[i] = probIP[i] * currentStrats[i][a];
        }
        const res = this.cfr(child, probOOP, nextProbIP, t);
        actionEVsOOP.push(res.evOOP);
        actionEVsIP.push(res.evIP);
      }
    }

    // Compute expected value of node for both players
    const nodeEV_OOP = new Float64Array(oopLen);
    const nodeEV_IP = new Float64Array(ipLen);

    if (player === 'OOP') {
      for (let o = 0; o < oopLen; o++) {
        let sum = 0;
        for (let a = 0; a < actionEVsOOP.length; a++) {
          sum += currentStrats[o][a] * actionEVsOOP[a][o];
        }
        nodeEV_OOP[o] = sum;
      }
      // IP EV is the sum across actions weighted by OOP strategy
      for (let i = 0; i < ipLen; i++) {
        let sum = 0;
        for (let a = 0; a < actionEVsIP.length; a++) {
          sum += actionEVsIP[a][i];
        }
        nodeEV_IP[i] = sum;
      }
    } else {
      for (let i = 0; i < ipLen; i++) {
        let sum = 0;
        for (let a = 0; a < actionEVsIP.length; a++) {
          sum += currentStrats[i][a] * actionEVsIP[a][i];
        }
        nodeEV_IP[i] = sum;
      }
      for (let o = 0; o < oopLen; o++) {
        let sum = 0;
        for (let a = 0; a < actionEVsOOP.length; a++) {
          sum += actionEVsOOP[a][o];
        }
        nodeEV_OOP[o] = sum;
      }
    }

    // Update regrets and cumulative strategy for the acting player
    const myReach = player === 'OOP' ? probOOP : probIP;
    const myEVs = player === 'OOP' ? actionEVsOOP : actionEVsIP;
    const myNodeEV = player === 'OOP' ? nodeEV_OOP : nodeEV_IP;
    const isLockedNode = Boolean(this.config.nodeLocks?.[actionNode.id]);

    for (let c = 0; c < currentCombosLen; c++) {
      const key = `${actionNode.id}:${player}:${c}`;
      let r = this.regrets.get(key);
      if (!r) {
        r = new Float64Array(numActions);
        this.regrets.set(key, r);
      }
      let cum = this.cumStrategy.get(key);
      if (!cum) {
        cum = new Float64Array(numActions);
        this.cumStrategy.set(key, cum);
      }

      let evRecord = this.lastActionEVs.get(key);
      if (!evRecord) {
        evRecord = new Float64Array(numActions);
        this.lastActionEVs.set(key, evRecord);
      }

      // Update regrets (unless node is locked) and save action EVs
      for (let a = 0; a < numActions; a++) {
        const actionEV = myEVs[a] ? myEVs[a][c] : 0;
        evRecord[a] = actionEV;
        if (!isLockedNode) {
          const reg = actionEV - myNodeEV[c];
          if (this.config.algorithm === 'CFR_PLUS') {
            r[a] = Math.max(0, r[a] + reg);
          } else {
            r[a] += reg;
          }
        }

        // Cumulative strategy weighted by reach
        cum[a] += myReach[c] * currentStrats[c][a];
      }
    }

    return { evOOP: nodeEV_OOP, evIP: nodeEV_IP };
  }

  /**
   * Run solver for specified iterations
   */
  public solve(
    totalIterations: number = this.config.iterations,
    onProgress?: (iter: number, total: number) => void
  ): SolveResult {
    const startTime = performance.now();
    const oopLen = this.oopCombos.length;
    const ipLen = this.ipCombos.length;

    // Initial reach probabilities based on preflop weights
    let oopSum = 0;
    for (const c of this.oopCombos) oopSum += c.weight;
    let ipSum = 0;
    for (const c of this.ipCombos) ipSum += c.weight;

    const initialProbOOP = new Float64Array(oopLen);
    for (let o = 0; o < oopLen; o++) {
      initialProbOOP[o] = oopSum > 0 ? this.oopCombos[o].weight / oopSum : 1 / oopLen;
    }

    const initialProbIP = new Float64Array(ipLen);
    for (let i = 0; i < ipLen; i++) {
      initialProbIP[i] = ipSum > 0 ? this.ipCombos[i].weight / ipSum : 1 / ipLen;
    }

    let lastRootResult: { evOOP: Float64Array; evIP: Float64Array } | null = null;
    for (let t = 1; t <= totalIterations; t++) {
      this.applyDiscounts(t);
      lastRootResult = this.cfr(this.treeRoot, initialProbOOP, initialProbIP, t);

      if (onProgress && (t % 25 === 0 || t === totalIterations)) {
        onProgress(t, totalIterations);
      }
    }

    const elapsedMs = performance.now() - startTime;

    // Extract average strategies
    const nodeStrategies = this.extractStrategies();

    // Reach-weighted overall root EVs for OOP (P1) and IP (P2)
    let p1EV = 0;
    let p2EV = 0;
    if (lastRootResult) {
      let oopEvWeighted = 0;
      let oopWeightTotal = 0;
      for (let o = 0; o < oopLen; o++) {
        oopEvWeighted += initialProbOOP[o] * lastRootResult.evOOP[o];
        oopWeightTotal += initialProbOOP[o];
      }
      let ipEvWeighted = 0;
      let ipWeightTotal = 0;
      for (let i = 0; i < ipLen; i++) {
        ipEvWeighted += initialProbIP[i] * lastRootResult.evIP[i];
        ipWeightTotal += initialProbIP[i];
      }
      if (oopWeightTotal > 0) p1EV = Math.round((oopEvWeighted / oopWeightTotal) * 100) / 100;
      if (ipWeightTotal > 0) p2EV = Math.round((ipEvWeighted / ipWeightTotal) * 100) / 100;
    }

    // Approximate exploitability calculation
    let maxExploit = 0;
    let countedNodes = 0;
    for (const r of this.regrets.values()) {
      let nodeMax = 0;
      for (let a = 0; a < r.length; a++) {
        if (r[a] > nodeMax) nodeMax = r[a];
      }
      maxExploit += nodeMax;
      countedNodes++;
    }
    const averageExploitability = countedNodes > 0 ? (maxExploit / countedNodes) / totalIterations : 0;

    return {
      iterationsRun: totalIterations,
      elapsedMs,
      averageExploitability: Math.max(0, Math.round(averageExploitability * 1000) / 1000),
      nodeStrategies,
      p1EV,
      p2EV
    };
  }

  private extractStrategies(): Map<string, NodeStrategyResult> {
    const results = new Map<string, NodeStrategyResult>();

    const traverse = (node: GameNode) => {
      if (node.nodeType !== 'action') return;
      const actionNode = node as ActionNode;
      const player = actionNode.player;
      const actions = actionNode.actions.map(a => a.actionKey || a.type);
      const actionLabels: Record<string, string> = {};
      actionNode.actions.forEach(a => {
        const key = a.actionKey || a.type;
        actionLabels[key] = a.label;
      });

      const combos = player === 'OOP' ? this.oopCombos : this.ipCombos;
      const comboStrategy: Record<string, Record<string, number>> = {};
      const canonicalGroups: Record<string, { sum: Float64Array; count: number }> = {};
      const overallSum = new Float64Array(actions.length);
      let totalCombosWeight = 0;

      for (let c = 0; c < combos.length; c++) {
        const item = combos[c];
        const key = `${actionNode.id}:${player}:${c}`;
        const cum = this.cumStrategy.get(key);
        const comboKey = item.combo.key;
        const canonical = item.combo.canonicalName;

        const strat: Record<string, number> = {};
        let cumSum = 0;
        if (cum) {
          for (let a = 0; a < cum.length; a++) cumSum += cum[a];
        }

        if (!canonicalGroups[canonical]) {
          canonicalGroups[canonical] = {
            sum: new Float64Array(actions.length),
            count: 0
          };
        }

        for (let a = 0; a < actions.length; a++) {
          const freq = cum && cumSum > 1e-12 ? cum[a] / cumSum : 1 / actions.length;
          strat[actions[a]] = Math.round(freq * 1000) / 1000;
          canonicalGroups[canonical].sum[a] += freq;
          overallSum[a] += freq * item.weight;
        }

        canonicalGroups[canonical].count += 1;
        totalCombosWeight += item.weight;
        comboStrategy[comboKey] = strat;
      }

      // Canonical strategy
      const canonicalStrategy: Record<string, Record<string, number>> = {};
      for (const [canon, data] of Object.entries(canonicalGroups)) {
        canonicalStrategy[canon] = {};
        for (let a = 0; a < actions.length; a++) {
          const avg = data.count > 0 ? data.sum[a] / data.count : 0;
          canonicalStrategy[canon][actions[a]] = Math.round(avg * 1000) / 1000;
        }
      }

      // Overall strategy
      const overallStrategy: Record<string, number> = {};
      for (let a = 0; a < actions.length; a++) {
        const val = totalCombosWeight > 0 ? overallSum[a] / totalCombosWeight : 1 / actions.length;
        overallStrategy[actions[a]] = Math.round(val * 1000) / 1000;
      }

      // Compute Action EVs per combo, canonical hand, and overall range
      const comboActionEVs: Record<string, Record<string, number>> = {};
      const canonicalEvGroups: Record<string, { sum: Float64Array; count: number }> = {};
      const overallEvSum = new Float64Array(actions.length);
      const comboEV: Record<string, number> = {};

      for (let c = 0; c < combos.length; c++) {
        const item = combos[c];
        const key = `${actionNode.id}:${player}:${c}`;
        const evRec = this.lastActionEVs.get(key);
        const comboKey = item.combo.key;
        const canonical = item.combo.canonicalName;

        if (!canonicalEvGroups[canonical]) {
          canonicalEvGroups[canonical] = {
            sum: new Float64Array(actions.length),
            count: 0
          };
        }

        comboActionEVs[comboKey] = {};
        let weightedComboEV = 0;
        for (let a = 0; a < actions.length; a++) {
          const evVal = evRec ? evRec[a] : 0;
          const roundedEV = Math.round(evVal * 100) / 100;
          comboActionEVs[comboKey][actions[a]] = roundedEV;
          canonicalEvGroups[canonical].sum[a] += evVal;
          overallEvSum[a] += evVal * item.weight;
          const stratFreq = comboStrategy[comboKey]?.[actions[a]] ?? 0;
          weightedComboEV += stratFreq * evVal;
        }
        canonicalEvGroups[canonical].count += 1;
        comboEV[comboKey] = Math.round(weightedComboEV * 100) / 100;
      }

      // Canonical Action EVs
      const canonicalActionEVs: Record<string, Record<string, number>> = {};
      for (const [canon, data] of Object.entries(canonicalEvGroups)) {
        canonicalActionEVs[canon] = {};
        for (let a = 0; a < actions.length; a++) {
          const avg = data.count > 0 ? data.sum[a] / data.count : 0;
          canonicalActionEVs[canon][actions[a]] = Math.round(avg * 100) / 100;
        }
      }

      // Overall Action EVs
      const overallActionEVs: Record<string, number> = {};
      for (let a = 0; a < actions.length; a++) {
        const val = totalCombosWeight > 0 ? overallEvSum[a] / totalCombosWeight : 0;
        overallActionEVs[actions[a]] = Math.round(val * 100) / 100;
      }

      // Compute max and average regret for this node normalized per iteration
      const iters = Math.max(1, this.config.iterations);
      let maxPositiveRegret = 0;
      let sumPositiveRegret = 0;
      let regretCount = 0;

      for (let c = 0; c < combos.length; c++) {
        const key = `${actionNode.id}:${player}:${c}`;
        const r = this.regrets.get(key);
        if (r) {
          for (let a = 0; a < actions.length; a++) {
            const regVal = r[a];
            if (regVal > maxPositiveRegret) maxPositiveRegret = regVal;
            if (regVal > 0) {
              sumPositiveRegret += regVal;
              regretCount++;
            }
          }
        }
      }

      const maxRegret = Math.round((maxPositiveRegret / iters) * 100) / 100;
      const avgRegret = regretCount > 0 ? Math.round((sumPositiveRegret / (regretCount * iters)) * 100) / 100 : 0;

      // True Information-Set Local Exploitability at this node:
      // Weighted average across active combos of: max_a EV(combo, a) - EV(combo, strategy)
      let totalComboIncentive = 0;
      let totalComboWeight = 0;

      for (let c = 0; c < combos.length; c++) {
        const item = combos[c];
        const comboKey = item.combo.key;
        const cEVs = comboActionEVs[comboKey];
        const actualEV = comboEV[comboKey] ?? 0;

        if (cEVs) {
          let maxEvForCombo = -Infinity;
          for (let a = 0; a < actions.length; a++) {
            const ev = cEVs[actions[a]];
            if (ev !== undefined && ev > maxEvForCombo) {
              maxEvForCombo = ev;
            }
          }
          if (maxEvForCombo > -Infinity) {
            const incentive = Math.max(0, maxEvForCombo - actualEV);
            totalComboIncentive += incentive * item.weight;
            totalComboWeight += item.weight;
          }
        }
      }

      const localExploitability = totalComboWeight > 0
        ? Math.max(0, Math.round((totalComboIncentive / totalComboWeight) * 100) / 100)
        : 0;

      results.set(actionNode.id, {
        nodeId: actionNode.id,
        player,
        actions,
        actionLabels,
        overallStrategy,
        comboStrategy,
        canonicalStrategy,
        comboEV,
        comboActionEVs,
        canonicalActionEVs,
        overallActionEVs,
        maxRegret,
        avgRegret,
        localExploitability
      });

      for (const child of Object.values(actionNode.children)) {
        traverse(child);
      }
    };

    traverse(this.treeRoot);
    return results;
  }
}

export type NodeLockPresetId = 'overfold_cbet' | 'never_bluff_river' | 'calling_station';

export const NODE_LOCK_PRESETS: Array<{
  id: NodeLockPresetId;
  label: string;
  description: string;
}> = [
  {
    id: 'overfold_cbet',
    label: 'Villano Over-foldea a C-Bet',
    description: 'Bloquea FOLD al 72% y CALL al 24% al enfrentar apuestas para explotar con faroles baratos.'
  },
  {
    id: 'never_bluff_river',
    label: 'Villano Nunca Farolea (Pasivo)',
    description: 'Bloquea CHECK al 85% y apuestas pequeñas al 15% en nodos sin apuesta previa (solo valor claro).'
  },
  {
    id: 'calling_station',
    label: 'Calling Station (No Foldea)',
    description: 'Bloquea FOLD al 12% y CALL al 82%: el Solver elimina faroles y apuesta gigante por puro valor.'
  }
];

export function buildArchetypeNodeLocks(
  root: ActionNode,
  preset: NodeLockPresetId
): Record<string, Record<string, number>> {
  const locks: Record<string, Record<string, number>> = {};

  const walk = (node: GameNode) => {
    if (node.nodeType !== 'action') return;
    const actionNode = node as ActionNode;
    const keys = actionNode.actions.map(a => a.actionKey || a.type);

    if (preset === 'overfold_cbet' && keys.includes('FOLD') && keys.includes('CALL')) {
      const m: Record<string, number> = {};
      const raiseKeys = keys.filter(k => k !== 'FOLD' && k !== 'CALL');
      m['FOLD'] = 0.72;
      m['CALL'] = 0.24;
      const rem = raiseKeys.length > 0 ? 0.04 / raiseKeys.length : 0;
      raiseKeys.forEach(k => {
        m[k] = Math.round(rem * 1000) / 1000;
      });
      locks[actionNode.id] = m;
    } else if (preset === 'calling_station' && keys.includes('FOLD') && keys.includes('CALL')) {
      const m: Record<string, number> = {};
      const raiseKeys = keys.filter(k => k !== 'FOLD' && k !== 'CALL');
      m['FOLD'] = 0.12;
      m['CALL'] = 0.82;
      const rem = raiseKeys.length > 0 ? 0.06 / raiseKeys.length : 0;
      raiseKeys.forEach(k => {
        m[k] = Math.round(rem * 1000) / 1000;
      });
      locks[actionNode.id] = m;
    } else if (
      preset === 'never_bluff_river' &&
      keys.includes('CHECK') &&
      keys.length > 1 &&
      (actionNode.street === 'river' || actionNode.street === 'turn' || actionNode.id !== 'root')
    ) {
      const betKeys = keys.filter(k => k !== 'CHECK');
      const m: Record<string, number> = { CHECK: 0.85 };
      const betShare = betKeys.length > 0 ? 0.15 / betKeys.length : 0;
      betKeys.forEach(k => {
        m[k] = Math.round(betShare * 1000) / 1000;
      });
      locks[actionNode.id] = m;
    }

    for (const child of Object.values(actionNode.children)) {
      walk(child);
    }
  };

  walk(root);
  return locks;
}

