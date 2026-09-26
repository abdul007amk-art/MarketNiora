import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThemeSupplyDemandObservation,
  announcedCapacityIsCurrentOperatingSupply,
  companyExpansionIsAutomaticallyThemeSupplyExpansion,
} from '../backend/src/theme/themeSupplyDemand.ts';

const p = {
  source:'tsde-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const observation=(dimension:'DEMAND'|'SUPPLY'|'CAPACITY'|'PRODUCTION'|'UTILIZATION'|'INVENTORY'|'RAW_MATERIAL_AVAILABILITY'|'TRADE_FLOWS',state:'SHORTAGE'|'TIGHT'|'BALANCED'|'LOOSE'|'SURPLUS'|'MIXED'|'UNKNOWN'='BALANCED')=>({
  observationId:'TSDE-1',
  themeId:'THEME-1',
  dimension,
  value:'documented observation',
  unit:'units',
  state,
  isAnnouncedCapacity:false,
  isCurrentOperatingSupply:false,
  evidenceIds:['EV-1'],
  provenance:[p],
  methodologyVersion:'TSDE-1.0' as const,
});

test('TSDE-001 validates distinct supply/demand dimensions and states',()=>{
  for (const d of ['DEMAND','SUPPLY','CAPACITY','PRODUCTION','UTILIZATION','INVENTORY','RAW_MATERIAL_AVAILABILITY','TRADE_FLOWS'] as const) {
    assert.deepEqual(validateThemeSupplyDemandObservation(observation(d)),[]);
  }
  for (const state of ['SHORTAGE','TIGHT','BALANCED','LOOSE','SURPLUS','MIXED','UNKNOWN'] as const) {
    assert.deepEqual(validateThemeSupplyDemandObservation(observation('SUPPLY',state)),[]);
  }
});

test('TSDE-002 announced capacity is not current operating supply',()=>{
  assert.equal(announcedCapacityIsCurrentOperatingSupply(),false);
  assert.ok(validateThemeSupplyDemandObservation({
    ...observation('CAPACITY'),
    isAnnouncedCapacity:true,
    isCurrentOperatingSupply:true,
  }).length>0);
});

test('TSDE-003 company expansion is not automatically Theme-wide supply expansion',()=>{
  assert.equal(companyExpansionIsAutomaticallyThemeSupplyExpansion(),false);
});

test('TSDE-004 evidence and provenance are required',()=>{
  assert.ok(validateThemeSupplyDemandObservation({...observation('DEMAND'),evidenceIds:[]}).length>0);
  assert.ok(validateThemeSupplyDemandObservation({...observation('DEMAND'),provenance:[]}).length>0);
});
