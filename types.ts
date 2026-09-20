/**
 * PIPELINE TYPES
 * Status: IMPLEMENTATION.
 *
 * NormalizedObservation intentionally uses `symbol` rather than
 * `stock_id` (unlike database/schema.sql's raw_stock_observation table,
 * which is keyed by stock_id). Resolving symbol -> canonical stock_id
 * requires a real Stock Master lookup, which needs actual DB wiring —
 * out of scope here (see docs/DATA_PIPELINE.md). This is a documented
 * limitation, not an oversight.
 */

export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'SOURCE_REQUIRED';

/**
 * Post-audit addition: Master Guide requires every observation to retain
 * raw/derived/normalized status and, where applicable, formula version.
 * dataNature captures the first; formulaVersion the second.
 */
export type DataNature = 'RAW' | 'NORMALIZED' | 'DERIVED';

export interface NormalizedObservation {
  symbol: string;
  metric: string;
  value: number | null;
  source: string;
  sourceTimestamp: number | null;
  reportedPeriod: string | null;
  verificationStatus: VerificationStatus;
  dataNature: DataNature;
  /** Required (non-null) when dataNature is DERIVED; must be null otherwise — enforced in validate.ts. */
  formulaVersion: string | null;
}
