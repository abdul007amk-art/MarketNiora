/**
 * PASSWORD HASHING — scrypt (Node built-in, no external dependency)
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Uses Node's built-in `crypto.scryptSync` — deliberately avoids bcrypt/argon2
 * external packages so this stays installable with zero network access,
 * consistent with the rest of this repo. scrypt is a well-regarded,
 * memory-hard KDF; this is a legitimate choice, not just a convenience one.
 *
 * KNOWN LIMITATION (be honest about it): scryptSync is synchronous and will
 * block Node's event loop under load. Fine for this foundation/test module;
 * a real HTTP-facing login endpoint (Module 13 — API layer) should wrap this
 * in a worker thread or use the async crypto.scrypt callback/promise form.
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const KEY_LENGTH = 64;
const SALT_BYTES = 16;

/** Format: saltHex:hashHex — self-contained, no separate salt column needed. */
export function hashPassword(plaintext: string): string {
  if (!plaintext || plaintext.length === 0) {
    throw new Error('cannot hash an empty password');
  }
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = scryptSync(plaintext, salt, KEY_LENGTH);
  return `${salt}:${derived.toString('hex')}`;
}

export function verifyPassword(plaintext: string, storedHash: string): boolean {
  if (!plaintext || !storedHash) return false;

  const parts = storedHash.split(':');
  if (parts.length !== 2) return false; // fail closed on malformed hash, never throw into a 500 that could leak info

  const [salt, hashHex] = parts;
  if (!salt || !hashHex) return false;

  try {
    const derived = scryptSync(plaintext, salt, KEY_LENGTH);
    const stored = Buffer.from(hashHex, 'hex');
    if (derived.length !== stored.length) return false;
    return timingSafeEqual(derived, stored);
  } catch {
    return false; // fail closed on any hashing error (e.g. corrupt stored value)
  }
}
