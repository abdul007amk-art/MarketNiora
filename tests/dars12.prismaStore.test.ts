const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaDarsEvidenceStore } = require('../backend/src/dars12/prismaDarsEvidenceStore.ts');

const evidence = (o={}) => ({
  evidenceKey:'SOURCE_A|AAA', sourceEventId:'evt-1', source:'SOURCE_A', symbol:'AAA', value:'1.25',
  sourceTimestamp:100, effectiveTime:100, knowledgeTime:100, verificationStatus:'VERIFIED',
  dataNature:'RAW', formulaVersion:null, refreshedAt:200, truthState:'CURRENT', ...o
});

test('PrismaDarsEvidenceStore: creates durable evidence with provenance fields', async () => {
  let row;
  const prisma = { darsEvidence: {
    findUnique: async () => null,
    create: async ({data}) => { row=data; return data; }
  }};
  const store = new PrismaDarsEvidenceStore(prisma);
  assert.equal(await store.upsertEvidence(evidence()), true);
  assert.equal(row.sourceEventId, 'evt-1');
  assert.equal(row.evidenceKey, 'SOURCE_A|AAA');
  assert.equal(row.knowledgeTime.getTime(), 100);
});

test('PrismaDarsEvidenceStore: identical source_event_id replay is idempotent', async () => {
  let row = {
    source:'SOURCE_A', symbol:'AAA', value:'1.25',
    sourceTimestamp:new Date(100), effectiveTime:new Date(100), knowledgeTime:new Date(100),
    verificationStatus:'VERIFIED', dataNature:'RAW', formulaVersion:null, origin:null
  };
  let updated = null;
  const prisma = { darsEvidence: {
    findUnique: async () => row,
    update: async ({data}) => { updated=data; return row; }
  }};
  const store = new PrismaDarsEvidenceStore(prisma);
  assert.equal(await store.upsertEvidence(evidence()), false);
  assert.equal(updated.truthState, 'CURRENT');
  assert.equal(updated.refreshedAt.getTime(), 200);
});

test('PrismaDarsEvidenceStore: conflicting source_event_id replay is rejected', async () => {
  const prisma = { darsEvidence: {
    findUnique: async () => ({
      source:'SOURCE_A', symbol:'AAA', value:'9.99',
      sourceTimestamp:new Date(100), effectiveTime:new Date(100), knowledgeTime:new Date(100),
      verificationStatus:'VERIFIED', dataNature:'RAW', formulaVersion:null, origin:null
    })
  }};
  await assert.rejects(() => new PrismaDarsEvidenceStore(prisma).upsertEvidence(evidence()), /conflicting source_event_id replay rejected/);
});

test('PrismaDarsEvidenceStore: currentEvidence selects latest knowledge_time per evidence key', async () => {
  const prisma = { darsEvidence: {
    findMany: async () => [
      { evidenceKey:'SOURCE_A|AAA', sourceEventId:'evt-2', source:'SOURCE_A', symbol:'AAA', value:'2.50', sourceTimestamp:new Date(200), effectiveTime:new Date(200), knowledgeTime:new Date(300), verificationStatus:'VERIFIED', dataNature:'RAW', formulaVersion:null, origin:null, refreshedAt:new Date(300), truthState:'CURRENT' },
      { evidenceKey:'SOURCE_A|AAA', sourceEventId:'evt-1', source:'SOURCE_A', symbol:'AAA', value:'1.25', sourceTimestamp:new Date(100), effectiveTime:new Date(100), knowledgeTime:new Date(100), verificationStatus:'VERIFIED', dataNature:'RAW', formulaVersion:null, origin:null, refreshedAt:new Date(200), truthState:'CURRENT' }
    ]
  }};
  const store = new PrismaDarsEvidenceStore(prisma);
  assert.equal((await store.currentEvidence(250))[0].value, '1.25');
  assert.equal((await store.currentEvidence(350))[0].value, '2.50');
});
