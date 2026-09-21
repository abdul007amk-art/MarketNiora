import { createHash, randomBytes } from 'crypto';
import { generateTotpSecret, verifyTotpCode } from './totp.ts';

export interface OwnerTotpRecord { secret: string; confirmedAt: number | null; }
export interface OwnerTotpStore { get(userId: string): OwnerTotpRecord | undefined; set(userId: string, record: OwnerTotpRecord): void; }
export interface OwnerMfaChallengeRecord { userId: string; expiresAt: number; attempts: number; consumedAt: number | null; }
export interface OwnerMfaChallengeStore { get(hash: string): OwnerMfaChallengeRecord | undefined; set(hash: string, record: OwnerMfaChallengeRecord): void; }

export class InMemoryOwnerTotpStore implements OwnerTotpStore {
  private records = new Map<string, OwnerTotpRecord>();
  get(userId: string) { return this.records.get(userId); }
  set(userId: string, record: OwnerTotpRecord) { this.records.set(userId, structuredClone(record)); }
}
export class InMemoryOwnerMfaChallengeStore implements OwnerMfaChallengeStore {
  private records = new Map<string, OwnerMfaChallengeRecord>();
  get(hash: string) { return this.records.get(hash); }
  set(hash: string, record: OwnerMfaChallengeRecord) { this.records.set(hash, structuredClone(record)); }
}
export function hashChallenge(challenge: string): string { return createHash('sha256').update(challenge).digest('hex'); }

export function provisionOwnerTotp(store: OwnerTotpStore, userId: string): { secret: string; otpauthUri: string } {
  if (store.get(userId)?.confirmedAt) throw new Error('confirmed TOTP already exists');
  const secret = generateTotpSecret();
  store.set(userId, { secret, confirmedAt: null });
  return { secret, otpauthUri: 'otpauth://totp/MarketNiora:owner?secret=' + secret + '&issuer=MarketNiora&algorithm=SHA1&digits=6&period=30' };
}

export function confirmOwnerTotp(store: OwnerTotpStore, userId: string, code: string, now = Date.now()): boolean {
  const record = store.get(userId);
  if (!record || record.confirmedAt) return false;
  const result = verifyTotpCode(record.secret, code, now);
  if (!result.valid) return false;
  store.set(userId, { ...record, confirmedAt: now });
  return true;
}

export function beginOwnerMfa(store: OwnerTotpStore, challenges: OwnerMfaChallengeStore, userId: string, now = Date.now()): string | null {
  if (!store.get(userId)?.confirmedAt) return null;
  const challenge = randomBytes(32).toString('hex');
  challenges.set(hashChallenge(challenge), { userId, expiresAt: now + 5 * 60 * 1000, attempts: 0, consumedAt: null });
  return challenge;
}

export function verifyOwnerMfa(store: OwnerTotpStore, challenges: OwnerMfaChallengeStore, challenge: string, code: string, now = Date.now()): { success: boolean; userId?: string } {
  const record = challenges.get(hashChallenge(challenge));
  if (!record || record.consumedAt || now >= record.expiresAt || record.attempts >= 5) return { success: false };
  record.attempts += 1;
  const secret = store.get(record.userId);
  if (!secret?.confirmedAt || !verifyTotpCode(secret.secret, code, now).valid) {
    challenges.set(hashChallenge(challenge), record);
    return { success: false };
  }
  record.consumedAt = now;
  challenges.set(hashChallenge(challenge), record);
  return { success: true, userId: record.userId };
}
