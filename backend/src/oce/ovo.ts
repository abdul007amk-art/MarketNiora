/** CHUNK 6 — OVO-1.0 Order Book & Visibility Opportunity */
export interface OrderVisibilityEvidence {
  opportunityId: string;
  orderBookEvidenceIds: string[];
  newOrderEvidenceIds: string[];
  cancellationEvidenceIds: string[];
  backlogQualityEvidenceIds: string[];
  executionEvidenceIds: string[];
  conversionEvidenceIds: string[];
  capacityDependencyEvidenceIds: string[];
  customerConcentrationEvidenceIds: string[];
  marginDependencyEvidenceIds: string[];
}
export function validateOrderVisibilityEvidence(input: OrderVisibilityEvidence): string[] {
  const errors: string[] = [];
  if (!input.opportunityId.trim()) errors.push('opportunityId is required');
  if (input.orderBookEvidenceIds.length === 0) errors.push('order-book evidence is required');
  return errors;
}
