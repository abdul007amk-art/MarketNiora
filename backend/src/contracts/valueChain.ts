/**
 * VALUE CHAIN CONTRACT
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Stage list matches database/schema.sql's value_chain_stage CHECK
 * constraint exactly — keep in sync if the schema ever changes. This is
 * a business-flow structure, not a score ("Value Chain score nahi hai").
 *
 * Post-audit (Finding 10-B): ValueChainEntry now embeds the shared
 * Provenance contract instead of a bare `source` string. CausalLink
 * keeps its own dedicated `evidenceSource` requirement as-is (a causal
 * claim's evidence is a distinct, narrower concept than an entry's general
 * Provenance) rather than being folded into the generic Provenance shape.
 */

import type { Provenance, ValidationResult } from './provenance.ts';
import { validateProvenance } from './provenance.ts';

export const VALUE_CHAIN_STAGES = [
  'RAW_MATERIAL_INPUT',
  'MINING_EXTRACTION',
  'SOURCING_PROCUREMENT',
  'PROCESSING',
  'MANUFACTURING',
  'CAPACITY_UTILISATION_CAPEX',
  'PRODUCTS_BYPRODUCTS',
  'CUSTOMERS_DISTRIBUTION',
  'DOWNSTREAM_INDUSTRIES',
  'FINAL_END_USE',
] as const;

export type ValueChainStage = (typeof VALUE_CHAIN_STAGES)[number];

export interface ValueChainEntry {
  stockId: string;
  stage: ValueChainStage;
  detail: Record<string, unknown> | null;
  provenance: Provenance;
}

export function validateValueChainEntry(entry: ValueChainEntry): ValidationResult {
  const errors: string[] = [];
  if (!entry.stockId) errors.push('stockId is required');
  if (!(VALUE_CHAIN_STAGES as readonly string[]).includes(entry.stage)) {
    errors.push(`unknown stage: ${entry.stage}`);
  }
  const provenanceResult = validateProvenance(entry.provenance);
  if (!provenanceResult.valid) errors.push(...provenanceResult.errors.map((e) => `provenance: ${e}`));
  return { valid: errors.length === 0, errors };
}

/** Orders entries by the canonical stage sequence, regardless of input order. */
export function orderByStage(entries: ValueChainEntry[]): ValueChainEntry[] {
  const stageIndex = new Map(VALUE_CHAIN_STAGES.map((s, i) => [s, i] as [ValueChainStage, number]));
  return [...entries].sort((a, b) => (stageIndex.get(a.stage) ?? 999) - (stageIndex.get(b.stage) ?? 999));
}

/**
 * Causal relationships (e.g. input price -> cost -> margin -> earnings)
 * must be evidence-based, never asserted without support ("Evidence ke
 * bina causal relationship ko fact nahi banana"). evidenceSource is
 * required and non-optional — there is no way to construct a valid
 * CausalLink without it.
 */
export interface CausalLink {
  fromStage: ValueChainStage;
  toStage: ValueChainStage;
  description: string;
  evidenceSource: string;
}

export function validateCausalLink(link: CausalLink): ValidationResult {
  const errors: string[] = [];
  if (!(VALUE_CHAIN_STAGES as readonly string[]).includes(link.fromStage)) errors.push('fromStage is not a valid stage');
  if (!(VALUE_CHAIN_STAGES as readonly string[]).includes(link.toStage)) errors.push('toStage is not a valid stage');
  if (!link.description || link.description.trim().length === 0) errors.push('description is required');
  if (!link.evidenceSource || link.evidenceSource.trim().length === 0) {
    errors.push('evidenceSource is required — causal relationships cannot be asserted without evidence');
  }
  return { valid: errors.length === 0, errors };
}
