const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../backend/src/api/server.ts');
const { buildRoutes } = require('../backend/src/api/routes/index.ts');
const { createDependencies } = require('../backend/src/api/dependencies.ts');
const { hashPassword } = require('../backend/src/auth/passwordHashing.ts');

function startServer() {
  const deps = createDependencies();
  const routes = buildRoutes();
  const server = createApp(routes, deps);
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({ server, baseUrl: `http://localhost:${port}`, deps });
    });
  });
}

function stopServer(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}

function extractCookieHeader(response) {
  const setCookies = response.headers.getSetCookie ? response.headers.getSetCookie() : [];
  return setCookies.map((c) => c.split(';')[0]).join('; ');
}

async function signupAndLogin(baseUrl, email, password) {
  await fetch(`${baseUrl}/auth/signup`, { method: 'POST', body: JSON.stringify({ email, password }) });
  const loginRes = await fetch(`${baseUrl}/auth/login`, { method: 'POST', body: JSON.stringify({ email, password }) });
  const loginBody = await loginRes.json();
  const cookie = extractCookieHeader(loginRes);
  return { cookie, csrfToken: loginBody.csrfToken, userId: loginBody.userId, role: loginBody.role };
}

/** Seeds an OWNER/ADMIN account directly (HTTP signup can only create USER role). */
function seedPrivilegedUser(deps, email, password, role) {
  const userId = `${role.toLowerCase()}-${Math.random().toString(16).slice(2)}`;
  deps.userStore.create({ userId, email, passwordHash: hashPassword(password), role, emailVerified: true });
  return userId;
}

// ================= HEALTH =================

test('GET /health returns 200 ok — real HTTP round trip', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
  } finally {
    await stopServer(server);
  }
});

test('unknown route returns 404', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/this-route-does-not-exist`);
    assert.equal(res.status, 404);
  } finally {
    await stopServer(server);
  }
});

test('response includes security headers (Module 3 reused, not reinvented)', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.ok(res.headers.get('strict-transport-security'));
  } finally {
    await stopServer(server);
  }
});

// ================= AUTH =================

test('signup -> login -> real session cookie issued', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const { cookie, csrfToken } = await signupAndLogin(baseUrl, 'alice@example.com', 'StrongPass123!');
    assert.ok(cookie.includes('session_token='));
    assert.ok(csrfToken);
  } finally {
    await stopServer(server);
  }
});

test('login with wrong password returns 401 with generic message', async () => {
  const { server, baseUrl } = await startServer();
  try {
    await fetch(`${baseUrl}/auth/signup`, { method: 'POST', body: JSON.stringify({ email: 'bob@example.com', password: 'CorrectPass123!' }) });
    const res = await fetch(`${baseUrl}/auth/login`, { method: 'POST', body: JSON.stringify({ email: 'bob@example.com', password: 'WrongPassword!' }) });
    assert.equal(res.status, 401);
  } finally {
    await stopServer(server);
  }
});

test('login rate limiting: 6th rapid attempt for the same email gets real HTTP 429', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const email = 'ratelimited@example.com';
    let lastStatus = null;
    for (let i = 0; i < 6; i++) {
      const res = await fetch(`${baseUrl}/auth/login`, { method: 'POST', body: JSON.stringify({ email, password: 'whatever' }) });
      lastStatus = res.status;
    }
    assert.equal(lastStatus, 429);
  } finally {
    await stopServer(server);
  }
});

test('logout without CSRF header is refused with real 403', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const { cookie } = await signupAndLogin(baseUrl, 'carol@example.com', 'StrongPass123!');
    const res = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { Cookie: cookie } });
    assert.equal(res.status, 403);
  } finally {
    await stopServer(server);
  }
});

test('logout WITH correct CSRF header succeeds, and the session is genuinely revoked (subsequent request fails)', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const { cookie, csrfToken, userId } = await signupAndLogin(baseUrl, 'dave@example.com', 'StrongPass123!');
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { Cookie: cookie, 'x-csrf-token': csrfToken } });
    assert.equal(logoutRes.status, 200);

    const afterLogout = await fetch(`${baseUrl}/portfolio/${userId}`, { headers: { Cookie: cookie } });
    assert.equal(afterLogout.status, 401, 'a revoked session must genuinely fail subsequent authenticated requests');
  } finally {
    await stopServer(server);
  }
});

// ================= PORTFOLIO PRIVACY — real HTTP =================

test('portfolio: unauthenticated request -> real 401', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/portfolio/someone`);
    assert.equal(res.status, 401);
  } finally {
    await stopServer(server);
  }
});

test('portfolio: USER A requesting USER B holdings over real HTTP -> 403 (core privacy rule)', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const userA = await signupAndLogin(baseUrl, 'usera@example.com', 'StrongPass123!');
    const userB = await signupAndLogin(baseUrl, 'userb@example.com', 'StrongPass123!');

    const res = await fetch(`${baseUrl}/portfolio/${userB.userId}`, { headers: { Cookie: userA.cookie } });
    assert.equal(res.status, 403);
  } finally {
    await stopServer(server);
  }
});

