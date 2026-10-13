# MASTER_4187 Import Readiness Audit — 2026-10-14

**Scope:** read-only inspection of the approved non-production clone `MarketNiora-NP-Clone-20260920` (`qvlhkeacbngvpldolxvd`). No database rows or migrations were changed during this audit.

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

## Not done / next gates

- No canonical import or owner authorization was performed.
- No Supabase migration was applied.
- The actual staging identities/classifications still need evidence-based review and Owner authorization.
- Market-data provider remains `OPEN / NOT_SELECTED`.
- Production deployment, auth runtime against the actual clone, and actual provider/data integration remain pending.

**Rule:** `STAGED` does not mean `VERIFIED`, `AUTHORIZED`, or `IMPORTED`. Missing identity evidence must not be guessed.
