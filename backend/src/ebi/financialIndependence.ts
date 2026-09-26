/**
 * CHUNK 5 — CFQ / BSQ / CEI independence boundary.
 *
 * These engines may consume common source financial data, but no engine may
 * consume another engine's decision output. This keeps cash-flow, balance-
 * sheet and capital-efficiency conclusions independently reproducible.
 */
export const EBI_FINANCIAL_INDEPENDENT_ENGINES = ['CFQ', 'BSQ', 'CEI'] as const;
export type EbiFinancialEngine = typeof EBI_FINANCIAL_INDEPENDENT_ENGINES[number];

export interface FinancialEngineDependency {
  engine: EbiFinancialEngine;
  dependsOn: string[];
}

export function validateFinancialEngineIndependence(
  dependencies: FinancialEngineDependency[],
): string[] {
  const errors: string[] = [];
  const independent = new Set<string>(EBI_FINANCIAL_INDEPENDENT_ENGINES);

  for (const entry of dependencies) {
    for (const dependency of entry.dependsOn) {
      if (independent.has(dependency) && dependency !== entry.engine) {
        errors.push(
          `${entry.engine} cannot depend on sibling EBI engine ${dependency}; use shared source data instead`,
        );
      }
    }
  }

  return errors;
}
