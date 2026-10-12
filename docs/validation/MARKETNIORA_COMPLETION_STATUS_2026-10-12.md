# MarketNiora Completion Status — 12 October 2026

## Executive status

**The non-production master staging milestone is complete. MarketNiora is not production-ready.** The canonical master, live quote persistence, rotation/Stock Score data flow, authentication runtime and production API deployment remain release gates. Locked business rules and protected calculation engines were not changed.

## Verified repository progress

- The guarded Upstox Full Market Quotes V3 provider candidate was merged in PR #35. Its latest branch CI run passed. It deliberately remains non-default: provider-selection decision D-001, canonical instrument identity mapping, approved timestamp/freshness policy, server-side token provisioning, durable ingestion and deployed-runtime checks are still required.
- The guarded MASTER_4187 staging loader was merged in PR #36. Main CI passed after merge, including Prisma generate/validate, typecheck, tests, PostgreSQL integration tests and the protected-engine integrity check.
- PR #37 aligned Prisma `RawStockObservation.stockId` with the SQL contract: `stock_id` is non-null, must reference a canonical stock, and rows are append-only. It was merged after the full CI passed.
- PR #38 added an append-only Prisma raw-quote writer. It persists source/retrieval timestamps and explicit freshness/workflow states, keeps verification at `UNKNOWN`, and fails before insert unless a resolver supplies one canonical stock UUID plus HTTPS mapping evidence. The writer is merged but not wired into the default API runtime; canonical identity resolution, provider approval and persisted-pipeline integration remain release gates.
- Latest full CI passed on raw-writer branch head `2eecf72e73d27a483386b20b0be3fbf87fedad75`; main-branch CI should still be checked after the merge commit.

## MASTER_4187 staging result

Migration `014_master_4187_staging_provenance.sql` was applied to the approved **non-production** Supabase clone and its columns, uniqueness index and batch foreign key were verified.

The workbook source was exported as a seven-column CSV and validated against the exact expected headers and 4,187 data rows. The staging operation was atomic and the subsequent database audit confirmed:

| Measure | Verified value |
|---|---:|
| Staged rows | 4,187 |
| Rows pending normal identity review | 4,178 |
| Rows quarantined | 9 |
| Open exchange+symbol identity conflicts | 4 |
| Open missing-sector classification reviews | 1 |
| Proposed source-evidence records | 2 |
| Source-row numbers present and distinct | 4,187 |
| Batch status | `STAGED` |
| Owner authorization timestamp | `NULL` |

The source SHA-256 is `0b0472c8a2566201cb54884647df4f1eaa9f4dccdbf207d59aa666cb6631e649`. An initial short hash fragment was corrected, and a separate proposed evidence record documents that correction. Row contents were not changed during the correction.

### Quarantined source issues

- `NSE:SUULD`, source rows 755–756: Suumaya Corporation Limited / Suumaya Industries Ltd.
- `NSE:SURAJLTD`, source rows 2470–2471: Suraj Industries Ltd / Suraj Limited.
- `NSE:DCMSHRIRAM`, source rows 3303–3304: DCM Shriram Industries Limited / DCM Shriram Limited.
- `NSE:PTC`, source rows 4165–4166: PTC India Limited / PTC Industries Ltd.
- `NSE:ETL`, source row 4187: Emkay Tools Limited has no Sector in the source.

All source rows remain in staging. No duplicate has been dropped, no missing sector has been inferred, and no Shariah label has been promoted from staging into a verified production status.

## Database truth after staging

The non-production clone still has **zero** rows in `production_layer.canonical_stock`, `production_layer.raw_stock_observation`, `production_layer.rotation_score` and `production_layer.stock_score`. This is intentional: the batch has not been owner-authorized, and the known identity/classification cases remain open. Do not interpret 4,187 staged rows as a populated canonical production universe.

The raw-observation schema requires a canonical `stock_id` and protects inserted records from UPDATE/DELETE. A live quote cannot be treated as a persisted canonical observation until its exchange/symbol has exactly one approved canonical stock identity.

## Hosted research preview

Public research preview: https://marketniora.miniup.app

The site is a separately hosted research preview using its hosted research dataset and browser-side DuckDB-Wasm. It is not proof that the repository Node API is deployed or that the staged Supabase rows are wired into the public explorer. The preview now shows a Shariah check mark only for the source's positive Shariah labels, renders non-Shariah/pending values as blank, and clearly disables sign-in/account-creation buttons while hosted authentication is not connected.

No connected Vercel project/team was found during this audit. No production API deployment was created.

## Remaining release gates (in order)

1. Resolve all four identity-conflict groups using official exchange/provider instrument evidence and an owner decision; resolve the missing Sector row from documentary evidence. Keep unresolved rows quarantined.
2. Complete the owner-reviewed canonical import transaction; retain provenance, original row order and the immutable 4,187 source file.
3. Finalize the canonical instrument mapping contract and owner approval D-001; provision the short-lived provider token through the approved secrets manager and adopt a source-timestamp freshness policy. Do not commit credentials.
4. Wire durable raw observations and normalized/canonical pipeline records to PostgreSQL; preserve append-only semantics, source ID, source/retrieval timestamps, verification/freshness state, conflict decisions and job/audit records.
5. Feed verified persisted observations into the locked hierarchy **STOCK → STOCK GROUP → SUB-SECTOR → SECTOR** and Stock Score SS-1.0-R3 without changing protected engine files or using external-index breadth.
6. Run `scripts/integrationTest.ts` against the approved NON_PROD clone with all CRUD checks passing and test rows cleaned up; select production-grade KMS and durable portfolio/session storage.
7. Link an approved deployment target, configure secrets out-of-band, then verify OIDC callback/cookies, security headers, rate limiting, database policies, monitoring, backup/restore and a real deployed smoke test.

## Non-negotiable guardrails

- Do not change the locked market-rotation weights/caps, Stock Score weights, hierarchies, master order, or Shariah display rules without explicit Owner approval.
- Do not activate Upstox simply because the adapter is merged or its tests pass.
- Do not remove the production startup guard while any required release gate is unverified.
- If a data item is not verified, keep it `PENDING`, `UNKNOWN`, `UNAVAILABLE` or `SOURCE_REQUIRED`; do not invent a value to fill a dashboard.
