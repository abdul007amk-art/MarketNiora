# MarketNiora — CHUNK 5 EBI v1.3 Independent Implementation Audit

Date: 2026-09-26
Branch: `chunk5-implementation-audit`
Scope: current repository implementation against the authoritative CHUNK 5 EBI v1.3 package and its 32 mandatory checkpoints.

## Audit basis

This is an implementation/conformance audit of the current GitHub branch. It is distinct from the project-owner-supplied Gemini methodology audit. CI evidence is also treated separately from specification conformance.

### Current executable evidence

- CI validation run #129: **PASS**, **344/344 tests**, TypeScript PASS, Prisma validate PASS, protected-engine verification PASS, Git state summary PASS.
- Before run #129, CI #128 exposed one failing C5-028 restatement-chain fixture because the test used a string `sourceTimestamp` while the canonical provenance contract requires a finite numeric timestamp.
- The fixture was corrected on commit `30be390c4f1dc2195d5baaff8abe100bd0f73be0`.
- CI #129 for that commit is the fresh post-patch executable validation evidence.
- The earlier provenance-boundary finding EBI-IMPL-001 was patched by enforcing the canonical `validateProvenance()` contract at the EBI input boundary, with a regression test.

## 32-checkpoint assessment

| # | Checkpoint | Current assessment | Evidence / finding |
|---|---|---|---|
| 1 | Mathematical correctness | PASS/PARTIAL | CEI/CDQ/CFQ/PGQ/ENE/RGQ/BSQ primitives are executable; full independent audit remains distinct from unit tests. |
| 2 | ROCE/ROIC determinism | PASS | CEI formulas and regression tests pass in CI #129. |
| 3 | NOPAT / Invested Capital | PASS | v1.3 financing-side IC and ETR fail-closed logic are implemented and tested. |
| 4 | Zero / negative denominators | PASS | Applicable CEI/CFQ/PGQ denominator states are explicit and tested. |
| 5 | Period consistency | PASS | Mixed period type and boundary mismatches are rejected. |
| 6 | Missing data | PASS/PARTIAL | Implemented primitives fail closed; complete production-wide engine coverage is not present in this branch. |
| 7 | Truth-state compatibility | PARTIAL | OEP contract exists, but truth-state values are not governed by an explicit enum/transition engine. |
| 8 | Coverage denominator | PASS | `availableValid / required × 100`. |
| 9 | 40% threshold | PASS | `EBI_COVERAGE_MIN = 40.0`. |
| 10 | CoverageGate TRUE/FALSE | PASS | TRUE applies threshold; FALSE does not auto-reject. |
| 11 | No weight redistribution | PASS/PARTIAL | No redistribution logic is present; no full downstream scoring integration exists. |
| 12 | ENE / RGQ / PGQ separation | PARTIAL | Separate primitives exist; no complete production orchestration boundary is implemented. |
| 13 | CFQ / BSQ / CEI separation | PARTIAL | Separate modules exist; no complete production orchestration boundary is implemented. |
| 14 | BNI / CPI separation | CONTRACT ONLY | Evidence contracts exist; no dedicated executable decision engine is present. |
| 15 | GVI / ECI separation | CONTRACT ONLY | Evidence contracts exist; no dedicated executable decision engine is present. |
| 16 | BERI independence | CONTRACT ONLY | Risk evidence contract exists; no dedicated executable decision engine is present. |
| 17 | CDQ independence | PASS/PARTIAL | Registry and gate are independent; full production dependency audit remains open. |
| 18 | Rotation independence | PARTIAL | IIC permits DATA_ONLY integration, but no live integration layer is implemented here. |
| 19 | TIE independence | PARTIAL | Dependency is typed but no live integration layer is implemented. |
| 20 | RSE-DCS independence | PARTIAL | Dependency is typed but no live integration layer is implemented. |
| 21 | OCE independence | PARTIAL | Dependency is typed but no live integration layer is implemented. |
| 22 | Theme independence | PARTIAL | Dependency is typed but no live integration layer is implemented. |
| 23 | Shariah independence | PARTIAL | Dependency is typed but no live integration layer is implemented. |
| 24 | Stock Score independence | PARTIAL | Dependency is typed but no live integration layer is implemented. |
| 25 | Version-pinned integration | PASS | IIC requires non-empty methodologyVersion and DATA_ONLY authority. |
| 26 | Circular dependency prevention | PASS/PARTIAL | Repeated dependency in a supplied path is rejected; broader graph-level validation is not implemented. |
| 27 | Provenance / source conflicts | PASS/PARTIAL | Canonical provenance validator is enforced at EBI input boundary; source conflict resolution remains outside this module. |
| 28 | Restatement handling | PARTIAL | Structural pairing is enforced and regression-tested; no full restatement lifecycle/version-selection engine is present. |
| 29 | No-fabrication | PASS/PARTIAL | Nulls are preserved and evidence-only contracts avoid invented scores; full evidence lifecycle remains outside this module. |
| 30 | Deterministic test adequacy | PASS | CI #129 passed 344/344 on the current head after the latest patches. |
| 31 | Output contract | PASS/PARTIAL | OEP fields and basic validation exist; no full presentation/orchestration engine is implemented. |
| 32 | Governance / lock criteria | OPEN | No lock certificate; several checkpoints remain partial or contract-only and require formal governance disposition. |

## Audit finding

### EBI-IMPL-001 — Provenance validator was not enforced at the EBI input boundary

**Severity:** Medium

**Observed:** `backend/src/ebi/inputContract.ts` checked only selected classification/data-nature combinations and did not invoke the canonical provenance validator.

**Risk:** A structurally malformed provenance object could pass EBI input validation even though the repository's canonical provenance contract requires valid verification/data-nature values and requires a non-empty formula version for DERIVED data.

**Disposition:** PATCHED.

**Patch:** EBI input validation now invokes `validateProvenance(input.provenance)`.

**Regression:** Added a test requiring DERIVED input to provide a non-empty formula version.

**Post-patch verification:** CI #129 PASS, 344/344.

### CI-128 fixture correction

CI #128 exposed a test-fixture defect in C5-028: the valid restatement-chain fixture supplied `sourceTimestamp` as an ISO string, while the canonical provenance contract requires a finite numeric timestamp. The production contract was not weakened; the fixture was corrected to use `Date.parse(...)`. CI #129 subsequently passed all 344 tests.

## Governance conclusion

The current executable implementation evidence is green at CI level.

However, **CI GREEN does not by itself create a Chunk 5 lock certificate**. The implementation audit still records several checkpoints as PARTIAL or CONTRACT ONLY because this branch contains deterministic contracts/primitives rather than complete production orchestration for every EBI layer.

The project-owner-supplied Gemini result remains a methodology-audit result and does not substitute for implementation evidence.

**Current status: CI VERIFIED — GOVERNANCE LOCK STILL PENDING; NOT LOCKED.**

A lock certificate must remain withheld until the remaining implementation/governance gaps are explicitly accepted or completed under the formal Chunk 5 lock process, followed by the required user confirmation.
