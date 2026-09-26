import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCompanyExposure,
  validateCompanyStockResolution,
  areCompanyAndStockDistinct,
  supportsMultipleCompanyExposures,
  supportsMultipleStocks,
  isStockScoreInputRelationship,
} from '../backend/src/theme/companyStockResolution.ts';

const p = {
  source:'cmsre-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const exposure=(id:string,stage:string,state:'CURRENT_OPERATING'|'PLANNED'|'UNDER_CONSTRUCTION'|'COMMISSIONED'|'RAMPING'|'EXPANSION'|'MATURE'|'EXITED/INACTIVE'='CURRENT_OPERATING')=>({
  exposureId:id, companyId:'COMP-1', valueChainStageId:stage, state,
  evidenceIds:['EV-1'], provenance:[p], methodologyVersion:'CMSRE-1.1' as const,
});
const resolution=(id:string,stock:string)=>({
  resolutionId:id, companyId:'COMP-1', stockId:stock,
  evidenceIds:['EV-2'], provenance:[p], methodologyVersion:'CMSRE-1.1' as const,
});

test('CMSRE-001 keeps Company and Stock distinct',()=>{
  assert.equal(areCompanyAndStockDistinct('COMP-1','STOCK-1'),true);
  assert.equal(areCompanyAndStockDistinct('COMP-1','COMP-1'),false);
});

test('CMSRE-002 supports multiple Value Chain exposures and explicit lifecycle states',()=>{
  assert.deepEqual(validateCompanyExposure(exposure('E1','VC1','CURRENT_OPERATING')),[]);
  assert.deepEqual(validateCompanyExposure(exposure('E2','VC2','PLANNED')),[]);
  assert.equal(supportsMultipleCompanyExposures([exposure('E1','VC1'),exposure('E2','VC2')]),true);
});

test('CMSRE-003 supports multiple Stock instruments for one Company',()=>{
  assert.deepEqual(validateCompanyStockResolution(resolution('R1','STOCK-1')),[]);
  assert.deepEqual(validateCompanyStockResolution(resolution('R2','STOCK-2')),[]);
  assert.equal(supportsMultipleStocks([resolution('R1','STOCK-1'),resolution('R2','STOCK-2')]),true);
});

test('CMSRE-004 operating peers and benchmarks are distinct from Stock Score input',()=>{
  assert.equal(isStockScoreInputRelationship('OPERATING_PEER'),false);
  assert.equal(isStockScoreInputRelationship('STRATEGIC_BENCHMARK'),false);
  assert.equal(isStockScoreInputRelationship('INDUSTRY_BENCHMARK'),false);
  assert.equal(isStockScoreInputRelationship('VALUE_CHAIN_PARTICIPANT'),true);
});

test('CMSRE-005 missing evidence/provenance is rejected',()=>{
  const bad={...resolution('R1','STOCK-1'),evidenceIds:[],provenance:[]};
  assert.ok(validateCompanyStockResolution(bad).length>0);
});
