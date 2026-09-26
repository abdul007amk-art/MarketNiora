import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateIndustryMapping,
  supportsMultipleIndustryRelationships,
  canDiscoverStocksFromIndustry,
  isMarketRotationSectorLabel,
  validateIndustryEvidence,
} from '../backend/src/theme/industryMapping.ts';

const p = {
  source:'industry-source-1',
  sourceTimestamp:1700000000,
  verificationStatus:'VERIFIED' as const,
  dataNature:'RAW' as const,
  formulaVersion:null,
};
const mapping = (id:string, industry:string, relationship:'PRIMARY'|'SECONDARY'|'OVERLAPPING'|'ENABLING'|'BENEFICIARY'|'UNKNOWN'='PRIMARY') => ({
  mappingId:id,
  subThemeId:'ST-1',
  industryId:industry,
  relationship,
  evidenceIds:['EV-1'],
  provenance:[p],
  methodologyVersion:'IME-1.0',
});

test('IME-001 maps Sub-Theme to Industry with evidence and parent context', () => {
  assert.deepEqual(validateIndustryMapping(mapping('M1','IND-1')), []);
  assert.ok(validateIndustryMapping(mapping('M2','')).length > 0);
});

test('IME-002 supports multiple Industry relationships', () => {
  assert.equal(supportsMultipleIndustryRelationships([
    mapping('M1','IND-1'),
    mapping('M2','IND-2','OVERLAPPING'),
  ]), true);
});

test('IME-003 Industry stock discovery does not require downstream levels', () => {
  assert.equal(canDiscoverStocksFromIndustry('IND-1'), true);
});

test('IME-004 Theme Industry remains distinct from Market Rotation Sector/Sub-Sector', () => {
  assert.equal(isMarketRotationSectorLabel('SECTOR'), true);
  assert.equal(isMarketRotationSectorLabel('SUB-SECTOR'), true);
  assert.equal(isMarketRotationSectorLabel('INDUSTRY'), false);
});

test('IME-005 missing evidence does not create a forced mapping', () => {
  assert.ok(validateIndustryEvidence([]).length > 0);
});

test('IME-006 invalid provenance is rejected', () => {
  const bad = {...mapping('M1','IND-1'), provenance:[{...p, source:''}]};
  assert.ok(validateIndustryMapping(bad).length > 0);
});
