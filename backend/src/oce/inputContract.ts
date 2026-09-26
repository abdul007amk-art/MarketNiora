/**
 * CHUNK 6 — OCE-INPUT-1.1
 * Validates provenance-linked evidence and fail-closed input metadata.
 */
import { validateProvenance } from '../contracts/provenance.ts';
import type { OceEvidence, OceTruthState } from './types.ts';
import { OCE_METHODOLOGY_VERSION } from './types.ts';

const TRUTH_STATES: ReadonlySet<OceTruthState> = new Set([
  'LIVE', 'VERIFIED', 'DELAYED', 'STALE', 'PENDING',
  'UNAVAILABLE', 'NOT CONFIGURED', 'RESEARCH REQUIRED', 'REVIEW/CONFLICT',
]);
const CLASSIFICATIONS = new Set(['REPORTED', 'DERIVED', 'ESTIMATED', 'INFERRED']);

export function validateOceEvidence(evidence: OceEvidence): string[] {
  const errors: string[] = [];
  if (!evidence.evidenceId.trim()) errors.push('evidenceId is required');
  if (!evidence.source.trim()) errors.push('source is required');
  if (!evidence.statement.trim()) errors.push('statement is required');
  if (!TRUTH_STATES.has(evidence.truthState)) errors.push('invalid truthState');
  if (!CLASSIFICATIONS.has(evidence.classification)) errors.push('invalid classification');
  if (evidence.methodologyVersion !== OCE_METHODOLOGY_VERSION) {
    errors.push('methodologyVersion must equal OCE-1.0');
  }
  if (evidence.sourceTimestamp !== null && !Number.isFinite(evidence.sourceTimestamp)) {
    errors.push('sourceTimestamp must be finite or null');
  }
  if (evidence.classification === 'DERIVED' && evidence.provenance.dataNature !== 'DERIVED') {
    errors.push('DERIVED evidence must carry DERIVED provenance');
  }
  if (evidence.classification === 'REPORTED' && evidence.provenance.dataNature === 'DERIVED') {
    errors.push('REPORTED evidence cannot carry DERIVED provenance');
  }
  errors.push(...validateProvenance(evidence.provenance).errors);
  return [...new Set(errors)];
}
