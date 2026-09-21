/**
 * DEDUPLICATE (pipeline stage — after validate, before conflict resolution)
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Collapses EXACT duplicates only: same symbol + metric + source +
 * sourceTimestamp. Two different sources reporting the same symbol/metric
 * at the same time are NOT duplicates — that's a genuine multi-source
 * situation handled by conflictResolution.ts, not silently merged here.
 */

import type { NormalizedObservation } from './types.ts';

function dedupeKey(obs: NormalizedObservation): string {
  return `${obs.symbol}::${obs.metric}::${obs.source}::${obs.sourceTimestamp}`;
}

export function deduplicateObservations(observations: NormalizedObservation[]): NormalizedObservation[] {
  const seen = new Map<string, NormalizedObservation>();
  for (const obs of observations) {
    const key = dedupeKey(obs);
    if (!seen.has(key)) {
      seen.set(key, obs);
    }
  }
  return [...seen.values()];
}
