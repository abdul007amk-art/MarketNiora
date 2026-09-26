/**
 * CHUNK 5 — CFQ-1.0
 * Only explicit v1.3 calculations are executable here.
 */
export type CfqState = 'COMPUTABLE' | 'NOT_COMPUTABLE' | 'NOT_COMPARABLE';

export interface CfqMetric {
  state: CfqState;
  value: number | null;
  reason: string | null;
}

export function cfoToPat(cfo: number | null, pat: number | null): CfqMetric {
  if (pat === null || !Number.isFinite(pat) || cfo === null || !Number.isFinite(cfo)) {
    return { state: 'NOT_COMPUTABLE', value: null, reason: 'CFO or PAT missing' };
  }
  if (pat === 0) return { state: 'NOT_COMPUTABLE', value: null, reason: 'PAT is zero' };
  if (pat < 0) return { state: 'NOT_COMPARABLE', value: null, reason: 'PAT is negative' };
  return { state: 'COMPUTABLE', value: cfo / pat, reason: null };
}

export function freeCashFlow(cfo: number | null, capex: number | null): CfqMetric {
  if (cfo === null || !Number.isFinite(cfo) || capex === null || !Number.isFinite(capex)) {
    return { state: 'NOT_COMPUTABLE', value: null, reason: 'CFO or Capex missing' };
  }
  return { state: 'COMPUTABLE', value: cfo - capex, reason: null };
}
