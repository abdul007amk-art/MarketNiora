/** CHUNK 7 — TRE-1.0 Theme Risk Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const TRE_METHODOLOGY_VERSION = 'TRE-1.0';

export type ThemeRiskType =
  | 'DEMAND'
  | 'SUPPLY'
  | 'PRICING'
  | 'MARGIN'
  | 'TECHNOLOGY'
  | 'REGULATORY'
  | 'TRADE'
  | 'CAPITAL'
  | 'EXECUTION'
  | 'COMPETITIVE'
  | 'SUBSTITUTION';

export type RiskTruthState = 'VERIFIED' | 'REVIEW' | 'CONFLICT' | 'UNKNOWN';

export interface ThemeRisk {
  riskId: string;
  themeId: string;
  type: ThemeRiskType;
  description: string;
  severity: string;
  probability: string | null;
  evidenceIds: string[];
  provenance: Provenance[];
  truthState: RiskTruthState;
  methodologyVersion: string;
}

export function validateThemeRisk(risk: ThemeRisk): string[] {
  const errors: string[] = [];
  if (!risk.riskId.trim()) errors.push('riskId is required');
  if (!risk.themeId.trim()) errors.push('themeId is required');
  if (!risk.description.trim()) errors.push('description is required');
  if (!risk.severity.trim()) errors.push('risk severity is required');
  if (risk.probability !== null && !risk.probability.trim()) errors.push('probability must be null or non-empty');
  if (risk.evidenceIds.length === 0) errors.push('risk requires evidence');
  if (risk.provenance.length === 0) errors.push('risk requires provenance');
  if (risk.methodologyVersion !== TRE_METHODOLOGY_VERSION) errors.push('TRE methodologyVersion mismatch');
  for (const provenance of risk.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Risk exposure is distinct from a negative catalyst/event. */
export function riskExposureIsNegativeCatalyst(): boolean {
  return false;
}

/** Absence of evidence cannot be converted into a fabricated probability. */
export function unsupportedProbabilityIsFabricated(): boolean {
  return true;
}

/** Theme Risk has no automatic authority over Stock Score. */
export function riskAutomaticallyAltersStockScore(): boolean {
  return false;
}

/** Theme Risk has no automatic authority over OCE. */
export function riskAutomaticallyAltersOCE(): boolean {
  return false;
}
