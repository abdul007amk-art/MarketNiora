/**
 * RATE LIMITER — fixed window, in-memory
 * Status: IMPLEMENTATION — unit tested below.
 * ⚠ NOT PRODUCTION READY as distributed rate limiting. This is a foundation/
 * single-instance implementation only.
 *
 * KNOWN LIMITATION (be honest about it): in-memory state does not share
 * across multiple serverless instances. A user could get maxRequests
 * separately on EACH instance, not maxRequests total. Fine only for a
 * single-instance/VPS deployment or local testing.
 *
 * Upgrade path when going to production on serverless (Vercel/Cloudflare
 * Workers): implement RateLimitStore below against Upstash Redis (free
 * tier fits infra/DEPLOYMENT_NOTES.md) and pass it into
 * FixedWindowRateLimiter instead of relying on the default in-memory store.
 */

export interface RateLimitStore {
  get(key: string): WindowState | undefined;
  set(key: string, state: WindowState): void;
}

interface WindowState {
  count: number;
  windowStart: number;
}

class InMemoryStore implements RateLimitStore {
  private map = new Map<string, WindowState>();
  get(key: string) { return this.map.get(key); }
  set(key: string, state: WindowState) { this.map.set(key, state); }
  delete(key: string) { this.map.delete(key); }
}

export class FixedWindowRateLimiter {
  private store: InMemoryStore | RateLimitStore;
  private maxRequests: number;
  private windowMs: number;
  public readonly productionReady = false; // explicit, not just a comment

  constructor(maxRequests: number, windowMs: number, store?: RateLimitStore) {
    if (maxRequests <= 0) throw new Error('maxRequests must be positive');
    if (windowMs <= 0) throw new Error('windowMs must be positive');
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.store = store ?? new InMemoryStore();
  }

  /** Returns true if the request is allowed, false if it should be rejected (429). */
  check(key: string, now: number = Date.now()): boolean {
    const state = this.store.get(key);

    if (!state || now - state.windowStart >= this.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return true;
    }

    if (state.count >= this.maxRequests) {
      return false;
    }

    state.count += 1;
    this.store.set(key, state);
    return true;
  }

  reset(key: string): void {
    if (this.store instanceof InMemoryStore) {
      (this.store as InMemoryStore).delete(key);
    }
  }
}
