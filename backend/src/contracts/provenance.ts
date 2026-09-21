/**
 * PROVENANCE CONTRACT
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Post-audit addition (Finding 10-B): the Master Guide requires every
 * observation to retain source, source timestamp, verification status,
 * raw/derived/normalized status, and formula version. This module
 * centralizes that requirement as one composable type so every Module 10
 * contract embeds it consistently, rather than each contract inventing
 * its own partial provenance shape.
 *
 * Reuses the SAME VerificationStatus/DataNature vocabulary already
 * established and tested in pipeline/types.ts (Module 7) — not a
 * parallel, slightly-different vocabulary.
 */

import type { VerificationStatus, DataNature } from '../pipeline/types.ts';

export interface Provenance {
  source: string | null;
  sourceTimestamp: number | null;
  verificationStatus: VerificationStatus;
  dataNature: DataNature;
  /** Required (non-null, non-empty) when dataNature is DERIVED; must be null otherwise. */
  formulaVersion: string | null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_VERIFICATION_STATUSES = ['VERIFIED', 'UNVERIFIED', 'SOURCE_REQUIRED'];
const VALID_DATA_NATURES = ['RAW', 'NORMALIZED', 'DERIVED'];

export function validateProvenance(p: Provenance): ValidationResult {
  const errors: string[] = [];

  if (p.sourceTimestamp !== null && !Number.isFinite(p.sourceTimestamp)) {
    errors.push('sourceTimestamp must be finite or null');
  }
  if (!VALID_VERIFICATION_STATUSES.includes(p.verificationStatus)) {
    errors.push(`invalid verificationStatus: ${p.verificationStatus}`);
  }
  if (!VALID_DATA_NATURES.includes(p.dataNature)) {
    errors.push(`invalid dataNature: ${p.dataNature}`);
  } else if (p.dataNature === 'DERIVED' && (!p.formulaVersion || p.formulaVersion.trim().length === 0)) {
    errors.push('DERIVED requires a non-empty formulaVersion');
  } else if (p.dataNature !== 'DERIVED' && p.formulaVersion !== null) {
    errors.push('formulaVersion must be null unless dataNature is DERIVED');
  }

  return { valid: errors.length === 0, errors };
}
