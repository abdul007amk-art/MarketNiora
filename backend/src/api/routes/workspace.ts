import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';

function unavailable(): RouteResult {
  return {
    status: 503,
    body: {
      truthState: 'NOT_CONFIGURED',
      detail: 'Workspace database is not configured for this runtime.',
    },
  };
}

function boundedLimit(raw: string | null, fallback = 25): number | null {
  if (raw === null || raw === '') return fallback;
  if (!/^\d{1,3}$/.test(raw)) return null;
  const parsed = Number(raw);
  return parsed >= 1 && parsed <= 100 ? parsed : null;
}

function normalizedQuery(raw: string | null): string | null | false {
  if (raw === null || raw.trim() === '') return null;
  const value = raw.trim();
  if (value.length > 100 || /[\u0000-\u001f\u007f]/.test(value)) return false;
  return value;
}

function storeFor(deps: AppDependencies) {
  return deps.workspaceReadStore;
}

export async function workspaceSummaryHandler(
  _ctx: ParsedRequest,
  deps: AppDependencies,
): Promise<RouteResult> {
  const store = storeFor(deps);
  if (!store) return unavailable();
  try {
    const summary = await store.getSummary();
    return {
      status: 200,
      body: {
        truthState: summary.canonicalStocks > 0 ? 'CANONICAL_RECORDS_PRESENT' : 'NOT_LOADED',
        ...summary,
      },
    };
  } catch {
    return { status: 503, body: { truthState: 'UNKNOWN', detail: 'Workspace summary could not be loaded.' } };
  }
}

export async function workspaceStocksHandler(
  ctx: ParsedRequest,
  deps: AppDependencies,
): Promise<RouteResult> {
  const store = storeFor(deps);
  if (!store) return unavailable();

  const query = normalizedQuery(ctx.query.get('q'));
  const sector = normalizedQuery(ctx.query.get('sector'));
  const limit = boundedLimit(ctx.query.get('limit'));
  if (query === false || sector === false || limit === null) {
    return { status: 400, body: { error: 'Invalid query. Search text is limited to 100 characters and limit must be between 1 and 100.' } };
  }

  try {
    const result = await store.searchStocks({ query: query ?? undefined, sector: sector ?? undefined, limit });
    return {
      status: 200,
      body: {
        truthState: result.total > 0 ? 'CANONICAL_RECORDS_PRESENT' : 'NO_MATCHES',
        total: result.total,
        limit,
        items: result.items,
      },
    };
  } catch {
    return { status: 503, body: { truthState: 'UNKNOWN', detail: 'Stock registry could not be loaded.' } };
  }
}

export async function workspaceRotationHandler(
  ctx: ParsedRequest,
  deps: AppDependencies,
): Promise<RouteResult> {
  const store = storeFor(deps);
  if (!store) return unavailable();
  const horizon = (ctx.query.get('horizon') ?? '1D').toUpperCase();
  if (!['1D', '1W', '1M', '3M'].includes(horizon)) {
    return { status: 400, body: { error: 'horizon must be one of 1D, 1W, 1M, or 3M.' } };
  }
  const limit = boundedLimit(ctx.query.get('limit'), 50);
  if (limit === null) return { status: 400, body: { error: 'limit must be between 1 and 100.' } };

  try {
    const result = await store.getRotation(horizon, limit);
    return {
      status: 200,
      body: {
        truthState: result.items.length > 0 ? 'VERIFIED_SNAPSHOTS_AVAILABLE' : 'NO_VERIFIED_SNAPSHOTS',
        horizon,
        items: result.items,
      },
    };
  } catch {
    return { status: 503, body: { truthState: 'UNKNOWN', detail: 'Verified rotation snapshots could not be loaded.' } };
  }
}

export async function workspaceThemesHandler(
  ctx: ParsedRequest,
  deps: AppDependencies,
): Promise<RouteResult> {
  const store = storeFor(deps);
  if (!store) return unavailable();
  const query = normalizedQuery(ctx.query.get('q'));
  const limit = boundedLimit(ctx.query.get('limit'), 50);
  if (query === false || limit === null) {
    return { status: 400, body: { error: 'Invalid query. Search text is limited to 100 characters and limit must be between 1 and 100.' } };
  }

  try {
    const result = await store.getThemes(query ?? '', limit);
    return {
      status: 200,
      body: {
        truthState: result.items.length > 0 ? 'MAPPED_THEMES_AVAILABLE' : 'NO_VERIFIED_THEME_RECORDS',
        items: result.items,
      },
    };
  } catch {
    return { status: 503, body: { truthState: 'UNKNOWN', detail: 'Theme mappings could not be loaded.' } };
  }

function symbolReadInput(ctx: ParsedRequest): { symbol: string; exchange?: string; limit: number } | RouteResult {
  const symbol = (ctx.params.symbol ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9&.-]{1,25}$/.test(symbol)) {
    return { status: 400, body: { error: 'invalid symbol' } };
  }
  const rawExchange = ctx.query.get('exchange');
  const exchange = rawExchange ? rawExchange.trim().toUpperCase() : undefined;
  if (exchange && !['NSE', 'BSE'].includes(exchange)) {
    return { status: 400, body: { error: 'exchange must be NSE or BSE.' } };
  }
  const limit = boundedLimit(ctx.query.get('limit'), 50);
  if (limit === null) return { status: 400, body: { error: 'limit must be between 1 and 100.' } };
  return { symbol, exchange, limit };
}

function statusForSymbolResult(result: Record<string, unknown>): number {
  if (result.truthState === 'NOT_FOUND') return 404;
  if (result.truthState === 'AMBIGUOUS') return 409;
  return 200;
}

async function symbolReadHandler(
  ctx: ParsedRequest,
  deps: AppDependencies,
  operation: 'company' | 'value-chain' | 'fundamentals' | 'research',
): Promise<RouteResult> {
  const store = storeFor(deps);
  if (!store) return unavailable();
  const input = symbolReadInput(ctx);
  if ('status' in input) return input;

  try {
    let result: Record<string, unknown>;
    if (operation === 'company') result = await store.getCompany(input.symbol, input.exchange);
    else if (operation === 'value-chain') result = await store.getValueChain(input.symbol, input.exchange);
    else if (operation === 'fundamentals') result = await store.getFundamentals(input.symbol, input.exchange, input.limit);
    else result = await store.getResearchEvidence(input.symbol, input.exchange, input.limit);
    return { status: statusForSymbolResult(result), body: result };
  } catch {
    const detail = operation === 'company' ? 'Company record could not be loaded.'
      : operation === 'value-chain' ? 'Verified value-chain evidence could not be loaded.'
        : operation === 'fundamentals' ? 'Verified fundamental evidence could not be loaded.'
          : 'Verified research evidence could not be loaded.';
    return { status: 503, body: { truthState: 'UNKNOWN', detail } };
  }
}

export async function workspaceCompanyHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  return symbolReadHandler(ctx, deps, 'company');
}

export async function workspaceValueChainHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  return symbolReadHandler(ctx, deps, 'value-chain');
}

export async function workspaceFundamentalsHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  return symbolReadHandler(ctx, deps, 'fundamentals');
}

export async function workspaceResearchEvidenceHandler(ctx: ParsedRequest, deps: AppDependencies): Promise<RouteResult> {
  return symbolReadHandler(ctx, deps, 'research');
}

}
