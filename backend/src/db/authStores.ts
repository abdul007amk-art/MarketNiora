import { createHash } from 'crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { Role } from '../security/rbac.ts';
import type { StoredUser, UserStore } from '../api/userStore.ts';
import type { Session, SessionStore } from '../auth/sessionManager.ts';
import type { OwnerMfaChallengeRecord, OwnerMfaChallengeStore, OwnerTotpRecord, OwnerTotpStore } from '../auth/ownerMfa.ts';
import type { SecretCipher } from './nonProdSecretCipher.ts';

type PersistedRole = Exclude<Role, 'AI_AGENT'>;

function toRole(role: string): PersistedRole {
  if (role === 'USER' || role === 'ADMIN' || role === 'OWNER') return role;
  throw new Error('invalid persisted identity role');
}

function prismaBytes(value: Buffer): Uint8Array<ArrayBuffer> {
  return new Uint8Array(value) as unknown as Uint8Array<ArrayBuffer>;
}

function hashToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

function hashChallengeHex(hash: string): Buffer {
  if (!/^[0-9a-f]{64}$/i.test(hash)) throw new Error('invalid MFA challenge hash');
  return Buffer.from(hash, 'hex');
}

function toDate(milliseconds: number): Date {
  const date = new Date(milliseconds);
  if (Number.isNaN(date.getTime())) throw new Error('invalid timestamp');
  return date;
}

export class PrismaUserStore implements UserStore {
  public readonly productionReady = false;
  constructor(private readonly prisma: PrismaClient) {}

  async create(user: StoredUser): Promise<void> {
    try {
      await this.prisma.appUser.create({
        data: {
          userId: user.userId,
          oidcIssuer: user.oidcIssuer,
          oidcSubject: user.oidcSubject,
          email: user.email.toLowerCase(),
          emailVerified: user.emailVerified,
          role: user.role,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new Error('identity already exists');
      }
      throw error;
    }
  }

  async getByEmail(email: string): Promise<StoredUser | undefined> {
    const user = await this.prisma.appUser.findUnique({
      where: { email: email.toLowerCase() },
    });
    return user ? {
      userId: user.userId,
      email: user.email,
      oidcIssuer: user.oidcIssuer,
      oidcSubject: user.oidcSubject,
      role: toRole(user.role),
      emailVerified: user.emailVerified,
    } : undefined;
  }

  async getById(userId: string): Promise<StoredUser | undefined> {
    try {
      const user = await this.prisma.appUser.findUnique({ where: { userId } });
      return user ? {
        userId: user.userId,
        email: user.email,
        oidcIssuer: user.oidcIssuer,
        oidcSubject: user.oidcSubject,
        role: toRole(user.role),
        emailVerified: user.emailVerified,
      } : undefined;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2023') return undefined;
      throw error;
    }
  }

  async setRole(userId: string, role: PersistedRole): Promise<void> {
    try {
      await this.prisma.appUser.update({
        where: { userId },
        data: { role },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2023' || error.code === 'P2025')) {
        throw new Error('user not found');
      }
      throw error;
    }
  }
}

export class PrismaSessionStore implements SessionStore {
  public readonly productionReady = false;
  constructor(private readonly prisma: PrismaClient) {}

  async get(token: string): Promise<Session | undefined> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: prismaBytes(hashToken(token)) },
      select: { userId: true, createdAt: true, expiresAt: true, revokedAt: true, user: { select: { role: true } } },
    });

    if (!session || session.revokedAt) return undefined;

    return {
      token,
      userId: session.userId,
      role: toRole(session.user.role),
      issuedAt: session.createdAt.getTime(),
      expiresAt: session.expiresAt.getTime(),
    };
  }

  async set(token: string, session: Session): Promise<void> {
    await this.prisma.session.upsert({
      where: { tokenHash: prismaBytes(hashToken(token)) },
      create: {
        userId: session.userId,
        tokenHash: prismaBytes(hashToken(token)),
        createdAt: toDate(session.issuedAt),
        expiresAt: toDate(session.expiresAt),
        revokedAt: null,
      },
      update: {
        userId: session.userId,
        createdAt: toDate(session.issuedAt),
        expiresAt: toDate(session.expiresAt),
        revokedAt: null,
        lastSeenAt: null,
      },
    });
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash: prismaBytes(hashToken(token)), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export class PrismaOwnerTotpStore implements OwnerTotpStore {
  public readonly productionReady = false;
  constructor(private readonly prisma: PrismaClient, private readonly cipher: SecretCipher) {}

  async get(userId: string): Promise<OwnerTotpRecord | undefined> {
    const record = await this.prisma.ownerTotpSecret.findUnique({ where: { userId } });
    if (!record || record.disabledAt) return undefined;

    return {
      secret: this.cipher.decrypt(record.secretCiphertext),
      confirmedAt: record.confirmedAt?.getTime() ?? null,
    };
  }

  async set(userId: string, record: OwnerTotpRecord): Promise<void> {
    const existing = await this.prisma.ownerTotpSecret.findUnique({ where: { userId } });
    const encrypted = this.cipher.encrypt(record.secret);

    await this.prisma.ownerTotpSecret.upsert({
      where: { userId },
      create: {
        userId,
        secretCiphertext: prismaBytes(encrypted),
        kmsKeyRef: this.cipher.keyRef,
        keyVersion: this.cipher.keyVersion,
        confirmedAt: record.confirmedAt === null ? null : toDate(record.confirmedAt),
        rotatedAt: existing ? new Date() : null,
      },
      update: {
        secretCiphertext: prismaBytes(encrypted),
        kmsKeyRef: this.cipher.keyRef,
        keyVersion: this.cipher.keyVersion,
        confirmedAt: record.confirmedAt === null ? null : toDate(record.confirmedAt),
        rotatedAt: existing ? new Date() : null,
        disabledAt: null,
      },
    });
  }
}

export class PrismaOwnerMfaChallengeStore implements OwnerMfaChallengeStore {
  public readonly productionReady = false;
  constructor(private readonly prisma: PrismaClient) {}

  async get(hash: string): Promise<OwnerMfaChallengeRecord | undefined> {
    const record = await this.prisma.ownerMfaChallenge.findUnique({
      where: { challengeHash: prismaBytes(hashChallengeHex(hash)) },
    });
    if (!record) return undefined;

    return {
      userId: record.userId,
      expiresAt: record.expiresAt.getTime(),
      attempts: record.attempts,
      consumedAt: record.consumedAt?.getTime() ?? null,
    };
  }

  async set(hash: string, record: OwnerMfaChallengeRecord): Promise<void> {
    const challengeHash = hashChallengeHex(hash);
    await this.prisma.ownerMfaChallenge.upsert({
      where: { challengeHash: prismaBytes(challengeHash) },
      create: {
        userId: record.userId,
        challengeHash: prismaBytes(challengeHash),
        attempts: record.attempts,
        expiresAt: toDate(record.expiresAt),
        consumedAt: record.consumedAt === null ? null : toDate(record.consumedAt),
      },
      update: {
        userId: record.userId,
        attempts: record.attempts,
        expiresAt: toDate(record.expiresAt),
        consumedAt: record.consumedAt === null ? null : toDate(record.consumedAt),
      },
    });
  }
}
