import test from 'node:test';
import assert from 'node:assert/strict';

import { validateProvenance } from '../backend/src/contracts/provenance.ts';
import { validateOceEvidence } from '../backend/src/oce/inputContract.ts';
import { validateLifecycleTransition, isTerminalLifecycle, validateLifecycleHistory, validateRevalidation } from '../backend/src/oce/lifecycle.ts';
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

test('C6-004 lifecycle progression and terminal states are deterministic', () => {
  assert.deepEqual(validateLifecycleTransition('IDENTIFIED', 'VALIDATED', ['E1']), []);
  assert.deepEqual(validateLifecycleTransition('VALIDATED', 'DEVELOPING', ['E1']), []);
  assert.deepEqual(validateLifecycleTransition('DEVELOPING', 'ACTIVE', ['E1']), []);
  assert.deepEqual(validateLifecycleTransition('ACTIVE', 'REALISING', ['E1']), []);
  assert.deepEqual(validateLifecycleTransition('REALISING', 'COMPLETED', ['E1']), []);
  assert.ok(validateLifecycleTransition('IDENTIFIED', 'ACTIVE', ['E1']).length > 0);
  assert.ok(validateLifecycleTransition('INVALIDATED', 'ACTIVE', ['E1']).some((x) => x.includes('reactivated')));
  assert.ok(validateLifecycleTransition('CANCELLED', 'ACTIVE', ['E1']).some((x) => x.includes('reactivated')));
  assert.ok(validateLifecycleTransition('COMPLETED', 'ACTIVE', ['E1']).some((x) => x.includes('reopened')));
  assert.equal(isTerminalLifecycle('INVALIDATED'), true);
});

test('C6-005 lifecycle history preserves chronological evidence-backed events and delayed revalidation', () => {
  const history = [
    { opportunityId: 'O1', from: null, to: 'IDENTIFIED' as const, evidenceIds: ['E1'], timestamp: 1, reason: 'identified' },
    { opportunityId: 'O1', from: 'IDENTIFIED' as const, to: 'VALIDATED' as const, evidenceIds: ['E1'], timestamp: 2, reason: 'validated' },
    { opportunityId: 'O1', from: 'VALIDATED' as const, to: 'DELAYED' as const, evidenceIds: ['E1'], timestamp: 3, reason: 'delayed' },
    { opportunityId: 'O1', from: 'DELAYED' as const, to: 'ACTIVE' as const, evidenceIds: ['E1'], timestamp: 4, reason: 'revalidated' },
  ];
  assert.deepEqual(validateLifecycleHistory(history), []);
  assert.deepEqual(validateRevalidation('DELAYED', ['E2']), []);
  assert.ok(validateRevalidation('DELAYED', []).length > 0);
});

test('C6-006 external OCE integration is DATA_ONLY and version-pinned', () => {
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
