# MarketNiora DB Auth Runtime Integration — Pending

## Status

**PENDING — local execution required.**

The DB-backed auth repositories are implemented and normal CI validation is passing. Real CRUD against the approved non-production Supabase clone has not yet been executed because the required local database runtime/credentials are not available in the current environment.

## Protected completed work

- Google OIDC verifier
- Owner TOTP/MFA flow
- Prisma auth repositories
- non-production DB guard
- AES-256-GCM non-production TOTP cipher
- SHA-256 session/challenge hashing
- locked Rotation engine
- locked Stock Score engine
- Prisma/schema reconciliation
- existing CI validation workflow

## Local integration script

`scripts/integrationTest.ts` tests:

1. non-production DB guard
2. PostgreSQL connectivity
3. UserStore create/read/update
4. SessionStore create/read/update/revoke
5. SHA-256 session-token persistence
6. OwnerTotpStore create/read/update
7. AES-256-GCM TOTP encryption/decryption
8. OwnerMfaChallengeStore create/read/update
9. SHA-256 MFA challenge persistence
10. deterministic cleanup of all test rows

## Required environment

```text
MARKETNIORA_DB_TARGET=NON_PROD
NODE_ENV=development
KMS_PROVIDER=local-dev
DATABASE_URL=<approved non-prod Supabase DATABASE_URL>
KMS_LOCAL_MASTER_KEY=<non-production local-dev key>
```

Do not run this with the production Supabase DATABASE_URL.
Do not add or run a migration merely to execute this integration test.

## Run

```bash
npx tsx scripts/integrationTest.ts
```

## Completion condition

Mark this item complete only after the script actually executes against the non-production database and reports PASS with zero remaining test rows.