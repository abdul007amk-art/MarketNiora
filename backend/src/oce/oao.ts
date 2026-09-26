/** CHUNK 6 — OAO-1.0 Aggregation & Output Contract */
import type { OpportunityCandidate, OceEvidence, Catalyst, OpportunityRisk, OceOutput } from './types.ts';
import type { OpportunityQuality } from './oseqc.ts';

export function buildOceOutput(
  opportunity: OpportunityCandidate,
  evidence: OceEvidence[],
  catalysts: Catalyst[],
  risks: OpportunityRisk[],
  quality: OpportunityQuality,
  source: string | null,
  lastUpdated: string | null,
): OceOutput {
  return {
    opportunity,
    evidence,
    catalysts,
    risks,
    confidence: quality,
    source,
    lastUpdated,
  };
}

export function validateOceOutput(output: OceOutput): string[] {
  const errors: string[] = [];
  if (!output.opportunity.opportunityId.trim()) errors.push('opportunityId is required');
  if (output.evidence.length === 0) errors.push('evidence must remain traceable');
  if (output.source !== null && !output.source.trim()) errors.push('source must be null or non-empty');
  if (output.lastUpdated !== null && Number.isNaN(Date.parse(output.lastUpdated))) {
    errors.push('lastUpdated must be null or a valid date');
  }
  return errors;
}
