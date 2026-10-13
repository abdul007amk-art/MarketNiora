const test = require('node:test');
const assert = require('node:assert/strict');
const { assertNonProdDatabaseAccess } = require('../backend/src/db/prisma.ts');

const envKeys = [
  'NODE_ENV',
  'CI',
  'MARKETNIORA_DB_TARGET',
  'MARKETNIORA_CI_AUTH_DB_TEST',
  'DATABASE_URL',
];
const originalEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));

function setCiEnv(overrides = {}) {
  process.env.NODE_ENV = 'test';
  process.env.CI = 'true';
  process.env.MARKETNIORA_DB_TARGET = 'CI_TEST';
  process.env.MARKETNIORA_CI_AUTH_DB_TEST = '1';
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/marketniora_auth_ci';
  Object.assign(process.env, overrides);
}

function restoreEnv() {
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
}

test('Prisma auth DB guard permits only the explicit local CI database target', () => {
  try {
    setCiEnv();
    assert.doesNotThrow(() => assertNonProdDatabaseAccess());

    setCiEnv({ DATABASE_URL: 'postgresql://user:pass@remote.example:5432/marketniora_auth_ci' });
    assert.throws(() => assertNonProdDatabaseAccess(), /only permits the isolated local/);

    setCiEnv({ DATABASE_URL: 'postgresql://user:pass@localhost:5432/postgres' });
    assert.throws(() => assertNonProdDatabaseAccess(), /only permits the isolated local/);

    setCiEnv({ CI: 'false' });
    assert.throws(() => assertNonProdDatabaseAccess(), /explicit GitHub Actions test environment/);

    setCiEnv({ MARKETNIORA_CI_AUTH_DB_TEST: '0' });
    assert.throws(() => assertNonProdDatabaseAccess(), /explicit GitHub Actions test environment/);

    setCiEnv({ NODE_ENV: 'production' });
    assert.throws(() => assertNonProdDatabaseAccess(), /NODE_ENV=production/);

    setCiEnv({ MARKETNIORA_DB_TARGET: 'NON_PROD', DATABASE_URL: 'postgresql://user:pass@localhost:5432/marketniora_auth_ci' });
    assert.throws(() => assertNonProdDatabaseAccess(), /approved MarketNiora non-prod clone/);

    setCiEnv({ MARKETNIORA_DB_TARGET: 'NON_PROD', DATABASE_URL: 'postgresql://user:pass@db.lrbgicuzlhgnfplnmvre.supabase.co:5432/postgres' });
    assert.throws(() => assertNonProdDatabaseAccess(), /production Supabase project detected/);
  } finally {
    restoreEnv();
  }
});
