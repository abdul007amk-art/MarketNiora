import { InMemoryUserStore } from './userStore.ts';
import type { UserStore } from './userStore.ts';
import { InMemorySessionStore } from '../auth/sessionManager.ts';
import type { SessionStore } from '../auth/sessionManager.ts';
import { InMemoryPortfolioStore } from '../portfolio/portfolioStore.ts';
import type { PortfolioStore } from '../portfolio/portfolioStore.ts';
import { FixedWindowRateLimiter } from '../security/rateLimiter.ts';
import { GoogleOidcVerifier } from '../auth/oidcVerifier.ts';
import type { OidcVerifier } from '../auth/oidcVerifier.ts';
import { InMemoryOwnerTotpStore, InMemoryOwnerMfaChallengeStore } from '../auth/ownerMfa.ts';
import type { OwnerTotpStore, OwnerMfaChallengeStore } from '../auth/ownerMfa.ts';
export interface AppDependencies { userStore: UserStore; sessionStore: SessionStore; portfolioStore: PortfolioStore; loginRateLimiter: FixedWindowRateLimiter; oidcVerifier: OidcVerifier; ownerTotpStore: OwnerTotpStore; ownerMfaChallengeStore: OwnerMfaChallengeStore; }
export function createDependencies(): AppDependencies { return { userStore:new InMemoryUserStore(),sessionStore:new InMemorySessionStore(),portfolioStore:new InMemoryPortfolioStore(),loginRateLimiter:new FixedWindowRateLimiter(5,60000),oidcVerifier:new GoogleOidcVerifier(),ownerTotpStore:new InMemoryOwnerTotpStore(),ownerMfaChallengeStore:new InMemoryOwnerMfaChallengeStore() }; }
