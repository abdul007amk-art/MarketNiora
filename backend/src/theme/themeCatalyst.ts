/** CHUNK 7 — TCE-1.0 Theme Catalyst Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const TCE_METHODOLOGY_VERSION = 'TCE-1.0';

export type ThemeCatalystType =
  | 'POLICY'
  | 'TECHNOLOGY'
  | 'CAPACITY_CAPEX'
  | 'DEMAND'
  | 'SUPPLY'
  | 'CORPORATE_STRATEGIC'
  | 'TRADE_GEOPOLITICAL'
  | 'REGULATORY';

export type CatalystLifecycle =
  | 'IDENTIFIED'
  | 'VALIDATED'
  | 'DEVELOPING'
  | 'ACTIVE'
  | 'REALISING'
  | 'COMPLETED'
  | 'DELAYED'
  | 'INVALIDATED'
  | 'CANCELLED';

export interface ThemeCatalyst {
  catalystId: string;
  themeId: string;
  type: ThemeCatalystType;
  description: string;
  lifecycle: CatalystLifecycle;
  strength: string;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateThemeCatalyst(catalyst: ThemeCatalyst): string[] {
  const errors: string[] = [];
  if (!catalyst.catalystId.trim()) errors.push('catalystId is required');
  if (!catalyst.themeId.trim()) errors.push('themeId is required');
  if (!catalyst.description.trim()) errors.push('description is required');
  if (!catalyst.strength.trim()) errors.push('catalyst strength is required');
  if (catalyst.evidenceIds.length === 0) errors.push('catalyst requires evidence');
  if (catalyst.provenance.length === 0) errors.push('catalyst requires provenance');
  if (catalyst.methodologyVersion !== TCE_METHODOLOGY_VERSION) errors.push('TCE methodologyVersion mismatch');
  for (const provenance of catalyst.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Catalyst strength is descriptive intelligence, not probability. */
export function catalystStrengthIsProbability(): boolean {
  return false;
}

/** TCE has no authority to alter Stock Score. */
export function catalystAutomaticallyAltersStockScore(): boolean {
  return false;
}

/** TCE has no authority to alter Market Rotation. */
export function catalystAutomaticallyAltersRotation(): boolean {
  return false;
}
