/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Solver Runner: manages asynchronous non-blocking solving, progress reporting,
 * pausing, resuming, and cancellation.
 */

import { type Card } from './cards';
import { DCFRConfig, DCFRSolver, DEFAULT_DCFR_CONFIG, SolveResult } from './dcfr';
import { ActionNode } from './gameTree';
import { ConcreteHandWithWeight } from './range';

export type SolverStatus = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled' | 'error';

export interface SolverProgress {
  currentIteration: number;
  totalIterations: number;
  percent: number;
  elapsedMs: number;
  status: SolverStatus;
  exploitability: number;
  fromCache?: boolean;
}

export interface CachedSolveResult extends SolveResult {
  fromCache?: boolean;
}

export const MAX_SOLVER_CACHE_ENTRIES = 64;

export class SolverLRUCache {
  private readonly capacity: number;
  private readonly map = new Map<string, CachedSolveResult>();

  constructor(capacity = MAX_SOLVER_CACHE_ENTRIES) {
    this.capacity = Math.max(1, capacity);
  }

  public get(key: string): CachedSolveResult | undefined {
    const found = this.map.get(key);
    if (!found) return undefined;
    // Refresh recency (LRU)
    this.map.delete(key);
    this.map.set(key, found);
    return found;
  }

  public set(key: string, value: CachedSolveResult): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey !== undefined) {
        this.map.delete(oldestKey);
      }
    }
    this.map.set(key, { ...value, fromCache: true });
  }

  public size(): number {
    return this.map.size;
  }

  public clear(): void {
    this.map.clear();
  }
}

export const globalSolverCache = new SolverLRUCache(MAX_SOLVER_CACHE_ENTRIES);

function summarizeTreeStructure(node: ActionNode): string {
  const parts: string[] = [`${node.id}:${node.street}:${node.pot}:${node.actions.length}`];
  for (const act of node.actions) {
    const child = node.children?.[act.actionKey];
    if (child && child.nodeType === 'action') {
      parts.push(summarizeTreeStructure(child));
    }
  }
  return parts.join('|');
}

export function buildSolveCacheKey(
  treeRoot: ActionNode,
  board: Card[],
  oopCombos: ConcreteHandWithWeight[],
  ipCombos: ConcreteHandWithWeight[],
  config: Partial<DCFRConfig>
): string {
  const merged = { ...DEFAULT_DCFR_CONFIG, ...config };
  const boardSig = board.map(c => c.id).join(',');
  const oopSig = oopCombos
    .map(c => `${c.combo.card1.id}-${c.combo.card2.id}:${Math.round(c.weight * 100)}`)
    .join(',');
  const ipSig = ipCombos
    .map(c => `${c.combo.card1.id}-${c.combo.card2.id}:${Math.round(c.weight * 100)}`)
    .join(',');
  const locksSig = JSON.stringify(merged.nodeLocks || {});
  const treeSig = summarizeTreeStructure(treeRoot);
  return [
    merged.algorithm,
    merged.iterations,
    merged.rakePct ?? 0,
    merged.rakeCapChips ?? 0,
    merged.simulateFutureStreets ?? true,
    boardSig,
    oopSig,
    ipSig,
    locksSig,
    treeSig
  ].join('||');
}

export class AsyncSolverRunner {
  private solver: DCFRSolver | null = null;
  private cacheKey: string | null = null;
  private status: SolverStatus = 'idle';
  private currentIteration = 0;
  private totalIterations = 300;
  private startTime = 0;
  private totalElapsedMs = 0;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private chunkSize = 25; // iterations per asynchronous slice
  private onProgressCb?: (progress: SolverProgress) => void;
  private onCompleteCb?: (result: CachedSolveResult) => void;
  private onErrorCb?: (error: Error) => void;

