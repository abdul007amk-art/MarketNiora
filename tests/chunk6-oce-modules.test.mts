import test from 'node:test';
import assert from 'node:assert/strict';

import { validateOpportunityCandidate } from '../backend/src/oce/oie.ts';
import { validateCatalyst } from '../backend/src/oce/com.ts';
import { calculateFcf } from '../backend/src/oce/bcf.ts';
import { validateOpportunityRisk } from '../backend/src/oce/ros.ts';
import { validateOpportunityQuality } from '../backend/src/oce/oseqc.ts';
import { validateOceOutput } from '../backend/src/oce/oao.ts';
import { validateEarningsReratingEvidence } from '../backend/src/oce/ero.ts';
import { validateValuationReratingEvidence } from '../backend/src/oce/vro.ts';
import { validateCapacityOpportunityEvidence } from '../backend/src/oce/bco.ts';
import { validateIndustryCycleEvidence } from '../backend/src/oce/ico.ts';
import { validateCompetitiveOpportunityEvidence } from '../backend/src/oce/mco.ts';
import { validateOrderVisibilityEvidence } from '../backend/src/oce/ovo.ts';
import { validateOperatingLeverageEvidence } from '../backend/src/oce/olo.ts';
import { validateStrategicOpportunityEvidence } from '../backend/src/oce/cso.ts';

test('C6-006 opportunity identification requires evidence and remains separate from score', () => {
  const result = validateOpportunityCandidate({
    opportunityId: 'O1',
    stockId: 'S1',
    type: 'EARNINGS_RERATING',
    title: 'Opportunity',
    evidenceIds: ['E1'],
    lifecycle: 'IDENTIFIED',
    truthState: 'VERIFIED',
    methodologyVersion: 'OCE-1.0',
  }, [{
    evidenceId: 'E1',
    source: 'source',
    sourceTimestamp: null,
    reportedDate: null,
    truthState: 'VERIFIED',
    classification: 'REPORTED',
    provenance: { source: 'source', sourceTimestamp: null, verificationStatus: 'VERIFIED', dataNature: 'RAW', formulaVersion: null },
    methodologyVersion: 'OCE-1.0',
    strength: 'CONFIRMED',
    statement: 'evidence',
  }]);
  assert.deepEqual(result, []);
});

test('C6-007 catalyst mapping requires linked opportunity and evidence', () => {
  assert.deepEqual(validateCatalyst({
    catalystId: 'C1',
    title: 'Catalyst',
    evidenceIds: ['E1'],
    opportunityIds: ['O1'],
    lifecycleEvent: 'ANNOUNCEMENT',
    economicEffect: 'SUPPORTING',
  }, [{ opportunityId: 'O1', stockId: 'S1', type: 'TYPE', title: 'O', evidenceIds: ['E1'], lifecycle: 'IDENTIFIED', truthState: 'VERIFIED', methodologyVersion: 'OCE-1.0' }],
  [{
    evidenceId: 'E1',
    source: 'source',
    sourceTimestamp: null,
    reportedDate: null,
    truthState: 'VERIFIED',
    classification: 'REPORTED',
    provenance: { source: 'source', sourceTimestamp: null, verificationStatus: 'VERIFIED', dataNature: 'RAW', formulaVersion: null },
    methodologyVersion: 'OCE-1.0',
    strength: 'CONFIRMED',
    statement: 'evidence',
  }]), []);
});

test('C6-008 BCF follows FCF = CFO - Capex and missing Capex is NOT COMPUTABLE', () => {
  assert.deepEqual(calculateFcf({ cfo: 100, capex: 30 }), { state: 'COMPUTABLE', value: 70, reason: null });
  assert.deepEqual(calculateFcf({ cfo: 100, capex: null }), { state: 'NOT_COMPUTABLE', value: null, reason: 'Capex missing' });
});

test('C6-009 risk remains separate and never becomes opportunity-minus-risk score', () => {
  assert.deepEqual(validateOpportunityRisk({
    riskId: 'R1', opportunityId: 'O1', kind: 'CONSTRAINT', evidenceIds: ['E1'], statement: 'constraint',
  }), []);
});

