# MASTER_4187 Staging Import — Validation and Runbook

## Purpose and boundary

This loader copies the immutable `MASTER_4187` workbook sheet into the existing `staging_enrichment.master_4187_staging` table. It does **not** insert into `production_layer.canonical_stock`, `production_layer.shariah_status`, rotation scores, or stock scores. The batch remains `STAGED`, and `owner_authorized_at` is deliberately left NULL.

The importer must only target the approved MarketNiora non-production clone. It reuses the existing `assertNonProdDatabaseAccess()` guard: `NODE_ENV=production` is refused, `MARKETNIORA_DB_TARGET` must equal `NON_PROD`, and `DATABASE_URL` must identify the approved non-production Supabase project.

## Required input

Export only the `MASTER_4187` sheet to CSV, keeping the columns in this exact order and excluding any extra spreadsheet row-index column:

`Sector,Sub-Sector,Stock,Shariah Status,Exchange,Symbol,Google Finance Ticker`

The loader requires exactly 4,187 data rows. It hashes the exact CSV bytes with SHA-256, records that hash in `governance_layer.master_import_batch`, preserves original order with `source_row_number` (1–4,187), and preserves the two source-only fields `Shariah Status` and `Google Finance Ticker`.

## Source-data audit recorded from the current workbook

- Source rows: 4,187.
- Duplicate exchange+symbol groups: 4 — `NSE:SUULD`, `NSE:SURAJLTD`, `NSE:DCMSHRIRAM`, and `NSE:PTC`.
- Rows involved in those duplicate groups: 8.
- Missing Sector row: `NSE:ETL` / Emkay Tools Limited.
- Quarantined source rows: 9 total (8 duplicate rows plus the missing-Sector row).

The source rows are retained, never silently deduplicated. Every row belonging to a duplicate identity group and each row with missing Sector receives `identity_status='QUARANTINED'`. Other rows stay `PENDING`; none is marked `VERIFIED` by this import.

## Run steps

1. Apply `database/migrations/014_master_4187_staging_provenance.sql` to the approved non-production clone using the normal migration/review process.
2. Regenerate and validate Prisma: `npx prisma generate --schema database/prisma/schema.prisma` and `npx prisma validate --schema database/prisma/schema.prisma`.
3. Export the source sheet to `MASTER_4187.csv`.
4. Set `MARKETNIORA_DB_TARGET=NON_PROD` and the approved clone's `DATABASE_URL` in the local/server environment. Do not put credentials in chat or commit them.
5. Run: `node --experimental-strip-types scripts/stageMaster4187.ts --input=/path/to/MASTER_4187.csv`.

The operation is transaction-scoped and uses a non-blocking advisory lock for the source hash. Re-running the exact same file is a no-op only if that source hash already has a complete `STAGED` batch with 4,187 rows. A different pre-existing master batch, any unexplained staging rows, or a partial/inconsistent batch stops the import; the script does not clear or overwrite rows.

## Review and release gate

The loader records an OPEN identity-conflict record for each duplicate key, an OPEN classification review for each missing-Sector row, and PROPOSED source evidence. The existing governance views should therefore keep import readiness blocked while those issues remain unresolved.

This is not Owner authorization. A separate evidence-backed decision is required before any canonical import. Raw Shariah labels are retained only as staging metadata; they do not set or imply a verified Shariah status. The master universe, formula weights, hierarchy, score engines, and rotation engines are not changed by this loader.
