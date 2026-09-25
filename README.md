# MarketNiora

> Source-aware market research and market intelligence platform.

## Current Web Implementation

The repository now includes an additive web application surface built on top of the existing backend contracts and protected calculation engines.

- Frontend: `frontend/index.html`, `frontend/styles.css`, `frontend/app.js`
- Web entrypoint: `backend/src/main.ts`
- Architecture status endpoint: `GET /architecture/status`
- Existing API routes remain the backend source of truth for rotation, Stock Score, theme, fundamental, value-chain, auth, portfolio and research boundaries.

The new frontend does not redefine formulas, create alternative score logic, or promote pending methodologies to LOCKED. Pending chunks continue to be shown as NOT LOCKED.

## Authoritative documentation

The repository's documentation references remain under:

- `docs/MARKETNIORA_MASTER_PRODUCT_BLUEPRINT_v1.1.md`
- `docs/odr/`
- `docs/validation/`
- `docs/archive/`

## Authentication

**Google OIDC only per ODR-2026-001. Owner requires mandatory TOTP MFA.**

## Implementation status

| Area | SPECIFICATION | IMPLEMENTATION | RUNTIME |
|---|---|---|---|
| Product architecture | Defined | Repository structure present | Not fully verified here |
| Database | Prisma schema authoritative | Present | Requires configured execution environment |
| Authentication | Google OIDC + Owner TOTP | Present | Requires configured execution environment |
| Security | Governance/security requirements defined | Present | Requires configured execution environment |
| Market rotation | Protected engine | Present | Test/runtime verification separate |
| Stock score | Protected engine | Present | Test/runtime verification separate |
| API | Route layer defined | Present | Test/runtime verification separate |
| Frontend | Product specification exists | Implemented as static web surface | Requires execution environment |
| Production integrations | Provider architecture defined | Provider interfaces/modules present | Requires execution environment |

## Quick Start

Install dependencies:

```bash
npm install
```

Run type checking:

```bash
npm run typecheck
```

Run tests:

```bash
npm test
```

Run the web application:

```bash
npm start
```

The web server uses the built-in Node HTTP server and serves the frontend plus the existing API routes from one process. Default port: `3000`.

## Governance

Locked formula files must not be modified without the applicable Owner-approved governance process:

- `backend/src/protected/rotationEngine.ts`
- `backend/src/protected/stockScoreEngine.ts`

This implementation branch does not modify those protected calculation files.
No production database writes are performed by repository maintenance operations.
