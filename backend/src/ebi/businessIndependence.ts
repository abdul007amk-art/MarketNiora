/**
 * CHUNK 5 — BNI / CPI independence boundary.
 */
export const EBI_BUSINESS_INDEPENDENT_ENGINES = ['BNI', 'CPI'] as const;
export type EbiBusinessEngine = typeof EBI_BUSINESS_INDEPENDENT_ENGINES[number];

export interface BusinessEngineDependency {
  engine: EbiBusinessEngine;
  dependsOn: string[];
}

export function validateBusinessEngineIndependence(
  dependencies: BusinessEngineDependency[],
): string[] {
  const errors: string[] = [];
  const independent = new Set<string>(EBI_BUSINESS_INDEPENDENT_ENGINES);

  for (const entry of dependencies) {
    for (const dependency of entry.dependsOn) {
      if (independent.has(dependency) && dependency !== entry.engine) {
        errors.push(
          `${entry.engine} cannot depend on sibling EBI engine ${dependency}; use shared evidence/source data instead`,
        );
      }
    }
  }

  return errors;
}
