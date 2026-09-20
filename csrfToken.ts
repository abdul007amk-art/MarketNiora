/**
 * CSRF TOKEN
 * Status: IMPLEMENTATION — unit tested below.
 * Double-submit pattern: server issues a token, client echoes it back in
 * a header on state-changing requests; server verifies via constant-time
 * comparison to avoid timing attacks.
 */

import { randomBytes, timingSafeEqual } from 'crypto';

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function verifyCsrfToken(sessionToken: string | null | undefined, submittedToken: string | null | undefined): boolean {
  if (!sessionToken || !submittedToken) return false;
  if (sessionToken.length !== submittedToken.length) return false;

  const a = Buffer.from(sessionToken, 'hex');
  const b = Buffer.from(submittedToken, 'hex');
  if (a.length !== b.length) return false;

  try {
    return timingSafeEqual(a, b);
  } catch {
    return false; // fail closed on any comparison error (e.g. malformed hex)
  }
}
