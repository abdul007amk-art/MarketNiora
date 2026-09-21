import { PrismaClient } from '@prisma/client';

const NON_PROD_SUPABASE_REF = 'qvlhkeacbngvpldolxvd';
const PRODUCTION_SUPABASE_REF = 'lrbgicuzlhgnfplnmvre';

export function isNonProdDbTarget(): boolean {
  return process.env.MARKETNIORA_DB_TARGET === 'NON_PROD';
}

export function assertNonProdDatabaseAccess(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing Prisma auth store access: NODE_ENV=production is not allowed for the non-prod DB layer.');
  }

  if (!isNonProdDbTarget()) {
    throw new Error('Refusing Prisma auth store access: MARKETNIORA_DB_TARGET must be NON_PROD.');
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Refusing Prisma auth store access: DATABASE_URL is not configured.');
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
