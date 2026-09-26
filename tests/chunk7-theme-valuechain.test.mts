import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateValueChainStage,
  validateValueChainMapping,
  supportsMultipleStages,
  canDiscoverStocksFromValueChainStage,
} from '../backend/src/theme/valueChainMapping.ts';

const provenance = {
  source:'value-chain-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const stage=(id:string,name:string,sequence:number|null=null)=>({stageId:id,name,sequence});
const mapping=(id:string,s:ReturnType<typeof stage>)=>({
  mappingId:id,
  industryId:'IND-1',
  stage:s,
  relationship:'PRIMARY' as const,
  evidenceIds:['EV-1'],
  provenance:[provenance],
  methodologyVersion:'VCM-1.0' as const,
});

test('VCM-001 models Value Chain as validated stages, not a flat chain string',()=>{
  assert.deepEqual(validateValueChainStage(stage('VC1','Refining',2)),[]);
  assert.ok(validateValueChainStage(stage('','',null)).length>0);
});

test('VCM-002 maps an Industry into a Value Chain stage with evidence',()=>{
  assert.deepEqual(validateValueChainMapping(mapping('M1',stage('VC1','Refining'))),[]);
});

test('VCM-003 supports multiple stages without forcing one stage per Company/Industry',()=>{
  assert.equal(supportsMultipleStages([
    stage('VC1','Recycling/Smelting',1),
    stage('VC2','Refining',2),
    stage('VC3','Alloy/Finished Product',3),
  ]),true);
});

test('VCM-004 stock discovery can stop at Value Chain Stage',()=>{
  assert.equal(canDiscoverStocksFromValueChainStage('VC2'),true);
});

test('VCM-005 invalid provenance/evidence is rejected',()=>{
  const bad={...mapping('M1',stage('VC1','Refining')),evidenceIds:[],provenance:[{...provenance,source:''}]};
  assert.ok(validateValueChainMapping(bad).length>0);
});

test('VCM-006 sequence must be deterministic when supplied',()=>{
  assert.ok(validateValueChainStage(stage('VC1','Refining',-1)).length>0);
  assert.ok(validateValueChainStage(stage('VC1','Refining',null)).length===0);
});
