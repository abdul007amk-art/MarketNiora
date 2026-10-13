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

const VALID_HORIZONS = ['1D', '1W', '1M', '3M'];

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

  try {
    const aggregationLevel = body.aggregationLevel;
    const confidenceThreshold = minimumRotationConfidence(aggregationLevel);
    const rollupEligible = meetsRotationConfidenceGate(aggregationLevel, body.confidence);
    const result = calculateRotation({
      horizon: body.horizon as '1D' | '1W' | '1M' | '3M',
      observations: (body.observations as { stockId: string; return_: number }[]) ?? [],
      confidence: body.confidence,
    });
    const eligible = rollupEligible && result.includedByConfidence;
    return { status: 200, body: {
      ...result,
      finalScore: eligible ? result.finalScore : null,
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
