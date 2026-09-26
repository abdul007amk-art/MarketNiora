import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveWeakestTruthState, validateTruthStateInputs } from '../backend/src/oce/truthState.ts';
import { validateOceNoFabrication } from '../backend/src/oce/noFabrication.ts';
import { findOceCycles, validateOceAcyclic, validateVersionPinnedIntegration } from '../backend/src/oce/circularDependency.ts';

const verifiedRaw = {
  source: 'source-1',
  sourceTimestamp: 1_700_000_000,
  verificationStatus: 'VERIFIED' as const,
  dataNature: 'RAW' as const,
  formulaVersion: null,
};

test('C6-013 derived truth follows weakest relevant input state', () => {
  assert.equal(resolveWeakestTruthState(['LIVE', 'VERIFIED', 'STALE']), 'STALE');
  assert.equal(resolveWeakestTruthState(['VERIFIED', 'PENDING']), 'PENDING');
  assert.deepEqual(validateTruthStateInputs(['LIVE', 'STALE'], 'STALE'), []);
  assert.ok(validateTruthStateInputs(['LIVE', 'STALE'], 'LIVE').length > 0);
});

test('C6-014 no-fabrication rejects unsupported final conclusions', () => {
  assert.deepEqual(validateOceNoFabrication({
    statement: 'Evidence-backed opportunity',
    evidenceIds: ['E1'],
    provenance: [verifiedRaw],
  }), []);

  const result = validateOceNoFabrication({
    statement: 'Unsupported conclusion',
    evidenceIds: [],
    provenance: [{ ...verifiedRaw, verificationStatus: 'SOURCE_REQUIRED' }],
  });
  assert.ok(result.includes('at least one evidenceId is required'));
  assert.ok(result.includes('SOURCE_REQUIRED evidence cannot support a final OCE conclusion'));
});

test('C6-015 circular dependency is rejected and acyclic shared dependencies are allowed', () => {
  assert.deepEqual(findOceCycles({
    OCE: ['EBI'],
    EBI: ['SOURCE'],
    SOURCE: [],
  }), []);
  assert.deepEqual(validateOceAcyclic({
    OCE: ['EBI'],
    EBI: ['SOURCE'],
    SOURCE: [],
  }), []);

  const errors = validateOceAcyclic({
    OCE: ['THEME'],
    THEME: ['OCE'],
  });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /circular dependency/);
});

test('C6-016 unversioned integration is rejected', () => {
  assert.deepEqual(validateVersionPinnedIntegration('OCE-1.0'), []);
  assert.deepEqual(validateVersionPinnedIntegration(''), [
    'integration methodologyVersion is required',
  ]);
});
