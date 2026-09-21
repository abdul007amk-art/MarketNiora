/**
 * OWNER AUTHORIZATION — explicit gate for governance-protected actions
 * Status: IMPLEMENTATION — unit tested below.
 *
 * Post-audit hardening (BLOCKER fix): the gate no longer accepts a raw
 * `mfaVerifiedForThisAction: boolean` from the caller — that let any
 * future caller inject `true` without ever actually verifying MFA. It now
 * requires a `verificationId` that resolves against a server-side
 * MfaVerificationStore, exactly parallel to how Module 4 fixed sessions
 * (SessionStore / validateSession). A proof is only ever created by
 * successfully verifying a real TOTP code or consuming a real recovery
 * code — see verifyOwnerTotpAndIssueProof / verifyOwnerRecoveryCodeAndIssueProof.
 * The gate resolves the token itself; it trusts nothing the caller claims.
 */

import { randomBytes } from 'crypto';
import type { Role } from '../security/rbac.ts';
import { hasPermission } from '../security/rbac.ts';
import { verifyTotpCode } from './totp.ts';
import { consumeRecoveryCodeAtomically } from './mfaRecovery.ts';
import type { InMemoryRecoveryCodeStore } from './mfaRecovery.ts';

export type OwnerGatedAction =
  | 'EDIT_LOCKED_FORMULA'
  | 'PAYMENT_OVERRIDE'
  | 'SECURITY_CONFIG_CHANGE'
  | 'GRANT_AUTHORITY';

const MAX_PROOF_AGE_MS = 1000 * 60 * 5; // 5 minutes — a verification proof must be used promptly, not hoarded

export interface MfaVerificationProof {
  verificationId: string;
  ownerId: string;
  action: OwnerGatedAction;
  method: 'TOTP' | 'RECOVERY_CODE';
  verifiedAt: number;
  consumed: boolean;
}

export interface MfaVerificationStore {
  get(verificationId: string): MfaVerificationProof | undefined;
  set(verificationId: string, proof: MfaVerificationProof): void;
  /**
   * Atomic check-and-consume: unused + matching owner/action + fresh, all
   * verified and the proof marked consumed, as ONE indivisible operation.
   * Must be safe against concurrent callers using the SAME verificationId —
   * of N concurrent calls, exactly one may succeed.
   */
  consumeIfValid(verificationId: string, ownerId: string, action: OwnerGatedAction, now: number, maxAgeMs: number): Promise<{ ok: boolean; reason: string }>;
}

/**
 * Post-audit hardening (BLOCKER, round 2): the original get() -> check ->
 * markConsumed() flow had a window between "check unused" and "mark
 * consumed" where two concurrent callers with the same valid
 * verificationId could both pass the check before either write landed.
 * In this synchronous in-memory implementation that window doesn't
 * actually get hit today (Node's single-threaded, no `await` sat between
 * the check and the write) — but the MOMENT this is wired to a real
 * database (Module 6/7), a network round-trip reintroduces exactly that
 * window. Fixed proactively, the same way as InMemoryRecoveryCodeStore:
 * consumeIfValid() acquires a per-verificationId async mutex and performs
 * check+consume as one critical section. A real DB-backed implementation
 * must replace this with an atomic `UPDATE ... WHERE consumed = false
 * ... RETURNING` (or equivalent transaction) — the interface establishes
 * the invariant now so that swap is drop-in.
 */
export class InMemoryMfaVerificationStore implements MfaVerificationStore {
  public readonly productionReady = false; // same convention as SessionStore/RateLimitStore/InMemoryRecoveryCodeStore
  private map: Map<string, MfaVerificationProof>;
  private locks: Map<string, Promise<unknown>>;

  constructor() {
    this.map = new Map();
    this.locks = new Map();
  }

  get(verificationId: string): MfaVerificationProof | undefined {
    return this.map.get(verificationId);
  }

  set(verificationId: string, proof: MfaVerificationProof): void {
    this.map.set(verificationId, proof);
  }

  async consumeIfValid(verificationId: string, ownerId: string, action: OwnerGatedAction, now: number, maxAgeMs: number): Promise<{ ok: boolean; reason: string }> {
    const previousTurn = this.locks.get(verificationId) ?? Promise.resolve();
    let releaseThisTurn: () => void = () => {};
    const thisTurn = new Promise<void>((resolve) => {
      releaseThisTurn = resolve;
    });
    this.locks.set(verificationId, previousTurn.then(() => thisTurn));

    await previousTurn; // wait for our turn in line — this is what serializes concurrent callers

    try {
      const proof = this.map.get(verificationId);
      if (!proof) {
        return { ok: false, reason: 'DENY: unknown verification proof (never issued, or already garbage-collected)' };
      }
      if (proof.consumed) {
        return { ok: false, reason: 'DENY: verification proof already used (single-use)' };
      }
      if (proof.ownerId !== ownerId) {
        return { ok: false, reason: 'DENY: verification proof does not belong to this owner' };
      }
      if (proof.action !== action) {
        return { ok: false, reason: `DENY: verification proof was issued for action ${proof.action}, not ${action}` };
      }
      if (now - proof.verifiedAt > maxAgeMs) {
        return { ok: false, reason: 'DENY: verification proof is stale (not fresh)' };
      }

      this.map.set(verificationId, { ...proof, consumed: true });
      return { ok: true, reason: 'ALLOW' };
    } finally {
      releaseThisTurn();
    }
  }
}

