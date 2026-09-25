# MARKETNIORA — DARS-1.2 INDEPENDENT ADVERSARIAL AUDIT PACKAGE

## Status
DARS-1.2 is implemented and hardened, but not lock-ready. Do not claim regression PASS until executable CI evidence exists.

## Current implementation under audit
- `backend/src/dars12/dars12Engine.ts`
- `tests/dars12.test.ts`
- `docs/validation/MARKETNIORA_DARS12_REGRESSION_GATE.md`

## Current hardening patches
1. `source_event_id` is immutable event identity.
2. Exact replay is idempotent and cannot create a second canonical row.
3. Conflicting replay for the same `source_event_id` is rejected.
4. Conflicting duplicate `source_event_id` values within one input batch are rejected before canonical write.
5. DERIVED evidence requires a non-null `formulaVersion`.
6. DERIVED `formulaVersion` must equal the run `formulaVersion`.
7. Conflicting replay and batch-conflict paths must not mutate canonical state.
8. Regression suite contains 13 DARS tests.

## Mandatory adversarial audit
Audit the actual current repository, not this document alone.

### A. Temporal / bitemporal integrity
- knowledge_time may not exceed run knowledge time.
- knowledge_time may not precede source timestamp.
- effective_time and knowledge_time must remain distinct.
- later knowledge must not rewrite an earlier point-in-time reconstruction.
- information known before an as-of snapshot must be eligible for that snapshot.
- restatements/corrections must have deterministic semantics.

### B. Event identity
- same source_event_id + identical payload => idempotent.
- same source_event_id + conflicting payload => hard reject.
- duplicate IDs in the same batch with conflicting payload => hard reject before write.
- duplicate IDs in the same batch with identical payload => deterministic single canonical event.
- no hidden alternate identity may bypass source_event_id protection.

### C. Stage ordering
Required sequence:
Provider Health → Fetch → Raw Ingest → Identity Resolution → Validation → Data Diff → Canonical Write → Freshness → Coverage → Readiness → Evidence Refresh → Formula Recalculation → FWHY Diagnostics → Provenance/Audit → Health Report.

Verify formula execution is impossible after failed Evidence Refresh, stale evidence, failed validation, failed coverage, or blocked identity/data-diff checks.

### D. Rollback / failure isolation
- canonical state must be restored when evidence refresh fails.
- failed runs must not partially mutate canonical evidence.
- a subsequent valid run must be deterministic and independent of failed-run residue.

### E. Provenance
Every evidence item must preserve:
source, sourceTimestamp, verificationStatus, dataNature, formulaVersion.
DERIVED formula version must match the run version.
Historical reconstruction must retain knowledge-time semantics.

### F. Determinism / precision
- same input + same methodology version + same configuration = same output.
- evidence ordering must not affect formula output.
- fixed-point decimal behavior must not introduce binary floating-point authority.
- no hidden nondeterministic Map/object iteration dependency.
- duplicate handling must be deterministic.

### G. OCE / Catalyst boundary
- OCE raw factual evidence may produce a reviewable candidate only when explicitly qualified.
- OCE aggregate score/rank/confidence/index must never become Catalyst input.
- DARS must not mutate Stock Score or Catalyst state.
- Catalyst remains reviewable/approval-gated.

### H. DARS-1.1 isolation
- no import into protected DARS-1.1/scoring engines.
- no modification of protected Rotation or Stock Score engines.
- DARS-1.2 remains orchestration/governance layer.

## Required output
Return:
1. Executive verdict: LOCK READY / NOT READY / READY WITH NON-BLOCKING MINOR ITEMS.
2. CRITICAL / MAJOR / MINOR / INDEPENDENCE counts.
3. Stage-by-stage findings.
4. Finding IDs with exact file/function/line evidence.
5. Patch acceptance/rejection for every hardening change.
6. Temporal/bitemporal audit.
7. Event identity/deduplication audit.
8. Rollback audit.
9. Determinism/precision audit.
10. Provenance audit.
11. OCE/Catalyst independence audit.
12. DARS-1.1 isolation audit.
13. Mandatory tests passed/missing.
14. Exact remaining changes, if any.
15. Final lock readiness.

## Auditor rules
- Do not invent thresholds.
- Do not silently modify locked architecture.
- Do not treat documentation as proof of executable behavior.
- Do not call a test PASS unless it was actually executed.
- Do not claim CI PASS without a real workflow result.
- If a domain rule is underspecified, mark it as an explicit open item rather than guessing.
- DARS-1.1 remains frozen.
