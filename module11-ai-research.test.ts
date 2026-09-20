const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { InMemorySourceRegistry } = require('../backend/src/research/permittedSources.ts');
const { processDiscovery, validateResearchEvent } = require('../backend/src/research/researchEvent.ts');
const { reviewResearchEvent } = require('../backend/src/research/reviewGate.ts');
const { dispatchApprovedEventAlert } = require('../backend/src/research/alertDispatch.ts');
const { hasPermission } = require('../backend/src/security/rbac.ts');

function makeRegistry() {
  const registry = new InMemorySourceRegistry();
  registry.register({ sourceId: 'NSE_FILINGS', name: 'NSE Corporate Filings', sourceType: 'EXCHANGE_FILING', active: true });
  registry.register({ sourceId: 'REVOKED_SOURCE', name: 'Old Feed', sourceType: 'LICENSED_NEWS_FEED', active: false });
  return registry;
}

function makeDiscovery(overrides = {}) {
  return { sourceId: 'NSE_FILINGS', stockId: 'STOCK_X', headline: 'Company announces capacity expansion', summary: 'Board approved new plant.', discoveredAt: 1_700_000_000_000, ...overrides };
}

// ================= PERMITTED SOURCES =================

test('InMemorySourceRegistry: isPermitted true for active registered source', () => {
  const registry = makeRegistry();
  assert.equal(registry.isPermitted('NSE_FILINGS'), true);
});

test('InMemorySourceRegistry: isPermitted false for unknown source (fail closed)', () => {
  const registry = makeRegistry();
  assert.equal(registry.isPermitted('RANDOM_UNKNOWN_SOURCE'), false);
});

test('InMemorySourceRegistry: isPermitted false for a deactivated (revoked) source', () => {
  const registry = makeRegistry();
  assert.equal(registry.isPermitted('REVOKED_SOURCE'), false);
});

test('InMemorySourceRegistry: register rejects duplicate sourceId', () => {
  const registry = makeRegistry();
  assert.throws(() => registry.register({ sourceId: 'NSE_FILINGS', name: 'Dup', sourceType: 'EXCHANGE_FILING', active: true }));
});

test('InMemorySourceRegistry: deactivate turns an active source unpermitted', () => {
  const registry = makeRegistry();
  registry.deactivate('NSE_FILINGS');
  assert.equal(registry.isPermitted('NSE_FILINGS'), false);
});

// ================= AI DISCOVERY + SOURCE VERIFICATION =================

test('processDiscovery: discovery from a permitted source is accepted as UNVERIFIED/PENDING', () => {
  const registry = makeRegistry();
  const result = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  assert.equal(result.accepted, true);
  assert.equal(result.event.provenance.verificationStatus, 'UNVERIFIED');
  assert.equal(result.event.reviewStatus, 'PENDING');
});

test('processDiscovery: discovery from an UNKNOWN source is rejected outright, never becomes an event', () => {
  const registry = makeRegistry();
  const result = processDiscovery(makeDiscovery({ sourceId: 'NOT_A_REAL_SOURCE' }), registry, 1_700_000_001_000);
  assert.equal(result.accepted, false);
  assert.equal(result.event, null);
});

test('processDiscovery: discovery from a DEACTIVATED source is rejected', () => {
  const registry = makeRegistry();
  const result = processDiscovery(makeDiscovery({ sourceId: 'REVOKED_SOURCE' }), registry, 1_700_000_001_000);
  assert.equal(result.accepted, false);
});

test('processDiscovery: missing headline/summary rejected', () => {
  const registry = makeRegistry();
  assert.equal(processDiscovery(makeDiscovery({ headline: '' }), registry, 1_700_000_001_000).accepted, false);
  assert.equal(processDiscovery(makeDiscovery({ summary: '' }), registry, 1_700_000_001_000).accepted, false);
});

test('processDiscovery: future discoveredAt rejected', () => {
  const registry = makeRegistry();
  const now = 1_700_000_000_000;
  const result = processDiscovery(makeDiscovery({ discoveredAt: now + 10_000 }), registry, now);
  assert.equal(result.accepted, false);
});

test('validateResearchEvent: well-formed event valid; missing headline invalid', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  assert.equal(validateResearchEvent(event).valid, true);
  assert.equal(validateResearchEvent({ ...event, headline: '' }).valid, false);
});

