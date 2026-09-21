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
  getById(userId: string): StoredUser | undefined | Promise<StoredUser | undefined>;
  setRole(userId: string, role: Exclude<Role, 'AI_AGENT'>): void | Promise<void>;
}

export class InMemoryUserStore implements UserStore {
  public readonly productionReady = false;
  private readonly byEmail = new Map<string, StoredUser>();
  private readonly byId = new Map<string, StoredUser>();

  create(user: StoredUser): void {
    if (this.byEmail.has(user.email.toLowerCase()) || this.byId.has(user.userId)) {
      throw new Error('identity already exists');
    }
    const copy = structuredClone(user);
    this.byEmail.set(copy.email.toLowerCase(), copy);
    this.byId.set(copy.userId, structuredClone(copy));
  }

  getByEmail(email: string): StoredUser | undefined {
    const user = this.byEmail.get(email.toLowerCase());
    return user ? structuredClone(user) : undefined;
  }

  getById(userId: string): StoredUser | undefined {
    const user = this.byId.get(userId);
    return user ? structuredClone(user) : undefined;
  }

  setRole(userId: string, role: Exclude<Role, 'AI_AGENT'>): void {
    const user = this.byId.get(userId);
    if (!user) throw new Error('user not found');
    const updated: StoredUser = { ...user, role };
    this.byId.set(userId, structuredClone(updated));
    this.byEmail.set(user.email.toLowerCase(), structuredClone(updated));
  }
}
