/**
 * FUNDAMENTAL INTELLIGENCE CONTRACT
 * Status: IMPLEMENTATION — unit tested below.
 *
 * WHAT -> WHY -> CHAIN -> CONTEXT -> CONCLUSION is a narrative methodology
 * for a research reader, not a scoring formula. This module defines the
 * DATA CONTRACT — never a verdict/score computed BY this module.
 * "A number is a clue, not an automatic verdict": no threshold-based
 * good/bad judgment is computed anywhere here. Fundamental Score
 * formula/thresholds are explicitly OPEN per the Master Guide and are
 * NOT implemented — see Module 10 scope lock.
 *
 * Post-audit hardening (Findings 10-A, 10-B, 10-C — all closed):
 * 10-A: added the Stock 360 Fundamental Intelligence structural fields
 *       (trend, rootCause, positiveSignals, warningSignals,
 *       relatedMetrics, context, verdict) — all narrative/evidence
 *       fields, never computed by this module. `verdict` specifically
 *       requires non-empty `context` to be present alongside it — no
 *       conclusion without stated evidence (same principle as
 *       valueChain.ts's CausalLink.evidenceSource).
 * 10-B: embedded the shared Provenance contract (source, sourceTimestamp,
 *       verificationStatus, dataNature, formulaVersion).
 * 10-C: `status` now reuses the SAME canonical DataStatus vocabulary as
 *       providers/sourceHealth.ts (LIVE/DELAYED/STALE/MISSING/
 *       NOT_INTERPRETABLE/SOURCE_REQUIRED/UNKNOWN) instead of a
 *       parallel 'AVAILABLE'-based vocabulary. classifyFundamentalStatus
 *       delegates directly to classifyFreshness() for the has-a-value
 *       case, reusing Module 6's already-tested logic rather than
 *       reimplementing it.
 */

import type { DataStatus } from '../providers/sourceHealth.ts';
import { classifyFreshness } from '../providers/sourceHealth.ts';
import type { Provenance, ValidationResult } from './provenance.ts';
import { validateProvenance } from './provenance.ts';

export const FUNDAMENTAL_METRICS = [
  'REVENUE', 'EBITDA', 'EBIT', 'OPERATING_PROFIT', 'NET_INCOME', 'EPS',
  'GROSS_MARGIN', 'OPERATING_MARGIN', 'NET_MARGIN', 'EARNINGS_QUALITY',
  'PEG', 'ROE', 'CFO', 'FCF', 'DEBT', 'LIQUIDITY', 'SOLVENCY',
  'WORKING_CAPITAL', 'CAPITAL_EFFICIENCY',
] as const;

export type FundamentalMetricName = (typeof FUNDAMENTAL_METRICS)[number];

/** Re-exports the SAME canonical status vocabulary used platform-wide — no separate term invented. */
export type FundamentalDataStatus = DataStatus;

/**
 * Fail-closed classification, reusing Module 6's classifyFreshness() for
 * the has-a-value case rather than reimplementing freshness logic.
 * - no value, no source -> MISSING (nothing at all)
 * - no value, has a source -> SOURCE_REQUIRED (known to exist, not fetched)
 * - value present but non-finite -> UNKNOWN (corrupt/unusable)
 * - value present but no sourceTimestamp -> UNKNOWN (can't assess currency)
 * - value + sourceTimestamp -> delegate to classifyFreshness (LIVE/STALE/UNKNOWN)
 */
export function classifyFundamentalStatus(
  value: number | null,
  source: string | null,
  sourceTimestamp: number | null,
  now: number,
  staleThresholdMs: number
): FundamentalDataStatus {
  if (value === null) {
    return source ? 'SOURCE_REQUIRED' : 'MISSING';
  }
  if (!Number.isFinite(value)) return 'UNKNOWN';
  if (sourceTimestamp === null) return 'UNKNOWN';
  return classifyFreshness({ asOf: sourceTimestamp, now, staleThresholdMs });
}

export interface FundamentalMetricRecord {
  stockId: string;
  metric: FundamentalMetricName;
  value: number | null;
  period: string | null;
  status: FundamentalDataStatus;
  provenance: Provenance;

  // --- Stock 360 Fundamental Intelligence structural fields (10-A) ---
  /** Narrative description of the metric's historical trend — text, not a computed trend score. */
  trend: string | null;
  /** WHY / Root Cause narrative. */
  rootCause: string | null;
  /** Narrative positive signal descriptions — never a numeric weight. */
  positiveSignals: string[];
  /** Narrative warning signal descriptions — never a numeric weight. */
  warningSignals: string[];
  /** Other metrics considered alongside this one (must reference known metric names). */
  relatedMetrics: FundamentalMetricName[];
  /** Narrative context (business cycle, peer comparison notes, etc). */
  context: string | null;
  /**
   * CONCLUSION — reserved narrative field, NEVER auto-computed anywhere
   * in this module. No function in this file assigns a non-null verdict;
   * it can only arrive as externally-supplied text (an analyst's
   * write-up, or a future AI Research module's output under its own
   * governance). If present, `context` must also be present — a
   * conclusion without stated evidence is not permitted.
   */
  verdict: string | null;
}

export function validateFundamentalMetricRecord(record: FundamentalMetricRecord, now: number, staleThresholdMs: number): ValidationResult {
  const errors: string[] = [];

  if (!record.stockId) errors.push('stockId is required');
  if (!(FUNDAMENTAL_METRICS as readonly string[]).includes(record.metric)) {
    errors.push(`unknown metric: ${record.metric}`);
  }
  if (record.value !== null && !Number.isFinite(record.value)) {
    errors.push('value must be finite or null, never NaN/Infinity');
  }

  const provenanceResult = validateProvenance(record.provenance);
  if (!provenanceResult.valid) errors.push(...provenanceResult.errors.map((e) => `provenance: ${e}`));

  const expectedStatus = classifyFundamentalStatus(record.value, record.provenance.source, record.provenance.sourceTimestamp, now, staleThresholdMs);
  if (record.status !== expectedStatus) {
    errors.push(`status inconsistent with value/source/sourceTimestamp: expected ${expectedStatus}, got ${record.status}`);
  }

  for (const related of record.relatedMetrics) {
    if (!(FUNDAMENTAL_METRICS as readonly string[]).includes(related)) {
      errors.push(`relatedMetrics contains an unknown metric: ${related}`);
    }
  }

  if (record.verdict !== null && (!record.context || record.context.trim().length === 0)) {
    errors.push('verdict cannot be present without context — no conclusion without stated evidence');
  }

  return { valid: errors.length === 0, errors };
}
