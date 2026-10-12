import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThemeEvidence,
  isIndependentConfirmation,
  preserveConflict,
  hasIndependentEvidence,
  hasCompleteEvidenceChain,
} from '../backend/src/theme/themeEvidence.ts';

const provenance = {
  source:'evidence-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};
const evidence=(id:string,type:'PRIMARY'|'INDEPENDENT_SECONDARY'|'DERIVED'|'DUPLICATIVE'|'UNKNOWN'='PRIMARY',truthState:'VERIFIED'|'REVIEW'|'CONFLICT'|'UNKNOWN'='VERIFIED')=>({
  evidenceId:id,
  claim:'Theme demand is expanding',
  source:'Source '+id,
  date:'2026-09-26',
  provenance,
  level:'SUPPORTED' as const,
  type,
  nature:'REPORTED' as const,
  truthState,
  methodologyVersion:'TEE-1.0' as const,
});

test('TEE-001 enforces CLAIM → EVIDENCE → SOURCE → DATE → PROVENANCE → TRUTH STATE',()=>{
  assert.deepEqual(validateThemeEvidence(evidence('E1')),[]);
  assert.ok(validateThemeEvidence({...evidence('E2'),claim:''}).length>0);
  assert.ok(validateThemeEvidence({...evidence('E3'),source:''}).length>0);
});

test('TEE-002 recognizes evidence levels without inventing a scoring system',()=>{
  for (const level of ['CONFIRMED','SUPPORTED','INDICATED','UNKNOWN'] as const) {
    assert.deepEqual(validateThemeEvidence({...evidence('E-'+level),level}),[]);
  }
});

test('TEE-003 preserves evidence type and nature distinctions',()=>{
  assert.equal(isIndependentConfirmation(evidence('E1','PRIMARY')),true);
  assert.equal(isIndependentConfirmation(evidence('E2','INDEPENDENT_SECONDARY')),true);
  assert.equal(isIndependentConfirmation(evidence('E3','DERIVED')),false);
  assert.equal(isIndependentConfirmation(evidence('E4','DUPLICATIVE')),false);
  assert.equal(isIndependentConfirmation(evidence('E5','UNKNOWN')),false);
});

test('TEE-004 copied/duplicative evidence is not counted as independent confirmation',()=>{
  assert.equal(hasIndependentEvidence([evidence('E1','PRIMARY'),evidence('E2','DUPLICATIVE')]),false);
  assert.equal(hasIndependentEvidence([evidence('E1','PRIMARY'),evidence('E2','INDEPENDENT_SECONDARY')]),true);
});

test('TEE-005 conflicts are preserved as REVIEW/CONFLICT, not silently overwritten',()=>{
  assert.equal(preserveConflict([evidence('E1','PRIMARY','CONFLICT')]),true);
});

test('TEE-006 complete evidence chain is explicit',()=>{
  assert.equal(hasCompleteEvidenceChain(evidence('E1')),true);
  assert.equal(hasCompleteEvidenceChain({...evidence('E2'),claim:''}),false);
});
