import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';

export async function healthHandler(_ctx: ParsedRequest, _deps: AppDependencies): Promise<RouteResult> {
  return { status: 200, body: { status: 'ok' } };
}
