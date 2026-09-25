/**
 * CHUNK 5 — PGQ-1.0
 * Margin and growth primitives only; no final PGQ score.
 */
export type PgqState = 'COMPUTABLE' | 'NOT_COMPUTABLE' | 'NOT_COMPARABLE' | 'TURNAROUND_EVENT';

export interface PgqMetric {
  state: PgqState;
  value: number | null;
  reason: string | null;
}

export function margin(profit: number | null, revenue: number | null): PgqMetric {
  if (profit === null || revenue === null || !Number.isFinite(profit) || !Number.isFinite(revenue)) {
    return { state: 'NOT_COMPUTABLE', value: null, reason: 'profit or revenue missing' };
  }
  if (revenue === 0) return { state: 'NOT_COMPUTABLE', value: null, reason: 'denominator is zero' };
  return { state: 'COMPUTABLE', value: profit / revenue * 100, reason: null };
}

export function growth(current: number | null, previous: number | null): PgqMetric {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) {
    return { state: 'NOT_COMPUTABLE', value: null, reason: 'current or prior value missing' };
  }
  if (previous === 0) return { state: 'NOT_COMPUTABLE', value: null, reason: 'denominator is zero' };
  if (previous < 0) {
    if (current >= 0) return { state: 'TURNAROUND_EVENT', value: null, reason: 'negative-to-positive base' };
    return { state: 'NOT_COMPARABLE', value: null, reason: 'negative base' };
  }
  return { state: 'COMPUTABLE', value: (current - previous) / previous * 100, reason: null };
}
