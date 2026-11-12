/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Solver Runner: manages asynchronous non-blocking solving, progress reporting,
 * pausing, resuming, and cancellation.
 */

import { Card } from './cards';
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
}

export class AsyncSolverRunner {
  private solver: DCFRSolver | null = null;
  private status: SolverStatus = 'idle';
  private currentIteration = 0;
  private totalIterations = 300;
  private startTime = 0;
  private totalElapsedMs = 0;
  private timerId: number | null = null;
  private chunkSize = 25; // iterations per asynchronous slice
  private onProgressCb?: (progress: SolverProgress) => void;
  private onCompleteCb?: (result: SolveResult) => void;
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
    this.solver = new DCFRSolver(treeRoot, board, oopCombos, ipCombos, config);
  }

  public setCallbacks(callbacks: {
    onProgress?: (progress: SolverProgress) => void;
    onComplete?: (result: SolveResult) => void;
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
    this.timerId = window.setTimeout(() => {
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
        const finalResult = this.solver.solve(0); // extract finalized strategies
        finalResult.elapsedMs = Math.round(elapsed);
        finalResult.iterationsRun = this.totalIterations;

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
