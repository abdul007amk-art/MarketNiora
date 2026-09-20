const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { InMemoryOAuthTokenStore, isTokenUsable } = require('../backend/src/portfolio/oauthToken.ts');
const { InMemoryOAuthStateStore, initiateOAuth, completeOAuth } = require('../backend/src/portfolio/oauthFlow.ts');
const { InMemoryPortfolioStore } = require('../backend/src/portfolio/portfolioStore.ts');
const { normalizeHolding, syncHoldings } = require('../backend/src/portfolio/holdingsSync.ts');
const { checkPortfolioAccess, getPortfolio } = require('../backend/src/portfolio/portfolioAccess.ts');

// ================= OAUTH TOKEN STORE =================

test('OAuthTokenStore: set + get roundtrip', () => {
  const store = new InMemoryOAuthTokenStore();
  const token = { userId: 'u1', provider: 'UPSTOX', accessToken: 'abc', refreshToken: 'def', expiresAt: 2000, obtainedAt: 1000 };
  store.set('u1', token);
  assert.deepEqual(store.get('u1'), token);
});

test('OAuthTokenStore (immutability): mutating a returned token does not corrupt the store', () => {
  const store = new InMemoryOAuthTokenStore();
  const token = { userId: 'u1', provider: 'UPSTOX', accessToken: 'abc', refreshToken: null, expiresAt: 2000, obtainedAt: 1000 };
  store.set('u1', token);
  const fetched = store.get('u1');
  fetched.accessToken = 'HACKED';
  assert.equal(store.get('u1').accessToken, 'abc');
});

test('isTokenUsable: missing token false; expired false; valid true', () => {
  assert.equal(isTokenUsable(undefined, 1000), false);
  assert.equal(isTokenUsable({ expiresAt: 500 }, 1000), false);
  assert.equal(isTokenUsable({ expiresAt: 1500 }, 1000), true);
});

test('OAuthTokenStore: revoke removes the token', () => {
  const store = new InMemoryOAuthTokenStore();
  store.set('u1', { userId: 'u1', provider: 'UPSTOX', accessToken: 'abc', refreshToken: null, expiresAt: 2000, obtainedAt: 1000 });
  store.revoke('u1');
  assert.equal(store.get('u1'), undefined);
});

// ================= OAUTH FLOW =================

test('initiateOAuth: generates a state and stores it pending', () => {
  const stateStore = new InMemoryOAuthStateStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  const pending = stateStore.get(state);
  assert.equal(pending.userId, 'u1');
  assert.equal(pending.consumed, false);
});

test('initiateOAuth: throws without userId', () => {
  const stateStore = new InMemoryOAuthStateStore();
  assert.throws(() => initiateOAuth('', stateStore, 1000));
});

test('completeOAuth: valid state + successful exchange stores the token', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  const exchanger = async () => ({ accessToken: 'AT', refreshToken: 'RT', expiresInMs: 3600_000 });

  const result = await completeOAuth(state, 'auth-code-xyz', stateStore, tokenStore, exchanger, 1000);
  assert.equal(result.success, true);
  assert.equal(result.userId, 'u1');
  assert.equal(tokenStore.get('u1').accessToken, 'AT');
});

test('completeOAuth: unknown state denied, exchanger never called', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  let called = false;
  const exchanger = async () => { called = true; return { accessToken: 'AT', refreshToken: null, expiresInMs: 1000 }; };
  const result = await completeOAuth('never-issued-state', 'code', stateStore, tokenStore, exchanger, 1000);
  assert.equal(result.success, false);
  assert.equal(called, false);
});

test('completeOAuth: replayed (already-consumed) state denied on second attempt', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  const exchanger = async () => ({ accessToken: 'AT', refreshToken: null, expiresInMs: 1000 });

  const first = await completeOAuth(state, 'code', stateStore, tokenStore, exchanger, 1000);
  assert.equal(first.success, true);
  const replay = await completeOAuth(state, 'code', stateStore, tokenStore, exchanger, 1000);
  assert.equal(replay.success, false);
  assert.match(replay.reason, /already used/);
});

test('completeOAuth: expired state denied', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  const exchanger = async () => ({ accessToken: 'AT', refreshToken: null, expiresInMs: 1000 });
  const tenMinutesPlusOneMs = 1000 + 1000 * 60 * 10 + 1;
  const result = await completeOAuth(state, 'code', stateStore, tokenStore, exchanger, tenMinutesPlusOneMs);
  assert.equal(result.success, false);
});

test('completeOAuth: exchanger throwing is caught, reported as failure, does not throw out', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  const exchanger = async () => { throw new Error('upstox rejected the code'); };
  const result = await completeOAuth(state, 'bad-code', stateStore, tokenStore, exchanger, 1000);
  assert.equal(result.success, false);
});

