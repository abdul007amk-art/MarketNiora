/** CHUNK 6 — OIE-1.0 Opportunity Identification */
import type { OceEvidence, OpportunityCandidate } from './types.ts';

export function validateOpportunityCandidate(
  candidate: OpportunityCandidate,
  evidence: OceEvidence[],
): string[] {
  const errors: string[] = [];
  if (!candidate.opportunityId.trim()) errors.push('opportunityId is required');
  if (!candidate.stockId.trim()) errors.push('stockId is required');
  if (!candidate.type.trim()) errors.push('opportunity type is required');
  if (!candidate.title.trim()) errors.push('opportunity title is required');
  if (candidate.evidenceIds.length === 0) errors.push('opportunity requires evidence');
  const ids = new Set(evidence.map((item) => item.evidenceId));
  for (const id of candidate.evidenceIds) if (!ids.has(id)) errors.push(`missing evidence: ${id}`);
  return [...new Set(errors)];
}

export function opportunityCountIsNotScore(count: number): null {
  if (!Number.isInteger(count) || count < 0) throw new Error('opportunity count must be a non-negative integer');
  return null;
}
