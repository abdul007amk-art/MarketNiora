/** CHUNK 7 — CMSRE-1.1 Company Mapping & Stock Resolution Engine. */
import { validateProvenance, type Provenance } from '../contracts/provenance.ts';

export const CMSRE_METHODOLOGY_VERSION = 'CMSRE-1.1';

export type CompanyExposureState =
  | 'CURRENT_OPERATING'
  | 'PLANNED'
  | 'UNDER_CONSTRUCTION'
  | 'COMMISSIONED'
  | 'RAMPING'
  | 'EXPANSION'
  | 'MATURE'
  | 'EXITED/INACTIVE';

export type CompanyRelationship =
  | 'VALUE_CHAIN_PARTICIPANT'
  | 'OPERATING_PEER'
  | 'STRATEGIC_BENCHMARK'
  | 'INDUSTRY_BENCHMARK'
  | 'UNKNOWN';

export interface CompanyExposure {
  exposureId: string;
  companyId: string;
  valueChainStageId: string;
  state: CompanyExposureState;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export interface CompanyStockResolution {
  resolutionId: string;
  companyId: string;
  stockId: string;
  evidenceIds: string[];
  provenance: Provenance[];
  methodologyVersion: string;
}

export function validateCompanyExposure(exposure: CompanyExposure): string[] {
  const errors: string[] = [];
  if (!exposure.exposureId.trim()) errors.push('exposureId is required');
  if (!exposure.companyId.trim()) errors.push('companyId is required');
  if (!exposure.valueChainStageId.trim()) errors.push('valueChainStageId is required');
  if (exposure.evidenceIds.length === 0) errors.push('Company exposure requires evidence');
  if (exposure.provenance.length === 0) errors.push('Company exposure requires provenance');
  if (exposure.methodologyVersion !== CMSRE_METHODOLOGY_VERSION) errors.push('CMSRE methodologyVersion mismatch');
  for (const provenance of exposure.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

export function validateCompanyStockResolution(resolution: CompanyStockResolution): string[] {
  const errors: string[] = [];
  if (!resolution.resolutionId.trim()) errors.push('resolutionId is required');
  if (!resolution.companyId.trim()) errors.push('companyId is required');
  if (!resolution.stockId.trim()) errors.push('stockId is required');
  if (resolution.evidenceIds.length === 0) errors.push('Company–Stock resolution requires evidence');
  if (resolution.provenance.length === 0) errors.push('Company–Stock resolution requires provenance');
  if (resolution.methodologyVersion !== CMSRE_METHODOLOGY_VERSION) errors.push('CMSRE methodologyVersion mismatch');
  for (const provenance of resolution.provenance) {
    const result = validateProvenance(provenance);
    if (!result.valid) errors.push(...result.errors);
  }
  return [...new Set(errors)];
}

/** Company and Stock are deliberately separate entities. */
export function areCompanyAndStockDistinct(companyId: string, stockId: string): boolean {
  return companyId.trim().length > 0 && stockId.trim().length > 0 && companyId.trim() !== stockId.trim();
}

/** A company may have multiple Value Chain exposures. */
export function supportsMultipleCompanyExposures(exposures: readonly CompanyExposure[]): boolean {
  return new Set(exposures.map((exposure) => exposure.valueChainStageId)).size >= 1;
}

/** A company may resolve to multiple listed/security instruments. */
export function supportsMultipleStocks(resolutions: readonly CompanyStockResolution[]): boolean {
  return new Set(resolutions.map((resolution) => resolution.stockId)).size >= 1;
}

/**
 * Operating peers and strategic/industry benchmarks are relationship concepts;
 * this engine does not expose them as Stock Score inputs.
 */
export function isStockScoreInputRelationship(relationship: CompanyRelationship): boolean {
  return relationship === 'VALUE_CHAIN_PARTICIPANT';
}
