/**
 * CHUNK 6 — OCE no-fabrication boundary.
 * Final opportunity conclusions require traceable evidence and valid provenance.
 */

import { validateProvenance } from '../contracts/provenance.ts';
import type { Provenance } from '../contracts/provenance.ts';

export interface OceConclusionInput {
  statement: string;
  evidenceIds: string[];
  provenance: Provenance[];
}

export function validateOceNoFabrication(input: OceConclusionInput): string[] {
  const errors: string[] = [];
  if (!input.statement.trim()) errors.push('conclusion statement is required');
  if (input.evidenceIds.length === 0) errors.push('at least one evidenceId is required');
  if (input.evidenceIds.some((id) => !id.trim())) errors.push('evidenceId cannot be empty');
  if (input.provenance.length === 0) errors.push('at least one provenance record is required');

  for (const provenance of input.provenance) {
    errors.push(...validateProvenance(provenance).errors);
    if (provenance.verificationStatus === 'SOURCE_REQUIRED') {
      errors.push('SOURCE_REQUIRED evidence cannot support a final OCE conclusion');
    }
  }

  return [...new Set(errors)];
}
