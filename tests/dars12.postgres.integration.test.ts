const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaClient } = require('@prisma/client');
const { runDars12Production } = require('../backend/src/dars12/dars12Orchestrator.ts');

const prisma = new PrismaClient();

const provider = {
  name: 'INTEGRATION_PROVIDER',
  healthCheck: async () => ({ providerName: 'INTEGRATION_PROVIDER', status: 'HEALTHY', lastCheckedAt: Date.now() }),
  getQuote: async (symbol) => ({
    symbol,
    price: symbol === 'AAA' ? 10 : 20,
    status: 'LIVE',
    asOf: Date.now() - 1,
    source: 'INTEGRATION_PROVIDER'
  })
};

async function clean() {
  await prisma.darsHealthReport.deleteMany();
  await prisma.darsEvidence.deleteMany();
  await prisma.darsRun.deleteMany();
  await prisma.appAuditLog.deleteMany();
}

test.before(async () => { await clean(); });
test.after(async () => { await clean(); await prisma.$disconnect(); });

test('real PostgreSQL: persists evidence, health report, audit and successful run atomically', async () => {
  const knowledgeTime = Date.now();
  const result = await runDars12Production(prisma, {
    provider, symbols: ['AAA', 'BBB'], runKnowledgeTime: knowledgeTime,
    expectedCoverage: 2, formulaVersion: 'INTEGRATION-1',
    formula: (evidence) => evidence.map(e => e.value).join('+')
  });

  assert.equal(result.result.healthy, true);
  assert.equal(result.result.ready, true);
  assert.equal(result.result.formulaOutput, '10+20');
  assert.equal(result.persistedEvidence, 2);

  const run = await prisma.darsRun.findUnique({ where: { runId: result.result.runId } });
  const evidence = await prisma.darsEvidence.findMany({ where: { knowledgeTime: new Date(knowledgeTime) } });
  const health = await prisma.darsHealthReport.findUnique({ where: { runId: result.result.runId } });
  const audit = await prisma.appAuditLog.findMany({ where: { targetId: result.result.runId } });

  assert.equal(run?.status, 'SUCCESS');
  assert.equal(run?.healthy, true);
  assert.equal(run?.ready, true);
  assert.equal(evidence.length, 2);
  assert.equal(health?.status, 'HEALTHY');
  assert.equal(audit.length, 1);
});

test('real PostgreSQL: transaction rollback removes evidence/health/audit when final transaction fails', async () => {
  const knowledgeTime = Date.now() + 1000;
  const failingPrisma = new Proxy(prisma, {
    get(target, property, receiver) {
      if (property !== '$transaction') return Reflect.get(target, property, receiver);
      return async (callback) => target.$transaction(async (tx) => {
        const failingTx = new Proxy(tx, {
          get(txTarget, txProperty, txReceiver) {
            if (txProperty === 'appAuditLog') {
              return {
                ...txTarget.appAuditLog,
                create: async () => { throw new Error('integration rollback injection'); }
              };
            }
            return Reflect.get(txTarget, txProperty, txReceiver);
          }
        });
        return callback(failingTx);
      });
    }
  });

  await assert.rejects(
    () => runDars12Production(failingPrisma, {
      provider, symbols: ['AAA'], runKnowledgeTime: knowledgeTime,
      expectedCoverage: 1, formulaVersion: 'INTEGRATION-1', formula: () => '10'
    }),
    /integration rollback injection/
  );

  const run = await prisma.darsRun.findUnique({ where: { runId: `DARS12-${knowledgeTime}` } });
  const evidence = await prisma.darsEvidence.findMany({ where: { knowledgeTime: new Date(knowledgeTime) } });
  const health = await prisma.darsHealthReport.findUnique({ where: { runId: `DARS12-${knowledgeTime}` } });
  const audit = await prisma.appAuditLog.findMany({ where: { targetId: `DARS12-${knowledgeTime}` } });

  assert.equal(run?.status, 'FAILURE');
  assert.equal(run?.truthState, 'BLOCKED');
  assert.equal(evidence.length, 0);
  assert.equal(health, null);
  assert.equal(audit.length, 0);
});

test('real PostgreSQL: identical knowledgeTime collision is fail-closed and leaves one durable run', async () => {
  const knowledgeTime = Date.now() + 2000;
  const results = await Promise.allSettled([
    runDars12Production(prisma, {
      provider, symbols: ['AAA'], runKnowledgeTime: knowledgeTime,
      expectedCoverage: 1, formulaVersion: 'INTEGRATION-1', formula: () => '10'
    }),
    runDars12Production(prisma, {
      provider, symbols: ['AAA'], runKnowledgeTime: knowledgeTime,
      expectedCoverage: 1, formulaVersion: 'INTEGRATION-1', formula: () => '10'
    })
  ]);

  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected').length, 1);

  const runs = await prisma.darsRun.findMany({ where: { runId: `DARS12-${knowledgeTime}` } });
  assert.equal(runs.length, 1);
});