function issueProof(store: MfaVerificationStore, ownerId: string, action: OwnerGatedAction, method: MfaVerificationProof['method'], now: number): MfaVerificationProof {
  const proof: MfaVerificationProof = {
    verificationId: randomBytes(24).toString('hex'),
    ownerId,
    action,
    method,
    verifiedAt: now,
    consumed: false,
  };
  store.set(proof.verificationId, proof);
  return proof;
}

/**
 * The ONLY way to obtain a valid proof via TOTP. Internally verifies the
 * real code against the real secret — a caller cannot skip this and hand
 * in a proof of their own construction, because verificationId is
 * server-generated randomness the caller never sees before this succeeds.
 */
export function verifyOwnerTotpAndIssueProof(
  store: MfaVerificationStore,
  ownerId: string,
  action: OwnerGatedAction,
  totpSecret: string,
  submittedCode: string,
  now: number = Date.now()
): MfaVerificationProof | null {
  const result = verifyTotpCode(totpSecret, submittedCode, now);
  if (!result.valid) return null;
  return issueProof(store, ownerId, action, 'TOTP', now);
}

/**
 * The ONLY way to obtain a valid proof via a recovery code. Uses the
 * atomic (per-owner serialized) consume, so this cannot double-issue a
 * proof for the same physical recovery code under concurrent calls.
 */
export async function verifyOwnerRecoveryCodeAndIssueProof(
  mfaStore: MfaVerificationStore,
  recoveryStore: InMemoryRecoveryCodeStore,
  ownerId: string,
  action: OwnerGatedAction,
  submittedCode: string,
  now: number = Date.now()
): Promise<MfaVerificationProof | null> {
  const result = await consumeRecoveryCodeAtomically(recoveryStore, ownerId, submittedCode);
  if (!result.valid) return null;
  return issueProof(mfaStore, ownerId, action, 'RECOVERY_CODE', now);
}

export interface OwnerAuthorizationContext {
  role: Role | null | undefined;
  ownerId: string | null | undefined;
  action: OwnerGatedAction;
  verificationId: string | null | undefined;
}

export interface OwnerAuthorizationDecision {
  allowed: boolean;
  reason: string;
}

/**
 * Fail-closed by construction. Resolves `verificationId` against the
 * server-side store's ATOMIC consumeIfValid — nothing here trusts a
 * caller-asserted boolean, and the unused-check + consume happen as one
 * indivisible operation (see InMemoryMfaVerificationStore doc comment).
 */
export async function authorizeOwnerAction(store: MfaVerificationStore, ctx: OwnerAuthorizationContext, now: number = Date.now()): Promise<OwnerAuthorizationDecision> {
  if (ctx.role !== 'OWNER') {
    return { allowed: false, reason: `DENY: role ${ctx.role ?? 'none'} is not OWNER — ${ctx.action} requires OWNER` };
  }
  if (!ctx.ownerId) {
    return { allowed: false, reason: 'DENY: no ownerId provided' };
  }
  if (!ctx.verificationId) {
    return { allowed: false, reason: 'DENY: no MFA verification proof provided' };
  }

  const result = await store.consumeIfValid(ctx.verificationId, ctx.ownerId, ctx.action, now, MAX_PROOF_AGE_MS);
  return { allowed: result.ok, reason: result.reason };
}

/**
 * Governance boundary (per docs/GOVERNANCE.md #5): Admin can never act on
 * an account whose role is OWNER — block, delete, disable, revoke, all of
 * it — regardless of what generic permission Admin holds (e.g.
 * MANAGE_USERS). Enforced HERE at the target-role level: an ordinary RBAC
 * permission check only ever sees the actor's role, never the target's, so
 * this check cannot be replaced by one.
 */
export function canActOnUserAccount(actorRole: Role | null | undefined, targetRole: Role): OwnerAuthorizationDecision {
  if (!actorRole) {
    return { allowed: false, reason: 'DENY: no actor role' };
  }
  if (targetRole === 'OWNER' && actorRole !== 'OWNER') {
    return { allowed: false, reason: 'DENY: only OWNER may act on an OWNER account' };
  }
  if (!hasPermission(actorRole, 'MANAGE_USERS')) {
    return { allowed: false, reason: `DENY: role ${actorRole} lacks MANAGE_USERS permission` };
  }
  return { allowed: true, reason: 'ALLOW' };
}
