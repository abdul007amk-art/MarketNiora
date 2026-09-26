import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVisibilityEngineIndependence } from '../backend/src/ebi/visibilityIndependence.ts';

test('C5-015 GVI/ECI may share source evidence without sibling dependency', () => {
  assert.deepEqual(
    validateVisibilityEngineIndependence([
      { engine: 'GVI', dependsOn: ['guidance_evidence', 'order_book_evidence'] },
      { engine: 'ECI', dependsOn: ['catalyst_evidence', 'earnings_evidence'] },
    ]),
    [],
  );
});

test('C5-015 GVI cannot consume ECI decision output', () => {
  const errors = validateVisibilityEngineIndependence([
    { engine: 'GVI', dependsOn: ['ECI'] },
  ]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /GVI cannot depend on sibling EBI engine ECI/);
});

test('C5-015 ECI cannot consume GVI decision output', () => {
  const errors = validateVisibilityEngineIndependence([
    { engine: 'ECI', dependsOn: ['GVI'] },
  ]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /ECI cannot depend on sibling EBI engine GVI/);
});

test('C5-015 both GVI/ECI sibling directions are rejected', () => {
  const errors = validateVisibilityEngineIndependence([
    { engine: 'GVI', dependsOn: ['ECI'] },
    { engine: 'ECI', dependsOn: ['GVI'] },
  ]);
  assert.equal(errors.length, 2);
});