  public init(
    treeRoot: ActionNode,
    board: Card[],
    oopCombos: ConcreteHandWithWeight[],
    ipCombos: ConcreteHandWithWeight[],
    config: Partial<DCFRConfig> = {}
  ) {
    this.totalIterations = config.iterations || DEFAULT_DCFR_CONFIG.iterations;
    this.currentIteration = 0;
    this.totalElapsedMs = 0;
    this.status = 'idle';
    this.cacheKey = buildSolveCacheKey(treeRoot, board, oopCombos, ipCombos, config);
    this.solver = new DCFRSolver(treeRoot, board, oopCombos, ipCombos, config);
  }

  public setCallbacks(callbacks: {
    onProgress?: (progress: SolverProgress) => void;
    onComplete?: (result: CachedSolveResult) => void;
    onError?: (error: Error) => void;
  }) {
    this.onProgressCb = callbacks.onProgress;
    this.onCompleteCb = callbacks.onComplete;
    this.onErrorCb = callbacks.onError;
  }

  public start() {
    if (!this.solver) {
      throw new Error('Solver not initialized. Call init() first.');
    }
    if (this.status === 'running') return;

    if (this.cacheKey) {
      const cached = globalSolverCache.get(this.cacheKey);
      if (cached) {
        this.currentIteration = this.totalIterations;
        this.totalElapsedMs = 0;
        this.status = 'completed';
        if (this.onProgressCb) {
          this.onProgressCb({
            currentIteration: this.totalIterations,
            totalIterations: this.totalIterations,
            percent: 100,
            elapsedMs: 0,
            status: 'completed',
            exploitability: 0,
            fromCache: true
          });
        }
        if (this.onCompleteCb) {
          this.onCompleteCb({ ...cached, elapsedMs: 0, fromCache: true });
        }
        return;
      }
    }

    this.status = 'running';
    this.startTime = performance.now();
    this.scheduleNextChunk();
  }

  public pause() {
    if (this.status === 'running') {
      this.status = 'paused';
      if (this.timerId !== null) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      this.totalElapsedMs += performance.now() - this.startTime;
      this.notifyProgress();
    }
  }

  public resume() {
    if (this.status === 'paused') {
      this.status = 'running';
      this.startTime = performance.now();
      this.scheduleNextChunk();
    }
  }

  public cancel() {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.status = 'cancelled';
    this.notifyProgress();
  }

  public getStatus(): SolverStatus {
    return this.status;
  }

  private scheduleNextChunk() {
    this.timerId = globalThis.setTimeout(() => {
      this.runChunk();
    }, 0);
  }

  private runChunk() {
    if (this.status !== 'running' || !this.solver) return;

    try {
      const remaining = this.totalIterations - this.currentIteration;
      const itersToRun = Math.min(this.chunkSize, remaining);

      // Solve for this chunk
      this.solver.solve(itersToRun);
      this.currentIteration += itersToRun;

      const elapsed = this.totalElapsedMs + (performance.now() - this.startTime);

      if (this.currentIteration >= this.totalIterations) {
        this.status = 'completed';
        const rawResult = this.solver.solve(0); // extract finalized strategies
        const finalResult: CachedSolveResult = {
          ...rawResult,
          elapsedMs: Math.round(elapsed),
          iterationsRun: this.totalIterations,
          fromCache: false
        };
        if (this.cacheKey) {
          globalSolverCache.set(this.cacheKey, finalResult);
        }

        this.notifyProgress();
        if (this.onCompleteCb) {
          this.onCompleteCb(finalResult);
        }
      } else {
        this.notifyProgress();
        this.scheduleNextChunk();
      }
    } catch (err: any) {
      this.status = 'error';
      if (this.onErrorCb) {
        this.onErrorCb(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  private notifyProgress() {
    if (this.onProgressCb) {
      const elapsed = this.status === 'running'
        ? this.totalElapsedMs + (performance.now() - this.startTime)
        : this.totalElapsedMs;

      this.onProgressCb({
        currentIteration: this.currentIteration,
        totalIterations: this.totalIterations,
        percent: Math.min(100, Math.round((this.currentIteration / this.totalIterations) * 100)),
        elapsedMs: Math.round(elapsed),
        status: this.status,
        exploitability: 0
      });
    }
  }
}
