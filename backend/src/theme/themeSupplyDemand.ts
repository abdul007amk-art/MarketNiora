/** CHUNK 7 — TSDE-1.0 Theme Supply & Demand Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const TSDE_METHODOLOGY_VERSION = 'TSDE-1.0';

export type ThemeSupplyDemandDimension =
  | 'DEMAND'
  | 'SUPPLY'
  | 'CAPACITY'
  | 'PRODUCTION'
  | 'UTILIZATION'
  | 'INVENTORY'
  | 'RAW_MATERIAL_AVAILABILITY'
  | 'TRADE_FLOWS';

export type SupplyDemandState =
  | 'SHORTAGE'
  | 'TIGHT'
  | 'BALANCED'
  | 'LOOSE'
  | 'SURPLUS'
  | 'MIXED'
  | 'UNKNOWN';

export interface ThemeSupplyDemandObservation {
  observationId: string;
  themeId: string;
  dimension: ThemeSupplyDemandDimension;
  value: string;
  unit: string | null;
  state: SupplyDemandState;
  isAnnouncedCapacity: boolean;
  isCurrentOperatingSupply: boolean;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateThemeSupplyDemandObservation(
  observation: ThemeSupplyDemandObservation,
): string[] {
  const errors: string[] = [];
  if (!observation.observationId.trim()) errors.push('observationId is required');
  if (!observation.themeId.trim()) errors.push('themeId is required');
  if (!observation.value.trim()) errors.push('supply/demand value is required');
  if (observation.unit !== null && !observation.unit.trim()) errors.push('unit must be null or non-empty');
  if (observation.evidenceIds.length === 0) errors.push('Supply/demand observation requires evidence');
  if (observation.provenance.length === 0) errors.push('Supply/demand observation requires provenance');
  if (observation.methodologyVersion !== TSDE_METHODOLOGY_VERSION) errors.push('TSDE methodologyVersion mismatch');
  for (const provenance of observation.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  if (observation.isAnnouncedCapacity && observation.isCurrentOperatingSupply) {
    errors.push('ANNOUNCED capacity cannot be represented as current operating supply');
  }
  return [...new Set(errors)];
}

/** Explicit guard: announced capacity is not current operating supply. */
export function announcedCapacityIsCurrentOperatingSupply(): boolean {
  return false;
}

/** Company-level expansion does not automatically become Theme-wide supply expansion. */
export function companyExpansionIsAutomaticallyThemeSupplyExpansion(): boolean {
  return false;
}
