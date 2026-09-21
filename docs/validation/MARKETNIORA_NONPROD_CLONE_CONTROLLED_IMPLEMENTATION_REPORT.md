# MARKETNIORA — Controlled Non-Production Clone Implementation Report

Date: 2026-09-20
Production project: `lrbgicuzlhgnfplnmvre` (READ-ONLY throughout this run)
Non-production clone: `qvlhkeacbngvpldolxvd`
Clone name: `MarketNiora-NP-Clone-20260920`
Region: `ap-south-1`
PostgreSQL: `17.6.1.166` / engine 17
Clone host: `db.qvlhkeacbngvpldolxvd.supabase.co`
Connection method: Supabase management API / SQL & migration operations; no direct psql connection was used.
Clone cost: `$0/month` on the current Free organization.

## Executive status

| Area | Status | Evidence |
|---|---|---|
| Non-production clone availability before setup | PASS | `list_branches(production)` returned `{"branches":[]}`; no existing branch found. A separate Free-tier Supabase project was then created. |
| Clone isolation | PASS | Separate project ref `qvlhkeacbngvpldolxvd`; no production data copied. Final clone application/domain row counts are 0. |
| Production write protection | PASS | Production migration history remains exactly 001–007; production row counts checked after the run. No production migration/write tool was called. |
| Baseline 001–006 | PASS | Applied successfully to clone. |
| Baseline 007 | PASS* | First clone attempt failed because fresh project lacked the live production `service_role` ACL baseline. Clone-only ACL bootstrap was applied and 007 then succeeded. |
| Migration 008 C5 | PASS | Pre-count 0; C5 columns became NOT NULL; no backfill required. |
| Migration 009 C9 | PASS | Enum verified as USER, ADMIN, OWNER. |
| Migration 010 OIDC/auth control plane | PASS | 8 requested tables created; exact `password_hash` column absent; OIDC unique index verified. Platform `auth.users` still contains Supabase's built-in `encrypted_password` column; see surprise. |
| Migration 011 domain tables | PASS | 14 requested tables created; value-chain/rotation/score checks verified. |
| Migration 012 RLS/provenance | PASS | All 22 new tables have RLS and deny policies; all requested negative tests produced expected exceptions. |
| Migration 013 QC/functions | PASS | 11 requested governance views exist; function is SECURITY DEFINER, owned by service_role, EXECUTE limited to service_role; readiness query returns import_ready=false solely because staging row count is 0. |
| Clone full TypeScript test suite against DB clone | UNKNOWN | The repository tests are not wired to DATABASE_URL/Supabase; grep found no DB usage in tests/backend. |
| Repository unit test suite (not DB-connected) | PASS | 319 tests, 319 pass, 0 fail. Raw output attached. |
| Prisma CLI validation against clone | UNKNOWN | Not run in this controlled migration-only pass. |
| Production application safety | BLOCKED | Clone SQL layer passed, but Prisma/runtime integration and production deployment validation remain UNKNOWN. |

## 1. Step 1 — Clone setup

### 1.1 Pre-check

Production `list_branches` returned:

```text
{"branches":[]}
```

Therefore no non-production clone existed.

Project creation cost check:

```text
{"type":"project","recurrence":"monthly","amount":0}
```

Project creation result:

```text
{"id":"qvlhkeacbngvpldolxvd","ref":"qvlhkeacbngvpldolxvd","organization_id":"cnldisybggvirqrxvmby","organization_slug":"cnldisybggvirqrxvmby","name":"MarketNiora-NP-Clone-20260920","region":"ap-south-1","created_at":"2026-09-20T16:10:31.34144Z","status":"ACTIVE_HEALTHY"}
```

Fresh clone migration history before baseline application:

```text
{"migrations":[]}
```

Project runtime:

```text
host=db.qvlhkeacbngvpldolxvd.supabase.co
version=17.6.1.166
engine=17
status=ACTIVE_HEALTHY
```

### 1.2 Baseline clone content

