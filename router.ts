/**
 * ROUTER
 * Status: IMPLEMENTATION — unit tested below. No framework (Express/
 * Fastify) — deliberately built on nothing but plain string matching,
 * consistent with this repo's zero-network-install-dependency approach.
 */

export interface ParsedRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  cookies: Record<string, string>;
  headers: Record<string, string | string[] | undefined>;
}

export interface RouteResult {
  status: number;
  body: unknown;
  headers?: Record<string, string | string[]>;
}

export type RouteHandler<TDeps> = (ctx: ParsedRequest, deps: TDeps) => Promise<RouteResult>;

export interface Route<TDeps> {
  method: string;
  pattern: string;
  handler: RouteHandler<TDeps>;
}

export interface RouteMatch<TDeps> {
  route: Route<TDeps>;
  params: Record<string, string>;
}

/**
 * Exact path-shape matching: pattern and path must have the same number
 * of segments. `:name` segments capture; anything else must match
 * literally. No wildcards, no partial matches — a route either matches
 * fully or it doesn't (fail-closed on ambiguity rather than guessing).
 */
function matchPath(pattern: string, path: string): Record<string, string> | null {
  const patternParts = pattern.split('/').filter((p) => p.length > 0);
  const pathParts = path.split('/').filter((p) => p.length > 0);
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const part = patternParts[i];
    if (part.startsWith(':')) {
      params[part.slice(1)] = decodeURIComponent(pathParts[i]);
    } else if (part !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

export function matchRoute<TDeps>(routes: Route<TDeps>[], method: string, path: string): RouteMatch<TDeps> | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const params = matchPath(route.pattern, path);
    if (params) return { route, params };
  }
  return null;
}