test('Finding 11-A CLOSED: promoteToVerified is NOT exported from researchEvent.ts — no import path exists for any caller to reach it directly', () => {
  const source = fs.readFileSync('backend/src/research/researchEvent.ts', 'utf8');
  assert.equal(/export\s+function\s+promoteToVerified/.test(source), false, 'promoteToVerified must not be an exported function of researchEvent.ts');
  assert.equal(/export\s*\{[^}]*promoteToVerified/.test(source), false, 'promoteToVerified must not appear in any export statement');
  // Confirm the module object itself has no such property at runtime, too.
  const researchEventModule = require('../backend/src/research/researchEvent.ts');
  assert.equal(typeof researchEventModule.promoteToVerified, 'undefined');
});

test('Finding 11-A CLOSED: the ONLY way to reach VERIFIED is through reviewResearchEvent() with a permitted role', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  // AI_AGENT attempting the review path (the only remaining path to VERIFIED) is denied, and the event is unchanged.
  const aiAttempt = reviewResearchEvent(event, 'AI_AGENT', 'APPROVE');
  assert.equal(aiAttempt.allowed, false);
  assert.equal(aiAttempt.event, null);
  assert.equal(event.provenance.verificationStatus, 'UNVERIFIED', 'the original event object must remain untouched after a denied attempt');
});

// ================= REVIEW GATE — AI authority boundary =================

test('reviewResearchEvent: OWNER can approve', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  const result = reviewResearchEvent(event, 'OWNER', 'APPROVE');
  assert.equal(result.allowed, true);
  assert.equal(result.event.reviewStatus, 'APPROVED');
  assert.equal(result.event.provenance.verificationStatus, 'VERIFIED');
});

test('reviewResearchEvent: ADMIN can approve too (Master Guide: "Owner/Admin Review")', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  const result = reviewResearchEvent(event, 'ADMIN', 'APPROVE');
  assert.equal(result.allowed, true);
});

test('reviewResearchEvent: AI_AGENT can NEVER approve or reject — DENY under any decision', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  assert.equal(reviewResearchEvent(event, 'AI_AGENT', 'APPROVE').allowed, false);
  assert.equal(reviewResearchEvent(event, 'AI_AGENT', 'REJECT').allowed, false);
});

test('reviewResearchEvent: USER lacks REVIEW_AI_RESEARCH, denied', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  const result = reviewResearchEvent(event, 'USER', 'APPROVE');
  assert.equal(result.allowed, false);
});

test('reviewResearchEvent: null/undefined role denied, never throws', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  assert.equal(reviewResearchEvent(event, null, 'APPROVE').allowed, false);
  assert.equal(reviewResearchEvent(event, undefined, 'APPROVE').allowed, false);
});

test('Finding 11-B CLOSED: an unrecognized decision value is DENIED, not silently treated as REJECT', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  const result = reviewResearchEvent(event, 'OWNER', 'WHATEVER_THIS_IS_NOT_A_REAL_DECISION');
  assert.equal(result.allowed, false);
  assert.equal(result.event, null);
  assert.match(result.reason, /unrecognized decision/);
});

test('Finding 11-B: empty string / null decision also denied', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  assert.equal(reviewResearchEvent(event, 'OWNER', '').allowed, false);
  assert.equal(reviewResearchEvent(event, 'OWNER', null).allowed, false);
});

test('reviewResearchEvent: REJECT leaves provenance untouched, only flips reviewStatus', () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  const result = reviewResearchEvent(event, 'OWNER', 'REJECT');
  assert.equal(result.event.reviewStatus, 'REJECTED');
  assert.equal(result.event.provenance.verificationStatus, 'UNVERIFIED');
});

test('RBAC: AI_AGENT has zero permissions including the new REVIEW_AI_RESEARCH (regression check tying Module 3 + Module 11 together)', () => {
  assert.equal(hasPermission('AI_AGENT', 'REVIEW_AI_RESEARCH'), false);
  assert.equal(hasPermission('USER', 'REVIEW_AI_RESEARCH'), false);
  assert.equal(hasPermission('OWNER', 'REVIEW_AI_RESEARCH'), true);
  assert.equal(hasPermission('ADMIN', 'REVIEW_AI_RESEARCH'), true);
});

// ================= ALERT DISPATCH =================

test('dispatchApprovedEventAlert: PENDING event is refused, notification provider never called', async () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  let called = false;
  const fakeProvider = { name: 'FAKE', send: async () => { called = true; return { success: true, providerMessageId: '1', reason: 'sent' }; } };
  const result = await dispatchApprovedEventAlert(event, 'chat123', fakeProvider);
  assert.equal(result.dispatched, false);
  assert.equal(called, false, 'notification provider must never be invoked for a non-APPROVED event');
});

