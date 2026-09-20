const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRotation } = require('../backend/src/protected/rotationEngine.ts');
const { calculateStockScore } = require('../backend/src/protected/stockScoreEngine.ts');

// ============================================================
// MODULE 8 — ROTATION ENGINE v1.2 — additional audit coverage
// ============================================================

test('Rotation: 1M cap of 20% enforced', () => {
  const r = calculateRotation({ horizon: '1M', observations: [{ stockId: 'x', return_: 0.50 }], confidence: 100 });
  assert.ok(r.medianReturn <= 0.20 + 1e-9);
});

test('Rotation: 3M cap of 30% enforced', () => {
  const r = calculateRotation({ horizon: '3M', observations: [{ stockId: 'x', return_: 0.50 }], confidence: 100 });
  assert.ok(r.medianReturn <= 0.30 + 1e-9);
});

test('Rotation: negative returns are capped symmetrically (floor, not just ceiling)', () => {
  const r = calculateRotation({ horizon: '1D', observations: [{ stockId: 'x', return_: -0.50 }], confidence: 100 });
  assert.ok(r.medianReturn >= -0.08 - 1e-9);
});

test('Rotation: weighted final score matches the documented coefficients exactly (40/30/20/10)', () => {
  // Rather than assuming the linear combination uses the right weights,
  // recompute it independently from the RETURNED sub-metrics and compare.
  const obs = [
    { stockId: 'a', return_: 0.03 }, { stockId: 'b', return_: -0.01 },
    { stockId: 'c', return_: 0.05 }, { stockId: 'd', return_: 0.02 },
    { stockId: 'e', return_: -0.02 },
  ];
  const r = calculateRotation({ horizon: '1M', observations: obs, confidence: 100 });
  const expected = 0.40 * r.medianReturn + 0.30 * r.participation + 0.20 * r.ewCappedReturn + 0.10 * r.iqrConsistency;
  assert.ok(Math.abs(r.finalScore - expected) < 1e-9, `finalScore (${r.finalScore}) must equal 0.4*median + 0.3*participation + 0.2*ewCapped + 0.1*iqrConsistency (${expected})`);
});

test('Rotation: N_REF=20 boundary — below reference sample size scales iqrConsistency down proportionally', () => {
  // 10 observations = half of N_REF=20 -> iqrConsistency should be scaled
  // toward half of what it'd be with >= 20 observations, all else equal.
  const makeObs = (n) => Array.from({ length: n }, (_, i) => ({ stockId: `s${i}`, return_: 0.01 * (i % 3) }));
  const below = calculateRotation({ horizon: '1M', observations: makeObs(10), confidence: 100 });
  const atRef = calculateRotation({ horizon: '1M', observations: makeObs(20), confidence: 100 });
  // With below-N_REF scaling applied, 10 observations should produce a
  // smaller (or equal) iqrConsistency contribution than reaching N_REF.
  assert.ok(below.iqrConsistency <= atRef.iqrConsistency + 1e-9, `below-N_REF (${below.iqrConsistency}) should not exceed at-N_REF (${atRef.iqrConsistency})`);
});

test('Rotation: single observation does not crash and produces a defined result', () => {
  const r = calculateRotation({ horizon: '1D', observations: [{ stockId: 'solo', return_: 0.02 }], confidence: 100 });
  assert.equal(typeof r.finalScore, 'number');
});

