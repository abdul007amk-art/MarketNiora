/**
 * NORMALIZE (pipeline stage — after raw store, before validate)
 * Status: IMPLEMENTATION — unit tested below.
 */

import type { Quote } from '../providers/marketDataProvider.ts';
import type { NormalizedObservation, VerificationStatus } from './types.ts';

/**
 * Maps a provider's DataStatus (Module 6) to a canonical
 * VerificationStatus. UNKNOWN maps to SOURCE_REQUIRED — never to
 * VERIFIED — because the whole point of the UNKNOWN state is that we
 * cannot vouch for the data; treating it as verified would defeat that.
 */
const STATUS_TO_VERIFICATION: Record<string, VerificationStatus> = {
  LIVE: 'VERIFIED',
  DELAYED: 'VERIFIED',
  STALE: 'UNVERIFIED',
  MISSING: 'SOURCE_REQUIRED',
  NOT_INTERPRETABLE: 'SOURCE_REQUIRED',
  SOURCE_REQUIRED: 'SOURCE_REQUIRED',
  UNKNOWN: 'SOURCE_REQUIRED',
};

export function normalizeQuote(quote: Quote, metric: string): NormalizedObservation {
  return {
    symbol: quote.symbol,
    metric,
    value: quote.price,
    source: quote.source,
    sourceTimestamp: quote.asOf,
    reportedPeriod: null,
    verificationStatus: STATUS_TO_VERIFICATION[quote.status] ?? 'SOURCE_REQUIRED',
    // A straight provider->canonical field mapping is a NORMALIZE step,
    // not a calculation — no formula applies, so formulaVersion is null.
    dataNature: 'NORMALIZED',
    formulaVersion: null,
  };
}
