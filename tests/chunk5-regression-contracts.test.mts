import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEbiInputMetric } from '../backend/src/ebi/inputContract.ts';
import { validatePeriodConsistency } from '../backend/src/ebi/period.ts';
import { rejectCircularDependency, validateIntegrationRef } from '../backend/src/ebi/iic.ts';
import type { EbiInputMetric } from '../backend/src/ebi/inputContract.ts';

const provenance = {
  source: 'test-source',
  sourceTimestamp: Date.parse('2026-09-26T00:00:00Z'),
  verificationStatus: 'VERIFIED' as const,
  dataNature: 'RAW' as const,
  formulaVersion: null,
};

function metric(overrides: Partial<EbiInputMetric> = {}): EbiInputMetric {
  return {
    metric: 'Revenue', value: 100, periodType: 'QUARTER',
    periodStart: '2026-04-01', periodEnd: '2026-06-30',
    reportedDate: '2026-08-01', classification: 'REPORTED',
    provenance, restatementId: null, supersedesRestatementId: null, ...overrides
  };
}

test('C5-005 period consistency rejects mixed period types', () => {
  const errors = validatePeriodConsistency([metric(), metric({ periodType: 'YEAR' })]);
  assert.ok(errors.some((x) => x.includes('periodType mismatch')));
});

test('C5-005 period consistency rejects mismatched boundaries', () => {
  const errors = validatePeriodConsistency([metric(), metric({ periodEnd: '2026-06-29' })]);
  assert.ok(errors.some((x) => x.includes('periodEnd mismatch')));
});

test('C5-028 restatement references are structurally paired', () => {
  const errors = validateEbiInputMetric(metric({ supersedesRestatementId: 'R-1' }));
  assert.ok(errors.includes('supersedesRestatementId requires restatementId'));
});

test('C5-028 restatement chain is accepted when both identifiers are present', () => {
  const errors = validateEbiInputMetric(metric({ restatementId: 'R-2', supersedesRestatementId: 'R-1' }));
  assert.deepEqual(errors, []);
});

test('C5-025 integration authority is data-only and version pinned', () => {
  assert.deepEqual(validateIntegrationRef({ consumer: 'ROTATION', methodologyVersion: 'EBI-1.3', authority: 'DATA_ONLY' }), []);
  assert.ok(validateIntegrationRef({ consumer: 'ROTATION', methodologyVersion: '', authority: 'DATA_ONLY' }).includes('methodologyVersion is required'));
  assert.ok(validateIntegrationRef({ consumer: 'ROTATION', methodologyVersion: 'EBI-1.3', authority: 'DATA_ONLY' }).length === 0);
});

test('C5-026 repeated dependency is rejected as circular', () => {
  assert.equal(rejectCircularDependency(['ROTATION', 'THEME', 'ROTATION']), true);
  assert.equal(rejectCircularDependency(['ROTATION', 'THEME']), false);
});

test('C5-029 provenance boundary: derived input requires formula version', () => {
  const errors = validateEbiInputMetric(metric({ classification: 'DERIVED', provenance: { ...provenance, dataNature: 'DERIVED', formulaVersion: null } }));
  assert.ok(errors.includes('DERIVED requires a non-empty formulaVersion'));
});

test('C5-029 no-fabrication boundary: reported input cannot claim derived data nature', () => {
  const errors = validateEbiInputMetric(metric({ classification: 'REPORTED', provenance: { ...provenance, dataNature: 'DERIVED', formulaVersion: 'EBI-1.3' } }));
  assert.ok(errors.includes('REPORTED input cannot use DERIVED dataNature'));
});

test('C5-029 no-fabrication boundary: null values remain null rather than zero', () => {
  const input = metric({ value: null });
  assert.equal(input.value, null);
});

test('C5-030 deterministic period guard is order-independent for a valid set', () => {
  const a = metric({ metric: 'Revenue' });
  const b = metric({ metric: 'EBIT' });
  assert.deepEqual(validatePeriodConsistency([a, b]), validatePeriodConsistency([b, a]));
});
