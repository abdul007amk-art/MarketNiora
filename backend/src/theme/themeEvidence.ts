/** CHUNK 7 — TEE-1.0 Theme Evidence Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const TEE_METHODOLOGY_VERSION = 'TEE-1.0';

export type EvidenceLevel = 'CONFIRMED' | 'SUPPORTED' | 'INDICATED' | 'UNKNOWN';
export type EvidenceType = 'PRIMARY' | 'INDEPENDENT_SECONDARY' | 'DERIVED' | 'DUPLICATIVE' | 'UNKNOWN';
export type EvidenceNature = 'REPORTED' | 'DERIVED' | 'ESTIMATED' | 'INFERRED';
export type EvidenceTruthState = 'VERIFIED' | 'REVIEW' | 'CONFLICT' | 'UNKNOWN';

export interface ThemeEvidence {
  evidenceId: string;
  claim: string;
  source: string;
  date: string | null;
  provenance: Provenance;
  level: EvidenceLevel;
  type: EvidenceType;
  nature: EvidenceNature;
  truthState: EvidenceTruthState;
  methodologyVersion: string;
}

export function validateThemeEvidence(evidence: ThemeEvidence): string[] {
  const errors: string[] = [];
  if (!evidence.evidenceId.trim()) errors.push('evidenceId is required');
  if (!evidence.claim.trim()) errors.push('claim is required');
  if (!evidence.source.trim()) errors.push('source is required');
  if (evidence.date !== null && !evidence.date.trim()) errors.push('date must be null or non-empty');
  if (evidence.methodologyVersion !== TEE_METHODOLOGY_VERSION) errors.push('TEE methodologyVersion mismatch');

  const provenance = validateProvenance(evidence.provenance);
  if (!provenance.valid) errors.push(...provenance.errors);

  return [...new Set(errors)];
}

/** Copied/duplicative sources do not count as independent confirmations. */
export function isIndependentConfirmation(evidence: ThemeEvidence): boolean {
  return evidence.type === 'PRIMARY' || evidence.type === 'INDEPENDENT_SECONDARY';
}

/** Preserve conflicts rather than silently selecting one source. */
export function preserveConflict(evidence: readonly ThemeEvidence[]): boolean {
  return evidence.some((item) => item.truthState === 'CONFLICT');
}

/**
 * Independence is evidence metadata, not a hidden score. This helper identifies
 * whether a set contains at least two independently classified evidence items.
 */
export function hasIndependentEvidence(evidence: readonly ThemeEvidence[]): boolean {
  return evidence.filter(isIndependentConfirmation).length >= 2;
}

/** The evidence chain is explicit and inspectable by design. */
export function hasCompleteEvidenceChain(evidence: ThemeEvidence): boolean {
  return evidence.claim.trim().length > 0 &&
    evidence.source.trim().length > 0 &&
    evidence.provenance.source.trim().length > 0;
}
