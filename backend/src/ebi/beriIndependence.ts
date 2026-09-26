/**
 * CHUNK 5 — BERI independence boundary.
 *
 * BERI (Business/Earnings Risk Intelligence) may consume shared source
 * evidence, but it cannot consume another EBI engine's decision output.
 * This keeps risk conclusions independently reproducible.
 */
export interface BeriDependency {
  dependsOn: string[];
}

export function validateBeriIndependence(dependencies: BeriDependency[]): string[] {
  const errors: string[] = [];
  const forbidden = new Set([
    'DDE', 'ENE', 'RGQ', 'PGQ', 'CFQ', 'BSQ', 'CEI',
    'BNI', 'CPI', 'GVI', 'ECI', 'CDQ',
  ]);

  for (const entry of dependencies) {
    for (const dependency of entry.dependsOn) {
      if (forbidden.has(dependency)) {
        errors.push(
          `BERI cannot depend on EBI engine ${dependency}; use shared evidence/source data instead`,
        );
      }
    }
  }

  return errors;
}
