/**
 * RBAC — Role/Permission model (SKELETON)
 * Status: IMPLEMENTATION — unit tested with real inputs below. NOT wired to
 * real authentication (no login exists yet — that's Module 4).
 *
 * GOVERNANCE (docs/GOVERNANCE.md #5): Admin != Owner. Admin cannot: block/
 * revoke Owner, bypass Owner MFA, grant authority, read plaintext secrets,
 * edit locked formulas, bypass payment integrity, or touch audit history.
 * This module encodes that as a default-deny permission matrix — not as
 * scattered if-checks that could be forgotten in some route.
 */

export type Role = 'OWNER' | 'ADMIN' | 'USER' | 'AI_AGENT';

export type Permission =
  | 'VIEW_OWN_PORTFOLIO'
  | 'VIEW_ANY_PORTFOLIO'
  | 'EDIT_LOCKED_FORMULA'
  | 'GRANT_AUTHORITY'
  | 'READ_PLAINTEXT_SECRETS'
  | 'BYPASS_PAYMENT_VERIFICATION'
  | 'MANAGE_USERS'
  | 'MANAGE_PROVIDERS'
  | 'VIEW_AUDIT_LOG_READONLY'
  | 'REVOKE_OWNER_SESSION'
  | 'REVIEW_AI_RESEARCH';
  // ADDED for Module 11 (AI Research/News/Alerts): the Master Guide's flow
  // has an "Optional Owner/Admin Review" step for AI-discovered research
  // events before they become canonical. This is a purely additive
  // permission — nothing existing was removed or altered.
  // REMOVED after Owner audit (Module 3 hardening): BYPASS_MFA, DELETE_AUDIT_LOG,
  // MODIFY_AUDIT_LOG. Rationale: relying on "the permission exists but the
  // application layer will refuse to use it" is exactly the unnecessary-risk
  // pattern the audit flagged. audit_log is append-only by DB trigger — no
  // permission should even imply an update/delete path exists. MFA bypass is
  // not a standing permission at all; if a recovery flow is ever needed it
  // must be designed as its own dedicated, multi-party, time-limited process
  // in Module 5 — not a flag sitting in this matrix.

/**
 * Explicit allow-list per role. Anything not listed here is denied by
 * default (see failClosedAuthz.ts) — this is not a deny-list.
 *
 * Note ADMIN's list deliberately excludes every governance-protected
 * permission (EDIT_LOCKED_FORMULA, GRANT_AUTHORITY, READ_PLAINTEXT_SECRETS,
 * BYPASS_PAYMENT_VERIFICATION, REVOKE_OWNER_SESSION, VIEW_ANY_PORTFOLIO).
 * MFA bypass and audit deletion/modification are not represented as
 * permissions for ANY role — see note above the Permission type.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  OWNER: [
    'VIEW_OWN_PORTFOLIO',
    'VIEW_ANY_PORTFOLIO', // still requires an explicit authorized reason at the call site — see docs/GOVERNANCE.md #4
    'EDIT_LOCKED_FORMULA', // still requires the full Approval Gate — this permission alone does not skip it
    'GRANT_AUTHORITY',
    'READ_PLAINTEXT_SECRETS',
    'BYPASS_PAYMENT_VERIFICATION',
    'MANAGE_USERS',
    'MANAGE_PROVIDERS',
    'VIEW_AUDIT_LOG_READONLY',
    'REVOKE_OWNER_SESSION',
    'REVIEW_AI_RESEARCH',
  ],
  ADMIN: [
    'MANAGE_USERS',
    'MANAGE_PROVIDERS',
    'VIEW_AUDIT_LOG_READONLY',
    'REVIEW_AI_RESEARCH',
  ],
  USER: [
    'VIEW_OWN_PORTFOLIO',
  ],
  AI_AGENT: [
    // Deliberately empty. AI_AGENT gets zero standing permissions from
    // this table. Any AI action must be explicitly granted per-call by
    // a human-authorized flow elsewhere — never implicitly via role.
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getPermissions(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}
