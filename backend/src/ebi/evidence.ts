/**
 * CHUNK 5 — evidence-only contracts for DDE/BNI/CPI/GVI/ECI/BERI.
 * These layers preserve evidence; they do not manufacture scores.
 */

export type EvidenceStrength = 'CONFIRMED' | 'SUPPORTED' | 'INDICATED' | 'UNKNOWN';
export type DriverDirection = 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED' | 'UNKNOWN';

export type DdeDriver =
  | 'VOLUME' | 'PRICE_REALISATION' | 'PRODUCT_MIX' | 'CAPACITY' | 'UTILISATION'
  | 'MARKET_SHARE' | 'GEOGRAPHY_EXPORT' | 'NEW_PRODUCT_BUSINESS' | 'ACQUISITION'
  | 'OPERATING_EFFICIENCY' | 'INPUT_COSTS' | 'FX' | 'OTHER_UNCLEAR';

export interface DdeEvidence {
  driver: DdeDriver;
  direction: DriverDirection;
  evidence: EvidenceStrength;
  organicOrInorganic: 'ORGANIC' | 'INORGANIC' | 'NOT_STATED';
  persistence: 'PERSISTENT' | 'TEMPORARY' | 'UNKNOWN';
  sourceId: string;
  note: string;
}

export type BusinessNature = 'CYCLICAL' | 'DEFENSIVE' | 'STRUCTURAL_GROWTH' | 'HYBRID';
export type CyclePosition = 'BOTTOM' | 'RECOVERY' | 'EXPANSION' | 'PEAK' | 'DOWNTURN';
export type VisibilityHorizon = 'NEAR_TERM_0_4Q' | 'MEDIUM_1_3Y' | 'LONG_3Y_PLUS';
export type CatalystLifecycle =
  | 'IDENTIFIED' | 'VALIDATED' | 'ACTIVE' | 'REALISING' | 'COMPLETED'
  | 'INVALIDATED' | 'DELAYED' | 'CANCELLED';

export interface EvidenceRecord {
  sourceId: string;
  statement: string;
  evidence: EvidenceStrength;
}

export interface BusinessNatureEvidence {
  nature: BusinessNature;
  evidence: EvidenceRecord[];
}

export interface CycleEvidence {
  position: CyclePosition;
  industryOrCompany: 'INDUSTRY' | 'COMPANY';
  evidence: EvidenceRecord[];
  conflictingEvidence: EvidenceRecord[];
}

export interface VisibilityEvidence {
  horizon: VisibilityHorizon;
  demand?: EvidenceRecord[];
  capacityUtilisation?: EvidenceRecord[];
  products?: EvidenceRecord[];
  exportsGeography?: EvidenceRecord[];
  marketShare?: EvidenceRecord[];
  orderBook?: EvidenceRecord[];
  capex?: EvidenceRecord[];
  guidance?: EvidenceRecord[];
  structuralDrivers?: EvidenceRecord[];
}

export interface CatalystEvidence {
  lifecycle: CatalystLifecycle;
  impactArea: 'REVENUE' | 'EBITDA' | 'PAT' | 'EPS' | 'MARGINS' | 'CASH_FLOW' | 'DEBT' | 'CAPACITY' | 'BUSINESS_MIX';
  evidence: EvidenceRecord[];
}

export interface RiskEvidence {
  category:
    | 'BUSINESS' | 'EARNINGS' | 'BALANCE_SHEET' | 'CASH_FLOW' | 'CYCLICAL'
    | 'CUSTOMER_CONCENTRATION' | 'COMMODITY_INPUT' | 'REGULATORY'
    | 'EXECUTION' | 'GOVERNANCE_DISCLOSURE';
  direction: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' | 'MIXED' | 'UNKNOWN';
  persistence: 'PERSISTENT' | 'TEMPORARY' | 'UNKNOWN';
  mitigation: string | null;
  severity: string | null;
  evidence: EvidenceRecord[];
}
