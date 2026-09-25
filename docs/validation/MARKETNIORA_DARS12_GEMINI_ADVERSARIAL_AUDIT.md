# MarketNiora — DARS-1.2 Independent Gemini Adversarial Audit Package

Date: 2026-09-26

## Purpose

This package is for an independent adversarial review of the CURRENT repository state of DARS-1.2.

Repository: `abdul007amk-art/MarketNiora`

Primary files:
- `backend/src/dars12/dars12Engine.ts`
- `tests/dars12.test.ts`
- `docs/validation/MARKETNIORA_DARS12_REGRESSION_GATE.md`

Governance constraint:
- DARS-1.1 is frozen.
- Do not modify protected scoring engines.
- Do not infer PASS from documentation. Verify the current source and executable tests.

## Required DARS-1.2 sequence

Provider Health
→ Fetch
→ Raw Ingest
→ Identity Resolution
→ Validation
→ Data Diff
→ Canonical Write
→ Freshness
→ Coverage
→ Readiness
→ Evidence Refresh
→ Formula Recalculation
→ FWHY Diagnostics
→ Provenance/Audit
→ Health Report

Critical ordering invariant:
**Evidence Refresh MUST succeed before Formula Recalculation.**

## Adversarial audit questions

### A. Event identity and replay
1. Is `source_event_id` truly immutable event identity?
2. Can the same `source_event_id` with a changed payload overwrite prior canonical evidence?
3. Can duplicate IDs in the same input batch partially write before the conflict is surfaced?
4. Does the implementation distinguish harmless replay from conflicting replay?
5. Is duplicate detection merely reported, or does it enforce the intended governance behavior?

### B. Temporal integrity
Test:
- effective_time earlier/later than knowledge_time
- knowledge_time before sourceTimestamp
- knowledge_time after runKnowledgeTime
- two events for the same business fact with different knowledge times
- reconstruction at exact boundary timestamps
- future knowledge leakage
- correction/replacement semantics

Verify that:
- `effective_time` represents when information was true
- `knowledge_time` represents when MarketNiora knew/recorded it
- historical reconstruction uses knowledge_time as its cutoff
- no later knowledge leaks into an earlier reconstruction

### C. Evidence refresh and rollback
Adversarially force:
- refresh failure after canonical writes
- stale evidence
- partial refresh
- repeated failed refresh
- retry after failure

Verify:
- no formula execution after refresh failure
- prior canonical state is restored exactly
- no partial new evidence survives a failed transaction
- retry behavior is deterministic

### D. Formula/version integrity
Test:
- DERIVED evidence with missing formulaVersion
- DERIVED evidence with mismatched formulaVersion
- RAW/NORMALIZED evidence with non-null formulaVersion
- formula callback receives only valid/current evidence
- formula never runs on stale/blocked evidence

### E. Determinism
Run the same logical input:
- in different raw-event orders
- repeatedly
- with duplicate replay
- after rollback/retry

Verify identical:
- evidence ordering
- formula input ordering
- formula output
- stage ordering
- duplicate/conflict reporting

### F. OCE → Catalyst boundary
Verify that OCE evidence:
- requires CURRENT truth state
- requires VERIFIED status
- produces only a reviewable candidate
- cannot directly mutate catalyst state
- cannot mutate Stock Score
- cannot bypass review

Test negative cases for:
- UNVERIFIED
- SOURCE_REQUIRED
- STALE
- BLOCKED
- STANDARD-origin evidence

### G. DARS-1.1 isolation
Inspect imports and dependency direction.

Required:
- DARS-1.2 must not import protected rotation/score engines.
- Protected DARS-1.1/scoring engines must not import DARS-1.2.
- No indirect dependency may allow DARS-1.2 to alter protected engine behavior.
- No protected-file modifications.

### H. Precision
Adversarial decimal cases:
- 0.1 + 0.2
- large values
- negative values
- zero
- trailing zeros
- more fractional digits than supported precision

Determine whether truncation/rounding behavior is explicitly governed or merely incidental.

### I. Stage semantics
Do not treat a stage marker as a production implementation automatically.

Identify which stages are:
1. actual logic,
2. validation/orchestration,
3. placeholders/simulations.

In particular inspect whether Provider Health, Fetch, Raw Ingest, Evidence Refresh, FWHY Diagnostics, Provenance/Audit, and Health Report are fully implemented or only represented by stage events.

### J. Production-readiness gap
Identify gaps between an execution kernel/regression harness and a production DARS pipeline, including:
- real provider integration
- durable persistence
- transactional guarantees
- coverage semantics
- scheduler integration
- actual evidence refresh
- actual formula-engine integration
- audit persistence
- health-report persistence
- concurrency/race behavior

Do not mark these as bugs if they are explicitly out of scope; classify them as implementation gaps.

## Required executable adversarial tests

At minimum create/run tests for:
- conflicting same-source_event_id replay
- duplicate IDs inside one batch
- derived formulaVersion mismatch
- future knowledge_time
- exact knowledge_time reconstruction boundary
- rollback after partial canonical write
- stale evidence blocks formula
- OCE candidate negative cases
- deterministic replay after rollback
- protected-engine import isolation

## Acceptance criteria

Return exactly one of:
- PASS — only if all required invariants are verified with executable evidence.
- CONDITIONAL PASS — only if all mandatory invariants pass but clearly documented non-production gaps remain.
- FAIL — if any mandatory invariant is violated.

Do NOT claim PASS because the documentation says 12 tests passed. Execute the current repository test suite against the current source first.

For every finding provide:
- Severity: CRITICAL / HIGH / MEDIUM / LOW
- File
- Function/section
- Reproduction or test
- Observed behavior
- Required correction
- Whether DARS-1.1 is affected

## Important repository-state check

Before auditing, compare the current source of `backend/src/dars12/dars12Engine.ts` and `tests/dars12.test.ts` against the regression-gate document. If documentation claims a control that the current source does not implement, flag the documentation/source mismatch.

## Final report format

1. Executive result
2. Repository state verified
3. Test execution evidence
4. Adversarial findings
5. Temporal/bitemporal audit
6. Event identity/replay audit
7. Rollback/isolation audit
8. Formula/version audit
9. OCE/Catalyst boundary audit
10. DARS-1.1 isolation audit
11. Determinism/precision audit
12. Production-readiness gaps
13. Required patches, ordered by severity
14. Final PASS / CONDITIONAL PASS / FAIL

Never silently assume missing behavior.
