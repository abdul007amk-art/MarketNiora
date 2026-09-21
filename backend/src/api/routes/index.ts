import type { Route } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { healthHandler } from './health.ts';
import { oidcLoginHandler, ownerMfaHandler, logoutHandler } from './auth.ts';
import { rotationCalculateHandler } from './rotation.ts';
import { stockScoreCalculateHandler } from './stockScore.ts';
import { themeResolveHandler } from './theme.ts';
import { fundamentalValidateHandler } from './fundamental.ts';
import { valueChainValidateHandler } from './valueChain.ts';
import { getPortfolioHandler } from './portfolio.ts';
import { researchReviewHandler } from './research.ts';
export function buildRoutes(): Route<AppDependencies>[] { return [
  { method: 'GET', pattern: '/health', handler: healthHandler },
  { method: 'POST', pattern: '/auth/oidc/google', handler: oidcLoginHandler },
  { method: 'POST', pattern: '/auth/owner/mfa', handler: ownerMfaHandler },
  { method: 'POST', pattern: '/auth/logout', handler: logoutHandler },
  { method: 'POST', pattern: '/rotation/calculate', handler: rotationCalculateHandler },
  { method: 'POST', pattern: '/stock-score/calculate', handler: stockScoreCalculateHandler },
  { method: 'POST', pattern: '/theme/resolve', handler: themeResolveHandler },
  { method: 'POST', pattern: '/fundamental/validate', handler: fundamentalValidateHandler },
  { method: 'POST', pattern: '/value-chain/validate', handler: valueChainValidateHandler },
  { method: 'GET', pattern: '/portfolio/:userId', handler: getPortfolioHandler },
  { method: 'POST', pattern: '/research/review', handler: researchReviewHandler },
]; }