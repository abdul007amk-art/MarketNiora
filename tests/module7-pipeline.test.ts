const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeQuote } = require('../backend/src/pipeline/normalize.ts');
const { validateObservation } = require('../backend/src/pipeline/validate.ts');
const { deduplicateObservations } = require('../backend/src/pipeline/deduplicate.ts');
const { resolveConflicts } = require('../backend/src/pipeline/conflictResolution.ts');
const { qualityCheck } = require('../backend/src/pipeline/qualityCheck.ts');
const { InMemoryRawObservationStore } = require('../backend/src/pipeline/rawObservationStore.ts');
const { InMemoryCanonicalObservationStore } = require('../backend/src/pipeline/canonicalObservationStore.ts');
const { InMemoryJobLogStore } = require('../backend/src/pipeline/jobLogStore.ts');
const { runPipeline } = require('../backend/src/pipeline/pipeline.ts');

function makeQuote(overrides = {}) {
  return { symbol: 'RELIANCE', price: 2500, status: 'LIVE', asOf: 1_700_000_000_000, source: 'TEST_SOURCE', ...overrides };
}

// ================= NORMALIZE =================

test('normalizeQuote: maps fields correctly', () => {
  const quote = makeQuote();
  const obs = normalizeQuote(quote, 'close_price');
  assert.equal(obs.symbol, 'RELIANCE');
  assert.equal(obs.metric, 'close_price');
  assert.equal(obs.value, 2500);
  assert.equal(obs.source, 'TEST_SOURCE');
  assert.equal(obs.sourceTimestamp, 1_700_000_000_000);
});

test('normalizeQuote: LIVE/DELAYED -> VERIFIED, STALE -> UNVERIFIED, everything else -> SOURCE_REQUIRED', () => {
  assert.equal(normalizeQuote(makeQuote({ status: 'LIVE' }), 'm').verificationStatus, 'VERIFIED');
  assert.equal(normalizeQuote(makeQuote({ status: 'DELAYED' }), 'm').verificationStatus, 'VERIFIED');
  assert.equal(normalizeQuote(makeQuote({ status: 'STALE' }), 'm').verificationStatus, 'UNVERIFIED');
  assert.equal(normalizeQuote(makeQuote({ status: 'MISSING' }), 'm').verificationStatus, 'SOURCE_REQUIRED');
  assert.equal(normalizeQuote(makeQuote({ status: 'UNKNOWN' }), 'm').verificationStatus, 'SOURCE_REQUIRED');
});

test('normalizeQuote: UNKNOWN status never gets silently upgraded to VERIFIED', () => {
  const obs = normalizeQuote(makeQuote({ status: 'UNKNOWN' }), 'close_price');
  assert.notEqual(obs.verificationStatus, 'VERIFIED');
});

test('normalizeQuote (post-audit): dataNature is NORMALIZED, formulaVersion is null (no formula applied at this stage)', () => {
  const obs = normalizeQuote(makeQuote(), 'close_price');
  assert.equal(obs.dataNature, 'NORMALIZED');
  assert.equal(obs.formulaVersion, null);
});

// ================= VALIDATE =================

test('validateObservation: well-formed observation is valid', () => {
  const obs = normalizeQuote(makeQuote(), 'close_price');
  const result = validateObservation(obs, 1_700_000_001_000);
  assert.equal(result.valid, true);
});

test('validateObservation: missing symbol/metric/source rejected', () => {
  const base = normalizeQuote(makeQuote(), 'close_price');
  assert.equal(validateObservation({ ...base, symbol: '' }, Date.now()).valid, false);
  assert.equal(validateObservation({ ...base, metric: '' }, Date.now()).valid, false);
  assert.equal(validateObservation({ ...base, source: '' }, Date.now()).valid, false);
});

test('validateObservation: null sourceTimestamp rejected (never trusted as current)', () => {
  const base = normalizeQuote(makeQuote({ asOf: null }), 'close_price');
  const result = validateObservation(base, Date.now());
  assert.equal(result.valid, false);
});

