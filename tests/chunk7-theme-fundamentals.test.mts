import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateThemeFundamentalObservation,
  isCompanyMetricAutomaticallyThemeLevel,
  createsUniversalThemeScore,
} from '../backend/src/theme/themeFundamentals.ts';

const p = {
  source:'tfi-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const observation=(dimension:'DEMAND'|'REVENUE_POOL'|'MARGIN_ECONOMICS'|'CAPITAL_INTENSITY'|'RETURN_ECONOMICS'|'CASH_FLOW_ECONOMICS'|'PRICING_POWER'|'THEME_NATURE'|'CYCLE_INTELLIGENCE')=>({
  observationId:'TFI-1',
  themeId:'THEME-1',
  dimension,
  value:'documented observation',
  unit:null,
  evidenceIds:['EV-1'],
  provenance:[p],
  methodologyVersion:'TFI-1.0' as const,
});

test('TFI-001 validates Theme-level fundamental dimensions',()=>{
  for (const d of ['DEMAND','REVENUE_POOL','MARGIN_ECONOMICS','CAPITAL_INTENSITY','RETURN_ECONOMICS','CASH_FLOW_ECONOMICS','PRICING_POWER','THEME_NATURE','CYCLE_INTELLIGENCE'] as const) {
    assert.deepEqual(validateThemeFundamentalObservation(observation(d)),[]);
  }
});

test('TFI-002 requires evidence and provenance',()=>{
  assert.ok(validateThemeFundamentalObservation({...observation('DEMAND'),evidenceIds:[]}).length>0);
  assert.ok(validateThemeFundamentalObservation({...observation('DEMAND'),provenance:[]}).length>0);
});

test('TFI-003 company ROE/ROCE are not automatically Theme-level metrics',()=>{
  assert.equal(isCompanyMetricAutomaticallyThemeLevel('ROE'),true);
  assert.equal(isCompanyMetricAutomaticallyThemeLevel('ROCE'),true);
});

test('TFI-004 no universal Theme Score is created',()=>{
  assert.equal(createsUniversalThemeScore(),false);
});
