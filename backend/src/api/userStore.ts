/** Server-authoritative identity store. Password fields are intentionally absent. */
import type { Role } from '../security/rbac.ts';
export interface StoredUser { userId: string; email: string; oidcIssuer: string; oidcSubject: string; role: Exclude<Role, 'AI_AGENT'>; emailVerified: boolean; }
export interface UserStore { create(user: StoredUser): void; getByEmail(email: string): StoredUser | undefined; getById(userId: string): StoredUser | undefined; setRole(userId: string, role: Exclude<Role, 'AI_AGENT'>): void; }
export class InMemoryUserStore {
  public readonly productionReady = false; private byEmail = new Map<string, StoredUser>(); private byId = new Map<string, StoredUser>();
  create(user: StoredUser): void { if (this.byEmail.has(user.email.toLowerCase()) || this.byId.has(user.userId)) throw new Error('identity already exists'); const copy=structuredClone(user); this.byEmail.set(copy.email.toLowerCase(),copy); this.byId.set(copy.userId,structuredClone(copy)); }
  getByEmail(email:string){ const u=this.byEmail.get(email.toLowerCase()); return u?structuredClone(u):undefined; }
  getById(userId:string){ const u=this.byId.get(userId); return u?structuredClone(u):undefined; }
  setRole(userId:string, role:Exclude<Role,'AI_AGENT'>){ const u=this.byId.get(userId); if(!u) throw new Error('user not found'); const v={...u,role}; this.byId.set(userId,structuredClone(v)); this.byEmail.set(u.email.toLowerCase(),structuredClone(v)); }
}
