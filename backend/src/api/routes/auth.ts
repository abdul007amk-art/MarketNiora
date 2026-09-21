/** AUTH ROUTES — Google OIDC only. Blueprint v1.1 / ODR-2026-001. */
import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { issueSession, revokeSession, validateSession } from '../../auth/sessionManager.ts';
import { generateCsrfToken, verifyCsrfToken } from '../../security/csrfToken.ts';
import { beginOwnerMfa, verifyOwnerMfa } from '../../auth/ownerMfa.ts';

interface OidcBody { idToken?: string; }
interface OwnerMfaBody { challenge?: string; code?: string; }
function ownerEmails(): Set<string> { return new Set((process.env.OWNER_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)); }
function sessionResponse(session: ReturnType<typeof issueSession>): RouteResult {
  const csrfToken = generateCsrfToken();
  return { status: 200, body: { userId: session.userId, role: session.role, csrfToken }, headers: { 'Set-Cookie': ['session_token=' + session.token + '; HttpOnly; Path=/; SameSite=Strict', 'csrf_token=' + csrfToken + '; Path=/; SameSite=Strict'] } };
}
export async function oidcLoginHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as OidcBody;
  if (!body.idToken) return { status: 400, body: { error: 'Google ID token is required' } };
  let identity;
  try { identity = await deps.oidcVerifier.verify(body.idToken); } catch { return { status: 401, body: { error: 'invalid Google identity token' } }; }
  if (!identity.emailVerified) return { status: 401, body: { error: 'Google account email is not verified' } };
  const isOwner = ownerEmails().has(identity.email);
  let user = deps.userStore.getByEmail(identity.email);
  if (!user) {
    const userId = 'oidc-' + identity.subject;
    deps.userStore.create({ userId, email: identity.email, oidcIssuer: identity.issuer, oidcSubject: identity.subject, role: isOwner ? 'OWNER' : 'USER', emailVerified: true });
    user = deps.userStore.getById(userId);
  }
  if (!user) return { status: 500, body: { error: 'identity provisioning failed' } };
  if (user.oidcIssuer !== identity.issuer || user.oidcSubject !== identity.subject) return { status: 401, body: { error: 'identity binding mismatch' } };
  if (isOwner) {
    if (user.role !== 'OWNER') { deps.userStore.setRole(user.userId, 'OWNER'); user = deps.userStore.getById(user.userId); }
    if (!user) return { status: 500, body: { error: 'owner identity resolution failed' } };
    const challenge = beginOwnerMfa(deps.ownerTotpStore, deps.ownerMfaChallengeStore, user.userId);
    if (!challenge) return { status: 403, body: { error: 'owner TOTP is not configured or confirmed' } };
    return { status: 202, body: { mfaRequired: true, challenge } };
  }
  return sessionResponse(issueSession(deps.sessionStore, user.userId, 'USER'));
}
export async function ownerMfaHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as OwnerMfaBody;
  if (!body.challenge || !body.code) return { status: 400, body: { error: 'MFA challenge and TOTP code are required' } };
  const result = verifyOwnerMfa(deps.ownerTotpStore, deps.ownerMfaChallengeStore, body.challenge, body.code);
  if (!result.success || !result.userId) return { status: 401, body: { error: 'invalid or expired owner MFA challenge' } };
  const user = deps.userStore.getById(result.userId);
  if (!user || user.role !== 'OWNER') return { status: 403, body: { error: 'owner authorization failed' } };
  return sessionResponse(issueSession(deps.sessionStore, user.userId, 'OWNER'));
}
export async function logoutHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  const token = ctx.cookies['session_token'];
  if (!token) return { status: 401, body: { error: 'not authenticated' } };
  let check; try { check = validateSession(deps.sessionStore, token); } catch { return { status: 401, body: { error: 'not authenticated' } }; }
  if (!check.valid) return { status: 401, body: { error: 'not authenticated' } };
  const csrfHeaderRaw = ctx.headers['x-csrf-token']; const csrfHeader = Array.isArray(csrfHeaderRaw) ? csrfHeaderRaw[0] : csrfHeaderRaw;
  if (!verifyCsrfToken(ctx.cookies['csrf_token'], csrfHeader)) return { status: 403, body: { error: 'CSRF validation failed' } };
  revokeSession(deps.sessionStore, token); return { status: 200, body: { success: true } };
}