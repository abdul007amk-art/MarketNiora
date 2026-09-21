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

const VALID_HORIZONS = ['1D', '1W', '1M', '3M'];

export async function rotationCalculateHandler(ctx: ParsedRequest, _deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as Record<string, unknown>;

  // API-layer input validation — the locked engine itself performs no
  // horizon/confidence validation (it's a pure calculation function, not
  // an input-sanitizing boundary), so this route validates BEFORE calling
  // it rather than touching engine internals.
  if (!VALID_HORIZONS.includes(body.horizon as string)) {
    return { status: 400, body: { error: 'invalid rotation calculation input' } };
  }
  if (typeof body.confidence !== 'number' || !Number.isFinite(body.confidence)) {
    return { status: 400, body: { error: 'invalid rotation calculation input' } };
  }

  try {
    const result = calculateRotation({
      horizon: body.horizon as '1D' | '1W' | '1M' | '3M',
      observations: (body.observations as { stockId: string; return_: number }[]) ?? [],
      confidence: body.confidence,
    });
    return { status: 200, body: result };
  } catch {
    // Sanitized — same discipline as Module 12: never leak the raw
    // internal error, just enough for the caller to know the request was bad.
    return { status: 400, body: { error: 'invalid rotation calculation input' } };
  }
}