test('validateObservation: future sourceTimestamp rejected', () => {
  const now = 1_700_000_000_000;
  const base = normalizeQuote(makeQuote({ asOf: now + 10_000 }), 'close_price');
  const result = validateObservation(base, now);
  assert.equal(result.valid, false);
});

test('validateObservation: NaN/Infinity value rejected, null value allowed', () => {
  const base = normalizeQuote(makeQuote(), 'close_price');
  assert.equal(validateObservation({ ...base, value: NaN }, Date.now()).valid, false);
  assert.equal(validateObservation({ ...base, value: Infinity }, Date.now()).valid, false);
  assert.equal(validateObservation({ ...base, value: null }, base.sourceTimestamp + 1).valid, true);
});

test('validateObservation: invalid verificationStatus rejected', () => {
  const base = normalizeQuote(makeQuote(), 'close_price');
  assert.equal(validateObservation({ ...base, verificationStatus: 'MADE_UP_STATUS' }, Date.now()).valid, false);
});

test('validateObservation (post-audit): invalid dataNature rejected', () => {
  const base = normalizeQuote(makeQuote(), 'close_price');
  assert.equal(validateObservation({ ...base, dataNature: 'NOT_A_REAL_NATURE' }, Date.now()).valid, false);
});

test('validateObservation (post-audit): DERIVED without formulaVersion rejected', () => {
  const base = normalizeQuote(makeQuote(), 'close_price');
  const result = validateObservation({ ...base, dataNature: 'DERIVED', formulaVersion: null }, Date.now());
  assert.equal(result.valid, false);
});

test('validateObservation (post-audit): DERIVED with a formulaVersion is valid', () => {
  const base = normalizeQuote(makeQuote(), 'close_price');
  const result = validateObservation({ ...base, dataNature: 'DERIVED', formulaVersion: 'SS-1.0-R3' }, base.sourceTimestamp + 1);
  assert.equal(result.valid, true);
});

test('validateObservation (post-audit): non-DERIVED with a non-null formulaVersion rejected (inconsistent combination)', () => {
  const base = normalizeQuote(makeQuote(), 'close_price');
  const result = validateObservation({ ...base, dataNature: 'NORMALIZED', formulaVersion: 'SS-1.0-R3' }, Date.now());
  assert.equal(result.valid, false);
});

// ================= DEDUPLICATE =================

test('deduplicateObservations: exact duplicates (same symbol+metric+source+timestamp) collapse to one', () => {
  const obs = normalizeQuote(makeQuote(), 'close_price');
  const result = deduplicateObservations([obs, { ...obs }, { ...obs }]);
  assert.equal(result.length, 1);
});

test('deduplicateObservations: different sources for the same symbol/metric/time are NOT deduplicated', () => {
  const obsA = normalizeQuote(makeQuote({ source: 'SOURCE_A' }), 'close_price');
  const obsB = normalizeQuote(makeQuote({ source: 'SOURCE_B' }), 'close_price');
  const result = deduplicateObservations([obsA, obsB]);
  assert.equal(result.length, 2);
});

test('deduplicateObservations: different timestamps are NOT deduplicated', () => {
  const obsA = normalizeQuote(makeQuote({ asOf: 1000 }), 'close_price');
  const obsB = normalizeQuote(makeQuote({ asOf: 2000 }), 'close_price');
  const result = deduplicateObservations([obsA, obsB]);
  assert.equal(result.length, 2);
});

// ================= CONFLICT RESOLUTION =================

test('resolveConflicts: single observation per symbol/metric -> no conflict, passes through', () => {
  const obs = normalizeQuote(makeQuote(), 'close_price');
  const { resolved, conflicts } = resolveConflicts([obs]);
  assert.equal(resolved.length, 1);
  assert.equal(conflicts.length, 0);
});

