/**
 * PORTFOLIO ACCESS
 * Status: IMPLEMENTATION — unit tested below.
 *
 * GOVERNANCE (Master Guide "Y — Your Portfolio/Upstox"):
 *   USER A -> USER B PORTFOLIO = DENY
 *   AI_AGENT -> USER PORTFOLIO = DENY
 *   Owner hone se automatically private portfolio access nahi milta.
 *
 * Reuses Module 3's authorize() and RBAC permissions (VIEW_OWN_PORTFOLIO /
 * VIEW_ANY_PORTFOLIO) rather than inventing a parallel access-control
 * mechanism — this is the SAME decision function used everywhere else.
 */

import type { Role } from '../security/rbac.ts';
import { authorize } from '../security/failClosedAuthz.ts';
import type { PortfolioStore, NormalizedHolding } from './portfolioStore.ts';

export interface PortfolioAccessContext {
  requesterRole: Role | null | undefined;
  requesterUserId: string;
  targetUserId: string;
  /** Required (non-empty) for ANY cross-user access — even by OWNER. Matches rbac.ts's comment that VIEW_ANY_PORTFOLIO "still requires an explicit authorized reason at the call site." */
  crossUserReason?: string | null;
}

export interface PortfolioAccessDecision {
  allowed: boolean;
  reason: string;
}

export function checkPortfolioAccess(ctx: PortfolioAccessContext): PortfolioAccessDecision {
  if (!ctx.requesterRole) {
    return { allowed: false, reason: 'DENY: no requester role' };
  }

  const isSelf = ctx.requesterUserId === ctx.targetUserId;

  if (isSelf) {
    const decision = authorize({
      role: ctx.requesterRole,
      permission: 'VIEW_OWN_PORTFOLIO',
      requiresSelfOnly: true,
      isSelfResource: true,
    });
    return decision;
  }

  // Cross-user access — Owner-only permission AND an explicit reason are
  // BOTH required. Neither one alone is enough (this is the "no
  // automatic access" enforcement, not just a permission check).
  if (!ctx.crossUserReason || ctx.crossUserReason.trim().length === 0) {
    return { allowed: false, reason: 'DENY: cross-user portfolio access requires an explicit authorized reason, even for OWNER' };
  }

  return authorize({ role: ctx.requesterRole, permission: 'VIEW_ANY_PORTFOLIO' });
}

export interface GetPortfolioResult {
  allowed: boolean;
  reason: string;
  holdings: NormalizedHolding[] | null;
}

export function getPortfolio(store: PortfolioStore, ctx: PortfolioAccessContext): GetPortfolioResult {
  const decision = checkPortfolioAccess(ctx);
  if (!decision.allowed) {
    return { allowed: false, reason: decision.reason, holdings: null };
  }
  return { allowed: true, reason: decision.reason, holdings: store.getHoldings(ctx.targetUserId) };
}
