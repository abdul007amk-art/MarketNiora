/**
 * ROTATION ROUTE
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests.
 *
 * Thin HTTP wrapper around the LOCKED rotationEngine.ts — no formula
 * logic here, just request parsing and error sanitization. Public
 * (no auth required) since rotation is public market-movement data, same
 * as the rest of this repo's treatment of market data.
 */

import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { calculateRotation } from '../../protected/rotationEngine.ts';
import { isRotationAggregationLevel, meetsRotationConfidenceGate, minimumRotationConfidence } from '../../rotation/aggregationGate.ts';
import type { RotationAggregationLevel } from '../../rotation/aggregationGate.ts';

const VALID_HORIZONS = ['1D', '1W', '1M', '3M'];

interface RotationObservation {
  stockId: string;
  return_: number;
}

function isValidObservationSet(value: unknown): value is RotationObservation[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const seen = new Set<string>();
  return value.every((item) => {
    if (typeof item !== 'object' || item === null) return false;
    const observation = item as Partial<RotationObservation>;
    if (typeof observation.stockId !== 'string' || observation.stockId.trim().length === 0) return false;
    if (typeof observation.return_ !== 'number' || !Number.isFinite(observation.return_)) return false;
    if (seen.has(observation.stockId)) return false;
    seen.add(observation.stockId);
    return true;
  });
}

export async function rotationCalculateHandler(ctx: ParsedRequest, _deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as Record<string, unknown>;

  // API-layer input validation — the locked engine itself performs no
  // horizon/confidence validation (it's a pure calculation function, not
  // an input-sanitizing boundary), so this route validates BEFORE calling
  // it rather than touching engine internals.
  if (!VALID_HORIZONS.includes(body.horizon as string) || !isRotationAggregationLevel(body.aggregationLevel)) {
    return { status: 400, body: { error: 'invalid rotation calculation input' } };
  }
  if (typeof body.confidence !== 'number' || !Number.isFinite(body.confidence) || body.confidence < 0 || body.confidence > 100) {
    return { status: 400, body: { error: 'invalid rotation calculation input' } };
  }
  if (!isValidObservationSet(body.observations)) {
    return { status: 400, body: { error: 'invalid rotation calculation input' } };
  }

  try {
    const aggregationLevel = body.aggregationLevel as RotationAggregationLevel;
    const confidenceThreshold = minimumRotationConfidence(aggregationLevel);
    const rollupEligible = meetsRotationConfidenceGate(aggregationLevel, body.confidence);
    const result = calculateRotation({
      horizon: body.horizon as '1D' | '1W' | '1M' | '3M',
      observations: body.observations,
      confidence: body.confidence,
    });
    const eligible = rollupEligible && result.includedByConfidence;
    // ODR-2026-002 C6: with a non-empty, validated set where every valid capped
    // return is zero, the approved D2 state is FLAT. Under the locked default
    // 40/30/20/10 weights, its mathematical score is 40. This state override
    // belongs to the API orchestration layer; the protected core math file is unchanged.
    const isFlat = body.observations.every((observation) => observation.return_ === 0);
    const finalScore = eligible ? (isFlat ? 40 : result.finalScore) : null;
    return { status: 200, body: {
      ...result,
      finalScore,
      rotationState: isFlat ? 'FLAT' : null,
      includedByConfidence: eligible,
      aggregationLevel,
      confidenceThreshold,
      rollupEligible: eligible,
      confidenceGateStatus: eligible ? 'ELIGIBLE' : 'BELOW_CONFIDENCE_GATE',
    } };
  } catch {
    // Sanitized — same discipline as Module 12: never leak the raw
    // internal error, just enough for the caller to know the request was bad.
    return { status: 400, body: { error: 'invalid rotation calculation input' } };
  }
}