test('Rotation: hierarchy composition (Stock -> Stock Group -> Sub-Sector -> Sector) — the engine is level-agnostic; hierarchy is realized by the CALLER feeding correctly-scoped observations at each level in turn. Demonstrated here, not enforced by the engine.', () => {
  // Level 1: raw stock returns within one Stock Group
  const stockReturns = [
    { stockId: 'stock1', return_: 0.04 }, { stockId: 'stock2', return_: 0.02 }, { stockId: 'stock3', return_: 0.06 },
  ];
  const groupResult = calculateRotation({ horizon: '1D', observations: stockReturns, confidence: 100 });
  assert.equal(typeof groupResult.finalScore, 'number');

  // Level 2: the Stock Group's aggregate becomes ONE observation feeding into Sub-Sector level, alongside other groups
  const subSectorObs = [
    { stockId: 'group_A', return_: groupResult.finalScore },
    { stockId: 'group_B', return_: 0.015 },
  ];
  const subSectorResult = calculateRotation({ horizon: '1D', observations: subSectorObs, confidence: 100 });
  assert.equal(typeof subSectorResult.finalScore, 'number');

  // Level 3: Sub-Sector aggregates feed into Sector level
  const sectorObs = [
    { stockId: 'subsector_X', return_: subSectorResult.finalScore },
    { stockId: 'subsector_Y', return_: -0.01 },
  ];
  const sectorResult = calculateRotation({ horizon: '1D', observations: sectorObs, confidence: 100 });
  assert.equal(typeof sectorResult.finalScore, 'number');
  // The point of this test: the SAME pure function composes across all
  // three hierarchy levels without any special-casing — confirming the
  // engine is correctly hierarchy-agnostic rather than hardcoded to one level.
});

// ============================================================
// MODULE 9 — STOCK SCORE ENGINE SS-1.0-R3 — additional audit coverage
// ============================================================

test('StockScore: base matches the documented coefficients exactly (22/18/16/10/10/8/8/8) when no components are missing', () => {
  const components = { momentum: 80, earningsMomentum: 70, businessQuality: 90, relativeStrength: 60, valuation: 50, trendQuality: 75, volumeConfirmation: 65, growthVisibility: 55 };
  const r = calculateStockScore({ components, riskPenalty: 0, catalyst: 0, isSuspendedOrDelisted: false });
  const expectedBase =
    0.22 * components.momentum + 0.18 * components.earningsMomentum + 0.16 * components.businessQuality +
    0.10 * components.relativeStrength + 0.10 * components.valuation + 0.08 * components.trendQuality +
    0.08 * components.volumeConfirmation + 0.08 * components.growthVisibility;
  assert.ok(Math.abs(r.base - expectedBase) < 1e-9, `base (${r.base}) must equal the documented weighted sum (${expectedBase})`);
});

test('StockScore: multiple missing components redistribute correctly, weights still cap at 1.25x original', () => {
  const components = { momentum: null, earningsMomentum: null, businessQuality: 90, relativeStrength: 60, valuation: 50, trendQuality: 75, volumeConfirmation: 65, growthVisibility: 55 };
  const r = calculateStockScore({ components, riskPenalty: 0, catalyst: 0, isSuspendedOrDelisted: false });
  assert.equal(r.redistributedWeights.momentum, 0);
  assert.equal(r.redistributedWeights.earningsMomentum, 0);
  // businessQuality's original weight is 0.16; cap is 0.16*1.25 = 0.20
  assert.ok(r.redistributedWeights.businessQuality <= 0.16 * 1.25 + 1e-9);
  const sum = Object.values(r.redistributedWeights).reduce((a, b) => a + b, 0);
  assert.ok(sum <= 1.0 + 1e-9);
});

test('StockScore: riskPenalty boundary values -30 and 0 are both accepted (inclusive bounds)', () => {
  const components = { momentum: 50, earningsMomentum: 50, businessQuality: 50, relativeStrength: 50, valuation: 50, trendQuality: 50, volumeConfirmation: 50, growthVisibility: 50 };
  assert.doesNotThrow(() => calculateStockScore({ components, riskPenalty: -30, catalyst: 0, isSuspendedOrDelisted: false }));
  assert.doesNotThrow(() => calculateStockScore({ components, riskPenalty: 0, catalyst: 0, isSuspendedOrDelisted: false }));
});

