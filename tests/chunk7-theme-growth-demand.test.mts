import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThemeGrowthObservation,
  isRevenueGrowthAutomaticallyDemandGrowth,
  isCompanyGrowthAutomaticallyThemeGrowth,
  separatesDurabilityAndVisibility,
} from '../backend/src/theme/themeGrowthDemand.ts';

const p = {
  source:'tgde-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const observation=(dimension:'DEMAND_GROWTH'|'REVENUE_POOL_GROWTH'|'VOLUME'|'PRICE'|'CAPACITY'|'ADOPTION'|'PENETRATION'|'MARKET_EXPANSION'|'EXPORTS'|'REPLACEMENT_GROWTH')=>({
  observationId:'TGDE-1',
  themeId:'THEME-1',
  dimension,
  value:'documented observation',
  unit:'%',
  durability:null,
  visibility:null,
  evidenceIds:['EV-1'],
  provenance:[p],
  methodologyVersion:'TGDE-1.0' as const,
});

test('TGDE-001 validates distinct growth and demand dimensions',()=>{
  for (const d of ['DEMAND_GROWTH','REVENUE_POOL_GROWTH','VOLUME','PRICE','CAPACITY','ADOPTION','PENETRATION','MARKET_EXPANSION','EXPORTS','REPLACEMENT_GROWTH'] as const) {
    assert.deepEqual(validateThemeGrowthObservation(observation(d)),[]);
  }
});

test('TGDE-002 revenue growth is not automatically demand growth',()=>{
  assert.equal(isRevenueGrowthAutomaticallyDemandGrowth(),false);
});

test('TGDE-003 company growth is not automatically Theme growth',()=>{
  assert.equal(isCompanyGrowthAutomaticallyThemeGrowth(),false);
});

test('TGDE-004 durability and visibility remain separate',()=>{
  assert.equal(separatesDurabilityAndVisibility(),true);
});

test('TGDE-005 evidence and provenance are required',()=>{
  assert.ok(validateThemeGrowthObservation({...observation('DEMAND_GROWTH'),evidenceIds:[]}).length>0);
  assert.ok(validateThemeGrowthObservation({...observation('DEMAND_GROWTH'),provenance:[]}).length>0);
});
