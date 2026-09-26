/**
 * CHUNK 5 — GVI / ECI independence boundary.
 *
 * GVI (Growth & Visibility Intelligence) and ECI (Earnings/Catalyst
 * Intelligence) may consume common source evidence, but neither may consume
 * the sibling engine's decision output. This keeps visibility and catalyst
 * conclusions independently reproducible.
 */
export const EBI_VISIBILITY_INDEPENDENT_ENGINES = ['GVI', 'ECI'] as const;
export type EbiVisibilityEngine = typeof EBI_VISIBILITY_INDEPENDENT_ENGINES[number];

export interface VisibilityEngineDependency {
  engine: EbiVisibilityEngine;
  dependsOn: string[];
}

export function validateVisibilityEngineIndependence(
  dependencies: VisibilityEngineDependency[],
): string[] {
  const errors: string[] = [];
  const independent = new Set<string>(EBI_VISIBILITY_INDEPENDENT_ENGINES);

  for (const entry of dependencies) {
    for (const dependency of entry.dependsOn) {
      if (independent.has(dependency) && dependency !== entry.engine) {
        errors.push(
          \`\${entry.engine} cannot depend on sibling EBI engine \${dependency}; use shared evidence/source data instead\`,
        );
      }
    }
  }

  return errors;
}
