# MARKETNIORA — Priority 1 + Priority 2 Controlled Clone Validation Report

**Scope:** non-production clone only

**Clone project:** `qvlhkeacbngvpldolxvd` (`MarketNiora-NP-Clone-20260920`)

**Production project explicitly excluded from writes:** `lrbgicuzlhgnfplnmvre`

**Date:** 2026-09-20

## Gate summary

| Step | Status | Evidence / blocker |
|---|---|---|
| 1. Prisma CLI installation | **BLOCKED** | Container DNS could not resolve npm registries; no Prisma binary exists in environment |
| 1. `prisma db pull --url=...` | **BLOCKED** | Usable PostgreSQL URL cannot be formed because the clone DB password/connection secret is not exposed by the available Supabase project tool |
| 1. `prisma validate` | **UNKNOWN** | Prisma CLI was not available; command was not executed |
| 1. Target table coverage | **PASS** | 32/32 target Prisma models have corresponding clone base tables |
| 1. `app_audit_log.actor_type` parity | **PASS** at design level | Clone column is `text`; validation working copy uses `actorType String`, not a Prisma enum; no DB migration required |
| 2. Existing 319-test baseline | **PASS** | `npm test`: 319 passed, 0 failed, exit 0 |
| 2. Prisma-backed DB integration | **BLOCKED** | Prisma CLI/client unavailable and no usable DB connection URL/password was available |
| 2. In-memory stores replacement | **BLOCKED** | Repository currently contains in-memory stores; DB-backed adapters require Prisma installation and DB connection |
| 3. ACL prerequisite design | **PASS** | Forward-only 007a design created; clone-only dry-run and current ACL state verified |
| 4. Backup/restore rehearsal design | **PASS** | Forward-only restore strategy documented |
| 4. Actual backup/restore rehearsal | **UNKNOWN** | Requires usable DB connection credentials + backup tooling; not executed |
| Production writes | **PASS — NONE** | Final production migration history remains 001-007; no 008+ production migration was applied |

**Overall gate:** `BLOCKED` at Priority 1 Prisma runtime validation; Priority 2 DB-connected execution cannot proceed until the connection/tooling prerequisite is available. No production action was taken.

---

# STEP 1 — Prisma Validation Against Clone

## 1.1 Prisma version selection

Prisma ORM 7.10.0 is the appropriate CLI target for the current repository contract. Current Prisma documentation states Prisma ORM 8 is the current release candidate, while Prisma ORM 7 remains the supported line for projects using `schema.prisma`; Prisma 7.2 restored `--url` support for `prisma db` commands. The Prisma 7 CLI docs specify `prisma@7.10.0`. citeturn946329search5turn946329search10turn882728search9

## 1.2 Actual installation commands and outputs

### Command

```bash
prisma --version
```

### Raw output

```text
bash: line 4: prisma: command not found
EXIT:127
```

### Command

```bash
npx prisma@7.10.0 --version
```

### Raw output

```text
EXIT:124
```

### Registry DNS checks

```text
===registry.npmjs.org===
DNS_LOOKUP_FAILED
===registry.npmmirror.com===
DNS_LOOKUP_FAILED
===registry.yarnpkg.com===
DNS_LOOKUP_FAILED
===repo.huaweicloud.com===
DNS_LOOKUP_FAILED
```

A direct `npm install --no-save --ignore-scripts prisma@7.10.0 --registry=https://registry.npmjs.org` also terminated on timeout (`EXIT:124`).

**Status:** `BLOCKED`.

## 1.3 Clone connection details actually available

Clone project:

```text
ref: qvlhkeacbngvpldolxvd
host: db.qvlhkeacbngvpldolxvd.supabase.co
PostgreSQL: 17.6.1.166
engine: 17
region: ap-south-1
API URL: https://qvlhkeacbngvpldolxvd.supabase.co
```

A usable PostgreSQL URL requires the database password. Supabase documentation shows the PostgreSQL connection strings contain `[YOUR-PASSWORD]` and that the password must come from Database Settings; this password is not exposed by the available Supabase project-management tool. citeturn971176search3

