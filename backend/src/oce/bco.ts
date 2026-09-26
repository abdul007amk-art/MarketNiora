/** CHUNK 6 — BCO-1.0 Business & Capacity Opportunity */
export interface CapacityOpportunityEvidence {
  opportunityId: string;
  capacityExpansionEvidenceIds: string[];
  commissioningEvidenceIds: string[];
  rampUpEvidenceIds: string[];
  utilisationEvidenceIds: string[];
  demandEvidenceIds: string[];
  executionEvidenceIds: string[];
}
export function validateCapacityOpportunityEvidence(input: CapacityOpportunityEvidence): string[] {
  const errors: string[] = [];
  if (!input.opportunityId.trim()) errors.push('opportunityId is required');
  if (input.capacityExpansionEvidenceIds.length === 0) errors.push('capacity expansion evidence is required');
  return errors;
}
