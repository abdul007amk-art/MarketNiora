const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../backend/src/api/server.ts');
const { buildRoutes } = require('../backend/src/api/routes/index.ts');
const { createDependencies } = require('../backend/src/api/dependencies.ts');

async function startServer(workspaceReadStore) {
  const deps = createDependencies();
  if (workspaceReadStore) deps.workspaceReadStore = workspaceReadStore;
  const server = createApp(buildRoutes(), deps);
  await new Promise((resolve) => server.listen(0, resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

const storeFixture = () => ({
  getSummary: async () => ({
    canonicalStocks: 4187, sectors: 66, subSectors: 131, stockGroups: 45,
    themes: 23, verifiedThemeMemberships: 12, verifiedValueChainEvidence: 3, verifiedObservations: 0,
  }),
  searchStocks: async ({ query, sector, limit }) => ({
    total: 1,
    items: [{
      stockId: 'stock-id-1', name: 'Infosys Limited', symbol: 'INFY', exchange: 'NSE',
      sector: sector ?? 'Information Technology', subSector: 'IT Services',
      classificationStatus: 'VERIFIED', stockScore: null, stockScoreTruthState: 'NOT_CONFIGURED',
    }],
    request: { query, sector, limit },
  }),
  getRotation: async (horizon, limit) => ({
    items: [{
      level: 'SECTOR', horizon, entity: 'Information Technology', sector: 'Information Technology',
      score: 65, confidence: 75, state: 'LEADING', calculatedAt: '2026-10-14T10:00:00.000Z',
      formulaKey: 'ROTATION', formulaVersion: 'v1.2',
    }].slice(0, limit),
  }),
  getThemes: async (query, limit) => ({
    items: [{
      themeId: 'theme-id-1', name: 'Semiconductors', subThemes: [{
        subThemeId: 'sub-theme-id-1', name: 'Chip Design', industries: [{
          industryId: 'industry-id-1', name: 'Design Services',
          verifiedStocks: [{ stockId: 'stock-id-2', name: 'Example Design Ltd', symbol: 'EXAMPLE', exchange: 'NSE' }],
          verifiedStockCountReturned: 1,
        }],
      }],
    }].filter((theme) => !query || theme.name.toLowerCase().includes(query.toLowerCase())).slice(0, limit),
  }),
  getCompany: async (symbol, exchange) => symbol === 'DUAL'
    ? { truthState: 'AMBIGUOUS', candidates: [{ name: 'Dual NSE Ltd', symbol: 'DUAL', exchange: 'NSE' }, { name: 'Dual BSE Ltd', symbol: 'DUAL', exchange: 'BSE' }] }
    : symbol === 'UNKNOWN' ? { truthState: 'NOT_FOUND' } : ({
      truthState: 'CANONICAL_RECORD_FOUND',
      company: {
        stockId: 'stock-id-1', name: 'Infosys Limited', symbol, exchange: exchange || 'NSE',
        sector: 'Information Technology', subSector: 'IT Services', classificationStatus: 'VERIFIED',
        stockScore: null, stockScoreTruthState: 'NOT_CONFIGURED', verifiedStockGroups: [],
        verifiedThemes: [], updatedAt: '2026-10-14T10:00:00.000Z',
      },
    }),
  getValueChain: async (symbol, exchange) => symbol === 'DUAL'
    ? { truthState: 'AMBIGUOUS', candidates: [{ name: 'Dual NSE Ltd', symbol: 'DUAL', exchange: 'NSE' }] }
    : symbol === 'UNKNOWN' ? { truthState: 'NOT_FOUND' } : ({
      truthState: 'VERIFIED_EVIDENCE_AVAILABLE',
      company: { name: 'Infosys Limited', symbol, exchange: exchange || 'NSE' },
      items: [{ stageId: 'stage-1', stageName: 'Operations', evidence: [{
        evidenceType: 'CAPACITY', sourceName: 'Company filing', sourceUrl: 'https://example.com/filing',
        observedAt: '2026-10-14T10:00:00.000Z', claim: 'Verified capacity disclosure', verification: 'VERIFIED',
      }] }],
    }),
  getFundamentals: async (symbol, exchange, limit) => symbol === 'DUAL'
    ? { truthState: 'AMBIGUOUS', candidates: [{ name: 'Dual NSE Ltd', symbol: 'DUAL', exchange: 'NSE' }] }
    : symbol === 'UNKNOWN' ? { truthState: 'NOT_FOUND' } : ({
      truthState: 'VERIFIED_FUNDAMENTAL_EVIDENCE_AVAILABLE',
      company: { name: 'Infosys Limited', symbol, exchange: exchange || 'NSE' },
      items: [{
        evidenceId: 'evidence-1', evidenceKey: 'REVENUE_FY26', source: 'Annual Report',
        symbol: 'NSE:INFY', value: '100', sourceTimestamp: '2026-10-14T10:00:00.000Z',
        effectiveTime: '2026-03-31T00:00:00.000Z', knowledgeTime: '2026-05-01T00:00:00.000Z',
        verificationStatus: 'VERIFIED', dataNature: 'FUNDAMENTAL_ACTUAL', formulaVersion: null,
        origin: 'annual-report', refreshedAt: '2026-10-14T10:00:00.000Z', truthState: 'VERIFIED',
      }].slice(0, limit),
    }),
  getResearchEvidence: async (symbol, exchange, limit) => symbol === 'DUAL'
    ? { truthState: 'AMBIGUOUS', candidates: [{ name: 'Dual NSE Ltd', symbol: 'DUAL', exchange: 'NSE' }] }
    : symbol === 'UNKNOWN' ? { truthState: 'NOT_FOUND' } : ({
      truthState: 'VERIFIED_EVIDENCE_AVAILABLE',
      company: { name: 'Infosys Limited', symbol, exchange: exchange || 'NSE' },
      items: [{
        evidenceId: 'evidence-2', evidenceKey: 'ORDER_UPDATE', source: 'Exchange filing',
        symbol: 'NSE:INFY', value: 'Disclosed update', sourceTimestamp: '2026-10-14T10:00:00.000Z',
        effectiveTime: '2026-10-14T10:00:00.000Z', knowledgeTime: '2026-10-14T10:05:00.000Z',
        verificationStatus: 'VERIFIED', dataNature: 'DISCLOSURE', formulaVersion: null,
        origin: 'exchange-filing', truthState: 'VERIFIED',
      }].slice(0, limit),
    }),
});

test('workspace read APIs fail closed when a canonical database store is not configured', async () => {
  const { server, baseUrl } = await startServer(undefined);
  try {
    for (const path of [
      '/workspace/summary', '/workspace/stocks', '/workspace/rotation', '/workspace/themes',
      '/workspace/company/INFY', '/workspace/value-chain/INFY',
      '/workspace/fundamentals/INFY', '/workspace/research/INFY',
    ]) {
      const response = await fetch(baseUrl + path);
      assert.equal(response.status, 503, path);
      const body = await response.json();
      assert.equal(body.truthState, 'NOT_CONFIGURED', path);
      assert.match(body.detail, /database is not configured/i);
    }
  } finally {
    await stopServer(server);
  }
});

test('workspace summary returns actual store counts without turning zero into missing', async () => {
  const { server, baseUrl } = await startServer(storeFixture());
  try {
    const response = await fetch(baseUrl + '/workspace/summary');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.truthState, 'CANONICAL_RECORDS_PRESENT');
    assert.equal(body.canonicalStocks, 4187);
    assert.equal(body.verifiedObservations, 0);
    assert.equal(body.themes, 23);
  } finally {
    await stopServer(server);
  }
});

test('stock explorer validates limits and forwards bounded search filters', async () => {
  const fixture = storeFixture();
  const originalSearch = fixture.searchStocks;
  let received;
  fixture.searchStocks = async (options) => {
    received = options;
    return originalSearch(options);
  };
  const { server, baseUrl } = await startServer(fixture);
  try {
    const invalid = await fetch(baseUrl + '/workspace/stocks?limit=999');
    assert.equal(invalid.status, 400);

    const response = await fetch(baseUrl + '/workspace/stocks?q=Infosys&sector=IT&limit=10');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.total, 1);
    assert.equal(body.items[0].symbol, 'INFY');
    assert.deepEqual(received, { query: 'Infosys', sector: 'IT', limit: 10 });
  } finally {
    await stopServer(server);
  }
});

test('rotation explorer accepts only defined horizons and returns persisted snapshots from the store', async () => {
  const { server, baseUrl } = await startServer(storeFixture());
  try {
    const invalid = await fetch(baseUrl + '/workspace/rotation?horizon=5D');
    assert.equal(invalid.status, 400);

    const response = await fetch(baseUrl + '/workspace/rotation?horizon=1W&limit=5');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.truthState, 'VERIFIED_SNAPSHOTS_AVAILABLE');
    assert.equal(body.horizon, '1W');
    assert.equal(body.items[0].formulaVersion, 'v1.2');
  } finally {
    await stopServer(server);
  }
});