Therefore the exact requested command:

```bash
prisma db pull --url=<clone_url>
```

could not be executed without inventing or guessing a credential. No credential was invented.

**Status:** `BLOCKED`.

## 1.4 Static target table coverage against the clone

The reconciled target contains 32 Prisma models. The clone currently contains the corresponding 32 base tables across `public`, `governance_layer`, `production_layer`, and `staging_enrichment`.

**Actual clone base-table query output:**

```text
[{"table_schema":"governance_layer","table_name":"audit_log"},
{"table_schema":"governance_layer","table_name":"classification_review"},
{"table_schema":"governance_layer","table_name":"identity_conflict"},
{"table_schema":"governance_layer","table_name":"identity_resolution_requests"},
{"table_schema":"governance_layer","table_name":"master_import_batch"},
{"table_schema":"governance_layer","table_name":"provider_registry"},
{"table_schema":"governance_layer","table_name":"source_evidence"},
{"table_schema":"governance_layer","table_name":"source_health"},
{"table_schema":"production_layer","table_name":"canonical_stock"},
{"table_schema":"production_layer","table_name":"industry"},
{"table_schema":"production_layer","table_name":"raw_stock_observation"},
{"table_schema":"production_layer","table_name":"rotation_score"},
{"table_schema":"production_layer","table_name":"sector"},
{"table_schema":"production_layer","table_name":"shariah_status"},
{"table_schema":"production_layer","table_name":"stock_classification"},
{"table_schema":"production_layer","table_name":"stock_group"},
{"table_schema":"production_layer","table_name":"stock_group_membership"},
{"table_schema":"production_layer","table_name":"stock_score"},
{"table_schema":"production_layer","table_name":"stock_theme_membership"},
{"table_schema":"production_layer","table_name":"sub_sector"},
{"table_schema":"production_layer","table_name":"sub_theme"},
{"table_schema":"production_layer","table_name":"theme"},
{"table_schema":"production_layer","table_name":"value_chain_evidence"},
{"table_schema":"production_layer","table_name":"value_chain_stage"},
{"table_schema":"public","table_name":"app_audit_log"},
{"table_schema":"public","table_name":"app_user"},
{"table_schema":"public","table_name":"entitlement"},
{"table_schema":"public","table_name":"feature_policy"},
{"table_schema":"public","table_name":"formula_version"},
{"table_schema":"public","table_name":"owner_mfa_challenge"},
{"table_schema":"public","table_name":"owner_totp_secret"},
{"table_schema":"public","table_name":"session"},
{"table_schema":"staging_enrichment","table_name":"master_4187_staging"}]
```

**Status:** `PASS` for table coverage, but this is **not** equivalent to a successful Prisma CLI validation.

## 1.5 Critical `app_audit_log.actor_type` parity resolution

Live clone:

```text
public.app_audit_log.actor_type
PostgreSQL type: text
nullable: NO
```

The reconciled design document used a Prisma enum `AuditActorType`, while migration 010 intentionally creates `actor_type text`. That was a parity mismatch.

### Resolution

The validation working copy changes:

```prisma
actorType String @map("actor_type")
```

and removes the unused `AuditActorType` enum from the working copy.

**No database type change was applied.** This preserves live migration 010 and avoids an unnecessary forward migration.

**Status:** `PASS` at contract-reconciliation level.

Validation working copy:

`/mnt/data/MARKETNIORA_PRISMA_VALIDATION_WORK/schema.prisma`

## 1.6 Per-model Prisma status

Because `prisma validate` and `prisma db pull` could not run, every model's **actual Prisma CLI status remains UNKNOWN**. The table existence check is PASS for all 32 mappings.

