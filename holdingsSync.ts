/**
 * HOLDINGS SYNC
 * Status: IMPLEMENTATION — unit tested below. No real network call —
 * the broker holdings fetch is dependency-injected.
 *
 * Flow: HOLDINGS/POSITIONS -> SYMBOL/ISIN NORMALIZATION -> CANONICAL
 * STOCK MASTER -> USER-SCOPED PORTFOLIO
 *
 * GOVERNANCE: this module never writes to stock_master or any
 * classification/rotation/score table — portfolio sync is read-only with
 * respect to market-wide data. Zero imports from rotationEngine.ts or
 * stockScoreEngine.ts.
 */

import type { OAuthToken, OAuthTokenStore } from './oauthToken.ts';
import { isTokenUsable } from './oauthToken.ts';
import type { NormalizedHolding, PortfolioStore } from './portfolioStore.ts';

export interface RawBrokerHolding {
  tradingsymbol: string;
  isin: string | null;
  qty: number;
  avg_price: number;
}

/** Injected — the actual HTTP call to Upstox's holdings endpoint. Never implemented in this repo (no real network). */
export type HoldingsFetcher = (token: OAuthToken) => Promise<RawBrokerHolding[]>;

export function normalizeHolding(raw: RawBrokerHolding): NormalizedHolding {
  return {
    symbol: raw.tradingsymbol,
    isin: raw.isin,
    quantity: raw.qty,
    averagePrice: raw.avg_price,
  };
}

export interface HoldingValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Post-audit fix (Finding 12-D): normalizeHolding() itself stays a pure
 * mapping (no validation there — a mapper shouldn't silently drop data),
 * but nothing downstream trusts a NormalizedHolding until it passes this.
 * Fail-closed: missing symbol, non-finite/negative quantity, or
 * non-finite/negative averagePrice are all rejected.
 */
export function validateNormalizedHolding(holding: NormalizedHolding): HoldingValidationResult {
  const errors: string[] = [];
  if (!holding.symbol || holding.symbol.trim().length === 0) errors.push('symbol is required');
  if (!Number.isFinite(holding.quantity) || holding.quantity < 0) errors.push('quantity must be a finite, non-negative number');
  if (!Number.isFinite(holding.averagePrice) || holding.averagePrice < 0) errors.push('averagePrice must be a finite, non-negative number');
  return { valid: errors.length === 0, errors };
}

export interface SyncResult {
  success: boolean;
  reason: string;
  holdingsSynced: number;
  holdingsRejected: number;
}

/**
 * Fail-closed: no usable (present + unexpired) token means no sync
 * happens at all — never falls back to stale/cached/fabricated holdings.
 * Post-audit fix (12-D): each normalized holding is validated; only
 * valid ones are stored — a single malformed row from the broker no
 * longer silently pollutes the whole portfolio.
 */
export async function syncHoldings(
  userId: string,
  tokenStore: OAuthTokenStore,
  portfolioStore: PortfolioStore,
  fetcher: HoldingsFetcher,
  now: number = Date.now()
): Promise<SyncResult> {
  const token = tokenStore.get(userId);
  if (!isTokenUsable(token, now)) {
    return { success: false, reason: 'no usable OAuth token for this user (missing or expired) — refusing to sync', holdingsSynced: 0, holdingsRejected: 0 };
  }

  let rawHoldings: RawBrokerHolding[];
  try {
    rawHoldings = await fetcher(token as OAuthToken);
  } catch {
    // Post-audit fix (Finding 12-B): never surface the raw provider error
    // to the caller — same rationale as oauthFlow.ts's exchanger catch.
    return { success: false, reason: 'holdings fetch failed', holdingsSynced: 0, holdingsRejected: 0 };
  }

  const normalized = rawHoldings.map(normalizeHolding);
  const validHoldings: NormalizedHolding[] = [];
  let rejectedCount = 0;
  for (const holding of normalized) {
    if (validateNormalizedHolding(holding).valid) {
      validHoldings.push(holding);
    } else {
      rejectedCount += 1;
    }
  }

  portfolioStore.setHoldings(userId, validHoldings);

  return {
    success: true,
    reason: rejectedCount > 0 ? `synced with ${rejectedCount} invalid holding(s) rejected` : 'synced',
    holdingsSynced: validHoldings.length,
    holdingsRejected: rejectedCount,
  };
}
