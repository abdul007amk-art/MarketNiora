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
});

test('workspace read APIs fail closed when a canonical database store is not configured', async () => {
  const { server, baseUrl } = await startServer(undefined);
  try {
    for (const path of ['/workspace/summary', '/workspace/stocks', '/workspace/rotation', '/workspace/themes']) {
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
