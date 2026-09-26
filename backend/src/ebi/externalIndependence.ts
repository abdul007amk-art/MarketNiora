/**
 * CHUNK 5 — external engine independence boundary.
 *
 * Rotation, Theme, OCE, Shariah, Stock Score, TIE and RSE/DCS may provide
 * version-pinned DATA_ONLY inputs to EBI. They cannot provide decision
 * authority or mutate EBI conclusions.
 */
export const EBI_EXTERNAL_ENGINES = [
  'ROTATION',
  'THEME',
  'OCE',
  'SHARIAH',
  'STOCK_SCORE',
  'TIE',
  'RSE_DCS',
] as const;

export type EbiExternalEngine = typeof EBI_EXTERNAL_ENGINES[number];

export interface ExternalIntegration {
  consumer: EbiExternalEngine;
  methodologyVersion: string;
  authority: string;
}

export function validateExternalIntegration(
  integration: ExternalIntegration,
): string[] {
  const errors: string[] = [];

  if (!EBI_EXTERNAL_ENGINES.includes(integration.consumer)) {
    errors.push(`unsupported external engine: ${integration.consumer}`);
  }
  if (!integration.methodologyVersion.trim()) {
    errors.push('methodologyVersion is required');
  }
  if (integration.authority !== 'DATA_ONLY') {
    errors.push(
      `external engine ${integration.consumer} cannot have decision authority over EBI; authority must be DATA_ONLY`,
    );
  }

  return errors;
}

export function validateExternalIntegrations(
  integrations: ExternalIntegration[],
): string[] {
  return integrations.flatMap(validateExternalIntegration);
}
