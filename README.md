# MarketNiora

> Source-aware market research and market intelligence platform.

## Authoritative documentation

The repository's current documentation references are limited to:

- `docs/MARKETNIORA_MASTER_PRODUCT_BLUEPRINT_v1.1.md`
- `docs/odr/ODR-2026-001.md`
- `docs/odr/ODR-2026-002.md`
- `docs/validation/*`
- `docs/archive/*`

## Authentication

**Google OIDC only per ODR-2026-001. Password auth deprecated. Owner requires mandatory TOTP MFA.**

Password-auth remnants are retained only as deprecated implementation files pending the required ODR for removal.

## Repository tree

```
.
├── docs/
│   ├── MARKETNIORA_MASTER_PRODUCT_BLUEPRINT_v1.1.md
│   ├── odr/
│   │   ├── ODR-2026-001.md
│   │   └── ODR-2026-002.md
│   ├── validation/
│   └── archive/
├── database/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── migrations/
│   ├── schema.sql
│   └── schema.legacy.sql
├── backend/
│   └── src/
│       ├── api/
│       │   └── routes/
│       ├── auth/
│       ├── contracts/
│       ├── pipeline/
│       ├── portfolio/
│       ├── protected/
│       ├── providers/
│       ├── research/
│       ├── security/
│       └── types/
├── tests/
├── package.json
├── tsconfig.json
├── .env.example
└── .gitignore
```

## Implementation status

| Area | SPECIFICATION | IMPLEMENTATION | RUNTIME |
|---|---|---|---|
| Product architecture | Defined in Blueprint | Repository structure present | UNKNOWN |
| Database | Prisma schema authoritative | SQL schema generated from Prisma | UNKNOWN — requires execution environment |
| Authentication | Google OIDC + Owner TOTP | Auth implementation present; password-auth remnants deprecated | UNKNOWN — requires execution environment |
| Security | Governance/security requirements defined | Security modules present | UNKNOWN — requires execution environment |
| Market rotation | ROTATION-1.2 locked | Locked engine present | UNKNOWN — requires execution environment |
| Stock score | SS-1.0-R3 locked | Locked engine present | UNKNOWN — requires execution environment |
| API | Defined by repository implementation | API modules present | UNKNOWN — requires execution environment |
| Frontend | Product specification exists | Not implemented in this repository state | UNKNOWN |
| Production integrations | Provider architecture defined | Provider interfaces/modules present | UNKNOWN |

## Quick Start

Install dependencies:

```bash
npm install
```

Run TypeScript checking:

```bash
npm run typecheck
```

Expected status before the execution environment and dependencies are fully set up: **UNKNOWN**.

Run the test suite:

```bash
npm test
```

**Test suite exists in tests/. Runtime execution status: UNKNOWN (requires Codespaces or local environment).**

No runtime test result is claimed by this repository update.

## Governance

Locked formula files must not be modified without the applicable Owner-approved governance process:

- `backend/src/protected/rotationEngine.ts`
- `backend/src/protected/stockScoreEngine.ts`

No production database writes are performed by repository maintenance operations.
