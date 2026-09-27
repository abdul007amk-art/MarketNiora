import test from 'node:test';
import assert from 'node:assert/strict';
import { validateThemeNode,validateThemeParentContext,validateThemeExposure } from '../backend/src/theme/inputContract.ts';
import { assertNoFabricatedParentContext,canRetrieveStocksAtLevel,validateNavigationScope,validateResolvedNavigationScope } from '../backend/src/theme/navigation.ts';
const p={source:'source-1',sourceTimestamp:1700000000,verificationStatus:'VERIFIED' as const,dataNature:'RAW' as const,formulaVersion:null};
const node=(nodeId:string,level:'THEME'|'SUB_THEME'|'INDUSTRY'|'VALUE_CHAIN'|'COMPANY',parentNodeId:string|null)=>({nodeId,level,name:nodeId,parentNodeId,methodologyVersion:'THEME-INPUT-1.1' as const});

test('T7-001 canonical Theme hierarchy is enforced',()=>{
 assert.deepEqual(validateThemeNode(node('T1','THEME',null)),[]);
 assert.deepEqual(validateThemeNode(node('S1','SUB_THEME','T1')),[]);
 assert.ok(validateThemeNode(node('S2','SUB_THEME',null)).length>0);
});
test('T7-002 lower-level navigation requires resolved parent chain',()=>{
 const resolved=new Map([['T1',node('T1','THEME',null)],['S1',node('S1','SUB_THEME','T1')],['I1',node('I1','INDUSTRY','S1')],['V1',node('V1','VALUE_CHAIN','I1')]]);
 assert.deepEqual(validateResolvedNavigationScope('VALUE_CHAIN','V1',resolved),[]);
 assert.ok(validateResolvedNavigationScope('VALUE_CHAIN','V2',resolved).length>0);
 assert.ok(validateResolvedNavigationScope('VALUE_CHAIN','V1',new Map([...resolved].filter(([id])=>id!=='I1'))).length>0);
 assert.deepEqual(validateThemeParentContext('INDUSTRY','SUB_THEME','S1'),[]);
 assert.ok(validateThemeParentContext('INDUSTRY','THEME','T1').length>0);
 assert.ok(validateThemeParentContext('VALUE_CHAIN','INDUSTRY',null).length>0);
 assert.equal(assertNoFabricatedParentContext('VALUE_CHAIN',['T1','S1','I1']).length,0);
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
