import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEbiInputMetric } from '../backend/src/ebi/inputContract.ts';
import { rejectCircularDependency, validateIntegrationRef } from '../backend/src/ebi/iic.ts';
import { validateOepOutput, resolveDerivedTruthState } from '../backend/src/ebi/oep.ts';

const base={
  metric:'PAT',value:100,periodType:'YEAR' as const,periodStart:'2025-04-01',
  periodEnd:'2026-03-31',reportedDate:'2026-05-01',
  classification:'REPORTED' as const,
  provenance:{source:'x',sourceTimestamp:1,verificationStatus:'VERIFIED' as const,dataNature:'RAW' as const,formulaVersion:null},
  restatementId:null,supersedesRestatementId:null
};

test('EBI input contract preserves reported/raw provenance',()=>assert.deepEqual(validateEbiInputMetric(base),[]));
test('EBI input rejects reported data marked derived',()=>assert.ok(validateEbiInputMetric({...base,provenance:{...base.provenance,dataNature:'DERIVED'}}).length>0));
test('IIC allows data-only version-pinned integration',()=>assert.deepEqual(validateIntegrationRef({consumer:'ROTATION',methodologyVersion:'ROT-v1.3',authority:'DATA_ONLY'}),[]));
test('IIC rejects missing version and non-data authority',()=>assert.equal(validateIntegrationRef({consumer:'THEME',methodologyVersion:'',authority:'DATA_ONLY'}).length,1));
test('IIC detects repeated dependency in a path',()=>assert.equal(rejectCircularDependency(['ROTATION','THEME','ROTATION']),true));
test('OEP requires an authoritative CHUNK 0 truth state',()=> {
  const baseOutput={title:'PAT',primaryOutput:'100',keyEvidence:['source'],trendDirection:null,confidence:null,dataCoverage:80,source:'x',lastUpdated:'2026-09-26'};
  assert.deepEqual(validateOepOutput({...baseOutput,truthState:'VERIFIED'}),[]);
  assert.ok(validateOepOutput({...baseOutput,truthState:'COMPUTABLE'}).includes('truthState is not an authoritative CHUNK 0 truth state'));
});

test('C5-007 derived truth state cannot be stronger than weakest input',()=> {
  assert.equal(resolveDerivedTruthState(['LIVE','VERIFIED','STALE']),'STALE');
  assert.equal(resolveDerivedTruthState(['VERIFIED','UNAVAILABLE']),'UNAVAILABLE');
});
