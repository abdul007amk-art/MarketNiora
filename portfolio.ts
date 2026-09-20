/**
 * PORTFOLIO ROUTE
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests.
 *
 * The privacy boundary is enforced by Module 12's checkPortfolioAccess()
 * (which itself reuses Module 3's authorize()) — this route does not
 * duplicate or reinvent that logic, only resolves the caller's identity
 * from the session (never from a client-claimed field) and delegates.
 */

import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { resolveIdentity } from '../requestAuth.ts';
import { getPortfolio } from '../../portfolio/portfolioAccess.ts';

export async function getPortfolioHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const identity = resolveIdentity(ctx, deps);
  if (!identity) {
    return { status: 401, body: { error: 'not authenticated' } };
  }

  const targetUserId = ctx.params.userId;
  const crossUserReason = ctx.query.get('reason');

  const result = getPortfolio(deps.portfolioStore, {
    requesterRole: identity.role,
    requesterUserId: identity.userId,
    targetUserId,
    crossUserReason,
  });

  if (!result.allowed) {
    return { status: 403, body: { error: 'access denied' } };
  }
  return { status: 200, body: { holdings: result.holdings } };
}
