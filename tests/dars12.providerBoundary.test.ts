const test = require('node:test');
const assert = require('node:assert/strict');
const { quoteToDarsEvent, fetchDarsEvents } = require('../backend/src/dars12/providerDarsBoundary.ts');

const liveQuote = (o={}) => ({
  symbol:'RELIANCE', price:2500.5, status:'LIVE', asOf:1000, source:'NSE_BHAVCOPY', ...o
});

test('provider boundary: LIVE quote becomes RAW VERIFIED DARS event with provenance', () => {
  const r = quoteToDarsEvent(liveQuote(), 2000, 'evt-1');
  assert.equal(r.event.verificationStatus, 'VERIFIED');
  assert.equal(r.event.dataNature, 'RAW');
  assert.equal(r.event.sourceTimestamp, 1000);
  assert.equal(r.event.effectiveTime, 1000);
  assert.equal(r.event.knowledgeTime, 2000);
  assert.equal(r.event.value, '2500.5');
});

test('provider boundary: missing price/timestamp never creates DARS evidence', () => {
  assert.equal(quoteToDarsEvent(liveQuote({price:null}), 2000, 'evt-1').event, null);
  assert.equal(quoteToDarsEvent(liveQuote({asOf:null}), 2000, 'evt-1').event, null);
});

test('provider boundary: future observation is rejected, never time-travelled into DARS', () => {
  const r = quoteToDarsEvent(liveQuote({asOf:3000}), 2000, 'evt-1');
  assert.equal(r.event, null);
  assert.equal(r.status, 'UNKNOWN');
});

test('provider boundary: SOURCE_REQUIRED cannot enter DARS as VERIFIED', () => {
  const r = quoteToDarsEvent(liveQuote({price:null,status:'SOURCE_REQUIRED',asOf:null}), 2000, 'evt-1');
  assert.equal(r.event, null);
});

test('provider boundary: provider health failure blocks fetch and creates no synthetic events', async () => {
  const provider = {
    name:'TEST_PROVIDER',
    healthCheck: async () => ({providerName:'TEST_PROVIDER',status:'DOWN',lastCheckedAt:2000,detail:'offline'}),
    getQuote: async () => { throw new Error('must not fetch while unhealthy'); }
  };
  const r = await fetchDarsEvents(provider, ['AAA','BBB'], 2000);
  assert.equal(r.providerHealthy, false);
  assert.deepEqual(r.events, []);
  assert.deepEqual(r.errors, ['offline']);
});

test('provider boundary: healthy provider yields only usable events and reports rejected symbols', async () => {
  const provider = {
    name:'TEST_PROVIDER',
    healthCheck: async () => ({providerName:'TEST_PROVIDER',status:'HEALTHY',lastCheckedAt:2000}),
    getQuote: async (symbol) => symbol === 'AAA'
      ? liveQuote({symbol,source:'TEST_PROVIDER'})
      : liveQuote({symbol,price:null,asOf:null})
  };
  const r = await fetchDarsEvents(provider, ['AAA','BBB'], 2000);
  assert.equal(r.providerHealthy, true);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].symbol, 'AAA');
  assert.match(r.errors[0], /BBB/);
});
