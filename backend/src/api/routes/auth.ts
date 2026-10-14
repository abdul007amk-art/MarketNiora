/** AUTH ROUTES — Google OIDC only. Blueprint v1.1 / ODR-2026-001. */
import { randomUUID } from 'crypto';
import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { issueSession, revokeSession, validateSession } from '../../auth/sessionManager.ts';
import { generateCsrfToken, verifyCsrfToken } from '../../security/csrfToken.ts';
import { beginOwnerMfa, verifyOwnerMfa, provisionOwnerTotp, confirmOwnerTotp } from '../../auth/ownerMfa.ts';
import type { StoredUser } from '../userStore.ts';
import { buildSessionCookieHeaders } from '../sessionCookies.ts';

interface OidcBody { idToken?: string; }
interface OwnerMfaBody { challenge?: string; code?: string; }
interface OwnerTotpBody { idToken?: string; code?: string; }
type OwnerIdentityResolution = { user: StoredUser } | { error: RouteResult };
function ownerEmails(): Set<string> { return new Set((process.env.OWNER_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)); }

function authenticationRateLimit(ctx: ParsedRequest, deps: AppDependencies, scope: 'oidc-login' | 'owner-mfa' | 'owner-totp-provision' | 'owner-totp-confirm'): RouteResult | null {
  const clientIp = typeof ctx.clientIp === 'string' && ctx.clientIp.trim()
    ? ctx.clientIp.trim()
    : 'unknown';
  const key = `auth:${scope}:${clientIp}`;

  if (deps.loginRateLimiter.check(key)) return null;

  const retryAfterSeconds = Math.max(1, deps.loginRateLimiter.retryAfterSeconds(key));
  return {
    status: 429,
    body: { error: 'too many authentication attempts' },
    headers: { 'Retry-After': String(retryAfterSeconds), 'Cache-Control': 'no-store' },
  };
}
async function resolveAllowlistedOwner(
  idToken: string,
  deps: AppDependencies,
  createIfMissing: boolean,
): Promise<OwnerIdentityResolution> {
  let identity;
  try {
    identity = await deps.oidcVerifier.verify(idToken);
  } catch {
    return { error: { status: 401, body: { error: 'invalid Google identity token' } } };
  }

  if (!identity.emailVerified) {
    return { error: { status: 401, body: { error: 'Google account email is not verified' } } };
  }

  const email = identity.email.trim().toLowerCase();
  if (!ownerEmails().has(email)) {
    return { error: { status: 403, body: { error: 'owner email is not in the configured allowlist' } } };
  }

  let user = await deps.userStore.getByOidcIdentity(identity.issuer, identity.subject);
  const emailUser = await deps.userStore.getByEmail(email);

  if (user && emailUser && emailUser.userId !== user.userId) {
    return { error: { status: 401, body: { error: 'identity binding mismatch' } } };
  }
  if (!user && emailUser) user = emailUser;
  if (user && (user.oidcIssuer !== identity.issuer || user.oidcSubject !== identity.subject)) {
    return { error: { status: 401, body: { error: 'identity binding mismatch' } } };
  }

  if (!user && !createIfMissing) {
    return { error: { status: 401, body: { error: 'Owner identity is not provisioned; start TOTP enrollment first' } } };
  }

  if (!user) {
    const userId = randomUUID();
    try {
      await deps.userStore.create({
        userId,
        email,
        oidcIssuer: identity.issuer,
        oidcSubject: identity.subject,
        role: 'OWNER',
        emailVerified: true,
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'identity already exists') throw error;
    }
    user = await deps.userStore.getByOidcIdentity(identity.issuer, identity.subject);
    const racedEmailUser = await deps.userStore.getByEmail(email);
    if (!user && racedEmailUser) user = racedEmailUser;
  }

  if (!user) {
    return { error: { status: 500, body: { error: 'owner identity provisioning failed' } } };
  }
  if (user.oidcIssuer !== identity.issuer || user.oidcSubject !== identity.subject) {
    return { error: { status: 401, body: { error: 'identity binding mismatch' } } };
  }

  if (user.email.toLowerCase() !== email) {
    try {
      await deps.userStore.updateVerifiedEmail(user.userId, email);
    } catch (error) {
      if (error instanceof Error && error.message === 'identity already exists') {
        return { error: { status: 401, body: { error: 'identity binding mismatch' } } };
      }
      throw error;
    }
    user = await deps.userStore.getById(user.userId);
    if (!user) return { error: { status: 500, body: { error: 'owner identity provisioning failed' } } };
  }

  if (user.role !== 'OWNER') {
    await deps.userStore.setRole(user.userId, 'OWNER');
    user = await deps.userStore.getById(user.userId);
    if (!user) return { error: { status: 500, body: { error: 'owner identity provisioning failed' } } };
  }

  return { user };
}

function sessionResponse(session: Awaited<ReturnType<typeof issueSession>>): RouteResult {
  const csrfToken = generateCsrfToken();
  return { status: 200, body: { userId: session.userId, role: session.role, csrfToken }, headers: { 'Set-Cookie': buildSessionCookieHeaders(session.token, csrfToken) } };
}
export async function oidcLoginHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const limited = authenticationRateLimit(ctx, deps, 'oidc-login');
  if (limited) return limited;
  const body = (ctx.body ?? {}) as OidcBody;
  if (!body.idToken) return { status: 400, body: { error: 'Google ID token is required' } };
  let identity;
  try { identity = await deps.oidcVerifier.verify(body.idToken); } catch { return { status: 401, body: { error: 'invalid Google identity token' } }; }
  if (!identity.emailVerified) return { status: 401, body: { error: 'Google account email is not verified' } };
  const email = identity.email.trim().toLowerCase();
  const isOwner = ownerEmails().has(email);

  // The stable identity key is the verified issuer + subject, not email.
  // Email remains a uniqueness/collision check; it must never rebind an
  // existing account to a different Google subject.
  let user = await deps.userStore.getByOidcIdentity(identity.issuer, identity.subject);
  const emailUser = await deps.userStore.getByEmail(email);

  if (user && emailUser && emailUser.userId !== user.userId) {
    return { status: 401, body: { error: 'identity binding mismatch' } };
  }

  if (!user && emailUser) {
    user = emailUser;
  }

  if (user && (user.oidcIssuer !== identity.issuer || user.oidcSubject !== identity.subject)) {
    return { status: 401, body: { error: 'identity binding mismatch' } };
  }

  // Do not silently turn an existing Owner into a normal user when the
  // verified Google email is no longer on the explicit Owner allowlist.
  if (user?.role === 'OWNER' && !isOwner) {
    return { status: 403, body: { error: 'owner email is not in the configured allowlist' } };
  }

  if (!user) {
    const userId = randomUUID();
    try {
      await deps.userStore.create({
        userId,
        email,
        oidcIssuer: identity.issuer,
        oidcSubject: identity.subject,
        role: isOwner ? 'OWNER' : 'USER',
        emailVerified: true,
      });
    } catch (error) {
      // Concurrent first logins for the same stable subject may race on the
      // database unique constraint. Re-read only a matching subject/email;
      // never choose an unrelated user.
      if (!(error instanceof Error) || error.message !== 'identity already exists') throw error;
    }
    user = await deps.userStore.getByOidcIdentity(identity.issuer, identity.subject);
    const racedEmailUser = await deps.userStore.getByEmail(email);
    if (!user && racedEmailUser) user = racedEmailUser;
  }

  if (!user) return { status: 500, body: { error: 'identity provisioning failed' } };
  if (user.oidcIssuer !== identity.issuer || user.oidcSubject !== identity.subject) {
    return { status: 401, body: { error: 'identity binding mismatch' } };
  }

  if (user.email.toLowerCase() !== email) {
    try {
      await deps.userStore.updateVerifiedEmail(user.userId, email);
    } catch (error) {
      if (error instanceof Error && error.message === 'identity already exists') {
        return { status: 401, body: { error: 'identity binding mismatch' } };
      }
      throw error;
    }
    user = await deps.userStore.getById(user.userId);
    if (!user) return { status: 500, body: { error: 'identity provisioning failed' } };
  }

  if (isOwner) {
    if (user.role !== 'OWNER') { await deps.userStore.setRole(user.userId, 'OWNER'); user = await deps.userStore.getById(user.userId); }
    if (!user) return { status: 500, body: { error: 'owner identity resolution failed' } };
    const challenge = await beginOwnerMfa(deps.ownerTotpStore, deps.ownerMfaChallengeStore, user.userId);
    if (!challenge) return { status: 403, body: { error: 'owner TOTP is not configured or confirmed' } };
    return { status: 202, body: { mfaRequired: true, challenge } };
  }
  return sessionResponse(await issueSession(deps.sessionStore, user.userId, 'USER'));
}
export async function ownerTotpProvisionHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const limited = authenticationRateLimit(ctx, deps, 'owner-totp-provision');
  if (limited) return limited;
  const body = (ctx.body ?? {}) as OwnerTotpBody;
  if (!body.idToken) return { status: 400, body: { error: 'Google ID token is required' } };

  const resolution = await resolveAllowlistedOwner(body.idToken, deps, true);
  if ('error' in resolution) return resolution.error;

  try {
    const setup = await provisionOwnerTotp(deps.ownerTotpStore, resolution.user.userId);
    return {
      status: 200,
      body: {
        setupRequired: true,
        secret: setup.secret,
        otpauthUri: setup.otpauthUri,
        confirmed: false,
        sessionIssued: false,
      },
      headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
    };
  } catch (error) {
    if (error instanceof Error && error.message === 'confirmed TOTP already exists') {
      return { status: 409, body: { error: 'Owner TOTP is already confirmed; provisioning is disabled' }, headers: { 'Cache-Control': 'no-store' } };
    }
    throw error;
  }
}

