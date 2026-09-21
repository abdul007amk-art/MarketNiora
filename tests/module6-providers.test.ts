const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyFreshness } = require('../backend/src/providers/sourceHealth.ts');
const {
  NullMarketDataProvider,
  NseBhavcopyProvider,
  parseBhavcopyCsv,
} = require('../backend/src/providers/marketDataProvider.ts');
const {
  NullNotificationProvider,
  TelegramNotificationProvider,
} = require('../backend/src/providers/notificationProvider.ts');
const { ProviderRegistry } = require('../backend/src/providers/providerRegistry.ts');
const { loadTelegramConfig, loadUpstoxConfig } = require('../backend/src/providers/providerConfig.ts');

// ================= SOURCE HEALTH / DATA STATUS =================

test('classifyFreshness: null asOf -> MISSING (never fabricated)', () => {
  const result = classifyFreshness({ asOf: null, now: 1000, staleThresholdMs: 500 });
  assert.equal(result, 'MISSING');
});

test('classifyFreshness: recent data within threshold -> LIVE', () => {
  const result = classifyFreshness({ asOf: 900, now: 1000, staleThresholdMs: 500 });
  assert.equal(result, 'LIVE');
});

test('classifyFreshness: data older than threshold -> STALE', () => {
  const result = classifyFreshness({ asOf: 100, now: 1000, staleThresholdMs: 500 });
  assert.equal(result, 'STALE');
});

test('classifyFreshness: NaN/Infinity inputs -> UNKNOWN, never guessed as LIVE', () => {
  assert.equal(classifyFreshness({ asOf: NaN, now: 1000, staleThresholdMs: 500 }), 'UNKNOWN');
  assert.equal(classifyFreshness({ asOf: 900, now: Infinity, staleThresholdMs: 500 }), 'UNKNOWN');
  assert.equal(classifyFreshness({ asOf: 900, now: 1000, staleThresholdMs: NaN }), 'UNKNOWN');
});

test('classifyFreshness (post-audit): negative/non-integer/Infinity staleThresholdMs -> UNKNOWN, not silently misclassified as STALE', () => {
  // Before the fix, a negative threshold made `age > threshold` true for
  // almost any real observation, silently marking everything STALE
  // instead of surfacing the misconfiguration.
  assert.equal(classifyFreshness({ asOf: 999, now: 1000, staleThresholdMs: -1 }), 'UNKNOWN');
  assert.equal(classifyFreshness({ asOf: 999, now: 1000, staleThresholdMs: -1000 }), 'UNKNOWN');
  assert.equal(classifyFreshness({ asOf: 999, now: 1000, staleThresholdMs: Infinity }), 'UNKNOWN');
  assert.equal(classifyFreshness({ asOf: 999, now: 1000, staleThresholdMs: 30.5 }), 'UNKNOWN'); // non-integer
});

test('classifyFreshness: staleThresholdMs = 0 is valid (means "must match now exactly to be LIVE")', () => {
  assert.equal(classifyFreshness({ asOf: 1000, now: 1000, staleThresholdMs: 0 }), 'LIVE');
  assert.equal(classifyFreshness({ asOf: 999, now: 1000, staleThresholdMs: 0 }), 'STALE');
});

test('classifyFreshness: data claiming to be from the future -> UNKNOWN, not trusted as LIVE', () => {
  const result = classifyFreshness({ asOf: 2000, now: 1000, staleThresholdMs: 500 });
  assert.equal(result, 'UNKNOWN');
});

// ================= MARKET DATA PROVIDER =================

test('NullMarketDataProvider: never fabricates a price, always SOURCE_REQUIRED', async () => {
  const provider = new NullMarketDataProvider();
  const quote = await provider.getQuote('RELIANCE');
  assert.equal(quote.price, null);
  assert.equal(quote.status, 'SOURCE_REQUIRED');
});

test('NullMarketDataProvider: healthCheck reports DOWN', async () => {
  const provider = new NullMarketDataProvider();
  const health = await provider.healthCheck();
  assert.equal(health.status, 'DOWN');
});

