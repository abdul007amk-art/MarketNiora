/**
 * CHUNK 6 — OCE truth-state and evidence governance.
 *
 * CHUNK 0 truth-state vocabulary is authoritative.
 * For multi-input derived output, the weakest relevant truth state wins.
 */

import type { OceTruthState } from './types.ts';

const RANK: Record<OceTruthState, number> = {
  LIVE: 0,
  VERIFIED: 1,
  DELAYED: 2,
  STALE: 3,
  PENDING: 4,
  'RESEARCH REQUIRED': 5,
  'REVIEW/CONFLICT': 6,
  'NOT CONFIGURED': 7,
  UNAVAILABLE: 8,
};

export function resolveWeakestTruthState(states: OceTruthState[]): OceTruthState | null {
  if (states.length === 0) return null;
  return states.reduce((weakest, current) =>
    RANK[current] > RANK[weakest] ? current : weakest,
  states[0]);
}

export function validateTruthStateInputs(
  states: OceTruthState[],
  derivedState: OceTruthState,
): string[] {
  const expected = resolveWeakestTruthState(states);
  if (expected === null) return ['at least one input truth state is required'];
  return expected === derivedState
    ? []
    : [`derived truth state must equal weakest input state: ${expected}`];
}
