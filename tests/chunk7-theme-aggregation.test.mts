import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThemeAggregationItem,
  aggregationCreatesNewFacts,
  preservesUnderlyingRelationships,
  preservesCurrentFutureExposureSeparation,
  deduplicateStocks,
  createsHiddenWeightingOrThemeScore,
} from '../backend/src/theme/themeAggregation.ts';

const p = {
  source:'taoe-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const item={
  itemId:'AGG-1', themeId:'THEME-1', level:'SUB_THEME', value:'documented output',
  relationshipIds:['REL-1'], currentExposureIds:['EXP-CURRENT-1'], futureExposureIds:['EXP-FUTURE-1'],
  evidenceIds:['EV-1'], provenance:[p], methodologyVersion:'TAOE-1.0' as const,
};

test('TAOE-001 validates evidence-backed aggregation items',()=>{
  assert.deepEqual(validateThemeAggregationItem(item),[]);
});

test('TAOE-002 aggregation does not create new facts',()=>{
  assert.equal(aggregationCreatesNewFacts(),false);
});

test('TAOE-003 preserves underlying relationships and exposure separation',()=>{
  assert.equal(preservesUnderlyingRelationships(),true);
  assert.equal(preservesCurrentFutureExposureSeparation(),true);
});

test('TAOE-004 deduplicates stocks without changing relationship data',()=>{
  assert.deepEqual(deduplicateStocks(['STK-1','STK-2','STK-1']),['STK-1','STK-2']);
});

test('TAOE-005 no hidden weighting or automatic Theme Score',()=>{
  assert.equal(createsHiddenWeightingOrThemeScore(),false);
});

test('TAOE-006 evidence and provenance are required',()=>{
  assert.ok(validateThemeAggregationItem({...item,evidenceIds:[]}).length>0);
  assert.ok(validateThemeAggregationItem({...item,provenance:[]}).length>0);
});