const SAMPLE_CSV_HEADER = 'SYMBOL,SERIES,CLOSE,TIMESTAMP';

test('parseBhavcopyCsv: valid CSV parses correctly with LIVE status for recent date', () => {
  const now = Date.parse('2026-01-15T10:00:00Z');
  const csv = `${SAMPLE_CSV_HEADER}\nRELIANCE,EQ,2500.50,2026-01-15\nTCS,EQ,3800.25,2026-01-15`;
  const quotes = parseBhavcopyCsv(csv, now, 1000 * 60 * 60 * 24 * 2);
  assert.equal(quotes.length, 2);
  assert.equal(quotes[0].symbol, 'RELIANCE');
  assert.equal(quotes[0].price, 2500.50);
  assert.equal(quotes[0].status, 'LIVE');
});

test('parseBhavcopyCsv: old date -> STALE, not silently treated as current', () => {
  const now = Date.parse('2026-01-15T10:00:00Z');
  const csv = `${SAMPLE_CSV_HEADER}\nRELIANCE,EQ,2500.50,2025-01-01`;
  const quotes = parseBhavcopyCsv(csv, now, 1000 * 60 * 60 * 24 * 2);
  assert.equal(quotes[0].status, 'STALE');
});

test('parseBhavcopyCsv: unparseable price -> MISSING, never a fabricated 0', () => {
  const now = Date.parse('2026-01-15T10:00:00Z');
  const csv = `${SAMPLE_CSV_HEADER}\nRELIANCE,EQ,NOT_A_NUMBER,2026-01-15`;
  const quotes = parseBhavcopyCsv(csv, now, 1000 * 60 * 60 * 24 * 2);
  assert.equal(quotes[0].price, null);
  assert.equal(quotes[0].status, 'MISSING');
});

test('parseBhavcopyCsv: malformed short row is skipped, does not crash the whole parse', () => {
  const now = Date.parse('2026-01-15T10:00:00Z');
  const csv = `${SAMPLE_CSV_HEADER}\nRELIANCE,EQ\nTCS,EQ,3800.25,2026-01-15`;
  const quotes = parseBhavcopyCsv(csv, now, 1000 * 60 * 60 * 24 * 2);
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].symbol, 'TCS');
});

test('parseBhavcopyCsv: missing required columns throws', () => {
  const csv = 'FOO,BAR\n1,2';
  assert.throws(() => parseBhavcopyCsv(csv, Date.now(), 1000));
});

test('parseBhavcopyCsv: empty/header-only CSV returns empty array, does not throw', () => {
  assert.deepEqual(parseBhavcopyCsv(SAMPLE_CSV_HEADER, Date.now(), 1000), []);
  assert.deepEqual(parseBhavcopyCsv('', Date.now(), 1000), []);
});

test('NseBhavcopyProvider: getQuote returns parsed data via injected fetcher (no real network)', async () => {
  const now = Date.parse('2026-01-15T10:00:00Z');
  const fetcher = async () => `${SAMPLE_CSV_HEADER}\nRELIANCE,EQ,2500.50,2026-01-15`;
  const provider = new NseBhavcopyProvider(fetcher);
  const quote = await provider.getQuote('RELIANCE', now);
  assert.equal(quote.price, 2500.50);
  assert.equal(quote.source, 'NSE_BHAVCOPY');
});

test('NseBhavcopyProvider: unknown symbol -> SOURCE_REQUIRED, not fabricated', async () => {
  const fetcher = async () => `${SAMPLE_CSV_HEADER}\nRELIANCE,EQ,2500.50,2026-01-15`;
  const provider = new NseBhavcopyProvider(fetcher);
  const quote = await provider.getQuote('NOT_A_REAL_SYMBOL');
  assert.equal(quote.status, 'SOURCE_REQUIRED');
});

