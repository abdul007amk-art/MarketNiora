import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSubThemeMapping, supportsMultipleSubThemes, supportsOverlap, canDiscoverStocksFromSubTheme, validateSubThemeDiscovery, isRotationSectorOrSubSectorLabel } from '../backend/src/theme/subThemeMapping.ts';

const p = { source:'theme-source-1', sourceTimestamp:1700000000, verificationStatus:'VERIFIED' as const, dataNature:'RAW' as const, formulaVersion:null };

function mapping(id:string, sub:string, relationship:'PRIMARY'|'SECONDARY'|'OVERLAPPING'|'ENABLING'|'BENEFICIARY'|'UNKNOWN'='PRIMARY'){
  return {mappingId:id,themeNodeId:'THEME-1',subThemeId:sub,relationship,evidenceIds:['EV1'],provenance:[p],methodologyVersion:'STM-1.0' as const};
}

test('STM-001 maps Sub-Theme to Theme with parent context',()=>{
  assert.deepEqual(validateSubThemeMapping(mapping('M1','ST1')),[]);
  assert.ok(validateSubThemeMapping(mapping('M2','')).length>0);
});

test('STM-002 supports multiple Sub-Themes under one Theme',()=>{
  const mappings=[mapping('M1','ST1'),mapping('M2','ST2')];
  assert.equal(supportsMultipleSubThemes(mappings),true);
});

test('STM-003 preserves overlap and relationship types',()=>{
  const mappings=[mapping('M1','ST1','OVERLAPPING'),mapping('M2','ST2','BENEFICIARY')];
  assert.equal(supportsOverlap(mappings),true);
  assert.deepEqual(validateSubThemeMapping(mappings[0]),[]);
});

test('STM-004 Sub-Theme stock discovery does not require Industry selection',()=>{
  assert.equal(canDiscoverStocksFromSubTheme('ST1'),true);
  assert.deepEqual(validateSubThemeDiscovery('ST1',null),[]);
});

test('STM-005 insufficient/unsupported segmentation is not forced into Rotation labels',()=>{
  assert.equal(isRotationSectorOrSubSectorLabel('SECTOR'),true);
  assert.equal(isRotationSectorOrSubSectorLabel('SUB-SECTOR'),true);
  assert.ok(validateSubThemeDiscovery('',null).length>0);
});
