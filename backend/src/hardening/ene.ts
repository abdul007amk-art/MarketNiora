/**
 * MARKETNIORA EARNINGS NORMALIZATION ENGINE (ENE) — HARDENING
 *
 * Used for cyclical businesses to distinguish reported-cycle earnings from
 * a defensible mid-cycle/normalized earnings base. It is a feature for
 * valuation/fundamental reasoning, not a new Stock Score component.
 */
export interface EarningsNormalizationInput {
  currentRevenue: number;
  currentMargin: number;
  normalizedRevenue: number;
  normalizedMargin: number;
  currentShares: number;
  currentPrice: number;
}

export interface EarningsNormalizationResult {
  normalizedProfit: number;
  normalizedEps: number;
  normalizedPe: number | null;
  reportedProfit: number;
  reportedEps: number;
  reportedPe: number | null;
}

export function normalizeEarnings(input: EarningsNormalizationInput): EarningsNormalizationResult {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value)) throw new Error(`${key} must be finite`);
  }
  if (input.currentRevenue < 0 || input.normalizedRevenue < 0) throw new Error('revenue cannot be negative');
  if (input.currentShares <= 0 || input.currentPrice <= 0) throw new Error('shares and price must be > 0');

  const reportedProfit = input.currentRevenue * input.currentMargin;
  const normalizedProfit = input.normalizedRevenue * input.normalizedMargin;
  const reportedEps = reportedProfit / input.currentShares;
  const normalizedEps = normalizedProfit / input.currentShares;

  return {
    normalizedProfit,
    normalizedEps,
    normalizedPe: normalizedEps > 0 ? input.currentPrice / normalizedEps : null,
    reportedProfit,
    reportedEps,
    reportedPe: reportedEps > 0 ? input.currentPrice / reportedEps : null,
  };
}
