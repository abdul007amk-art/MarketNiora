/**
 * MARKETNIORA DECISION GOVERNANCE LEDGER
 *
 * Every material decision can be reconstructed from a timestamped,
 * versioned evidence snapshot. This is append-only at the application
 * contract level; persistence is intentionally injected by the caller.
 */
import { createHash } from 'node:crypto';

export interface DecisionEvidenceRef {
  evidenceId: string;
  source: string;
  sourceTimestamp: number;
  knowledgeTimestamp: number;
  contentHash: string;
}

export interface DecisionLedgerEntry {
  entryId: string;
  stockId: string;
  dataAsOf: number;
  decisionTimestamp: number;
  featureVersion: string;
  rotationVersion: string;
  themeVersion: string;
  scoreVersion: string;
  riskVersion: string;
  decisionVersion: string;
  state: 'WATCH' | 'WAIT' | 'READY' | 'INVALIDATED';
  evidence: DecisionEvidenceRef[];
  entryTrigger: string | null;
  invalidation: string | null;
  reason: string;
}

export function canonicalize(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

export function hashEvidence(payload: unknown): string {
  return createHash('sha256').update(canonicalize(payload)).digest('hex');
}

export function validateLedgerEntry(entry: DecisionLedgerEntry): string[] {
  const errors: string[] = [];
  if (!entry.entryId) errors.push('entryId required');
  if (!entry.stockId) errors.push('stockId required');
  if (!Number.isFinite(entry.dataAsOf) || !Number.isFinite(entry.decisionTimestamp)) {
    errors.push('timestamps must be finite');
  }
  if (entry.decisionTimestamp < entry.dataAsOf) errors.push('decisionTimestamp cannot precede dataAsOf');
  for (const field of ['featureVersion','rotationVersion','themeVersion','scoreVersion','riskVersion','decisionVersion'] as const) {
    if (!entry[field]) errors.push(`${field} required`);
  }
  if (!entry.reason.trim()) errors.push('reason required');
  for (const e of entry.evidence) {
    if (!e.evidenceId || !e.source || !e.contentHash) errors.push('every evidence reference requires evidenceId, source and contentHash');
    if (!Number.isFinite(e.sourceTimestamp) || !Number.isFinite(e.knowledgeTimestamp)) {
      errors.push(`invalid timestamps for evidence ${e.evidenceId}`);
    }
    if (e.knowledgeTimestamp > entry.dataAsOf) errors.push(`future knowledge leakage in evidence ${e.evidenceId}`);
  }
  return errors;
}
