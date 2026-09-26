/**
 * CHUNK 5 — EBI Missing-Data Boundary v1.3
 *
 * Production-wide fail-closed contract:
 * - missing/non-finite required numeric inputs must remain NOT_COMPUTABLE;
 * - invalid negative-base/denominator states remain NOT_COMPARABLE or
 *   TURNAROUND_EVENT where the engine contract explicitly defines them;
 * - null is preserved as the absence of a computed value;
 * - no missing value may be represented as numeric zero.
 */
export type MissingDataState =
  | 'COMPUTABLE'
  | 'NOT_COMPUTABLE'
  | 'NOT_COMPARABLE'
  | 'TURNAROUND_EVENT';

export interface MissingDataMetric {
  state: MissingDataState;
  value: number | null;
}

export function validateMissingDataMetric(
  metric: MissingDataMetric,
  name: string,
): string[] {
  const errors: string[] = [];

  if (!name.trim()) errors.push('metric name is required');

  if (metric.state === 'COMPUTABLE') {
    if (metric.value === null || !Number.isFinite(metric.value)) {
      errors.push(`${name}: COMPUTABLE requires a finite value`);
    }
  } else if (metric.value !== null) {
    errors.push(`${name}: non-computable state must preserve null value`);
  }

  return errors;
}

export function assertNoMissingAsZero(
  metrics: Record<string, MissingDataMetric>,
): string[] {
  const errors: string[] = [];

  for (const [name, metric] of Object.entries(metrics)) {
    if (metric.state !== 'COMPUTABLE' && metric.value === 0) {
      errors.push(`${name}: missing/non-comparable state cannot be represented as zero`);
    }
    errors.push(...validateMissingDataMetric(metric, name));
  }

  return errors;
}

export function missingDataCoverageContract(
  metrics: Record<string, MissingDataMetric>,
): { valid: boolean; errors: string[] } {
  const errors = assertNoMissingAsZero(metrics);
  return { valid: errors.length === 0, errors };
}
