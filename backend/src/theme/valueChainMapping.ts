/** CHUNK 7 — VCM-1.0 Value Chain Mapping & Classification Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const VCM_METHODOLOGY_VERSION = 'VCM-1.0';

/**
 * Value Chain is represented as economic/business stages rather than one
 * flattened chain string. Stage names remain data-driven; the methodology
 * does not prescribe an exhaustive universal taxonomy.
 */
export interface ValueChainStage {
  stageId: string;
  name: string;
  sequence: number | null;
}

export type ValueChainRelationship =
  | 'PRIMARY'
  | 'SECONDARY'
  | 'OVERLAPPING'
  | 'ENABLING'
  | 'BENEFICIARY'
  | 'UNKNOWN';

export interface ValueChainMapping {
  mappingId: string;
  industryId: string;
  stage: ValueChainStage;
  relationship: ValueChainRelationship;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateValueChainStage(stage: ValueChainStage): string[] {
  const errors: string[] = [];
  if (!stage.stageId.trim()) errors.push('stageId is required');
  if (!stage.name.trim()) errors.push('Value Chain stage name is required');
  if (stage.sequence !== null && (!Number.isInteger(stage.sequence) || stage.sequence < 0)) {
    errors.push('stage sequence must be null or a non-negative integer');
  }
  return errors;
}

export function validateValueChainMapping(mapping: ValueChainMapping): string[] {
  const errors = [...validateValueChainStage(mapping.stage)];
  if (!mapping.mappingId.trim()) errors.push('mappingId is required');
  if (!mapping.industryId.trim()) errors.push('Industry parent context is required');
  if (mapping.evidenceIds.length === 0) errors.push('Value Chain mapping requires evidence');
  if (mapping.provenance.length === 0) errors.push('Value Chain mapping requires provenance');
  if (mapping.methodologyVersion !== VCM_METHODOLOGY_VERSION) {
    errors.push('VCM methodologyVersion mismatch');
  }
  for (const provenance of mapping.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** A Company may legitimately occupy multiple Value Chain stages. */
export function supportsMultipleStages(stages: readonly ValueChainStage[]): boolean {
  return new Set(stages.map((stage) => stage.stageId)).size >= 1;
}

/** Users may stop at a resolved Value Chain stage for stock discovery. */
export function canDiscoverStocksFromValueChainStage(stageId: string): boolean {
  return stageId.trim().length > 0;
}