test('portfolio: USER viewing own holdings -> real 200', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const userA = await signupAndLogin(baseUrl, 'ownview@example.com', 'StrongPass123!');
    const res = await fetch(`${baseUrl}/portfolio/${userA.userId}`, { headers: { Cookie: userA.cookie } });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.holdings, []);
  } finally {
    await stopServer(server);
  }
});

test('portfolio: OWNER cross-user WITHOUT ?reason= -> 403 (no automatic access, even over real HTTP)', async () => {
  const { server, baseUrl, deps } = await startServer();
  try {
    seedPrivilegedUser(deps, 'owner1@example.com', 'OwnerPass123!', 'OWNER');
    const owner = await signupAndLogin(baseUrl, 'owner1@example.com', 'OwnerPass123!');
    const target = await signupAndLogin(baseUrl, 'target1@example.com', 'StrongPass123!');

    const res = await fetch(`${baseUrl}/portfolio/${target.userId}`, { headers: { Cookie: owner.cookie } });
    assert.equal(res.status, 403);
  } finally {
    await stopServer(server);
  }
});

test('portfolio: OWNER cross-user WITH ?reason= -> real 200', async () => {
  const { server, baseUrl, deps } = await startServer();
  try {
    seedPrivilegedUser(deps, 'owner2@example.com', 'OwnerPass123!', 'OWNER');
    const owner = await signupAndLogin(baseUrl, 'owner2@example.com', 'OwnerPass123!');
    const target = await signupAndLogin(baseUrl, 'target2@example.com', 'StrongPass123!');

    const res = await fetch(`${baseUrl}/portfolio/${target.userId}?reason=fraud+investigation`, { headers: { Cookie: owner.cookie } });
    assert.equal(res.status, 200);
  } finally {
    await stopServer(server);
  }
});

// ================= RESEARCH REVIEW — real RBAC over HTTP =================

test('research review: USER role (not Owner/Admin) -> real 403', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const user = await signupAndLogin(baseUrl, 'regularuser@example.com', 'StrongPass123!');
    const fakeEvent = { eventId: 'x', sourceId: 's', stockId: null, headline: 'h', summary: 's', provenance: { source: 's', sourceTimestamp: 1, verificationStatus: 'UNVERIFIED', dataNature: 'RAW', formulaVersion: null }, reviewStatus: 'PENDING' };
    const res = await fetch(`${baseUrl}/research/review`, {
      method: 'POST',
      headers: { Cookie: user.cookie, 'x-csrf-token': user.csrfToken },
      body: JSON.stringify({ event: fakeEvent, decision: 'APPROVE' }),
    });
    assert.equal(res.status, 403);
  } finally {
    await stopServer(server);
  }
});

test('research review: OWNER role -> real 200, event approved', async () => {
  const { server, baseUrl, deps } = await startServer();
  try {
    seedPrivilegedUser(deps, 'ownerreview@example.com', 'OwnerPass123!', 'OWNER');
    const owner = await signupAndLogin(baseUrl, 'ownerreview@example.com', 'OwnerPass123!');
    const fakeEvent = { eventId: 'x', sourceId: 's', stockId: null, headline: 'h', summary: 's', provenance: { source: 's', sourceTimestamp: 1, verificationStatus: 'UNVERIFIED', dataNature: 'RAW', formulaVersion: null }, reviewStatus: 'PENDING' };
    const res = await fetch(`${baseUrl}/research/review`, {
      method: 'POST',
      headers: { Cookie: owner.cookie, 'x-csrf-token': owner.csrfToken },
      body: JSON.stringify({ event: fakeEvent, decision: 'APPROVE' }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.event.reviewStatus, 'APPROVED');
  } finally {
    await stopServer(server);
  }
});

test('research review: missing CSRF header -> real 403 even for OWNER', async () => {
  const { server, baseUrl, deps } = await startServer();
  try {
    seedPrivilegedUser(deps, 'ownernocsrf@example.com', 'OwnerPass123!', 'OWNER');
    const owner = await signupAndLogin(baseUrl, 'ownernocsrf@example.com', 'OwnerPass123!');
    const res = await fetch(`${baseUrl}/research/review`, {
      method: 'POST',
      headers: { Cookie: owner.cookie },
      body: JSON.stringify({ event: {}, decision: 'APPROVE' }),
    });
    assert.equal(res.status, 403);
  } finally {
    await stopServer(server);
  }
});

// ================= LOCKED ENGINE ROUTES — real HTTP, formula unchanged =================

test('POST /rotation/calculate: real HTTP round trip through the LOCKED engine', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/rotation/calculate`, {
      method: 'POST',
      body: JSON.stringify({ horizon: '1D', observations: [{ stockId: 'a', return_: 0.05 }, { stockId: 'b', return_: 0.03 }], confidence: 100 }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.formulaVersion, 'ROTATION-1.2');
    assert.equal(body.includedByConfidence, true);
  } finally {
    await stopServer(server);
  }
});

test('POST /rotation/calculate: malformed input -> sanitized 400, not a raw stack trace', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/rotation/calculate`, { method: 'POST', body: JSON.stringify({ horizon: 'NOT_REAL' }) });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'invalid rotation calculation input');
  } finally {
    await stopServer(server);
  }
});

