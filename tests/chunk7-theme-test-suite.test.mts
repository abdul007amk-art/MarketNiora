import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIE_TEST_METHODOLOGY_VERSION,
  validateThemeTestFixture,
  rotationChangeMustNotChangeThemeIntelligence,
  stockScoreChangeMustNotChangeThemeIntelligence,
  oceChangeMustNotChangeThemeIntelligence,
  shariahChangeMustNotChangeThemeIntelligence,
  themeChangeMustNotChangeStockScoreOrRotation,
  isPOCLRepresentativeFixture,
} from '../backend/src/theme/themeTestSuite.ts';

const p = {
  source:'tie-test-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

test('TIE-TEST-001 validates the representative POCL fixture contract',()=>{
  assert.equal(TIE_TEST_METHODOLOGY_VERSION,'TIE-TEST-1.0');
  assert.equal(isPOCLRepresentativeFixture('POCL'),true);
  assert.deepEqual(validateThemeTestFixture({
    fixtureId:'POCL',
    hierarchy:['THEME','SUB_THEME','INDUSTRY','VALUE_CHAIN','COMPANY','STOCK'],
    valueChainStages:['STAGE-1'],
    currentExposureIds:['CURRENT-1'],
    futureExposureIds:['FUTURE-1'],
    companyIds:['COMP-1'],
    stockIds:['STK-1'],
    relationshipIds:['REL-1'],
    evidenceIds:['EV-1'],
    provenance:[p],
    methodologyVersions:['THEME-INPUT-1.1','TIE-ID-1.0','STM-1.0','IME-1.0','VCM-1.0','CMSRE-1.1','TEE-1.0','TFI-1.0','TGDE-1.0','TSDE-1.0','TCE-1.0','TRE-1.0','TSCE-1.0','TLAE-1.0','TAOE-1.0','STRIE-1.0','TIE-TEST-1.0'],
  }),[]);
});

test('TIE-TEST-002 enforces Theme hierarchy and current/future separation coverage',()=>{
  const fixture={
    fixtureId:'POCL', hierarchy:['THEME','SUB_THEME','INDUSTRY','VALUE_CHAIN','COMPANY','STOCK'],
    valueChainStages:['STAGE-1'], currentExposureIds:['CURRENT-1'], futureExposureIds:['FUTURE-1'],
    companyIds:['COMP-1'], stockIds:['STK-1'], relationshipIds:['REL-1'], evidenceIds:['EV-1'],
    provenance:[p], methodologyVersions:['TIE-TEST-1.0'],
  };
  assert.equal(fixture.hierarchy.join('→'),'THEME→SUB_THEME→INDUSTRY→VALUE_CHAIN→COMPANY→STOCK');
  assert.notDeepEqual(fixture.currentExposureIds,fixture.futureExposureIds);
});

test('TIE-TEST-003 verifies independence boundaries',()=>{
  assert.equal(rotationChangeMustNotChangeThemeIntelligence(),true);
  assert.equal(stockScoreChangeMustNotChangeThemeIntelligence(),true);
  assert.equal(oceChangeMustNotChangeThemeIntelligence(),true);
  assert.equal(shariahChangeMustNotChangeThemeIntelligence(),true);
  assert.equal(themeChangeMustNotChangeStockScoreOrRotation(),true);
});

test('TIE-TEST-004 missing provenance is rejected',()=>{
  assert.ok(validateThemeTestFixture({
    fixtureId:'POCL', hierarchy:['THEME'], valueChainStages:[], currentExposureIds:[],
    futureExposureIds:[], companyIds:[], stockIds:[], relationshipIds:[], evidenceIds:[],
    provenance:[], methodologyVersions:['TIE-TEST-1.0'],
  }).length>0);
});
