/**
 * DATA STATUS / SOURCE HEALTH
 * Status: IMPLEMENTATION — unit tested below.
 *
 * GOVERNANCE (Master Guide "Data Status Language"): only these seven
 * states are ever used. Golden rule: UNKNOWN ≠ PASS, Missing ≠ Zero,
 * Unverified ≠ Verified. This module is the single place that decides
 * which status a data point gets — no provider should invent its own
 * classification logic.
 */

export type DataStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'MISSING' | 'NOT_INTERPRETABLE' | 'SOURCE_REQUIRED' | 'UNKNOWN';

export interface FreshnessCheckInput {
  /** When the data point was actually observed/generated. null means we have no data at all. */
  asOf: number | null;
  now: number;
  staleThresholdMs: number;
}

/**
 * Fail-closed classification:
 * - no data at all -> MISSING (never fabricate a value or a fake timestamp)
 * - non-finite now/asOf -> UNKNOWN (we cannot reason about it, so we don't guess)
 * - invalid staleThresholdMs (non-finite, non-integer, or negative) -> UNKNOWN
 *   (post-audit fix — a negative threshold previously made `age > threshold`
 *   true for almost any real observation, silently classifying everything
 *   as STALE instead of surfacing the misconfiguration)
 * - asOf in the future relative to now -> UNKNOWN (untrustworthy data, don't assume LIVE)
 * - older than the threshold -> STALE
 * - otherwise -> LIVE
 */
export function classifyFreshness(input: FreshnessCheckInput): DataStatus {
  if (input.asOf === null) return 'MISSING';
  if (!Number.isFinite(input.asOf) || !Number.isFinite(input.now)) return 'UNKNOWN';
  if (!Number.isFinite(input.staleThresholdMs) || !Number.isInteger(input.staleThresholdMs) || input.staleThresholdMs < 0) {
    return 'UNKNOWN';
  }
  const age = input.now - input.asOf;
  if (age < 0) return 'UNKNOWN';
  if (age > input.staleThresholdMs) return 'STALE';
  return 'LIVE';
}

export interface ProviderHealth {
  providerName: string;
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
  lastCheckedAt: number;
  detail?: string;
}
