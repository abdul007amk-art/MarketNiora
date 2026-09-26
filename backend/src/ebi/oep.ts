/**
 * CHUNK 5 — OEP-1.0
 * Output/evidence presentation contract. No ranking or score is generated.
 *
 * Truth-state vocabulary and precedence are inherited from locked CHUNK 0.
 * Truth state remains separate from calculation classification.
 */

export const EBI_TRUTH_STATES = [
  'LIVE',
  'VERIFIED',
  'DELAYED',
  'STALE',
  'PENDING',
  'RESEARCH REQUIRED',
  'REVIEW/CONFLICT',
  'NOT CONFIGURED',
  'UNAVAILABLE',
] as const;

export type EbiTruthState = typeof EBI_TRUTH_STATES[number];

const TRUTH_STATE_RANK: Record<EbiTruthState, number> = {
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

export function isEbiTruthState(value: string): value is EbiTruthState {
  return (EBI_TRUTH_STATES as readonly string[]).includes(value);
}

export function resolveDerivedTruthState(states: EbiTruthState[]): EbiTruthState {
  if (states.length === 0) {
    throw new Error('at least one truth state is required');
  }
  return states.reduce((weakest, current) =>
    TRUTH_STATE_RANK[current] > TRUTH_STATE_RANK[weakest] ? current : weakest,
  );
}

export interface OepOutput {
  title: string;
  primaryOutput: string | null;
  keyEvidence: string[];
  trendDirection: string | null;
  confidence: string | null;
  truthState: string;
  dataCoverage: number | null;
  source: string | null;
  lastUpdated: string | null;
}

export function validateOepOutput(o: OepOutput): string[] {
  const errors: string[] = [];

  if (!o.title.trim()) errors.push('title is required');
  if (!isEbiTruthState(o.truthState)) {
    errors.push('truthState is not an authoritative CHUNK 0 truth state');
  }
  if (!Array.isArray(o.keyEvidence)) {
    errors.push('keyEvidence must be an array');
  } else if (o.keyEvidence.some((e) => typeof e !== 'string' || !e.trim())) {
    errors.push('keyEvidence entries must be non-empty strings');
  }
  if (
    o.dataCoverage !== null &&
    (!Number.isFinite(o.dataCoverage) || o.dataCoverage < 0 || o.dataCoverage > 100)
  ) {
    errors.push('dataCoverage must be null or a finite percentage from 0 to 100');
  }
  if (o.source !== null && !o.source.trim()) {
    errors.push('source must be null or a non-empty string');
  }
  if (o.lastUpdated !== null && Number.isNaN(Date.parse(o.lastUpdated))) {
    errors.push('lastUpdated must be null or a valid date-time string');
  }
  return errors;
}
