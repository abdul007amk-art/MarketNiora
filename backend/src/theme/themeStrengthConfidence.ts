/** CHUNK 7 — TSCE-1.0 Theme Strength & Confidence Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const TSCE_METHODOLOGY_VERSION = 'TSCE-1.0';

export interface ThemeStrengthConfidence {
  themeId: string;
  themeStrength: string;
  evidenceQuality: string;
  coverage: string;
  confidence: string;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateThemeStrengthConfidence(value: ThemeStrengthConfidence): string[] {
  const errors: string[] = [];
  if (!value.themeId.trim()) errors.push('themeId is required');
  if (!value.themeStrength.trim()) errors.push('themeStrength is required');
  if (!value.evidenceQuality.trim()) errors.push('evidenceQuality is required');
  if (!value.coverage.trim()) errors.push('coverage is required');
  if (!value.confidence.trim()) errors.push('confidence is required');
  if (value.evidenceIds.length === 0) errors.push('strength/confidence assessment requires evidence');
  if (value.provenance.length === 0) errors.push('strength/confidence assessment requires provenance');
  if (value.methodologyVersion !== TSCE_METHODOLOGY_VERSION) errors.push('TSCE methodologyVersion mismatch');
  for (const provenance of value.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Confidence is not probability. */
export function confidenceIsProbability(): boolean {
  return false;
}

/** TSCE does not create an automatic weighted Theme Score. */
export function createsAutomaticWeightedThemeScore(): boolean {
  return false;
}

/** Missing components are not silently converted to zero or redistributed. */
export function redistributesMissingComponentsAutomatically(): boolean {
  return false;
}
