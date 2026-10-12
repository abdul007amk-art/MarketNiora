import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { NullMarketDataProvider } from '../../providers/marketDataProvider.ts';

/**
 * Public market-data read boundary.
 *
 * These endpoints report provider truth; they do not source, cache, or invent
 * data themselves. With no configured provider, the product must return
 * SOURCE_REQUIRED / NOT_CONFIGURED instead of a price of zero or demo data.
 */
function providerFor(deps: AppDependencies) {
  return deps.marketDataProvider ?? new NullMarketDataProvider();
}

function truthStateForQuote(status: string, providerName: string): string {
  if (providerName === 'NONE_CONFIGURED_MARKET_DATA' || status === 'SOURCE_REQUIRED') {
    return providerName === 'NONE_CONFIGURED_MARKET_DATA' ? 'NOT_CONFIGURED' : 'UNAVAILABLE';
  }
  if (status === 'UNKNOWN') return 'UNKNOWN';
  if (status === 'MISSING' || status === 'NOT_INTERPRETABLE') return 'UNAVAILABLE';
  return status;
}

export async function marketDataProviderHealthHandler(
  _ctx: ParsedRequest,
  deps: AppDependencies,
): Promise<RouteResult> {
  const provider = providerFor(deps);
  try {
    const health = await provider.healthCheck();
    const configured = provider.name !== 'NONE_CONFIGURED_MARKET_DATA';
    return {
      status: 200,
      body: {
        provider: health.providerName,
        configured,
        status: health.status,
        lastCheckedAt: health.lastCheckedAt,
        truthState: !configured ? 'NOT_CONFIGURED' : health.status === 'HEALTHY' ? 'CURRENT' : 'UNAVAILABLE',
        // Never return provider errors, tokens or credential/configuration detail.
        detail: !configured ? 'No market-data provider is configured.' : undefined,
      },
    };
  } catch {
    return {
      status: 503,
      body: {
        provider: provider.name,
        configured: provider.name !== 'NONE_CONFIGURED_MARKET_DATA',
        status: 'UNKNOWN',
        lastCheckedAt: null,
        truthState: 'UNKNOWN',
        detail: 'Provider health could not be verified.',
      },
    };
  }
}

export async function marketDataQuoteHandler(
  ctx: ParsedRequest,
  deps: AppDependencies,
): Promise<RouteResult> {
  const rawSymbol = ctx.params.symbol ?? '';
  const symbol = rawSymbol.trim().toUpperCase();

  // Accept common NSE symbol characters only. This also prevents path/query
  // injection and keeps upstream provider calls bounded to a single symbol.
  if (!/^[A-Z0-9&.-]{1,25}$/.test(symbol)) {
    return { status: 400, body: { error: 'invalid symbol' } };
  }

  const provider = providerFor(deps);
  try {
    const quote = await provider.getQuote(symbol);
    return {
      status: 200,
      body: {
        symbol: quote.symbol,
        price: Number.isFinite(quote.price) ? quote.price : null,
        currency: 'INR',
        dataStatus: quote.status,
        source: quote.source,
        asOf: quote.asOf,
        truthState: truthStateForQuote(quote.status, provider.name),
      },
    };
  } catch {
    return {
      status: 503,
      body: {
        symbol,
        price: null,
        currency: 'INR',
        dataStatus: 'UNKNOWN',
        source: provider.name,
        asOf: null,
        truthState: 'UNKNOWN',
        detail: 'Market data could not be fetched.',
      },
    };
  }
}
