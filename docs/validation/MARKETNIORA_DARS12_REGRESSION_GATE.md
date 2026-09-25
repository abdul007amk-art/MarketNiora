# MarketNiora — DARS-1.2 Regression Gate

Status: IMPLEMENTED / REGRESSION EXECUTION PENDING REPOSITORY CI
Date: 2026-09-26

## Governance boundary

DARS-1.1 is frozen and must remain untouched.

DARS-1.2 sequence:

Provider Health
-> Fetch
-> Raw Ingest
-> Identity Resolution
-> Validation
-> Data Diff
-> Canonical Write
-> Freshness
-> Coverage
-> Readiness
-> Evidence Refresh
-> Formula Recalculation
-> FWHY Diagnostics
-> Provenance/Audit
-> Health Report

Evidence Refresh MUST complete before Formula Recalculation.

No DARS-1.2 PASS, LOCK READY, or certificate may be claimed until the mandatory regression suite has executed successfully in the repository validation environment.

## Executable implementation

Implemented in:
- `backend/src/dars12/dars12Engine.ts`
- `tests/dars12.test.ts`

The kernel provides:
- explicit ordered stage events
- stale-evidence blocking
- transactional rollback on refresh failure
- source_event_id/versioned evidence deduplication
- bitemporal knowledge-time reconstruction
- provenance retention
- deterministic evidence ordering
- fixed-point decimal aggregation
- OCE -> reviewable catalyst-candidate boundary without direct score/catalyst mutation
- no imports into or from protected DARS-1.1/scoring engine files

## Mandatory regression tests

### DARS12-001 — Evidence Refresh -> Formula ordering
Executable test verifies that Formula Recalculation starts only after successful Evidence Refresh.

### DARS12-002 — Stale-evidence guard
Executable test verifies stale current evidence blocks formula recalculation.

### DARS12-003 — Refresh-failure isolation
Executable test verifies failed Evidence Refresh prevents formula execution and restores the prior canonical state.

### DARS12-004 — Idempotency / duplicate prevention
Executable test verifies replay does not create duplicate evidence and produces the same formula output.

### DARS12-005 — DARS-1.1 / DARS-1.2 isolation
Executable structural test verifies DARS-1.2 does not import protected engines and protected engines do not import DARS-1.2.

### DARS12-006 — Point-in-time historical reconstruction
Executable test verifies knowledge_time cutoff prevents later knowledge from leaking into an earlier reconstruction while effective_time remains preserved.

### DARS12-007 — Evidence/event provenance
Executable test verifies source, source_event_id, source timestamp, effective_time, knowledge_time, verification status, data nature, and formula metadata fields are retained.

### DARS12-008 — Deterministic output
Executable test verifies identical state/input ordering produces identical formula output and canonical evidence ordering.

## Additional controls implemented/tested

- fixed-point decimal precision
- truth-state CURRENT / STALE / BLOCKED handling
- OCE -> Catalyst review boundary
- deterministic stage/event ordering
- provenance completeness for the implemented evidence contract

The exact D12-001 through D12-009 domain specifications are not present in the repository, so this implementation does not claim unverified domain behavior beyond the controls explicitly defined by the DARS-1.2 regression contract.

## Verification status

The new regression test file was executed against the exact implementation in an isolated Node 22 type-stripping environment:
- 10 tests
- 10 passed
- 0 failed

The repository's GitHub workflow wrapper currently exposes pull-request-triggered workflow runs only; no PR-triggered run is available for the direct main-branch commits. Therefore the repository CI result is still unverified.

## Lock rule

Only after the executable DARS-1.2 implementation and mandatory regression suite pass in the repository validation environment may the status advance:

SPECIFIED
-> IMPLEMENTED
-> REGRESSION PASS
-> INDEPENDENT AUDIT
-> LOCK READY
-> FORMAL LOCK

DARS-1.1 remains immutable throughout.
