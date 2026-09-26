/** CHUNK 6 — ICO-1.0 Industry & Cycle Opportunity */
export interface IndustryCycleOpportunityEvidence {
  opportunityId: string;
  demandEvidenceIds: string[];
  supplyEvidenceIds: string[];
  pricingEvidenceIds: string[];
  inventoryEvidenceIds: string[];
  utilisationEvidenceIds: string[];
  companyExposureEvidenceIds: string[];
  cycleConstraintEvidenceIds: string[];
}
export function validateIndustryCycleEvidence(input: IndustryCycleOpportunityEvidence): string[] {
  const errors: string[] = [];
  if (!input.opportunityId.trim()) errors.push('opportunityId is required');
  if (input.companyExposureEvidenceIds.length === 0) errors.push('company exposure evidence is required');
  return errors;
}
