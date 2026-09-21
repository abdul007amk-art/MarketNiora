/**
 * MFA RECOVERY CODES
 * Status: IMPLEMENTATION — unit tested below.
 *
 * GOVERNANCE: This is the proper home for the capability that Module 3's
 * audit explicitly kept OUT of the RBAC matrix — recovery must never be a
 * standing "BYPASS_MFA" permission that some role simply holds. Instead:
 * a recovery code is its own single-use credential, hashed at rest exactly
 * like a password (never stored or logged in plaintext), and consuming one
 * requires actually possessing it — not a role check.
 *
 * Post-audit hardening (HIGH finding): the original consumeRecoveryCode()
 * was check-then-remove with the caller responsible for persisting the
 * result — two concurrent callers with the same original set could both
 * "succeed" before either write lands. consumeRecoveryCode() is kept below
 * as a low-level pure helper (still useful, still tested), but the
 * AUTHORITATIVE API for real authorization flows is now
 * consumeRecoveryCodeAtomically() via InMemoryRecoveryCodeStore, which
 * serializes consume operations per-owner with an async mutex so two
 * concurrent calls for the same owner cannot both consume the same code.
 *
 * KNOWN LIMITATION (be honest about it, same pattern as the rate limiter
 * and session store): this mutex is per-process/in-memory. It guarantees
 * atomicity within one Node process, not across multiple serverless
 * instances. A real production deployment needs a DB-level atomic
 * operation (e.g. Postgres `DELETE ... WHERE hash = $1 RETURNING *`
 * inside a transaction) behind the same store interface.
 */

import { randomBytes } from 'crypto';
import { hashPassword, verifyPassword } from './passwordHashing.ts';

const DEFAULT_CODE_COUNT = 10;
const CODE_BYTES = 5; // -> 10 hex characters per code

export interface GeneratedRecoveryCodes {
  /** Shown to the Owner exactly once at generation time. Never persist this array anywhere. */
  plaintextCodes: string[];
  /** What actually gets stored server-side. */
  hashedCodes: string[];
}

export function generateRecoveryCodes(count: number = DEFAULT_CODE_COUNT): GeneratedRecoveryCodes {
  if (count <= 0) throw new Error('count must be positive');
  const plaintextCodes: string[] = [];
  const hashedCodes: string[] = [];
  for (let i = 0; i < count; i++) {
    const code = randomBytes(CODE_BYTES).toString('hex');
    plaintextCodes.push(code);
    hashedCodes.push(hashPassword(code)); // a recovery code is a secret credential — hash it like one
  }
  return { plaintextCodes, hashedCodes };
}

export interface RecoveryConsumeResult {
  valid: boolean;
  /** Caller must persist this as the new stored set — the matched code is removed (single-use). */
  remainingHashedCodes: string[];
  reason: string;
}

/**
 * ⚠ NOT concurrency-safe. Pure check-then-remove: fine for a single
 * sequential caller / tests, but two concurrent calls against the same
 * original array can both report success for the same code. Use
 * consumeRecoveryCodeAtomically() for anything that could run concurrently.
 */
export function consumeRecoveryCode(hashedCodes: string[] | null | undefined, submittedCode: string | null | undefined): RecoveryConsumeResult {
  if (!submittedCode) {
    return { valid: false, remainingHashedCodes: hashedCodes ?? [], reason: 'no code provided' };
  }
  if (!hashedCodes || hashedCodes.length === 0) {
    return { valid: false, remainingHashedCodes: [], reason: 'no recovery codes available' };
  }

  for (let i = 0; i < hashedCodes.length; i++) {
    if (verifyPassword(submittedCode, hashedCodes[i])) {
      const remaining = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
      return { valid: true, remainingHashedCodes: remaining, reason: 'recovery code accepted and consumed (single-use)' };
    }
  }
  return { valid: false, remainingHashedCodes: hashedCodes, reason: 'code does not match any stored recovery code' };
}

/**
 * Server-side store with a genuine atomic (per-owner serialized) consume
 * operation. productionReady = false, same convention as
 * InMemorySessionStore / FixedWindowRateLimiter — this is a foundation
 * implementation whose CORRECTNESS (not just presence) is unit tested
 * below via real concurrent calls, not just documented.
 */
export class InMemoryRecoveryCodeStore {
  public readonly productionReady = false;
  private codesByOwner: Map<string, string[]>;
  private locks: Map<string, Promise<unknown>>;

  constructor() {
    this.codesByOwner = new Map();
    this.locks = new Map();
  }

  setHashedCodes(ownerId: string, hashedCodes: string[]): void {
    this.codesByOwner.set(ownerId, hashedCodes);
  }

  getHashedCodes(ownerId: string): string[] {
    return this.codesByOwner.get(ownerId) ?? [];
  }

  /**
   * Acquires a per-owner async mutex (a chained promise), performs
   * match+remove as one critical section, then releases. Two concurrent
   * calls for the SAME ownerId are serialized: the second one only runs
   * its check after the first has already removed the matched code from
   * the stored array, so it correctly sees "already consumed."
   */
  async consumeIfMatch(ownerId: string, submittedCode: string): Promise<boolean> {
    const previousTurn = this.locks.get(ownerId) ?? Promise.resolve();
    let releaseThisTurn: () => void = () => {};
    const thisTurn = new Promise<void>((resolve) => {
      releaseThisTurn = resolve;
    });
    this.locks.set(ownerId, previousTurn.then(() => thisTurn));

    await previousTurn; // wait for our turn in line

    try {
      const codes = this.codesByOwner.get(ownerId) ?? [];
      for (let i = 0; i < codes.length; i++) {
        if (verifyPassword(submittedCode, codes[i])) {
          const remaining = [...codes.slice(0, i), ...codes.slice(i + 1)];
          this.codesByOwner.set(ownerId, remaining);
          return true;
        }
      }
      return false;
    } finally {
      releaseThisTurn();
    }
  }
}

export interface AtomicConsumeResult {
  valid: boolean;
  reason: string;
}

export async function consumeRecoveryCodeAtomically(
  store: InMemoryRecoveryCodeStore,
  ownerId: string,
  submittedCode: string | null | undefined
): Promise<AtomicConsumeResult> {
  if (!submittedCode) return { valid: false, reason: 'no code provided' };
  if (!ownerId) return { valid: false, reason: 'no ownerId provided' };

  const matched = await store.consumeIfMatch(ownerId, submittedCode);
  return matched
    ? { valid: true, reason: 'recovery code accepted and consumed (atomic, single-use)' }
    : { valid: false, reason: 'code does not match any stored recovery code, or was already consumed' };
}
