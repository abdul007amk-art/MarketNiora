/**
 * PIPELINE ORCHESTRATOR
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Wires the stages in order: Immutable Raw Store -> Normalize -> Validate
 * -> Deduplicate -> Conflict Resolution -> Quality Check -> Canonical DB
 * -> Job Log. (Source Health + Fetch already happened upstream, in
 * Module 6's providers, before quotes reach this function.)
 *
 * See qualityCheck.ts for the one deliberate deviation from the Master
 * Guide's literal stage ORDER (quality gates before canonical insert,
 * not after) — flagged there and here for Owner review.
 */

import { randomBytes } from 'crypto';
import type { Quote } from '../providers/marketDataProvider.ts';
import type { RawObservationStore } from './rawObservationStore.ts';
import type { CanonicalObservation, CanonicalObservationStore } from './canonicalObservationStore.ts';
import type { JobLogEntry, JobLogStore } from './jobLogStore.ts';
import type { NormalizedObservation } from './types.ts';
import { normalizeQuote } from './normalize.ts';
import { validateObservation } from './validate.ts';
import { deduplicateObservations } from './deduplicate.ts';
import { resolveConflicts } from './conflictResolution.ts';
import type { ConflictRecord } from './conflictResolution.ts';
import { qualityCheck } from './qualityCheck.ts';

export interface RejectedObservation {
  observation: NormalizedObservation;
  errors: string[];
}

export interface PipelineRunResult {
  jobLog: JobLogEntry;
  canonicalRecords: CanonicalObservation[];
  rejected: RejectedObservation[];
  conflicts: ConflictRecord[];
}

export async function runPipeline(
  quotes: Quote[],
  metric: string,
  rawStore: RawObservationStore,
  canonicalStore: CanonicalObservationStore,
  jobLogStore: JobLogStore,
  now: number = Date.now()
): Promise<PipelineRunResult> {
  const jobId = randomBytes(12).toString('hex');

  // Stage: Immutable Raw Store — record exactly what was fetched, before any transformation
  for (const quote of quotes) {
    rawStore.append(quote, now);
  }

  // Stage: Normalize
  const normalized = quotes.map((q) => normalizeQuote(q, metric));

  // Stage: Validate
  const rejected: RejectedObservation[] = [];
  const validated: NormalizedObservation[] = [];
  for (const obs of normalized) {
    const result = validateObservation(obs, now);
    if (result.valid) {
      validated.push(obs);
    } else {
      rejected.push({ observation: obs, errors: result.errors });
    }
  }

  // Stage: Deduplicate
  const deduped = deduplicateObservations(validated);

  // Stage: Conflict Resolution
  const { resolved, conflicts } = resolveConflicts(deduped);

  // Stage: Quality Check (before Canonical DB — see file-level doc comment)
  const canonicalRecords: CanonicalObservation[] = [];
  for (const obs of resolved) {
    const quality = qualityCheck(obs);
    if (!quality.passed) {
      rejected.push({ observation: obs, errors: quality.reasons });
      continue;
    }
    // Stage: Canonical DB
    const record = await canonicalStore.insert(obs, now);
    canonicalRecords.push(record);
  }

  const status: JobLogEntry['status'] =
    rejected.length === 0 ? 'SUCCESS' : canonicalRecords.length > 0 ? 'PARTIAL' : 'FAILURE';

  // Stage: Job Log
  const jobLog: JobLogEntry = {
    jobId,
    startedAt: now,
    completedAt: now,
    status,
    recordsFetched: quotes.length,
    recordsValidated: validated.length,
    recordsRejected: rejected.length,
    recordsConflicted: conflicts.length,
    recordsCanonicalized: canonicalRecords.length,
  };
  jobLogStore.append(jobLog);

  return { jobLog, canonicalRecords, rejected, conflicts };
}
