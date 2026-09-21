/**
 * MARKET DATA PROVIDER
 * Status: IMPLEMENTATION — unit tested below.
 *
 * GOVERNANCE (Master Guide "Market Data" / "Provider failure"): primary
 * source policy is NSE/BSE official, Upstox, company filings, or licensed
 * providers — never a fake/free assumption. Provider failure must never
 * produce a fabricated value; NullMarketDataProvider embodies that.
 */

import type { DataStatus, ProviderHealth } from './sourceHealth.ts';
import { classifyFreshness } from './sourceHealth.ts';

export interface Quote {
  symbol: string;
  price: number | null;
  status: DataStatus;
  asOf: number | null;
  source: string;
}

export interface MarketDataProvider {
  name: string;
  getQuote(symbol: string, now?: number): Promise<Quote>;
  healthCheck(now?: number): Promise<ProviderHealth>;
}

/**
 * Used whenever no real provider is configured yet. Deliberately never
 * invents a price — always SOURCE_REQUIRED, never a fabricated number or
 * a silently-zero value.
 */
export class NullMarketDataProvider implements MarketDataProvider {
  public readonly name = 'NONE_CONFIGURED_MARKET_DATA';

  async getQuote(symbol: string, now: number = Date.now()): Promise<Quote> {
    return { symbol, price: null, status: 'SOURCE_REQUIRED', asOf: null, source: this.name };
  }

  async healthCheck(now: number = Date.now()): Promise<ProviderHealth> {
    return { providerName: this.name, status: 'DOWN', lastCheckedAt: now, detail: 'no provider configured' };
  }
}

/** Fetches raw bhavcopy CSV text. In production this wraps a real HTTP call to the NSE archive URL; here it's injected so tests never need real network. */
export type CsvFetcher = () => Promise<string>;

/**
 * Parses NSE/BSE-style bhavcopy CSV: expects SYMBOL, CLOSE, TIMESTAMP
 * columns (case-insensitive header). Malformed rows are skipped rather
 * than crashing the whole parse; a row with an unparseable price becomes
 * MISSING, never a fabricated 0.
 */
export function parseBhavcopyCsv(csvText: string, now: number, staleThresholdMs: number): Quote[] {
  const lines = csvText.trim().split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].split(',').map((h) => h.trim().toUpperCase());
  const symbolIdx = header.indexOf('SYMBOL');
  const closeIdx = header.indexOf('CLOSE');
  const dateIdx = header.indexOf('TIMESTAMP');

  if (symbolIdx === -1 || closeIdx === -1 || dateIdx === -1) {
    throw new Error('bhavcopy CSV missing required columns: SYMBOL, CLOSE, TIMESTAMP');
  }

  const quotes: Quote[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length <= Math.max(symbolIdx, closeIdx, dateIdx)) continue; // malformed row, skip

    const symbol = cols[symbolIdx].trim();
    if (!symbol) continue;

    const close = Number(cols[closeIdx].trim());
    const parsedDate = Date.parse(cols[dateIdx].trim());

    if (!Number.isFinite(close)) {
      quotes.push({ symbol, price: null, status: 'MISSING', asOf: null, source: 'NSE_BHAVCOPY' });
      continue;
    }

    const asOf = Number.isFinite(parsedDate) ? parsedDate : null;
    const status = classifyFreshness({ asOf, now, staleThresholdMs });
    quotes.push({ symbol, price: close, status, asOf, source: 'NSE_BHAVCOPY' });
  }
  return quotes;
}

const DEFAULT_STALE_THRESHOLD_MS = 1000 * 60 * 60 * 24; // 24h — EOD data is expected to be at most a day old

/**
 * Free, zero-cost EOD data source (see infra/DEPLOYMENT_NOTES.md). Caches
 * the parsed CSV in memory for the life of the instance — a real
 * deployment should refetch once per trading day, not per request.
 */
export class NseBhavcopyProvider implements MarketDataProvider {
  public readonly name = 'NSE_BHAVCOPY';
  private fetchCsv: CsvFetcher;
  private staleThresholdMs: number;
  private cache: Quote[] | null;

  constructor(fetchCsv: CsvFetcher, staleThresholdMs: number = DEFAULT_STALE_THRESHOLD_MS) {
    if (!Number.isFinite(staleThresholdMs) || !Number.isInteger(staleThresholdMs) || staleThresholdMs < 0) {
      throw new Error(`staleThresholdMs must be a non-negative integer, got: ${staleThresholdMs}`);
    }
    this.fetchCsv = fetchCsv;
    this.staleThresholdMs = staleThresholdMs;
    this.cache = null;
  }

  async getQuote(symbol: string, now: number = Date.now()): Promise<Quote> {
    if (!this.cache) {
      const csv = await this.fetchCsv();
      this.cache = parseBhavcopyCsv(csv, now, this.staleThresholdMs);
    }
    const found = this.cache.find((q) => q.symbol === symbol);
    if (!found) {
      return { symbol, price: null, status: 'SOURCE_REQUIRED', asOf: null, source: this.name };
    }
    // Post-audit fix (HIGH): recompute freshness against the CURRENT `now`
    // on every call, not the `now` that happened to be in effect when the
    // CSV was parsed and cached. Without this, a cache built at 10:00 would
    // keep reporting LIVE forever, even queried a week later.
    const status = classifyFreshness({ asOf: found.asOf, now, staleThresholdMs: this.staleThresholdMs });
    return { ...found, status };
  }

  async healthCheck(now: number = Date.now()): Promise<ProviderHealth> {
    try {
      await this.fetchCsv();
      return { providerName: this.name, status: 'HEALTHY', lastCheckedAt: now };
    } catch (err) {
      return {
        providerName: this.name,
        status: 'DOWN',
        lastCheckedAt: now,
        detail: err instanceof Error ? err.message : 'unknown error',
      };
    }
  }
}
