/** CHUNK 6 — COM-1.0 Catalyst Mapping */
import type { Catalyst, OceEvidence, OpportunityCandidate } from './types.ts';

export function validateCatalyst(
  catalyst: Catalyst,
  opportunities: OpportunityCandidate[],
  evidence: OceEvidence[],
): string[] {
  const errors: string[] = [];
  if (!catalyst.catalystId.trim()) errors.push('catalystId is required');
  if (!catalyst.title.trim()) errors.push('catalyst title is required');
  const opportunityIds = new Set(opportunities.map((item) => item.opportunityId));
  const evidenceIds = new Set(evidence.map((item) => item.evidenceId));
  if (catalyst.opportunityIds.length === 0) errors.push('catalyst requires at least one opportunity');
  if (catalyst.evidenceIds.length === 0) errors.push('catalyst requires evidence');
  for (const id of catalyst.opportunityIds) if (!opportunityIds.has(id)) errors.push(`missing opportunity: ${id}`);
  for (const id of catalyst.evidenceIds) if (!evidenceIds.has(id)) errors.push(`missing evidence: ${id}`);
  return [...new Set(errors)];
}
