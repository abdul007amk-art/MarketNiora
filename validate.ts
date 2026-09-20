/**
 * VALIDATE (pipeline stage — after normalize, before deduplicate)
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Fail-closed structural checks. Does not judge whether a PRICE is
 * plausible (that's qualityCheck.ts) — this only checks the observation
 * is well-formed enough to reason about at all.
 */

import type { NormalizedObservation } from './types.ts';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_VERIFICATION_STATUSES = ['VERIFIED', 'UNVERIFIED', 'SOURCE_REQUIRED'];
const VALID_DATA_NATURES = ['RAW', 'NORMALIZED', 'DERIVED'];

export function validateObservation(obs: NormalizedObservation, now: number): ValidationResult {
  const errors: string[] = [];

  if (!obs.symbol || obs.symbol.trim().length === 0) errors.push('symbol is required');
  if (!obs.metric || obs.metric.trim().length === 0) errors.push('metric is required');
  if (!obs.source || obs.source.trim().length === 0) errors.push('source is required');

  if (obs.sourceTimestamp === null) {
    errors.push('sourceTimestamp is required (observation has no known time — cannot be trusted as current)');
  } else if (!Number.isFinite(obs.sourceTimestamp)) {
    errors.push('sourceTimestamp must be finite');
  } else if (!Number.isFinite(now)) {
    errors.push('now must be finite');
  } else if (obs.sourceTimestamp > now) {
    errors.push('sourceTimestamp is in the future — not trusted');
  }

  if (obs.value !== null && !Number.isFinite(obs.value)) {
    errors.push('value must be finite or null, never NaN/Infinity');
  }

  if (!VALID_VERIFICATION_STATUSES.includes(obs.verificationStatus)) {
    errors.push(`invalid verificationStatus: ${obs.verificationStatus}`);
  }

  if (!VALID_DATA_NATURES.includes(obs.dataNature)) {
    errors.push(`invalid dataNature: ${obs.dataNature}`);
  } else if (obs.dataNature === 'DERIVED' && (!obs.formulaVersion || obs.formulaVersion.trim().length === 0)) {
    errors.push('DERIVED observations must specify a non-empty formulaVersion');
  } else if (obs.dataNature !== 'DERIVED' && obs.formulaVersion !== null) {
    errors.push('formulaVersion must be null unless dataNature is DERIVED');
  }

  return { valid: errors.length === 0, errors };
}