test('NseBhavcopyProvider: healthCheck DOWN when fetcher throws, does not propagate the error', async () => {
  const fetcher = async () => { throw new Error('network unreachable'); };
  const provider = new NseBhavcopyProvider(fetcher);
  const health = await provider.healthCheck();
  assert.equal(health.status, 'DOWN');
  assert.ok(health.detail.includes('network unreachable'));
});

test('NseBhavcopyProvider (post-audit HIGH fix): cached quote status is recomputed against current `now`, not frozen at parse time', async () => {
  const t0 = Date.parse('2026-01-15T10:00:00Z');
  const staleThresholdMs = 1000 * 60 * 60 * 24; // 24h
  const fetcher = async () => `${SAMPLE_CSV_HEADER}\nRELIANCE,EQ,2500.50,2026-01-15`;
  const provider = new NseBhavcopyProvider(fetcher, staleThresholdMs);

  const atT0 = await provider.getQuote('RELIANCE', t0);
  assert.equal(atT0.status, 'LIVE');

  // Same cached observation, queried well past the staleness threshold —
  // must now report STALE, not the frozen LIVE from the first call.
  const wellPastThreshold = t0 + staleThresholdMs + 1000 * 60 * 60; // threshold + 1 more hour
  const later = await provider.getQuote('RELIANCE', wellPastThreshold);
  assert.equal(later.status, 'STALE');
  // The underlying price/asOf are unchanged — only the freshness classification moved.
  assert.equal(later.price, atT0.price);
  assert.equal(later.asOf, atT0.asOf);
});

test('NseBhavcopyProvider: constructor rejects invalid staleThresholdMs', () => {
  const fetcher = async () => SAMPLE_CSV_HEADER;
  assert.throws(() => new NseBhavcopyProvider(fetcher, -1));
  assert.throws(() => new NseBhavcopyProvider(fetcher, NaN));
  assert.throws(() => new NseBhavcopyProvider(fetcher, Infinity));
  assert.throws(() => new NseBhavcopyProvider(fetcher, 30.5));
  assert.doesNotThrow(() => new NseBhavcopyProvider(fetcher, 0));
});

// ================= NOTIFICATION PROVIDER =================

test('NullNotificationProvider: always fails closed, never claims success', async () => {
  const provider = new NullNotificationProvider();
  const result = await provider.send({ to: 'someone', body: 'hello' });
  assert.equal(result.success, false);
});

test('TelegramNotificationProvider: throws on empty/missing botToken (refuses to construct unauthenticated)', () => {
  const fakeHttp = { post: async () => ({ ok: true, status: 200, json: async () => ({ ok: true }) }) };
  assert.throws(() => new TelegramNotificationProvider('', fakeHttp));
  assert.throws(() => new TelegramNotificationProvider(null, fakeHttp));
});

test('TelegramNotificationProvider: successful send returns success with message id', async () => {
  const fakeHttp = {
    post: async (url, body) => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { message_id: 42 } }),
    }),
  };
  const provider = new TelegramNotificationProvider('fake-token', fakeHttp);
  const result = await provider.send({ to: '12345', body: 'Rotation alert: IT sector strong' });
  assert.equal(result.success, true);
  assert.equal(result.providerMessageId, '42');
});

test('TelegramNotificationProvider: sends correct URL and payload shape to the injected HTTP client', async () => {
  let capturedUrl = null;
  let capturedBody = null;
  const fakeHttp = {
    post: async (url, body) => {
      capturedUrl = url;
      capturedBody = body;
      return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 1 } }) };
    },
  };
  const provider = new TelegramNotificationProvider('my-secret-token', fakeHttp);
  await provider.send({ to: '999', body: 'test message' });
  assert.equal(capturedUrl, 'https://api.telegram.org/botmy-secret-token/sendMessage');
  assert.equal(capturedBody.chat_id, '999');
  assert.equal(capturedBody.text, 'test message');
});

test('TelegramNotificationProvider: non-ok HTTP status fails closed', async () => {
  const fakeHttp = { post: async () => ({ ok: false, status: 500, json: async () => ({}) }) };
  const provider = new TelegramNotificationProvider('fake-token', fakeHttp);
  const result = await provider.send({ to: '1', body: 'x' });
  assert.equal(result.success, false);
  assert.match(result.reason, /500/);
});

