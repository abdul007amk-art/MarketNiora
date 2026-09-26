/** CHUNK 6 — ROS-1.0 Risk vs Opportunity Separation */
import type { OpportunityRisk } from './types.ts';

export function validateOpportunityRisk(risk: OpportunityRisk): string[] {
  const errors: string[] = [];
  if (!risk.riskId.trim()) errors.push('riskId is required');
  if (!risk.opportunityId.trim()) errors.push('opportunityId is required');
  if (!risk.statement.trim()) errors.push('risk statement is required');
  if (risk.evidenceIds.length === 0) errors.push('risk requires evidence');
  return errors;
}
