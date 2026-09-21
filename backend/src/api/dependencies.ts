/**
 * APP DEPENDENCIES
 * Status: IMPLEMENTATION.
 *
 * Bundles every in-memory store the API routes need. `createDependencies()`
 * gives a FRESH set each call — tests never share state between runs.
 * All stores here are the same foundation implementations built in
 * earlier modules (productionReady = false) — Module 13 wires them
 * together, it does not replace them with real DB clients (no network
 * access in this sandbox — see docs/API_LAYER.md).
 */

import { InMemoryUserStore } from './userStore.ts';
import type { UserStore } from './userStore.ts';
import { InMemorySessionStore } from '../auth/sessionManager.ts';
import type { SessionStore } from '../auth/sessionManager.ts';
import { InMemoryPortfolioStore } from '../portfolio/portfolioStore.ts';
import type { PortfolioStore } from '../portfolio/portfolioStore.ts';
import { FixedWindowRateLimiter } from '../security/rateLimiter.ts';

export interface AppDependencies {
  userStore: UserStore;
  sessionStore: SessionStore;
  portfolioStore: PortfolioStore;
  loginRateLimiter: FixedWindowRateLimiter;
}

const LOGIN_RATE_LIMIT_MAX = 5;
const LOGIN_RATE_LIMIT_WINDOW_MS = 1000 * 60; // 5 attempts per minute per email

export function createDependencies(): AppDependencies {
  return {
    userStore: new InMemoryUserStore(),
    sessionStore: new InMemorySessionStore(),
    portfolioStore: new InMemoryPortfolioStore(),
    loginRateLimiter: new FixedWindowRateLimiter(LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS),
  };
}
