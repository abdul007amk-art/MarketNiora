import { createHash, randomBytes } from 'crypto';
import { generateTotpSecret, verifyTotpCode } from './totp.ts';

export interface OwnerTotpRecord { secret: string; confirmedAt: number | null; }
export interface OwnerTotpStore {
  get(userId: string): OwnerTotpRecord | undefined | Promise<OwnerTotpRecord | undefined>;
  set(userId: string, record: OwnerTotpRecord): void | Promise<void>;
}
export interface OwnerMfaChallengeRecord { userId: string; expiresAt: number; attempts: number; consumedAt: number | null; }
export interface OwnerMfaChallengeStore {
  get(hash: string): OwnerMfaChallengeRecord | undefined | Promise<OwnerMfaChallengeRecord | undefined>;
  set(hash: string, record: OwnerMfaChallengeRecord): void | Promise<void>;
}

export class InMemoryOwnerTotpStore implements OwnerTotpStore {
  private records = new Map<string, OwnerTotpRecord>();
  get(userId: string): OwnerTotpRecord | undefined { return this.records.get(userId); }
  set(userId: string, record: OwnerTotpRecord): void { this.records.set(userId, structuredClone(record)); }
}
export class InMemoryOwnerMfaChallengeStore implements OwnerMfaChallengeStore {
  private records = new Map<string, OwnerMfaChallengeRecord>();
  get(hash: string): OwnerMfaChallengeRecord | undefined { return this.records.get(hash); }
  set(hash: string, record: OwnerMfaChallengeRecord): void { this.records.set(hash, structuredClone(record)); }
}
export function hashChallenge(challenge: string): string { return createHash('sha256').update(challenge).digest('hex'); }

export async function provisionOwnerTotp(store: OwnerTotpStore, userId: string): Promise<{ secret: string; otpauthUri: string }> {
  if ((await store.get(userId))?.confirmedAt) throw new Error('confirmed TOTP already exists');
  const secret = generateTotpSecret();
  await store.set(userId, { secret, confirmedAt: null });
  return { secret, otpauthUri: 'otpauth://totp/MarketNiora:owner?secret=' + secret + '&issuer=MarketNiora&algorithm=SHA1&digits=6&period=30' };
}

export async function confirmOwnerTotp(store: OwnerTotpStore, userId: string, code: string, now = Date.now()): Promise<boolean> {
  const record = await store.get(userId);
  if (!record || record.confirmedAt) return false;
  const result = verifyTotpCode(record.secret, code, now);
  if (!result.valid) return false;
  await store.set(userId, { ...record, confirmedAt: now });
  return true;
}

export async function beginOwnerMfa(store: OwnerTotpStore, challenges: OwnerMfaChallengeStore, userId: string, now = Date.now()): Promise<string | null> {
  if (!(await store.get(userId))?.confirmedAt) return null;
  const challenge = randomBytes(32).toString('hex');
  await challenges.set(hashChallenge(challenge), { userId, expiresAt: now + 5 * 60 * 1000, attempts: 0, consumedAt: null });
  return challenge;
}

export async function verifyOwnerMfa(store: OwnerTotpStore, challenges: OwnerMfaChallengeStore, challenge: string, code: string, now = Date.now()): Promise<{ success: boolean; userId?: string }> {
  const hash = hashChallenge(challenge);
  const record = await challenges.get(hash);
  if (!record || record.consumedAt || now >= record.expiresAt || record.attempts >= 5) return { success: false };
  record.attempts += 1;
  const secret = await store.get(record.userId);
  if (!secret?.confirmedAt || !verifyTotpCode(secret.secret, code, now).valid) {
    await challenges.set(hash, record);
    return { success: false };
  }
  record.consumedAt = now;
  await challenges.set(hash, record);
  return { success: true, userId: record.userId };
}
