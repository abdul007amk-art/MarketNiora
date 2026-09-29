const test = require('node:test');
const assert = require('node:assert/strict');
const { runDars12Production } = require('../backend/src/dars12/dars12Orchestrator.ts');

const provider = {
  name: 'TEST_PROVIDER',
  healthCheck: async () => ({ providerName: 'TEST_PROVIDER', status: 'HEALTHY', lastCheckedAt: 1000 }),
  getQuote: async (symbol) => ({
    symbol, price: symbol === 'AAA' ? 10 : 20, status: 'LIVE', asOf: 900, source: 'TEST_PROVIDER'
  })
};

test('production orchestration: provider -> DARS -> durable evidence -> durable run', async () => {
  const calls = [];
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    darsRun: {
      create: async ({ data }) => { calls.push(['run.create', data]); return data; },
      update: async ({ data }) => { calls.push(['run.update', data]); return data; }
    },
    appAuditLog: { create: async ({ data }) => { calls.push(['audit.create', data]); return data; } },
    darsHealthReport: { create: async ({ data }) => { calls.push(['health.create', data]); return data; } },
    darsEvidence: {
      findUnique: async () => null,
      create: async ({ data }) => { calls.push(['evidence.create', data]); return data; }
    }
  };

  const r = await runDars12Production(prisma, {
    provider, symbols: ['AAA', 'BBB'], runKnowledgeTime: 1000,
    expectedCoverage: 2, formulaVersion: 'F-1',
    formula: (evidence) => evidence.map(e => e.value).join('+')
  });

  assert.equal(r.result.healthy, true);
  assert.equal(r.result.ready, true);
  assert.equal(r.result.formulaOutput, '10+20');
  assert.equal(r.persistedEvidence, 2);
  assert.equal(calls.filter(x => x[0] === 'evidence.create').length, 2);
  assert.equal(calls[0][0], 'run.create');
  assert.equal(calls.at(-1)[0], 'run.update');
});

test('production orchestration: provider outage is persisted as blocked run without synthetic evidence', async () => {
  const calls = [];
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    darsRun: {
      create: async ({ data }) => { calls.push(['run.create', data]); return data; },
      update: async ({ data }) => { calls.push(['run.update', data]); return data; }
    },
    appAuditLog: { create: async ({ data }) => { calls.push(['audit.create', data]); return data; } },
    darsHealthReport: { create: async ({ data }) => { calls.push(['health.create', data]); return data; } },
    darsEvidence: {
      findUnique: async () => { throw new Error('must not persist evidence'); }
    }
  };
  const downProvider = {
    name: 'DOWN_PROVIDER',
    healthCheck: async () => ({ providerName: 'DOWN_PROVIDER', status: 'DOWN', lastCheckedAt: 1000, detail: 'offline' }),
    getQuote: async () => { throw new Error('must not fetch'); }
  };

  const r = await runDars12Production(prisma, {
    provider: downProvider, symbols: ['AAA'], runKnowledgeTime: 1000,
    formulaVersion: 'F-1', formula: () => 'never'
  });

  assert.equal(r.result.healthy, false);
  assert.equal(r.result.truthState, 'BLOCKED');
  assert.equal(r.persistedEvidence, 0);
  assert.equal(calls[0][1].providerHealthy, false);
  const finalRunUpdate = calls.filter(x => x[0] === 'run.update').at(-1);
  assert.equal(finalRunUpdate?.[1].status, 'FAILURE');
});

test('production orchestration: durable evidence failure fails the run instead of reporting success', async () => {
  const calls = [];
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    darsRun: {
      create: async ({ data }) => { calls.push(['run.create', data]); return data; },
      update: async ({ data }) => { calls.push(['run.update', data]); return data; }
    },
    appAuditLog: { create: async () => { throw new Error('must not write audit'); } },
    darsHealthReport: { create: async () => { throw new Error('must not write health report'); } },
    darsEvidence: {
      findUnique: async () => null,
      create: async () => { throw new Error('evidence db unavailable'); }
    }
  };

  await assert.rejects(
    () => runDars12Production(prisma, {
      provider, symbols: ['AAA'], runKnowledgeTime: 1000,
      expectedCoverage: 1, formulaVersion: 'F-1', formula: () => '10'
    }),
    /evidence db unavailable/
  );
  assert.equal(calls.at(-1)[1].status, 'FAILURE');
  assert.equal(calls.at(-1)[1].truthState, 'BLOCKED');
});


test('production orchestration: evidence persistence is transactional with final run completion', async () => {
  const committed = [];
  const txCalls = [];
  let inTransaction = false;
  const prisma = {
    $transaction: async (fn) => {
      inTransaction = true;
      const tx = {
        darsEvidence: {
          findUnique: async () => null,
          create: async ({ data }) => { txCalls.push(['evidence.create', data]); return data; }
        },
        darsRun: {
          update: async ({ data }) => { txCalls.push(['run.update', data]); return data; }
        },
        appAuditLog: {
          create: async ({ data }) => { txCalls.push(['audit.create', data]); return data; }
        },
        darsHealthReport: {
          create: async ({ data }) => { txCalls.push(['health.create', data]); return data; }
        }
      };
      try {
        const out = await fn(tx);
        committed.push(...txCalls);
        return out;
      } finally { inTransaction = false; }
    },
    darsRun: {
      create: async ({ data }) => { committed.push(['run.create', data]); return data; },
      update: async ({ data }) => { committed.push(['run.failure', data]); return data; }
    },
    darsEvidence: {
      findUnique: async () => null,
      create: async () => { throw new Error('must use transaction client'); }
    }
  };
  const r = await runDars12Production(prisma, {
    provider, symbols: ['AAA', 'BBB'], runKnowledgeTime: 2000,
    expectedCoverage: 2, formulaVersion: 'F-1', formula: (evidence) => evidence.map(e => e.value).join('+')
  });
  assert.equal(inTransaction, false);
  assert.equal(r.persistedEvidence, 2);
  assert.equal(committed.filter(x => x[0] === 'evidence.create').length, 2);
  assert.equal(committed.at(-1)[0], 'run.update');
});
