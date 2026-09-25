/**
 * MARKETNIORA RESIDUAL RISK ENGINE
 *
 * Purpose: capture risks not already represented adequately by Business
 * Quality or other Stock Score blocks. It must not silently replace or
 * double-penalize those components.
 *
 * This module is diagnostic/hardening infrastructure. It does not alter the
 * locked SS-1.0-R3 weights.
 */
export type ResidualRiskCategory =
  | 'LIQUIDITY'
  | 'FREE_FLOAT'
  | 'PROMOTER_PLEDGE'
  | 'DILUTION'
  | 'GOVERNANCE'
  | 'CUSTOMER_CONCENTRATION'
  | 'COMMODITY'
  | 'REGULATORY'
  | 'EVENT'
  | 'ACCOUNTING_CASHFLOW'
  | 'LEVERAGE'
  | 'EXECUTION'
  | 'VALUATION'
  | 'MARKET_STRUCTURE';

export interface ResidualRiskItem {
  category: ResidualRiskCategory;
  severity: 0 | 1 | 2 | 3;
  alreadyCapturedByBusinessQuality: boolean;
  alreadyCapturedByValuation: boolean;
  evidenceId: string;
}

export interface ResidualRiskResult {
  uncaptured: ResidualRiskItem[];
  duplicateFlags: ResidualRiskItem[];
  hasMaterialResidualRisk: boolean;
}

export function assessResidualRisk(items: readonly ResidualRiskItem[]): ResidualRiskResult {
  const uncaptured: ResidualRiskItem[] = [];
  const duplicateFlags: ResidualRiskItem[] = [];

  for (const item of items) {
    if (!item.evidenceId) throw new Error('every residual-risk item requires evidenceId');
    if (item.severity < 0 || item.severity > 3) throw new Error('severity must be 0..3');

    if (item.alreadyCapturedByBusinessQuality || item.alreadyCapturedByValuation) {
      duplicateFlags.push(item);
    } else if (item.severity > 0) {
      uncaptured.push(item);
    }
  }

  return {
    uncaptured,
    duplicateFlags,
    hasMaterialResidualRisk: uncaptured.some(x => x.severity >= 2),
  };
}
