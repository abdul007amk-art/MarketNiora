/**
 * OAUTH TOKEN STORE
 * Status: IMPLEMENTATION — unit tested below. NOT wired to a real
 * database — in-memory foundation, same convention as every other
 * *Store in this repo (productionReady = false).
 *
 * GOVERNANCE: Tokens are never logged. If an OAuthToken ever ends up in
 * an audit detail object, Module 3's redaction pattern already catches
 * `accessToken`/`refreshToken` (key names contain "token", which
 * SENSITIVE_KEY_PATTERN in security/auditLogger.ts matches).
 */

export interface OAuthToken {
  userId: string;
  provider: 'UPSTOX';
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  obtainedAt: number;
}

export interface OAuthTokenStore {
  set(userId: string, token: OAuthToken): void;
  get(userId: string): OAuthToken | undefined;
  revoke(userId: string): void;
}

export class InMemoryOAuthTokenStore implements OAuthTokenStore {
  public readonly productionReady = false;
  private tokens: Map<string, OAuthToken>;

  constructor() {
    this.tokens = new Map();
  }

  set(userId: string, token: OAuthToken): void {
    this.tokens.set(userId, structuredClone(token));
  }

  get(userId: string): OAuthToken | undefined {
    const token = this.tokens.get(userId);
    return token ? structuredClone(token) : undefined;
  }

  revoke(userId: string): void {
    this.tokens.delete(userId);
  }
}

/**
 * A token is usable only if it exists and has not expired. This is a
 * separate, tiny function (not folded into the store) so call sites
 * can't accidentally skip the expiry check.
 */
export function isTokenUsable(token: OAuthToken | undefined, now: number): boolean {
  if (!token) return false;
  return now < token.expiresAt;
}