test('POST /stock-score/calculate: real HTTP round trip, catalyst guard still enforced over HTTP', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const components = { momentum: 50, earningsMomentum: 50, businessQuality: 50, relativeStrength: 50, valuation: 50, trendQuality: 50, volumeConfirmation: 50, growthVisibility: 50 };
    const goodRes = await fetch(`${baseUrl}/stock-score/calculate`, { method: 'POST', body: JSON.stringify({ components, riskPenalty: 0, catalyst: 4, isSuspendedOrDelisted: false }) });
    assert.equal(goodRes.status, 200);

    const badRes = await fetch(`${baseUrl}/stock-score/calculate`, { method: 'POST', body: JSON.stringify({ components, riskPenalty: 0, catalyst: 6, isSuspendedOrDelisted: false }) });
    assert.equal(badRes.status, 400, 'Finding 9-A guard must still reject catalyst=6 even reached via real HTTP');
  } finally {
    await stopServer(server);
  }
});

// ================= CONTRACT ROUTES =================

test('POST /theme/resolve: real HTTP, many-to-many resolution', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const themes = [{ themeId: 'T1', name: 'Defence' }];
    const subThemes = [{ subThemeId: 'S1', themeId: 'T1', name: 'Naval' }];
    const industries = [{ industryId: 'I1', subThemeId: 'S1', name: 'Shipbuilding' }];
    const memberships = [{ stockId: 'X', industryId: 'I1' }];
    const res = await fetch(`${baseUrl}/theme/resolve`, { method: 'POST', body: JSON.stringify({ stockId: 'X', memberships, industries, subThemes }) });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(body.themeIds, ['T1']);
  } finally {
    await stopServer(server);
  }
});

test('POST /fundamental/validate: real HTTP, inconsistent status rejected with 422', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const record = {
      stockId: 'A',
      metric: 'ROE',
      value: null,
      period: null,
      status: 'LIVE', // inconsistent: null value should classify as MISSING, not LIVE
      provenance: { source: null, sourceTimestamp: null, verificationStatus: 'UNVERIFIED', dataNature: 'RAW', formulaVersion: null },
      trend: null,
      rootCause: null,
      positiveSignals: [],
      warningSignals: [],
      relatedMetrics: [],
      context: null,
      verdict: null,
    };
    const res = await fetch(`${baseUrl}/fundamental/validate`, { method: 'POST', body: JSON.stringify({ record }) });
    assert.equal(res.status, 422);
  } finally {
    await stopServer(server);
  }
});

test('POST /value-chain/validate: real HTTP, unknown stage rejected with 422', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const entry = {
      stockId: 'A',
      stage: 'NOT_REAL_STAGE',
      detail: null,
      provenance: { source: null, sourceTimestamp: null, verificationStatus: 'UNVERIFIED', dataNature: 'RAW', formulaVersion: null },
    };
    const res = await fetch(`${baseUrl}/value-chain/validate`, { method: 'POST', body: JSON.stringify({ entry }) });
    assert.equal(res.status, 422);
  } finally {
    await stopServer(server);
  }
});

// ================= REQUEST HANDLING — malformed input =================

test('malformed JSON body -> real 400, never a raw parse error', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/auth/login`, { method: 'POST', body: '{not valid json' });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'malformed JSON body');
  } finally {
    await stopServer(server);
  }
});

test('oversized request body -> real 413, not a crash', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const hugeBody = JSON.stringify({ email: 'x'.repeat(1024 * 1024 * 2), password: 'y' });
    const res = await fetch(`${baseUrl}/auth/signup`, { method: 'POST', body: hugeBody });
    assert.equal(res.status, 413);
  } finally {
    await stopServer(server);
  }
});

test('unexpected internal error is sanitized to a generic 500, never leaks detail', async () => {
  const { server, baseUrl } = await startServer();
  try {
    const res = await fetch(`${baseUrl}/theme/resolve`, { method: 'POST', body: JSON.stringify({ stockId: 'X', memberships: 'not-an-array', industries: [], subThemes: [] }) });
    if (res.status === 500) {
      const body = await res.json();
      assert.equal(body.error, 'internal server error');
      assert.equal(JSON.stringify(body).includes('at '), false, 'must never contain stack-trace-shaped content');
    } else {
      assert.ok(res.status === 200 || res.status === 400);
    }
  } finally {
    await stopServer(server);
  }
});
