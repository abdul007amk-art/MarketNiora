const test = require('node:test');
const assert = require('node:assert/strict');
const { buildAuditEntry, PrismaAuditLogStore, writeAuditLog } = require('../backend/src/security/auditLogger.ts');

test('audit persistence redacts sensitive metadata before database write', async () => {
  let captured = null;
  const prisma = { appAuditLog: { create: async ({ data }) => { captured = data; return data; } } };
  const store = new PrismaAuditLogStore(prisma);
  const actorId = '123e4567-e89b-12d3-a456-426614174000';
  await store.append(buildAuditEntry('SYSTEM', actorId, 'TEST_AUDIT', 'target-1', {
    ok: 'kept',
    apiKey: 'hidden',
    nested: { password: 'hidden-too', value: 7 }
  }));
  assert.equal(captured.actorType, 'SYSTEM');
  assert.equal(captured.actorId, actorId);
  assert.equal(captured.targetId, 'target-1');
  assert.equal(captured.metadata.ok, 'kept');
  assert.equal(captured.metadata.apiKey, '[REDACTED]');
  assert.equal(captured.metadata.nested.password, '[REDACTED]');
});

test('audit persistence propagates database failure and never reports false success', async () => {
  const prisma = { appAuditLog: { create: async () => { throw new Error('database unavailable'); } } };
  await assert.rejects(() => writeAuditLog(buildAuditEntry('SYSTEM', null, 'TEST_AUDIT'), prisma), /database unavailable/);
});

test('audit entry rejects empty actions', () => {
  assert.throws(() => buildAuditEntry('SYSTEM', null, '   '), /audit action cannot be empty/);
});