| Prisma model | Clone table exists | Prisma CLI validation |
|---|---|---|
| AppUser | PASS | UNKNOWN |
| Session | PASS | UNKNOWN |
| Entitlement | PASS | UNKNOWN |
| FeaturePolicy | PASS | UNKNOWN |
| FormulaVersion | PASS | UNKNOWN |
| OwnerTotpSecret | PASS | UNKNOWN |
| OwnerMfaChallenge | PASS | UNKNOWN |
| AppAuditLog | PASS | UNKNOWN |
| GovernanceAuditLog | PASS | UNKNOWN |
| MasterImportBatch | PASS | UNKNOWN |
| IdentityConflict | PASS | UNKNOWN |
| IdentityResolutionRequest | PASS | UNKNOWN |
| ProviderRegistry | PASS | UNKNOWN |
| SourceHealth | PASS | UNKNOWN |
| SourceEvidence | PASS | UNKNOWN |
| ClassificationReview | PASS | UNKNOWN |
| CanonicalStock | PASS | UNKNOWN |
| RawStockObservation | PASS | UNKNOWN |
| Sector | PASS | UNKNOWN |
| SubSector | PASS | UNKNOWN |
| StockClassification | PASS | UNKNOWN |
| StockGroup | PASS | UNKNOWN |
| StockGroupMembership | PASS | UNKNOWN |
| Theme | PASS | UNKNOWN |
| SubTheme | PASS | UNKNOWN |
| Industry | PASS | UNKNOWN |
| StockThemeMembership | PASS | UNKNOWN |
| ValueChainStage | PASS | UNKNOWN |
| ValueChainEvidence | PASS | UNKNOWN |
| RotationScore | PASS | UNKNOWN |
| StockScore | PASS | UNKNOWN |
| ShariahStatus | PASS | UNKNOWN |
| Master4187Staging | PASS | UNKNOWN |

---

# STEP 2 — DB-Connected Integration Tests

## 2.1 Baseline suite actual output

The repository baseline was run against the extracted working tree:

```bash
npm test
```

Final TAP summary:

```text
1..319
# tests 319
# suites 0
# pass 319
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3377.413315
EXIT:0
```

**Status:** `PASS` for the existing in-memory/unit suite.

## 2.2 Evidence that the current suite is in-memory

The current repository contains explicit in-memory stores, including:

```text
backend/src/api/userStore.ts
backend/src/api/dependencies.ts
backend/src/pipeline/rawObservationStore.ts
backend/src/pipeline/canonicalObservationStore.ts
backend/src/pipeline/jobLogStore.ts
backend/src/auth/sessionManager.ts
backend/src/auth/ownerAuthorization.ts
backend/src/auth/mfaRecovery.ts
backend/src/portfolio/portfolioStore.ts
```

Examples from the tests include:

```text
const store = new InMemorySessionStore();
const store = new InMemoryRawObservationStore();
const store = new InMemoryCanonicalObservationStore();
const store = new InMemoryJobLogStore();
const store = new InMemoryOAuthTokenStore();
```

The API dependency bundle also explicitly describes itself as using in-memory stores.

**Status:** `PASS` — current test architecture is confirmed as in-memory.

## 2.3 Prisma-backed replacement

Not executed because the Prisma CLI/client could not be installed and the clone PostgreSQL connection credentials are unavailable to the execution environment.

No fake DB-connected test result was reported.

**Status:** `BLOCKED`.

### Required next execution boundary

1. Provide a usable clone PostgreSQL connection string/password to the runtime environment.
2. Install and lock Prisma ORM 7 (`prisma@7.10.0`, with a compatible `@prisma/client`).
3. Run `prisma db pull --url=...`.
4. Run `prisma validate` on the corrected working schema.
5. Generate Prisma Client.
6. Implement database-backed repositories behind the current store interfaces.
7. Run the complete 319-test suite plus DB-specific tests.
8. Classify every failure as DB behavior, repository mapping, or existing business-logic behavior.

---

# STEP 3 — ACL Prerequisite Migration Design

## 3.1 Why 007a is preferred

Migration 007 creates/owns `resolve_identity_conflict()` under `service_role`. On a freshly created Supabase project, the first 007 execution failed because `service_role` lacked required `governance_layer` schema privileges.

Therefore a forward-only **007a prerequisite** is cleaner than delaying the prerequisite to 008.

## 3.2 Initial failure evidence

Actual first 007 execution on the clone:

```text
ERROR: 42501: permission denied for schema governance_layer
```

