import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThemeLifecycleObservation,
  lifecycleIsIndependentFromStockPriceAndRotation,
  staleEvidenceAutomaticallyMeansDormant,
  missingEvidenceAutomaticallyMeansDeclining,
} from '../backend/src/theme/themeLifecycle.ts';

const p = {
  source:'tlae-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const observation=(lifecycle:'EMERGING'|'DEVELOPING'|'ACCELERATING'|'EXPANDING'|'MATURE'|'PEAK'|'DECELERATING'|'DECLINING'|'DORMANT')=>({
  observationId:'LIFE-1',
  themeId:'THEME-1',
  lifecycle,
  evidenceIds:['EV-1'],
  provenance:[p],
  methodologyVersion:'TLAE-1.0' as const,
});

test('TLAE-001 supports the complete Theme lifecycle',()=>{
  for (const lifecycle of ['EMERGING','DEVELOPING','ACCELERATING','EXPANDING','MATURE','PEAK','DECELERATING','DECLINING','DORMANT'] as const)
    assert.deepEqual(validateThemeLifecycleObservation(observation(lifecycle)),[]);
});

test('TLAE-002 lifecycle is independent from stock-price cycle and Market Rotation',()=>{
  assert.equal(lifecycleIsIndependentFromStockPriceAndRotation(),true);
});

test('TLAE-003 stale evidence alone does not mean dormant',()=>{
  assert.equal(staleEvidenceAutomaticallyMeansDormant(),false);
});

test('TLAE-004 missing evidence alone does not mean declining',()=>{
  assert.equal(missingEvidenceAutomaticallyMeansDeclining(),false);
});

test('TLAE-005 evidence and provenance are required',()=>{
  assert.ok(validateThemeLifecycleObservation({...observation('EMERGING'),evidenceIds:[]}).length>0);
  assert.ok(validateThemeLifecycleObservation({...observation('EMERGING'),provenance:[]}).length>0);
});
