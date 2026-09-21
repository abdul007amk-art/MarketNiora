/**
 * REQUEST AUTH
 * Status: IMPLEMENTATION — unit tested below (via route-level tests).
 *
 * Single place every protected route uses to resolve "who is this
 * request from" — resolves ONLY from the session cookie against the
 * server-side SessionStore (Module 4's validateSession), never from any
 * client-claimed field. Fail-closed: any problem resolves to null.
 */

import type { ParsedRequest } from './router.ts';
import type { AppDependencies } from './dependencies.ts';
import { validateSession } from '../auth/sessionManager.ts';
import type { Role } from '../security/rbac.ts';

export interface RequestIdentity {
  userId: string;
  role: Role;
}

export function resolveIdentity(ctx: ParsedRequest, deps: AppDependencies): RequestIdentity | null {
  const token = ctx.cookies['session_token'];
  if (!token) return null;

  const check = validateSession(deps.sessionStore, token);
  if (!check.valid) return null;

  const session = deps.sessionStore.get(token);
  if (!session) return null;

  return { userId: session.userId, role: session.role };
}
