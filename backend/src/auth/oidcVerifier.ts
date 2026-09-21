import { createPublicKey, verify as cryptoVerify } from 'crypto';

export interface GoogleIdentity { issuer: string; subject: string; email: string; emailVerified: boolean; }
interface Jwk { kid: string; kty: string; alg?: string; use?: string; n: string; e: string; }
interface JwksResponse { keys: Jwk[]; }
export interface OidcVerifier { verify(idToken: string): Promise<GoogleIdentity>; }

const DEFAULT_ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

function decode(value: string): Buffer { return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='), 'base64'); }
function object(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(decode(value).toString('utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid JWT object');
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('invalid JWT object');
  }
}
function string(value: unknown, field: string): string { if (typeof value !== 'string' || !value) throw new Error('invalid ' + field); return value; }
function number(value: unknown, field: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('invalid ' + field); return value; }

export class GoogleOidcVerifier implements OidcVerifier {
  private readonly clientId: string;
  private readonly jwksUri: string;
  private readonly allowedIssuers: Set<string>;
  private cachedKeys = new Map<string, Jwk>();
  private cachedAt = 0;

  constructor(options: { clientId?: string; jwksUri?: string; allowedIssuers?: string[] } = {}) {
    this.clientId = options.clientId ?? process.env.GOOGLE_CLIENT_ID ?? '';
    this.jwksUri = options.jwksUri ?? process.env.GOOGLE_JWKS_URI ?? 'https://www.googleapis.com/oauth2/v3/certs';
    this.allowedIssuers = new Set(options.allowedIssuers ?? [...DEFAULT_ISSUERS]);
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');
    const parts = idToken.split('.');
    if (parts.length !== 3) throw new Error('invalid ID token format');
    let header: Record<string, unknown>;
    let payload: Record<string, unknown>;
    try {
      header = object(parts[0]);
      payload = object(parts[1]);
    } catch {
      throw new Error('invalid ID token format');
    }
    let signature: Buffer;
    try {
      signature = decode(parts[2]);
    } catch {
      throw new Error('invalid ID token format');
    }
    if (string(header.alg, 'alg') !== 'RS256') throw new Error('unsupported ID token algorithm');
    const kid = string(header.kid, 'kid');
    const issuer = string(payload.iss, 'iss');
    if (!this.allowedIssuers.has(issuer)) throw new Error('invalid ID token issuer');
    const audience = payload.aud;
    const audienceOk = typeof audience === 'string' ? audience === this.clientId : Array.isArray(audience) && audience.includes(this.clientId);
    if (!audienceOk) throw new Error('invalid ID token audience');
    const now = Math.floor(Date.now() / 1000);
    if (number(payload.exp, 'exp') <= now) throw new Error('ID token expired');
    if (number(payload.iat, 'iat') > now + 60) throw new Error('ID token issued-at is in the future');
    const subject = string(payload.sub, 'sub');
    const email = string(payload.email, 'email').trim().toLowerCase();
    if (payload.email_verified !== true) throw new Error('Google email is not verified');
    const jwk = await this.getKey(kid);
    const jwkForCrypto: import('crypto').JsonWebKey = { kty: jwk.kty, n: jwk.n, e: jwk.e };
    const publicKey = createPublicKey({ key: jwkForCrypto, format: 'jwk' });
    if (!cryptoVerify('RSA-SHA256', Buffer.from(parts[0] + '.' + parts[1]), publicKey, signature)) throw new Error('invalid ID token signature');
    return { issuer, subject, email, emailVerified: true };
  }

  private async getKey(kid: string): Promise<Jwk> {
    const cached = this.cachedKeys.get(kid);
    if (cached && Date.now() - this.cachedAt < JWKS_CACHE_TTL_MS) return cached;
    const response = await fetch(this.jwksUri, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Google JWKS request failed: ' + response.status);
    const body = await response.json() as JwksResponse;
    if (!Array.isArray(body.keys)) throw new Error('invalid Google JWKS response');
    const next = new Map<string, Jwk>();
    for (const key of body.keys) if (key.kid && key.kty === 'RSA' && key.n && key.e) next.set(key.kid, key);
    this.cachedKeys = next; this.cachedAt = Date.now();
    const selected = next.get(kid);
    if (!selected) throw new Error('Google signing key not found');
    return selected;
  }
}
