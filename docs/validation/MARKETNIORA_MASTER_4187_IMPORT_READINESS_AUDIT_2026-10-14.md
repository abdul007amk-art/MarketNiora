# MASTER_4187 Import Readiness Audit — 2026-10-14

**Scope:** read-only inspection of the approved non-production clone `MarketNiora-NP-Clone-20260920` (`qvlhkeacbngvpldolxvd`), followed by applying the already-reviewed fail-closed readiness-view migration 016 to that non-production clone only. No staging rows were modified or promoted, and production was not touched.

## Observed state

| Check | Observed result | Interpretation |
|---|---:|---|
| Staged rows | 4,187 | Source row-count check passes |
| `identity_status=PENDING` | 4,178 | Not verified for canonical import |
| `identity_status=QUARANTINED` | 9 | Must remain out of canonical import until resolved |
| Open identity conflicts | 4 | Import blocked |
| Owner authorization timestamp | NULL | The source batch has not been owner-authorized |
| Batch status | `STAGED` | Not imported |
| Canonical stocks | 0 | No canonical universe populated in the inspected clone |
| Raw market observations | 0 | No live/historical observations in the inspected clone |
| Rotation scores / Stock Scores | 0 / 0 | No canonical scores in the inspected clone |
| Provider registry / source health | 0 / 0 | Provider D-001 remains unselected/unconfigured |

The four open NSE symbol conflicts are:

| Symbol | Staging source rows | Names recorded in source |
|---|---|---|
| `SUULD` | 755, 756 | Suumaya Corporation Limited / Suumaya Industries Ltd. |
| `SURAJLTD` | 2470, 2471 | Suraj Industries Ltd / Suraj Limited |
| `DCMSHRIRAM` | 3303, 3304 | DCM Shriram Industries Limited / DCM Shriram Limited |
| `PTC` | 4165, 4166 | PTC India Limited / PTC Industries Ltd |

The names are evidence of identity ambiguity—not a permission to choose one automatically. Both rows in each pair remain retained/quarantined until documentary identity evidence and Owner review.

## Defect found in readiness calculation

The existing `v_check_sector_coverage` derived eligible rows by excluding PENDING and QUARANTINED rows, then reported PASS if `missing_sector_count = 0`. When there were **zero eligible rows**, the count of missing sectors was also zero; this was a vacuous PASS. Also, `v_import_readiness` omitted gates for `identity_status='VERIFIED'` across all rows and for `master_import_batch.owner_authorized_at`.

In the live clone, the overall readiness view currently remains blocked by open conflicts, but if those conflicts were changed without strengthening the other gates, the view could misrepresent the staged data as ready.

## Source remediation prepared

Migration `database/migrations/016_master_4187_readiness_fail_closed.sql` adds:
- `STAGING_IDENTITY_STATUS`: zero rows outside explicit `VERIFIED` status required;
- `OWNER_AUTHORIZATION`: blocked batches or non-blocked batches without `owner_authorized_at` fail;
- `SECTOR_COVERAGE`: at least one verified/eligible row and zero missing sectors required;
- all checks are included in `v_import_readiness`, so any FAIL keeps `import_ready=false`.

The CI fixture uses an isolated disposable PostgreSQL database. It first proves that the 4,187-row PENDING/QUARANTINED and unauthorised fixture fails closed, then simulates a verified/authorized case to prove the readiness checks can pass. This simulation never updates the actual Supabase clone.

**Related identity research:** [MASTER_4187 primary-source identity conflict research](./MARKETNIORA_MASTER_4187_IDENTITY_RESEARCH_2026-10-14.md). It documents NSE filing evidence and candidate dispositions without changing quarantined staging rows.

## Migration 016 — applied and verified on NON_PROD

On 2026-10-14, migration `016_master_4187_readiness_fail_closed.sql` was applied to the approved non-production clone only. It changes governance views, not staging/canonical rows. The migration is recorded as `20261014001133 / master_4187_readiness_fail_closed`.

Post-migration read-only verification:

| Gate | Actual | Status |
|---|---:|---|
| `ROW_COUNT` | 4,187 | PASS |
| `OPEN_IDENTITY_CONFLICTS` | 4 | FAIL |
| `OWNER_AUTHORIZATION` | 1 unauthorized batch | FAIL |
| `SECTOR_COVERAGE` | 0 eligible verified rows | FAIL |
| `STAGING_IDENTITY_STATUS` | 4,187 not verified | FAIL |
| Overall `import_ready` | false for every returned gate row | BLOCKED |

The vacuous-PASS defect is closed: zero eligible verified rows now produce an explicit `FAIL`, not a false readiness result. Canonical counts remain unchanged at 0 stocks, 0 raw observations, 0 Rotation scores and 0 Stock Scores. No source row was altered.

## Not done / next gates

- No canonical import or owner authorization was performed.
- The actual staging identities/classifications still need evidence-based review and Owner authorization.
- Market-data provider remains `OPEN / NOT_SELECTED`.
- Production deployment, auth runtime against the actual clone, and actual provider/data integration remain pending.

**Rule:** `STAGED` does not mean `VERIFIED`, `AUTHORIZED`, or `IMPORTED`. Missing identity evidence must not be guessed.
