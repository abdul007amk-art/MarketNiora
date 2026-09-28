import test from 'node:test';
import assert from 'node:assert/strict';
import { runFwhyDiagnostics } from '../backend/src/dars12/fwhyDiagnostics.ts';

const base = {
  sourceEventId: 'evt-1', source: 'TEST', symbol: 'AAA', value: '10',
  sourceTimestamp: 900, effectiveTime: 900, knowledgeTime: 1000,
  verificationStatus: 'VERIFIED' as const, dataNature: 'RAW' as const,
  formulaVersion: null, origin: 'STANDARD' as const,
  evidenceKey: 'TEST|AAA', refreshedAt: 1000, truthState: 'CURRENT' as const,
};

test('FWHY diagnostics supports verified current raw evidence without fabricating a conclusion', () => {
  const out = runFwhyDiagnostics([base]);
  assert.equal(out.engine, 'FWHY-DIAGNOSTICS-1.0');
  assert.equal(out.truthState, 'CURRENT');
  assert.equal(out.supportedCases, 1);
  assert.equal(out.cases[0].status, 'SUPPORTED');
  assert.deepEqual(out.cases[0].questions, []);
});

test('FWHY diagnostics blocks unverified evidence and emits a question instead of a conclusion', () => {
  const out = runFwhyDiagnostics([{ ...base, verificationStatus: 'UNVERIFIED' }]);
  assert.equal(out.truthState, 'BLOCKED');
  assert.equal(out.incompleteCases, 1);
  assert.equal(out.cases[0].status, 'INCOMPLETE');
  assert.match(out.cases[0].questions.join(' '), /verified source/i);
});
