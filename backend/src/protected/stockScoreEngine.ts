/**
 * STOCK SCORE ENGINE — SS-1.0-R3 (LOCKED)
 * Status: IMPLEMENTATION — RUNTIME TESTED (see tests/engines.test.ts and
 * tests/module8-9-engines-audit.test.ts). Formula (weights/clamp/redistribution
 * math) unchanged since Module 1-2.
 *
 * Finding 9-A (flagged in docs/ROTATION_STOCKSCORE_AUDIT.md) — CLOSED,
 * Owner-authorized (Option A): `catalyst` now has a runtime guard mirroring
 * riskPenalty's existing bound-check. This is a defensive input-validation
 * addition, not a formula/weight/clamp change — the four valid catalyst
 * values (0, 4, 8, 12) and their effect on the score are unchanged.
 *
 * GOVERNANCE: Locked formula. Do not modify weights or clamp logic without
 * explicit Owner-approved revision (see /docs/GOVERNANCE.md).
 *
 * Stock Score → Rotation = FORBIDDEN. Stock Score → Theme = FORBIDDEN.
 * This module must never import from rotationEngine.ts.
 */

const VALID_CATALYST_VALUES = [0, 4, 8, 12];

const WEIGHTS = {
  momentum: 0.22,
  earningsMomentum: 0.18,
  businessQuality: 0.16,
  relativeStrength: 0.10,
  valuation: 0.10,
  trendQuality: 0.08,
  volumeConfirmation: 0.08,
  growthVisibility: 0.08,
};

export interface ScoreComponents {
  momentum: number | null;
  earningsMomentum: number | null;
  businessQuality: number | null;
  relativeStrength: number | null;
  valuation: number | null;
  trendQuality: number | null;
  volumeConfirmation: number | null;
  growthVisibility: number | null;
}

export interface StockScoreInput {
  components: ScoreComponents; // each 0-100, or null if missing
  riskPenalty: number; // must be in [-30, 0]
  catalyst: 0 | 4 | 8 | 12;
  isSuspendedOrDelisted: boolean;
}

export interface StockScoreResult {
  base: number;
  riskPenalty: number;
  catalyst: number;
  finalScore: number | null; // null = N/A (suspended/delisted)
  redistributedWeights: Record<string, number>;
  formulaVersion: 'SS-1.0-R3';
}

/**
 * Missing-component redistribution: remove the missing block's weight,
 * redistribute proportionally across remaining blocks, capped at 1.25x
 * each block's original weight (per Master Guide Section 9 note).
 */
function redistributeWeights(components: ScoreComponents): Record<string, number> {
  const entries = Object.entries(WEIGHTS) as [keyof ScoreComponents, number][];
  const present = entries.filter(([key]) => components[key] !== null);
  const missingWeight = entries
    .filter(([key]) => components[key] === null)
    .reduce((sum, [, w]) => sum + w, 0);

  if (missingWeight === 0 || present.length === 0) {
    return Object.fromEntries(entries);
  }

  const presentWeightSum = present.reduce((sum, [, w]) => sum + w, 0);
  const result: Record<string, number> = {};

  for (const [key, w] of entries) {
    if (components[key] === null) {
      result[key] = 0;
      continue;
    }
    const proportionalAdd = missingWeight * (w / presentWeightSum);
    const cap = w * 1.25;
    result[key] = Math.min(w + proportionalAdd, cap);
  }

  return result;
}

/**
 * Core Stock Score SS-1.0-R3 calculation. Pure function — no I/O.
 */
export function calculateStockScore(input: StockScoreInput): StockScoreResult {
  const { components, riskPenalty, catalyst, isSuspendedOrDelisted } = input;

  if (isSuspendedOrDelisted) {
    return {
      base: 0,
      riskPenalty,
      catalyst,
      finalScore: null, // N/A
      redistributedWeights: {},
      formulaVersion: 'SS-1.0-R3',
    };
  }

  if (riskPenalty < -30 || riskPenalty > 0) {
    throw new Error('riskPenalty out of bounds [-30, 0]');
  }

  // Post-audit fix (Finding 9-A, Owner-authorized): catalyst was typed
  // 0|4|8|12 but had NO runtime check — a caller outside TypeScript's
  // compile-time guarantee (e.g. data read from JSON/DB once the API
  // layer exists) could pass an out-of-set value and it would silently
  // be added into the score. Same defensive pattern as riskPenalty above.
  if (!VALID_CATALYST_VALUES.includes(catalyst)) {
    throw new Error(`catalyst must be one of ${VALID_CATALYST_VALUES.join(', ')}, got: ${catalyst}`);
  }

  const weights = redistributeWeights(components);
  let base = 0;
  for (const key of Object.keys(weights) as (keyof ScoreComponents)[]) {
    const value = components[key];
    if (value !== null) {
      base += weights[key] * value;
    }
  }

  const finalScore = Math.max(0, Math.min(100, base + riskPenalty + catalyst));

  return {
    base,
    riskPenalty,
    catalyst,
    finalScore,
    redistributedWeights: weights,
    formulaVersion: 'SS-1.0-R3',
  };
}
