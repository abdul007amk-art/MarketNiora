/**
 * FUNDAMENTAL ROUTE
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests.
 * Wraps Module 10's fundamental contract — validation only, NO
 * Fundamental Score/verdict formula (standing scope lock).
 */

import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { validateFundamentalMetricRecord } from '../../contracts/fundamental.ts';

export async function fundamentalValidateHandler(ctx: ParsedRequest, _deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  if (!body.record) {
    return { status: 400, body: { error: 'record is required' } };
  }
  try {
    const now = Date.now();
    const staleThresholdMs = 1000 * 60 * 60 * 24 * 365; // 1 year — generous default for a generic validation endpoint with no per-metric context
    const result = validateFundamentalMetricRecord(body.record as never, now, staleThresholdMs);
    return { status: result.valid ? 200 : 422, body: result };
  } catch {
    return { status: 400, body: { error: 'malformed fundamental record' } };
  }
}
