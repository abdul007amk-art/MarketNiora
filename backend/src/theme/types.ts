/** CHUNK 7 — THEME-INPUT-1.1 foundational contracts. */
import type { Provenance } from '../contracts/provenance.ts';
export const THEME_INPUT_METHODOLOGY_VERSION = 'THEME-INPUT-1.1';
export const THEME_HIERARCHY = ['THEME','SUB_THEME','INDUSTRY','VALUE_CHAIN','COMPANY','STOCK'] as const;
export type ThemeLevel = typeof THEME_HIERARCHY[number];
export type ThemeTruthState = 'LIVE'|'VERIFIED'|'DELAYED'|'STALE'|'PENDING'|'UNAVAILABLE'|'NOT CONFIGURED'|'RESEARCH REQUIRED'|'REVIEW/CONFLICT';
export interface ThemeNode { nodeId:string; level:ThemeLevel; name:string; parentNodeId:string|null; methodologyVersion:string; }
export interface ThemeExposure {
  exposureId:string; themeNodeId:string; stockId:string; companyId:string|null;
  relationship:'DIRECT'|'INDIRECT'|'ENABLER'|'BENEFICIARY'|'SUPPLIER'|'CUSTOMER'|'INFRASTRUCTURE_PROVIDER'|'TECHNOLOGY_PROVIDER'|'VALUE_CHAIN_PARTICIPANT'|'MIXED'|'UNKNOWN';
  evidenceIds:string[]; provenance:Provenance[]; truthState:ThemeTruthState; methodologyVersion:string;
}
export interface ThemeNavigationContext { level:ThemeLevel; nodeId:string; parentNodeId:string|null; }
