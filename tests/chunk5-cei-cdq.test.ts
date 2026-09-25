import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCei, type CeiInputs } from '../backend/src/ebi/cei.ts';
import {
  EBI_COVERAGE_MIN,
  EBI_REQUIREMENT_REGISTRY,
  calculateCoverage,
  applyCoverageGate,
  missingMandatoryProductionEngines,
} from '../backend/src/ebi/cdq.ts';

function base(overrides: Partial<CeiInputs> = {}): CeiInputs {
  return {
    pat: 100,
    currentEquity: 500,
    priorEquity: 400,
    ebit: 200,
    totalAssets: 1200,
    currentLiabilities: 200,
    shortTermInterestBearingDebt: 100,
    longTermInterestBearingDebt: 300,
    totalEquity: 450,
    cashAndMarketableSecurities: 50,
    priorInvestedCapital: 700,
    effectiveTaxRate: 0.25,
    ...overrides,
  };
}

test('CEI-ROIC-006: financing-side invested capital is debt + equity - cash', () => {
  const r = calculateCei(base());
  assert.equal(r.totalDebt.value, 400);
  assert.equal(r.investedCapital.value, 800);
});

test('CEI-ROIC-007: long-term interest-bearing debt is included in total debt', () => {
  const r = calculateCei(base({ shortTermInterestBearingDebt: 100, longTermInterestBearingDebt: 900 }));
  assert.equal(r.totalDebt.value, 1000);
  assert.equal(r.investedCapital.value, 1400);
});

test('CEI-ROIC-008: missing debt component is not silently zero-filled', () => {
  const r = calculateCei(base({ longTermInterestBearingDebt: null }));
  assert.equal(r.totalDebt.state, 'NOT_COMPUTABLE');
  assert.equal(r.investedCapital.state, 'NOT_COMPUTABLE');
});

test('CEI-ROIC-009: missing cash/marketable securities blocks invested capital', () => {
  const r = calculateCei(base({ cashAndMarketableSecurities: null }));
  assert.equal(r.investedCapital.state, 'NOT_COMPUTABLE');
});

test('CEI-ROIC-010: zero average invested capital makes ROIC not computable', () => {
  const r = calculateCei(base({ shortTermInterestBearingDebt: 0, longTermInterestBearingDebt: 0, totalEquity: 0, cashAndMarketableSecurities: 0, priorInvestedCapital: 0 }));
  assert.equal(r.averageInvestedCapital.value, 0);
  assert.equal(r.roic.state, 'NOT_COMPUTABLE');
});

test('CEI-ROIC-011: negative average invested capital makes ROIC not comparable', () => {
  const r = calculateCei(base({ shortTermInterestBearingDebt: 0, longTermInterestBearingDebt: 0, totalEquity: 0, cashAndMarketableSecurities: 0, priorInvestedCapital: -100 }));
  assert.equal(r.averageInvestedCapital.value, -50);
  assert.equal(r.roic.state, 'NOT_COMPARABLE');
});

test('CEI-ROIC-012: missing prior invested capital makes ROIC not computable', () => {
  const r = calculateCei(base({ priorInvestedCapital: null }));
  assert.equal(r.averageInvestedCapital.state, 'NOT_COMPUTABLE');
  assert.equal(r.roic.state, 'NOT_COMPUTABLE');
});

test('CEI ETR boundary: outside [0,1] is not computable and is not clamped', () => {
  const low = calculateCei(base({ effectiveTaxRate: -0.01 }));
  const high = calculateCei(base({ effectiveTaxRate: 1.01 }));
  assert.equal(low.nopat.reason, 'ETR_OUTSIDE_STANDARD_RANGE');
  assert.equal(high.nopat.reason, 'ETR_OUTSIDE_STANDARD_RANGE');
  assert.equal(low.nopat.value, null);
  assert.equal(high.nopat.value, null);
});

test('CEI ROCE uses total assets minus current liabilities', () => {
  const r = calculateCei(base());
  assert.equal(r.roce.value, 20);
});

test('CDQ coverage denominator and 40% gate are deterministic', () => {
  assert.equal(EBI_COVERAGE_MIN, 40);
  assert.equal(calculateCoverage(4, 10).coveragePercent, 40);
  assert.equal(applyCoverageGate(40, true).state, 'PASS');
  assert.equal(applyCoverageGate(39.99, true).state, 'NOT_COMPUTABLE');
  assert.equal(applyCoverageGate(10, false).state, 'PASS');
});

test('CDQ missing requirement denominator is review/conflict, not fabricated', () => {
  const r = calculateCoverage(4, null);
  assert.equal(r.state, 'REVIEW_CONFLICT');
  assert.equal(r.coveragePercent, null);
});

test('CDQ production registry exactly matches the v1.3 mandatory flags', () => {
  assert.deepEqual(EBI_REQUIREMENT_REGISTRY, {
    DDE: false,
    ENE: true,
    RGQ: true,
    PGQ: true,
    CFQ: true,
    BSQ: true,
    CEI: true,
    BNI: false,
    CPI: false,
    GVI: false,
    ECI: false,
    BERI: false,
  });
  assert.deepEqual(missingMandatoryProductionEngines(['ENE', 'RGQ', 'PGQ', 'CFQ', 'BSQ', 'CEI']), []);
});
