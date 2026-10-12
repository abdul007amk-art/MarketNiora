/**
 * UPSTOX LTP QUOTES V3 ADAPTER
 *
 * API: GET https://api.upstox.com/v3/market-quote/ltp
 *
 * Important truth boundary:
 * - Requires a server-side Upstox access token and a verified NSE symbol ->
 *   instrument_key mapping supplied by the caller.
 * - The LTP response does not establish a trustworthy observation timestamp
 *   for this data contract, so returned prices deliberately have asOf=null
 *   and status=UNKNOWN until an approved timestamp/freshness policy is wired.
 * - Missing/ambiguous/unverified instrument mappings return SOURCE_REQUIRED.
 * - Provider exceptions never expose response bodies, request headers or token.
 *
 * Reference: Upstox LTP Quotes V3 and Instruments JSON documentation.
 */

import type { DataStatus, ProviderHealth } from './sourceHealth.ts';
import type { MarketDataProvider, Quote } from './marketDataProvider.ts';

export interface InstrumentMappingRecord {
  symbol: string;
  exchange: string;
  instrumentKey: string;
  mappingStatus: string;
}

export interface InstrumentKeyResolver {
  resolve(symbol: string): Promise<string | null> | string | null;
}

export type UpstoxFetch = typeof fetch;

const SOURCE = 'UPSTOX_LTP_V3';
const LTP_ENDPOINT = 'https://api.upstox.com/v3/market-quote/ltp';
const PROFILE_LABEL = 'Upstox API status is based on the most recent quote request; it is not a freshness guarantee.';
const HEALTH_MAX_AGE_MS = 60_000;
const INSTRUMENT_KEY_PATTERN = /^NSE_EQ\|[A-Z0-9]+$/;

export function isValidNseEquityInstrumentKey(value: string): boolean {
  return INSTRUMENT_KEY_PATTERN.test(value);
}

/**
 * Resolves only a single distinct, explicitly VERIFIED NSE mapping.
 * A conflict, exchange mismatch, non-verified row or malformed instrument_key
 * must never be resolved by taking the first matching row.
 */
export function resolveVerifiedNseInstrumentKey(
  symbol: string,
  records: InstrumentMappingRecord[],
): string | null {
  const normalizedSymbol = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9&.-]{1,25}$/.test(normalizedSymbol)) return null;

  const matching = records.filter((row) =>
    row.symbol.trim().toUpperCase() === normalizedSymbol &&
    row.exchange.trim().toUpperCase() === 'NSE' &&
    row.mappingStatus === 'VERIFIED' &&
    isValidNseEquityInstrumentKey(row.instrumentKey)
  );
  const keys = [...new Set(matching.map((row) => row.instrumentKey))];
  return keys.length === 1 ? keys[0] : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function lastPriceForInstrument(payload: unknown, instrumentKey: string): number | null {
  const envelope = asRecord(payload);
  if (!envelope || envelope.status !== 'success') return null;

  const data = asRecord(envelope.data);
  if (!data) return null;

  const normalizedKey = instrumentKey.replace('|', ':');
  let quote: Record<string, unknown> | null = null;

  for (const [entryKey, rawQuote] of Object.entries(data)) {
    const candidate = asRecord(rawQuote);
    if (!candidate) continue;
    const embeddedKey = candidate.instrument_token ?? candidate.instrument_key;
    if (entryKey === normalizedKey || entryKey === instrumentKey || embeddedKey === instrumentKey) {
      if (quote) return null; // ambiguous response is rejected
      quote = candidate;
    }
  }

  if (!quote) return null;
  const lastPrice = quote.last_price;
  if (typeof lastPrice !== 'number' || !Number.isFinite(lastPrice) || lastPrice <= 0) return null;
  return lastPrice;
}

