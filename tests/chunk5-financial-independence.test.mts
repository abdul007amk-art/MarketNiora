import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFinancialEngineIndependence } from '../backend/src/ebi/financialIndependence.ts';

test('C5-013: CFQ, BSQ and CEI may share source data without sharing decisions', () => {
  assert.deepEqual(
    validateFinancialEngineIndependence([
      { engine: 'CFQ', dependsOn: ['RAW_CFO', 'RAW_CAPEX'] },
      { engine: 'BSQ', dependsOn: ['RAW_DEBT', 'RAW_CASH', 'RAW_EQUITY'] },
      { engine: 'CEI', dependsOn: ['RAW_EBIT', 'RAW_PAT', 'RAW_DEBT', 'RAW_EQUITY', 'RAW_CASH'] },
    ]),
    [],
  );
});

test('C5-013: sibling financial-engine dependency is rejected', () => {
  assert.deepEqual(
    validateFinancialEngineIndependence([
      { engine: 'CEI', dependsOn: ['CFQ'] },
    ]),
    ['CEI cannot depend on sibling EBI engine CFQ; use shared source data instead'],
  );
});

test('C5-013: every sibling direction is rejected', () => {
  const errors = validateFinancialEngineIndependence([
    { engine: 'CFQ', dependsOn: ['BSQ'] },
    { engine: 'BSQ', dependsOn: ['CEI'] },
    { engine: 'CEI', dependsOn: ['CFQ'] },
  ]);
  assert.equal(errors.length, 3);
});
