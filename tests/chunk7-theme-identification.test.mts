import test from 'node:test';
import assert from 'node:assert/strict';
import {
  identifyThemeCandidate,
  isValidatedTheme,
  validateThemeCandidate,
  validateThemeSignal,
} from '../backend/src/theme/identification.ts';

const p = {
  source: 'theme-source-1',
  sourceTimestamp: 1700000000,
  verificationStatus: 'VERIFIED' as const,
  dataNature: 'RAW' as const,
  formulaVersion: null,
};

test('TIE-001 identifies an evidence-backed candidate without premature validation', () => {
  const candidate = identifyThemeCandidate('TC1', 'Copper Demand', ['EV1'], [p]);
  assert.equal(candidate.state, 'CANDIDATE');
  assert.equal(isValidatedTheme(candidate), false);
  assert.deepEqual(validateThemeCandidate(candidate), []);
});

test('TIE-002 supports the complete candidate state vocabulary', () => {
  for (const state of ['CANDIDATE','UNDER_REVIEW','SUPPORTED','VALIDATED','REJECTED','UNKNOWN'] as const) {
    const candidate = {
      candidateId: 'TC1',
      themeName: 'Copper Demand',
      state,
      evidenceIds: ['EV1'],
      provenance: [p],
      methodologyVersion: 'TIE-ID-1.0',
    };
    assert.deepEqual(validateThemeCandidate(candidate), []);
  }
});

test('TIE-003 signal validation remains separate from validated Theme state', () => {
  assert.deepEqual(validateThemeSignal({
    signalId: 'SIG1',
    statement: 'Demand signal',
    evidenceIds: ['EV1'],
    provenance: [p],
  }), []);
  assert.equal(isValidatedTheme(identifyThemeCandidate('TC1', 'Theme', ['EV1'], [p])), false);
});

test('TIE-004 missing evidence cannot create a Theme candidate', () => {
  assert.throws(() => identifyThemeCandidate('TC1', 'Theme', [], [p]), /requires evidence/);
  assert.throws(() => identifyThemeCandidate('TC1', 'Theme', ['EV1'], []), /requires provenance/);
});

test('TIE-005 TIE does not accept Rotation, Stock Score, OCE or Shariah as decision inputs', () => {
  const candidate = identifyThemeCandidate('TC1', 'Theme', ['EV1'], [p]);
  assert.equal('rotation' in candidate, false);
  assert.equal('stockScore' in candidate, false);
  assert.equal('oce' in candidate, false);
  assert.equal('shariah' in candidate, false);
});
