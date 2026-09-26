/**
 * CHUNK 5 — period consistency guard.
 * Deterministic contract: a comparison set must use one period type and
 * matching period boundaries. It does not infer or coerce periods.
 */
import type { EbiInputMetric } from './inputContract.ts';

export function validatePeriodConsistency(inputs: EbiInputMetric[]): string[] {
  if (inputs.length <= 1) return [];
  const first = inputs[0];
  const errors: string[] = [];
  for (let i = 1; i < inputs.length; i += 1) {
    const current = inputs[i];
    if (current.periodType !== first.periodType) errors.push('periodType mismatch at index ' + i);
    if (current.periodStart !== first.periodStart) errors.push('periodStart mismatch at index ' + i);
    if (current.periodEnd !== first.periodEnd) errors.push('periodEnd mismatch at index ' + i);
  }
  return errors;
}
