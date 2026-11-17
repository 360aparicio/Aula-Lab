/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Poker Decision Tree Builder & Legal Action Validator.
 */

export type PlayerRole = 'OOP' | 'IP';

export function getOtherPlayer(player: PlayerRole): PlayerRole {
  return player === 'OOP' ? 'IP' : 'OOP';
}

export type ActionType = 'CHECK' | 'BET' | 'CALL' | 'FOLD' | 'RAISE' | 'ALLIN';

export interface Action {
  type: ActionType;
  actionKey: string; // Unique key in children: e.g. 'CHECK', 'BET_33', 'BET_75', 'ALLIN', 'FOLD', 'CALL', 'RAISE_25'
  amount: number; // total chips committed by this player in this betting round
  addedAmount: number; // additional chips needed to make this action
  label: string;
}

export type GameNodeType = 'action' | 'showdown' | 'fold';

export interface BaseNode {
  id: string;
  nodeType: GameNodeType;
  pot: number;
  playerBets: Record<PlayerRole, number>;
  stacks: Record<PlayerRole, number>;
  street: 'flop' | 'turn' | 'river';
  history: string[]; // sequence of action keys e.g. ["check", "bet_50", "call"]
}

export interface ActionNode extends BaseNode {
  nodeType: 'action';
  player: PlayerRole;
  actions: Action[];
  children: Record<string, GameNode>;
}

export interface TerminalFoldNode extends BaseNode {
  nodeType: 'fold';
  folder: PlayerRole;
  winner: PlayerRole;
}

export interface TerminalShowdownNode extends BaseNode {
  nodeType: 'showdown';
}

export type GameNode = ActionNode | TerminalFoldNode | TerminalShowdownNode;

export interface TreeConfig {
  startingPot: number;
  effectiveStack: number;
  betSizes: number[]; // e.g. [0.33, 0.75] fraction of current pot
  raiseSizes: number[]; // e.g. [2.5] multiplier
  allowAllIn: boolean;
  maxRaises: number; // per street
  street: 'flop' | 'turn' | 'river';
  multiStreetMode?: boolean; // when true on flop/turn, chains CALL / IP CHECK into next street(s)
}

export const DEFAULT_TREE_CONFIG: TreeConfig = {
  startingPot: 100,
  effectiveStack: 100,
  betSizes: [0.33, 0.75],
  raiseSizes: [2.5],
  allowAllIn: true,
  maxRaises: 2,
  street: 'river',
  multiStreetMode: false
};

function getNextStreet(s: 'flop' | 'turn' | 'river'): 'turn' | 'river' | null {
  if (s === 'flop') return 'turn';
  if (s === 'turn') return 'river';
  return null;
}

/**
 * Builds an explicit game tree for Heads-Up Postflop play according to TreeConfig.
 */
