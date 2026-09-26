/** CHUNK 6 — BCF-1.0 Balance Sheet & Cash-Flow Opportunity */
export type BcfState = 'COMPUTABLE' | 'NOT_COMPUTABLE';

export interface BcfFcfInput {
  cfo: number | null;
  capex: number | null;
}

export interface BcfMetric {
  state: BcfState;
  value: number | null;
  reason: string | null;
}

export function calculateFcf(input: BcfFcfInput): BcfMetric {
  if (input.cfo === null || !Number.isFinite(input.cfo)) {
    return { state: 'NOT_COMPUTABLE', value: null, reason: 'CFO missing' };
  }
  if (input.capex === null || !Number.isFinite(input.capex)) {
    return { state: 'NOT_COMPUTABLE', value: null, reason: 'Capex missing' };
  }
  return { state: 'COMPUTABLE', value: input.cfo - input.capex, reason: null };
}
