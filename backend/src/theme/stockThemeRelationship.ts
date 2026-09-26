/** CHUNK 7 — STRIE-1.0 Stock–Theme Relationship Intelligence Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const STRIE_METHODOLOGY_VERSION = 'STRIE-1.0';

export type StockThemeRelationshipType =
  | 'DIRECT'
  | 'INDIRECT'
  | 'ENABLER'
  | 'BENEFICIARY'
  | 'SUPPLIER'
  | 'CUSTOMER'
  | 'INFRASTRUCTURE_PROVIDER'
  | 'TECHNOLOGY_PROVIDER'
  | 'VALUE_CHAIN_PARTICIPANT'
  | 'MIXED'
  | 'UNKNOWN';

export type ExposureStage =
  | 'CURRENT'
  | 'PLANNED';

export interface StockThemeRelationship {
  relationshipId: string;
  stockId: string;
  themeId: string;
  relationshipType: StockThemeRelationshipType;
  exposureStage: ExposureStage;
  strength: string;
  materiality: string;
  confidence: string;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateStockThemeRelationship(
  relationship: StockThemeRelationship,
): string[] {
  const errors: string[] = [];
  if (!relationship.relationshipId.trim()) errors.push('relationshipId is required');
  if (!relationship.stockId.trim()) errors.push('stockId is required');
  if (!relationship.themeId.trim()) errors.push('themeId is required');
  if (!relationship.strength.trim()) errors.push('relationship strength is required');
  if (!relationship.materiality.trim()) errors.push('relationship materiality is required');
  if (!relationship.confidence.trim()) errors.push('relationship confidence is required');
  if (relationship.evidenceIds.length === 0) errors.push('relationship requires evidence');
  if (relationship.provenance.length === 0) errors.push('relationship requires provenance');
  if (relationship.methodologyVersion !== STRIE_METHODOLOGY_VERSION) errors.push('STRIE methodologyVersion mismatch');
  for (const provenance of relationship.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

export function preservesCurrentPlannedExposureSeparation(
  relationship: StockThemeRelationship,
): boolean {
  return relationship.exposureStage === 'CURRENT' || relationship.exposureStage === 'PLANNED';
}

/** Relationship strength/materiality/confidence are not investment attractiveness. */
export function relationshipAttributesAreInvestmentAttractiveness(): boolean {
  return false;
}
