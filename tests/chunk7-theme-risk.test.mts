import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThemeRisk,
  riskExposureIsNegativeCatalyst,
  unsupportedProbabilityIsFabricated,
  riskAutomaticallyAltersStockScore,
  riskAutomaticallyAltersOCE,
} from '../backend/src/theme/themeRisk.ts';

const p = {
  source:'tre-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const risk=(type:'DEMAND'|'SUPPLY'|'PRICING'|'MARGIN'|'TECHNOLOGY'|'REGULATORY'|'TRADE'|'CAPITAL'|'EXECUTION'|'COMPETITIVE'|'SUBSTITUTION', probability:string|null=null)=>({
  riskId:'RISK-1', themeId:'THEME-1', type, description:'documented risk',
  severity:'documented severity', probability, evidenceIds:['EV-1'], provenance:[p],
  truthState:'VERIFIED' as const, methodologyVersion:'TRE-1.0' as const,
});

test('TRE-001 validates all risk exposure types',()=>{
  for (const type of ['DEMAND','SUPPLY','PRICING','MARGIN','TECHNOLOGY','REGULATORY','TRADE','CAPITAL','EXECUTION','COMPETITIVE','SUBSTITUTION'] as const)
    assert.deepEqual(validateThemeRisk(risk(type)),[]);
});

test('TRE-002 separates risk exposure from negative catalysts',()=>{
  assert.equal(riskExposureIsNegativeCatalyst(),false);
});

test('TRE-003 keeps severity and probability separate',()=>{
  assert.deepEqual(validateThemeRisk(risk('DEMAND',null)),[]);
  assert.deepEqual(validateThemeRisk(risk('DEMAND','documented probability')),[]);
  assert.equal(unsupportedProbabilityIsFabricated(),true);
});

test('TRE-004 risk does not automatically alter Stock Score or OCE',()=>{
  assert.equal(riskAutomaticallyAltersStockScore(),false);
  assert.equal(riskAutomaticallyAltersOCE(),false);
});

test('TRE-005 evidence and provenance are required',()=>{
  assert.ok(validateThemeRisk({...risk('SUPPLY'),evidenceIds:[]}).length>0);
  assert.ok(validateThemeRisk({...risk('SUPPLY'),provenance:[]}).length>0);
});
