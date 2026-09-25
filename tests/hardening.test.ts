const test = require('node:test');
const assert = require('node:assert/strict');

const { validateVolumeEvent, validateMomentumSequence } = require('../backend/src/hardening/volumeValidation.ts');
const { assessResidualRisk } = require('../backend/src/hardening/residualRisk.ts');
const { transitionDecision } = require('../backend/src/hardening/stateMachine.ts');
const { auditFeatureCorrelation } = require('../backend/src/hardening/correlationAudit.ts');
const { normalizeEarnings } = require('../backend/src/hardening/ene.ts');
const { validateLedgerEntry, hashEvidence } = require('../backend/src/hardening/governanceLedger.ts');
const { validatePointInTimeDecision, buildOutcomes, summarizeOutcomes } = require('../backend/src/hardening/pointInTimeBacktest.ts');

test('2x volume with positive price action can be valid confirmation', () => {
  const r = validateVolumeEvent({
    volume:200, average20dVolume:100, priceChangePct:3,
    liquiditySufficient:true, freeFloatSufficient:true,
    blockOrBulkDeal:false, circuitMove:false, materialEvent:false,
  });
  assert.equal(r.ratio,2);
  assert.equal(r.validConfirmation,true);
  assert.equal(r.kind,'VALID_CONFIRMATION');
});

test('volume up + price down is distribution risk', () => {
  const r = validateVolumeEvent({
    volume:250, average20dVolume:100, priceChangePct:-2,
    liquiditySufficient:true, freeFloatSufficient:true,
    blockOrBulkDeal:false, circuitMove:false, materialEvent:false,
  });
  assert.equal(r.distributionRisk,true);
  assert.equal(r.kind,'DISTRIBUTION_RISK');
});

test('circuit volume cannot become confirmation', () => {
  const r = validateVolumeEvent({
    volume:500, average20dVolume:100, priceChangePct:5,
    liquiditySufficient:true, freeFloatSufficient:true,
    blockOrBulkDeal:false, circuitMove:true, materialEvent:false,
  });
  assert.equal(r.abnormalCandidate,true);
  assert.equal(r.validConfirmation,false);
  assert.equal(r.kind,'NON_CONFIRMING_EVENT');
});

test('locked momentum sequence requires 2-4 cooling sessions and second expansion', () => {
  assert.equal(validateMomentumSequence({
    firstEventValid:true, coolingSessions:3, structuralBreakdownDuringCooling:false,
    secondExpansionRatio:1.7, secondExpansionPositivePriceAction:true,
    breakoutOrRetest:true, ema20PullbackEntry:false,
  }).eligible,true);
});

test('residual risk separates duplicate and uncaptured risk', () => {
  const r = assessResidualRisk([
    {category:'VALUATION',severity:2,alreadyCapturedByBusinessQuality:false,alreadyCapturedByValuation:true,evidenceId:'e1'},
    {category:'LIQUIDITY',severity:3,alreadyCapturedByBusinessQuality:false,alreadyCapturedByValuation:false,evidenceId:'e2'},
  ]);
  assert.equal(r.duplicateFlags.length,1);
  assert.equal(r.uncaptured.length,1);
  assert.equal(r.hasMaterialResidualRisk,true);
});

test('READY falls to WAIT when a confirmation gate is lost', () => {
  const r = transitionDecision({
    from:'READY',
    technicalConfirmed:true, volumeConfirmed:false,
    relativeStrengthConfirmed:true, fundamentalRiskAcceptable:true,
    entryAvailable:true, hardInvalidation:false, opportunityCostHigh:false,
  });
  assert.equal(r.to,'WAIT');
});

test('hard invalidation overrides every other condition', () => {
  const r = transitionDecision({
    from:'READY',
    technicalConfirmed:true, volumeConfirmed:true,
    relativeStrengthConfirmed:true, fundamentalRiskAcceptable:true,
    entryAvailable:true, hardInvalidation:true, opportunityCostHigh:false,
  });
  assert.equal(r.to,'INVALIDATED');
});

test('correlation audit flags high overlap without changing weights', () => {
  const observations = [1,2,3,4,5].map((x,i)=>({id:String(i),values:{momentum:x,trend:x*2,growth:6-x}}));
  const findings = auditFeatureCorrelation(observations);
  assert.ok(findings.some(x=>x.left==='momentum' && x.right==='trend' && x.severity==='HIGH'));
});

test('ENE produces normalized P/E independently of reported P/E', () => {
  const r = normalizeEarnings({
    currentRevenue:1000,currentMargin:0.20,
    normalizedRevenue:900,normalizedMargin:0.12,
    currentShares:100,currentPrice:180,
  });
  assert.equal(r.reportedProfit,200);
  assert.equal(r.normalizedProfit,108);
  assert.equal(r.reportedPe,90);
  assert.equal(r.normalizedPe,166.66666666666669);
});

test('governance ledger rejects future knowledge', () => {
  const r = validateLedgerEntry({
    entryId:'d1',stockId:'ABC',dataAsOf:100,decisionTimestamp:110,
    featureVersion:'FE-1',rotationVersion:'ROT-1.2',themeVersion:'THEME-1',
    scoreVersion:'SS-1.0-R3',riskVersion:'R-1',decisionVersion:'DE-1',
    state:'WAIT',entryTrigger:null,invalidation:null,reason:'setup pending',
    evidence:[{evidenceId:'e1',source:'src',sourceTimestamp:90,knowledgeTimestamp:101,contentHash:hashEvidence({a:1})}],
  });
  assert.ok(r.some(x=>x.includes('future knowledge leakage')));
});

test('point-in-time backtest rejects future evidence', () => {
  const errors = validatePointInTimeDecision({
    stockId:'ABC',decisionTime:100,state:'READY',
    evidence:[{stockId:'ABC',effectiveTime:90,knowledgeTime:101,value:100}],
  });
  assert.equal(errors.length,1);
});

test('backtest summary is deterministic', () => {
  const decisions = [{
    stockId:'ABC',decisionTime:100,state:'READY',
    evidence:[{stockId:'ABC',effectiveTime:90,knowledgeTime:95,value:100}],
  }];
  const prices = [
    {stockId:'ABC',effectiveTime:100,knowledgeTime:100,value:100},
    {stockId:'ABC',effectiveTime:100+5*86_400_000,knowledgeTime:100+5*86_400_000,value:110},
  ];
  const outcomes = buildOutcomes(decisions,prices,5);
  const s = summarizeOutcomes(outcomes);
  assert.equal(s.observations,1);
  assert.equal(s.hitRate,1);
  assert.equal(s.averageReturnPct,10);
});