test('theme explorer returns only the verified result shape from its read store', async () => {
  const fixture = storeFixture();
  const originalGetThemes = fixture.getThemes;
  let received;
  fixture.getThemes = async (query, limit) => {
    received = { query, limit };
    return originalGetThemes(query, limit);
  };
  const { server, baseUrl } = await startServer(fixture);
  try {
    const response = await fetch(baseUrl + '/workspace/themes?q=semi&limit=5');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.truthState, 'MAPPED_THEMES_AVAILABLE');
    assert.equal(body.items[0].name, 'Semiconductors');
    assert.equal(received.query, 'semi');
    assert.equal(received.limit, 5);

    const invalid = await fetch(baseUrl + '/workspace/themes?q=' + 'x'.repeat(101));
    assert.equal(invalid.status, 400);
  } finally {
    await stopServer(server);
  }
});


test('company detail distinguishes missing and ambiguous identities', async () => {
  const { server, baseUrl } = await startServer(storeFixture());
  try {
    const found = await fetch(baseUrl + '/workspace/company/INFY?exchange=NSE');
    assert.equal(found.status, 200);
    assert.equal((await found.json()).company.symbol, 'INFY');

    const missing = await fetch(baseUrl + '/workspace/company/UNKNOWN?exchange=NSE');
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).truthState, 'NOT_FOUND');

    const ambiguous = await fetch(baseUrl + '/workspace/company/DUAL');
    assert.equal(ambiguous.status, 409);
    assert.equal((await ambiguous.json()).truthState, 'AMBIGUOUS');

    const invalidExchange = await fetch(baseUrl + '/workspace/company/INFY?exchange=OTC');
    assert.equal(invalidExchange.status, 400);
  } finally {
    await stopServer(server);
  }
});

