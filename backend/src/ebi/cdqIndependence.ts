/**
 * CHUNK 5 — CDQ independence boundary.
 *
 * CDQ evaluates coverage/data quality from source availability and validity.
 * It may inspect raw/validated input metadata, but cannot consume another
 * EBI engine's decision output. Coverage must remain independent of the
 * conclusions it gates.
 */
export interface CdqDependency {
  dependsOn: string[];
}

export function validateCdqIndependence(dependencies: CdqDependency[]): string[] {
  const errors: string[] = [];
  const forbidden = new Set([
    'DDE', 'ENE', 'RGQ', 'PGQ', 'CFQ', 'BSQ', 'CEI',
    'BNI', 'CPI', 'GVI', 'ECI', 'BERI',
  ]);

  for (const entry of dependencies) {
    for (const dependency of entry.dependsOn) {
      if (forbidden.has(dependency)) {
        errors.push(
          `CDQ cannot depend on EBI engine ${dependency}; use source availability/validity metadata instead`,
        );
      }
    }
  }

  return errors;
}
