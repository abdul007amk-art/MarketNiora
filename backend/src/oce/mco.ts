/** CHUNK 6 — MCO-1.0 Market Share & Competitive Opportunity */
export interface CompetitiveOpportunityEvidence {
  opportunityId: string;
  marketShareEvidenceIds: string[];
  comparableMarketDefinitionEvidenceIds: string[];
  customerEvidenceIds: string[];
  geographyEvidenceIds: string[];
  competitiveAdvantageEvidenceIds: string[];
  competitiveRiskEvidenceIds: string[];
}
export function validateCompetitiveOpportunityEvidence(input: CompetitiveOpportunityEvidence): string[] {
  const errors: string[] = [];
  if (!input.opportunityId.trim()) errors.push('opportunityId is required');
  if (input.marketShareEvidenceIds.length === 0) errors.push('market-share evidence is required');
  if (input.comparableMarketDefinitionEvidenceIds.length === 0) errors.push('comparable market definition is required');
  return errors;
}
