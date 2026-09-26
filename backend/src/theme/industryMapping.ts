/** CHUNK 7 — IME-1.0 Industry Mapping & Classification Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const IME_METHODOLOGY_VERSION = 'IME-1.0';

export type IndustryRelationship =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'OVERLAPPING'
  | 'ENABLING'
  | 'BENEFICIARY'
  | 'UNKNOWN';

export interface IndustryMapping {
  mappingId: string;
  subThemeId: string;
  industryId: string;
  relationship: IndustryRelationship;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateIndustryMapping(mapping: IndustryMapping): string[] {
  const errors: string[] = [];
  if (!mapping.mappingId.trim()) errors.push('mappingId is required');
  if (!mapping.subThemeId.trim()) errors.push('Sub-Theme parent context is required');
  if (!mapping.industryId.trim()) errors.push('industryId is required');
  if (mapping.subThemeId === mapping.industryId) errors.push('Industry cannot self-map to its Sub-Theme parent');
  if (mapping.evidenceIds.length === 0) errors.push('Industry mapping requires evidence');
  if (mapping.provenance.length === 0) errors.push('Industry mapping requires provenance');
  if (mapping.methodologyVersion !== IME_METHODOLOGY_VERSION) errors.push('IME methodologyVersion mismatch');
  for (const provenance of mapping.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Industry relationships may be multiple; no one-to-one assumption is imposed. */
export function supportsMultipleIndustryRelationships(
  mappings: readonly IndustryMapping[],
): boolean {
  return new Set(mappings.map((mapping) => mapping.industryId)).size >= 1;
}

/** Stock discovery may stop at Industry scope; downstream levels are not required. */
export function canDiscoverStocksFromIndustry(industryId: string): boolean {
  return industryId.trim().length > 0;
}

/** Theme-Intelligence Industry is not the Market Rotation Sector/Sub-Sector taxonomy. */
export function isMarketRotationSectorLabel(label: string): boolean {
  return ['SECTOR', 'SUB-SECTOR', 'SUB_SECTOR'].includes(label.trim().toUpperCase());
}

/** No Industry mapping is manufactured when the evidence needed to support it is absent. */
export function validateIndustryEvidence(evidenceIds: readonly string[]): string[] {
  return evidenceIds.length > 0 ? [] : ['Industry mapping requires evidence; no forced mapping'];
}
