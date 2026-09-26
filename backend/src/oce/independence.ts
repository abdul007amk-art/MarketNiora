/**
 * CHUNK 6 — OCE external independence.
 * External modules may share data/evidence, but not decision authority.
 */
export type OceExternalDependency = 'ROTATION' | 'STOCK_SCORE' | 'THEME' | 'SHARIAH';

export interface OceIntegrationRef {
  consumer: 'OCE';
  provider: OceExternalDependency;
  methodologyVersion: string;
  authority: 'DATA_ONLY';
}

export function validateOceIntegration(ref: OceIntegrationRef): string[] {
  const errors: string[] = [];
  if (ref.consumer !== 'OCE') errors.push('consumer must be OCE');
  if (!ref.methodologyVersion.trim()) errors.push('integration methodologyVersion is required');
  if (ref.authority !== 'DATA_ONLY') errors.push('OCE integration authority must be DATA_ONLY');
  return errors;
}

export function rejectOceDecisionDependency(
  provider: OceExternalDependency,
  authority: 'DATA_ONLY' | 'DECISION',
): string[] {
  return authority === 'DECISION'
    ? [`${provider} cannot provide decision authority to OCE`]
    : [];
}
