# MarketNiora — Clone Backup/Restore Rehearsal Plan

Status: DESIGN ONLY / NOT EXECUTED
Scope: non-production clone `qvlhkeacbngvpldolxvd` only.
Production `lrbgicuzlhgnfplnmvre` is excluded.

## Objective

Prove that a clone containing the MarketNiora 001-013 database state can be recovered from a logical backup and that 008-013 have a forward-only rollback/recovery path.

## Backup track

Because the current organization is on the Free plan, use a logical export rather than assuming daily physical backups. Supabase documentation says Free-tier projects should regularly export with the Supabase CLI `db dump`; daily platform backups are for Pro/Team/Enterprise. The documented connection methods use the Session Pooler or direct connection string with the database password.

Required artifacts:

- roles.sql
- schema.sql
- data.sql (expected empty for MarketNiora application tables in this clone)
- migration-history snapshot for 001-013
- pre-backup table/constraint/RLS/function verification report

Suggested commands once a database connection string is available:

```bash
supabase db dump --db-url "$DATABASE_URL" -f roles.sql --role-only
supabase db dump --db-url "$DATABASE_URL" -f schema.sql
supabase db dump --db-url "$DATABASE_URL" -f data.sql --use-copy -x "storage.buckets_vectors" -x "storage.vector_indexes" --data-only
```

## Restore track

Use a second disposable Supabase project, or a brand-new clone project, and restore the logical backup with `psql` using `ON_ERROR_STOP=1` in a controlled environment. Do not restore into production.

Target verification after restore:

1. PostgreSQL major version is 17.
2. Schemas `public`, `governance_layer`, `production_layer`, `staging_enrichment` exist.
3. Expected tables/views/functions exist.
4. All 001-013 migration history entries are present when the restore procedure preserves migration history.
5. RLS is enabled on all required tables.
6. Fail-closed policies are present.
7. Append-only triggers are present.
8. `resolve_identity_conflict()` is `SECURITY DEFINER`, owned by `service_role`, and executable only by `service_role`.
9. `v_import_readiness.import_ready = false` while staging row count is 0.
10. Row counts remain unchanged by restore.

## 008-013 rollback/recovery strategy

There are no destructive `down` migrations for 008-013.

Recovery path:

- Freeze application writes.
- Preserve the failed-state audit/log evidence.
- Restore the last known-good backup to a disposable replacement project.
- Verify the restored baseline.
- Apply only reviewed forward migrations required to reach the desired state.
- Re-run security, provenance, QC, and regression gates.

For migration-specific recovery:

- 008: restore pre-008 backup, or rebuild 001-007 baseline and reapply corrected 008.
- 009: restore pre-009 backup, or rebuild 001-008 and reapply corrected 009.
- 010: restore pre-010 backup, or rebuild 001-009 and reapply corrected 010.
- 011: restore pre-011 backup, or rebuild 001-010 and reapply corrected 011.
- 012: restore pre-012 backup, or rebuild 001-011 and reapply corrected 012.
- 013: restore pre-013 backup, or rebuild 001-012 and reapply corrected 013.

Do not edit or reset migrations 001-007.

## Rehearsal gate

PASS only after an actual backup file is produced, restored to a disposable clone, and the verification suite passes against the restored clone.

Current status: UNKNOWN — backup/restore execution requires a usable database connection string/password and backup tooling in the execution environment.
