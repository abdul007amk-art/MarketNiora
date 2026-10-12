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
import { getPrismaClient, isNonProdDbTarget } from '../db/prisma.ts';
import { NonProdLocalSecretCipher } from '../db/nonProdSecretCipher.ts';
import { PrismaUserStore, PrismaSessionStore, PrismaOwnerTotpStore, PrismaOwnerMfaChallengeStore } from '../db/authStores.ts';
import { createConfiguredMarketDataProvider } from '../providers/marketDataProviderFactory.ts';
import type { MarketDataProvider } from '../providers/marketDataProvider.ts';

export interface AppDependencies {
  userStore: UserStore;
  sessionStore: SessionStore;
  portfolioStore: PortfolioStore;
  loginRateLimiter: FixedWindowRateLimiter;
  oidcVerifier: OidcVerifier;
  ownerTotpStore: OwnerTotpStore;
  ownerMfaChallengeStore: OwnerMfaChallengeStore;
  /** Optional for backward-compatible test fixtures; runtime always supplies the fail-closed provider. */
  marketDataProvider?: MarketDataProvider;
}

export function createDependencies(): AppDependencies {
  if (isNonProdDbTarget()) {
    const prisma = getPrismaClient();
    const cipher = new NonProdLocalSecretCipher();

    return {
      userStore: new PrismaUserStore(prisma),
      sessionStore: new PrismaSessionStore(prisma),
      portfolioStore: new InMemoryPortfolioStore(),
      loginRateLimiter: new FixedWindowRateLimiter(5, 60000),
      oidcVerifier: new GoogleOidcVerifier(),
      ownerTotpStore: new PrismaOwnerTotpStore(prisma, cipher),
      ownerMfaChallengeStore: new PrismaOwnerMfaChallengeStore(prisma),
      marketDataProvider: createConfiguredMarketDataProvider(),
    };
  }

  return {
    userStore: new InMemoryUserStore(),
    sessionStore: new InMemorySessionStore(),
    portfolioStore: new InMemoryPortfolioStore(),
    loginRateLimiter: new FixedWindowRateLimiter(5, 60000),
    oidcVerifier: new GoogleOidcVerifier(),
    ownerTotpStore: new InMemoryOwnerTotpStore(),
    ownerMfaChallengeStore: new InMemoryOwnerMfaChallengeStore(),
    marketDataProvider: createConfiguredMarketDataProvider(),
  };
}