test('resolveConflicts: same value from multiple sources is NOT a genuine conflict', () => {
  const obsA = normalizeQuote(makeQuote({ source: 'SOURCE_A', price: 2500 }), 'close_price');
  const obsB = normalizeQuote(makeQuote({ source: 'SOURCE_B', price: 2500 }), 'close_price');
  const { resolved, conflicts } = resolveConflicts([obsA, obsB]);
  assert.equal(resolved.length, 1);
  assert.equal(conflicts.length, 0);
});

test('resolveConflicts: different values -> genuine conflict, higher verification status wins', () => {
  const obsA = normalizeQuote(makeQuote({ source: 'SOURCE_A', price: 2500, status: 'UNKNOWN' }), 'close_price'); // -> SOURCE_REQUIRED
  const obsB = normalizeQuote(makeQuote({ source: 'SOURCE_B', price: 2600, status: 'LIVE' }), 'close_price'); // -> VERIFIED
  const { resolved, conflicts } = resolveConflicts([obsA, obsB]);
  assert.equal(conflicts.length, 1);
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].source, 'SOURCE_B'); // VERIFIED beats SOURCE_REQUIRED
});

test('resolveConflicts: tie on verification status -> more recent timestamp wins', () => {
  const obsA = normalizeQuote(makeQuote({ source: 'SOURCE_A', price: 2500, status: 'LIVE', asOf: 1000 }), 'close_price');
  const obsB = normalizeQuote(makeQuote({ source: 'SOURCE_B', price: 2600, status: 'LIVE', asOf: 2000 }), 'close_price');
  const { resolved } = resolveConflicts([obsA, obsB]);
  assert.equal(resolved[0].source, 'SOURCE_B');
});

test('resolveConflicts: tie on status AND timestamp -> alphabetically-first source wins (deterministic)', () => {
  const obsA = normalizeQuote(makeQuote({ source: 'ZEBRA_SOURCE', price: 2500, status: 'LIVE', asOf: 1000 }), 'close_price');
  const obsB = normalizeQuote(makeQuote({ source: 'ALPHA_SOURCE', price: 2600, status: 'LIVE', asOf: 1000 }), 'close_price');
  const { resolved } = resolveConflicts([obsA, obsB]);
  assert.equal(resolved[0].source, 'ALPHA_SOURCE');
});

test('resolveConflicts: conflict record captures all candidates for audit, not just the winner', () => {
  const obsA = normalizeQuote(makeQuote({ source: 'SOURCE_A', price: 2500, status: 'LIVE' }), 'close_price');
  const obsB = normalizeQuote(makeQuote({ source: 'SOURCE_B', price: 2600, status: 'LIVE' }), 'close_price');
  const { conflicts } = resolveConflicts([obsA, obsB]);
  assert.equal(conflicts[0].candidates.length, 2);
});

// ================= QUALITY CHECK =================

test('qualityCheck: positive plausible price passes', () => {
  const obs = normalizeQuote(makeQuote({ price: 2500 }), 'close_price');
  assert.equal(qualityCheck(obs).passed, true);
});

test('qualityCheck: zero or negative price fails', () => {
  assert.equal(qualityCheck(normalizeQuote(makeQuote({ price: 0 }), 'close_price')).passed, false);
  assert.equal(qualityCheck(normalizeQuote(makeQuote({ price: -100 }), 'close_price')).passed, false);
});

test('qualityCheck: absurdly large price flagged, not silently accepted', () => {
  const obs = normalizeQuote(makeQuote({ price: 50_000_000 }), 'close_price');
  assert.equal(qualityCheck(obs).passed, false);
});

test('qualityCheck: null value passes (MISSING data is not a quality violation, it is a status)', () => {
  const obs = normalizeQuote(makeQuote({ price: null, status: 'MISSING', asOf: null }), 'close_price');
  assert.equal(qualityCheck(obs).passed, true);
});

// ================= STORES (append-only foundation) =================

test('InMemoryRawObservationStore: append + getAll, no mutation method exists', () => {
  const store = new InMemoryRawObservationStore();
  store.append(makeQuote(), 1000);
  store.append(makeQuote(), 2000);
  assert.equal(store.getAll().length, 2);
  assert.equal(typeof store.update, 'undefined');
  assert.equal(typeof store.delete, 'undefined');
});

