import test from 'node:test';
import assert from 'node:assert/strict';
import { cfoToPat, freeCashFlow } from '../backend/src/ebi/cfq.ts';
import { growth, margin } from '../backend/src/ebi/pgq.ts';
import { EBI_COVERAGE_MIN } from '../backend/src/ebi/cdq.ts';

test('CFQ PAT zero and negative handling follows v1.3', () => {
  assert.equal(cfoToPat(100, 0).state, 'NOT_COMPUTABLE');
  assert.equal(cfoToPat(100, -10).state, 'NOT_COMPARABLE');
});

test('CFQ FCF is CFO minus Capex and missing Capex is not zero-filled', () => {
  assert.equal(freeCashFlow(150, 50).value, 100);
  assert.equal(freeCashFlow(150, null).state, 'NOT_COMPUTABLE');
});

test('PGQ zero denominator is not computable', () => {
  assert.equal(margin(10, 0).state, 'NOT_COMPUTABLE');
  assert.equal(growth(10, 0).state, 'NOT_COMPUTABLE');
});

test('PGQ negative base and turnaround remain distinct', () => {
  assert.equal(growth(-5, -10).state, 'NOT_COMPARABLE');
  assert.equal(growth(5, -10).state, 'TURNAROUND_EVENT');
});

test('Chunk 5 coverage threshold remains 40%', () => {
  assert.equal(EBI_COVERAGE_MIN, 40);
});
