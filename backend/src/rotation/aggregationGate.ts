/**
 * Rotation confidence eligibility gates — ODR-2026-002 C3.
 *
 * This module controls publication / roll-up eligibility only. It does not
 * participate in, normalise, weight, or alter the locked Rotation formula.
 */
export type RotationAggregationLevel = 'STOCK_GROUP' | 'SUB_SECTOR' | 'SECTOR';

const STOCK_GROUP_CONF_MIN = 30;
const HIGHER_LEVEL_ROLLUP_CONF_MIN = 60;

export function isRotationAggregationLevel(value: unknown): value is RotationAggregationLevel {
  return value === 'STOCK_GROUP' || value === 'SUB_SECTOR' || value === 'SECTOR';
}

export function minimumRotationConfidence(level: RotationAggregationLevel): number {
  return level === 'STOCK_GROUP' ? STOCK_GROUP_CONF_MIN : HIGHER_LEVEL_ROLLUP_CONF_MIN;
}

export function meetsRotationConfidenceGate(
  level: RotationAggregationLevel,
  confidence: number,
): boolean {
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) return false;
  return confidence >= minimumRotationConfidence(level);
}
