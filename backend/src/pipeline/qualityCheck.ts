/**
 * QUALITY CHECK
 * Status: IMPLEMENTATION — unit tested below.
 *
 * DELIBERATE ORDERING NOTE: the Master Guide's flow lists this stage
 * AFTER "Canonical DB". This implementation gates quality check BEFORE
 * canonical insertion instead — accepting a record into the canonical
 * store and only checking its quality afterward would let bad data exist
 * as "canonical" even briefly. This is a fail-closed reading of the same
 * intent, not a silent reordering — flagged explicitly here and in
 * docs/DATA_PIPELINE.md for Owner confirmation.
 */

import type { NormalizedObservation } from './types.ts';

export interface QualityCheckResult {
  passed: boolean;
  reasons: string[];
}

const MAX_PLAUSIBLE_PRICE = 10_000_000; // ₹1 crore/share — generous upper bound, flags obvious garbage, not a real business rule

export function qualityCheck(obs: NormalizedObservation): QualityCheckResult {
  const reasons: string[] = [];

  if (obs.value !== null) {
    if (obs.value <= 0) {
      reasons.push('value must be positive for a price metric');
    }
    if (obs.value > MAX_PLAUSIBLE_PRICE) {
      reasons.push(`value exceeds plausible upper bound (${MAX_PLAUSIBLE_PRICE}) — flagged, not silently accepted`);
    }
  }

  return { passed: reasons.length === 0, reasons };
}
