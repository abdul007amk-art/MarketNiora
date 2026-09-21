const test = require('node:test');
const assert = require('node:assert/strict');
const { generateTotpSecret, generateTotpCode, verifyTotpCode } = require('../backend/src/auth/totp.ts');
const {
  generateRecoveryCodes,
  consumeRecoveryCode,
  InMemoryRecoveryCodeStore,
  consumeRecoveryCodeAtomically,
} = require('../backend/src/auth/mfaRecovery.ts');
const {
  InMemoryMfaVerificationStore,
  verifyOwnerTotpAndIssueProof,
  verifyOwnerRecoveryCodeAndIssueProof,
  authorizeOwnerAction,
  canActOnUserAccount,
} = require('../backend/src/auth/ownerAuthorization.ts');
const { buildAuditEntry } = require('../backend/src/security/auditLogger.ts');

// ================= TOTP — core behavior (regression) =================

test('TOTP: secret is a non-trivial base32 string', () => {
  const secret = generateTotpSecret();
  assert.ok(secret.length >= 30);
  assert.ok(/^[A-Z2-7]+$/.test(secret));
});

test('TOTP: correct code for the current time window verifies true', () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);
  assert.equal(verifyTotpCode(secret, code, now).valid, true);
});

test('TOTP: wrong code fails; ±1 step drift accepted; ±3 steps rejected', () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  assert.equal(verifyTotpCode(secret, '000000', now).valid, false);
  const oneStepAgo = generateTotpCode(secret, now - 30_000);
  assert.equal(verifyTotpCode(secret, oneStepAgo, now).valid, true);
  const threeStepsAgo = generateTotpCode(secret, now - 90_000);
  assert.equal(verifyTotpCode(secret, threeStepsAgo, now).valid, false);
});

test('TOTP: malformed code/secret inputs fail closed, never throw', () => {
  const secret = generateTotpSecret();
  assert.equal(verifyTotpCode(secret, null).valid, false);
  assert.equal(verifyTotpCode(secret, 'abcdef').valid, false);
  assert.equal(verifyTotpCode(secret, '123').valid, false);
  assert.equal(verifyTotpCode(null, '123456').valid, false);
  assert.equal(verifyTotpCode('not-valid-base32!!!', '123456').valid, false);
});

// ================= TOTP — parameter validation (post-audit, MEDIUM finding) =================

test('TOTP generation: throws on invalid stepSeconds (0, negative, NaN, Infinity, non-integer)', () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  assert.throws(() => generateTotpCode(secret, now, 0));
  assert.throws(() => generateTotpCode(secret, now, -30));
  assert.throws(() => generateTotpCode(secret, now, NaN));
  assert.throws(() => generateTotpCode(secret, now, Infinity));
  assert.throws(() => generateTotpCode(secret, now, 30.5));
});

test('TOTP generation: throws on invalid digits (0, negative, out of 6-8 range)', () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  assert.throws(() => generateTotpCode(secret, now, 30, 0));
  assert.throws(() => generateTotpCode(secret, now, 30, -6));
  assert.throws(() => generateTotpCode(secret, now, 30, 5)); // below range
  assert.throws(() => generateTotpCode(secret, now, 30, 9)); // above range
});

test('TOTP generation: throws on invalid now (NaN, Infinity, non-number)', () => {
  const secret = generateTotpSecret();
  assert.throws(() => generateTotpCode(secret, NaN));
  assert.throws(() => generateTotpCode(secret, Infinity));
});

