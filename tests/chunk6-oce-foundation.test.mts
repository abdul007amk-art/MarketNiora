import test from 'node:test';
import assert from 'node:assert/strict';

import { validateProvenance } from '../backend/src/contracts/provenance.ts';
import { validateOceEvidence } from '../backend/src/oce/inputContract.ts';
import { validateLifecycleTransition, isTerminalLifecycle } from '../backend/src/oce/lifecycle.ts';
import { rejectOceDecisionDependency, validateOceIntegration } from '../backend/src/oce/independence.ts';

const provenance = {
  source: 'source-1',
  sourceTimestamp: 1_700_000_000,
  verificationStatus: 'VERIFIED' as const,
  dataNature: 'RAW' as const,
  formulaVersion: null,
};

const evidence = {
  evidenceId: 'E1',
  source: 'source-1',
  sourceTimestamp: 1_700_000_000,
  reportedDate: '2026-09-26',
  truthState: 'VERIFIED' as const,
  classification: 'REPORTED' as const,
  provenance,
  methodologyVersion: 'OCE-1.0',
  strength: 'CONFIRMED' as const,
  statement: 'Documented opportunity evidence',
};

test('C6-001 provenance remains valid at OCE input boundary', () => {
  assert.deepEqual(validateProvenance(provenance), { valid: true, errors: [] });
  assert.deepEqual(validateOceEvidence(evidence), []);
});

test('C6-002 missing source/evidence statement is rejected', () => {
  const result = validateOceEvidence({ ...evidence, source: '', statement: '' });
  assert.ok(result.includes('source is required'));
  assert.ok(result.includes('statement is required'));
});

test('C6-003 derived evidence requires derived provenance', () => {
  const result = validateOceEvidence({
    ...evidence,
    classification: 'DERIVED',
    provenance: { ...provenance, dataNature: 'RAW' },
  });
  assert.ok(result.includes('DERIVED evidence must carry DERIVED provenance'));
});

test('C6-004 lifecycle never silently reactivates invalidated/cancelled/completed', () => {
  assert.deepEqual(validateLifecycleTransition('INVALIDATED', 'ACTIVE'), [
    'INVALIDATED opportunities cannot be silently reactivated',
  ]);
  assert.deepEqual(validateLifecycleTransition('CANCELLED', 'ACTIVE'), [
    'CANCELLED opportunities cannot be silently reactivated',
  ]);
  assert.deepEqual(validateLifecycleTransition('COMPLETED', 'ACTIVE'), [
    'COMPLETED opportunities cannot be silently reopened',
  ]);
  assert.equal(isTerminalLifecycle('INVALIDATED'), true);
});

test('C6-005 external OCE integration is DATA_ONLY and version-pinned', () => {
  assert.deepEqual(validateOceIntegration({
    consumer: 'OCE',
    provider: 'ROTATION',
    methodologyVersion: 'ROTATION-1.3',
    authority: 'DATA_ONLY',
  }), []);
  assert.deepEqual(rejectOceDecisionDependency('STOCK_SCORE', 'DECISION'), [
    'STOCK_SCORE cannot provide decision authority to OCE',
  ]);
});
