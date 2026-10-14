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
          findMany: async () => [],
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
          findMany: async () => [],
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
          findMany: async () => [],
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
          findMany: async () => [],
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
          findMany: async () => [],
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


test('production orchestration: identical durable event replay preserves first knowledge time across fresh engines', async () => {
  const rows = [];
  const provider = {
    name: 'STABLE_PROVIDER',
    healthCheck: async () => ({ providerName: 'STABLE_PROVIDER', status: 'HEALTHY', lastCheckedAt: 1000 }),
    getQuote: async (symbol) => ({
      symbol, price: 10, status: 'LIVE', asOf: 900, source: 'STABLE_PROVIDER'
    })
  };
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    darsRun: {
      create: async ({ data }) => data,
      update: async ({ data }) => data
    },
    appAuditLog: { create: async ({ data }) => data },
    darsHealthReport: { create: async ({ data }) => data },
    darsEvidence: {
      findMany: async () => [...rows],
      findUnique: async ({ where }) => rows.find((row) => row.sourceEventId === where.sourceEventId) ?? null,
      create: async ({ data }) => { rows.push({ ...data }); return data; },
      update: async ({ where, data }) => {
        const row = rows.find((item) => item.sourceEventId === where.sourceEventId);
        if (!row) throw new Error('expected persisted source_event_id');
        Object.assign(row, data);
        return row;
      }
    }
  };

  const first = await runDars12Production(prisma, {
    provider, symbols: ['AAA'], runKnowledgeTime: 1000,
    expectedCoverage: 1, formulaVersion: 'F-1', formula: (evidence) => evidence.map(e => e.value).join('+')
  });
  const second = await runDars12Production(prisma, {
    provider, symbols: ['AAA'], runKnowledgeTime: 2000,
    expectedCoverage: 1, formulaVersion: 'F-1', formula: (evidence) => evidence.map(e => e.value).join('+')
  });

  assert.equal(first.result.healthy, true);
  assert.equal(second.result.healthy, true);
  assert.equal(second.result.formulaOutput, '10');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].knowledgeTime.getTime(), 1000);
  assert.equal(rows[0].refreshedAt.getTime(), 2000);
});

test('production orchestration: conflicting durable source_event_id replay cannot overwrite prior evidence', async () => {
  const rows = [];
  const stableProvider = (price) => ({
    name: 'STABLE_PROVIDER',
    healthCheck: async () => ({ providerName: 'STABLE_PROVIDER', status: 'HEALTHY', lastCheckedAt: 1000 }),
    getQuote: async (symbol) => ({
      symbol, price, status: 'LIVE', asOf: 900, source: 'STABLE_PROVIDER'
    })
  });
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    darsRun: {
      create: async ({ data }) => data,
      update: async ({ data }) => data
    },
    appAuditLog: { create: async ({ data }) => data },
    darsHealthReport: { create: async ({ data }) => data },
    darsEvidence: {
      findMany: async () => [...rows],
      findUnique: async ({ where }) => rows.find((row) => row.sourceEventId === where.sourceEventId) ?? null,
      create: async ({ data }) => { rows.push({ ...data }); return data; },
      update: async ({ where, data }) => {
        const row = rows.find((item) => item.sourceEventId === where.sourceEventId);
        if (!row) throw new Error('expected persisted source_event_id');
        Object.assign(row, data);
        return row;
      }
    }
  };

  await runDars12Production(prisma, {
    provider: stableProvider(10), symbols: ['AAA'], runKnowledgeTime: 1000,
    expectedCoverage: 1, formulaVersion: 'F-1', formula: () => '10'
  });
  const replay = await runDars12Production(prisma, {
    provider: stableProvider(11), symbols: ['AAA'], runKnowledgeTime: 2000,
    expectedCoverage: 1, formulaVersion: 'F-1', formula: () => 'must not execute'
  });

  assert.equal(replay.result.healthy, false);
  assert.equal(replay.result.ready, false);
  assert.equal(replay.result.formulaExecuted, false);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].value, '10');
  assert.equal(rows[0].knowledgeTime.getTime(), 1000);
});


test('production orchestration: unrelated durable symbols are excluded from run coverage and formula', async () => {
  const oldRow = {
    evidenceKey: 'OLD_SOURCE|BBB',
    sourceEventId: 'old-bbb-event',
    source: 'OLD_SOURCE',
    symbol: 'BBB',
    value: '999',
    sourceTimestamp: new Date(500),
    effectiveTime: new Date(500),
    knowledgeTime: new Date(500),
    verificationStatus: 'VERIFIED',
    dataNature: 'RAW',
    formulaVersion: null,
    origin: null,
    refreshedAt: new Date(500),
    truthState: 'STALE'
  };
  const rows = [oldRow];
  const prisma = {
    $transaction: async (fn) => fn(prisma),
    darsRun: {
      create: async ({ data }) => data,
      update: async ({ data }) => data
    },
    appAuditLog: { create: async ({ data }) => data },
    darsHealthReport: { create: async ({ data }) => data },
    darsEvidence: {
      findMany: async () => [...rows],
      findUnique: async ({ where }) => rows.find(row => row.sourceEventId === where.sourceEventId) ?? null,
      create: async ({ data }) => { rows.push({ ...data }); return data; },
      update: async ({ where, data }) => {
        const row = rows.find(item => item.sourceEventId === where.sourceEventId);
        if (!row) throw new Error('expected persisted event');
        Object.assign(row, data);
        return row;
      }
    }
  };
  const r = await runDars12Production(prisma, {
    provider,
    symbols: ['AAA'],
    runKnowledgeTime: 1000,
    formulaVersion: 'F-1',
    formula: evidence => evidence.map(row => row.symbol + ':' + row.value).join(',')
  });
  assert.equal(r.result.healthy, true);
  assert.equal(r.result.ready, true);
  assert.equal(r.result.formulaOutput, 'AAA:10');
  assert.deepEqual(r.result.evidence.map(row => row.symbol), ['AAA']);
  assert.equal(r.persistedEvidence, 1);
  assert.equal(rows.length, 2);
});