001–007 were recreated as schema/governance structure only. Migration 005's production seed INSERT for the four identity-resolution requests was intentionally not copied, because the clone requirement was schema-only and no production data was to be copied.

### 1.3 007 baseline surprise and controlled correction

First 007 attempt on the fresh clone:

```text
Script error:
INVALID_ARGUMENT: Error code: INVALID_ARGUMENT: Error calling MCP tool: {"error":{"name":"HttpException","message":"Failed to apply database migration: ERROR:  42501: permission denied for schema governance_layer"}}
```

Production vs fresh clone ACL evidence:

```text
PRODUCTION governance_layer
owner=postgres
service_role_usage=true
service_role_create=true
nspacl={postgres=UC/postgres,service_role=UC/postgres}

FRESH CLONE governance_layer
owner=postgres
service_role_usage=false
service_role_create=false
nspacl=null
```

Production also had explicit service_role privileges:

```text
governance_layer.identity_conflict: SELECT, UPDATE
governance_layer.identity_resolution_requests: SELECT, UPDATE
```

Clone-only bootstrap applied:

```sql
GRANT USAGE, CREATE ON SCHEMA governance_layer TO service_role;
GRANT SELECT, UPDATE ON TABLE governance_layer.identity_conflict TO service_role;
GRANT SELECT, UPDATE ON TABLE governance_layer.identity_resolution_requests TO service_role;
```

007 retry result:

```text
{"success":true}
```

No production grant/write was executed.

> Process-control note: the first 007 attempt technically returned FAIL before the clone-only ACL correction. The retry was performed before any migration 008+ application. This is disclosed rather than hidden.

## 2. Step 2 — Migration 008

Pre-count:

```text
{"raw_stock_observation_rows":0}
```

Apply output:

```text
{"success":true}
```

Post-check:

```text
freshness_status       USER-DEFINED / NOT NULL
verification_status    USER-DEFINED / NOT NULL
interpretation_status  USER-DEFINED / NOT NULL
workflow_status        USER-DEFINED / NOT NULL
retrieved_at           timestamptz / NULLABLE
validation_status      text / NULLABLE
configuration_snapshot jsonb / NULLABLE
```

Enum values:

```text
freshness_status      {LIVE,DELAYED,STALE,UNAVAILABLE}
interpretation_status {NOT_INTERPRETABLE,INTERPRETABLE}
verification_status   {VERIFIED,UNKNOWN}
workflow_status       {SOURCE_REQUIRED,PENDING,MISSING}
```

Final C5 row check:

```text
{"row_count":0,"rows_missing_c5":0}
```

Result: **PASS**. Safety gate not triggered; no backfill invented; NOT NULL enforcement succeeded.

## 3. Step 3 — Migration 009

Apply output:

```text
{"success":true}
```

Enum verification:

```text
{"typname":"identity_role","enum_values":"{USER,ADMIN,OWNER}"}
```

Result: **PASS**.

## 4. Step 4 — Migration 010

Apply output:

```text
{"success":true}
```

Tables created:

```text
public.app_user
public.session
public.entitlement
public.feature_policy
public.formula_version
public.owner_totp_secret
public.owner_mfa_challenge
public.app_audit_log
```

Exact `password_hash` column search:

```text
[]
```

Broader `%password%` inspection also found platform fields:

```text
auth.users.encrypted_password
pg_catalog.pg_authid.rolpassword
pg_catalog.pg_roles.rolpassword
pg_catalog.pg_subscription.subpasswordrequired
```

OIDC unique index:

```text
{"indexname":"app_user_oidc_issuer_oidc_subject_key","indexdef":"CREATE UNIQUE INDEX app_user_oidc_issuer_oidc_subject_key ON public.app_user USING btree (oidc_issuer, oidc_subject)"}
```

Result: **PASS** for the MarketNiora application control plane.

## 5. Step 5 — Migration 011

Apply output:

```text
{"success":true}
```

Tables created:

