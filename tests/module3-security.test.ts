const test = require('node:test');
const assert = require('node:assert/strict');
const { hasPermission, getPermissions } = require('../backend/src/security/rbac.ts');
const { authorize } = require('../backend/src/security/failClosedAuthz.ts');
const { buildAuditEntry, writeAuditLog } = require('../backend/src/security/auditLogger.ts');
const { requireSecret, requireSecrets } = require('../backend/src/security/secretsLoader.ts');
const { securityHeaders } = require('../backend/src/security/securityHeaders.ts');
const { FixedWindowRateLimiter } = require('../backend/src/security/rateLimiter.ts');
const { generateCsrfToken, verifyCsrfToken } = require('../backend/src/security/csrfToken.ts');

test('RBAC: OWNER has EDIT_LOCKED_FORMULA', () => {
  assert.equal(hasPermission('OWNER', 'EDIT_LOCKED_FORMULA'), true);
});

test('RBAC: ADMIN does NOT have EDIT_LOCKED_FORMULA / READ_PLAINTEXT_SECRETS', () => {
  assert.equal(hasPermission('ADMIN', 'EDIT_LOCKED_FORMULA'), false);
  assert.equal(hasPermission('ADMIN', 'READ_PLAINTEXT_SECRETS'), false);
});

test('RBAC: AI_AGENT has zero standing permissions', () => {
  assert.equal(getPermissions('AI_AGENT').length, 0);
});

test('RBAC hardening (post-audit): BYPASS_MFA/DELETE_AUDIT_LOG/MODIFY_AUDIT_LOG do not exist as permissions for ANY role, including OWNER', () => {
  const dangerous = ['BYPASS_MFA', 'DELETE_AUDIT_LOG', 'MODIFY_AUDIT_LOG'];
  for (const role of ['OWNER', 'ADMIN', 'USER', 'AI_AGENT']) {
    for (const perm of dangerous) {
      // @ts-expect-error - intentionally probing with a permission string that
      // should no longer type-check or exist in the matrix
      assert.equal(hasPermission(role, perm), false, `${role} must not have ${perm}`);
    }
  }
});

test('fail-closed authorization: null/undefined role -> DENY', () => {
  assert.equal(authorize({ role: null, permission: 'VIEW_OWN_PORTFOLIO' }).allowed, false);
  assert.equal(authorize({ role: undefined, permission: 'VIEW_OWN_PORTFOLIO' }).allowed, false);
});

test('fail-closed authorization: User A cannot view User B portfolio', () => {
  const r = authorize({ role: 'USER', permission: 'VIEW_OWN_PORTFOLIO', requiresSelfOnly: true, isSelfResource: false });
  assert.equal(r.allowed, false);
});

test('fail-closed authorization: unresolved ownership denies, does not default-allow', () => {
  const r = authorize({ role: 'USER', permission: 'VIEW_OWN_PORTFOLIO', requiresSelfOnly: true, isSelfResource: undefined });
  assert.equal(r.allowed, false);
});

test('audit logger: empty action throws', () => {
  assert.throws(() => buildAuditEntry('USER', 'u1', ''));
});

test('audit logger hardening (post-audit): sensitive keys in detail are auto-redacted regardless of caller', () => {
  const entry = buildAuditEntry('USER', 'u1', 'LOGIN_ATTEMPT', 'session', {
    password: 'hunter2',
    api_key: 'sk-abc123',
    nested: { authToken: 'xyz', safeField: 'ok' },
    ip: '1.2.3.4',
  });
  assert.equal(entry.detail.password, '[REDACTED]');
  assert.equal(entry.detail.api_key, '[REDACTED]');
  assert.equal(entry.detail.nested.authToken, '[REDACTED]');
  assert.equal(entry.detail.nested.safeField, 'ok');
  assert.equal(entry.detail.ip, '1.2.3.4');
});

test('audit logger: writeAuditLog stub still throws (not silently wired)', async () => {
  const entry = buildAuditEntry('SYSTEM', null, 'TEST');
  await assert.rejects(() => writeAuditLog(entry), /not wired/);
});

test('secrets loader: missing secret throws with key name only, never the value', () => {
  delete process.env.TEST_SECRET_MISSING;
  assert.throws(() => requireSecret('TEST_SECRET_MISSING'), (err) => err.message === 'Missing required secret: TEST_SECRET_MISSING');
});

test('secrets loader: batch error never contains actual secret values', () => {
  process.env.TEST_SECRET_OK = 'super-secret-value';
  delete process.env.TEST_SECRET_MISSING2;
  assert.throws(() => requireSecrets(['TEST_SECRET_OK', 'TEST_SECRET_MISSING2']), (err) => !err.message.includes('super-secret-value'));
});

test('security headers: X-Frame-Options DENY and HSTS present', () => {
  const h = securityHeaders();
  assert.equal(h['X-Frame-Options'], 'DENY');
  assert.ok(h['Strict-Transport-Security'].includes('max-age'));
});

test('rate limiter: enforces fixed window per key, isolated across keys', () => {
  const limiter = new FixedWindowRateLimiter(3, 1000);
  const t = 1000000;
  assert.equal(limiter.check('ip1', t), true);
  assert.equal(limiter.check('ip1', t), true);
  assert.equal(limiter.check('ip1', t), true);
  assert.equal(limiter.check('ip1', t), false); // 4th request rejected
  assert.equal(limiter.check('ip2', t), true); // different key unaffected
  assert.equal(limiter.check('ip1', t + 1000), true); // window elapsed
});

test('rate limiter hardening (post-audit): productionReady flag is explicitly false', () => {
  const limiter = new FixedWindowRateLimiter(3, 1000);
  assert.equal(limiter.productionReady, false);
});

test('CSRF: matching tokens verify, mismatched/null/undefined fail closed', () => {
  const t1 = generateCsrfToken();
  const t2 = generateCsrfToken();
  assert.equal(verifyCsrfToken(t1, t1), true);
  assert.equal(verifyCsrfToken(t1, t2), false);
  assert.equal(verifyCsrfToken(null, t1), false);
  assert.equal(verifyCsrfToken(t1, undefined), false);
  assert.equal(verifyCsrfToken('short', t1), false);
});