test('TOTP verification: fails closed (not throws) on invalid stepSeconds/digits/window/now', () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);

  assert.doesNotThrow(() => verifyTotpCode(secret, code, now, { stepSeconds: 0 }));
  assert.equal(verifyTotpCode(secret, code, now, { stepSeconds: 0 }).valid, false);
  assert.equal(verifyTotpCode(secret, code, now, { stepSeconds: -30 }).valid, false);
  assert.equal(verifyTotpCode(secret, code, now, { stepSeconds: NaN }).valid, false);

  assert.equal(verifyTotpCode(secret, code, now, { digits: 0 }).valid, false);
  assert.equal(verifyTotpCode(secret, code, now, { digits: -6 }).valid, false);

  assert.equal(verifyTotpCode(secret, code, now, { window: -1 }).valid, false);
  assert.equal(verifyTotpCode(secret, code, now, { window: NaN }).valid, false);
  assert.equal(verifyTotpCode(secret, code, now, { window: Infinity }).valid, false);

  assert.equal(verifyTotpCode(secret, code, NaN).valid, false);
  assert.equal(verifyTotpCode(secret, code, Infinity).valid, false);
});

test('TOTP: valid non-default parameters (8 digits, 60s step, window 2) still work correctly', () => {
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now, 60, 8);
  assert.equal(code.length, 8);
  assert.equal(verifyTotpCode(secret, code, now, { stepSeconds: 60, digits: 8, window: 2 }).valid, true);
});

// ================= RECOVERY CODES — non-atomic helper (regression, documented as non-concurrent-safe) =================

test('recovery codes: generates requested count, hashed differs from plaintext', () => {
  const { plaintextCodes, hashedCodes } = generateRecoveryCodes(10);
  assert.equal(plaintextCodes.length, 10);
  for (let i = 0; i < 10; i++) {
    assert.notEqual(hashedCodes[i], plaintextCodes[i]);
  }
});

test('recovery codes (non-atomic helper): sequential single-use works as documented', () => {
  const { plaintextCodes, hashedCodes } = generateRecoveryCodes(3);
  const firstUse = consumeRecoveryCode(hashedCodes, plaintextCodes[0]);
  assert.equal(firstUse.valid, true);
  const secondUse = consumeRecoveryCode(firstUse.remainingHashedCodes, plaintextCodes[0]);
  assert.equal(secondUse.valid, false); // already removed from the returned set
});

// ================= RECOVERY CODES — ATOMIC (post-audit, HIGH finding) =================

test('atomic recovery: valid code consumed successfully through the store', async () => {
  const store = new InMemoryRecoveryCodeStore();
  const { plaintextCodes, hashedCodes } = generateRecoveryCodes(3);
  store.setHashedCodes('owner-1', hashedCodes);

  const result = await consumeRecoveryCodeAtomically(store, 'owner-1', plaintextCodes[0]);
  assert.equal(result.valid, true);
  assert.equal(store.getHashedCodes('owner-1').length, 2);
});

test('atomic recovery: CONCURRENT consumption of the SAME code succeeds exactly once (the core fix)', async () => {
  const store = new InMemoryRecoveryCodeStore();
  const { plaintextCodes, hashedCodes } = generateRecoveryCodes(3);
  store.setHashedCodes('owner-2', hashedCodes);

  // Fire both requests "at the same time" — this is exactly the race the
  // audit described: two concurrent callers with the same original set.
  const [resultA, resultB] = await Promise.all([
    consumeRecoveryCodeAtomically(store, 'owner-2', plaintextCodes[0]),
    consumeRecoveryCodeAtomically(store, 'owner-2', plaintextCodes[0]),
  ]);

  const successes = [resultA, resultB].filter((r) => r.valid === true);
  const failures = [resultA, resultB].filter((r) => r.valid === false);
  assert.equal(successes.length, 1, 'exactly one of the two concurrent attempts must succeed');
  assert.equal(failures.length, 1, 'exactly one of the two concurrent attempts must fail');
  assert.equal(store.getHashedCodes('owner-2').length, 2, 'code count reflects exactly one consumption, not zero or two');
});

test('atomic recovery: FIVE concurrent attempts at the same code -> exactly one success', async () => {
  const store = new InMemoryRecoveryCodeStore();
  const { plaintextCodes, hashedCodes } = generateRecoveryCodes(5);
  store.setHashedCodes('owner-3', hashedCodes);

  const attempts = Array.from({ length: 5 }, () => consumeRecoveryCodeAtomically(store, 'owner-3', plaintextCodes[0]));
  const results = await Promise.all(attempts);
  const successCount = results.filter((r) => r.valid).length;
  assert.equal(successCount, 1);
  assert.equal(store.getHashedCodes('owner-3').length, 4);
});