test('Finding 12-B CLOSED: raw exchanger error message never leaks to the caller', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  const exchanger = async () => { throw new Error('SECRET_PROVIDER_DETAIL token=abc'); };
  const result = await completeOAuth(state, 'bad-code', stateStore, tokenStore, exchanger, 1000);
  assert.equal(result.success, false);
  assert.equal(result.reason.includes('SECRET_PROVIDER_DETAIL'), false, 'internal error detail must not reach the caller-facing reason');
  assert.equal(result.reason.includes('token=abc'), false);
});

test('Finding 12-A CLOSED: TWO CONCURRENT completeOAuth calls with the SAME state -> exactly one SUCCESS, exchanger called only once', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  let exchangerCalls = 0;
  const exchanger = async () => {
    exchangerCalls += 1;
    return { accessToken: 'AT', refreshToken: null, expiresInMs: 1000 };
  };

  const [resultA, resultB] = await Promise.all([
    completeOAuth(state, 'code', stateStore, tokenStore, exchanger, 1000),
    completeOAuth(state, 'code', stateStore, tokenStore, exchanger, 1000),
  ]);

  const successes = [resultA, resultB].filter((r) => r.success === true);
  assert.equal(successes.length, 1, 'exactly one of the two concurrent completeOAuth calls must succeed');
  assert.equal(exchangerCalls, 1, 'the token exchanger must be invoked exactly once, not twice, for the same state');
});

test('Finding 12-A: TEN concurrent completeOAuth calls with the SAME state -> exactly one success', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  const exchanger = async () => ({ accessToken: 'AT', refreshToken: null, expiresInMs: 1000 });

  const attempts = Array.from({ length: 10 }, () => completeOAuth(state, 'code', stateStore, tokenStore, exchanger, 1000));
  const results = await Promise.all(attempts);
  const successCount = results.filter((r) => r.success).length;
  assert.equal(successCount, 1);
});

test('Finding 12-C CLOSED: exchanger returning an empty accessToken is rejected, not stored', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  const exchanger = async () => ({ accessToken: '', refreshToken: null, expiresInMs: 1000 });
  const result = await completeOAuth(state, 'code', stateStore, tokenStore, exchanger, 1000);
  assert.equal(result.success, false);
  assert.equal(tokenStore.get('u1'), undefined);
});

test('Finding 12-C: exchanger returning a negative expiresInMs is rejected, not stored', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  const state = initiateOAuth('u1', stateStore, 1000);
  const exchanger = async () => ({ accessToken: 'AT', refreshToken: null, expiresInMs: -5 });
  const result = await completeOAuth(state, 'code', stateStore, tokenStore, exchanger, 1000);
  assert.equal(result.success, false);
  assert.equal(tokenStore.get('u1'), undefined);
});

test('Finding 12-C: exchanger returning NaN/zero expiresInMs is rejected', async () => {
  const stateStore = new InMemoryOAuthStateStore();
  const tokenStore = new InMemoryOAuthTokenStore();
  for (const badExpiry of [NaN, 0, Infinity, 30.5]) {
    const s = initiateOAuth('u1', stateStore, 1000);
    const exchanger = async () => ({ accessToken: 'AT', refreshToken: null, expiresInMs: badExpiry });
    const result = await completeOAuth(s, 'code', stateStore, tokenStore, exchanger, 1000);
    assert.equal(result.success, false, `expiresInMs=${badExpiry} should be rejected`);
  }
});

// ================= HOLDINGS SYNC =================

test('normalizeHolding: maps broker fields to canonical shape', () => {
  const result = normalizeHolding({ tradingsymbol: 'RELIANCE', isin: 'INE002A01018', qty: 10, avg_price: 2500.5 });
  assert.equal(result.symbol, 'RELIANCE');
  assert.equal(result.isin, 'INE002A01018');
  assert.equal(result.quantity, 10);
  assert.equal(result.averagePrice, 2500.5);
});

test('syncHoldings: no token at all -> refuses to sync', async () => {
  const tokenStore = new InMemoryOAuthTokenStore();
  const portfolioStore = new InMemoryPortfolioStore();
  const fetcher = async () => [{ tradingsymbol: 'X', isin: null, qty: 1, avg_price: 1 }];
  const result = await syncHoldings('u1', tokenStore, portfolioStore, fetcher, 1000);
  assert.equal(result.success, false);
  assert.equal(portfolioStore.getHoldings('u1').length, 0);
});

test('syncHoldings: expired token -> refuses to sync, never falls back to stale data', async () => {
  const tokenStore = new InMemoryOAuthTokenStore();
  tokenStore.set('u1', { userId: 'u1', provider: 'UPSTOX', accessToken: 'AT', refreshToken: null, expiresAt: 500, obtainedAt: 100 });
  const portfolioStore = new InMemoryPortfolioStore();
  const fetcher = async () => [{ tradingsymbol: 'X', isin: null, qty: 1, avg_price: 1 }];
  const result = await syncHoldings('u1', tokenStore, portfolioStore, fetcher, 1000); // now=1000 > expiresAt=500
  assert.equal(result.success, false);
});

