import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBusinessEngineIndependence } from '../backend/src/ebi/businessIndependence.ts';

test('C5-014 BNI/CPI may share source evidence without sibling dependency', () => {
  assert.deepEqual(
    validateBusinessEngineIndependence([
      { engine: 'BNI', dependsOn: ['raw_business_evidence'] },
      { engine: 'CPI', dependsOn: ['cycle_evidence'] },
    ]),
    [],
  );
});

test('C5-014 BNI cannot consume CPI decision output', () => {
  const errors = validateBusinessEngineIndependence([
    { engine: 'BNI', dependsOn: ['CPI'] },
  ]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /BNI cannot depend on sibling EBI engine CPI/);
});

test('C5-014 CPI cannot consume BNI decision output', () => {
  const errors = validateBusinessEngineIndependence([
    { engine: 'CPI', dependsOn: ['BNI'] },
  ]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /CPI cannot depend on sibling EBI engine BNI/);
});

test('C5-014 all BNI/CPI sibling directions are rejected', () => {
  const errors = validateBusinessEngineIndependence([
    { engine: 'BNI', dependsOn: ['CPI'] },
    { engine: 'CPI', dependsOn: ['BNI'] },
  ]);
  assert.equal(errors.length, 2);
});
