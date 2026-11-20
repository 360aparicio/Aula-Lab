/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Cliente de Telemetría Tipada (FASE 3A) para market_study_v1.
 * - Batching configurable (máx 10 eventos o 15s).
 * - Cola offline resiliente en localStorage aislado por UID.
 * - Strict NO-OP cuando el feature flag está OFF o no hay consentimiento activo.
 * - Cero PII en metadataJson.
 */

import { readScopedItem, writeScopedItem } from '../userStorage';
import { computeExpiryMs, RETENTION_POLICY } from './legalCompliance';
import type { StudyEventDoc, StudyEventName, StudyLevel } from './studyTypes';

const TELEMETRY_QUEUE_KEY = 'market_study_telemetry_queue_v1';
const MAX_BATCH_SIZE = 10;
const MAX_QUEUE_CAP = 100;

export interface TelemetryEmitInput {
  uid: string;
  sessionId: string;
  cohortLevel: StudyLevel;
  effectiveLevel: StudyLevel;
  eventName: StudyEventName;
  module: string;
  durationMs?: number;
  metadata?: Record<string, string | number | boolean>;
}

const BLOCKED_META_KEYS = /email|mail|phone|token|password|secret|ip|address|name/i;

export function sanitizeTelemetryMetadata(
  meta?: Record<string, string | number | boolean>
): string {
  if (!meta || typeof meta !== 'object') return '{}';
  const clean: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (BLOCKED_META_KEYS.test(k)) continue;
    if (typeof v === 'string') {
      clean[k.slice(0, 32)] = v.slice(0, 120);
    } else if (typeof v === 'number' && Number.isFinite(v)) {
      clean[k.slice(0, 32)] = Math.round(v * 100) / 100;
    } else if (typeof v === 'boolean') {
      clean[k.slice(0, 32)] = v;
    }
  }
  const serialized = JSON.stringify(clean);
  return serialized.length <= 500 ? serialized : serialized.slice(0, 498) + '"}';
}

export class StudyTelemetryClient {
  private queue: StudyEventDoc[] = [];
  private enabled = false;
  private hasConsent = false;
  private flushHandler: ((batch: StudyEventDoc[]) => Promise<void>) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private flushing = false;

  configure(opts: {
    enabled: boolean;
    hasConsent: boolean;
    onFlush?: (batch: StudyEventDoc[]) => Promise<void>;
  }): void {
    this.enabled = opts.enabled;
    this.hasConsent = opts.hasConsent;
    if (opts.onFlush) {
      this.flushHandler = opts.onFlush;
    }
    if (!this.enabled || !this.hasConsent) {
      this.clearQueue();
      return;
    }
    this.restoreOfflineQueue();
  }

  track(input: TelemetryEmitInput): boolean {
    if (!this.enabled || !this.hasConsent) {
      return false;
    }

    const eventDoc: StudyEventDoc = {
      uid: input.uid,
      sessionId: input.sessionId.slice(0, 64),
      cohortLevel: input.cohortLevel,
      effectiveLevel: input.effectiveLevel,
      eventName: input.eventName,
      module: input.module.slice(0, 64),
      durationMs: Math.max(0, Math.min(86_400_000, Math.round(input.durationMs ?? 0))),
      metadataJson: sanitizeTelemetryMetadata(input.metadata),
      expiresAtMs: computeExpiryMs(RETENTION_POLICY.eventsRetentionDays)
    };

    this.queue.push(eventDoc);
    if (this.queue.length > MAX_QUEUE_CAP) {
      this.queue = this.queue.slice(this.queue.length - MAX_QUEUE_CAP);
    }
    this.persistOfflineQueue();

    if (this.queue.length >= MAX_BATCH_SIZE) {
      void this.flush();
    } else {
      this.scheduleTimer();
    }
    return true;
  }

  getQueuedCount(): number {
    return this.queue.length;
  }

  async flush(): Promise<number> {
    if (this.flushing || !this.enabled || !this.hasConsent || this.queue.length === 0 || !this.flushHandler) {
      return 0;
    }
    this.flushing = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    const batch = this.queue.slice(0, MAX_BATCH_SIZE);
    try {
      await this.flushHandler(batch);
      this.queue = this.queue.slice(batch.length);
      this.persistOfflineQueue();
      return batch.length;
    } catch {
      // Mantiene en cola offline para reintento resiliente
      this.persistOfflineQueue();
      return 0;
    } finally {
      this.flushing = false;
    }
  }

  clearQueue(): void {
    this.queue = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    try {
      writeScopedItem(TELEMETRY_QUEUE_KEY, '[]');
    } catch {
      // ignore
    }
  }

  private scheduleTimer(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, 15_000);
  }

  private persistOfflineQueue(): void {
    try {
      writeScopedItem(TELEMETRY_QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // ignore storage quota errors
    }
  }

  private restoreOfflineQueue(): void {
    try {
      const raw = readScopedItem(TELEMETRY_QUEUE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.queue = parsed.slice(0, MAX_QUEUE_CAP);
      }
    } catch {
      this.queue = [];
    }
  }
}

export const studyTelemetry = new StudyTelemetryClient();
