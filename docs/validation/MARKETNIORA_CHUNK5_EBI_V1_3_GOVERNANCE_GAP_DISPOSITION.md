# MarketNiora — CHUNK 5 EBI v1.3 Governance Gap Disposition

Date: 2026-09-26
Branch: `chunk5-implementation-audit`
Status: **OPEN — PRE-LOCK GAP REGISTER**

## Governing rule

The authoritative CHUNK 5 v1.3 package states that LOCK READY requires:
- CRITICAL = 0
- HIGH = 0
- MEDIUM = 0
- LOW = 0
- all mandatory tests/checkpoints pass with no unexplained failure
- user confirmation is required after a clean audit.

Therefore CI #129 being green is necessary evidence, but it does not by itself satisfy the lock criterion.

## Disposition of current PARTIAL / CONTRACT-ONLY checkpoints

| Checkpoint | Current state | Disposition | Required next action |
|---|---|---|---|
| 6 Missing data | PASS/PARTIAL | OPEN | Define/implement production-wide fail-closed coverage across all EBI outputs, or formally scope the missing layers. |
| 7 Truth-state compatibility | PASS — CI VERIFIED | CLOSED | OEP enforces the locked CHUNK 0 truth-state vocabulary and resolves multi-input derived truth state to the weakest required input. CI #136 passed with 345/345 tests, including the new C5-007 regression tests. Full 32-checkpoint governance remains open. |
| 11 No weight redistribution | IMPLEMENTED — PENDING CI | OPEN | Added an executable CDQ boundary guard and regression tests proving coverage does not mutate downstream weights; fresh CI verification is required before closure. |
| 12 ENE/RGQ/PGQ separation | PARTIAL | OPEN | Establish production orchestration boundary and cross-engine independence tests. |
| 13 CFQ/BSQ/CEI separation | PARTIAL | OPEN | Establish production orchestration boundary and cross-engine independence tests. |
| 14 BNI/CPI separation | CONTRACT ONLY | OPEN | Either implement required executable decision/evidence boundary or formally document why contract-only is sufficient for the v1.3 production scope. |
| 15 GVI/ECI separation | CONTRACT ONLY | OPEN | Same disposition requirement. |
| 16 BERI independence | CONTRACT ONLY | OPEN | Same disposition requirement. |
| 17 CDQ independence | PASS/PARTIAL | OPEN | Add production dependency/integration verification. |
| 18–24 external engine independence | PARTIAL | OPEN | Add executable DATA_ONLY integration boundaries and negative tests showing Rotation, TIE, RSE/DCS, OCE, Theme, Shariah and Stock Score cannot alter EBI decisions. |
| 26 Circular dependency prevention | PASS/PARTIAL | OPEN | Extend supplied-path guard to the actual integration graph used by production orchestration. |
| 28 Restatement handling | PARTIAL | OPEN | Implement or explicitly scope the restatement lifecycle/version-selection semantics required by v1.3. |
| 29 No-fabrication | PASS/PARTIAL | OPEN | Extend evidence/no-fabrication enforcement through the complete EBI lifecycle. |
| 31 Output contract | PASS/PARTIAL | OPEN | Complete OEP orchestration/transition validation if required by production scope. |
| 32 Governance | OPEN | BLOCKING | Close all applicable gaps above, rerun the full mandatory suite, then prepare final certificate. |

## Already closed implementation finding

**EBI-IMPL-001 — Provenance validator at EBI input boundary**
- Severity: Medium
- Status: CLOSED/PATCHED
- Verified by CI #129.
- Regression coverage present.

## Important distinction

The items above are not being relabeled as defects without evidence. They are **open lock-gate gaps** because the current implementation audit explicitly marks the corresponding mandatory checkpoints PARTIAL or CONTRACT ONLY, while the authoritative v1.3 lock rule requires all mandatory checkpoints to pass.

No locked baseline is changed by this register.

## Current decision

**CHUNK 5 remains NOT LOCKED.**

The next engineering process is to resolve the applicable open checkpoint gaps, beginning with the smallest deterministic governance contracts and their tests, then re-run the complete validation suite and update the 32-checkpoint audit. Checkpoint 7 is the first implementation pass; it is not yet marked PASS until fresh CI and re-audit evidence are recorded.
