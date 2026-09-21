const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../backend/src/auth/passwordHashing.ts');
const {
  InMemorySessionStore,
  issueSession,
  validateSession,
  revokeSession,
  generateSessionToken,
} = require('../backend/src/auth/sessionManager.ts');
const { generateVerificationToken, verifyToken } = require('../backend/src/auth/verificationToken.ts');
const { validateEmail, validatePasswordStrength } = require('../backend/src/auth/signupValidation.ts');
const { buildNewUserRecord } = require('../backend/src/auth/signupFlow.ts');
const { attemptLogin } = require('../backend/src/auth/loginFlow.ts');

// ================= PASSWORD HASHING (unchanged, regression) =================
test('hashPassword: stored hash never contains the plaintext password', () => {
  const hash = hashPassword('CorrectHorseBattery9!');
  assert.equal(hash.includes('CorrectHorseBattery9!'), false);
});

test('hashPassword: same password hashed twice produces different hashes (random salt)', () => {
  const h1 = hashPassword('SamePassword123!');
  const h2 = hashPassword('SamePassword123!');
  assert.notEqual(h1, h2);
});

test('verifyPassword: correct password verifies true, wrong verifies false', () => {
  const hash = hashPassword('MySecureP@ss1');
  assert.equal(verifyPassword('MySecureP@ss1', hash), true);
  assert.equal(verifyPassword('WrongPassword1!', hash), false);
});

test('verifyPassword: malformed stored hash fails closed', () => {
  assert.doesNotThrow(() => verifyPassword('anything', 'not-a-valid-hash-format'));
  assert.equal(verifyPassword('anything', 'not-a-valid-hash-format'), false);
});

// ================= SESSION STORE — server-authoritative (post-audit) =================

test('SESSION: valid token issued through the store validates true, resolved from server-side record', () => {
  const store = new InMemorySessionStore();
  const now = 1_000_000;
  const session = issueSession(store, 'user-1', 'USER', now);
  const check = validateSession(store, session.token, now + 1000);
  assert.equal(check.valid, true);
});

test('SESSION: unknown token (never issued) is DENIED', () => {
  const store = new InMemorySessionStore();
  const check = validateSession(store, 'a-token-that-was-never-issued-by-anyone');
  assert.equal(check.valid, false);
  assert.equal(check.reason, 'unknown or revoked token');
});

test('SESSION: caller-supplied userId/role are NOT trusted — only the token is used; server resolves identity from its own store', () => {
  const store = new InMemorySessionStore();
  const now = 1_000_000;
  const realSession = issueSession(store, 'real-user-id', 'USER', now);

  // Attacker crafts a fake token string hoping to be treated as OWNER.
  // validateSession's signature doesn't even accept userId/role as input —
  // there is no parameter for an attacker to inject through. Prove this
  // structurally: fetch the resolved session from the store and confirm
  // its identity fields come from what the server originally issued, not
  // from anything the "caller" could have supplied at validation time.
  const resolved = store.get(realSession.token);
  assert.equal(resolved.userId, 'real-user-id');
  assert.equal(resolved.role, 'USER');

  // A forged/guessed token that happens to differ by one character must
  // not resolve to the real session or any session at all.
  const forgedToken = realSession.token.slice(0, -1) + (realSession.token.slice(-1) === '0' ? '1' : '0');
  const forgedCheck = validateSession(store, forgedToken, now);
  assert.equal(forgedCheck.valid, false);
});

test('SESSION: expired stored session is DENIED (server-held expiresAt, not client-supplied)', () => {
  const store = new InMemorySessionStore();
  const now = 1_000_000;
  const session = issueSession(store, 'user-1', 'USER', now, 5000); // 5s TTL
  const check = validateSession(store, session.token, now + 6000);
  assert.equal(check.valid, false);
  assert.equal(check.reason, 'session expired');
});

test('SESSION: revoked session is DENIED even though it has not expired yet', () => {
  const store = new InMemorySessionStore();
  const now = 1_000_000;
  const session = issueSession(store, 'user-1', 'USER', now, 1000 * 60 * 60); // 1 hour TTL, plenty of time left
  revokeSession(store, session.token);
  const check = validateSession(store, session.token, now + 10);
  assert.equal(check.valid, false);
  assert.equal(check.reason, 'unknown or revoked token');
});

