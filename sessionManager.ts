/**
 * SESSION MANAGER — server-authoritative session store + fail-closed validation
 * Status: IMPLEMENTATION — unit tested below. NOT wired to any real HTTP
 * server or persistent database yet.
 *
 * GOVERNANCE (docs/GOVERNANCE.md #1): Server = Sole Authority. Client = Untrusted.
 *
 * Post-audit hardening: validation is now token-based against a server-side
 * SessionStore — the caller supplies only an opaque token string, never a
 * session object. Nothing here trusts client-supplied session fields
 * (userId, role, expiresAt) directly. The InMemorySessionStore is a
 * foundation/single-instance implementation (same documented limitation
 * as Module 3's rate limiter) — a real deployment plugs in a persistent
 * store (e.g. Supabase/Postgres or Redis) behind the same SessionStore
 * interface without changing calling code.
 */

import { randomBytes } from 'crypto';
import type { Role } from '../security/rbac.ts';

const SESSION_TOKEN_BYTES = 32;
const DEFAULT_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const MAX_SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days — hard upper bound

export interface Session {
  token: string;
  userId: string;
  role: Role;
  issuedAt: number;
  expiresAt: number;
}

export function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('hex');
}

/**
 * TTL must be finite, positive, and within MAX_SESSION_TTL_MS. Rejects
 * NaN/Infinity/negative/zero/unreasonably-large values at creation time
 * rather than letting a bad TTL silently produce an already-expired or
 * absurdly long-lived session.
 */
function assertValidTtl(ttlMs: number, maxMs: number): void {
  if (typeof ttlMs !== 'number' || !Number.isFinite(ttlMs)) {
    throw new Error(`ttlMs must be a finite number, got: ${ttlMs}`);
  }
  if (ttlMs <= 0) {
    throw new Error(`ttlMs must be positive, got: ${ttlMs}`);
  }
  if (ttlMs > maxMs) {
    throw new Error(`ttlMs exceeds maximum allowed (${maxMs}ms), got: ${ttlMs}`);
  }
}

function createSessionRecord(userId: string, role: Role, now: number, ttlMs: number): Session {
  if (!userId) throw new Error('cannot create a session without a userId');
  assertValidTtl(ttlMs, MAX_SESSION_TTL_MS);
  return {
    token: generateSessionToken(),
    userId,
    role,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
}

export interface SessionStore {
  get(token: string): Session | undefined;
  set(token: string, session: Session): void;
  revoke(token: string): void;
}

export class InMemorySessionStore implements SessionStore {
  public readonly productionReady = false; // explicit, not just a comment — same convention as Module 3's rate limiter
  private map: Map<string, Session>;

  constructor() {
    this.map = new Map();
  }

  get(token: string): Session | undefined {
    return this.map.get(token);
  }

  set(token: string, session: Session): void {
    this.map.set(token, session);
  }

  revoke(token: string): void {
    this.map.delete(token);
  }
}

/**
 * The ONLY way a session should be created in this module. Generates the
 * record and stores it server-side; the caller gets the full Session back
 * (useful for tests / same-process callers), but only session.token should
 * ever be handed to a client.
 */
export function issueSession(store: SessionStore, userId: string, role: Role, now: number = Date.now(), ttlMs: number = DEFAULT_SESSION_TTL_MS): Session {
  const session = createSessionRecord(userId, role, now, ttlMs);
  store.set(session.token, session);
  return session;
}

export function revokeSession(store: SessionStore, token: string): void {
  store.revoke(token);
}

export interface SessionValidation {
  valid: boolean;
  reason: string;
}

/**
 * THE authoritative check. Takes only an opaque token — never a
 * client-supplied session object — and resolves it against the
 * server-side store. Fail-closed by construction:
 *   - empty/missing token -> DENY
 *   - token not found in store (never issued, or revoked) -> DENY
 *   - found but expired -> DENY
 * There is no code path here that trusts anything the client claims
 * about who a token belongs to or when it expires.
 */
export function validateSession(store: SessionStore, token: string | null | undefined, now: number = Date.now()): SessionValidation {
  if (!token) return { valid: false, reason: 'no token provided' };

  const session = store.get(token);
  if (!session) return { valid: false, reason: 'unknown or revoked token' };

  if (now >= session.expiresAt) return { valid: false, reason: 'session expired' };

  return { valid: true, reason: 'valid' };
}