test('C6-010 quality dimensions remain separate and nullable', () => {
  assert.deepEqual(validateOpportunityQuality({
    strength: 'SUPPORTED', quality: null, coverage: 50, consistency: 80, recency: 70, confidence: null,
  }), []);
});

test('C6-011 output retains evidence and does not create a score', () => {
  const output = {
    opportunity: { opportunityId: 'O1', stockId: 'S1', type: 'TYPE', title: 'O', evidenceIds: ['E1'], lifecycle: 'IDENTIFIED', truthState: 'VERIFIED', methodologyVersion: 'OCE-1.0' },
    evidence: [{ evidenceId: 'E1' }] as never[],
    catalysts: [],
    risks: [],
    confidence: { strength: 'CONFIRMED' as const, quality: null, coverage: null, consistency: null, recency: null, confidence: null },
    source: 'source',
    lastUpdated: '2026-09-26T00:00:00Z',
  };
  assert.deepEqual(validateOceOutput(output), []);
});

test('C6-012 specialized opportunity modules enforce their source-defined evidence boundaries', () => {
  assert.deepEqual(validateEarningsReratingEvidence({ opportunityId: 'O1', earningsTrajectoryEvidenceIds: ['E1'], forwardEvidenceIds: ['E2'], taxEffectEvidenceIds: [], exceptionalItemEvidenceIds: [], shareCountEffectEvidenceIds: [] }), []);
  assert.deepEqual(validateValuationReratingEvidence({ opportunityId: 'O1', historicalContextEvidenceIds: ['E1'], peerContextEvidenceIds: [], fundamentalContextEvidenceIds: [], comparisonState: 'COMPARABLE' }), []);
  assert.deepEqual(validateCapacityOpportunityEvidence({ opportunityId: 'O1', capacityExpansionEvidenceIds: ['E1'], commissioningEvidenceIds: [], rampUpEvidenceIds: [], utilisationEvidenceIds: [], demandEvidenceIds: [], executionEvidenceIds: [] }), []);
  assert.deepEqual(validateIndustryCycleEvidence({ opportunityId: 'O1', demandEvidenceIds: [], supplyEvidenceIds: [], pricingEvidenceIds: [], inventoryEvidenceIds: [], utilisationEvidenceIds: [], companyExposureEvidenceIds: ['E1'], cycleConstraintEvidenceIds: [] }), []);
  assert.deepEqual(validateCompetitiveOpportunityEvidence({ opportunityId: 'O1', marketShareEvidenceIds: ['E1'], comparableMarketDefinitionEvidenceIds: ['E2'], customerEvidenceIds: [], geographyEvidenceIds: [], competitiveAdvantageEvidenceIds: [], competitiveRiskEvidenceIds: [] }), []);
  assert.deepEqual(validateOrderVisibilityEvidence({ opportunityId: 'O1', orderBookEvidenceIds: ['E1'], newOrderEvidenceIds: [], cancellationEvidenceIds: [], backlogQualityEvidenceIds: [], executionEvidenceIds: [], conversionEvidenceIds: [], capacityDependencyEvidenceIds: [], customerConcentrationEvidenceIds: [], marginDependencyEvidenceIds: [] }), []);
  assert.deepEqual(validateOperatingLeverageEvidence({ opportunityId: 'O1', fixedCostEvidenceIds: [], variableCostEvidenceIds: [], utilisationEvidenceIds: [], incrementalMarginEvidenceIds: ['E1'] }), []);
  assert.deepEqual(validateStrategicOpportunityEvidence({ opportunityId: 'O1', actionType: 'ACQUISITION', lifecycle: 'ANNOUNCEMENT', evidenceIds: ['E1'], synergyClaimEvidenceIds: [], dependencyEvidenceIds: [], offsetEvidenceIds: [], executionRiskEvidenceIds: [] }), []);
});
