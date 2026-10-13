const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isRotationAggregationLevel,
  minimumRotationConfidence,
  meetsRotationConfidenceGate,
} = require('../backend/src/rotation/aggregationGate.ts');

test('Rotation confidence gates match approved ODR-2026-002 C3 thresholds', () => {
  assert.equal(minimumRotationConfidence('STOCK_GROUP'), 30);
  assert.equal(minimumRotationConfidence('SUB_SECTOR'), 60);
  assert.equal(minimumRotationConfidence('SECTOR'), 60);
});

test('Stock Group inclusion/publication gate uses inclusive 30% threshold', () => {
  assert.equal(meetsRotationConfidenceGate('STOCK_GROUP', 29.99), false);
  assert.equal(meetsRotationConfidenceGate('STOCK_GROUP', 30), true);
  assert.equal(meetsRotationConfidenceGate('STOCK_GROUP', 100), true);
});

test('higher-level roll-up gate uses inclusive 60% threshold', () => {
  for (const level of ['SUB_SECTOR', 'SECTOR']) {
    assert.equal(meetsRotationConfidenceGate(level, 59.99), false);
    assert.equal(meetsRotationConfidenceGate(level, 60), true);
  }
});

test('invalid aggregation levels and invalid confidence values fail closed', () => {
  assert.equal(isRotationAggregationLevel('STOCK_GROUP'), true);
  assert.equal(isRotationAggregationLevel('SUB_SECTOR'), true);
  assert.equal(isRotationAggregationLevel('SECTOR'), true);
  for (const invalid of [undefined, null, '', 'STOCK', 'UNKNOWN']) {
    assert.equal(isRotationAggregationLevel(invalid), false);
  }
  for (const confidence of [-1, 100.01, NaN, Infinity, -Infinity]) {
    assert.equal(meetsRotationConfidenceGate('SECTOR', confidence), false);
  }
});
