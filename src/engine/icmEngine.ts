/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * icmEngine.ts: Motor ICM Recursivo Malmuth-Harville (Independent Chip Model)
 * para torneos SNG / MTT / Mesas Finales 6-Max y análisis de Factor Burbuja.
 */

export interface IcmPlayerResult {
  playerIndex: number;
  name: string;
  chips: number;
  chipSharePct: number;
  icmEquity: number;
  equityPctOfPool: number;
  chipEvValue: number;
  icmDiff: number;
  finishProbs: number[]; // Probabilidad [0..1] de terminar 1º, 2º, ..., Kº en estructura de premios
}

export interface IcmSimulationResult {
  totalChips: number;
  totalPrizePool: number;
  players: IcmPlayerResult[];
  bubbleFactorMatrix: number[][]; // Factor de Burbuja [caller][shover] aproximado para presión directa
}

export interface IcmPreset {
  id: string;
  label: string;
  description: string;
  stacks: number[];
  payouts: number[];
  names: string[];
}

export const ICM_PRESETS: IcmPreset[] = [
  {
    id: 'ft-6max',
    label: 'Mesa Final 6-Max (Top 3)',
    description: 'Estructura estándar 50% / 30% / 20% con 6 jugadores activos.',
    stacks: [4200, 3100, 2200, 1400, 750, 350],
    payouts: [500, 300, 200],
    names: ['Chipleader (BTN)', 'Segundo (CO)', 'Medio (MP)', 'Corto (UTG)', 'Peligro (SB)', 'Short (BB)']
  },
  {
    id: 'bubble-4max',
    label: 'Burbuja Pura (4 Left · Top 3)',
    description: 'Tensión máxima en burbuja directa donde el 4º lugar cobra 0.',
    stacks: [5200, 3400, 2100, 1300],
    payouts: [500, 300, 200],
    names: ['BTN Big Stack', 'CO Medium', 'SB Danger', 'BB Short']
  },
  {
    id: 'sng-hu',
    label: 'Heads-Up Final (2 Left)',
    description: 'Cálculo ICM analítico exacto para mano a mano por el título.',
    stacks: [7500, 4500],
    payouts: [650, 350],
    names: ['Hero (BTN/SB)', 'Villano (BB)']
  }
];

/**
 * Calcula recursivamente la probabilidad Malmuth-Harville de que cada jugador
 * termine en cada puesto premiado [0..payouts.length-1].
 * Complejidad: O(N! / (N-K)!) — acotada de forma segura hasta 9 jugadores y 4 premios.
 */
