# MarketNiora — DARS-1.2 Regression Gate

Status: SPECIFICATION / REGRESSION GATE PENDING EXECUTION
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

No DARS-1.2 PASS, LOCK READY, or certificate may be claimed until the mandatory regression suite has executed successfully.

## Mandatory regression tests

### DARS12-001 — Evidence Refresh -> Formula ordering
Verify that a formula recalculation cannot execute against stale evidence and that the scheduler records Evidence Refresh completion before Formula Recalculation begins.

Required controls:
- explicit stage/event ordering
- no formula recalculation before successful evidence refresh
- ordering remains true on repeated runs

### DARS12-002 — Stale-evidence guard
Provide stale evidence and attempt recalculation.

Expected:
- stale evidence is detected
- recalculation is blocked or deferred
- stale evidence is never silently treated as current

### DARS12-003 — Refresh-failure isolation
Force Evidence Refresh failure.

Expected:
- Formula Recalculation does not run from stale evidence
- the failed refresh is isolated and observable
- prior valid state is not silently overwritten by failed refresh output
- downstream health/readiness state reflects the failure

### DARS12-004 — Idempotency / duplicate prevention
Replay the same refresh/event input.

Expected:
- duplicate processing does not create duplicate canonical events/evidence
- source_event_id is the deduplication identity where applicable
- repeated identical input produces the same canonical state

### DARS12-005 — DARS-1.1 / DARS-1.2 isolation
Verify that DARS-1.2 code paths do not import, mutate, or alter DARS-1.1 behavior.

Required:
- no DARS-1.2 write path into frozen DARS-1.1 implementation
- version-specific data/state remains isolated
- existing DARS-1.1 tests remain unchanged and passing

### DARS12-006 — Point-in-time historical reconstruction
Verify bitemporal reconstruction using:
- effective_time = when the information was true
- knowledge_time = when MarketNiora knew/recorded it

Expected:
- historical state is reconstructed using the correct knowledge cutoff
- later knowledge cannot leak backward into an earlier point-in-time view
- effective_time and knowledge_time are independently preserved

### DARS12-007 — Evidence/event provenance
Verify that every refreshed evidence/event record retains sufficient provenance to trace:
- source
- source_event_id where applicable
- source timestamp
- effective_time where applicable
- knowledge_time where applicable
- verification status
- data nature
- formula/version metadata where derived

Also verify source_event_id deduplication.

### DARS12-008 — Deterministic output
Run the same DARS-1.2 input/state more than once.

Expected:
- canonical output is deterministic
- event/evidence ordering is deterministic
- no nondeterministic score/formula result is introduced by execution order
- duplicate replay does not change the final canonical state

## Additional DARS-1.2 functional controls

The regression gate must also explicitly verify:

- D12-001 through D12-009 functional requirements
- scheduler ordering
- source_event_id event deduplication
- truth-state cascade
- OCE -> Catalyst boundary
- bitemporal effective_time / knowledge_time behavior
- DECIMAL / NUMERIC precision where applicable
- deterministic output
- provenance completeness

## Current repository observation

At the time this gate was prepared, the repository contains pipeline, provenance, research-event, and protected-engine implementations, but no dedicated executable DARS-1.2 implementation or DARS12-001..008 test suite was found.

Therefore this document is a regression contract, not a PASS certificate.

## Lock rule

Only after executable DARS-1.2 implementation exists and all mandatory regression tests pass may the status advance:

SPECIFIED
-> IMPLEMENTED
-> REGRESSION PASS
-> INDEPENDENT AUDIT
-> LOCK READY
-> FORMAL LOCK

DARS-1.1 remains immutable throughout.
