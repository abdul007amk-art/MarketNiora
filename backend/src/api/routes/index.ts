import type { Route } from '../router.ts';
import type { AppDependencies } from '../dependencies.ts';
import { healthHandler } from './health.ts';
import { oidcLoginHandler, ownerMfaHandler, ownerTotpProvisionHandler, ownerTotpConfirmHandler, logoutHandler } from './auth.ts';
import { rotationCalculateHandler } from './rotation.ts';
import { stockScoreCalculateHandler } from './stockScore.ts';
import { themeResolveHandler } from './theme.ts';
import { fundamentalValidateHandler } from './fundamental.ts';
import { valueChainValidateHandler } from './valueChain.ts';
import { getPortfolioHandler } from './portfolio.ts';
import { researchReviewHandler } from './research.ts';
import { marketDataProviderHealthHandler, marketDataQuoteHandler } from './marketData.ts';
import { workspaceSummaryHandler, workspaceStocksHandler, workspaceRotationHandler, workspaceThemesHandler } from './workspace.ts';
export function buildRoutes(): Route<AppDependencies>[] { return [
  { method: 'GET', pattern: '/health', handler: healthHandler },
  { method: 'GET', pattern: '/market-data/provider-health', handler: marketDataProviderHealthHandler },
  { method: 'GET', pattern: '/market-data/quote/:symbol', handler: marketDataQuoteHandler },
  { method: 'GET', pattern: '/workspace/summary', handler: workspaceSummaryHandler },
  { method: 'GET', pattern: '/workspace/stocks', handler: workspaceStocksHandler },
  { method: 'GET', pattern: '/workspace/rotation', handler: workspaceRotationHandler },
  { method: 'GET', pattern: '/workspace/themes', handler: workspaceThemesHandler },
  { method: 'POST', pattern: '/auth/oidc/google', handler: oidcLoginHandler },
  { method: 'POST', pattern: '/auth/owner/mfa', handler: ownerMfaHandler },
  { method: 'POST', pattern: '/auth/owner/totp/provision', handler: ownerTotpProvisionHandler },
  { method: 'POST', pattern: '/auth/owner/totp/confirm', handler: ownerTotpConfirmHandler },
  { method: 'POST', pattern: '/auth/logout', handler: logoutHandler },
  { method: 'POST', pattern: '/rotation/calculate', handler: rotationCalculateHandler },
  { method: 'POST', pattern: '/stock-score/calculate', handler: stockScoreCalculateHandler },
  { method: 'POST', pattern: '/theme/resolve', handler: themeResolveHandler },
  { method: 'POST', pattern: '/fundamental/validate', handler: fundamentalValidateHandler },
  { method: 'POST', pattern: '/value-chain/validate', handler: valueChainValidateHandler },
  { method: 'GET', pattern: '/portfolio/:userId', handler: getPortfolioHandler },
  { method: 'POST', pattern: '/research/review', handler: researchReviewHandler },
]; }