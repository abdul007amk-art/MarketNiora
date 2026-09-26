import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateOceLockGate } from '../backend/src/oce/governance.ts';

const clean = {
  critical: 0,
  high: 0,
  medium: 0,
  low: 0,
  mandatoryTestsPass: true,
  unexplainedFailures: 0,
  checkpointFailures: 0,
  all32CheckpointsPass: true,
  userConfirmed: true,
};

test('C6-017 OCE lock gate is ready only when every condition passes', () => {
  assert.deepEqual(evaluateOceLockGate(clean), { lockReady: true, reasons: [] });
});

test('C6-018 OCE lock gate fails closed without user confirmation', () => {
  const result = evaluateOceLockGate({ ...clean, userConfirmed: false });
  assert.equal(result.lockReady, false);
  assert.ok(result.reasons.includes('explicit user confirmation is required'));
});

test('C6-019 OCE lock gate rejects any severity finding or checkpoint failure', () => {
  const result = evaluateOceLockGate({
    ...clean,
    high: 1,
    checkpointFailures: 1,
  });
  assert.equal(result.lockReady, false);
  assert.ok(result.reasons.includes('High severity count must be zero'));
  assert.ok(result.reasons.includes('checkpoint failures must be zero'));
});
