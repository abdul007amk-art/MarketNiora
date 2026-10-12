import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThemeCatalyst,
  catalystStrengthIsProbability,
  catalystAutomaticallyAltersStockScore,
  catalystAutomaticallyAltersRotation,
} from '../backend/src/theme/themeCatalyst.ts';

const p = {
  source:'tce-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const catalyst=(type:'POLICY'|'TECHNOLOGY'|'CAPACITY_CAPEX'|'DEMAND'|'SUPPLY'|'CORPORATE_STRATEGIC'|'TRADE_GEOPOLITICAL'|'REGULATORY',
 lifecycle:'IDENTIFIED'|'VALIDATED'|'DEVELOPING'|'ACTIVE'|'REALISING'|'COMPLETED'|'DELAYED'|'INVALIDATED'|'CANCELLED'='IDENTIFIED')=>({
  catalystId:'CAT-1', themeId:'THEME-1', type, description:'documented catalyst',
  lifecycle, strength:'documented strength', evidenceIds:['EV-1'], provenance:[p],
  methodologyVersion:'TCE-1.0' as const,
});

test('TCE-001 validates catalyst types and lifecycle states',()=>{
  for (const type of ['POLICY','TECHNOLOGY','CAPACITY_CAPEX','DEMAND','SUPPLY','CORPORATE_STRATEGIC','TRADE_GEOPOLITICAL','REGULATORY'] as const)
    assert.deepEqual(validateThemeCatalyst(catalyst(type)),[]);
  for (const lifecycle of ['IDENTIFIED','VALIDATED','DEVELOPING','ACTIVE','REALISING','COMPLETED','DELAYED','INVALIDATED','CANCELLED'] as const)
    assert.deepEqual(validateThemeCatalyst(catalyst('POLICY',lifecycle)),[]);
});

test('TCE-002 catalyst strength is not probability',()=>{
  assert.equal(catalystStrengthIsProbability(),false);
});

test('TCE-003 catalyst does not automatically alter Stock Score or Rotation',()=>{
  assert.equal(catalystAutomaticallyAltersStockScore(),false);
  assert.equal(catalystAutomaticallyAltersRotation(),false);
});

test('TCE-004 evidence and provenance are required',()=>{
  assert.ok(validateThemeCatalyst({...catalyst('DEMAND'),evidenceIds:[]}).length>0);
  assert.ok(validateThemeCatalyst({...catalyst('DEMAND'),provenance:[]}).length>0);
});
