# MarketNiora DB Auth Runtime Integration — Pending

## Status

**CI_TEST = PASS · actual approved Supabase NON_PROD runtime = PENDING.**

The existing `scripts/integrationTest.ts` now runs in GitHub Actions against an isolated ephemeral PostgreSQL 16 database. CI successfully verified auth-store CRUD, SHA-256 token/challenge hashes, AES-256-GCM TOTP encryption/decryption, session revocation and test-row cleanup.

This is meaningful database-backed integration evidence, but it does **not** mean the same script has run against the approved `MarketNiora-NP-Clone-20260920` Supabase project. That separate runtime check remains pending because the clone's approved `DATABASE_URL` and local-dev KMS key are not provisioned to the local execution environment.

During integration work, CI caught a Prisma/schema type-name mismatch: the generated client expected `public.IdentityRole`, while the existing SQL schema uses `public.identity_role`. The Prisma enum now explicitly maps to `identity_role`; no database migration was needed.

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