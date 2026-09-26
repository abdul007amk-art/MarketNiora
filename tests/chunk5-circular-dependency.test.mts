import test from 'node:test';
import assert from 'node:assert/strict';
import { findCircularDependencies, validateAcyclicEbiGraph } from '../backend/src/ebi/circularDependency.ts';

test('C5-026 acyclic EBI integration graph passes', () => {
  assert.deepEqual(
    validateAcyclicEbiGraph({
      EBI: ['ROTATION', 'THEME', 'OCE'],
      STOCK_SCORE: ['EBI'],
      DASHBOARD: ['STOCK_SCORE'],
    }),
    [],
  );
});

test('C5-026 direct cycle is rejected', () => {
  const errors = validateAcyclicEbiGraph({
    EBI: ['ROTATION'],
    ROTATION: ['EBI'],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /EBI -> ROTATION -> EBI/);
});

test('C5-026 multi-node cycle is rejected', () => {
  const cycles = findCircularDependencies({
    EBI: ['RISK'],
    RISK: ['SCORE'],
    SCORE: ['EBI'],
  });
  assert.equal(cycles.length, 1);
  assert.deepEqual(cycles[0], ['EBI', 'RISK', 'SCORE', 'EBI']);
});

test('C5-026 shared downstream dependency without a cycle is allowed', () => {
  assert.deepEqual(
    findCircularDependencies({
      EBI_A: ['SOURCE'],
      EBI_B: ['SOURCE'],
      REPORT: ['EBI_A', 'EBI_B'],
    }),
    [],
  );
});
