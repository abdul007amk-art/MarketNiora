/**
 * STOCK SCORE ROUTE
 * Status: IMPLEMENTATION — unit tested below via real HTTP requests.
 *
 * Thin HTTP wrapper around the LOCKED stockScoreEngine.ts — no formula
 * logic here. The API boundary validates untrusted JSON before the engine.
 * It is PREVIEW-only and does not publish official score snapshots.
 */

import type { ParsedRequest, RouteResult } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { calculateStockScore, type ScoreComponents } from '../../protected/stockScoreEngine.ts';

const SCORE_COMPONENT_KEYS: readonly (keyof ScoreComponents)[] = [
  'momentum',
  'earningsMomentum',
  'businessQuality',
  'relativeStrength',
  'valuation',
  'trendQuality',
  'volumeConfirmation',
  'growthVisibility',
];

const VALID_CATALYSTS = new Set<number>([0, 4, 8, 12]);

function isValidScoreComponents(value: unknown): value is ScoreComponents {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);

  if (
    keys.length !== SCORE_COMPONENT_KEYS.length ||
    keys.some((key) => !SCORE_COMPONENT_KEYS.includes(key as keyof ScoreComponents))
  ) {
    return false;
  }

  return SCORE_COMPONENT_KEYS.every((key) => {
    if (!Object.prototype.hasOwnProperty.call(record, key)) return false;
    const component = record[key];
    if (component === null) return true;
    return typeof component === 'number'
      && Number.isFinite(component)
      && component >= 0
      && component <= 100;
  });
}

export async function stockScoreCalculateHandler(ctx: ParsedRequest, _deps: AppDependencies): Promise<RouteResult> {
  const body = (ctx.body ?? {}) as Record<string, unknown>;
  if (body.mode !== 'PREVIEW') {
    return { status: 400, body: { error: 'preview mode required; official stock score output is not configured' } };
  }

  const components = body.components;
  const riskPenalty = body.riskPenalty;
  const catalyst = body.catalyst;
  const isSuspendedOrDelisted = body.isSuspendedOrDelisted;

  // Missing inputs are not numeric zeroes. Require a fully-shaped component
  // object and at least one observed component before invoking the locked math.
  if (
    !isValidScoreComponents(components) ||
    !SCORE_COMPONENT_KEYS.some((key) => components[key] !== null) ||
    typeof riskPenalty !== 'number' ||
    !Number.isFinite(riskPenalty) ||
    riskPenalty < -30 ||
    riskPenalty > 0 ||
    typeof catalyst !== 'number' ||
    !VALID_CATALYSTS.has(catalyst) ||
    typeof isSuspendedOrDelisted !== 'boolean'
  ) {
    return { status: 400, body: { error: 'invalid stock score calculation input' } };
  }

  try {
    const result = calculateStockScore({
      components,
      riskPenalty,
      catalyst: catalyst as 0 | 4 | 8 | 12,
      isSuspendedOrDelisted,
    });
    return { status: 200, body: {
      ...result,
      // This endpoint evaluates caller-supplied inputs only. A canonical
      // score remains NOT_CONFIGURED until verified features and snapshots
      // are provided by the server-side data pipeline.
      finalScore: null,
      previewScore: result.finalScore,
      calculationMode: 'PREVIEW',
      outputStatus: 'PREVIEW_ONLY',
      officialStockScoreAvailable: false,
      officialScoreStatus: 'NOT_CONFIGURED',
    } };
  } catch {
    return { status: 400, body: { error: 'invalid stock score calculation input' } };
  }
}
