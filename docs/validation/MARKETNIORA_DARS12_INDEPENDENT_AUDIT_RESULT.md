# MarketNiora — DARS-1.2 Independent Adversarial Audit Result

Date: 2026-09-27
Repository: `abdul007amk-art/MarketNiora`
Audited HEAD: `aac91ccf967ccc95525f97004925a7e1e36e4032`
CI: GitHub Actions Run #224 — successful

## 1. Executive result

**CONDITIONAL PASS — LOCK READY for the DARS-1.2 execution kernel.**

The mandatory DARS-1.2 invariants were verified against the current source with executable repository tests. The current CI run reports **313 tests, 313 pass, 0 fail**.

This is **not a production-pipeline certification**. Provider integration, durable DARS persistence, real evidence-refresh orchestration, audit persistence, and health-report persistence remain implementation gaps in the current execution kernel. Those are classified as non-blocking production-readiness gaps, not silently treated as implemented behavior.

**Formal LOCK is not applied by this audit result.** The result advances the state to **LOCK READY**.

## 2. Repository state verified

DARS implementation:
- `backend/src/dars12/dars12Engine.ts`
- `tests/dars12.test.ts`
- `tests/dars12.adversarial.test.ts`

Protected engines:
- `backend/src/protected/rotationEngine.ts`
- `backend/src/protected/stockScoreEngine.ts`

The comparison from `ab0595ffff04c7877987103b4d1344af1553f492` to audited HEAD changed only DARS engine/tests. No protected Rotation or Stock Score file was changed.

## 3. Test execution evidence

CI Run #224:
- Typecheck: PASS
- Test suite: **313/313 PASS**
- Prisma generate: PASS
- Prisma validate: PASS
- Protected-engine unchanged check: PASS
- Git state summary: PASS

DARS-specific adversarial additions:
- future knowledge-time rejection
- exact knowledge-time boundary
- identical duplicate event in one batch
- rollback + deterministic retry
- OCE negative boundary cases
- formula callback receives current evidence only

## 4. Severity / independence counts

| Category | Count | Result |
|---|---:|---|
| CRITICAL | 0 | None |
| HIGH | 0 | None |
| MEDIUM | 0 | None |
| LOW | 0 | None |
| Independence/open production gaps | 5 | Documented, non-blocking for kernel lock |

## 5. Stage-by-stage findings

| Stage | Finding |
|---|---|
| Provider Health | Implemented as a provider-health gate; failed health blocks all later stages. |
| Fetch | Stage orchestration marker only; real provider fetch is not wired in this kernel. |
| Raw Ingest | Stage orchestration marker only; real provider ingestion is outside current kernel scope. |
| Identity Resolution | Required sourceEventId/source/symbol fields are enforced. |
| Validation | Temporal, data-nature, and formula-version constraints enforced. |
| Data Diff | Conflicting duplicate source_event_id values are rejected before canonical write. |
| Canonical Write | Evidence is stored with stable source+symbol fact identity and knowledge-time versions. |
| Freshness | Stale current evidence blocks formula execution. |
| Coverage | Expected coverage gate is enforced when configured. |
| Readiness | Current implementation records successful readiness; deeper production readiness orchestration is not wired. |
| Evidence Refresh | Explicit success gate; failed refresh restores prior canonical snapshot. |
| Formula Recalculation | Receives current as-of evidence only and is blocked by stale/failed prerequisites. |
| FWHY Diagnostics | Stage marker only; no external FWHY engine integration in this kernel. |
| Provenance/Audit | Evidence provenance fields are retained; durable audit persistence is not wired. |
| Health Report | Stage marker only; persistent health-report delivery is not wired. |

## 6. Temporal / bitemporal audit

Verified:
- future knowledge_time is rejected.
- knowledge_time before sourceTimestamp is rejected.
- knowledge_time after runKnowledgeTime is rejected.
- reconstruction uses knowledge_time cutoff.
- exact cutoff is inclusive.
- later knowledge does not leak into earlier reconstruction.
- effectiveTime remains retained independently of knowledgeTime.

Source evidence:
- `backend/src/dars12/dars12Engine.ts:39` stable fact key.
- `backend/src/dars12/dars12Engine.ts:79-88` as-of reconstruction.
- `backend/src/dars12/dars12Engine.ts:129-136` temporal validation.
- `tests/dars12.adversarial.test.ts:7-21` executable future/boundary tests.

