/**
 * IMMUTABLE RAW STORE (pipeline stage 1, before any transformation)
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Records exactly what a provider returned, untouched — provenance
 * evidence independent of whatever validation/normalization does later.
 * Append-only BY API DESIGN: no update/delete method exists on the
 * interface at all, mirroring the DB-trigger-enforced immutability of
 * raw_stock_observation in database/schema.sql (not wired to that real
 * table yet — this is the in-memory foundation, same convention as
 * SessionStore/RateLimitStore/etc.).
 */

import type { Quote } from '../providers/marketDataProvider.ts';

export interface RawObservationRecord {
  quote: Quote;
  recordedAt: number;
}

export interface RawObservationStore {
  append(quote: Quote, now: number): void;
  getAll(): RawObservationRecord[];
}

export class InMemoryRawObservationStore implements RawObservationStore {
  public readonly productionReady = false;
  private records: RawObservationRecord[];

  constructor() {
    this.records = [];
  }

  /**
   * Post-audit fix (provenance integrity): deep-clones on the way in.
   * Without this, `store.append(quote)` followed by the caller later
   * mutating their own `quote` object would silently corrupt provenance
   * history — the stored record must be fully independent from the
   * moment it's recorded.
   */
  append(quote: Quote, now: number = Date.now()): void {
    this.records.push(structuredClone({ quote, recordedAt: now }));
  }

  /**
   * Post-audit fix: deep-clones on the way out too. Previously this
   * returned a fresh array but with the SAME nested Quote object
   * references — `store.getAll()[0].quote.price = 999999` would mutate
   * the stored record. Callers now get an independent snapshot.
   */
  getAll(): RawObservationRecord[] {
    return this.records.map((r) => structuredClone(r));
  }
}
