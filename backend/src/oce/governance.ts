/**
 * CHUNK 6 — OCE-GOV-1.0 fail-closed lock gate.
 *
 * This gate only determines whether the supplied audit evidence satisfies
 * the formal lock conditions. It does not mutate or lock the repository.
 */

export interface OceLockGateInput {
  critical: number;
  high: number;
  medium: number;
  low: number;
  mandatoryTestsPass: boolean;
  unexplainedFailures: number;
  checkpointFailures: number;
  all32CheckpointsPass: boolean;
  userConfirmed: boolean;
}

export interface OceLockGateResult {
  lockReady: boolean;
  reasons: string[];
}

export function evaluateOceLockGate(input: OceLockGateInput): OceLockGateResult {
  const reasons: string[] = [];
  const severities = [
    ['Critical', input.critical],
    ['High', input.high],
    ['Medium', input.medium],
    ['Low', input.low],
  ] as const;

  for (const [name, value] of severities) {
    if (!Number.isInteger(value) || value < 0) {
      reasons.push(`${name} severity count must be a non-negative integer`);
    } else if (value !== 0) {
      reasons.push(`${name} severity count must be zero`);
    }
  }

  if (!input.mandatoryTestsPass) reasons.push('mandatory tests must pass');
  if (input.unexplainedFailures !== 0) reasons.push('unexplained failures must be zero');
  if (input.checkpointFailures !== 0) reasons.push('checkpoint failures must be zero');
  if (!input.all32CheckpointsPass) reasons.push('all 32 checkpoints must pass');
  if (!input.userConfirmed) reasons.push('explicit user confirmation is required');

  return { lockReady: reasons.length === 0, reasons };
}