test('syncHoldings: valid token -> fetches, normalizes, and stores holdings', async () => {
  const tokenStore = new InMemoryOAuthTokenStore();
  tokenStore.set('u1', { userId: 'u1', provider: 'UPSTOX', accessToken: 'AT', refreshToken: null, expiresAt: 5000, obtainedAt: 100 });
  const portfolioStore = new InMemoryPortfolioStore();
  const fetcher = async () => [
    { tradingsymbol: 'RELIANCE', isin: 'INE002A01018', qty: 10, avg_price: 2500 },
    { tradingsymbol: 'TCS', isin: 'INE467B01029', qty: 5, avg_price: 3800 },
  ];
  const result = await syncHoldings('u1', tokenStore, portfolioStore, fetcher, 1000);
  assert.equal(result.success, true);
  assert.equal(result.holdingsSynced, 2);
  assert.equal(portfolioStore.getHoldings('u1').length, 2);
});

test('syncHoldings: fetcher failure does not corrupt existing stored holdings', async () => {
  const tokenStore = new InMemoryOAuthTokenStore();
  tokenStore.set('u1', { userId: 'u1', provider: 'UPSTOX', accessToken: 'AT', refreshToken: null, expiresAt: 5000, obtainedAt: 100 });
  const portfolioStore = new InMemoryPortfolioStore();
  portfolioStore.setHoldings('u1', [{ symbol: 'OLD', isin: null, quantity: 1, averagePrice: 1 }]);
  const failingFetcher = async () => { throw new Error('upstox API down'); };
  const result = await syncHoldings('u1', tokenStore, portfolioStore, failingFetcher, 1000);
  assert.equal(result.success, false);
  assert.equal(portfolioStore.getHoldings('u1')[0].symbol, 'OLD', 'existing holdings must remain untouched after a failed sync');
});

test('Finding 12-B CLOSED: raw fetcher error message never leaks to the caller', async () => {
  const tokenStore = new InMemoryOAuthTokenStore();
  tokenStore.set('u1', { userId: 'u1', provider: 'UPSTOX', accessToken: 'AT', refreshToken: null, expiresAt: 5000, obtainedAt: 100 });
  const portfolioStore = new InMemoryPortfolioStore();
  const failingFetcher = async () => { throw new Error('SECRET_PROVIDER_DETAIL token=abc'); };
  const result = await syncHoldings('u1', tokenStore, portfolioStore, failingFetcher, 1000);
  assert.equal(result.success, false);
  assert.equal(result.reason.includes('SECRET_PROVIDER_DETAIL'), false);
  assert.equal(result.reason.includes('token=abc'), false);
});

test('Finding 12-D CLOSED: invalid holdings (bad symbol/quantity/price) are rejected, valid ones still sync', async () => {
  const tokenStore = new InMemoryOAuthTokenStore();
  tokenStore.set('u1', { userId: 'u1', provider: 'UPSTOX', accessToken: 'AT', refreshToken: null, expiresAt: 5000, obtainedAt: 100 });
  const portfolioStore = new InMemoryPortfolioStore();
  const fetcher = async () => [
    { tradingsymbol: 'RELIANCE', isin: 'INE002A01018', qty: 10, avg_price: 2500 }, // valid
    { tradingsymbol: '', isin: null, qty: 5, avg_price: 100 }, // missing symbol
    { tradingsymbol: 'BADQTY', isin: null, qty: NaN, avg_price: 100 }, // non-finite quantity
    { tradingsymbol: 'NEGPRICE', isin: null, qty: 5, avg_price: -50 }, // negative price
    { tradingsymbol: 'INFQTY', isin: null, qty: Infinity, avg_price: 100 }, // non-finite quantity
  ];
  const result = await syncHoldings('u1', tokenStore, portfolioStore, fetcher, 1000);
  assert.equal(result.success, true);
  assert.equal(result.holdingsSynced, 1);
  assert.equal(result.holdingsRejected, 4);
  assert.equal(portfolioStore.getHoldings('u1').length, 1);
  assert.equal(portfolioStore.getHoldings('u1')[0].symbol, 'RELIANCE');
});

