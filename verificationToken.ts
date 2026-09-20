/**
 * VERIFICATION TOKEN — for email/mobile verification workflows
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Actually SENDING a verification email/SMS is Provider Architecture
 * (Module 6) — this module only generates and validates the token itself.
 */

import { randomBytes, timingSafeEqual } from 'crypto';

const TOKEN_BYTES = 24;
const DEFAULT_TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours — hard upper bound

export interface VerificationToken {
  token: string;
  purpose: 'EMAIL_VERIFY' | 'PASSWORD_RESET';
  issuedAt: number;
  expiresAt: number;
}

/**
 * Post-audit hardening: TTL must be finite, positive, and within
 * MAX_TTL_MS. Rejects NaN/negative/zero/unreasonably-large values at
 * generation time rather than silently producing an already-expired or
 * absurdly long-lived token.
 */
function assertValidTtl(ttlMs: number): void {
  if (typeof ttlMs !== 'number' || !Number.isFinite(ttlMs)) {
    throw new Error(`ttlMs must be a finite number, got: ${ttlMs}`);
  }
  if (ttlMs <= 0) {
    throw new Error(`ttlMs must be positive, got: ${ttlMs}`);
  }
  if (ttlMs > MAX_TTL_MS) {
    throw new Error(`ttlMs exceeds maximum allowed (${MAX_TTL_MS}ms), got: ${ttlMs}`);
  }
}

export function generateVerificationToken(purpose: VerificationToken['purpose'], now: number = Date.now(), ttlMs: number = DEFAULT_TTL_MS): VerificationToken {
  assertValidTtl(ttlMs);
  return {
    token: randomBytes(TOKEN_BYTES).toString('hex'),
    purpose,
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
}

export function verifyToken(stored: VerificationToken | null | undefined, submittedToken: string | null | undefined, now: number = Date.now()): boolean {
  if (!stored || !submittedToken) return false;
  if (now >= stored.expiresAt) return false;

  const a = Buffer.from(stored.token, 'hex');
  const b = Buffer.from(submittedToken, 'hex');
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
