/** CHUNK 6 — CSO-1.0 Corporate Action & Strategic Opportunity */
export type StrategicLifecycle = 'ANNOUNCEMENT' | 'APPROVAL' | 'EXECUTION' | 'COMPLETION';
export interface StrategicOpportunityEvidence {
  opportunityId: string;
  actionType: 'ACQUISITION' | 'JV' | 'MERGER' | 'DEMERGER' | 'RESTRUCTURING' | 'ASSET_MONETISATION' | 'CAPITAL_RAISE';
  lifecycle: StrategicLifecycle;
  evidenceIds: string[];
  synergyClaimEvidenceIds: string[];
  dependencyEvidenceIds: string[];
  offsetEvidenceIds: string[];
  executionRiskEvidenceIds: string[];
}
export function validateStrategicOpportunityEvidence(input: StrategicOpportunityEvidence): string[] {
  const errors: string[] = [];
  if (!input.opportunityId.trim()) errors.push('opportunityId is required');
  if (input.evidenceIds.length === 0) errors.push('strategic action requires evidence');
  return errors;
}
