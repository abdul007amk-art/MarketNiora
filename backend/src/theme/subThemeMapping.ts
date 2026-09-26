/** CHUNK 7 — STM-1.0 Sub-Theme Mapping & Classification Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';
import { THEME_INPUT_METHODOLOGY_VERSION } from './types.ts';

export const STM_METHODOLOGY_VERSION = 'STM-1.0';

export type SubThemeRelationship = 'PRIMARY' | 'SECONDARY' | 'OVERLAPPING' | 'ENABLING' | 'BENEFICIARY' | 'UNKNOWN';

export interface SubThemeMapping {
  mappingId: string;
  themeNodeId: string;
  subThemeId: string;
  relationship: SubThemeRelationship;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateSubThemeMapping(mapping: SubThemeMapping): string[] {
  const errors: string[] = [];
  if (!mapping.mappingId.trim()) errors.push('mappingId is required');
  if (!mapping.themeNodeId.trim()) errors.push('Theme parent context is required');
  if (!mapping.subThemeId.trim()) errors.push('subThemeId is required');
  if (mapping.evidenceIds.length === 0) errors.push('Sub-Theme mapping requires evidence');
  if (mapping.provenance.length === 0) errors.push('Sub-Theme mapping requires provenance');
  if (mapping.methodologyVersion !== STM_METHODOLOGY_VERSION) errors.push('STM methodologyVersion mismatch');
  if (mapping.themeNodeId === mapping.subThemeId) errors.push('Sub-Theme cannot self-map to its Theme parent');
  for (const provenance of mapping.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Multiple Sub-Themes are valid; no one-to-one or mutually-exclusive assumption. */
export function supportsMultipleSubThemes(mappings: readonly SubThemeMapping[]): boolean {
  return new Set(mappings.map((mapping) => mapping.subThemeId)).size >= 1;
}

/** Overlap is preserved explicitly rather than forcing an unsupported segmentation. */
export function supportsOverlap(mappings: readonly SubThemeMapping[]): boolean {
  return mappings.some((mapping) => mapping.relationship === 'OVERLAPPING');
}

/** Stock discovery can stop at Sub-Theme; Industry is not required. */
export function canDiscoverStocksFromSubTheme(subThemeId: string): boolean {
  return subThemeId.trim().length > 0;
}

/** Ensures STM remains a Theme-classification layer, not a market-rotation layer. */
export function isRotationSectorOrSubSectorLabel(label: string): boolean {
  return ['SECTOR', 'SUB-SECTOR', 'SUB_SECTOR'].includes(label.trim().toUpperCase());
}

export function validateSubThemeDiscovery(subThemeId: string, industryId: string | null): string[] {
  const errors: string[] = [];
  if (!canDiscoverStocksFromSubTheme(subThemeId)) errors.push('Sub-Theme context is required');
  // Industry is intentionally optional under STM-1.0.
  if (industryId !== null && !industryId.trim()) errors.push('industryId must be null or non-empty');
  return errors;
}
