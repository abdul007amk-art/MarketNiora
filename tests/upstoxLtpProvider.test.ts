const test = require('node:test');
const assert = require('node:assert/strict');
const {
  UpstoxLtpProvider,
  isValidNseEquityInstrumentKey,
  resolveVerifiedNseInstrumentKey,
  VerifiedNseInstrumentKeyResolver,
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
  const records = [MAPPING];
  const resolver = new VerifiedNseInstrumentKeyResolver(records);
  records[0].instrumentKey = 'NSE_EQ|CHANGED';
  assert.equal(resolver.resolve('RELIANCE'), MAPPING.instrumentKey);
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
