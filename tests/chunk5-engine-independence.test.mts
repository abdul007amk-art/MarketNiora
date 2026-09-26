import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIndependentEngineDependencies } from '../backend/src/ebi/independence.ts';

test('C5-012: ENE, RGQ and PGQ may share source data but not sibling decisions', () => {
  assert.deepEqual(
    validateIndependentEngineDependencies([
      { engine: 'ENE', dependsOn: ['RAW_EARNINGS', 'VERIFIED_REVENUE'] },
      { engine: 'RGQ', dependsOn: ['RAW_REVENUE', 'VERIFIED_SEGMENT_DATA'] },
      { engine: 'PGQ', dependsOn: ['RAW_PROFIT', 'VERIFIED_REVENUE'] },
    ]),
    [],
  );
});

test('C5-012: sibling engine dependency is rejected', () => {
  assert.deepEqual(
    validateIndependentEngineDependencies([
      { engine: 'ENE', dependsOn: ['RGQ'] },
    ]),
    ['ENE cannot depend on sibling EBI engine RGQ; use shared source data instead'],
  );
});

test('C5-012: all sibling directions are rejected', () => {
  const errors = validateIndependentEngineDependencies([
    { engine: 'ENE', dependsOn: ['PGQ'] },
    { engine: 'RGQ', dependsOn: ['ENE'] },
    { engine: 'PGQ', dependsOn: ['RGQ'] },
  ]);
  assert.equal(errors.length, 3);
});