test('SESSION: malformed token input (null/undefined/empty) is DENIED, never throws', () => {
  const store = new InMemorySessionStore();
  assert.equal(validateSession(store, null).valid, false);
  assert.equal(validateSession(store, undefined).valid, false);
  assert.equal(validateSession(store, '').valid, false);
});

test('SESSION: store error/unavailability fails closed, does not throw uncaught or default to valid', () => {
  const brokenStore = {
    get() { throw new Error('store connection lost'); },
    set() {},
    revoke() {},
  };
  assert.throws(() => validateSession(brokenStore, 'any-token'));
  // The important property: it throws (loud failure that a caller MUST
  // handle) rather than silently returning { valid: true }. A caller
  // wrapping this in try/catch must treat any thrown error as DENY —
  // documented in sessionManager.ts and enforced by this test asserting
  // it never returns a valid:true result when the store is broken.
  let result;
  try {
    result = validateSession(brokenStore, 'any-token');
  } catch {
    result = { valid: false, reason: 'store error (caller must treat as deny)' };
  }
  assert.equal(result.valid, false);
});

test('SESSION: generateSessionToken produces distinct, fixed-length tokens', () => {
  const t1 = generateSessionToken();
  const t2 = generateSessionToken();
  assert.notEqual(t1, t2);
  assert.equal(t1.length, 64);
});

test('SESSION: issueSession throws without userId', () => {
  const store = new InMemorySessionStore();
  assert.throws(() => issueSession(store, '', 'USER'));
});

// ================= TTL VALIDATION (post-audit hardening) =================

test('SESSION TTL: positive finite TTL is accepted', () => {
  const store = new InMemorySessionStore();
  assert.doesNotThrow(() => issueSession(store, 'u1', 'USER', 1000, 60000));
});

test('SESSION TTL: zero is rejected', () => {
  const store = new InMemorySessionStore();
  assert.throws(() => issueSession(store, 'u1', 'USER', 1000, 0));
});

test('SESSION TTL: negative is rejected', () => {
  const store = new InMemorySessionStore();
  assert.throws(() => issueSession(store, 'u1', 'USER', 1000, -5000));
});

test('SESSION TTL: NaN is rejected', () => {
  const store = new InMemorySessionStore();
  assert.throws(() => issueSession(store, 'u1', 'USER', 1000, NaN));
});

test('SESSION TTL: Infinity is rejected', () => {
  const store = new InMemorySessionStore();
  assert.throws(() => issueSession(store, 'u1', 'USER', 1000, Infinity));
});

test('SESSION TTL: non-number ("abc") is rejected', () => {
  const store = new InMemorySessionStore();
  assert.throws(() => issueSession(store, 'u1', 'USER', 1000, 'abc'));
});

test('SESSION TTL: exceeding the 30-day maximum is rejected', () => {
  const store = new InMemorySessionStore();
  const THIRTY_ONE_DAYS_MS = 1000 * 60 * 60 * 24 * 31;
  assert.throws(() => issueSession(store, 'u1', 'USER', 1000, THIRTY_ONE_DAYS_MS));
});

test('SESSION TTL: exactly at the 30-day maximum is accepted (boundary)', () => {
  const store = new InMemorySessionStore();
  const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;
  assert.doesNotThrow(() => issueSession(store, 'u1', 'USER', 1000, THIRTY_DAYS_MS));
});

test('VERIFICATION TOKEN TTL: positive finite TTL accepted', () => {
  assert.doesNotThrow(() => generateVerificationToken('EMAIL_VERIFY', 1000, 60000));
});

test('VERIFICATION TOKEN TTL: zero, negative, NaN, Infinity, non-number all rejected', () => {
  assert.throws(() => generateVerificationToken('EMAIL_VERIFY', 1000, 0));
  assert.throws(() => generateVerificationToken('EMAIL_VERIFY', 1000, -1));
  assert.throws(() => generateVerificationToken('EMAIL_VERIFY', 1000, NaN));
  assert.throws(() => generateVerificationToken('EMAIL_VERIFY', 1000, Infinity));
  assert.throws(() => generateVerificationToken('EMAIL_VERIFY', 1000, 'abc'));
});

