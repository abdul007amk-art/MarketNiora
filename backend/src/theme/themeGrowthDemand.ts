/** CHUNK 7 — TGDE-1.0 Theme Growth & Demand Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const TGDE_METHODOLOGY_VERSION = 'TGDE-1.0';

export type ThemeGrowthDimension =
  | 'DEMAND_GROWTH'
  | 'REVENUE_POOL_GROWTH'
  | 'VOLUME'
  | 'PRICE'
  | 'CAPACITY'
  | 'ADOPTION'
  | 'PENETRATION'
  | 'MARKET_EXPANSION'
  | 'EXPORTS'
  | 'REPLACEMENT_GROWTH';

export interface ThemeGrowthObservation {
  observationId: string;
  themeId: string;
  dimension: ThemeGrowthDimension;
  value: string;
  unit: string | null;
  durability: string | null;
  visibility: string | null;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateThemeGrowthObservation(
  observation: ThemeGrowthObservation,
): string[] {
  const errors: string[] = [];
  if (!observation.observationId.trim()) errors.push('observationId is required');
  if (!observation.themeId.trim()) errors.push('themeId is required');
  if (!observation.value.trim()) errors.push('growth value is required');
  if (observation.unit !== null && !observation.unit.trim()) errors.push('unit must be null or non-empty');
  if (observation.durability !== null && !observation.durability.trim()) errors.push('durability must be null or non-empty');
  if (observation.visibility !== null && !observation.visibility.trim()) errors.push('visibility must be null or non-empty');
  if (observation.evidenceIds.length === 0) errors.push('Theme growth observation requires evidence');
  if (observation.provenance.length === 0) errors.push('Theme growth observation requires provenance');
  if (observation.methodologyVersion !== TGDE_METHODOLOGY_VERSION) errors.push('TGDE methodologyVersion mismatch');
  for (const provenance of observation.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Revenue growth is not, by itself, a demand-growth classification. */
export function isRevenueGrowthAutomaticallyDemandGrowth(): boolean {
  return false;
}

/** Company growth is not, by itself, Theme growth. */
export function isCompanyGrowthAutomaticallyThemeGrowth(): boolean {
  return false;
}

/** Durability and visibility remain separate dimensions rather than one combined score. */
export function separatesDurabilityAndVisibility(): boolean {
  return true;
}
