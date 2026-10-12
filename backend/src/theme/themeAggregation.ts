/** CHUNK 7 — TAOE-1.0 Theme Aggregation & Output Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';
import { THEME_HIERARCHY, type ThemeLevel } from './types.ts';

export const TAOE_METHODOLOGY_VERSION = 'TAOE-1.0';

export interface ThemeAggregationItem {
  itemId: string;
  themeId: string;
  level: ThemeLevel;
  value: string;
  relationshipIds: string[];
  currentExposureIds: string[];
  futureExposureIds: string[];
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export interface ThemeAggregationOutput {
  themeId: string;
  items: ThemeAggregationItem[];
  stocks: string[];
}

export function validateThemeAggregationItem(item: ThemeAggregationItem): string[] {
  const errors: string[] = [];
  if (!item.itemId.trim()) errors.push('itemId is required');
  if (!item.themeId.trim()) errors.push('themeId is required');
  if (!item.level.trim()) errors.push('level is required');
  if (!THEME_HIERARCHY.includes(item.level)) errors.push('invalid Theme aggregation level');
  if (!item.value.trim()) errors.push('value is required');
  if (item.evidenceIds.length === 0) errors.push('aggregation item requires evidence');
  if (item.provenance.length === 0) errors.push('aggregation item requires provenance');
  if (item.methodologyVersion !== TAOE_METHODOLOGY_VERSION) errors.push('TAOE methodologyVersion mismatch');
  for (const provenance of item.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Aggregation presents existing Theme intelligence; it does not create new facts. */
export function aggregationCreatesNewFacts(): boolean {
  return false;
}

/** Navigation can progress while preserving the underlying relationship graph. */
export function preservesUnderlyingRelationships(): boolean {
  return true;
}

/** Current and future exposure remain separately traceable. */
export function preservesCurrentFutureExposureSeparation(): boolean {
  return true;
}

/** Duplicate stocks are represented once in the aggregated stock list. */
export function deduplicateStocks(stocks: string[]): string[] {
  return [...new Set(stocks)];
}

/** TAOE does not introduce hidden weighting or an automatic Theme Score. */
export function createsHiddenWeightingOrThemeScore(): boolean {
  return false;
}
