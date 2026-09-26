/**
 * CHUNK 5 — no-fabrication enforcement.
 *
 * EBI conclusions must be traceable to evidence. A conclusion cannot be
 * marked supported/confirmed without source evidence, and derived inputs
 * must carry an explicit formula version through provenance.
 */
import type { Provenance } from '../contracts/provenance.ts';

export interface FabricationCheckInput {
  statement: string;
  sourceIds: string[];
  provenance: Provenance[];
}

export function validateNoFabrication(input: FabricationCheckInput): string[] {
  const errors: string[] = [];

  if (!input.statement.trim()) {
    errors.push('statement is required');
  }

  if (input.sourceIds.length === 0) {
    errors.push('at least one sourceId is required');
  }

  if (input.sourceIds.some((id) => !id.trim())) {
    errors.push('sourceId cannot be empty');
  }

  if (input.provenance.length === 0) {
    errors.push('at least one provenance record is required');
  }

  for (const provenance of input.provenance) {
    if (provenance.dataNature === 'DERIVED' &&
        (!provenance.formulaVersion || !provenance.formulaVersion.trim())) {
      errors.push('derived evidence requires a non-empty formulaVersion');
    }

    if (provenance.verificationStatus === 'SOURCE_REQUIRED') {
      errors.push('SOURCE_REQUIRED evidence cannot support a final EBI conclusion');
    }
  }

  return errors;
}