```text
production_layer.sector
production_layer.sub_sector
production_layer.stock_classification
production_layer.stock_group
production_layer.stock_group_membership
production_layer.theme
production_layer.sub_theme
production_layer.industry
production_layer.stock_theme_membership
production_layer.value_chain_stage
production_layer.value_chain_evidence
production_layer.rotation_score
production_layer.stock_score
production_layer.shariah_status
```

Constraint verification:

```text
rotation_score_check = STOCK_GROUP/SUB_SECTOR/SECTOR entity exclusivity
rotation_score_horizon_check = 1D,1W,1M,3M
rotation_score_level_check = STOCK_GROUP,SUB_SECTOR,SECTOR
stock_score_catalyst_check = 0,4,8,12
stock_score_final_score_check = 0..100 OR NULL
stock_score_risk_penalty_check = -30..0
value_chain_stage_stage_name_check = exactly 10 approved stages
```

Result: **PASS**.

## 6. Step 6 — Migration 012

Apply output:

```text
{"success":true}
```

RLS metadata: 22/22 new tables returned `rls_enabled=true`, `anon_all_policies=1`, `auth_all_policies=1`.

Anon negative SELECT test:

```text
result_status=ERROR
sqlstate=42501
error_message=permission denied for schema production_layer
```

or, for public tables:

```text
result_status=ERROR
sqlstate=42501
error_message=permission denied for table <table>
```

Authenticated negative SELECT test returned the same deny pattern for all 22 tables.

Raw append-only test:

```text
{"test_name":"raw_stock_observation UPDATE","result_status":"EXPECTED_EXCEPTION","sqlstate":"P0001","error_message":"Append-only table: UPDATE is not permitted on raw_stock_observation."}
```

App audit delete test:

```text
{"test_name":"app_audit_log DELETE","result_status":"EXPECTED_EXCEPTION","sqlstate":"P0001","error_message":"Append-only table: DELETE is not permitted on app_audit_log."}
```

Locked formula update test:

```text
{"test_name":"locked formula_version UPDATE","result_status":"EXPECTED_EXCEPTION","sqlstate":"P0001","error_message":"Locked formula version <generated-id> cannot be updated or deleted."}
```

Non-owner TOTP test:

```text
{"test_name":"owner_totp_secret INSERT for non-OWNER","result_status":"EXPECTED_EXCEPTION","sqlstate":"P0001","error_message":"TOTP secret may only belong to an OWNER."}
```

All trigger-test data was rolled back.

Result: **PASS**.

## 7. Step 7 — Migration 013

Apply output:

```text
{"success":true}
```

All 11 expected views exist:

```text
v_check_c5_status_completeness
v_check_derived_formula_version
v_check_isin_format
v_check_open_identity_conflicts
v_check_orphan_foreign_keys
v_check_pending_resolution_requests
v_check_row_count
v_check_sector_coverage
v_import_readiness
v_pending_resolutions
v_resolution_status
```

Function security evidence:

```text
{"function_owner":"service_role","security_definer":true,"function_acl":"{service_role=X/service_role}"}
```

Privilege check:

```text
anon_exec=false
auth_exec=false
service_exec=true
```

Actual `v_import_readiness` result:

```text
C5_STATUS_COMPLETENESS      expected=0 actual=0 status=PASS import_ready=false
DERIVED_FORMULA_PROVENANCE  expected=0 actual=0 status=PASS import_ready=false
ISIN_FORMAT                 expected=0 actual=0 status=PASS import_ready=false
OPEN_IDENTITY_CONFLICTS     expected=0 actual=0 status=PASS import_ready=false
ORPHAN_FOREIGN_KEYS        expected=0 actual=0 status=PASS import_ready=false
PENDING_RESOLUTION_REQUESTS expected=0 actual=0 status=PASS import_ready=false
ROW_COUNT                   expected=4187 actual=0 status=FAIL  import_ready=false
SECTOR_COVERAGE             expected=0 actual=0 status=PASS import_ready=false
```

Result: **PASS** for the QC/function migration; import readiness correctly remains false because clone staging has 0 rows.

## 8. Step 8 — Regression

