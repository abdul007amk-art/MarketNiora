import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateChunk5LockGate } from '../backend/src/ebi/governance.ts';

const clean = {
  findings: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  evidence: {
    mandatoryTestsPass: true,
    unexplainedFailures: 0,
    checkpointFailures: 0,
    userConfirmed: true,
  },
};

test('C5-032 clean evidence is lock-ready', () => {
  assert.deepEqual(evaluateChunk5LockGate(clean), { lockReady: true, reasons: [] });
});

test('C5-032 any severity finding blocks lock', () => {
  const result = evaluateChunk5LockGate({
    ...clean,
    findings: { ...clean.findings, HIGH: 1 },
  });
  assert.equal(result.lockReady, false);
  assert.ok(result.reasons.some((r) => r.includes('HIGH findings remain')));
});

test('C5-032 failed mandatory evidence blocks lock', () => {
  const result = evaluateChunk5LockGate({
    ...clean,
    evidence: { ...clean.evidence, mandatoryTestsPass: false },
  });
  assert.equal(result.lockReady, false);
});

test('C5-032 unexplained failures block lock', () => {
  const result = evaluateChunk5LockGate({
    ...clean,
    evidence: { ...clean.evidence, unexplainedFailures: 1 },
  });
  assert.equal(result.lockReady, false);
});

test('C5-032 user confirmation is mandatory', () => {
  const result = evaluateChunk5LockGate({
    ...clean,
    evidence: { ...clean.evidence, userConfirmed: false },
  });
  assert.equal(result.lockReady, false);
});
