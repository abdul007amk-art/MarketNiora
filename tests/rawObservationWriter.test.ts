const test = require('node:test');
const assert = require('node:assert/strict');
const { PrismaRawObservationWriter } = require('../backend/src/db/rawObservationWriter.ts');

const STOCK_ID = '123e4567-e89b-42d3-a456-426614174000';
const MAPPING = {
  stockId: STOCK_ID,
  symbol: 'RELIANCE',
  exchange: 'NSE',
  identityKey: 'canonical-key-from-approved-resolver',
  mappingSource: 'Official NSE / Upstox instrument mapping review',
  mappingEvidenceUrl: 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz',
  mappingVerifiedAt: 1000,
};

function mockPrisma() {
  let captured = null;
  let calls = 0;
  const prisma = {
    rawStockObservation: {
      create: async ({ data }) => {
        calls += 1;
        captured = data;
        return {
          observationId: '423e4567-e89b-42d3-a456-426614174000',
          stockId: data.stockId,
          retrievedAt: data.retrievedAt,
        };
      },
    },
  };
  return {
    prisma: prisma as unknown as ConstructorParameters<typeof PrismaRawObservationWriter>[0],
    captured: () => captured,
    calls: () => calls,
  };
}

function quote(overrides = {}) {
  return {
    symbol: 'RELIANCE',
    price: 2950.25,
    status: 'LIVE',
    asOf: 1500,
    source: 'UPSTOX_FULL_MARKET_QUOTES_V3',
    ...overrides,
  };
}

test('PrismaRawObservationWriter appends a source timestamp and raw payload without promoting verification', async () => {
  const mock = mockPrisma();
  const resolver = { resolve: async () => MAPPING };
  const writer = new PrismaRawObservationWriter(mock.prisma, resolver);
  const input = quote();

  const saved = await writer.append(input, 2000);
  const row = mock.captured();

  assert.equal(saved.observationId, '423e4567-e89b-42d3-a456-426614174000');
  assert.equal(saved.stockId, STOCK_ID);
  assert.equal(saved.retrievedAt, 2000);
  assert.equal(row.stockId, STOCK_ID);
  assert.equal(row.source, input.source);
  assert.equal(row.sourceTimestamp.getTime(), 1500);
  assert.equal(row.retrievedAt.getTime(), 2000);
  assert.equal(row.dataNature, 'RAW');
  assert.equal(row.formulaVersion, null);
  assert.deepEqual(row.payload, input);
  assert.equal(row.freshnessStatus, 'LIVE');
  assert.equal(row.verificationStatus, 'UNKNOWN');
  assert.equal(row.interpretationStatus, 'INTERPRETABLE');
  assert.equal(row.workflowStatus, 'PENDING');
  assert.equal(row.validationStatus, 'RAW_CAPTURED');
  assert.equal(row.configurationSnapshot.identityMapping.mappingSource, MAPPING.mappingSource);
  assert.equal(row.configurationSnapshot.identityMapping.mappingVerifiedAt, new Date(1000).toISOString());
  assert.equal(mock.calls(), 1);
});

test('unresolved or ambiguous canonical identity fails closed before any database write', async () => {
  const mock = mockPrisma();
  const writer = new PrismaRawObservationWriter(mock.prisma, { resolve: async () => null });
  await assert.rejects(() => writer.append(quote(), 2000), /canonical identity is unresolved or ambiguous/);
  assert.equal(mock.calls(), 0);
});

test('a resolver cannot bind a quote to a different symbol', async () => {
  const mock = mockPrisma();
  const wrong = { ...MAPPING, symbol: 'INFY' };
  const writer = new PrismaRawObservationWriter(mock.prisma, { resolve: async () => wrong });
  await assert.rejects(() => writer.append(quote(), 2000), /symbol does not match/);
  assert.equal(mock.calls(), 0);
});

test('mapping evidence must be HTTPS and verified no later than the observation retrieval time', async () => {
  for (const mapping of [
    { ...MAPPING, mappingEvidenceUrl: 'http://example.com/source' },
    { ...MAPPING, mappingVerifiedAt: 2001 },
    { ...MAPPING, stockId: 'not-a-uuid' },
  ]) {
    const mock = mockPrisma();
    const writer = new PrismaRawObservationWriter(mock.prisma, { resolve: async () => mapping });
    await assert.rejects(() => writer.append(quote(), 2000));
    assert.equal(mock.calls(), 0);
  }
});

test('source-required quotes preserve null price/timestamp and do not turn null into zero', async () => {
  const mock = mockPrisma();
  const writer = new PrismaRawObservationWriter(mock.prisma, { resolve: async () => MAPPING });
  const input = quote({ price: null, status: 'SOURCE_REQUIRED', asOf: null });
  await writer.append(input, 2000);
  const row = mock.captured();
  assert.equal(row.payload.price, null);
  assert.equal(row.payload.asOf, null);
  assert.equal(row.sourceTimestamp, null);
  assert.equal(row.freshnessStatus, 'UNAVAILABLE');
  assert.equal(row.verificationStatus, 'UNKNOWN');
  assert.equal(row.interpretationStatus, 'NOT_INTERPRETABLE');
  assert.equal(row.workflowStatus, 'SOURCE_REQUIRED');
});

test('invalid non-finite values are rejected before canonical mapping or persistence', async () => {
  const mock = mockPrisma();
  let resolverCalls = 0;
  const writer = new PrismaRawObservationWriter(mock.prisma, {
    resolve: async () => { resolverCalls += 1; return MAPPING; },
  });
  await assert.rejects(() => writer.append(quote({ price: Number.POSITIVE_INFINITY }), 2000), /finite number or null/);
  await assert.rejects(() => writer.append(quote({ asOf: Number.NaN }), 2000), /valid epoch-millisecond value or null/);
  assert.equal(resolverCalls, 0);
  assert.equal(mock.calls(), 0);
});

test('stale and missing quotes retain separate freshness and workflow states', async () => {
  const staleMock = mockPrisma();
  await new PrismaRawObservationWriter(staleMock.prisma, { resolve: async () => MAPPING })
    .append(quote({ status: 'STALE' }), 2000);
  assert.equal(staleMock.captured().freshnessStatus, 'STALE');
  assert.equal(staleMock.captured().workflowStatus, 'PENDING');

  const missingMock = mockPrisma();
  await new PrismaRawObservationWriter(missingMock.prisma, { resolve: async () => MAPPING })
    .append(quote({ price: null, status: 'MISSING', asOf: null }), 2000);
  assert.equal(missingMock.captured().freshnessStatus, 'UNAVAILABLE');
  assert.equal(missingMock.captured().workflowStatus, 'MISSING');
});

test('writer exposes append only and is not marked production ready', () => {
  const mock = mockPrisma();
  const writer = new PrismaRawObservationWriter(mock.prisma, { resolve: async () => MAPPING });
  assert.equal(writer.productionReady, false);
  assert.equal(typeof writer.append, 'function');
  assert.equal(writer.update, undefined);
  assert.equal(writer.delete, undefined);
});
