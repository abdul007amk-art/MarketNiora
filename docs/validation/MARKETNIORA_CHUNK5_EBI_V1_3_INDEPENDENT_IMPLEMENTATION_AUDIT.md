# MarketNiora — CHUNK 5 EBI v1.3 Independent Implementation Audit

Date: 2026-09-26
Branch: `chunk5-implementation-audit`
Scope: current repository implementation against the authoritative CHUNK 5 EBI v1.3 package and its 32 mandatory checkpoints.

## Audit basis

This is an implementation/conformance audit of the current GitHub branch. It is distinct from the project-owner-supplied Gemini methodology audit. CI evidence is also treated separately from specification conformance.

### Current executable evidence

- Previous validation run #124: PASS, 343/343 tests, TypeScript PASS, Prisma validate PASS, protected-engine verification PASS.
- After this audit identified a provenance-boundary gap, the EBI input boundary was patched to invoke the canonical `validateProvenance()` contract.
- A regression test was added for DERIVED input requiring a non-empty formula version.
- A fresh CI result for the new commits is **not yet available** at audit time.

## 32-checkpoint assessment

| # | Checkpoint | Current assessment | Evidence / finding |
|---|---|---|---|
| 1 | Mathematical correctness | PASS/PARTIAL | CEI/CDQ/CFQ/PGQ/ENE/RGQ/BSQ primitives are executable; full independent audit remains distinct from unit tests. |
| 2 | ROCE/ROIC determinism | PASS/PARTIAL | CEI formulas and deterministic tests exist; fresh post-patch CI is pending. |
| 3 | NOPAT / Invested Capital | PASS | v1.3 financing-side IC and ETR fail-closed logic are implemented. |
| 4 | Zero / negative denominators | PASS | Applicable CEI/CFQ/PGQ denominator states are explicit. |
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
| 27 | Provenance / source conflicts | PASS/PARTIAL | Canonical provenance validator is now enforced at EBI input boundary; source conflict resolution remains outside this module. |
| 28 | Restatement handling | PARTIAL | Structural pairing is enforced; no full restatement lifecycle/version-selection engine is present. |
| 29 | No-fabrication | PASS/PARTIAL | Nulls are preserved and evidence-only contracts avoid invented scores; full evidence lifecycle remains outside this module. |
| 30 | Deterministic test adequacy | PENDING FRESH CI | Prior CI #124 passed 343/343 before the latest provenance patch; new post-patch CI must confirm the current head. |
| 31 | Output contract | PASS/PARTIAL | OEP fields and basic validation exist; no full presentation/orchestration engine is implemented. |
| 32 | Governance / lock criteria | OPEN | No lock certificate; current implementation has partial/contract-only surfaces and fresh post-patch CI is pending. |

## Audit finding

### EBI-IMPL-001 — Provenance validator was not enforced at the EBI input boundary

**Severity:** Medium

**Observed:** `backend/src/ebi/inputContract.ts` checked only selected classification/data-nature combinations and did not invoke the canonical provenance validator.

**Risk:** A structurally malformed provenance object could pass EBI input validation even though the repository's canonical provenance contract requires valid verification/data-nature values and requires a non-empty formula version for DERIVED data.

**Disposition:** PATCHED on this branch.

**Patch:** EBI input validation now invokes `validateProvenance(input.provenance)`.

**Regression:** Added a test requiring DERIVED input to provide a non-empty formula version.

**Post-patch verification:** Fresh CI pending.

## Governance conclusion

The current implementation is **not clean-lock-ready** from this implementation audit alone.

Reasons:
1. One implementation finding was identified and patched.
2. Fresh CI after that patch is pending.
3. Several checkpoints are explicitly partial or contract-only because this branch contains contracts/primitives rather than complete production orchestration for every EBI layer.
4. The project-owner-supplied Gemini result remains a methodology-audit result and does not substitute for implementation evidence.

**Current status: PATCHED — RE-AUDIT / FRESH CI REQUIRED; NOT LOCKED.**

A lock certificate must remain withheld until the current head passes executable validation and the remaining implementation/governance gaps are explicitly accepted or completed under the formal Chunk 5 lock process.
