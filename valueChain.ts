/**
 * VALUE CHAIN ROUTE
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests.
 * Wraps Module 10's value chain contract.
 */

import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { validateValueChainEntry } from '../../contracts/valueChain.ts';

export async function valueChainValidateHandler(ctx: ParsedRequest, _deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  if (!body.entry) {
    return { status: 400, body: { error: 'entry is required' } };
  }
  try {
    const result = validateValueChainEntry(body.entry as never);
    return { status: result.valid ? 200 : 422, body: result };
  } catch {
    return { status: 400, body: { error: 'malformed value chain entry' } };
  }
}
