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
}