test('validateNormalizedHolding: valid holding passes, each specific defect rejected individually', () => {
  const { validateNormalizedHolding } = require('../backend/src/portfolio/holdingsSync.ts');
  assert.equal(validateNormalizedHolding({ symbol: 'X', isin: null, quantity: 10, averagePrice: 100 }).valid, true);
  assert.equal(validateNormalizedHolding({ symbol: '', isin: null, quantity: 10, averagePrice: 100 }).valid, false);
  assert.equal(validateNormalizedHolding({ symbol: 'X', isin: null, quantity: -1, averagePrice: 100 }).valid, false);
  assert.equal(validateNormalizedHolding({ symbol: 'X', isin: null, quantity: NaN, averagePrice: 100 }).valid, false);
  assert.equal(validateNormalizedHolding({ symbol: 'X', isin: null, quantity: 10, averagePrice: -1 }).valid, false);
});

// ================= PORTFOLIO ACCESS — the privacy boundary =================

test('checkPortfolioAccess: USER viewing own portfolio -> ALLOW', () => {
  const result = checkPortfolioAccess({ requesterRole: 'USER', requesterUserId: 'u1', targetUserId: 'u1' });
  assert.equal(result.allowed, true);
});

test('checkPortfolioAccess: USER A viewing USER B portfolio -> DENY (core privacy rule)', () => {
  const result = checkPortfolioAccess({ requesterRole: 'USER', requesterUserId: 'u1', targetUserId: 'u2' });
  assert.equal(result.allowed, false);
});

test('checkPortfolioAccess: AI_AGENT can NEVER view any portfolio, even its own "userId"', () => {
  const ownAttempt = checkPortfolioAccess({ requesterRole: 'AI_AGENT', requesterUserId: 'ai-1', targetUserId: 'ai-1' });
  const crossAttempt = checkPortfolioAccess({ requesterRole: 'AI_AGENT', requesterUserId: 'ai-1', targetUserId: 'u1', crossUserReason: 'because I said so' });
  assert.equal(ownAttempt.allowed, false);
  assert.equal(crossAttempt.allowed, false);
});

test('checkPortfolioAccess: OWNER cross-user access WITHOUT a reason -> DENY (no automatic access)', () => {
  const result = checkPortfolioAccess({ requesterRole: 'OWNER', requesterUserId: 'owner-1', targetUserId: 'u1' });
  assert.equal(result.allowed, false);
  assert.match(result.reason, /explicit authorized reason/);
});

test('checkPortfolioAccess: OWNER cross-user access WITH an explicit reason -> ALLOW', () => {
  const result = checkPortfolioAccess({ requesterRole: 'OWNER', requesterUserId: 'owner-1', targetUserId: 'u1', crossUserReason: 'fraud investigation ticket #123' });
  assert.equal(result.allowed, true);
});

test('checkPortfolioAccess: ADMIN cross-user access is denied even WITH a reason (ADMIN has no VIEW_ANY_PORTFOLIO permission)', () => {
  const result = checkPortfolioAccess({ requesterRole: 'ADMIN', requesterUserId: 'admin-1', targetUserId: 'u1', crossUserReason: 'ticket #123' });
  assert.equal(result.allowed, false);
});

test('checkPortfolioAccess: null/undefined role denied, never throws', () => {
  assert.equal(checkPortfolioAccess({ requesterRole: null, requesterUserId: 'u1', targetUserId: 'u1' }).allowed, false);
  assert.equal(checkPortfolioAccess({ requesterRole: undefined, requesterUserId: 'u1', targetUserId: 'u1' }).allowed, false);
});

test('getPortfolio: denied access returns null holdings, never partial data', () => {
  const store = new InMemoryPortfolioStore();
  store.setHoldings('u2', [{ symbol: 'SECRET', isin: null, quantity: 100, averagePrice: 500 }]);
  const result = getPortfolio(store, { requesterRole: 'USER', requesterUserId: 'u1', targetUserId: 'u2' });
  assert.equal(result.allowed, false);
  assert.equal(result.holdings, null);
});

test('getPortfolio: allowed access returns the actual holdings', () => {
  const store = new InMemoryPortfolioStore();
  store.setHoldings('u1', [{ symbol: 'RELIANCE', isin: null, quantity: 10, averagePrice: 2500 }]);
  const result = getPortfolio(store, { requesterRole: 'USER', requesterUserId: 'u1', targetUserId: 'u1' });
  assert.equal(result.allowed, true);
  assert.equal(result.holdings.length, 1);
});

// ================= ISOLATION (structural, same convention as Modules 8-11) =================

test('Module 12 isolation: no portfolio file imports rotationEngine.ts or stockScoreEngine.ts', () => {
  const files = ['oauthToken.ts', 'oauthFlow.ts', 'portfolioStore.ts', 'holdingsSync.ts', 'portfolioAccess.ts'];
  for (const file of files) {
    const source = fs.readFileSync(`backend/src/portfolio/${file}`, 'utf8');
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.equal(/rotationEngine|stockScoreEngine/.test(withoutComments), false, `${file} must not import the locked engines`);
  }
});