test('VERIFICATION TOKEN TTL: exceeding the 24-hour maximum is rejected, exactly-at-max is accepted', () => {
  const TWENTY_FOUR_HOURS_MS = 1000 * 60 * 60 * 24;
  assert.doesNotThrow(() => generateVerificationToken('EMAIL_VERIFY', 1000, TWENTY_FOUR_HOURS_MS));
  assert.throws(() => generateVerificationToken('EMAIL_VERIFY', 1000, TWENTY_FOUR_HOURS_MS + 1));
});

test('verifyToken: correct token within TTL verifies true; expired/wrong/null fail', () => {
  const now = 1_000_000;
  const vt = generateVerificationToken('EMAIL_VERIFY', now, 10000);
  assert.equal(verifyToken(vt, vt.token, now + 500), true);
  assert.equal(verifyToken(vt, vt.token, now + 20000), false); // expired
  assert.equal(verifyToken(vt, 'wrongtoken', now), false);
  assert.equal(verifyToken(null, vt.token, now), false);
  assert.equal(verifyToken(vt, undefined, now), false);
});

// ================= SIGNUP VALIDATION / FLOW (regression) =================

test('validateEmail / validatePasswordStrength: basic rules', () => {
  assert.equal(validateEmail('a@b.com').valid, true);
  assert.equal(validateEmail('not-an-email').valid, false);
  assert.equal(validatePasswordStrength('short').valid, false);
  assert.equal(validatePasswordStrength('GoodPassword123!').valid, true);
});

test('buildNewUserRecord: valid input produces hashed password, unverified, USER role', () => {
  const result = buildNewUserRecord('new@user.com', 'StrongPass123!');
  assert.equal(result.success, true);
  assert.equal(result.record.email_verified, false);
  assert.equal(result.record.role, 'USER');
  assert.equal(result.record.password_hash.includes('StrongPass123!'), false);
});

test('buildNewUserRecord: invalid input collects errors, no record', () => {
  const result = buildNewUserRecord('not-an-email', 'weak');
  assert.equal(result.success, false);
  assert.equal(result.record, null);
  assert.ok(result.errors.length >= 2);
});

// ================= LOGIN FLOW — now store-based (post-audit) =================

test('attemptLogin: correct credentials on verified user succeeds AND session is genuinely retrievable from the store', () => {
  const store = new InMemorySessionStore();
  const hash = hashPassword('CorrectPass1!');
  const storedUser = { userId: 'u1', email: 'a@b.com', passwordHash: hash, role: 'USER', emailVerified: true };

  const result = attemptLogin('a@b.com', 'CorrectPass1!', storedUser, store);
  assert.equal(result.success, true);
  assert.ok(result.session);

  // Prove the session was actually created THROUGH the store abstraction,
  // not just returned as a disconnected object — validateSession must
  // independently confirm it via the store.
  const check = validateSession(store, result.session.token);
  assert.equal(check.valid, true);
});

test('attemptLogin: nonexistent user vs wrong password vs unverified user — identical client message, different internal reason, no session issued', () => {
  const store = new InMemorySessionStore();
  const hash = hashPassword('CorrectPass1!');
  const verifiedUser = { userId: 'u1', email: 'a@b.com', passwordHash: hash, role: 'USER', emailVerified: true };
  const unverifiedUser = { userId: 'u2', email: 'c@d.com', passwordHash: hash, role: 'USER', emailVerified: false };

  const noUserResult = attemptLogin('nobody@nowhere.com', 'whatever', null, store);
  const wrongPassResult = attemptLogin('a@b.com', 'WrongPassword!', verifiedUser, store);
  const unverifiedResult = attemptLogin('c@d.com', 'CorrectPass1!', unverifiedUser, store);

  assert.equal(noUserResult.success, false);
  assert.equal(wrongPassResult.success, false);
  assert.equal(unverifiedResult.success, false);
  assert.equal(noUserResult.clientMessage, wrongPassResult.clientMessage);
  assert.equal(wrongPassResult.clientMessage, unverifiedResult.clientMessage);
  assert.equal(noUserResult.session, null);
  assert.equal(wrongPassResult.session, null);
  assert.equal(unverifiedResult.session, null);

  // internal reasons differ (for server-side audit) even though client message doesn't
  const reasons = new Set([noUserResult.internalReason, wrongPassResult.internalReason, unverifiedResult.internalReason]);
  assert.equal(reasons.size, 3);
});
