import { createHash, randomUUID } from 'node:crypto';
import { assertNonProdDatabaseAccess, disconnectPrismaClient, getPrismaClient } from '../backend/src/db/prisma.ts';
import { NonProdLocalSecretCipher } from '../backend/src/db/nonProdSecretCipher.ts';
import { PrismaOwnerMfaChallengeStore, PrismaOwnerTotpStore, PrismaSessionStore, PrismaUserStore } from '../backend/src/db/authStores.ts';
import type { StoredUser } from '../backend/src/api/userStore.ts';
import type { Session } from '../backend/src/auth/sessionManager.ts';

const TEST_RUN_ID = randomUUID();
const TEST_USER_ID = randomUUID();
const TEST_EMAIL = 'marketniora-db-integration-' + TEST_RUN_ID + '@example.invalid';
const OIDC_ISSUER = 'https://accounts.google.com';
const OIDC_SUBJECT = 'integration-test-' + TEST_RUN_ID;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error('ASSERTION FAILED: ' + message);
}
function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error('ASSERTION FAILED: ' + message + '\nExpected: ' + String(expected) + '\nActual:   ' + String(actual));
}
function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest();
}
function pass(message: string): void { console.log('  ✓ ' + message); }

async function cleanup(prisma: ReturnType<typeof getPrismaClient>): Promise<void> {
  // Store interfaces intentionally expose logical session revoke rather than physical deletion.
  // Cleanup is scoped only to this run's unique test UUID.
  await prisma.ownerMfaChallenge.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.ownerTotpSecret.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.session.deleteMany({ where: { userId: TEST_USER_ID } });
  await prisma.appUser.deleteMany({ where: { userId: TEST_USER_ID } });
}

