/** CHUNK 6 — OSEQC-1.0 */
import type { EvidenceStrength } from './types.ts';

export interface OpportunityQuality {
  strength: EvidenceStrength;
  quality: number | null;
  coverage: number | null;
  consistency: number | null;
  recency: number | null;
  confidence: number | null;
}

export function validateOpportunityQuality(input: OpportunityQuality): string[] {
  const errors: string[] = [];
  for (const [name, value] of Object.entries({
    quality: input.quality,
    coverage: input.coverage,
    consistency: input.consistency,
    recency: input.recency,
    confidence: input.confidence,
  })) {
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 100)) {
      errors.push(`${name} must be null or within 0..100`);
    }
  }
  return errors;
}
