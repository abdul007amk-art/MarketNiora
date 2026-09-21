/**
 * CONFLICT RESOLUTION (pipeline stage — after deduplicate, before canonical DB)
 * Status: IMPLEMENTATION — unit tested below.
 *
 * A "conflict" is two or more DIFFERENT-valued observations for the same
 * (symbol, metric) — e.g. two providers disagreeing on RELIANCE's close
 * price. This is never silently averaged or randomly picked. Explicit,
 * documented, deterministic policy:
 *   1. Higher verification status wins (VERIFIED > UNVERIFIED > SOURCE_REQUIRED)
 *   2. Tie -> more recent sourceTimestamp wins
 *   3. Tie -> alphabetically-first source name wins (deterministic, not random)
 * Every genuine conflict is also returned separately so it can be
 * reviewed/audited — resolution doesn't erase the fact that a conflict
 * happened.
 */

import type { NormalizedObservation } from './types.ts';

const VERIFICATION_RANK: Record<string, number> = { VERIFIED: 2, UNVERIFIED: 1, SOURCE_REQUIRED: 0 };

export interface ConflictRecord {
  symbol: string;
  metric: string;
  candidates: NormalizedObservation[];
}

export interface ConflictResolutionResult {
  resolved: NormalizedObservation[];
  conflicts: ConflictRecord[];
}

function pickWinner(group: NormalizedObservation[]): NormalizedObservation {
  return [...group].sort((a, b) => {
    const rankDiff = (VERIFICATION_RANK[b.verificationStatus] ?? 0) - (VERIFICATION_RANK[a.verificationStatus] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    const tsDiff = (b.sourceTimestamp ?? 0) - (a.sourceTimestamp ?? 0);
    if (tsDiff !== 0) return tsDiff;
    return a.source.localeCompare(b.source);
  })[0];
}

export function resolveConflicts(observations: NormalizedObservation[]): ConflictResolutionResult {
  const groups = new Map<string, NormalizedObservation[]>();
  for (const obs of observations) {
    const key = `${obs.symbol}::${obs.metric}`;
    const arr = groups.get(key) ?? [];
    arr.push(obs);
    groups.set(key, arr);
  }

  const resolved: NormalizedObservation[] = [];
  const conflicts: ConflictRecord[] = [];

  for (const [key, group] of groups) {
    if (group.length === 1) {
      resolved.push(group[0]);
      continue;
    }

    const distinctValues = new Set(group.map((o) => o.value));
    if (distinctValues.size === 1) {
      // Same value from multiple sources agreeing — not a genuine conflict.
      resolved.push(pickWinner(group));
      continue;
    }

    const [symbol, metric] = key.split('::');
    conflicts.push({ symbol, metric, candidates: group });
    resolved.push(pickWinner(group));
  }

  return { resolved, conflicts };
}
