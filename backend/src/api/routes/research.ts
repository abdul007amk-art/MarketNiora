/**
 * RESEARCH ROUTE
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests.
 *
 * The Owner/Admin-only boundary is Module 11's reviewResearchEvent()
 * (RBAC REVIEW_AI_RESEARCH permission) — not reimplemented here.
 */

import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { resolveIdentity } from '../requestAuth.ts';
import { reviewResearchEvent } from '../../research/reviewGate.ts';
import { verifyCsrfToken } from '../../security/csrfToken.ts';

export async function researchReviewHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const identity = resolveIdentity(ctx, deps);
  if (!identity) {
    return { status: 401, body: { error: 'not authenticated' } };
  }

  const csrfCookie = ctx.cookies['csrf_token'];
  const csrfHeaderRaw = ctx.headers['x-csrf-token'];
  const csrfHeader = Array.isArray(csrfHeaderRaw) ? csrfHeaderRaw[0] : csrfHeaderRaw;
  if (!verifyCsrfToken(csrfCookie, csrfHeader)) {
    return { status: 403, body: { error: 'CSRF validation failed' } };
  }

  const body = (ctx.body ?? {}) as Record<string, unknown>;
  if (!body.event) {
    return { status: 400, body: { error: 'event is required' } };
  }

  const result = reviewResearchEvent(body.event as never, identity.role, body.decision as never);
  if (!result.allowed) {
    return { status: 403, body: { error: result.reason } };
  }
  return { status: 200, body: { event: result.event } };
}
