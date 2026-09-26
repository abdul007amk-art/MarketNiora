import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNoFabrication } from '../backend/src/ebi/noFabrication.ts';

const verifiedRaw = {
  source: 'annual-report',
  sourceTimestamp: 1759276800000,
  verificationStatus: 'VERIFIED' as const,
  dataNature: 'RAW' as const,
  formulaVersion: null,
};

test('C5-029 evidence-backed conclusion passes', () => {
  assert.deepEqual(
    validateNoFabrication({
      statement: 'Revenue increased year over year',
      sourceIds: ['annual-report'],
      provenance: [verifiedRaw],
    }),
    [],
  );
});

test('C5-029 conclusion without source evidence is rejected', () => {
  const errors = validateNoFabrication({
    statement: 'Revenue increased',
    sourceIds: [],
    provenance: [verifiedRaw],
  });
  assert.ok(errors.includes('at least one sourceId is required'));
});

test('C5-029 derived evidence requires formula version', () => {
  const errors = validateNoFabrication({
    statement: 'Derived margin',
    sourceIds: ['calc'],
    provenance: [{
      ...verifiedRaw,
      dataNature: 'DERIVED',
      formulaVersion: null,
    }],
  });
  assert.ok(errors.includes('derived evidence requires a non-empty formulaVersion'));
});

test('C5-029 SOURCE_REQUIRED evidence cannot support final conclusion', () => {
  const errors = validateNoFabrication({
    statement: 'Unsupported claim',
    sourceIds: ['pending-source'],
    provenance: [{
      ...verifiedRaw,
      verificationStatus: 'SOURCE_REQUIRED',
    }],
  });
  assert.ok(errors.includes('SOURCE_REQUIRED evidence cannot support a final EBI conclusion'));
});

test('C5-029 blank source identifiers are rejected', () => {
  const errors = validateNoFabrication({
    statement: 'Claim',
    sourceIds: ['  '],
    provenance: [verifiedRaw],
  });
  assert.ok(errors.includes('sourceId cannot be empty'));
});
