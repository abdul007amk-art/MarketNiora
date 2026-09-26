/**
 * CHUNK 6 — OCE-INPUT-1.1 evidence deduplication/conflict boundary.
 * Duplicate source records must not inflate evidence independence/confidence.
 * Conflicting factual records fail closed to REVIEW/CONFLICT.
 */
import { validateProvenance } from '../contracts/provenance.ts';
import type { OceEvidence, OceTruthState } from './types.ts';
import { OCE_METHODOLOGY_VERSION } from './types.ts';

const TRUTH_STATES: ReadonlySet<OceTruthState> = new Set([
  'LIVE', 'VERIFIED', 'DELAYED', 'STALE', 'PENDING',
  'UNAVAILABLE', 'NOT CONFIGURED', 'RESEARCH REQUIRED', 'REVIEW/CONFLICT',
]);
const CLASSIFICATIONS = new Set(['REPORTED', 'DERIVED', 'ESTIMATED', 'INFERRED']);

export function validateOceEvidence(evidence: OceEvidence): string[] {
  const errors: string[] = [];
  if (!evidence.evidenceId.trim()) errors.push('evidenceId is required');
  if (!evidence.source.trim()) errors.push('source is required');
  if (!evidence.statement.trim()) errors.push('statement is required');
  if (!TRUTH_STATES.has(evidence.truthState)) errors.push('invalid truthState');
  if (!CLASSIFICATIONS.has(evidence.classification)) errors.push('invalid classification');
  if (evidence.methodologyVersion !== OCE_METHODOLOGY_VERSION) errors.push('methodologyVersion must equal OCE-1.0');
  if (evidence.sourceTimestamp !== null && !Number.isFinite(evidence.sourceTimestamp)) {
    errors.push('sourceTimestamp must be finite or null');
  }
  if (evidence.classification === 'DERIVED' && evidence.provenance.dataNature !== 'DERIVED') {
    errors.push('DERIVED evidence must carry DERIVED provenance');
  }
  if (evidence.classification === 'REPORTED' && evidence.provenance.dataNature === 'DERIVED') {
    errors.push('REPORTED evidence cannot carry DERIVED provenance');
  }
  errors.push(...validateProvenance(evidence.provenance).errors);
  return [...new Set(errors)];
}

export interface EvidenceFact {
  factKey: string;
  evidence: OceEvidence;
}

export interface EvidenceResolution {
  records: OceEvidence[];
  truthState: OceTruthState;
  independentSourceCount: number;
  conflict: boolean;
}

const RANK: Record<OceTruthState, number> = {
  LIVE: 0, VERIFIED: 1, DELAYED: 2, STALE: 3, PENDING: 4,
  'RESEARCH REQUIRED': 5, 'REVIEW/CONFLICT': 6, 'NOT CONFIGURED': 7, UNAVAILABLE: 8,
};

export function resolveEvidenceFacts(facts: EvidenceFact[]): EvidenceResolution {
  if (facts.length === 0) {
    return { records: [], truthState: 'UNAVAILABLE', independentSourceCount: 0, conflict: false };
  }

  const byStatement = new Map<string, OceEvidence[]>();
  for (const item of facts) {
    const key = item.factKey.trim();
    if (!key) continue;
    const group = byStatement.get(key) ?? [];
    group.push(item.evidence);
    byStatement.set(key, group);
  }

  const records: OceEvidence[] = [];
  let conflict = false;
  let weakest: OceTruthState = 'LIVE';

  for (const group of byStatement.values()) {
    const statements = new Set(group.map((item) => item.statement.trim()));
    if (statements.size > 1) conflict = true;

    const seen = new Set<string>();
    for (const item of group) {
      const duplicateKey = `${item.source}|${item.sourceTimestamp ?? 'NULL'}|${item.statement.trim()}`;
      if (seen.has(duplicateKey)) continue;
      seen.add(duplicateKey);
      records.push(item);
      if (RANK[item.truthState] > RANK[weakest]) weakest = item.truthState;
    }
  }

  if (conflict) weakest = 'REVIEW/CONFLICT';

  return {
    records,
    truthState: weakest,
    independentSourceCount: new Set(records.map((item) => item.source)).size,
    conflict,
  };
}
