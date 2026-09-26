/**
 * CHUNK 5 — EBI v1.3 Governance Gate
 *
 * Lock is fail-closed. This module does not grant lock authority;
 * it evaluates whether the documented lock prerequisites are satisfied.
 */

export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface GovernanceEvidence {
  mandatoryTestsPass: boolean;
  unexplainedFailures: number;
  checkpointFailures: number;
  userConfirmed: boolean;
}

export interface GovernanceGateInput {
  findings: Record<FindingSeverity, number>;
  evidence: GovernanceEvidence;
}

export function evaluateChunk5LockGate(input: GovernanceGateInput): {
  lockReady: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  for (const severity of ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const) {
    const count = input.findings[severity];
    if (!Number.isInteger(count) || count < 0) {
      reasons.push(`${severity} finding count must be a non-negative integer`);
    } else if (count !== 0) {
      reasons.push(`${severity} findings remain: ${count}`);
    }
  }

  if (!input.evidence.mandatoryTestsPass) {
    reasons.push('mandatory tests/checkpoints have not all passed');
  }
  if (input.evidence.unexplainedFailures !== 0) {
    reasons.push('unexplained validation failures remain');
  }
  if (input.evidence.checkpointFailures !== 0) {
    reasons.push('mandatory checkpoint failures remain');
  }
  if (!input.evidence.userConfirmed) {
    reasons.push('explicit user confirmation is required');
  }

  return { lockReady: reasons.length === 0, reasons };
}
