/**
 * CHUNK 6 — OCE-1.0 foundational contracts.
 * Source basis: MarketNiora CHUNK 6 OCE consolidated audit package.
 * Contracts only; no opportunity score is invented here.
 */
import type { Provenance } from '../contracts/provenance.ts';

export const OCE_METHODOLOGY_VERSION = 'OCE-1.0';
export type OceClassification = 'REPORTED' | 'DERIVED' | 'ESTIMATED' | 'INFERRED';
export type OceTruthState =
  | 'LIVE' | 'VERIFIED' | 'DELAYED' | 'STALE' | 'PENDING'
  | 'UNAVAILABLE' | 'NOT CONFIGURED' | 'RESEARCH REQUIRED' | 'REVIEW/CONFLICT';
export type EvidenceStrength = 'CONFIRMED' | 'SUPPORTED' | 'INDICATED' | 'UNKNOWN';
export type OpportunityLifecycle =
  | 'IDENTIFIED' | 'VALIDATED' | 'DEVELOPING' | 'ACTIVE' | 'REALISING'
  | 'COMPLETED' | 'DELAYED' | 'INVALIDATED' | 'CANCELLED';

export interface OceEvidence {
  evidenceId: string;
  source: string;
  sourceTimestamp: number | null;
  reportedDate: string | null;
  truthState: OceTruthState;
  classification: OceClassification;
  provenance: Provenance;
  methodologyVersion: string;
  strength: EvidenceStrength;
  statement: string;
}

export interface OpportunityCandidate {
  opportunityId: string;
  stockId: string;
  type: string;
  title: string;
  evidenceIds: string[];
  lifecycle: OpportunityLifecycle;
  truthState: OceTruthState;
  methodologyVersion: string;
}

export interface Catalyst {
  catalystId: string;
  title: string;
  evidenceIds: string[];
  opportunityIds: string[];
  lifecycleEvent: 'ANNOUNCEMENT' | 'APPROVAL' | 'EXECUTION' | 'REALISATION' | 'COMPLETION';
  economicEffect: 'SUPPORTING' | 'OFFSETTING' | 'DEPENDENCY' | 'CONSTRAINT' | 'UNKNOWN';
}

export interface OpportunityRisk {
  riskId: string;
  opportunityId: string;
  kind: 'SUPPORTING' | 'OFFSETTING' | 'DEPENDENCY' | 'CONSTRAINT';
  evidenceIds: string[];
  statement: string;
}

export interface OceOutput {
  opportunity: OpportunityCandidate;
  evidence: OceEvidence[];
  catalysts: Catalyst[];
  risks: OpportunityRisk[];
  confidence: {
    strength: EvidenceStrength;
    quality: number | null;
    coverage: number | null;
    consistency: number | null;
    recency: number | null;
    confidence: number | null;
  };
  source: string | null;
  lastUpdated: string | null;
}