export async function ownerTotpConfirmHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const limited = authenticationRateLimit(ctx, deps, 'owner-totp-confirm');
  if (limited) return limited;
  const body = (ctx.body ?? {}) as OwnerTotpBody;
  if (!body.idToken || !body.code) {
    return { status: 400, body: { error: 'Google ID token and TOTP code are required' } };
  }

  const resolution = await resolveAllowlistedOwner(body.idToken, deps, false);
  if ('error' in resolution) return resolution.error;

  const current = await deps.ownerTotpStore.get(resolution.user.userId);
  if (!current) return { status: 409, body: { error: 'TOTP enrollment has not been started' }, headers: { 'Cache-Control': 'no-store' } };
  if (current.confirmedAt) return { status: 409, body: { error: 'Owner TOTP is already confirmed' }, headers: { 'Cache-Control': 'no-store' } };

  const confirmed = await confirmOwnerTotp(deps.ownerTotpStore, resolution.user.userId, body.code);
  if (!confirmed) return { status: 401, body: { error: 'invalid TOTP code' }, headers: { 'Cache-Control': 'no-store' } };
  return {
    status: 200,
    body: { confirmed: true, sessionIssued: false, nextStep: 'Sign in again using Google OIDC and verify the TOTP code' },
    headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' },
  };
}

