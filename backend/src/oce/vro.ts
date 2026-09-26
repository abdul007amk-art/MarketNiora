/** CHUNK 6 — VRO-1.0 Valuation Re-rating Opportunity */
export interface ValuationReratingEvidence {
  opportunityId: string;
  historicalContextEvidenceIds: string[];
  peerContextEvidenceIds: string[];
  fundamentalContextEvidenceIds: string[];
  comparisonState: 'COMPARABLE' | 'NOT_COMPARABLE' | 'NOT_COMPUTABLE' | 'MIXED';
}
export function validateValuationReratingEvidence(input: ValuationReratingEvidence): string[] {
  const errors: string[] = [];
  if (!input.opportunityId.trim()) errors.push('opportunityId is required');
  if (input.historicalContextEvidenceIds.length === 0 &&
      input.peerContextEvidenceIds.length === 0 &&
      input.fundamentalContextEvidenceIds.length === 0) {
    errors.push('at least one valuation context is required');
  }
  return errors;
}
