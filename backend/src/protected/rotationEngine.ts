/**
 * ROTATION ENGINE — v1.2 (LOCKED)
 * Status: IMPLEMENTATION — RUNTIME TESTED (see tests/engines.test.ts and
 * tests/module8-9-engines-audit.test.ts). Formula unchanged since Module 1-2.
 *
 * GOVERNANCE: This formula is locked. Do not modify weights, caps, or logic
 * without an explicit Owner-approved formula revision (see /docs/GOVERNANCE.md).
 *
 * Rotation → Stock Score = FORBIDDEN. This module must never import from
 * or export into stockScoreEngine.ts.
 */

export type Horizon = '1D' | '1W' | '1M' | '3M';

const HORIZON_CAPS: Record<Horizon, number> = {
  '1D': 0.08,
  '1W': 0.12,
  '1M': 0.20,
  '3M': 0.30,
};

const WEIGHTS = {
  medianReturn: 0.40,
  participation: 0.30,
  ewCappedReturn: 0.20,
  iqrConsistency: 0.10,
};

const CONF_MIN = 30;
const N_REF = 20;

export interface RawObservation {
  stockId: string;
  return_: number; // as decimal, e.g. 0.05 = 5%
}

export interface RotationInput {
  horizon: Horizon;
  observations: RawObservation[]; // observations already scoped to ONE group/sub-sector/sector
  confidence: number; // 0-100, data reliability gate — NOT a multiplier
}

export interface RotationResult {
  medianReturn: number;
  participation: number;
  ewCappedReturn: number;
  iqrConsistency: number;
  finalScore: number | null; // null if excluded by confidence gate
  includedByConfidence: boolean;
  formulaVersion: 'ROTATION-1.2';
}

function cap(value: number, horizon: Horizon): number {
  const c = HORIZON_CAPS[horizon];
  return Math.max(-c, Math.min(c, value));
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function interquartileRange(values: number[]): number {
  if (values.length < 4) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return q3 - q1;
}

/**
 * Core Rotation v1.2 calculation. Pure function — no I/O.
 * Caller is responsible for pre-scoping observations to the correct
 * level (Stock Group / Sub-sector / Sector) before calling this.
 */
export function calculateRotation(input: RotationInput): RotationResult {
  const { horizon, observations, confidence } = input;

  const includedByConfidence = confidence >= CONF_MIN;

  const returns = observations.map((o) => o.return_);
  const cappedReturns = returns.map((r) => cap(r, horizon));

  const medianReturn = median(cappedReturns);

  // Participation: proportion of observations with positive capped return
  const positiveCount = cappedReturns.filter((r) => r > 0).length;
  const participation = observations.length > 0 ? positiveCount / observations.length : 0;

  // Equal-weighted capped return: simple average of capped returns
  const ewCappedReturn =
    cappedReturns.length > 0 ? cappedReturns.reduce((a, b) => a + b, 0) / cappedReturns.length : 0;

  // IQR Consistency: inverse of dispersion, normalized against N_REF sample size expectation
  const iqr = interquartileRange(cappedReturns);
  const iqrConsistency = observations.length >= N_REF ? Math.max(0, 1 - iqr) : Math.max(0, 1 - iqr) * (observations.length / N_REF);

  const weightedScore =
    WEIGHTS.medianReturn * medianReturn +
    WEIGHTS.participation * participation +
    WEIGHTS.ewCappedReturn * ewCappedReturn +
    WEIGHTS.iqrConsistency * iqrConsistency;

  return {
    medianReturn,
    participation,
    ewCappedReturn,
    iqrConsistency,
    finalScore: includedByConfidence ? weightedScore : null,
    includedByConfidence,
    formulaVersion: 'ROTATION-1.2',
  };
}
