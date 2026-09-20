/**
 * OAUTH FLOW
 * Status: IMPLEMENTATION — unit tested below. No real network calls —
 * the actual Upstox token exchange is dependency-injected (same DI
 * pattern as Module 6's CsvFetcher/HttpClient), so tests never need
 * real network access.
 *
 * Flow: USER -> UPSTOX OAUTH -> SECURE SERVER TOKEN STORAGE
 */

import { randomBytes } from 'crypto';
import type { OAuthToken, OAuthTokenStore } from './oauthToken.ts';

const STATE_TTL_MS = 1000 * 60 * 10; // 10 minutes — an OAuth redirect round-trip should complete well within this

export interface PendingOAuthState {
  state: string;
  userId: string;
  issuedAt: number;
  expiresAt: number;
  consumed: boolean;
}

export interface OAuthStateStore {
  set(state: string, pending: PendingOAuthState): void;
  get(state: string): PendingOAuthState | undefined;
  /**
   * Atomic check-and-consume (post-audit fix, Finding 12-A): unused +
   * unexpired, verified and marked consumed, as ONE indivisible
   * operation. Same per-key async mutex pattern as Module 5's
   * InMemoryMfaVerificationStore.consumeIfValid() — a genuine concurrency
   * fix, not just a sequential-replay check.
   */
  consumeIfValid(state: string, now: number): Promise<{ ok: boolean; reason: string; pending: PendingOAuthState | null }>;
}

export class InMemoryOAuthStateStore implements OAuthStateStore {
  public readonly productionReady = false;
  private map: Map<string, PendingOAuthState>;
  private locks: Map<string, Promise<unknown>>;

  constructor() {
    this.map = new Map();
    this.locks = new Map();
  }

  set(state: string, pending: PendingOAuthState): void {
    this.map.set(state, pending);
  }

  get(state: string): PendingOAuthState | undefined {
    return this.map.get(state);
  }

  async consumeIfValid(state: string, now: number): Promise<{ ok: boolean; reason: string; pending: PendingOAuthState | null }> {
    const previousTurn = this.locks.get(state) ?? Promise.resolve();
    let releaseThisTurn: () => void = () => {};
    const thisTurn = new Promise<void>((resolve) => {
      releaseThisTurn = resolve;
    });
    this.locks.set(state, previousTurn.then(() => thisTurn));

    await previousTurn; // serializes concurrent callers for the SAME state

    try {
      const pending = this.map.get(state);
      if (!pending) {
        return { ok: false, reason: 'DENY: unknown OAuth state (never issued, or already garbage-collected)', pending: null };
      }
      if (pending.consumed) {
        return { ok: false, reason: 'DENY: OAuth state already used (single-use, replay rejected)', pending: null };
      }
      if (now >= pending.expiresAt) {
        return { ok: false, reason: 'DENY: OAuth state expired', pending: null };
      }

      this.map.set(state, { ...pending, consumed: true });
      return { ok: true, reason: 'valid', pending };
    } finally {
      releaseThisTurn();
    }
  }
}

export function initiateOAuth(userId: string, store: OAuthStateStore, now: number = Date.now()): string {
  if (!userId) throw new Error('cannot initiate OAuth without a userId');
  const state = randomBytes(24).toString('hex');
  store.set(state, { state, userId, issuedAt: now, expiresAt: now + STATE_TTL_MS, consumed: false });
  return state;
}

export interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  expiresInMs: number;
}

/** Injected — the actual HTTP call to Upstox's token endpoint. Never implemented in this repo (no real network). */
export type TokenExchanger = (authCode: string) => Promise<TokenExchangeResult>;

export interface OAuthCompletionResult {
  success: boolean;
  reason: string;
  userId: string | null;
}

/**
 * Post-audit fix (Finding 12-C): validates the exchanger's result before
 * trusting it. An empty accessToken or a non-positive/non-finite
 * expiresInMs is rejected — a provider bug or a malicious/misbehaving
 * exchanger cannot produce a "successfully stored" empty-credential token.
 */
function isValidTokenExchangeResult(result: TokenExchangeResult): boolean {
  if (!result.accessToken || result.accessToken.trim().length === 0) return false;
  if (!Number.isFinite(result.expiresInMs) || !Number.isInteger(result.expiresInMs) || result.expiresInMs <= 0) return false;
  return true;
}

/**
 * Fail-closed. State validity (unknown/replayed/expired) is now checked
 * ATOMICALLY via stateStore.consumeIfValid() — see Finding 12-A above —
 * before the token exchanger is ever called.
 */
export async function completeOAuth(
  state: string,
  authCode: string,
  stateStore: OAuthStateStore,
  tokenStore: OAuthTokenStore,
  exchanger: TokenExchanger,
  now: number = Date.now()
): Promise<OAuthCompletionResult> {
  const consumeResult = await stateStore.consumeIfValid(state, now);
  if (!consumeResult.ok || !consumeResult.pending) {
    return { success: false, reason: consumeResult.reason, userId: null };
  }
  const pending = consumeResult.pending;

  let exchangeResult: TokenExchangeResult;
  try {
    exchangeResult = await exchanger(authCode);
  } catch {
    // Post-audit fix (Finding 12-B): never surface the raw provider/error
    // message to the caller — it could contain tokens, secrets, or
    // internal provider debug detail. A generic reason is returned;
    // server-side logging (when wired to the real API layer) is the
    // place for the full detail, not the caller-facing result.
    return { success: false, reason: 'token exchange failed', userId: null };
  }

  if (!isValidTokenExchangeResult(exchangeResult)) {
    return { success: false, reason: 'token exchange returned an invalid result (empty access token or invalid expiry) — refusing to store', userId: null };
  }

  const token: OAuthToken = {
    userId: pending.userId,
    provider: 'UPSTOX',
    accessToken: exchangeResult.accessToken,
    refreshToken: exchangeResult.refreshToken,
    expiresAt: now + exchangeResult.expiresInMs,
    obtainedAt: now,
  };
  tokenStore.set(pending.userId, token);

  return { success: true, reason: 'token stored', userId: pending.userId };
}