export function computeICM(
  rawStacks: number[],
  rawPayouts: number[],
  names?: string[]
): IcmSimulationResult {
  const stacks = rawStacks.map(s => Math.max(0, Number.isFinite(s) ? s : 0)).slice(0, 9);
  const payouts = rawPayouts.map(p => Math.max(0, Number.isFinite(p) ? p : 0)).slice(0, stacks.length);

  const n = stacks.length;
  const kMax = Math.min(n, payouts.length);
  const totalChips = stacks.reduce((a, b) => a + b, 0);
  const totalPrizePool = payouts.reduce((a, b) => a + b, 0);

  const finishProbs: number[][] = Array.from({ length: n }, () => new Array(kMax).fill(0));

  if (totalChips <= 0 || n === 0) {
    return {
      totalChips: 0,
      totalPrizePool,
      players: stacks.map((chips, idx) => ({
        playerIndex: idx,
        name: names?.[idx] || `Jugador ${idx + 1}`,
        chips,
        chipSharePct: 0,
        icmEquity: 0,
        equityPctOfPool: 0,
        chipEvValue: 0,
        icmDiff: 0,
        finishProbs: []
      })),
      bubbleFactorMatrix: []
    };
  }

  // Recursion cache keyed by bitmask of remaining active players
  const activeMaskAll = (1 << n) - 1;
  const memo = new Map<number, number[][]>(); // mask -> [localPlayer? no, N x remainingPlaces]

  function solveSubtree(mask: number, remainingChips: number, placeIdx: number): number[][] {
    if (placeIdx >= kMax || remainingChips <= 0) {
      return Array.from({ length: n }, () => []);
    }

    const cacheKey = mask * 16 + placeIdx;
    const cached = memo.get(cacheKey);
    if (cached) return cached;

    const remPlaces = kMax - placeIdx;
    const probs: number[][] = Array.from({ length: n }, () => new Array(remPlaces).fill(0));

    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) === 0 || stacks[i] <= 0) continue;
      const pFirst = stacks[i] / remainingChips;
      probs[i][0] += pFirst;

      if (remPlaces > 1) {
        const nextMask = mask ^ (1 << i);
        const sub = solveSubtree(nextMask, remainingChips - stacks[i], placeIdx + 1);
        for (let j = 0; j < n; j++) {
          if ((nextMask & (1 << j)) === 0) continue;
          for (let r = 1; r < remPlaces; r++) {
            probs[j][r] += pFirst * sub[j][r - 1];
          }
        }
      }
    }

    memo.set(cacheKey, probs);
    return probs;
  }

  const rootProbs = solveSubtree(activeMaskAll, totalChips, 0);

  const players: IcmPlayerResult[] = stacks.map((chips, idx) => {
    const pArr = rootProbs[idx] || new Array(kMax).fill(0);
    for (let p = 0; p < kMax; p++) {
      finishProbs[idx][p] = pArr[p] || 0;
    }
    let icmEquity = 0;
    for (let p = 0; p < kMax; p++) {
      icmEquity += finishProbs[idx][p] * payouts[p];
    }
    const chipShare = chips / totalChips;
    const chipEvValue = chipShare * totalPrizePool;

    return {
      playerIndex: idx,
      name: names?.[idx] || `Jugador ${idx + 1}`,
      chips,
      chipSharePct: Math.round(chipShare * 10000) / 100,
      icmEquity: Math.round(icmEquity * 100) / 100,
      equityPctOfPool: totalPrizePool > 0 ? Math.round((icmEquity / totalPrizePool) * 10000) / 100 : 0,
      chipEvValue: Math.round(chipEvValue * 100) / 100,
      icmDiff: Math.round((icmEquity - chipEvValue) * 100) / 100,
      finishProbs: finishProbs[idx]
    };
  });

  // Compute approximate Bubble Factors: Risk / Reward ratio for effective all-in clash i vs j
  const bubbleFactorMatrix: number[][] = Array.from({ length: n }, () => new Array(n).fill(1));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || stacks[i] <= 0 || stacks[j] <= 0) {
        bubbleFactorMatrix[i][j] = 1;
        continue;
      }
      const eff = Math.min(stacks[i], stacks[j]);
      const winStacks = [...stacks];
      winStacks[i] += eff;
      winStacks[j] -= eff;
      const loseStacks = [...stacks];
      loseStacks[i] -= eff;
      loseStacks[j] += eff;

      const eqNow = players[i].icmEquity;
      const eqWin = computeSingleEquityFast(winStacks, payouts, i);
      const eqLose = computeSingleEquityFast(loseStacks, payouts, i);
      const gain = Math.max(0.0001, eqWin - eqNow);
      const risk = Math.max(0, eqNow - eqLose);
      bubbleFactorMatrix[i][j] = Math.round((risk / gain) * 100) / 100;
    }
  }

  return {
    totalChips,
    totalPrizePool,
    players,
    bubbleFactorMatrix
  };
}

function computeSingleEquityFast(stacks: number[], payouts: number[], targetIdx: number): number {
  const n = stacks.length;
  const kMax = Math.min(n, payouts.length);
  const totalChips = stacks.reduce((a, b) => a + b, 0);
  if (totalChips <= 0 || stacks[targetIdx] <= 0) return 0;

  const memo = new Map<number, number[]>();
  function helper(mask: number, remChips: number, placeIdx: number): number {
    if (placeIdx >= kMax || remChips <= 0) return 0;
    const key = mask * 16 + placeIdx;
    const prev = memo.get(key);
    if (prev !== undefined) return prev[0];

    let eq = 0;
    for (let i = 0; i < n; i++) {
      if ((mask & (1 << i)) === 0 || stacks[i] <= 0) continue;
      const p = stacks[i] / remChips;
      if (i === targetIdx) {
        eq += p * payouts[placeIdx];
      } else {
        eq += p * helper(mask ^ (1 << i), remChips - stacks[i], placeIdx + 1);
      }
    }
    memo.set(key, [eq]);
    return eq;
  }

  return helper((1 << n) - 1, totalChips, 0);
}
