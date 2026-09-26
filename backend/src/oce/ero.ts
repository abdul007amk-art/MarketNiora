/** CHUNK 6 — ERO-1.0 Earnings Re-rating Opportunity */
export interface EarningsReratingEvidence {
  opportunityId: string;
  earningsTrajectoryEvidenceIds: string[];
  forwardEvidenceIds: string[];
  taxEffectEvidenceIds: string[];
  exceptionalItemEvidenceIds: string[];
  shareCountEffectEvidenceIds: string[];
}
export function validateEarningsReratingEvidence(input: EarningsReratingEvidence): string[] {
  const errors: string[] = [];
  if (!input.opportunityId.trim()) errors.push('opportunityId is required');
  if (input.earningsTrajectoryEvidenceIds.length === 0) errors.push('earnings trajectory evidence is required');
  if (input.forwardEvidenceIds.length === 0) errors.push('forward evidence is required');
  return errors;
}