export function buildGameTree(config: TreeConfig = DEFAULT_TREE_CONFIG): ActionNode {
  let nodeCount = 0;
  const MAX_MULTI_STREET_NODES = 260;
  const enableMultiStreet = Boolean(config.multiStreetMode && config.street !== 'river');

  function buildNode(
    id: string,
    player: PlayerRole,
    pot: number,
    bets: Record<PlayerRole, number>,
    stacks: Record<PlayerRole, number>,
    numRaises: number,
    history: string[],
    nodeStreet: 'flop' | 'turn' | 'river'
  ): GameNode {
    nodeCount++;
    const opponent = getOtherPlayer(player);
    const facingBet = bets[opponent] - bets[player];
    const isDownstreamStreet = nodeStreet !== config.street;
    const effectiveBetSizes = isDownstreamStreet
      ? [config.betSizes[nodeStreet === 'river' ? config.betSizes.length - 1 : 0] ?? 0.66]
      : config.betSizes;
    const effectiveMaxRaises = isDownstreamStreet ? Math.min(2, config.maxRaises) : config.maxRaises;

    const makeRoundEndNode = (
      endPrefixId: string,
      endPot: number,
      endBets: Record<PlayerRole, number>,
      endStacks: Record<PlayerRole, number>,
      endHistory: string[]
    ): GameNode => {
      const nextSt = enableMultiStreet ? getNextStreet(nodeStreet) : null;
      if (
        nextSt &&
        endStacks.OOP > 0 &&
        endStacks.IP > 0 &&
        nodeCount < MAX_MULTI_STREET_NODES
      ) {
        return buildNode(
          `${endPrefixId}_${nextSt}`,
          'OOP',
          endPot,
          { ...endBets },
          { ...endStacks },
          0,
          [...endHistory, `calle_${nextSt}`],
          nextSt
        );
      }

      return {
        id: `${endPrefixId}_showdown`,
        nodeType: 'showdown',
        pot: endPot,
        playerBets: { ...endBets },
        stacks: { ...endStacks },
        street: nodeStreet,
        history: endHistory
      };
    };

    // Case 1: Facing NO bet (facingBet === 0) -> legal actions: CHECK, BET (various sizes), ALL-IN
    if (facingBet === 0) {
      const actions: Action[] = [];
      const children: Record<string, GameNode> = {};

      // Action: Check
      actions.push({
        type: 'CHECK',
        actionKey: 'CHECK',
        amount: bets[player],
        addedAmount: 0,
        label: 'Check'
      });

      // If player is IP and checks, betting round ends -> next street (if multiStreetMode) or Showdown!
      if (player === 'IP') {
        children['CHECK'] = makeRoundEndNode(
          `${id}_check`,
          pot,
          bets,
          stacks,
          [...history, 'check']
        );
      } else {
        // OOP checks -> pass to IP
        children['CHECK'] = buildNode(
          `${id}_check`,
          'IP',
          pot,
          { ...bets },
          { ...stacks },
          0,
          [...history, 'check'],
          nodeStreet
        );
      }

      // Bets if stacks allow
      const availableStack = stacks[player];
      if (availableStack > 0 && numRaises < effectiveMaxRaises) {
        for (const frac of effectiveBetSizes) {
          const rawBet = Math.round(pot * frac);
          if (rawBet > 0 && rawBet < availableStack) {
            const actionKey = `BET_${Math.round(frac * 100)}`;
            const label = `Bet ${Math.round(frac * 100)}% (${rawBet})`;
            actions.push({
              type: 'BET',
              actionKey,
              amount: bets[player] + rawBet,
              addedAmount: rawBet,
              label
            });

            const newBets = { ...bets, [player]: bets[player] + rawBet };
            const newStacks = { ...stacks, [player]: stacks[player] - rawBet };
            children[actionKey] = buildNode(
              `${id}_${actionKey.toLowerCase()}`,
              opponent,
              pot + rawBet,
              newBets,
              newStacks,
              numRaises + 1,
              [...history, actionKey],
              nodeStreet
            );
          }
        }

        // All-in
        if (config.allowAllIn && availableStack > 0) {
          const actionKey = 'ALLIN';
          actions.push({
            type: 'ALLIN',
            actionKey: 'ALLIN',
            amount: bets[player] + availableStack,
            addedAmount: availableStack,
            label: `All-in (${availableStack})`
          });
          const newBets = { ...bets, [player]: bets[player] + availableStack };
          const newStacks = { ...stacks, [player]: 0 };
          children[actionKey] = buildNode(
            `${id}_allin`,
            opponent,
            pot + availableStack,
            newBets,
            newStacks,
            numRaises + 1,
            [...history, 'allin'],
            nodeStreet
          );
        }
      }

      return {
        id,
        nodeType: 'action',
        player,
        pot,
        playerBets: { ...bets },
        stacks: { ...stacks },
        street: nodeStreet,
        history,
        actions,
        children
      };
    }

    // Case 2: Facing a bet (facingBet > 0) -> legal actions: FOLD, CALL, RAISE (if allowed and stack remains)
    const actions: Action[] = [];
    const children: Record<string, GameNode> = {};

    // Action: Fold
    actions.push({
      type: 'FOLD',
      actionKey: 'FOLD',
      amount: bets[player],
      addedAmount: 0,
      label: 'Fold'
    });
    children['FOLD'] = {
      id: `${id}_fold`,
      nodeType: 'fold',
      folder: player,
      winner: opponent,
      pot,
      playerBets: { ...bets },
      stacks: { ...stacks },
      street: nodeStreet,
      history: [...history, 'fold']
    };

    // Action: Call
    const callAmount = Math.min(facingBet, stacks[player]);
    const isCallAllIn = callAmount >= stacks[player] || stacks[opponent] === 0;
    actions.push({
      type: 'CALL',
      actionKey: 'CALL',
      amount: bets[player] + callAmount,
      addedAmount: callAmount,
      label: `Call (${callAmount})`
    });

    const afterCallBets = { ...bets, [player]: bets[player] + callAmount };
    const afterCallStacks = { ...stacks, [player]: stacks[player] - callAmount };
    const afterCallPot = pot + callAmount;

    // After Call, betting round ends -> next street (if multiStreetMode & stacks remain) or Showdown
    children['CALL'] = makeRoundEndNode(
      `${id}_call`,
      afterCallPot,
      afterCallBets,
      afterCallStacks,
      [...history, 'call']
    );

    // Action: Raise (if not all-in, stack permits, and raises < effectiveMaxRaises)
    const remainingStack = stacks[player] - callAmount;
    if (remainingStack > 0 && !isCallAllIn && numRaises < effectiveMaxRaises) {
      for (const mul of config.raiseSizes) {
        const raiseAdded = Math.round(facingBet * mul);
        const totalAdded = callAmount + raiseAdded;
        if (totalAdded < stacks[player]) {
          const actionKey = `RAISE_${Math.round(mul * 10)}`;
          const label = `Raise ${mul}x (${totalAdded})`;
          actions.push({
            type: 'RAISE',
            actionKey,
            amount: bets[player] + totalAdded,
            addedAmount: totalAdded,
            label
          });
          const newBets = { ...bets, [player]: bets[player] + totalAdded };
          const newStacks = { ...stacks, [player]: stacks[player] - totalAdded };
          children[actionKey] = buildNode(
            `${id}_${actionKey.toLowerCase()}`,
            opponent,
            pot + totalAdded,
            newBets,
            newStacks,
            numRaises + 1,
            [...history, actionKey],
            nodeStreet
          );
        }
      }

      // Raise All-in
      if (config.allowAllIn && stacks[player] > callAmount) {
        const allInTotal = stacks[player];
        actions.push({
          type: 'ALLIN',
          actionKey: 'ALLIN',
          amount: bets[player] + allInTotal,
          addedAmount: allInTotal,
          label: `All-in (${allInTotal})`
        });
        const newBets = { ...bets, [player]: bets[player] + allInTotal };
        const newStacks = { ...stacks, [player]: 0 };
        children['ALLIN'] = buildNode(
          `${id}_allin`,
          opponent,
          pot + allInTotal,
          newBets,
          newStacks,
          numRaises + 1,
          [...history, 'allin'],
          nodeStreet
        );
      }
    }

    return {
      id,
      nodeType: 'action',
      player,
      pot,
      playerBets: { ...bets },
      stacks: { ...stacks },
      street: nodeStreet,
      history,
      actions,
      children
    };
  }

  const root = buildNode(
    'root',
    'OOP', // OOP acts first postflop
    config.startingPot,
    { OOP: 0, IP: 0 },
    { OOP: config.effectiveStack, IP: config.effectiveStack },
    0,
    [],
    config.street
  );

  return root as ActionNode;
}

/**
 * Traverse all action nodes in a game tree.
 */
export function getAllActionNodes(root: ActionNode): ActionNode[] {
  const result: ActionNode[] = [];
  function traverse(node: GameNode) {
    if (node.nodeType === 'action') {
      result.push(node);
      for (const child of Object.values(node.children)) {
        traverse(child);
      }
    }
  }
  traverse(root);
  return result;
}
