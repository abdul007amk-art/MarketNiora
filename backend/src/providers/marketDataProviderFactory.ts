/**
 * Configured market-data provider selection.
 *
 * The safe default is always NullMarketDataProvider. Upstox is activated only
 * when both the short-lived access token and official instrument JSON URL are
 * supplied. Partial configuration is a startup error (no silent fallback).
 *
 * This factory does not persist observations or approve LIVE freshness. The
 * current LTP adapter leaves asOf=null/status=UNKNOWN until the data contract
 * can justify a source timestamp.
 */

import type { MarketDataProvider } from './marketDataProvider.ts';
import { NullMarketDataProvider } from './marketDataProvider.ts';
import { UpstoxInstrumentDirectory, UpstoxLtpProvider, type UpstoxFetch } from './upstoxLtpProvider.ts';
import {
  loadUpstoxAccessTokenConfig,
  loadUpstoxInstrumentFeedConfig,
  upstoxLtpRuntimeConfigState,
} from './providerConfig.ts';

export function createConfiguredMarketDataProvider(fetcher?: UpstoxFetch): MarketDataProvider {
  const state = upstoxLtpRuntimeConfigState();
  if (state === 'NONE') return new NullMarketDataProvider();
  if (state === 'PARTIAL') {
    throw new Error('Upstox market data requires both UPSTOX_ACCESS_TOKEN and UPSTOX_INSTRUMENTS_JSON_URL.');
  }

  const { accessToken } = loadUpstoxAccessTokenConfig();
  const { instrumentsJsonUrl } = loadUpstoxInstrumentFeedConfig();
  const instrumentResolver = new UpstoxInstrumentDirectory({
    instrumentsJsonUrl,
    fetcher,
  });

  return new UpstoxLtpProvider({
    accessToken,
    instrumentResolver,
    fetcher,
  });
}
