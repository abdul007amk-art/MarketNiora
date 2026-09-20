/**
 * LOGIN FLOW
 * Status: IMPLEMENTATION — unit tested below. NOT wired to a real DB —
 * caller must fetch `storedUser` themselves (that lookup doesn't exist yet).
 *
 * Security property: whether the email doesn't exist, or the password is
 * wrong, or the account is unverified, the caller-facing result message is
 * the SAME generic string. This prevents user enumeration via error-message
 * differences. Only the internal `reason` field differs, for server-side
 * logging/audit — never send `reason` to the client as-is.
 */

import { verifyPassword } from './passwordHashing.ts';
import { issueSession } from './sessionManager.ts';
import type { Session, SessionStore } from './sessionManager.ts';
import type { Role } from '../security/rbac.ts';

export interface StoredUser {
  userId: string;
  email: string;
  passwordHash: string;
  role: Role;
  emailVerified: boolean;
}

export interface LoginResult {
  success: boolean;
  session: Session | null;
  clientMessage: string; // always this generic string on failure — safe to send to the client
  internalReason: string; // for server-side audit logging only, never send to client
}

const GENERIC_FAILURE_MESSAGE = 'Invalid email or password.';

export function attemptLogin(
  email: string,
  password: string,
  storedUser: StoredUser | null,
  sessionStore: SessionStore,
  now: number = Date.now()
): LoginResult {
  if (!storedUser) {
    return { success: false, session: null, clientMessage: GENERIC_FAILURE_MESSAGE, internalReason: 'no user found for email' };
  }

  if (storedUser.email !== email) {
    // Defensive: caller should have looked up by this exact email already.
    return { success: false, session: null, clientMessage: GENERIC_FAILURE_MESSAGE, internalReason: 'email mismatch with provided storedUser' };
  }

  const passwordOk = verifyPassword(password, storedUser.passwordHash);
  if (!passwordOk) {
    return { success: false, session: null, clientMessage: GENERIC_FAILURE_MESSAGE, internalReason: 'incorrect password' };
  }

  if (!storedUser.emailVerified) {
    // Deliberately still generic to the client — do not reveal that the
    // password was actually correct, which would itself leak information.
    return { success: false, session: null, clientMessage: GENERIC_FAILURE_MESSAGE, internalReason: 'email not verified' };
  }

  const session = issueSession(sessionStore, storedUser.userId, storedUser.role, now);
  return { success: true, session, clientMessage: 'ok', internalReason: 'login successful' };
}