DB-connected clone regression: **UNKNOWN / NOT WIRED**. Repository tests do not reference `DATABASE_URL`, a Supabase/PostgreSQL client, or the clone ref.

Repository unit test command:

```bash
node --experimental-strip-types --test tests/*.test.ts
```

Actual final TAP summary:

```text
1..319
# tests 319
# suites 0
# pass 319
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Raw output is stored separately in `MARKETNIORA_CLONE_REGRESSION_RAW.txt`.

## 9a. Per-migration status

| Migration | Status | Evidence | Blockers |
|---|---|---|---|
| 001 | PASS | Clone apply success + zero rows | None |
| 002 | PASS | Clone apply success + fail-closed policies | None |
| 003 | PASS | Clone apply success + zero rows | None |
| 004 | PASS | Clone apply success | None |
| 005 | PASS | Schema-only clone variant; seed DML omitted intentionally | No data copied by design |
| 006 | PASS | Clone apply success + QC views | None |
| 007 | PASS | Initial FAIL caused by fresh-project ACL gap; clone-only ACL correction; retry succeeded | Fresh environment ACL prerequisite must be documented |
| 008 | PASS | C5 NOT NULL + enum values + 0 missing | None |
| 009 | PASS | USER/ADMIN/OWNER enum | None |
| 010 | PASS | 8 app control tables; no password_hash; OIDC unique index | Platform auth schema observation |
| 011 | PASS | 14 domain tables + checks | None |
| 012 | PASS | 22/22 RLS + 44 SELECT negative checks + 4 trigger tests | None at SQL layer |
| 013 | PASS | 11 views + SECURITY DEFINER + service_role-only execution | Import remains false due 0 staging rows |

## 9b. Exact SQL / raw evidence

Exact SQL for migrations 008–013 is verbatim in:

`MARKETNIORA_CLONE_MIGRATIONS_008_013_EXACT.sql`

Full raw unit-test output is verbatim in:

`MARKETNIORA_CLONE_REGRESSION_RAW.txt`

## 9c. Surprises / unexpected findings

1. Fresh Supabase projects do not automatically have the same `governance_layer` service_role ACL baseline observed in production. This caused 007 to fail once.
2. Supabase platform `auth.users.encrypted_password` exists in the clone. Exact MarketNiora `password_hash` search is empty; the application control plane has no password field.
3. Clone 005 intentionally has no production resolution-request seed rows.
4. Prisma CLI and application runtime against the clone were not exercised.
5. `public.app_audit_log.actor_type` is a `text` column in the executed SQL migration, while the target Prisma design models `AuditActorType` as an enum. This is a DB-vs-Prisma parity item that remains **UNKNOWN** until Prisma validation; no client code was changed in this run.

## 9d. Recommendation for production application

Clone SQL migration behavior: **PASS**.

Full production safety as an end-to-end application/runtime claim: **BLOCKED / UNKNOWN** pending Prisma validation, DB-connected application tests, auth runtime tests, and production backup/forward-only deployment rehearsal.

Remaining UNKNOWN:

- Prisma CLI schema validation/generation against clone.
- Actual application runtime against clone.
- Google OIDC token/JWKS runtime.
- Owner TOTP KMS-backed secret runtime.
- Entitlement/payment provider runtime (provider remains NOT_DEFINED).
- Production backup/rollback rehearsal for 008–013.

Next gate: **OWNER_DECISION_REQUIRED** for production application after the above evidence is complete, including explicit acceptance of the fresh-project ACL bootstrap requirement and confirmation that the app does not use password-based Supabase Auth.

## Production post-run read-only evidence

Production migration history remains exactly 001–007.

Post-run production row counts checked read-only:

```text
governance_layer.audit_log                     0
governance_layer.identity_conflict             4
governance_layer.identity_resolution_requests  4
governance_layer.master_import_batch           1
production_layer.canonical_stock               0
production_layer.raw_stock_observation         0
staging_enrichment.master_4187_staging         0
```

No production migration application or write was executed in this run.
