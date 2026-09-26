/**
 * CHUNK 5 — CEI-1.3 Capital Efficiency Intelligence
 *
 * Only rules explicitly stated in the authoritative CHUNK 5 EBI v1.3
 * package are implemented here. No score or verdict is produced.
 * Missing inputs are never silently converted to zero.
 */

export type CeiState = 'COMPUTABLE' | 'NOT_COMPUTABLE' | 'NOT_COMPARABLE';

export interface CeiInputs {
  pat: number | null;
  currentEquity: number | null;
  priorEquity: number | null;
  ebit: number | null;
  totalAssets: number | null;
  currentLiabilities: number | null;
  shortTermInterestBearingDebt: number | null;
  longTermInterestBearingDebt: number | null;
  totalEquity: number | null;
  cashAndMarketableSecurities: number | null;
  priorInvestedCapital: number | null;
  effectiveTaxRate: number | null;
}

export interface CeiMetric {
  state: CeiState;
  value: number | null;
  reason: string | null;
}

export interface CeiResult {
  roe: CeiMetric;
  roce: CeiMetric;
  roic: CeiMetric;
  nopat: CeiMetric;
  investedCapital: CeiMetric;
  averageInvestedCapital: CeiMetric;
  totalDebt: CeiMetric;
}

function finite(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

function missing(...values: Array<number | null>): boolean {
  return values.some((value) => !finite(value));
}

export function calculateCei(input: CeiInputs): CeiResult {
  const totalDebt: CeiMetric =
    missing(input.shortTermInterestBearingDebt, input.longTermInterestBearingDebt)
      ? { state: 'NOT_COMPUTABLE', value: null, reason: 'required debt input missing' }
      : {
          state: 'COMPUTABLE',
          value: input.shortTermInterestBearingDebt! + input.longTermInterestBearingDebt!,
          reason: null,
        };

  const investedCapital: CeiMetric =
    totalDebt.state !== 'COMPUTABLE' || missing(input.totalEquity, input.cashAndMarketableSecurities)
      ? { state: 'NOT_COMPUTABLE', value: null, reason: 'required debt/equity/cash input missing' }
      : {
          state: 'COMPUTABLE',
          value: totalDebt.value! + input.totalEquity! - input.cashAndMarketableSecurities!,
          reason: null,
        };

  const averageInvestedCapital: CeiMetric =
    investedCapital.state !== 'COMPUTABLE' || !finite(input.priorInvestedCapital)
      ? { state: 'NOT_COMPUTABLE', value: null, reason: 'current or prior invested capital missing' }
      : {
          state: 'COMPUTABLE',
          value: (investedCapital.value! + input.priorInvestedCapital!) / 2,
          reason: null,
        };

  const nopat: CeiMetric =
    !finite(input.ebit) || !finite(input.effectiveTaxRate)
      ? { state: 'NOT_COMPUTABLE', value: null, reason: 'EBIT or ETR missing' }
      : input.effectiveTaxRate! < 0 || input.effectiveTaxRate! > 1
        ? { state: 'NOT_COMPUTABLE', value: null, reason: 'ETR_OUTSIDE_STANDARD_RANGE' }
        : {
            state: 'COMPUTABLE',
            value: input.ebit! * (1 - input.effectiveTaxRate!),
            reason: null,
          };

  const averageEquity =
    missing(input.currentEquity, input.priorEquity)
      ? null
      : (input.currentEquity! + input.priorEquity!) / 2;

  const roe: CeiMetric =
    !finite(input.pat) || averageEquity === null
      ? { state: 'NOT_COMPUTABLE', value: null, reason: 'required equity/PAT input missing' }
      : averageEquity === 0
        ? { state: 'NOT_COMPUTABLE', value: null, reason: 'average equity is zero' }
        : { state: 'COMPUTABLE', value: input.pat! / averageEquity * 100, reason: null };

  const capitalEmployed =
    missing(input.totalAssets, input.currentLiabilities)
      ? null
      : input.totalAssets! - input.currentLiabilities!;

  const roce: CeiMetric =
    capitalEmployed === null
      ? { state: 'NOT_COMPUTABLE', value: null, reason: 'required assets/liabilities input missing' }
      : capitalEmployed === 0
        ? { state: 'NOT_COMPUTABLE', value: null, reason: 'capital employed is zero' }
        : capitalEmployed < 0
          ? { state: 'NOT_COMPARABLE', value: null, reason: 'capital employed is negative' }
          : !finite(input.ebit)
            ? { state: 'NOT_COMPUTABLE', value: null, reason: 'EBIT missing' }
            : { state: 'COMPUTABLE', value: input.ebit! / capitalEmployed * 100, reason: null };

  const roic: CeiMetric =
    averageInvestedCapital.state !== 'COMPUTABLE'
      ? { state: 'NOT_COMPUTABLE', value: null, reason: averageInvestedCapital.reason }
      : averageInvestedCapital.value === 0
        ? { state: 'NOT_COMPUTABLE', value: null, reason: 'average invested capital is zero' }
        : averageInvestedCapital.value! < 0
          ? { state: 'NOT_COMPARABLE', value: null, reason: 'average invested capital is negative' }
          : nopat.state !== 'COMPUTABLE'
            ? { state: 'NOT_COMPUTABLE', value: null, reason: nopat.reason }
            : {
                state: 'COMPUTABLE',
                value: nopat.value! / averageInvestedCapital.value! * 100,
                reason: null,
              };

  return { roe, roce, roic, nopat, investedCapital, averageInvestedCapital, totalDebt };
}
