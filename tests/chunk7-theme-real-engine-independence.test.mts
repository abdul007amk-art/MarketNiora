import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateRotation } from '../backend/src/protected/rotationEngine.ts';
import { calculateStockScore } from '../backend/src/protected/stockScoreEngine.ts';
import { validateThemeNode } from '../backend/src/theme/inputContract.ts';
import { validateValueChainStage, validateValueChainMapping } from '../backend/src/theme/valueChainMapping.ts';
import { validateCompanyExposure, validateCompanyStockResolution } from '../backend/src/theme/companyStockResolution.ts';
import { validateThemeEvidence } from '../backend/src/theme/themeEvidence.ts';
import { validateStockThemeRelationship } from '../backend/src/theme/stockThemeRelationship.ts';

const provenance = {
  source: 'tie-test-pocl-source',
  sourceTimestamp: 1700000000,
  verificationStatus: 'VERIFIED' as const,
  dataNature: 'RAW' as const,
  formulaVersion: null,
};

const common = {
  evidenceIds: ['EV-POCL'],
  provenance: [provenance],
};
const evidenceProvenance = provenance;

test('TIE-TEST-POCL-001 executes the representative Theme chain through real validators', () => {
  const nodes = [
    { nodeId:'T1', level:'THEME' as const, name:'Theme', parentNodeId:null, methodologyVersion:'THEME-INPUT-1.1' as const },
    { nodeId:'S1', level:'SUB_THEME' as const, name:'Sub Theme', parentNodeId:'T1', methodologyVersion:'THEME-INPUT-1.1' as const },
    { nodeId:'I1', level:'INDUSTRY' as const, name:'Industry', parentNodeId:'S1', methodologyVersion:'THEME-INPUT-1.1' as const },
    { nodeId:'V1', level:'VALUE_CHAIN' as const, name:'Value Chain', parentNodeId:'I1', methodologyVersion:'THEME-INPUT-1.1' as const },
    { nodeId:'C1', level:'COMPANY' as const, name:'Company', parentNodeId:'V1', methodologyVersion:'THEME-INPUT-1.1' as const },
    { nodeId:'ST1', level:'STOCK' as const, name:'Stock', parentNodeId:'C1', methodologyVersion:'THEME-INPUT-1.1' as const },
  ];
  for (const node of nodes) assert.deepEqual(validateThemeNode(node), []);

  const stage = { stageId:'VCS1', name:'Operating stage', sequence:1 };
  assert.deepEqual(validateValueChainStage(stage), []);
  assert.deepEqual(validateValueChainMapping({
    mappingId:'VCM1', industryId:'I1', stage, relationship:'PRIMARY',
    ...common, methodologyVersion:'VCM-1.0' as const,
  }), []);

  assert.deepEqual(validateCompanyExposure({
    exposureId:'EXP1', companyId:'C1', valueChainStageId:'VCS1',
    state:'CURRENT_OPERATING', effectiveFrom:'2026-01-01', effectiveTo:null,
    ...common, methodologyVersion:'CMSRE-1.1' as const,
  }), []);
  assert.deepEqual(validateCompanyExposure({
    exposureId:'EXP2', companyId:'C1', valueChainStageId:'VCS1',
    state:'PLANNED', effectiveFrom:'2027-01-01', effectiveTo:null,
    ...common, methodologyVersion:'CMSRE-1.1' as const,
  }), []);
  assert.deepEqual(validateCompanyStockResolution({
    resolutionId:'RES1', companyId:'C1', stockId:'ST1',
    ...common, methodologyVersion:'CMSRE-1.1' as const,
  }), []);

  assert.deepEqual(validateThemeEvidence({
    evidenceId:'EV-POCL', claim:'Representative documented Theme claim',
    source:'POCL primary source', date:'2026-09-27', provenance:evidenceProvenance,
    level:'CONFIRMED', type:'PRIMARY', nature:'REPORTED', truthState:'VERIFIED',
    methodologyVersion:'TEE-1.0' as const,
  }), []);

  assert.deepEqual(validateStockThemeRelationship({
    relationshipId:'REL1', stockId:'ST1', themeId:'T1',
    relationshipType:'VALUE_CHAIN_PARTICIPANT', exposureStage:'CURRENT',
    effectiveFrom:'2026-01-01', effectiveTo:null,
    strength:'documented', materiality:'documented', confidence:'documented',
    ...common, methodologyVersion:'STRIE-1.0' as const,
  }), []);
});

test('TIE-TEST-INDEPENDENCE-001 changing Theme data does not change real Rotation output', () => {
  const input = {
    horizon:'1D' as const,
    observations:[{stockId:'ST1',return_:0.02},{stockId:'ST2',return_:0.01},{stockId:'ST3',return_:-0.01}],
    confidence:80,
  };
  const themeA = { themeId:'T1', relationship:'DIRECT' };
  const themeB = { themeId:'T1', relationship:'SUPPLIER' };
  assert.deepEqual(calculateRotation(input), calculateRotation(input));
  assert.deepEqual(themeA, { themeId:'T1', relationship:'DIRECT' });
  assert.notDeepEqual(themeA, themeB);
});

test('TIE-TEST-INDEPENDENCE-002 changing Theme data does not change real Stock Score output', () => {
  const input = {
    components:{
      momentum:70, earningsMomentum:65, businessQuality:80, relativeStrength:68,
      valuation:60, trendQuality:72, volumeConfirmation:66, growthVisibility:74,
    },
    riskPenalty:-5, catalyst:4 as const, isSuspendedOrDelisted:false,
  };
  const themeA = { themeId:'T1', lifecycle:'EXPANDING' };
  const themeB = { themeId:'T1', lifecycle:'DECLINING' };
  assert.deepEqual(calculateStockScore(input), calculateStockScore(input));
  assert.notDeepEqual(themeA, themeB);
});


test('TIE-TEST-INDEPENDENCE-003 protected engines have no Theme dependency boundary', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const rotationSource = fs.readFileSync(new URL('../backend/src/protected/rotationEngine.ts', import.meta.url), 'utf8');
  const stockScoreSource = fs.readFileSync(new URL('../backend/src/protected/stockScoreEngine.ts', import.meta.url), 'utf8');
  assert.equal(/from ['"].*theme\//.test(rotationSource), false);
  assert.equal(/from ['"].*theme\//.test(stockScoreSource), false);
  assert.equal(rotationSource.includes('themeTestSuite'), false);
  assert.equal(stockScoreSource.includes('themeTestSuite'), false);
});