test('atomic recovery: different owners consuming concurrently do not interfere with each other', async () => {
  const store = new InMemoryRecoveryCodeStore();
  const ownerACodes = generateRecoveryCodes(2);
  const ownerBCodes = generateRecoveryCodes(2);
  store.setHashedCodes('owner-A', ownerACodes.hashedCodes);
  store.setHashedCodes('owner-B', ownerBCodes.hashedCodes);

  const [resultA, resultB] = await Promise.all([
    consumeRecoveryCodeAtomically(store, 'owner-A', ownerACodes.plaintextCodes[0]),
    consumeRecoveryCodeAtomically(store, 'owner-B', ownerBCodes.plaintextCodes[0]),
  ]);
  assert.equal(resultA.valid, true);
  assert.equal(resultB.valid, true);
});

test('atomic recovery: wrong code / empty store / missing ownerId fail closed', async () => {
  const store = new InMemoryRecoveryCodeStore();
  const { hashedCodes } = generateRecoveryCodes(2);
  store.setHashedCodes('owner-4', hashedCodes);

  assert.equal((await consumeRecoveryCodeAtomically(store, 'owner-4', 'wrong-code')).valid, false);
  assert.equal((await consumeRecoveryCodeAtomically(store, 'owner-nobody', 'anything')).valid, false);
  assert.equal((await consumeRecoveryCodeAtomically(store, '', 'anything')).valid, false);
  assert.equal((await consumeRecoveryCodeAtomically(store, 'owner-4', null)).valid, false);
});

// ================= OWNER AUTHORIZATION — server-authoritative MFA proof (post-audit, BLOCKER fix) =================

test('BLOCKER FIX: a caller can no longer just assert MFA verified — there is no boolean parameter to inject "true" into', async () => {
  // Structural proof: authorizeOwnerAction's context type has no field that
  // accepts a bare boolean claim of MFA success. Demonstrate that supplying
  // a fabricated/never-issued verificationId is denied exactly like no
  // proof at all.
  const store = new InMemoryMfaVerificationStore();
  const forged = await authorizeOwnerAction(store, {
    role: 'OWNER',
    ownerId: 'owner-1',
    action: 'EDIT_LOCKED_FORMULA',
    verificationId: 'a-verification-id-nobody-ever-issued',
  });
  assert.equal(forged.allowed, false);
  assert.match(forged.reason, /unknown verification proof/);
});

test('authorizeOwnerAction: real TOTP verification issues a proof that authorizes exactly once (sequential replay)', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);

  const proof = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'EDIT_LOCKED_FORMULA', secret, code, now);
  assert.ok(proof);

  const first = await authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-1', action: 'EDIT_LOCKED_FORMULA', verificationId: proof.verificationId }, now);
  assert.equal(first.allowed, true);

  // Replay the SAME proof AFTER the first has fully completed -> must be denied (single-use)
  const replay = await authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-1', action: 'EDIT_LOCKED_FORMULA', verificationId: proof.verificationId }, now);
  assert.equal(replay.allowed, false);
  assert.match(replay.reason, /already used/);
});

test('BLOCKER FIX (round 2): CONCURRENT replay of the SAME valid proof -> exactly one ALLOW, one DENY', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);

  const proof = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'EDIT_LOCKED_FORMULA', secret, code, now);
  assert.ok(proof);

  // Fire both authorization attempts "at the same time" against the SAME
  // verificationId — this is exactly the race the audit described: both
  // could see consumed=false before either write lands, without the
  // atomic consumeIfValid() fix.
  const [resultA, resultB] = await Promise.all([
    authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-1', action: 'EDIT_LOCKED_FORMULA', verificationId: proof.verificationId }, now),
    authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-1', action: 'EDIT_LOCKED_FORMULA', verificationId: proof.verificationId }, now),
  ]);

  const allowedCount = [resultA, resultB].filter((r) => r.allowed === true).length;
  const deniedCount = [resultA, resultB].filter((r) => r.allowed === false).length;
  assert.equal(allowedCount, 1, 'exactly one of the two concurrent authorization attempts must be ALLOWED');
  assert.equal(deniedCount, 1, 'exactly one of the two concurrent authorization attempts must be DENIED');
});

