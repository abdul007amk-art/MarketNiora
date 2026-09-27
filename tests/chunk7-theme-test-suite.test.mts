import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TIE_TEST_METHODOLOGY_VERSION,validateThemeTestFixture,
  rotationChangeMustNotChangeThemeIntelligence,stockScoreChangeMustNotChangeThemeIntelligence,
  oceChangeMustNotChangeThemeIntelligence,shariahChangeMustNotChangeThemeIntelligence,
  themeChangeMustNotChangeStockScoreOrRotation,isPOCLRepresentativeFixture,
} from '../backend/src/theme/themeTestSuite.ts';

const p={source:'tie-test-source-1',sourceTimestamp:1700000000,verificationStatus:'VERIFIED' as const,dataNature:'RAW' as const,formulaVersion:null};
const fixture={fixtureId:'POCL',hierarchy:['THEME','SUB_THEME','INDUSTRY','VALUE_CHAIN','COMPANY','STOCK'],valueChainStages:['STAGE-1'],currentExposureIds:['CURRENT-1'],futureExposureIds:['FUTURE-1'],companyIds:['COMP-1'],stockIds:['STK-1'],relationshipIds:['REL-1'],evidenceIds:['EV-1'],provenance:[p],methodologyVersions:['TIE-TEST-1.0']};

test('TIE-TEST-001 validates the representative POCL fixture contract',()=>{
  assert.equal(TIE_TEST_METHODOLOGY_VERSION,'TIE-TEST-1.0');
  assert.equal(isPOCLRepresentativeFixture(fixture),true);
  assert.deepEqual(validateThemeTestFixture(fixture),[]);
});
test('TIE-TEST-002 enforces Theme hierarchy and current/future separation',()=>{
  assert.equal(fixture.hierarchy.join('→'),'THEME→SUB_THEME→INDUSTRY→VALUE_CHAIN→COMPANY→STOCK');
  assert.notDeepEqual(fixture.currentExposureIds,fixture.futureExposureIds);
});
test('TIE-TEST-003 independence executes the supplied builders',()=>{
  const buildTheme=({rotation}:{rotation:{value:number}})=>({theme:'stable'});
  const buildThemeScore=({stockScore}:{stockScore:{value:number}})=>({theme:'stable'});
  const buildThemeOce=({oce}:{oce:{value:number}})=>({theme:'stable'});
  const buildThemeShariah=({shariah}:{shariah:{value:number}})=>({theme:'stable'});
  const buildThemeUsingRotation=({rotation}:{rotation:{value:number}})=>({theme:rotation.value});
  assert.equal(rotationChangeMustNotChangeThemeIntelligence(buildTheme,{value:1},{value:2}),true);
  assert.equal(stockScoreChangeMustNotChangeThemeIntelligence(buildThemeScore,{value:1},{value:2}),true);
  assert.equal(oceChangeMustNotChangeThemeIntelligence(buildThemeOce,{value:1},{value:2}),true);
  assert.equal(shariahChangeMustNotChangeThemeIntelligence(buildThemeShariah,{value:1},{value:2}),true);
  assert.equal(rotationChangeMustNotChangeThemeIntelligence(buildThemeUsingRotation,{value:1},{value:2}),false);
  const buildExternal=({theme}:{theme:{value:number}})=>({score:0});
  assert.equal(themeChangeMustNotChangeStockScoreOrRotation(buildExternal,{value:1},{value:2}),true);
});
test('TIE-TEST-004 missing provenance is rejected',()=>{assert.ok(validateThemeTestFixture({...fixture,provenance:[]}).length>0);});
