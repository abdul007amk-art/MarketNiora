const test = require('node:test');
const assert = require('node:assert/strict');
const { gzipSync } = require('node:zlib');
const {
  UpstoxLtpProvider,
  isValidNseEquityInstrumentKey,
  resolveVerifiedNseInstrumentKey,
  VerifiedNseInstrumentKeyResolver,
  UpstoxInstrumentDirectory,
} = require('../backend/src/providers/upstoxLtpProvider.ts');

const MAPPING = {
  symbol: 'RELIANCE',
  exchange: 'NSE',
  instrumentKey: 'NSE_EQ|INE002A01018',
  mappingStatus: 'VERIFIED',
};
const quoteEnvelope = (price = 2950.25) => ({
  status: 'success',
  data: {
    'NSE_EQ:INE002A01018': {
      last_price: price,
      instrument_token: 'NSE_EQ|INE002A01018',
      ltq: 1,
      volume: 125000,
      cp: 2930.5,
    },
  },
});
const jsonResponse = (body, status = 200) => new Response(
  JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json' } },
);

const instrumentFeedResponse = (rows, status = 200) => new Response(
  gzipSync(Buffer.from(JSON.stringify(rows))),
  { status, headers: { 'Content-Type': 'application/gzip' } },
);


test('instrument key validation accepts NSE equity keys only', () => {
  assert.equal(isValidNseEquityInstrumentKey('NSE_EQ|INE002A01018'), true);
  assert.equal(isValidNseEquityInstrumentKey('NSE_FO|INE002A01018'), false);
  assert.equal(isValidNseEquityInstrumentKey('BSE_EQ|INE002A01018'), false);
  assert.equal(isValidNseEquityInstrumentKey('NSE_EQ|'), false);
  assert.equal(isValidNseEquityInstrumentKey('NSE_EQ|INE002A01018&instrument_key=x'), false);
});

test('resolver uses exactly one VERIFIED NSE mapping', () => {
  const rows = [
    MAPPING,
    { ...MAPPING, mappingStatus: 'PENDING', instrumentKey: 'NSE_EQ|INE999Z99999' },
    { ...MAPPING, exchange: 'BSE', instrumentKey: 'BSE_EQ|INE002A01018' },
  ];
  assert.equal(resolveVerifiedNseInstrumentKey('reliance', rows), MAPPING.instrumentKey);
});

test('resolver blocks missing, unverified, and conflicting mappings instead of taking the first row', () => {
  assert.equal(resolveVerifiedNseInstrumentKey('RELIANCE', [{ ...MAPPING, mappingStatus: 'PENDING' }]), null);
  assert.equal(resolveVerifiedNseInstrumentKey('RELIANCE', []), null);
  assert.equal(resolveVerifiedNseInstrumentKey('RELIANCE', [
    MAPPING,
    { ...MAPPING, instrumentKey: 'NSE_EQ|INE999Z99999' },
  ]), null);
  assert.equal(resolveVerifiedNseInstrumentKey('../../etc/passwd', [MAPPING]), null);
});

test('provider sends the bearer token server-side, selects the resolved instrument, and keeps source time UNKNOWN', async () => {
  let calledUrl = '';
  let sentAuthorization = '';
  const provider = new UpstoxLtpProvider({
    accessToken: 'test-token-not-a-real-credential',
    instrumentResolver: { resolve: (symbol) => symbol === 'RELIANCE' ? MAPPING.instrumentKey : null },
    fetcher: async (url, init) => {
      calledUrl = String(url);
      sentAuthorization = init.headers.Authorization;
      return jsonResponse(quoteEnvelope());
    },
  });
  const quote = await provider.getQuote('reliance', 5000);

  assert.equal(quote.symbol, 'RELIANCE');
  assert.equal(quote.price, 2950.25);
  assert.equal(quote.status, 'UNKNOWN');
  assert.equal(quote.asOf, null);
  assert.equal(quote.source, 'UPSTOX_LTP_V3');
  assert.equal(calledUrl, 'https://api.upstox.com/v3/market-quote/ltp?instrument_key=NSE_EQ%7CINE002A01018');
  assert.equal(sentAuthorization, 'Bearer test-token-not-a-real-credential');

  const health = await provider.healthCheck(5010);
  assert.equal(health.status, 'HEALTHY');
});

test('provider never calls Upstox or returns a placeholder price for an unresolved mapping', async () => {
  let called = false;
  const provider = new UpstoxLtpProvider({
    accessToken: 'test-token',
    instrumentResolver: { resolve: () => null },
    fetcher: async () => { called = true; return jsonResponse(quoteEnvelope()); },
  });
  const quote = await provider.getQuote('UNKNOWN', 1234);
  assert.equal(called, false);
  assert.equal(quote.price, null);
  assert.equal(quote.asOf, null);
  assert.equal(quote.status, 'SOURCE_REQUIRED');
  assert.equal((await provider.healthCheck(1235)).status, 'DEGRADED');
});

