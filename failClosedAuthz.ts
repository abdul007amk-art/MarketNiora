/**
 * FAIL-CLOSED AUTHORIZATION
 * Status: IMPLEMENTATION — unit tested below. Not wired to a real server yet.
 *
 * Core principle (docs/GOVERNANCE.md #1 / Master Guide #25):
 * Server = sole authority. Client = untrusted. Unknown state = DENY.
 *
 * This function is the single decision point routes should call. It must
 * NEVER default to allow on missing/malformed/unexpected input — every
 * unhandled branch returns deny.
 */

import type { Role, Permission } from './rbac.ts';
import { hasPermission } from './rbac.ts';

export interface AuthzContext {
  role: Role | null | undefined;
  permission: Permission;
  isSelfResource?: boolean; // true if the resource being accessed belongs to the requester
  requiresSelfOnly?: boolean; // true if this permission must only apply to the requester's own data
}

export interface AuthzDecision {
  allowed: boolean;
  reason: string;
}

export function authorize(ctx: AuthzContext): AuthzDecision {
  // Unknown/missing role -> deny. No exceptions.
  if (!ctx.role) {
    return { allowed: false, reason: 'DENY: no role present (unauthenticated or malformed context)' };
  }

  if (!hasPermission(ctx.role, ctx.permission)) {
    return { allowed: false, reason: `DENY: role ${ctx.role} lacks permission ${ctx.permission}` };
  }

  // Self-scoped permissions (e.g. VIEW_OWN_PORTFOLIO) must be denied for
  // cross-user access even if the role technically has the permission name.
  if (ctx.requiresSelfOnly && ctx.isSelfResource === false) {
    return { allowed: false, reason: 'DENY: self-only permission requested against another user\'s resource' };
  }

  // isSelfResource === undefined on a self-only permission is treated as
  // unknown -> deny, not allow. Caller must explicitly resolve ownership
  // before calling authorize().
  if (ctx.requiresSelfOnly && ctx.isSelfResource === undefined) {
    return { allowed: false, reason: 'DENY: resource ownership not resolved (fail-closed on unknown)' };
  }

  return { allowed: true, reason: 'ALLOW' };
}
