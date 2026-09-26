/**
 * CHUNK 5 — EBI engine independence boundary.
 *
 * ENE, RGQ and PGQ are independent analytical primitives. Their decisions
 * cannot be sourced from one another. Shared raw/verified inputs are allowed;
 * sibling-engine decision outputs are not.
 */
export const EBI_INDEPENDENT_ENGINES = ['ENE', 'RGQ', 'PGQ'] as const;
export type EbiIndependentEngine = typeof EBI_INDEPENDENT_ENGINES[number];

export interface EngineDependency {
  engine: EbiIndependentEngine;
  dependsOn: string[];
}

export function validateIndependentEngineDependencies(
  dependencies: EngineDependency[],
): string[] {
  const errors: string[] = [];
  const independent = new Set<string>(EBI_INDEPENDENT_ENGINES);

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
