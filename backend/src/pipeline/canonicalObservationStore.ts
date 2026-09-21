/**
 * CANONICAL OBSERVATION STORE
 * Status: IMPLEMENTATION — unit tested below. NOT wired to the real
 * `raw_stock_observation`/canonical tables in database/schema.sql — this
 * is the in-memory foundation, same convention as every other *Store in
 * this repo (SessionStore, RateLimitStore, MfaVerificationStore, etc.).
 * productionReady = false.
 */

import { randomBytes } from 'crypto';
import type { NormalizedObservation } from './types.ts';

export interface CanonicalObservation extends NormalizedObservation {
  observationId: string;
  insertedAt: number;
}

export interface CanonicalObservationStore {
  insert(obs: NormalizedObservation, now: number): Promise<CanonicalObservation>;
  getAll(): CanonicalObservation[];
}

export class InMemoryCanonicalObservationStore implements CanonicalObservationStore {
  public readonly productionReady = false;
  private records: CanonicalObservation[];

  constructor() {
    this.records = [];
  }

  async insert(obs: NormalizedObservation, now: number = Date.now()): Promise<CanonicalObservation> {
    const record: CanonicalObservation = structuredClone({
      ...obs,
      observationId: randomBytes(12).toString('hex'),
      insertedAt: now,
    });
    this.records.push(record);
    return structuredClone(record);
  }

  getAll(): CanonicalObservation[] {
    return this.records.map((r) => structuredClone(r));
  }
}
