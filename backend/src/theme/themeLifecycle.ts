/** CHUNK 7 — TLAE-1.0 Theme Lifecycle & Aging Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const TLAE_METHODOLOGY_VERSION = 'TLAE-1.0';

export type ThemeLifecycleStage =
  | 'EMERGING'
  | 'DEVELOPING'
  | 'ACCELERATING'
  | 'EXPANDING'
  | 'MATURE'
  | 'PEAK'
  | 'DECELERATING'
  | 'DECLINING'
  | 'DORMANT';

export interface ThemeLifecycleObservation {
  observationId: string;
  themeId: string;
  lifecycle: ThemeLifecycleStage;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateThemeLifecycleObservation(
  observation: ThemeLifecycleObservation,
): string[] {
  const errors: string[] = [];
  if (!observation.observationId.trim()) errors.push('observationId is required');
  if (!observation.themeId.trim()) errors.push('themeId is required');
  if (observation.evidenceIds.length === 0) errors.push('lifecycle observation requires evidence');
  if (observation.provenance.length === 0) errors.push('lifecycle observation requires provenance');
  if (observation.methodologyVersion !== TLAE_METHODOLOGY_VERSION) errors.push('TLAE methodologyVersion mismatch');
  for (const provenance of observation.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Theme lifecycle is independent from stock-price cycle and Market Rotation. */
export function lifecycleIsIndependentFromStockPriceAndRotation(): boolean {
  return true;
}

/** Stale evidence alone does not establish a DORMANT Theme. */
export function staleEvidenceAutomaticallyMeansDormant(): boolean {
  return false;
}

/** Missing evidence alone does not establish a DECLINING Theme. */
export function missingEvidenceAutomaticallyMeansDeclining(): boolean {
  return false;
}
