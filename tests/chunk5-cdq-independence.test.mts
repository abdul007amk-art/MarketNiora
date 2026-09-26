import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCdqIndependence } from '../backend/src/ebi/cdqIndependence.ts';

test('C5-017 CDQ may consume source availability and validity metadata', () => {
  assert.deepEqual(
    validateCdqIndependence([
      { dependsOn: ['source_count', 'valid_observation_count', 'coverage_registry'] },
    ]),
    [],
  );
});

test('C5-017 CDQ cannot consume an EBI engine decision', () => {
  const errors = validateCdqIndependence([{ dependsOn: ['CEI'] }]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /CDQ cannot depend on EBI engine CEI/);
});

test('C5-017 CDQ rejects dependencies on all EBI decision engines', () => {
  const errors = validateCdqIndependence([{
    dependsOn: ['DDE', 'ENE', 'RGQ', 'PGQ', 'CFQ', 'BSQ', 'CEI', 'BNI', 'CPI', 'GVI', 'ECI', 'BERI'],
  }]);
  assert.equal(errors.length, 12);
});

test('C5-017 CDQ remains independent with source-only dependencies', () => {
  assert.deepEqual(
    validateCdqIndependence([
      { dependsOn: ['raw_observations', 'validation_status', 'required_metric_registry'] },
    ]),
    [],
  );
});