test('BLOCKER FIX (round 2): TEN concurrent attempts at the same proof -> exactly one ALLOW', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);

  const proof = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'PAYMENT_OVERRIDE', secret, code, now);
  assert.ok(proof);

  const attempts = Array.from({ length: 10 }, () =>
    authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-1', action: 'PAYMENT_OVERRIDE', verificationId: proof.verificationId }, now)
  );
  const results = await Promise.all(attempts);
  const allowedCount = results.filter((r) => r.allowed).length;
  assert.equal(allowedCount, 1);
});

test('concurrent authorization on TWO DIFFERENT valid proofs (different verificationIds) -> both succeed independently', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;

  const proof1 = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'EDIT_LOCKED_FORMULA', secret, generateTotpCode(secret, now), now);
  const proof2 = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'SECURITY_CONFIG_CHANGE', secret, generateTotpCode(secret, now), now);

  const [resultA, resultB] = await Promise.all([
    authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-1', action: 'EDIT_LOCKED_FORMULA', verificationId: proof1.verificationId }, now),
    authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-1', action: 'SECURITY_CONFIG_CHANGE', verificationId: proof2.verificationId }, now),
  ]);
  assert.equal(resultA.allowed, true);
  assert.equal(resultB.allowed, true);
});

test('authorizeOwnerAction: wrong TOTP code never produces a usable proof', () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;

  const proof = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'EDIT_LOCKED_FORMULA', secret, '000000', now);
  assert.equal(proof, null);
});

test('authorizeOwnerAction: proof issued for a different action is rejected', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);

  const proof = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'EDIT_LOCKED_FORMULA', secret, code, now);
  const result = await authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-1', action: 'PAYMENT_OVERRIDE', verificationId: proof.verificationId }, now);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /issued for action/);
});

test('authorizeOwnerAction: proof issued for a different owner is rejected', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);

  const proof = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'EDIT_LOCKED_FORMULA', secret, code, now);
  const result = await authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-999', action: 'EDIT_LOCKED_FORMULA', verificationId: proof.verificationId }, now);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /does not belong to this owner/);
});

test('authorizeOwnerAction: stale proof (older than 5 minutes) is rejected even if otherwise valid', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);

  const proof = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'EDIT_LOCKED_FORMULA', secret, code, now);
  const sixMinutesLater = now + 1000 * 60 * 6;
  const result = await authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-1', action: 'EDIT_LOCKED_FORMULA', verificationId: proof.verificationId }, sixMinutesLater);
  assert.equal(result.allowed, false);
  assert.match(result.reason, /stale/);
});

test('authorizeOwnerAction: ADMIN role denied regardless of a valid proof', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);

  const proof = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'PAYMENT_OVERRIDE', secret, code, now);
  const result = await authorizeOwnerAction(mfaStore, { role: 'ADMIN', ownerId: 'owner-1', action: 'PAYMENT_OVERRIDE', verificationId: proof.verificationId }, now);
  assert.equal(result.allowed, false);
});

test('authorizeOwnerAction: AI_AGENT can never obtain Owner authority, even with a valid proof', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const secret = generateTotpSecret();
  const now = 1_700_000_000_000;
  const code = generateTotpCode(secret, now);

  const proof = verifyOwnerTotpAndIssueProof(mfaStore, 'owner-1', 'GRANT_AUTHORITY', secret, code, now);
  const result = await authorizeOwnerAction(mfaStore, { role: 'AI_AGENT', ownerId: 'owner-1', action: 'GRANT_AUTHORITY', verificationId: proof.verificationId }, now);
  assert.equal(result.allowed, false);
});