test('value-chain endpoint exposes company-specific verified evidence result shape', async () => {
  const { server, baseUrl } = await startServer(storeFixture());
  try {
    const response = await fetch(baseUrl + '/workspace/value-chain/INFY?exchange=NSE');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.truthState, 'VERIFIED_EVIDENCE_AVAILABLE');
    assert.equal(body.items[0].evidence[0].verification, 'VERIFIED');
    assert.equal(body.items[0].evidence[0].claim, 'Verified capacity disclosure');

    const ambiguous = await fetch(baseUrl + '/workspace/value-chain/DUAL');
    assert.equal(ambiguous.status, 409);
  } finally {
    await stopServer(server);
  }
});

test('fundamental endpoint returns source- and time-attributed records only', async () => {
  const { server, baseUrl } = await startServer(storeFixture());
  try {
    const response = await fetch(baseUrl + '/workspace/fundamentals/INFY?exchange=NSE&limit=10');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.truthState, 'VERIFIED_FUNDAMENTAL_EVIDENCE_AVAILABLE');
    assert.equal(body.items[0].verificationStatus, 'VERIFIED');
    assert.equal(body.items[0].source, 'Annual Report');

    const invalidLimit = await fetch(baseUrl + '/workspace/fundamentals/INFY?limit=0');
    assert.equal(invalidLimit.status, 400);
  } finally {
    await stopServer(server);
  }
});

test('research endpoint returns verified evidence while preserving source and knowledge time', async () => {
  const { server, baseUrl } = await startServer(storeFixture());
  try {
    const response = await fetch(baseUrl + '/workspace/research/INFY?exchange=NSE');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.truthState, 'VERIFIED_EVIDENCE_AVAILABLE');
    assert.equal(body.items[0].source, 'Exchange filing');
    assert.equal(body.items[0].knowledgeTime, '2026-10-14T10:05:00.000Z');
  } finally {
    await stopServer(server);
  }
});

test('frontend bundle parses and every new explorer screen has matching form / result IDs', () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const script = fs.readFileSync('frontend/assets/app.js', 'utf8');
  const html = fs.readFileSync('frontend/index.html', 'utf8');
  assert.doesNotThrow(() => new vm.Script(script, { filename: 'frontend/assets/app.js' }));

  for (const id of [
    'company-search-form', 'company-symbol', 'company-exchange', 'company-status', 'company-results',
    'value-chain-search-form', 'value-chain-symbol', 'value-chain-exchange', 'value-chain-status', 'value-chain-results',
    'fundamentals-search-form', 'fundamentals-symbol', 'fundamentals-exchange', 'fundamentals-status', 'fundamentals-results',
    'research-search-form', 'research-symbol', 'research-exchange', 'research-status', 'research-results',
  ]) {
    assert.ok(html.includes('id="' + id + '"'), 'HTML missing element id ' + id);
  }
  for (const loader of ['loadCompany', 'loadValueChain', 'loadFundamentals', 'loadResearchEvidence']) {
    assert.ok(script.includes(loader), 'frontend handler missing: ' + loader);
  }
});