Open domain item: explicit business semantics for restatements/corrections beyond the implemented knowledge-time versioning model are not specified in the repository. No invented rule was added.

## 7. Event identity / replay audit

Verified:
- exact replay is idempotent.
- conflicting replay cannot overwrite canonical evidence.
- conflicting duplicate IDs within one batch fail before write.
- identical duplicate IDs in one batch collapse to one canonical event.
- duplicate handling is deterministic.

Source evidence:
- `backend/src/dars12/dars12Engine.ts:63-77`.
- `backend/src/dars12/dars12Engine.ts:150-173`.
- `tests/dars12.test.ts` DARS12-004 and adversarial conflict tests.
- `tests/dars12.adversarial.test.ts:24-30`.

## 8. Rollback / failure isolation

Verified:
- failed Evidence Refresh restores the exact pre-run snapshot.
- no partial canonical evidence survives the failed run.
- a valid retry after rollback produces deterministic output.

Source evidence:
- `backend/src/dars12/dars12Engine.ts:197-204`.
- `tests/dars12.test.ts` DARS12-003.
- `tests/dars12.adversarial.test.ts:32-41`.

## 9. Formula / version audit

Verified:
- DERIVED evidence requires formulaVersion.
- DERIVED formulaVersion must match the run formulaVersion.
- RAW/NORMALIZED evidence cannot carry a formulaVersion.
- formula execution is blocked on stale/failed prerequisites.
- formula receives the current canonical as-of evidence set.

Source evidence:
- `backend/src/dars12/dars12Engine.ts:127-136`.
- `backend/src/dars12/dars12Engine.ts:206-214`.
- `tests/dars12.test.ts` DARS12-002 and DARS12-006.
- `tests/dars12.adversarial.test.ts:55-63`.

## 10. OCE / Catalyst boundary

Verified:
- only OCE-origin evidence qualifies.
- evidence must be CURRENT and VERIFIED.
- output is only a reviewable candidate with `requiresReview:true`.
- no catalyst or Stock Score mutation exists in the boundary function.
- negative cases for UNVERIFIED, SOURCE_REQUIRED, STALE, BLOCKED, and STANDARD-origin evidence return null.

Source evidence:
- `backend/src/dars12/dars12Engine.ts:228-231`.
- `tests/dars12.test.ts` OCE boundary test.
- `tests/dars12.adversarial.test.ts:44-53`.

## 11. DARS-1.1 isolation

Verified:
- DARS-1.2 has no imports into protected engines.
- protected Rotation and Stock Score engines have no DARS-1.2 imports.
- CI protected-file verification passed.
- comparison from the pre-DARS baseline to audited HEAD contains only DARS engine/test files.

Protected files:
- `backend/src/protected/rotationEngine.ts`
- `backend/src/protected/stockScoreEngine.ts`

## 12. Determinism / precision

Verified:
- evidence ordering is deterministic.
- input event order does not alter the tested formula output.
- duplicate handling is deterministic.
- fixed-point decimal arithmetic is used for the explicit DARS aggregation helper.
- rollback/retry is deterministic.

Open domain item:
- values beyond the helper's six fractional digits are truncated by the current implementation. The repository does not define whether this should be truncation, rounding, or rejection. This remains a specification item, not an invented change.

## 13. Required hardening patches

| Patch | Audit result |
|---|---|
| Stable fact identity using source + symbol | ACCEPTED; required for point-in-time reconstruction |
| Immutable source_event_id replay protection | ACCEPTED |
| Conflicting duplicate batch rejection | ACCEPTED |
| DERIVED formulaVersion consistency | ACCEPTED |
| Regression tests aligned with immutable event identity | ACCEPTED |
| Additional adversarial temporal/boundary/OCE/rollback tests | ACCEPTED |

No protected-engine changes were introduced.

## 14. Production-readiness gaps

These are explicitly **not claimed as implemented**:
1. Real provider fetch integration.
2. Durable DARS evidence persistence/transaction boundary.
3. Production scheduler/job orchestration.
4. Real FWHY diagnostics integration.
5. Durable provenance/audit and health-report persistence.

These gaps do not invalidate the execution-kernel regression result, but they must be closed before a claim of full production DARS pipeline readiness.

## 15. Final state

**DARS-1.2 execution kernel: CONDITIONAL PASS**

**DARS-1.2 status: LOCK READY**

**Formal LOCK: NOT APPLIED**

DARS-1.1 remains frozen.
