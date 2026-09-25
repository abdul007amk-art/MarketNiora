/**
 * CHUNK 5 — CDQ-1.2 Coverage, Data Quality & Truth-State Intelligence
 *
 * Implements only the explicit v1.3 coverage gate and production-engine
 * registry. Coverage is not confidence and never redistributes weights.
 */

export const EBI_COVERAGE_MIN = 40.0;

export const EBI_REQUIREMENT_REGISTRY = {
  DDE: false,
  ENE: true,
  RGQ: true,
  PGQ: true,
  CFQ: true,
  BSQ: true,
  CEI: true,
  BNI: false,
  CPI: false,
  GVI: false,
  ECI: false,
  BERI: false,
} as const;

export type CoverageGate = true | false;
export type CoverageState = 'PASS' | 'NOT_COMPUTABLE' | 'REVIEW_CONFLICT';

export interface CoverageResult {
  state: CoverageState;
  coveragePercent: number | null;
  reason: string | null;
}

export function calculateCoverage(
  availableValid: number,
  required: number | null,
): CoverageResult {
  if (!Number.isFinite(availableValid) || availableValid < 0) {
    return { state: 'NOT_COMPUTABLE', coveragePercent: null, reason: 'available-valid count is invalid' };
  }
  if (required === null) {
    return { state: 'REVIEW_CONFLICT', coveragePercent: null, reason: 'N_required unavailable/conflicting' };
  }
  if (!Number.isFinite(required) || required <= 0) {
    return { state: 'NOT_COMPUTABLE', coveragePercent: null, reason: 'N_required must be greater than zero' };
  }

  return { state: 'PASS', coveragePercent: availableValid / required * 100, reason: null };
}

export function applyCoverageGate(
  coveragePercent: number | null,
  coverageGate: CoverageGate,
): CoverageResult {
  if (coveragePercent === null || !Number.isFinite(coveragePercent)) {
    return { state: 'NOT_COMPUTABLE', coveragePercent: null, reason: 'coverage is unavailable' };
  }
  if (!coverageGate) {
    return { state: 'PASS', coveragePercent, reason: null };
  }
  return coveragePercent >= EBI_COVERAGE_MIN
    ? { state: 'PASS', coveragePercent, reason: null }
    : { state: 'NOT_COMPUTABLE', coveragePercent, reason: 'coverage below EBI_COVERAGE_MIN' };
}

export function missingMandatoryProductionEngines(implementedEngines: string[]): string[] {
  const actual = new Set(implementedEngines);
  return Object.entries(EBI_REQUIREMENT_REGISTRY)
    .filter(([, mandatory]) => mandatory)
    .map(([name]) => name)
    .filter((name) => !actual.has(name));
}