test('TelegramNotificationProvider: API-level ok:false fails closed', async () => {
  const fakeHttp = {
    post: async () => ({ ok: true, status: 200, json: async () => ({ ok: false, description: 'chat not found' }) }),
  };
  const provider = new TelegramNotificationProvider('fake-token', fakeHttp);
  const result = await provider.send({ to: '1', body: 'x' });
  assert.equal(result.success, false);
  assert.match(result.reason, /chat not found/);
});

test('TelegramNotificationProvider: httpClient throwing does not propagate — fails closed instead', async () => {
  const fakeHttp = { post: async () => { throw new Error('DNS failure'); } };
  const provider = new TelegramNotificationProvider('fake-token', fakeHttp);
  await assert.doesNotReject(() => provider.send({ to: '1', body: 'x' }));
  const result = await provider.send({ to: '1', body: 'x' });
  assert.equal(result.success, false);
  assert.match(result.reason, /DNS failure/);
});

// ================= PROVIDER REGISTRY =================

test('ProviderRegistry: register + get works, unregistered name returns undefined via get()', () => {
  const registry = new ProviderRegistry();
  const provider = new NullNotificationProvider();
  registry.register(provider);
  assert.equal(registry.get('NONE_CONFIGURED_NOTIFICATION'), provider);
  assert.equal(registry.get('DOES_NOT_EXIST'), undefined);
});

test('ProviderRegistry: getOrThrow fails closed on unregistered name', () => {
  const registry = new ProviderRegistry();
  assert.throws(() => registry.getOrThrow('NOTHING_HERE'));
});

test('ProviderRegistry (post-audit fix): duplicate registration is rejected, original provider remains intact', () => {
  const registry = new ProviderRegistry();
  const providerA = new NullNotificationProvider();
  registry.register(providerA);

  // A second registration under the SAME name must be rejected, not silently swap in a new instance.
  const providerB = new NullNotificationProvider(); // same .name = 'NONE_CONFIGURED_NOTIFICATION'
  assert.throws(() => registry.register(providerB));

  // The original registration must be untouched — this is the actual property being protected.
  assert.equal(registry.get('NONE_CONFIGURED_NOTIFICATION'), providerA);
  assert.notEqual(registry.get('NONE_CONFIGURED_NOTIFICATION'), providerB);
});

test('ProviderRegistry: replace() is the explicit, sanctioned way to overwrite a registration', () => {
  const registry = new ProviderRegistry();
  const providerA = new NullNotificationProvider();
  const providerB = new NullNotificationProvider();
  registry.register(providerA);
  registry.replace(providerB);
  assert.equal(registry.get('NONE_CONFIGURED_NOTIFICATION'), providerB);
});

test('ProviderRegistry: list returns registered provider names', () => {
  const registry = new ProviderRegistry();
  registry.register(new NullMarketDataProvider());
  registry.register(new NullNotificationProvider());
  const names = registry.list();
  assert.ok(names.includes('NONE_CONFIGURED_MARKET_DATA'));
  assert.ok(names.includes('NONE_CONFIGURED_NOTIFICATION'));
});

// ================= PROVIDER CONFIG (secrets integration) =================

test('loadTelegramConfig: throws with key name only when TELEGRAM_BOT_TOKEN is missing, never a fabricated default', () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.throws(() => loadTelegramConfig(), (err) => err.message === 'Missing required secret: TELEGRAM_BOT_TOKEN');
});

test('loadTelegramConfig: returns the token when present', () => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token-value';
  const config = loadTelegramConfig();
  assert.equal(config.botToken, 'test-token-value');
  delete process.env.TELEGRAM_BOT_TOKEN;
});

test('loadUpstoxConfig: throws when either credential is missing', () => {
  delete process.env.UPSTOX_API_KEY;
  delete process.env.UPSTOX_API_SECRET;
  assert.throws(() => loadUpstoxConfig());
});