test('authorizeOwnerAction: missing role/ownerId/verificationId all deny, never throw', async () => {
  const store = new InMemoryMfaVerificationStore();
  assert.equal((await authorizeOwnerAction(store, { role: null, ownerId: 'o1', action: 'EDIT_LOCKED_FORMULA', verificationId: 'x' })).allowed, false);
  assert.equal((await authorizeOwnerAction(store, { role: 'OWNER', ownerId: null, action: 'EDIT_LOCKED_FORMULA', verificationId: 'x' })).allowed, false);
  assert.equal((await authorizeOwnerAction(store, { role: 'OWNER', ownerId: 'o1', action: 'EDIT_LOCKED_FORMULA', verificationId: null })).allowed, false);
});

// ================= OWNER AUTHORIZATION — recovery-code path issuing a proof =================

test('verifyOwnerRecoveryCodeAndIssueProof: valid recovery code issues a usable proof', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const recoveryStore = new InMemoryRecoveryCodeStore();
  const { plaintextCodes, hashedCodes } = generateRecoveryCodes(3);
  recoveryStore.setHashedCodes('owner-5', hashedCodes);

  const proof = await verifyOwnerRecoveryCodeAndIssueProof(mfaStore, recoveryStore, 'owner-5', 'SECURITY_CONFIG_CHANGE', plaintextCodes[0]);
  assert.ok(proof);
  const decision = await authorizeOwnerAction(mfaStore, { role: 'OWNER', ownerId: 'owner-5', action: 'SECURITY_CONFIG_CHANGE', verificationId: proof.verificationId }, proof.verifiedAt);
  assert.equal(decision.allowed, true);
});

test('verifyOwnerRecoveryCodeAndIssueProof: two concurrent recovery-code authorization attempts with the same code -> exactly one proof issued', async () => {
  const mfaStore = new InMemoryMfaVerificationStore();
  const recoveryStore = new InMemoryRecoveryCodeStore();
  const { plaintextCodes, hashedCodes } = generateRecoveryCodes(3);
  recoveryStore.setHashedCodes('owner-6', hashedCodes);

  const [proofA, proofB] = await Promise.all([
    verifyOwnerRecoveryCodeAndIssueProof(mfaStore, recoveryStore, 'owner-6', 'GRANT_AUTHORITY', plaintextCodes[0]),
    verifyOwnerRecoveryCodeAndIssueProof(mfaStore, recoveryStore, 'owner-6', 'GRANT_AUTHORITY', plaintextCodes[0]),
  ]);
  const issuedCount = [proofA, proofB].filter((p) => p !== null).length;
  assert.equal(issuedCount, 1);
});

// ================= ADMIN -/-> OWNER BOUNDARY (regression) =================

test('canActOnUserAccount: ADMIN on USER -> ALLOW; ADMIN on OWNER -> DENY; OWNER on OWNER -> ALLOW', () => {
  assert.equal(canActOnUserAccount('ADMIN', 'USER').allowed, true);
  assert.equal(canActOnUserAccount('ADMIN', 'OWNER').allowed, false);
  assert.equal(canActOnUserAccount('OWNER', 'OWNER').allowed, true);
  assert.equal(canActOnUserAccount('AI_AGENT', 'OWNER').allowed, false);
  assert.equal(canActOnUserAccount(null, 'USER').allowed, false);
});

// ================= AUDIT REDACTION (regression) =================

test('audit redaction: recoveryCode and totpSecret keys are redacted', () => {
  const entry = buildAuditEntry('OWNER', 'owner-1', 'MFA_RECOVERY_USED', 'session', {
    recoveryCode: 'abc123def4',
    totpSecret: 'JBSWY3DPEHPK3PXP',
    safeField: 'this stays',
  });
  assert.equal(entry.detail.recoveryCode, '[REDACTED]');
  assert.equal(entry.detail.totpSecret, '[REDACTED]');
  assert.equal(entry.detail.safeField, 'this stays');
});
