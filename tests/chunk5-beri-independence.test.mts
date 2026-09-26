import test from 'node:test';
import assert from 'node:assert/strict';
import { validateBeriIndependence } from '../backend/src/ebi/beriIndependence.ts';

test('C5-016 BERI may consume shared source evidence', () => {
  assert.deepEqual(
    validateBeriIndependence([
      { dependsOn: ['risk_evidence', 'reported_financials', 'management_disclosure'] },
    ]),
    [],
  );
});

test('C5-016 BERI rejects dependency on an EBI sibling decision', () => {
  const errors = validateBeriIndependence([
    { dependsOn: ['CEI'] },
  ]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /BERI cannot depend on EBI engine CEI/);
});

test('C5-016 BERI rejects dependencies across the EBI decision layer', () => {
  const errors = validateBeriIndependence([
    { dependsOn: ['DDE', 'ENE', 'RGQ', 'PGQ', 'CFQ', 'BSQ', 'BNI', 'CPI', 'GVI', 'ECI', 'CDQ'] },
  ]);
  assert.equal(errors.length, 11);
});

test('C5-016 BERI remains independent when dependencies are source-only', () => {
  assert.deepEqual(
    validateBeriIndependence([
      { dependsOn: ['raw_risk_facts', 'audited_statements', 'source_document'] },
    ]),
    [],
  );
});
