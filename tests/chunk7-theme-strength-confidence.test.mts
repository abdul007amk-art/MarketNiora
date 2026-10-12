import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThemeStrengthConfidence,
  confidenceIsProbability,
  createsAutomaticWeightedThemeScore,
  redistributesMissingComponentsAutomatically,
} from '../backend/src/theme/themeStrengthConfidence.ts';

const p = {
  source:'tsce-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const value={
  themeId:'THEME-1',
  themeStrength:'documented strength',
  evidenceQuality:'documented quality',
  coverage:'documented coverage',
  confidence:'documented confidence',
  evidenceIds:['EV-1'],
  provenance:[p],
  methodologyVersion:'TSCE-1.0' as const,
};

test('TSCE-001 keeps strength, evidence quality, coverage and confidence separate',()=>{
  assert.deepEqual(validateThemeStrengthConfidence(value),[]);
  assert.notEqual(value.themeStrength,value.evidenceQuality);
  assert.notEqual(value.coverage,value.confidence);
});

test('TSCE-002 confidence is not probability',()=>{
  assert.equal(confidenceIsProbability(),false);
});

test('TSCE-003 no automatic weighted Theme Score',()=>{
  assert.equal(createsAutomaticWeightedThemeScore(),false);
});

test('TSCE-004 missing components are not silently weight-redistributed',()=>{
  assert.equal(redistributesMissingComponentsAutomatically(),false);
});

test('TSCE-005 evidence and provenance are required',()=>{
  assert.ok(validateThemeStrengthConfidence({...value,evidenceIds:[]}).length>0);
  assert.ok(validateThemeStrengthConfidence({...value,provenance:[]}).length>0);
});
