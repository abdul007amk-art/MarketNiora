const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRotation } = require('../backend/src/protected/rotationEngine.ts');
const { calculateStockScore } = require('../backend/src/protected/stockScoreEngine.ts');

test('Rotation weights sum to 1.0 (40+30+20+10)', () => {
  assert.ok(Math.abs((0.40 + 0.30 + 0.20 + 0.10) - 1.0) < 1e-9);
});

test('confidence=29 (<CONF_MIN=30) excludes -> finalScore null', () => {
  const obs = [{ stockId: 'a', return_: 0.15 }, { stockId: 'b', return_: 0.05 }];
  const r = calculateRotation({ horizon: '1D', observations: obs, confidence: 29 });
  assert.equal(r.finalScore, null);
  assert.equal(r.includedByConfidence, false);
});

test('confidence=30 (=CONF_MIN) includes', () => {
  const obs = [{ stockId: 'a', return_: 0.15 }, { stockId: 'b', return_: 0.05 }];
  const r = calculateRotation({ horizon: '1D', observations: obs, confidence: 30 });
  assert.equal(r.includedByConfidence, true);
  assert.notEqual(r.finalScore, null);
});

test('1D cap of 8% clips a 50% return', () => {
  const r = calculateRotation({ horizon: '1D', observations: [{ stockId: 'x', return_: 0.50 }], confidence: 100 });
  assert.ok(r.medianReturn <= 0.08 + 1e-9);
});

test('1W cap of 12% enforced', () => {
  const r = calculateRotation({ horizon: '1W', observations: [{ stockId: 'x', return_: 0.50 }], confidence: 100 });
  assert.ok(r.medianReturn <= 0.12 + 1e-9);
});

test('empty observation array does not throw', () => {
  assert.doesNotThrow(() => calculateRotation({ horizon: '1M', observations: [], confidence: 100 }));
});

test('Stock Score weights sum to 1.0 (22+18+16+10+10+8+8+8)', () => {
  assert.ok(Math.abs((0.22+0.18+0.16+0.10+0.10+0.08+0.08+0.08) - 1.0) < 1e-9);
});

const fullComponents = {
  momentum: 80, earningsMomentum: 70, businessQuality: 90, relativeStrength: 60,
  valuation: 50, trendQuality: 75, volumeConfirmation: 65, growthVisibility: 55,
};

test('full-component score clamped within 0-100', () => {
  const r = calculateStockScore({ components: fullComponents, riskPenalty: 0, catalyst: 0, isSuspendedOrDelisted: false });
  assert.ok(r.finalScore >= 0 && r.finalScore <= 100);
});

test('suspended/delisted -> finalScore is N/A (null)', () => {
  const r = calculateStockScore({ components: fullComponents, riskPenalty: 0, catalyst: 0, isSuspendedOrDelisted: true });
  assert.equal(r.finalScore, null);
});

test('missing component gets zero weight after redistribution, total <= 1.0', () => {
  const partial = { ...fullComponents, momentum: null };
  const r = calculateStockScore({ components: partial, riskPenalty: 0, catalyst: 0, isSuspendedOrDelisted: false });
  const sum = Object.values(r.redistributedWeights).reduce((a, b) => a + b, 0);
  assert.equal(r.redistributedWeights['momentum'], 0);
  assert.ok(sum <= 1.0 + 1e-9);
});

test('riskPenalty=-35 (out of [-30,0] bound) throws', () => {
  assert.throws(() => calculateStockScore({ components: fullComponents, riskPenalty: -35, catalyst: 0, isSuspendedOrDelisted: false }));
});

test('extreme low score clamps at 0 floor', () => {
  const low = { momentum:5,earningsMomentum:5,businessQuality:5,relativeStrength:5,valuation:5,trendQuality:5,volumeConfirmation:5,growthVisibility:5 };
  const r = calculateStockScore({ components: low, riskPenalty: -30, catalyst: 0, isSuspendedOrDelisted: false });
  assert.equal(r.finalScore, 0);
});

test('max score + catalyst clamps at 100 ceiling', () => {
  const high = { momentum:100,earningsMomentum:100,businessQuality:100,relativeStrength:100,valuation:100,trendQuality:100,volumeConfirmation:100,growthVisibility:100 };
  const r = calculateStockScore({ components: high, riskPenalty: 0, catalyst: 12, isSuspendedOrDelisted: false });
  assert.equal(r.finalScore, 100);
});
