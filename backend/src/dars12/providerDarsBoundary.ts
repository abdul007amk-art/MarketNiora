import type { Quote, MarketDataProvider } from '../providers/marketDataProvider.ts';
import type { RawDarsEvent, VerificationStatus } from './dars12Engine.ts';

export interface ProviderDarsEventResult {
  event: RawDarsEvent | null;
  status: Quote['status'];
  reason?: string;
}

function verificationFor(status: Quote['status']): VerificationStatus {
  return status === 'LIVE' || status === 'DELAYED' ? 'VERIFIED' : 'SOURCE_REQUIRED';
}

/**
 * Converts a real provider quote into the DARS raw-event contract.
 * No quote with missing/unusable provenance is allowed into DARS.
 * DARS owns downstream validation; this boundary only translates provider truth.
 */
export function quoteToDarsEvent(
  quote: Quote,
  runKnowledgeTime: number,
  sourceEventId: string
): ProviderDarsEventResult {
  if (!Number.isFinite(runKnowledgeTime) || !Number.isInteger(runKnowledgeTime)) {
    return { event: null, status: 'UNKNOWN', reason: 'runKnowledgeTime must be a finite integer' };
  }
  if (!sourceEventId || !quote.symbol || !quote.source) {
    return { event: null, status: quote.status, reason: 'provider quote is missing required identity fields' };
  }
  if (quote.price === null || quote.asOf === null) {
    return { event: null, status: quote.status, reason: 'provider quote has no usable value/provenance timestamp' };
  }
  if (!Number.isFinite(quote.price) || !Number.isFinite(quote.asOf)) {
    return { event: null, status: 'UNKNOWN', reason: 'provider quote contains non-finite value/provenance' };
  }
  if (quote.asOf > runKnowledgeTime) {
    return { event: null, status: 'UNKNOWN', reason: 'provider observation is newer than the DARS run knowledge time' };
  }

  const verificationStatus = verificationFor(quote.status);
  if (verificationStatus === 'SOURCE_REQUIRED') {
    return { event: null, status: quote.status, reason: 'provider truth state is not eligible for DARS evidence' };
  }

  return {
    status: quote.status,
    event: {
      sourceEventId,
      source: quote.source,
      symbol: quote.symbol,
      value: String(quote.price),
      sourceTimestamp: quote.asOf,
      effectiveTime: quote.asOf,
      knowledgeTime: runKnowledgeTime,
      verificationStatus,
      dataNature: 'RAW',
      formulaVersion: null,
    },
  };
}

export interface ProviderDarsFetchResult {
  events: RawDarsEvent[];
  providerHealthy: boolean;
  errors: string[];
}

/**
 * Fetches a symbol list from the configured provider and translates only
 * usable quotes. Provider failures remain explicit; no synthetic events are created.
 */
export async function fetchDarsEvents(
  provider: MarketDataProvider,
  symbols: readonly string[],
  runKnowledgeTime: number
): Promise<ProviderDarsFetchResult> {
  const health = await provider.healthCheck(runKnowledgeTime);
  if (health.status !== 'HEALTHY') {
    return { events: [], providerHealthy: false, errors: [health.detail ?? `provider health is ${health.status}`] };
  }

  const events: RawDarsEvent[] = [];
  const errors: string[] = [];
  for (const symbol of symbols) {
    const quote = await provider.getQuote(symbol, runKnowledgeTime);
    const result = quoteToDarsEvent(quote, runKnowledgeTime, `${quote.source}:${symbol}:${quote.asOf ?? 'MISSING'}`);
    if (result.event) events.push(result.event);
    else errors.push(`${symbol}: ${result.reason ?? 'quote rejected at DARS boundary'}`);
  }
  return { events, providerHealthy: true, errors };
}