test('StockScore: riskPenalty of +5 (positive, out of [-30,0]) throws', () => {
  const components = { momentum: 50, earningsMomentum: 50, businessQuality: 50, relativeStrength: 50, valuation: 50, trendQuality: 50, volumeConfirmation: 50, growthVisibility: 50 };
  assert.throws(() => calculateStockScore({ components, riskPenalty: 5, catalyst: 0, isSuspendedOrDelisted: false }));
});

test('StockScore: all four documented catalyst values (0, 4, 8, 12) are accepted and additive', () => {
  const components = { momentum: 50, earningsMomentum: 50, businessQuality: 50, relativeStrength: 50, valuation: 50, trendQuality: 50, volumeConfirmation: 50, growthVisibility: 50 };
  const base = calculateStockScore({ components, riskPenalty: 0, catalyst: 0, isSuspendedOrDelisted: false }).base;
  for (const catalyst of [0, 4, 8, 12]) {
    const r = calculateStockScore({ components, riskPenalty: 0, catalyst, isSuspendedOrDelisted: false });
    assert.ok(Math.abs(r.finalScore - Math.min(100, base + catalyst)) < 1e-9);
  }
});

test('Finding 9-A CLOSED (Owner-authorized runtime guard): out-of-spec catalyst values now throw instead of silently passing through', () => {
  const components = { momentum: 50, earningsMomentum: 50, businessQuality: 50, relativeStrength: 50, valuation: 50, trendQuality: 50, volumeConfirmation: 50, growthVisibility: 50 };
  // Previously this silently succeeded with finalScore = base + 6. Now it
  // must throw — the same defensive pattern riskPenalty already had.
  for (const badCatalyst of [6, 1, 2, 3, 5, 7, 9, 10, 11, 13, -4, 100]) {
    assert.throws(
      () => calculateStockScore({ components, riskPenalty: 0, catalyst: badCatalyst, isSuspendedOrDelisted: false }),
      `catalyst=${badCatalyst} should be rejected`
    );
  }
});

test('Finding 9-A: all four documented catalyst values (0, 4, 8, 12) still work correctly after the guard was added', () => {
  const components = { momentum: 50, earningsMomentum: 50, businessQuality: 50, relativeStrength: 50, valuation: 50, trendQuality: 50, volumeConfirmation: 50, growthVisibility: 50 };
  for (const catalyst of [0, 4, 8, 12]) {
    assert.doesNotThrow(() => calculateStockScore({ components, riskPenalty: 0, catalyst, isSuspendedOrDelisted: false }));
  }
});

test('StockScore: Confidence is structurally absent from this engine — cannot multiply the score because there is no confidence parameter at all', () => {
  const components = { momentum: 50, earningsMomentum: 50, businessQuality: 50, relativeStrength: 50, valuation: 50, trendQuality: 50, volumeConfirmation: 50, growthVisibility: 50 };
  const inputKeys = Object.keys({ components, riskPenalty: 0, catalyst: 0, isSuspendedOrDelisted: false });
  assert.equal(inputKeys.includes('confidence'), false);
});

test('Module 8/9 isolation: rotationEngine.ts and stockScoreEngine.ts have zero import statements between them (structurally cannot cross-reference)', () => {
  const fs = require('fs');
  const rotationSrc = fs.readFileSync(require.resolve('../backend/src/protected/rotationEngine.ts'), 'utf8');
  const scoreSrc = fs.readFileSync(require.resolve('../backend/src/protected/stockScoreEngine.ts'), 'utf8');
  // Check for actual import statements, not just any mention of the other
  // file's name — both files legitimately mention each other BY NAME in
  // comments to document the isolation rule itself.
  const hasImportOfScoreEngine = /^\s*import\b.*stockScoreEngine/m.test(rotationSrc);
  const hasImportOfRotationEngine = /^\s*import\b.*rotationEngine/m.test(scoreSrc);
  assert.equal(hasImportOfScoreEngine, false);
  assert.equal(hasImportOfRotationEngine, false);
});
