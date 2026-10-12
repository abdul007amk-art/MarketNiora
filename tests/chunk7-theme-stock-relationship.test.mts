import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateStockThemeRelationship,
  preservesCurrentPlannedExposureSeparation,
  relationshipAttributesAreInvestmentAttractiveness,
} from '../backend/src/theme/stockThemeRelationship.ts';

const p = {
  source:'strie-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};

const relationship=(relationshipType:'DIRECT'|'INDIRECT'|'ENABLER'|'BENEFICIARY'|'SUPPLIER'|'CUSTOMER'|'INFRASTRUCTURE_PROVIDER'|'TECHNOLOGY_PROVIDER'|'VALUE_CHAIN_PARTICIPANT'|'MIXED'|'UNKNOWN', exposureStage:'CURRENT'|'PLANNED'='CURRENT')=>({
  relationshipId:'REL-1', stockId:'STK-1', themeId:'THEME-1', relationshipType,
  exposureStage, strength:'documented strength', materiality:'documented materiality',
  confidence:'documented confidence', evidenceIds:['EV-1'], provenance:[p],
  methodologyVersion:'STRIE-1.0' as const,
});

test('STRIE-001 validates all documented relationship types',()=>{
  for (const type of ['DIRECT','INDIRECT','ENABLER','BENEFICIARY','SUPPLIER','CUSTOMER','INFRASTRUCTURE_PROVIDER','TECHNOLOGY_PROVIDER','VALUE_CHAIN_PARTICIPANT','MIXED','UNKNOWN'] as const)
    assert.deepEqual(validateStockThemeRelationship(relationship(type)),[]);
});

test('STRIE-002 keeps current and planned exposure distinct',()=>{
  assert.equal(preservesCurrentPlannedExposureSeparation(relationship('DIRECT','CURRENT')),true);
  assert.equal(preservesCurrentPlannedExposureSeparation(relationship('DIRECT','PLANNED')),true);
});

test('STRIE-003 relationship attributes are not investment attractiveness',()=>{
  assert.equal(relationshipAttributesAreInvestmentAttractiveness(),false);
});

test('STRIE-004 evidence and provenance are required',()=>{
  assert.ok(validateStockThemeRelationship({...relationship('SUPPLIER'),evidenceIds:[]}).length>0);
  assert.ok(validateStockThemeRelationship({...relationship('SUPPLIER'),provenance:[]}).length>0);
});
