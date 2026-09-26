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
| 11 No weight redistribution | PASS — CI VERIFIED | CLOSED | Executable CDQ boundary guard and regression tests prove coverage does not mutate downstream weights. CI #142 passed with 347/347 tests. |
| 12 ENE/RGQ/PGQ separation | PASS — CI VERIFIED | CLOSED | Executable sibling-engine independence boundary and regression tests passed. ENE, RGQ and PGQ may share source data but cannot consume sibling-engine decisions. CI #146 passed with 350/350 tests. |
| 13 CFQ/BSQ/CEI separation | PASS — CI VERIFIED | CLOSED | Executable sibling-engine independence boundary and regression tests passed. CFQ, BSQ and CEI may share source data but cannot consume sibling-engine decisions. CI #150 completed successfully with Typecheck, Test suite, Prisma validate, and protected-engine verification all green. |
| 14 BNI/CPI separation | IMPLEMENTED — PENDING CI | OPEN | Added an executable sibling-engine independence boundary and regression tests. BNI and CPI may share source evidence but cannot consume sibling-engine decisions. Fresh CI verification is required before closure. |
| 15 GVI/ECI separation | IMPLEMENTED — PENDING CI | OPEN | Added an executable sibling-engine independence boundary and regression tests. GVI and ECI may share source evidence but cannot consume sibling-engine decisions. Fresh CI verification is required before closure. |
| 16 BERI independence | IMPLEMENTED — PENDING CI | OPEN | Added an executable BERI independence boundary and regression tests. BERI may consume shared source evidence but cannot consume sibling EBI decision outputs. Fresh CI verification is required before closure. |
| 17 CDQ independence | IMPLEMENTED — PENDING CI | OPEN | Added an executable CDQ independence boundary and regression tests. CDQ may consume source availability/validity metadata but cannot consume EBI engine decision outputs. Fresh CI verification is required before closure. |
| 18–24 external engine independence | IMPLEMENTED — PENDING CI | OPEN | Added an executable version-pinned DATA_ONLY boundary and negative tests covering Rotation, TIE, RSE/DCS, OCE, Theme, Shariah and Stock Score. External engines cannot hold decision authority over EBI. Fresh CI verification is required before closure. |
| 26 Circular dependency prevention | IMPLEMENTED — PENDING CI | OPEN | Added an executable directed integration-graph cycle detector with direct/multi-node/shared-dependency regression tests. Fresh CI verification is required before closure. |
| 28 Restatement handling | IMPLEMENTED — PENDING CI | OPEN | Added deterministic restatement-chain validation and fail-closed terminal-version selection, with regression tests for missing links, self-supersession, period mismatch and ambiguity. Fresh CI verification is required before closure. |
| 29 No-fabrication | IMPLEMENTED — PENDING CI | OPEN | Added an executable evidence/provenance boundary requiring source evidence, rejecting SOURCE_REQUIRED evidence for final conclusions, and requiring formula versions for derived evidence. Regression tests added; fresh CI verification is required before closure. |
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

The next engineering process is to resolve the applicable open checkpoint gaps, beginning with the smallest deterministic governance contracts and their tests, then re-run the complete validation suite and update the 32-checkpoint audit. Checkpoints 7, 11, 12, and 13 are now CI-verified and closed; the remaining listed checkpoints stay open until their required evidence is implemented or formally scoped.