test('InMemoryRawObservationStore (post-audit): mutating the object passed to append() does not corrupt the stored record', () => {
  const store = new InMemoryRawObservationStore();
  const quote = makeQuote({ price: 2500 });
  store.append(quote, 1000);

  quote.price = 999999; // caller mutates their own object after the call

  const stored = store.getAll()[0];
  assert.equal(stored.quote.price, 2500, 'stored record must be unaffected by later caller-side mutation');
});

test('InMemoryRawObservationStore (post-audit): mutating a record returned by getAll() does not corrupt the store', () => {
  const store = new InMemoryRawObservationStore();
  store.append(makeQuote({ price: 2500 }), 1000);

  const records = store.getAll();
  records[0].quote.price = 999999; // caller mutates the returned snapshot

  const recheck = store.getAll();
  assert.equal(recheck[0].quote.price, 2500, 'internal store state must be unaffected by mutation of a previously-returned snapshot');
});

test('InMemoryCanonicalObservationStore: insert assigns observationId and insertedAt', async () => {
  const store = new InMemoryCanonicalObservationStore();
  const obs = normalizeQuote(makeQuote(), 'close_price');
  const record = await store.insert(obs, 12345);
  assert.ok(record.observationId);
  assert.equal(record.insertedAt, 12345);
  assert.equal(store.getAll().length, 1);
});

test('InMemoryCanonicalObservationStore (post-audit): mutating a returned record does not corrupt the store', async () => {
  const store = new InMemoryCanonicalObservationStore();
  const obs = normalizeQuote(makeQuote({ price: 2500 }), 'close_price');
  const record = await store.insert(obs, 12345);
  record.value = 999999;

  const recheck = store.getAll();
  assert.equal(recheck[0].value, 2500, 'internal store state must be unaffected by mutation of the returned insert() result');

  recheck[0].value = -1;
  const recheckAgain = store.getAll();
  assert.equal(recheckAgain[0].value, 2500, 'internal store state must be unaffected by mutation of a getAll() snapshot');
});

test('InMemoryJobLogStore: append + getAll, no mutation method exists', () => {
  const store = new InMemoryJobLogStore();
  store.append({ jobId: 'a', startedAt: 1, completedAt: 2, status: 'SUCCESS', recordsFetched: 1, recordsValidated: 1, recordsRejected: 0, recordsConflicted: 0, recordsCanonicalized: 1 });
  assert.equal(store.getAll().length, 1);
  assert.equal(typeof store.update, 'undefined');
});

test('InMemoryJobLogStore (post-audit): mutating a returned entry does not corrupt the store', () => {
  const store = new InMemoryJobLogStore();
  const entry = { jobId: 'a', startedAt: 1, completedAt: 2, status: 'SUCCESS', recordsFetched: 5, recordsValidated: 5, recordsRejected: 0, recordsConflicted: 0, recordsCanonicalized: 5 };
  store.append(entry);
  entry.recordsFetched = 999; // caller mutates their own object after append

  const stored = store.getAll()[0];
  assert.equal(stored.recordsFetched, 5, 'stored entry must be unaffected by later caller-side mutation');

  stored.recordsFetched = -1; // caller mutates the returned snapshot
  const recheck = store.getAll();
  assert.equal(recheck[0].recordsFetched, 5, 'internal store state must be unaffected by mutation of a previously-returned snapshot');
});

// ================= FULL PIPELINE ORCHESTRATION =================

test('runPipeline: clean quotes flow all the way through to canonical store, status SUCCESS', async () => {
  const rawStore = new InMemoryRawObservationStore();
  const canonicalStore = new InMemoryCanonicalObservationStore();
  const jobLogStore = new InMemoryJobLogStore();
  const now = 1_700_000_001_000;

  const quotes = [
    makeQuote({ symbol: 'RELIANCE', price: 2500, asOf: 1_700_000_000_000 }),
    makeQuote({ symbol: 'TCS', price: 3800, asOf: 1_700_000_000_000 }),
  ];

  const result = await runPipeline(quotes, 'close_price', rawStore, canonicalStore, jobLogStore, now);

  assert.equal(result.canonicalRecords.length, 2);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.jobLog.status, 'SUCCESS');
  assert.equal(rawStore.getAll().length, 2, 'raw store must record every fetched quote, even successful ones');
  assert.equal(jobLogStore.getAll().length, 1);
});

