/** CHUNK 6 — OLO-1.0 Operating Leverage Opportunity */
export interface OperatingLeverageEvidence {
  opportunityId: string;
  fixedCostEvidenceIds: string[];
  variableCostEvidenceIds: string[];
  utilisationEvidenceIds: string[];
  incrementalMarginEvidenceIds: string[];
}
export function validateOperatingLeverageEvidence(input: OperatingLeverageEvidence): string[] {
  const errors: string[] = [];
  if (!input.opportunityId.trim()) errors.push('opportunityId is required');
  if (input.incrementalMarginEvidenceIds.length === 0) errors.push('incremental margin evidence is required');
  return errors;
}