test('provider rejects missing, non-positive, malformed, or mismatched price payloads', async () => {
  for (const envelope of [
    { status: 'error', data: {} },
    { status: 'success', data: {} },
    { status: 'success', data: { 'NSE_EQ:INE002A01018': { last_price: 0, instrument_token: MAPPING.instrumentKey } } },
    { status: 'success', data: { 'NSE_EQ:INE002A01018': { last_price: 2950.25, instrument_token: 'NSE_EQ|WRONG' } } },
  ]) {
    const provider = new UpstoxLtpProvider({
      accessToken: 'test-token',
      instrumentResolver: { resolve: () => MAPPING.instrumentKey },
      fetcher: async () => jsonResponse(envelope),
    });
    const quote = await provider.getQuote('RELIANCE', 2000);
    assert.equal(quote.price, null);
    assert.equal(quote.asOf, null);
  }
});

test('provider fails closed on HTTP/transport exceptions and never leaks upstream bodies', async () => {
  const denied = new UpstoxLtpProvider({
    accessToken: 'sensitive-test-token',
    instrumentResolver: { resolve: () => MAPPING.instrumentKey },
    fetcher: async () => new Response('token=sensitive-test-token private upstream detail', { status: 401 }),
  });
  await assert.rejects(() => denied.getQuote('RELIANCE', 3000), /HTTP 401/);
  assert.equal((await denied.healthCheck(3001)).status, 'DEGRADED');

  const offline = new UpstoxLtpProvider({
    accessToken: 'sensitive-test-token',
    instrumentResolver: { resolve: () => MAPPING.instrumentKey },
    fetcher: async () => { throw new Error('token=sensitive-test-token private detail'); },
  });
  await assert.rejects(() => offline.getQuote('RELIANCE', 4000), /request unavailable/);
});

test('provider requires a non-empty token and a verified instrument resolver', () => {
  assert.throws(() => new UpstoxLtpProvider({
    accessToken: '',
    instrumentResolver: { resolve: () => MAPPING.instrumentKey },
  }), /access token is required/);
  assert.throws(() => new UpstoxLtpProvider({
    accessToken: 'test-token',
    instrumentResolver: null,
  }), /instrument-key resolver is required/);
});


test('VerifiedNseInstrumentKeyResolver keeps an immutable snapshot of the validated mapping rows', () => {
  const originalKey = MAPPING.instrumentKey;
  const records = [{ ...MAPPING }];
  const resolver = new VerifiedNseInstrumentKeyResolver(records);
  records[0].instrumentKey = 'NSE_EQ|CHANGED';
  assert.equal(resolver.resolve('RELIANCE'), originalKey);
});

test('malformed upstream payload leaves health DEGRADED, not HEALTHY', async () => {
  const provider = new UpstoxLtpProvider({
    accessToken: 'test-token',
    instrumentResolver: { resolve: () => MAPPING.instrumentKey },
    fetcher: async () => jsonResponse({ status: 'success', data: {} }),
  });
  const quote = await provider.getQuote('RELIANCE', 7000);
  assert.equal(quote.price, null);
  assert.equal(quote.status, 'NOT_INTERPRETABLE');
  assert.equal((await provider.healthCheck(7001)).status, 'DEGRADED');
});


const INSTRUMENT_FEED_URL = 'https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz';
const instrumentRows = [
  { segment: 'NSE_EQ', exchange: 'NSE', instrument_type: 'EQ', trading_symbol: 'RELIANCE', instrument_key: 'NSE_EQ|INE002A01018' },
  { segment: 'BSE_EQ', exchange: 'BSE', instrument_type: 'EQ', trading_symbol: 'RELIANCE', instrument_key: 'BSE_EQ|500325' },
  { segment: 'NSE_FO', exchange: 'NSE', instrument_type: 'FUT', trading_symbol: 'RELIANCE', instrument_key: 'NSE_FO|RELIANCE-FUT' },
  { segment: 'NSE_EQ', exchange: 'NSE', instrument_type: 'EQ', trading_symbol: 'INFY', instrument_key: 'NSE_EQ|INE009A01021' },
];

test('Upstox instrument directory accepts only NSE_EQ / NSE / EQ mappings', async () => {
  const directory = new UpstoxInstrumentDirectory({
    instrumentsJsonUrl: INSTRUMENT_FEED_URL,
    fetcher: async () => instrumentFeedResponse(instrumentRows),
  });
  assert.equal(await directory.resolve('reliance'), 'NSE_EQ|INE002A01018');
  assert.equal(await directory.resolve('INFY'), 'NSE_EQ|INE009A01021');
  assert.equal(await directory.resolve('NOT_LISTED'), null);
});