Clone-only correction used during the successful retry:

```sql
GRANT USAGE, CREATE ON SCHEMA governance_layer TO service_role;
GRANT SELECT, UPDATE ON TABLE governance_layer.identity_conflict TO service_role;
GRANT SELECT, UPDATE ON TABLE governance_layer.identity_resolution_requests TO service_role;
```

Migration 007 subsequently returned:

```text
{"success":true}
```

## 3.3 Current clone ACL state

Actual current schema ACL output:

```text
{"nspname":"governance_layer","owner":"postgres","service_role_usage":true,"service_role_create":true,"nspacl":"{postgres=UC/postgres,service_role=UC/postgres}"}
```

Current service-role table grants:

```text
identity_conflict: SELECT,UPDATE
identity_resolution_requests: SELECT,UPDATE
v_resolution_status: SELECT
```

## 3.4 Idempotency rule

PostgreSQL `GRANT` itself is idempotent. The proposed 007a design additionally checks `has_schema_privilege()` / `has_table_privilege()` before issuing each grant, providing an explicit no-op path on already-correct clones.

The exact SQL is in:

`MARKETNIORA_007A_SERVICE_ROLE_ACL_DESIGN.sql`

**Status:** `PASS` for design.

**Not applied as a new migration in this run.** The current clone already contains the required ACLs from the clone-only prerequisite correction used to complete 007.

---

# STEP 4 — Backup / Restore Rehearsal Plan

## 4.1 Design status

**Status:** `PASS` for the plan.

The current organization is Free. Supabase's current documentation says Free-tier projects should regularly export using the Supabase CLI `db dump`, while daily platform backups are available on Pro/Team/Enterprise. Supabase's documented logical backup flow uses a database connection string with the project password. citeturn971176search0turn971176search3

## 4.2 Actual restore verification

Not executed because the same missing DB connection credential/tooling boundary blocks a real `pg_dump` / `psql` rehearsal.

**Status:** `UNKNOWN`.

## 4.3 008-013 rollback strategy

The approved design remains forward-only:

- no destructive `down` migrations;
- on a failed migration, preserve evidence;
- restore the last known-good clone backup to a replacement clone;
- reapply only corrected forward migrations;
- re-run provenance, RLS, QC and regression gates.

For a migration-specific reversal, restore/rebuild from the immediately preceding good baseline instead of editing migration history.

This matches the reconciled design's forward-only policy.

**Status:** `PASS` for design.

Full rehearsal plan:

`MARKETNIORA_BACKUP_RESTORE_REHEARSAL_PLAN.md`

---

# Production safety verification

A final read-only production check was performed after this run.

Production migration history still contains only:

```text
001_marketniora_canonical_foundation
002_marketniora_rls_fail_closed
003_marketniora_governance_import_gate
004_governance_evidence_provider_registry
005_owner_resolution_requests
006_quality_provenance_checks
007_owner_resolution_transaction
```

Production application-layer row counts remain:

```text
canonical_stock           0
raw_stock_observation     0
master_4187_staging       0
```

**Status:** `PASS — no production migration was applied.`

---

# Final gate

## PASS

- Clone table coverage: 32/32.
- `app_audit_log.actor_type` parity reconciled to the live `text` column in the validation working schema.
- Existing unit suite: 319/319.
- ACL prerequisite design: complete and idempotent.
- Backup/restore strategy: designed.
- Production remains at 001-007.

## BLOCKED

- Prisma CLI installation.
- Actual `prisma db pull`.
- Actual `prisma validate`.
- Prisma Client generation.
- DB-backed repository wiring.
- DB-connected 319-test integration execution.

## UNKNOWN

- Full Prisma model validation/runtime parity.
- Restored-clone rehearsal.
- Database behavior vs in-memory behavior across all 319 tests.

## OWNER_DECISION_REQUIRED

No new formula or product-rule decision was introduced.

The next approval gate is operational/tooling only: provide a secure non-production PostgreSQL connection credential to the execution environment and permit Prisma 7.10.0 installation/locking for the clone validation run.