export async function ownerMfaHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const limited = authenticationRateLimit(ctx, deps, 'owner-mfa');
  if (limited) return limited;
  const body = (ctx.body ?? {}) as OwnerMfaBody;
  if (!body.challenge || !body.code) return { status: 400, body: { error: 'MFA challenge and TOTP code are required' } };
  const result = await verifyOwnerMfa(deps.ownerTotpStore, deps.ownerMfaChallengeStore, body.challenge, body.code);
  if (!result.success || !result.userId) return { status: 401, body: { error: 'invalid or expired owner MFA challenge' } };
  const user = await deps.userStore.getById(result.userId);
  if (!user || user.role !== 'OWNER') return { status: 403, body: { error: 'owner authorization failed' } };
  return sessionResponse(await issueSession(deps.sessionStore, user.userId, 'OWNER'));
}
export async function logoutHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const token = ctx.cookies['session_token'];
  if (!token) return { status: 401, body: { error: 'not authenticated' } };
  let check; try { check = await validateSession(deps.sessionStore, token); } catch { return { status: 401, body: { error: 'not authenticated' } }; }
  if (!check.valid) return { status: 401, body: { error: 'not authenticated' } };
  const csrfHeaderRaw = ctx.headers['x-csrf-token']; const csrfHeader = Array.isArray(csrfHeaderRaw) ? csrfHeaderRaw[0] : csrfHeaderRaw;
  if (!verifyCsrfToken(ctx.cookies['csrf_token'], csrfHeader)) return { status: 403, body: { error: 'CSRF validation failed' } };
  await revokeSession(deps.sessionStore, token); return { status: 200, body: { success: true } };
}