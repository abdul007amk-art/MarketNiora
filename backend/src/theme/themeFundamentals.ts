/** CHUNK 7 — TFI-1.0 Theme Fundamental Intelligence. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const TFI_METHODOLOGY_VERSION = 'TFI-1.0';

export type ThemeFundamentalDimension =
  | 'DEMAND'
  | 'REVENUE_POOL'
  | 'MARGIN_ECONOMICS'
  | 'CAPITAL_INTENSITY'
  | 'RETURN_ECONOMICS'
  | 'CASH_FLOW_ECONOMICS'
  | 'PRICING_POWER'
  | 'THEME_NATURE'
  | 'CYCLE_INTELLIGENCE';

export interface ThemeFundamentalObservation {
  observationId: string;
  themeId: string;
  dimension: ThemeFundamentalDimension;
  value: string;
  unit: string | null;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateThemeFundamentalObservation(
  observation: ThemeFundamentalObservation,
): string[] {
  const errors: string[] = [];
  if (!observation.observationId.trim()) errors.push('observationId is required');
  if (!observation.themeId.trim()) errors.push('themeId is required');
  if (!observation.value.trim()) errors.push('fundamental value is required');
  if (observation.unit !== null && !observation.unit.trim()) errors.push('unit must be null or non-empty');
  if (observation.evidenceIds.length === 0) errors.push('Theme fundamental observation requires evidence');
  if (observation.provenance.length === 0) errors.push('Theme fundamental observation requires provenance');
  if (observation.methodologyVersion !== TFI_METHODOLOGY_VERSION) errors.push('TFI methodologyVersion mismatch');
  for (const provenance of observation.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Company ROE/ROCE are not automatically Theme-level observations. */
export function isCompanyMetricAutomaticallyThemeLevel(metricName: string): boolean {
  return ['ROE', 'ROCE'].includes(metricName.trim().toUpperCase());
}

/** TFI exposes dimensions; it does not manufacture a universal Theme Score. */
export function createsUniversalThemeScore(): boolean {
  return false;
}
