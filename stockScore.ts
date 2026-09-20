/**
 * STOCK SCORE ROUTE
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests.
 *
 * Thin HTTP wrapper around the LOCKED stockScoreEngine.ts — no formula
 * logic here. Public (no auth required), same as rotation.
 */

import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { calculateStockScore } from '../../protected/stockScoreEngine.ts';

export async function stockScoreCalculateHandler(ctx: ParsedRequest, _deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  try {
    const result = calculateStockScore({
      components: body.components as never,
      riskPenalty: body.riskPenalty as number,
      catalyst: body.catalyst as 0 | 4 | 8 | 12,
      isSuspendedOrDelisted: Boolean(body.isSuspendedOrDelisted),
    });
    return { status: 200, body: result };
  } catch {
    return { status: 400, body: { error: 'invalid stock score calculation input' } };
  }
}