test('runPipeline: bad-quality quote is rejected and does not reach canonical store, status PARTIAL', async () => {
  const rawStore = new InMemoryRawObservationStore();
  const canonicalStore = new InMemoryCanonicalObservationStore();
  const jobLogStore = new InMemoryJobLogStore();
  const now = 1_700_000_001_000;

  const quotes = [
    makeQuote({ symbol: 'RELIANCE', price: 2500, asOf: 1_700_000_000_000 }),
    makeQuote({ symbol: 'BADSTOCK', price: -50, asOf: 1_700_000_000_000 }), // fails quality check
  ];

  const result = await runPipeline(quotes, 'close_price', rawStore, canonicalStore, jobLogStore, now);

  assert.equal(result.canonicalRecords.length, 1);
  assert.equal(result.rejected.length, 1);
  assert.equal(result.jobLog.status, 'PARTIAL');
  // Raw store still has BOTH — provenance is preserved even for rejected data.
  assert.equal(rawStore.getAll().length, 2);
});

test('runPipeline: all quotes bad -> status FAILURE, nothing reaches canonical store', async () => {
  const rawStore = new InMemoryRawObservationStore();
  const canonicalStore = new InMemoryCanonicalObservationStore();
  const jobLogStore = new InMemoryJobLogStore();
  const now = 1_700_000_001_000;

  const quotes = [makeQuote({ symbol: 'BADSTOCK', price: -50, asOf: 1_700_000_000_000 })];
  const result = await runPipeline(quotes, 'close_price', rawStore, canonicalStore, jobLogStore, now);

  assert.equal(result.canonicalRecords.length, 0);
  assert.equal(result.jobLog.status, 'FAILURE');
});

test('runPipeline: conflicting sources resolve to one canonical record, conflict is reported', async () => {
  const rawStore = new InMemoryRawObservationStore();
  const canonicalStore = new InMemoryCanonicalObservationStore();
  const jobLogStore = new InMemoryJobLogStore();
  const now = 1_700_000_001_000;

  const quotes = [
    makeQuote({ symbol: 'RELIANCE', source: 'SOURCE_A', price: 2500, status: 'UNKNOWN', asOf: 1_700_000_000_000 }),
    makeQuote({ symbol: 'RELIANCE', source: 'SOURCE_B', price: 2600, status: 'LIVE', asOf: 1_700_000_000_000 }),
  ];

  const result = await runPipeline(quotes, 'close_price', rawStore, canonicalStore, jobLogStore, now);

  assert.equal(result.canonicalRecords.length, 1);
  assert.equal(result.canonicalRecords[0].source, 'SOURCE_B');
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.jobLog.recordsConflicted, 1);
});

test('runPipeline: raw store preserves BOTH conflicting observations even though only one becomes canonical', async () => {
  const rawStore = new InMemoryRawObservationStore();
  const canonicalStore = new InMemoryCanonicalObservationStore();
  const jobLogStore = new InMemoryJobLogStore();
  const now = 1_700_000_001_000;

  const quotes = [
    makeQuote({ symbol: 'RELIANCE', source: 'SOURCE_A', price: 2500, status: 'UNKNOWN', asOf: 1_700_000_000_000 }),
    makeQuote({ symbol: 'RELIANCE', source: 'SOURCE_B', price: 2600, status: 'LIVE', asOf: 1_700_000_000_000 }),
  ];
  await runPipeline(quotes, 'close_price', rawStore, canonicalStore, jobLogStore, now);
  assert.equal(rawStore.getAll().length, 2);
});
