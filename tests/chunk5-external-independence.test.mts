import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EBI_EXTERNAL_ENGINES,
  validateExternalIntegration,
  validateExternalIntegrations,
} from '../backend/src/ebi/externalIndependence.ts';

test('C5-018..024 all external engines are explicitly registered', () => {
  assert.deepEqual([...EBI_EXTERNAL_ENGINES], [
    'ROTATION', 'THEME', 'OCE', 'SHARIAH', 'STOCK_SCORE', 'TIE', 'RSE_DCS',
  ]);
});

test('C5-018..024 version-pinned DATA_ONLY integrations are allowed', () => {
  assert.deepEqual(
    validateExternalIntegrations(EBI_EXTERNAL_ENGINES.map((consumer) => ({
      consumer,
      methodologyVersion: 'EBI-1.3',
      authority: 'DATA_ONLY',
    }))),
    [],
  );
});

test('C5-018..024 reject decision authority from Rotation, Theme, OCE, Shariah, Stock Score, TIE and RSE/DCS', () => {
  const errors = validateExternalIntegrations(EBI_EXTERNAL_ENGINES.map((consumer) => ({
    consumer,
    methodologyVersion: 'EBI-1.3',
    authority: 'DECISION',
  })));
  assert.equal(errors.length, 7);
  assert.ok(errors.every((error) => error.includes('authority must be DATA_ONLY')));
});

test('C5-018..024 reject unversioned external integrations', () => {
  const errors = validateExternalIntegration({
    consumer: 'ROTATION',
    methodologyVersion: '   ',
    authority: 'DATA_ONLY',
  });
  assert.ok(errors.includes('methodologyVersion is required'));
});

test('C5-018..024 reject unsupported external engine identifiers at runtime', () => {
  const errors = validateExternalIntegration({
    consumer: 'UNKNOWN' as never,
    methodologyVersion: 'EBI-1.3',
    authority: 'DATA_ONLY',
  });
  assert.ok(errors.some((error) => error.includes('unsupported external engine')));
});
