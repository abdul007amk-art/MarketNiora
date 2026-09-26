import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertNoMissingAsZero,
  missingDataCoverageContract,
  validateMissingDataMetric,
} from '../backend/src/ebi/missingData.ts';

test('C5-006 rejects missing data represented as zero', () => {
  const errors = assertNoMissingAsZero({
    ROIC: { state: 'NOT_COMPUTABLE', value: 0 },
  });
  assert.ok(errors.length > 0);
});

test('C5-006 accepts fail-closed null for non-computable output', () => {
  const result = missingDataCoverageContract({
    ROIC: { state: 'NOT_COMPUTABLE', value: null },
    ROCE: { state: 'NOT_COMPARABLE', value: null },
    Growth: { state: 'TURNAROUND_EVENT', value: null },
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('C5-006 requires finite value for computable output', () => {
  assert.ok(
    validateMissingDataMetric(
      { state: 'COMPUTABLE', value: null },
      'ROIC',
    ).length > 0,
  );
});

test('C5-006 rejects non-null values on non-computable states', () => {
  assert.ok(
    validateMissingDataMetric(
      { state: 'NOT_COMPUTABLE', value: 12 },
      'ROIC',
    ).length > 0,
  );
});
