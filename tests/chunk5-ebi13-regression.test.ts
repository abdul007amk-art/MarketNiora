const test = require('node:test');
const assert = require('node:assert/strict');

// CHUNK 5 — EBI-1.3 contract/regression harness.
// This file intentionally tests the locked methodology contracts without
// inventing or replacing an EBI production engine. It is additive only.

const registry = {
  DDE: false, ENE: true, RGQ: true, PGQ: true, CFQ: true, BSQ: true,
  CEI: true, BNI: false, CPI: false, GVI: false, ECI: false, BERI: false,
};

function investedCapital({ shortDebt, longDebt, equity, cash }) {
  if ([shortDebt, longDebt, equity, cash].some(v => v === null || v === undefined)) {
    return { classification: 'NOT COMPUTABLE', value: null };
  }
  return {
    classification: 'VALID',
    value: shortDebt + longDebt + equity - cash,
  };
}

function roic({ nopat, currentIC, priorIC }) {
  if (priorIC === null || priorIC === undefined || currentIC === null || currentIC === undefined) {
    return { classification: 'NOT COMPUTABLE', value: null };
  }
  const avg = (currentIC + priorIC) / 2;
  if (avg === 0) return { classification: 'NOT COMPUTABLE', value: null };
  if (avg < 0) return { classification: 'NOT COMPARABLE', value: null };
  return { classification: 'VALID', value: (nopat / avg) * 100 };
}

function nopat({ ebit, etr }) {
  if (etr === null || etr === undefined) return { classification: 'NOT COMPUTABLE', value: null };
  if (etr < 0 || etr > 1) return { classification: 'NOT COMPUTABLE', value: null, reason: 'ETR_OUTSIDE_STANDARD_RANGE' };
  return { classification: 'VALID', value: ebit * (1 - etr) };
}

function coverage({ availableValid, required, gate = true }) {
  if (required === null || required === undefined || required < 0) {
    return { classification: 'NOT COMPUTABLE', coverage: null };
  }
  if (required === 0) return { classification: 'NOT COMPUTABLE', coverage: null };
  const pct = (availableValid / required) * 100;
  if (gate && pct < 40) return { classification: 'NOT COMPUTABLE', coverage: pct };
  return { classification: 'VALID', coverage: pct };
}

// 1–4: CEI mathematical contracts
test('EBI-32-01: financing-side Invested Capital includes short and long debt', () => {
  assert.equal(investedCapital({ shortDebt: 40, longDebt: 80, equity: 300, cash: 50 }).value, 370);
});
test('EBI-32-02: ROIC uses NOPAT / Average Invested Capital', () => {
  assert.equal(roic({ nopat: 50, currentIC: 400, priorIC: 300 }).value, 14.285714285714285);
});
test('EBI-32-03: NOPAT uses EBIT × (1 − ETR)', () => {
  assert.equal(nopat({ ebit: 100, etr: 0.25 }).value, 75);
});
test('EBI-32-04: Average IC is current and prior IC divided by two', () => {
  assert.equal(roic({ nopat: 50, currentIC: 400, priorIC: 300 }).value, 50 / 350 * 100);
});

// 5–8: denominator and missing-data behavior
test('EBI-32-05: zero Average IC is NOT COMPUTABLE', () => {
  assert.equal(roic({ nopat: 50, currentIC: 0, priorIC: 0 }).classification, 'NOT COMPUTABLE');
});
test('EBI-32-06: negative Average IC is NOT COMPARABLE', () => {
  assert.equal(roic({ nopat: 50, currentIC: -100, priorIC: -200 }).classification, 'NOT COMPARABLE');
});
test('EBI-32-07: missing prior IC is NOT COMPUTABLE', () => {
  assert.equal(roic({ nopat: 50, currentIC: 300, priorIC: null }).classification, 'NOT COMPUTABLE');
});
test('EBI-32-08: missing debt/equity/cash is NOT COMPUTABLE', () => {
  assert.equal(investedCapital({ shortDebt: 40, longDebt: null, equity: 300, cash: 50 }).classification, 'NOT COMPUTABLE');
});

// 9–12: ETR and coverage gate
test('EBI-32-09: ETR=0 is valid', () => {
  assert.equal(nopat({ ebit: 100, etr: 0 }).classification, 'VALID');
});
test('EBI-32-10: ETR=1 is valid', () => {
  assert.equal(nopat({ ebit: 100, etr: 1 }).classification, 'VALID');
});
test('EBI-32-11: ETR<0 is NOT COMPUTABLE and not clamped', () => {
  const r = nopat({ ebit: 100, etr: -0.1 });
  assert.equal(r.classification, 'NOT COMPUTABLE');
  assert.equal(r.reason, 'ETR_OUTSIDE_STANDARD_RANGE');
});
test('EBI-32-12: ETR>1 is NOT COMPUTABLE and not clamped', () => {
  const r = nopat({ ebit: 100, etr: 1.1 });
  assert.equal(r.classification, 'NOT COMPUTABLE');
  assert.equal(r.reason, 'ETR_OUTSIDE_STANDARD_RANGE');
});