export class UpstoxLtpProvider implements MarketDataProvider {
  public readonly name = SOURCE;
  private readonly accessToken: string;
  private readonly resolver: InstrumentKeyResolver;
  private readonly fetcher: UpstoxFetch;
  private lastProviderStatus: ProviderHealth['status'] = 'UNKNOWN';
  private lastProviderCheckAt = 0;
  private lastProviderDetail = 'No Upstox quote request has been verified yet.';

  constructor(options: {
    accessToken: string;
    instrumentResolver: InstrumentKeyResolver;
    fetcher?: UpstoxFetch;
  }) {
    if (!options.accessToken || options.accessToken.trim().length === 0) {
      throw new Error('Upstox access token is required.');
    }
    if (!options.instrumentResolver || typeof options.instrumentResolver.resolve !== 'function') {
      throw new Error('A verified instrument-key resolver is required.');
    }
    this.accessToken = options.accessToken;
    this.resolver = options.instrumentResolver;
    this.fetcher = options.fetcher ?? fetch;
  }

  async getQuote(symbol: string, now: number = Date.now()): Promise<Quote> {
    const normalizedSymbol = symbol.trim().toUpperCase();
    if (!/^[A-Z0-9&.-]{1,25}$/.test(normalizedSymbol)) {
      return this.unavailable(normalizedSymbol, 'SOURCE_REQUIRED');
    }

    const instrumentKey = await this.resolver.resolve(normalizedSymbol);
    if (!instrumentKey || !isValidNseEquityInstrumentKey(instrumentKey)) {
      this.markProviderFailure(now, 'Required verified instrument mapping is unavailable.');
      return this.unavailable(normalizedSymbol, 'SOURCE_REQUIRED');
    }

    const url = new URL(LTP_ENDPOINT);
    url.searchParams.set('instrument_key', instrumentKey);

    let response: Response;
    try {
      response = await this.fetcher(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer ' + this.accessToken,
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      this.markProviderFailure(now, 'Upstox quote request did not complete.');
      throw new Error('Upstox quote request unavailable.');
    }

    if (!response.ok) {
      this.markProviderFailure(now, 'Upstox quote endpoint rejected the request.');
      // Do not include response body, headers, token, or upstream diagnostics.
      throw new Error('Upstox quote request rejected with HTTP ' + response.status + '.');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      this.markProviderFailure(now, 'Upstox returned an unreadable quote response.');
      throw new Error('Upstox quote response unavailable.');
    }

    const price = lastPriceForInstrument(payload, instrumentKey);
    this.lastProviderStatus = 'HEALTHY';
    this.lastProviderCheckAt = now;
    this.lastProviderDetail = PROFILE_LABEL;

    if (price === null) {
      // Successful HTTP transport does not make malformed/unmatched quote
      // content verified. Do not return a numerical placeholder.
      return this.unavailable(normalizedSymbol, 'NOT_INTERPRETABLE');
    }

    const status: DataStatus = 'UNKNOWN';
    return {
      symbol: normalizedSymbol,
      price,
      status,
      asOf: null, // intentionally not synthesized from request time
      source: this.name,
    };
  }

  async healthCheck(now: number = Date.now()): Promise<ProviderHealth> {
    if (this.lastProviderCheckAt === 0 || now - this.lastProviderCheckAt > HEALTH_MAX_AGE_MS) {
      return {
        providerName: this.name,
        status: 'UNKNOWN',
        lastCheckedAt: this.lastProviderCheckAt || now,
        detail: 'Configured, but a recent Upstox request has not verified provider health.',
      };
    }
    return {
      providerName: this.name,
      status: this.lastProviderStatus,
      lastCheckedAt: this.lastProviderCheckAt,
      detail: this.lastProviderDetail,
    };
  }

  private markProviderFailure(now: number, detail: string): void {
    this.lastProviderStatus = 'DEGRADED';
    this.lastProviderCheckAt = now;
    this.lastProviderDetail = detail;
  }

  private unavailable(symbol: string, status: DataStatus): Quote {
    return {
      symbol,
      price: null,
      status,
      asOf: null,
      source: this.name,
    };
  }
}