test('Upstox instrument directory blocks conflicting NSE mappings instead of choosing the first', async () => {
  const directory = new UpstoxInstrumentDirectory({
    instrumentsJsonUrl: INSTRUMENT_FEED_URL,
    fetcher: async () => jsonResponse([
      ...instrumentRows,
      { segment: 'NSE_EQ', exchange: 'NSE', instrument_type: 'EQ', trading_symbol: 'RELIANCE', instrument_key: 'NSE_EQ|DIFFERENTKEY' },
    ]),
  });
  assert.equal(await directory.resolve('RELIANCE'), null);
  assert.equal(await directory.resolve('INFY'), 'NSE_EQ|INE009A01021');
});

test('Upstox instrument directory caches a validated snapshot within its configured TTL', async () => {
  let calls = 0;
  const directory = new UpstoxInstrumentDirectory({
    instrumentsJsonUrl: INSTRUMENT_FEED_URL,
    fetcher: async () => { calls += 1; return instrumentFeedResponse(instrumentRows); },
  });
  await directory.resolve('RELIANCE');
  await directory.resolve('INFY');
  assert.equal(calls, 1);
});

test('Upstox instrument directory rejects arbitrary hosts, HTTP and non-JSON paths', () => {
  assert.throws(() => new UpstoxInstrumentDirectory({
    instrumentsJsonUrl: 'https://example.com/instruments.json',
  }), /assets.upstox.com/);
  assert.throws(() => new UpstoxInstrumentDirectory({
    instrumentsJsonUrl: 'http://assets.upstox.com/instruments.json',
  }), /HTTPS JSON file/);
  assert.throws(() => new UpstoxInstrumentDirectory({
    instrumentsJsonUrl: 'https://assets.upstox.com/instruments.csv',
  }), /HTTPS JSON file/);
});

test('Upstox instrument directory fails closed on non-JSON or empty instrument feeds', async () => {
  for (const payload of [{ data: instrumentRows }, [], [{ segment: 'BSE_EQ', exchange: 'BSE', instrument_type: 'EQ', trading_symbol: 'RELIANCE', instrument_key: 'BSE_EQ|500325' }]]) {
    const directory = new UpstoxInstrumentDirectory({
      instrumentsJsonUrl: INSTRUMENT_FEED_URL,
      fetcher: async () => instrumentFeedResponse(payload),
    });
    await assert.rejects(() => directory.resolve('RELIANCE'), /unexpected structure|no usable NSE equity records/);
  }
});


test('configured provider selection defaults to Null, blocks partial config, and activates only with both settings', () => {
  const { createConfiguredMarketDataProvider } = require('../backend/src/providers/marketDataProviderFactory.ts');
  const previousToken = process.env.UPSTOX_ACCESS_TOKEN;
  const previousUrl = process.env.UPSTOX_INSTRUMENTS_JSON_URL;
  try {
    delete process.env.UPSTOX_ACCESS_TOKEN;
    delete process.env.UPSTOX_INSTRUMENTS_JSON_URL;
    assert.equal(createConfiguredMarketDataProvider().name, 'NONE_CONFIGURED_MARKET_DATA');

    process.env.UPSTOX_ACCESS_TOKEN = 'non-secret-test-fixture';
    assert.throws(() => createConfiguredMarketDataProvider(), /requires both UPSTOX_ACCESS_TOKEN and UPSTOX_INSTRUMENTS_JSON_URL/);

    process.env.UPSTOX_INSTRUMENTS_JSON_URL = INSTRUMENT_FEED_URL;
    assert.equal(createConfiguredMarketDataProvider().name, 'UPSTOX_LTP_V3');
  } finally {
    if (previousToken === undefined) delete process.env.UPSTOX_ACCESS_TOKEN;
    else process.env.UPSTOX_ACCESS_TOKEN = previousToken;
    if (previousUrl === undefined) delete process.env.UPSTOX_INSTRUMENTS_JSON_URL;
    else process.env.UPSTOX_INSTRUMENTS_JSON_URL = previousUrl;
  }
});


test('Upstox instrument directory decompresses official .json.gz feed before validation', async () => {
  let calledUrl = '';
  const directory = new UpstoxInstrumentDirectory({
    instrumentsJsonUrl: INSTRUMENT_FEED_URL,
    fetcher: async (url) => {
      calledUrl = String(url);
      return instrumentFeedResponse(instrumentRows);
    },
  });
  assert.equal(await directory.resolve('RELIANCE'), 'NSE_EQ|INE002A01018');
  assert.equal(calledUrl, INSTRUMENT_FEED_URL);
});
