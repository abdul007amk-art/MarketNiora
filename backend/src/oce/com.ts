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

/**
 * Announcement/guidance is not realization.
 * Realisation/completion requires evidence that is actually verified;
 * a management claim alone cannot be promoted to a realized outcome.
 */
export function validateCatalystRealisation(
  catalyst: Catalyst,
  evidence: OceEvidence[],
): string[] {
  if (!['REALISATION', 'COMPLETION'].includes(catalyst.lifecycleEvent)) return [];

  const byId = new Map(evidence.map((item) => [item.evidenceId, item]));
  const linked = catalyst.evidenceIds.map((id) => byId.get(id)).filter((item): item is OceEvidence => item !== undefined);

  if (linked.length === 0) return ['realisation/completion requires linked evidence'];

  const verified = linked.some(
    (item) => item.provenance.verificationStatus === 'VERIFIED' && item.truthState === 'VERIFIED',
  );

  return verified ? [] : ['management/guidance claims cannot be treated as realised outcomes without verified evidence'];
}
