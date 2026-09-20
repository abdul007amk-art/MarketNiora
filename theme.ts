/**
 * THEME ROUTE
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests.
 * Wraps Module 10's theme contract (structural classification only — NO
 * Theme Score, per the standing scope lock).
 */

import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { getThemesForStock } from '../../contracts/theme.ts';

export async function themeResolveHandler(ctx: ParsedRequest, _deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  if (!body.stockId || typeof body.stockId !== 'string') {
    return { status: 400, body: { error: 'stockId is required' } };
  }
  try {
    const themeIds = getThemesForStock(
      body.stockId,
      (body.memberships as never) ?? [],
      (body.industries as never) ?? [],
      (body.subThemes as never) ?? []
    );
    return { status: 200, body: { themeIds } };
  } catch {
    return { status: 400, body: { error: 'invalid theme resolution input' } };
  }
}
