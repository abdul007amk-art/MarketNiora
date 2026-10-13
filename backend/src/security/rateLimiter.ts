/**
 * RATE LIMITER — fixed window, in-memory
 * Status: IMPLEMENTATION — unit tested below.
 * ⚠ NOT PRODUCTION READY as distributed rate limiting. This is a foundation/
 * single-instance implementation only.
 *
 * KNOWN LIMITATIONS (be honest about them): in-memory state does not share
 * across multiple serverless instances, and it is bounded to protect process
 * memory. A user could get maxRequests separately on EACH instance, not
 * maxRequests total. This is only a single-instance/non-production safeguard.
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

const DEFAULT_MAX_TRACKED_KEYS = 10_000;

class InMemoryStore implements RateLimitStore {
  private map = new Map<string, WindowState>();

  get(key: string) { return this.map.get(key); }
  set(key: string, state: WindowState) { this.map.set(key, state); }
  delete(key: string) { this.map.delete(key); }

  /**
   * Avoid unbounded key growth from clients with many different source IPs.
   * Expired windows are pruned only when capacity is needed, keeping the
   * common request path O(1). If all tracked keys remain active, new keys
   * fail closed until at least one window expires.
   */
  canTrackKey(key: string, maxKeys: number, now: number, windowMs: number): boolean {
    if (this.map.has(key) || this.map.size < maxKeys) return true;

    for (const [trackedKey, state] of this.map.entries()) {
      if (now - state.windowStart >= windowMs) this.map.delete(trackedKey);
    }

    return this.map.has(key) || this.map.size < maxKeys;
  }

  capacityRetryAfterSeconds(now: number, windowMs: number): number {
    let earliestExpiry = Number.POSITIVE_INFINITY;
    for (const state of this.map.values()) {
      earliestExpiry = Math.min(earliestExpiry, state.windowStart + windowMs);
    }
    if (!Number.isFinite(earliestExpiry)) return 0;
    return Math.max(0, Math.ceil((earliestExpiry - now) / 1000));
  }
}

export class FixedWindowRateLimiter {
  private store: InMemoryStore | RateLimitStore;
  private maxRequests: number;
  private windowMs: number;
  private maxTrackedKeys: number;
  public readonly productionReady = false; // explicit, not just a comment

  constructor(
    maxRequests: number,
    windowMs: number,
    store?: RateLimitStore,
    maxTrackedKeys: number = DEFAULT_MAX_TRACKED_KEYS,
  ) {
    if (!Number.isInteger(maxRequests) || maxRequests <= 0) throw new Error('maxRequests must be a positive integer');
    if (!Number.isFinite(windowMs) || windowMs <= 0) throw new Error('windowMs must be positive');
    if (!Number.isInteger(maxTrackedKeys) || maxTrackedKeys <= 0) throw new Error('maxTrackedKeys must be a positive integer');
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.maxTrackedKeys = maxTrackedKeys;
    this.store = store ?? new InMemoryStore();
  }

  /** Seconds until the current fixed window or a memory-capacity slot expires. */
  retryAfterSeconds(key: string, now: number = Date.now()): number {
    const state = this.store.get(key);
    if (!state) {
      if (this.store instanceof InMemoryStore && !this.store.canTrackKey(key, this.maxTrackedKeys, now, this.windowMs)) {
        return this.store.capacityRetryAfterSeconds(now, this.windowMs);
      }
      return 0;
    }
    const remainingMs = this.windowMs - (now - state.windowStart);
    return remainingMs <= 0 ? 0 : Math.ceil(remainingMs / 1000);
  }

  /** Returns true if the request is allowed, false if it should be rejected (429). */
  check(key: string, now: number = Date.now()): boolean {
    const state = this.store.get(key);

    if (this.store instanceof InMemoryStore && !state
      && !this.store.canTrackKey(key, this.maxTrackedKeys, now, this.windowMs)) {
      return false;
    }

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
    if (this.store instanceof InMemoryStore) this.store.delete(key);
  }
}
