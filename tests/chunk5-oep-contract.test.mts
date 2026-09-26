import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOepOutput } from '../backend/src/ebi/oep.ts';

const valid = {
  title: 'Revenue Quality',
  primaryOutput: 'Strong',
  keyEvidence: ['Revenue growth supported by disclosed volume data'],
  trendDirection: 'UP',
  confidence: 'HIGH',
  truthState: 'VERIFIED',
  dataCoverage: 85,
  source: 'annual-report',
  lastUpdated: '2026-09-26T00:00:00Z',
};

test('C5-031 valid OEP output passes', () => {
  assert.deepEqual(validateOepOutput(valid), []);
});

test('C5-031 empty evidence entries are rejected', () => {
  const errors = validateOepOutput({ ...valid, keyEvidence: [''] });
  assert.ok(errors.includes('keyEvidence entries must be non-empty strings'));
});

test('C5-031 coverage above 100 percent is rejected', () => {
  const errors = validateOepOutput({ ...valid, dataCoverage: 100.01 });
  assert.ok(errors.includes('dataCoverage must be null or a finite percentage from 0 to 100'));
});

test('C5-031 invalid source and lastUpdated are rejected', () => {
  const errors = validateOepOutput({
    ...valid,
    source: ' ',
    lastUpdated: 'not-a-date',
  });
  assert.ok(errors.includes('source must be null or a non-empty string'));
  assert.ok(errors.includes('lastUpdated must be null or a valid date-time string'));
});

test('C5-031 null optional fields remain valid', () => {
  assert.deepEqual(validateOepOutput({
    ...valid,
    primaryOutput: null,
    trendDirection: null,
    confidence: null,
    dataCoverage: null,
    source: null,
    lastUpdated: null,
  }), []);
});
