/** Server-authoritative identity store. Password fields are intentionally absent. */
import type { Role } from '../security/rbac.ts';

export interface StoredUser {
  userId: string;
  email: string;
  oidcIssuer: string;
  oidcSubject: string;
  role: Exclude<Role, 'AI_AGENT'>;
  emailVerified: boolean;
}

export interface UserStore {
  create(user: StoredUser): void | Promise<void>;
  getByEmail(email: string): StoredUser | undefined | Promise<StoredUser | undefined>;
  getByOidcIdentity(issuer: string, subject: string): StoredUser | undefined | Promise<StoredUser | undefined>;
  getById(userId: string): StoredUser | undefined | Promise<StoredUser | undefined>;
  updateVerifiedEmail(userId: string, email: string): void | Promise<void>;
  setRole(userId: string, role: Exclude<Role, 'AI_AGENT'>): void | Promise<void>;
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function oidcIdentityKey(issuer: string, subject: string): string {
  return `${issuer}\u0000${subject}`;
}

export class InMemoryUserStore implements UserStore {
  public readonly productionReady = false;
  private readonly byEmail = new Map<string, StoredUser>();
  private readonly byId = new Map<string, StoredUser>();
  private readonly byOidcIdentity = new Map<string, StoredUser>();

  create(user: StoredUser): void {
    const email = normalizedEmail(user.email);
    const identityKey = oidcIdentityKey(user.oidcIssuer, user.oidcSubject);
    if (this.byEmail.has(email) || this.byId.has(user.userId) || this.byOidcIdentity.has(identityKey)) {
      throw new Error('identity already exists');
    }
    const copy: StoredUser = { ...structuredClone(user), email };
    this.byEmail.set(email, structuredClone(copy));
    this.byId.set(copy.userId, structuredClone(copy));
    this.byOidcIdentity.set(identityKey, structuredClone(copy));
  }

  getByEmail(email: string): StoredUser | undefined {
    const user = this.byEmail.get(normalizedEmail(email));
    return user ? structuredClone(user) : undefined;
  }

  getByOidcIdentity(issuer: string, subject: string): StoredUser | undefined {
    const user = this.byOidcIdentity.get(oidcIdentityKey(issuer, subject));
    return user ? structuredClone(user) : undefined;
  }

  getById(userId: string): StoredUser | undefined {
    const user = this.byId.get(userId);
    return user ? structuredClone(user) : undefined;
  }

  updateVerifiedEmail(userId: string, email: string): void {
    const user = this.byId.get(userId);
    if (!user) throw new Error('user not found');
    const nextEmail = normalizedEmail(email);
    const collision = this.byEmail.get(nextEmail);
    if (collision && collision.userId !== userId) throw new Error('identity already exists');

    this.byEmail.delete(normalizedEmail(user.email));
    const updated: StoredUser = { ...user, email: nextEmail, emailVerified: true };
    this.byId.set(userId, structuredClone(updated));
    this.byEmail.set(nextEmail, structuredClone(updated));
    this.byOidcIdentity.set(oidcIdentityKey(updated.oidcIssuer, updated.oidcSubject), structuredClone(updated));
  }

  setRole(userId: string, role: Exclude<Role, 'AI_AGENT'>): void {
    const user = this.byId.get(userId);
    if (!user) throw new Error('user not found');
    const updated: StoredUser = { ...user, role };
    this.byId.set(userId, structuredClone(updated));
    this.byEmail.set(normalizedEmail(user.email), structuredClone(updated));
    this.byOidcIdentity.set(oidcIdentityKey(user.oidcIssuer, user.oidcSubject), structuredClone(updated));
  }
}
