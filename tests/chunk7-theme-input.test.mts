import test from 'node:test';
import assert from 'node:assert/strict';
import { validateThemeNode,validateThemeParentContext,validateThemeExposure } from '../backend/src/theme/inputContract.ts';
import { assertNoFabricatedParentContext,canRetrieveStocksAtLevel,validateNavigationScope } from '../backend/src/theme/navigation.ts';
const p={source:'source-1',sourceTimestamp:1700000000,verificationStatus:'VERIFIED' as const,dataNature:'RAW' as const,formulaVersion:null};
test('T7-001 canonical Theme hierarchy is enforced',()=>{
 assert.deepEqual(validateThemeNode({nodeId:'T1',level:'THEME',name:'Theme',parentNodeId:null,methodologyVersion:'THEME-INPUT-1.1'}),[]);
 assert.deepEqual(validateThemeNode({nodeId:'S1',level:'SUB_THEME',name:'Sub',parentNodeId:'T1',methodologyVersion:'THEME-INPUT-1.1'}),[]);
 assert.ok(validateThemeNode({nodeId:'S2',level:'SUB_THEME',name:'Sub',parentNodeId:null,methodologyVersion:'THEME-INPUT-1.1'}).length>0);
});
test('T7-002 lower-level navigation requires valid parent context',()=>{
 assert.deepEqual(validateThemeParentContext('INDUSTRY','SUB_THEME','S1'),[]);
 assert.ok(validateThemeParentContext('INDUSTRY','THEME','T1').length>0);
 assert.ok(validateThemeParentContext('VALUE_CHAIN','INDUSTRY',null).length>0);
 assert.equal(assertNoFabricatedParentContext('VALUE_CHAIN',['T1','S1','I1']).length,0);
 assert.ok(assertNoFabricatedParentContext('VALUE_CHAIN',['T1']).length>0);
});
test('T7-003 Company is not a mandatory stock-retrieval gateway',()=>{
 assert.equal(canRetrieveStocksAtLevel('THEME'),true); assert.equal(canRetrieveStocksAtLevel('SUB_THEME'),true);
 assert.equal(canRetrieveStocksAtLevel('INDUSTRY'),true); assert.equal(canRetrieveStocksAtLevel('VALUE_CHAIN'),true);
 assert.equal(canRetrieveStocksAtLevel('COMPANY'),true); assert.deepEqual(validateNavigationScope('VALUE_CHAIN','VC1'),[]);
});
test('T7-004 many-to-many theme exposure preserves evidence/provenance',()=>{
 const base={exposureId:'E1',themeNodeId:'T1',stockId:'ST1',companyId:'C1',relationship:'DIRECT' as const,evidenceIds:['EV1'],provenance:[p],truthState:'VERIFIED' as const,methodologyVersion:'THEME-INPUT-1.1'};
 assert.deepEqual(validateThemeExposure(base),[]); assert.deepEqual(validateThemeExposure({...base,exposureId:'E2',themeNodeId:'T2',relationship:'SUPPLIER'}),[]);
});
test('T7-005 Theme input does not create an investment score',()=>{
 assert.deepEqual(validateThemeExposure({exposureId:'E1',themeNodeId:'T1',stockId:'ST1',companyId:null,relationship:'UNKNOWN',evidenceIds:['EV1'],provenance:[p],truthState:'PENDING',methodologyVersion:'THEME-INPUT-1.1'}),[]);
});