async function main(): Promise<void> {
  console.log('============================================================');
  console.log('MarketNiora NON-PROD DB Auth Integration Test');
  console.log('============================================================');

  console.log('\n[TEST] Checking non-production guard');
  assertNonProdDatabaseAccess();
  assertEqual(process.env.MARKETNIORA_DB_TARGET, 'NON_PROD', 'MARKETNIORA_DB_TARGET must be NON_PROD');
  assertEqual(process.env.KMS_PROVIDER, 'local-dev', 'KMS_PROVIDER must be local-dev for non-prod TOTP encryption');
  assert(process.env.KMS_LOCAL_MASTER_KEY, 'KMS_LOCAL_MASTER_KEY must be configured');
  pass('Non-production guard accepted the environment');

  const prisma = getPrismaClient();
  const userStore = new PrismaUserStore(prisma);
  const sessionStore = new PrismaSessionStore(prisma);
  const cipher = new NonProdLocalSecretCipher();
  const totpStore = new PrismaOwnerTotpStore(prisma, cipher);
  const mfaStore = new PrismaOwnerMfaChallengeStore(prisma);

  try {
    console.log('\n[TEST] Connecting to non-prod PostgreSQL');
    await prisma.$connect();
    const result = await prisma.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`;
    assert(result.length === 1, 'database connectivity query returned no rows');
    pass('Database connection successful: ' + result[0].now.toISOString());

    console.log('\n[TEST] PrismaUserStore CREATE');
    const user: StoredUser = { userId: TEST_USER_ID, email: TEST_EMAIL, oidcIssuer: OIDC_ISSUER, oidcSubject: OIDC_SUBJECT, role: 'OWNER', emailVerified: true };
    await userStore.create(user);
    pass('Created AppUser ' + TEST_USER_ID);

    console.log('\n[TEST] PrismaUserStore READ');
    const byEmail = await userStore.getByEmail(TEST_EMAIL);
    assert(byEmail, 'user not found by email');
    assertEqual(byEmail.userId, TEST_USER_ID, 'user ID mismatch');
    assertEqual(byEmail.oidcSubject, OIDC_SUBJECT, 'OIDC subject mismatch');
    const byId = await userStore.getById(TEST_USER_ID);
    assert(byId, 'user not found by ID');
    pass('User read by email and ID');

    console.log('\n[TEST] PrismaUserStore UPDATE');
    await userStore.setRole(TEST_USER_ID, 'ADMIN');
    const updatedUser = await userStore.getById(TEST_USER_ID);
    assert(updatedUser, 'updated user not found');
    assertEqual(updatedUser.role, 'ADMIN', 'role update did not persist');
    await userStore.setRole(TEST_USER_ID, 'OWNER');
    pass('User role OWNER -> ADMIN -> OWNER persisted');

    console.log('\n[TEST] PrismaSessionStore CREATE');
    const sessionToken = 'integration-session-' + TEST_RUN_ID + '-' + randomUUID();
    const issuedAt = Date.now();
    const expiresAt = issuedAt + 60 * 60 * 1000;
    const session: Session = { token: sessionToken, userId: TEST_USER_ID, role: 'OWNER', issuedAt, expiresAt };
    await sessionStore.set(sessionToken, session);

    console.log('[TEST] Verifying SHA-256 session-token hashing');
    const expectedSessionHash = sha256(sessionToken);
    const sessionRow = await prisma.session.findUnique({ where: { tokenHash: expectedSessionHash } });
    assert(sessionRow, 'session row not found by SHA-256 hash');
    const storedSessionHash = Buffer.from(sessionRow.tokenHash);
    assertEqual(storedSessionHash.length, 32, 'session hash must be 32 bytes');
    assert(storedSessionHash.equals(expectedSessionHash), 'stored session hash is not SHA-256(token)');
    assert(!storedSessionHash.equals(Buffer.from(sessionToken, 'utf8')), 'session token appears to be stored as plaintext');
    pass('Session token is stored as SHA-256, not plaintext');

    console.log('[TEST] PrismaSessionStore READ');
    const readSession = await sessionStore.get(sessionToken);
    assert(readSession, 'session not returned by get()');
    assertEqual(readSession.userId, TEST_USER_ID, 'session user ID mismatch');
    assertEqual(readSession.expiresAt, expiresAt, 'session expiry mismatch');
    pass('Session read successfully');

    console.log('[TEST] PrismaSessionStore UPDATE');
    const updatedExpiresAt = issuedAt + 2 * 60 * 60 * 1000;
    await sessionStore.set(sessionToken, { ...session, expiresAt: updatedExpiresAt });
    const updatedSession = await sessionStore.get(sessionToken);
    assert(updatedSession, 'updated session not found');
    assertEqual(updatedSession.expiresAt, updatedExpiresAt, 'session expiry update did not persist');
    pass('Session update persisted');

    console.log('[TEST] PrismaSessionStore logical DELETE / REVOKE');
    await sessionStore.revoke(sessionToken);
    assert((await sessionStore.get(sessionToken)) === undefined, 'revoked session must not be returned');
    const revokedRow = await prisma.session.findUnique({ where: { tokenHash: expectedSessionHash } });
    assert(revokedRow?.revokedAt !== null, 'revoked_at was not persisted');
    pass('Session revoke persisted');

    console.log('\n[TEST] PrismaOwnerTotpStore CREATE');
    const totpSecret = 'JBSWY3DPEHPK3PXP' + TEST_RUN_ID.replace(/-/g, '').slice(0, 8).toUpperCase();
    await totpStore.set(TEST_USER_ID, { secret: totpSecret, confirmedAt: null });

    console.log('[TEST] Verifying AES-256-GCM TOTP encryption');
    const totpRow = await prisma.ownerTotpSecret.findUnique({ where: { userId: TEST_USER_ID } });
    assert(totpRow, 'TOTP row not found');
    const ciphertext = Buffer.from(totpRow.secretCiphertext);
    assert(ciphertext.length > 29, 'encrypted TOTP envelope is unexpectedly short');
    assert(!ciphertext.equals(Buffer.from(totpSecret, 'utf8')), 'TOTP secret appears to be stored as plaintext');
    assertEqual(totpRow.kmsKeyRef, cipher.keyRef, 'TOTP KMS key ref mismatch');
    assertEqual(totpRow.keyVersion, cipher.keyVersion, 'TOTP key version mismatch');
    pass('TOTP secret is encrypted in the database');

    console.log('[TEST] PrismaOwnerTotpStore READ + DECRYPT');
    const decrypted = await totpStore.get(TEST_USER_ID);
    assert(decrypted, 'TOTP record not returned');
    assertEqual(decrypted.secret, totpSecret, 'TOTP AES-GCM round-trip failed');
    assertEqual(decrypted.confirmedAt, null, 'initial confirmedAt must be null');
    pass('TOTP secret decrypts correctly through the store');

    console.log('[TEST] PrismaOwnerTotpStore UPDATE');
    const confirmedAt = Date.now();
    await totpStore.set(TEST_USER_ID, { secret: totpSecret, confirmedAt });
    const updatedTotp = await totpStore.get(TEST_USER_ID);
    assert(updatedTotp, 'updated TOTP record not found');
    assertEqual(updatedTotp.secret, totpSecret, 'TOTP secret changed during update');
    assertEqual(updatedTotp.confirmedAt, confirmedAt, 'confirmedAt update failed');
    pass('TOTP update persisted');

    console.log('\n[TEST] PrismaOwnerMfaChallengeStore CREATE');
    const rawChallenge = 'integration-challenge-' + TEST_RUN_ID + '-' + randomUUID();
    const challengeHash = createHash('sha256').update(rawChallenge, 'utf8').digest('hex');
    await mfaStore.set(challengeHash, { userId: TEST_USER_ID, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0, consumedAt: null });

    console.log('[TEST] Verifying SHA-256 MFA challenge hashing');
    const challengeRow = await prisma.ownerMfaChallenge.findUnique({ where: { challengeHash: sha256(rawChallenge) } });
    assert(challengeRow, 'MFA challenge row not found by SHA-256 hash');
    const storedChallengeHash = Buffer.from(challengeRow.challengeHash);
    assertEqual(storedChallengeHash.length, 32, 'MFA hash must be 32 bytes');
    assert(storedChallengeHash.equals(sha256(rawChallenge)), 'stored MFA challenge hash is incorrect');
    assert(!storedChallengeHash.equals(Buffer.from(rawChallenge, 'utf8')), 'MFA challenge appears to be stored as plaintext');
    pass('MFA challenge is stored as SHA-256, not plaintext');

    console.log('[TEST] PrismaOwnerMfaChallengeStore READ');
    const challenge = await mfaStore.get(challengeHash);
    assert(challenge, 'MFA challenge not returned');
    assertEqual(challenge.userId, TEST_USER_ID, 'MFA user ID mismatch');
    assertEqual(challenge.attempts, 0, 'initial MFA attempts mismatch');
    pass('MFA challenge read successfully');

    console.log('[TEST] PrismaOwnerMfaChallengeStore UPDATE');
    await mfaStore.set(challengeHash, { ...challenge, attempts: 1 });
    const updatedChallenge = await mfaStore.get(challengeHash);
    assert(updatedChallenge, 'updated MFA challenge not found');
    assertEqual(updatedChallenge.attempts, 1, 'MFA attempt update did not persist');
    pass('MFA challenge update persisted');

    console.log('\n[TEST] Physical cleanup');
    await cleanup(prisma);
    const remainingUser = await prisma.appUser.findUnique({ where: { userId: TEST_USER_ID } });
    const remainingSessions = await prisma.session.count({ where: { userId: TEST_USER_ID } });
    const remainingTotp = await prisma.ownerTotpSecret.count({ where: { userId: TEST_USER_ID } });
    const remainingMfa = await prisma.ownerMfaChallenge.count({ where: { userId: TEST_USER_ID } });
    assert(remainingUser === null, 'test user remains after cleanup');
    assertEqual(remainingSessions, 0, 'test sessions remain after cleanup');
    assertEqual(remainingTotp, 0, 'test TOTP remains after cleanup');
    assertEqual(remainingMfa, 0, 'test MFA challenges remain after cleanup');
    pass('All test rows removed and database is clean');

    console.log('\n============================================================');
    console.log('PASS — NON-PROD DB auth integration test');
    console.log('============================================================');
  } finally {
    try { await cleanup(prisma); }
    catch (cleanupError) { console.error('\nWARNING: automatic cleanup failed.'); console.error(cleanupError instanceof Error ? cleanupError.message : cleanupError); }
    await disconnectPrismaClient();
  }
}

main().catch((error) => {
  console.error('\n============================================================');
  console.error('FAIL — NON-PROD DB auth integration test');
  console.error('============================================================');
  console.error(error instanceof Error ? error.message : error);
  console.error('\nVerify:');
  console.error('  MARKETNIORA_DB_TARGET=NON_PROD');
  console.error('  NODE_ENV is not production');
  console.error('  DATABASE_URL points to the approved non-prod Supabase project');
  console.error('  KMS_PROVIDER=local-dev');
  console.error('  KMS_LOCAL_MASTER_KEY is configured');
  process.exitCode = 1;
});