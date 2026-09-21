/**
 * USER STORE
 * Status: IMPLEMENTATION — unit tested below. In-memory foundation
 * (productionReady = false), same convention as every other *Store.
 *
 * This didn't exist before Module 13 — Modules 4/5 built pure
 * signup/login/session functions, but nothing yet stored users
 * persistently enough to wire a real signup -> login HTTP flow. This is
 * that missing piece, kept minimal and local to the API layer.
 */

export interface StoredUser {
  userId: string;
  email: string;
  passwordHash: string;
  role: 'OWNER' | 'ADMIN' | 'USER';
  emailVerified: boolean;
}

export interface UserStore {
  create(user: StoredUser): void;
  getByEmail(email: string): StoredUser | undefined;
  getById(userId: string): StoredUser | undefined;
}

export class InMemoryUserStore implements UserStore {
  public readonly productionReady = false;
  private byEmail: Map<string, StoredUser>;
  private byId: Map<string, StoredUser>;

  constructor() {
    this.byEmail = new Map();
    this.byId = new Map();
  }

  create(user: StoredUser): void {
    if (this.byEmail.has(user.email)) {
      throw new Error('a user with this email is already registered');
    }
    this.byEmail.set(user.email, structuredClone(user));
    this.byId.set(user.userId, structuredClone(user));
  }

  getByEmail(email: string): StoredUser | undefined {
    const user = this.byEmail.get(email);
    return user ? structuredClone(user) : undefined;
  }

  getById(userId: string): StoredUser | undefined {
    const user = this.byId.get(userId);
    return user ? structuredClone(user) : undefined;
  }
}