test('dispatchApprovedEventAlert: REJECTED event is refused', async () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  const rejected = { ...event, reviewStatus: 'REJECTED' };
  const fakeProvider = { name: 'FAKE', send: async () => ({ success: true, providerMessageId: '1', reason: 'sent' }) };
  const result = await dispatchApprovedEventAlert(rejected, 'chat123', fakeProvider);
  assert.equal(result.dispatched, false);
});

test('dispatchApprovedEventAlert: APPROVED event dispatches through the provider and reports success', async () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  const reviewed = reviewResearchEvent(event, 'OWNER', 'APPROVE').event;
  let capturedBody = null;
  const fakeProvider = {
    name: 'FAKE',
    send: async (msg) => { capturedBody = msg.body; return { success: true, providerMessageId: '99', reason: 'sent' }; },
  };
  const result = await dispatchApprovedEventAlert(reviewed, 'chat123', fakeProvider);
  assert.equal(result.dispatched, true);
  assert.ok(capturedBody.includes(event.headline));
});

test('dispatchApprovedEventAlert: provider failure propagates as dispatched=false with reason', async () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  const reviewed = reviewResearchEvent(event, 'OWNER', 'APPROVE').event;
  const failingProvider = { name: 'FAKE', send: async () => ({ success: false, providerMessageId: null, reason: 'network down' }) };
  const result = await dispatchApprovedEventAlert(reviewed, 'chat123', failingProvider);
  assert.equal(result.dispatched, false);
  assert.match(result.reason, /network down/);
});

test('Finding 11-C CLOSED: a forged event (reviewStatus=APPROVED but verificationStatus still UNVERIFIED) is refused, provider never called', async () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  // Simulate a caller who bypassed reviewResearchEvent and hand-built an
  // inconsistent object: APPROVED review status without the matching
  // VERIFIED provenance that only the review gate is supposed to set.
  const forged = { ...event, reviewStatus: 'APPROVED' }; // provenance.verificationStatus is still UNVERIFIED here
  let called = false;
  const fakeProvider = { name: 'FAKE', send: async () => { called = true; return { success: true, providerMessageId: '1', reason: 'sent' }; } };
  const result = await dispatchApprovedEventAlert(forged, 'chat123', fakeProvider);
  assert.equal(result.dispatched, false);
  assert.equal(called, false, 'provider must never be invoked for an APPROVED/UNVERIFIED inconsistent state');
  assert.match(result.reason, /inconsistent state/);
});

test('Finding 11-C: a structurally invalid event (even if APPROVED+VERIFIED) is refused by validation', async () => {
  const registry = makeRegistry();
  const { event } = processDiscovery(makeDiscovery(), registry, 1_700_000_001_000);
  const reviewed = reviewResearchEvent(event, 'OWNER', 'APPROVE').event;
  const brokenEvent = { ...reviewed, headline: '' }; // now fails validateResearchEvent
  const fakeProvider = { name: 'FAKE', send: async () => ({ success: true, providerMessageId: '1', reason: 'sent' }) };
  const result = await dispatchApprovedEventAlert(brokenEvent, 'chat123', fakeProvider);
  assert.equal(result.dispatched, false);
  assert.match(result.reason, /validation/);
});

// ================= ISOLATION (structural, same convention as Modules 8-10) =================

test('Module 11 isolation: no research file imports rotationEngine.ts or stockScoreEngine.ts', () => {
  const files = ['permittedSources.ts', 'researchEvent.ts', 'reviewGate.ts', 'alertDispatch.ts'];
  for (const file of files) {
    const source = fs.readFileSync(`backend/src/research/${file}`, 'utf8');
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.equal(/rotationEngine|stockScoreEngine/.test(withoutComments), false, `${file} must not import the locked engines`);
  }
});

test('Module 11 isolation: no research file calls security/secretsLoader.ts (AI cannot access secrets)', () => {
  const files = ['permittedSources.ts', 'researchEvent.ts', 'reviewGate.ts', 'alertDispatch.ts'];
  for (const file of files) {
    const source = fs.readFileSync(`backend/src/research/${file}`, 'utf8');
    assert.equal(/secretsLoader/.test(source), false, `${file} must not reference secretsLoader`);
  }
});
