import { PrismaClient } from '@prisma/client';

const NON_PROD_SUPABASE_REF = 'qvlhkeacbngvpldolxvd';
const PRODUCTION_SUPABASE_REF = 'lrbgicuzlhgnfplnmvre';

export function isNonProdDbTarget(): boolean {
  return process.env.MARKETNIORA_DB_TARGET === 'NON_PROD';
}

/**
 * Explicitly allow the ephemeral local PostgreSQL database used by the
 * GitHub Actions auth-store integration test. This path is intentionally
 * narrower than the real NON_PROD target and can never be used in production.
 */
function assertCiAuthDatabaseAccess(databaseUrl: string): void {
  if (
    process.env.MARKETNIORA_DB_TARGET !== 'CI_TEST' ||
    process.env.MARKETNIORA_CI_AUTH_DB_TEST !== '1' ||
    process.env.CI !== 'true' ||
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error('Refusing Prisma auth store access: CI_TEST requires the explicit GitHub Actions test environment.');
  }

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('Refusing Prisma auth store access: CI_TEST DATABASE_URL is invalid.');
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
  const databaseName = parsed.pathname.replace(/^\/+/, '');
  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    !localHosts.has(parsed.hostname) ||
    databaseName !== 'marketniora_auth_ci' ||
    parsed.href.includes(PRODUCTION_SUPABASE_REF) ||
    parsed.href.includes(NON_PROD_SUPABASE_REF)
  ) {
    throw new Error('Refusing Prisma auth store access: CI_TEST only permits the isolated local marketniora_auth_ci PostgreSQL database.');
  }
}

export function assertNonProdDatabaseAccess(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing Prisma auth store access: NODE_ENV=production is not allowed for the non-prod DB layer.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Refusing Prisma auth store access: DATABASE_URL is not configured.');
  }

  if (process.env.MARKETNIORA_DB_TARGET === 'CI_TEST') {
    assertCiAuthDatabaseAccess(databaseUrl);
    return;
  }

  if (!isNonProdDbTarget()) {
    throw new Error('Refusing Prisma auth store access: MARKETNIORA_DB_TARGET must be NON_PROD.');
  }

  if (databaseUrl.includes(PRODUCTION_SUPABASE_REF)) {
    throw new Error('Refusing Prisma auth store access: production Supabase project detected.');
  }

  if (!databaseUrl.includes(NON_PROD_SUPABASE_REF)) {
    throw new Error('Refusing Prisma auth store access: DATABASE_URL is not the approved MarketNiora non-prod clone.');
  }
}

let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  assertNonProdDatabaseAccess();
  prisma ??= new PrismaClient();
  return prisma;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}
