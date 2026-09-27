const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaDarsRunStore } = require('../backend/src/dars12/prismaDarsRunStore.ts');

const result = {
  runId: 'DARS12-1000',
  stageEvents: [{ sequence: 1, stage: 'PROVIDER_HEALTH', status: 'SUCCEEDED' }],
  evidence: [],
  formulaOutput: null,
  formulaExecuted: false,
  duplicateSourceEventIds: ['evt-1'],
  truthState: 'CURRENT',
  ready: true,
  healthy: true,
  errors: []
};

test('PrismaDarsRunStore: persists running then completed durable run state', async () => {
  const calls = [];
  const prisma = {
    darsRun: {
      create: async ({ data }) => { calls.push({ op: 'create', data }); return data; },
      update: async ({ where, data }) => { calls.push({ op: 'update', where, data }); return data; }
    }
  };
  const store = new PrismaDarsRunStore(prisma);
  await store.start({ runId: 'DARS12-1000', knowledgeTime: 1000, providerHealthy: true, startedAt: 900 });
  await store.complete(result, 1100);

  assert.equal(calls.length, 2);
  assert.equal(calls[0].data.status, 'RUNNING');
  assert.equal(calls[0].data.knowledgeTime.getTime(), 1000);
  assert.equal(calls[1].where.runId, 'DARS12-1000');
  assert.equal(calls[1].data.status, 'SUCCESS');
  assert.equal(calls[1].data.truthState, 'CURRENT');
  assert.deepEqual(calls[1].data.stageEvents, result.stageEvents);
});

test('PrismaDarsRunStore: unhealthy result is durably marked FAILURE', async () => {
  let update;
  const prisma = {
    darsRun: {
      update: async ({ data }) => { update = data; return data; }
    }
  };
  const store = new PrismaDarsRunStore(prisma);
  await store.complete({ ...result, healthy: false, ready: false, truthState: 'BLOCKED', errors: ['provider health check failed'] }, 1200);
  assert.equal(update.status, 'FAILURE');
  assert.equal(update.healthy, false);
  assert.equal(update.ready, false);
  assert.deepEqual(update.errors, ['provider health check failed']);
});

test('PrismaDarsRunStore: database errors fail closed', async () => {
  const prisma = {
    darsRun: {
      create: async () => { throw new Error('db unavailable'); }
    }
  };
  await assert.rejects(
    () => new PrismaDarsRunStore(prisma).start({ runId: 'DARS12-1000', knowledgeTime: 1000, providerHealthy: true, startedAt: 900 }),
    /db unavailable/
  );
});