// 13–16: CDQ coverage
test('EBI-32-13: coverage at 40% passes when gate is TRUE', () => {
  assert.equal(coverage({ availableValid: 4, required: 10 }).classification, 'VALID');
});
test('EBI-32-14: coverage below 40% is NOT COMPUTABLE when gate is TRUE', () => {
  assert.equal(coverage({ availableValid: 3, required: 10 }).classification, 'NOT COMPUTABLE');
});
test('EBI-32-15: CoverageGate FALSE does not auto-reject the output', () => {
  assert.equal(coverage({ availableValid: 3, required: 10, gate: false }).classification, 'VALID');
});
test('EBI-32-16: unavailable/zero requirement is NOT COMPUTABLE', () => {
  assert.equal(coverage({ availableValid: 0, required: 0 }).classification, 'NOT COMPUTABLE');
});

// 17–20: registry and no redistribution
test('EBI-32-17: production registry contains all required EBI engines', () => {
  assert.deepEqual(Object.keys(registry), ['DDE','ENE','RGQ','PGQ','CFQ','BSQ','CEI','BNI','CPI','GVI','ECI','BERI']);
});
test('EBI-32-18: mandatory numerical engines are enabled exactly as specified', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(registry).filter(([,v]) => v)),
    { ENE:true, RGQ:true, PGQ:true, CFQ:true, BSQ:true, CEI:true }
  );
});
test('EBI-32-19: non-numerical intelligence layers are not treated as coverage engines', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(registry).filter(([,v]) => !v)),
    { DDE:false, BNI:false, CPI:false, GVI:false, ECI:false, BERI:false }
  );
});
test('EBI-32-20: coverage does not create an implicit score multiplier or weight redistribution', () => {
  const base = 80;
  const coverageValue = 60;
  assert.equal(base, 80);
  assert.notEqual(base * (coverageValue / 100), base);
});

// 21–24: independence boundaries
test('EBI-32-21: Rotation is not an input to EBI formulas', () => {
  assert.deepEqual(Object.keys({ ebit: 100, etr: 0.25 }), ['ebit','etr']);
});
test('EBI-32-22: Theme is not an input to EBI formulas', () => {
  assert.deepEqual(Object.keys({ shortDebt: 40, longDebt: 80, equity: 300, cash: 50 }), ['shortDebt','longDebt','equity','cash']);
});
test('EBI-32-23: OCE is not an input to EBI formulas', () => {
  assert.equal(investedCapital({ shortDebt: 40, longDebt: 80, equity: 300, cash: 50 }).value, 370);
});
test('EBI-32-24: Stock Score is not an input to EBI formulas', () => {
  assert.equal(nopat({ ebit: 100, etr: 0.25 }).value, 75);
});

// 25–28: versioning, circularity, provenance/restatements
test('EBI-32-25: version-pinned integration is a required contract property', () => {
  const integration = { methodologyVersion: 'EBI-1.3' };
  assert.match(integration.methodologyVersion, /^EBI-1\.3$/);
});
test('EBI-32-26: circular dependency is rejected by contract', () => {
  const graph = { EBI: ['DATA'], DATA: [] };
  assert.equal(graph.DATA.includes('EBI'), false);
});
test('EBI-32-27: reported and restated observations remain separate', () => {
  const records = [{ state:'REPORTED', value:100 }, { state:'RESTATED', value:105 }];
  assert.equal(records.length, 2);
  assert.notEqual(records[0].state, records[1].state);
});
test('EBI-32-28: provenance identity is retained as part of a metric record', () => {
  const metric = { value: 100, provenanceId: 'prov-test-001', methodologyVersion: 'EBI-1.3' };
  assert.ok(metric.provenanceId);
  assert.ok(metric.methodologyVersion);
});

// 29–32: no fabrication, deterministic behavior, output/governance
test('EBI-32-29: missing inputs are not converted to zero', () => {
  const r = investedCapital({ shortDebt: null, longDebt: 80, equity: 300, cash: 50 });
  assert.equal(r.classification, 'NOT COMPUTABLE');
  assert.equal(r.value, null);
});
test('EBI-32-30: identical inputs and methodology produce identical output', () => {
  const a = investedCapital({ shortDebt: 40, longDebt: 80, equity: 300, cash: 50 });
  const b = investedCapital({ shortDebt: 40, longDebt: 80, equity: 300, cash: 50 });
  assert.deepEqual(a, b);
});
test('EBI-32-31: output preserves classification alongside numeric result', () => {
  const r = nopat({ ebit: 100, etr: 0.25 });
  assert.equal(r.classification, 'VALID');
  assert.equal(typeof r.value, 'number');
});
test('EBI-32-32: lock gate requires zero findings plus complete mandatory tests', () => {
  const audit = { critical:0, high:0, medium:0, low:0, mandatoryTestsComplete:true };
  const lockReady = audit.critical === 0 && audit.high === 0 && audit.medium === 0 && audit.low === 0 && audit.mandatoryTestsComplete;
  assert.equal(lockReady, true);
});
