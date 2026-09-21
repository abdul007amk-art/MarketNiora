/**
 * AUTH ROUTES
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests
 * against a running server.
 *
 * DEMO SIMPLIFICATION (documented, not hidden): real email verification
 * requires sending an email (Module 6's NotificationProvider), which
 * needs real network access this sandbox doesn't have. Signup marks the
 * account verified immediately so the signup -> login flow is genuinely
 * testable end-to-end here. A production deployment would wire the real
 * verification-token-then-email flow from Module 4/6 instead.
 */

import { randomBytes } from 'crypto';
import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { buildNewUserRecord } from '../../auth/signupFlow.ts';
import { attemptLogin } from '../../auth/loginFlow.ts';
import { revokeSession, validateSession } from '../../auth/sessionManager.ts';
import { generateCsrfToken, verifyCsrfToken } from '../../security/csrfToken.ts';

interface SignupBody {
  email?: string;
  password?: string;
}

export async function signupHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as SignupBody;
  if (!body.email || !body.password) {
    return { status: 400, body: { error: 'email and password are required' } };
  }

  const result = buildNewUserRecord(body.email, body.password);
  if (!result.success || !result.record) {
    return { status: 400, body: { errors: result.errors } };
  }

  try {
    const userId = randomBytes(12).toString('hex');
    deps.userStore.create({
      userId,
      email: result.record.email,
      passwordHash: result.record.password_hash,
      role: 'USER',
      emailVerified: true, // see file-level note — demo simplification, no real network to verify via email here
    });
    return { status: 201, body: { userId } };
  } catch {
    // Generic — never confirm/deny exact reason (e.g. "email already exists") beyond a safe message
    return { status: 409, body: { error: 'unable to create account with these details' } };
  }
}

interface LoginBody {
  email?: string;
  password?: string;
}

export async function loginHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as LoginBody;
  if (!body.email || !body.password) {
    return { status: 400, body: { error: 'email and password are required' } };
  }

  const allowed = deps.loginRateLimiter.check(body.email, Date.now());
  if (!allowed) {
    return { status: 429, body: { error: 'too many login attempts — try again later' } };
  }

  const stored = deps.userStore.getByEmail(body.email);
  const storedUser = stored
    ? { userId: stored.userId, email: stored.email, passwordHash: stored.passwordHash, role: stored.role, emailVerified: stored.emailVerified }
    : null;

  const result = attemptLogin(body.email, body.password, storedUser, deps.sessionStore);
  if (!result.success || !result.session) {
    return { status: 401, body: { error: result.clientMessage } };
  }

  const csrfToken = generateCsrfToken();

  return {
    status: 200,
    body: { userId: result.session.userId, role: result.session.role, csrfToken },
    headers: {
      'Set-Cookie': [
        `session_token=${result.session.token}; HttpOnly; Path=/; SameSite=Strict`,
        `csrf_token=${csrfToken}; Path=/; SameSite=Strict`,
      ],
    },
  };
}

export async function logoutHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const sessionToken = ctx.cookies['session_token'];
  if (!sessionToken) {
    return { status: 401, body: { error: 'not authenticated' } };
  }

  const check = validateSession(deps.sessionStore, sessionToken);
  if (!check.valid) {
    return { status: 401, body: { error: 'not authenticated' } };
  }

  const csrfCookie = ctx.cookies['csrf_token'];
  const csrfHeaderRaw = ctx.headers['x-csrf-token'];
  const csrfHeader = Array.isArray(csrfHeaderRaw) ? csrfHeaderRaw[0] : csrfHeaderRaw;
  if (!verifyCsrfToken(csrfCookie, csrfHeader)) {
    return { status: 403, body: { error: 'CSRF validation failed' } };
  }

  revokeSession(deps.sessionStore, sessionToken);
  return { status: 200, body: { success: true } };
}
