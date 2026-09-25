# MarketNiora — CHUNK 5 EBI v1.3 Source-Conformance Audit

## Scope
Authoritative source reviewed:
`MarketNiora_CHUNK_5_EBI_v1.3_Fourth_ReAudit_Package.pdf`

This review is a source-conformance/pre-lock gate. It is **not** a Gemini result and does not create a lock certificate.

## Findings

### C5-AUD-001 — Fourth independent re-audit result is absent
**Severity:** MAJOR / lock-blocking  
**Evidence:** The v1.3 package explicitly says "PATCHED — NOT LOCKED" and contains the fourth Gemini re-audit prompt, but no completed fourth-audit findings/result. The package still instructs the auditor to perform the complete Parts 1–18 audit.

**Effect:** The previous EBI-HIGH-001 patch is documented, but there is no independent evidence that the patch passed the required full regression audit.

**Required action:** Obtain/perform the fourth independent audit against the v1.3 package itself. Record all 32 checkpoint results and final counts.

### C5-AUD-002 — Mandatory test execution evidence is absent from the source package
**Severity:** MAJOR / lock-blocking  
**Evidence:** Part 17 defines CEI-ROIC-006..012 and the broader deterministic suite, while Part 18 requires all mandatory tests/checkpoints to pass. The package does not contain executable test output or a verified CI/test-run record.

**Effect:** Test definitions cannot be treated as test execution evidence.

**Required action:** Execute the mandatory deterministic suite and preserve the real result. A lock certificate must not state PASS without execution evidence.

### C5-AUD-003 — Lock certificate must remain withheld
**Severity:** GOVERNANCE / lock-blocking  
**Evidence:** Part 18 requires CRITICAL=0, HIGH=0, MEDIUM=0, LOW=0 and all mandatory tests/checkpoints passing. The package itself says CHUNK 5 must not be automatically locked and requires user confirmation after a clean audit.

**Decision:** CHUNK 5 remains NOT LOCKED pending the missing independent audit and executable regression evidence.

## Confirmed v1.3 correction
The source package does contain the corrected financing-side Invested Capital definition:

- Total Debt = Short-Term Interest-Bearing Debt + Long-Term Interest-Bearing Debt
- Invested Capital = Total Debt + Total Equity − Cash & Marketable Securities
- Operating liabilities are not subtracted in the canonical IC formula.

The package also defines CEI-ROIC-006..012 to regression-test this correction and the associated edge cases.

## No silent methodology changes
This audit does not alter:
- CHUNK 0 foundation
- CHUNK 1 RMD-1.2
- CHUNK 2 Market Rotation v1.3
- CHUNK 3 TIE-1.2
- CHUNK 4 RSE/DCS v1.1
- any CHUNK 5 formula, threshold, dependency, or authority rule.

## Current gate
**CHUNK 5: NOT LOCKED**

Required next sequence:
1. Independent full Parts 1–18 audit.
2. Execute/verify all mandatory deterministic tests.
3. Patch any actual findings.
4. Re-audit patched areas and full-chunk independence.
5. Record formal lock certificate only after clean evidence.


## Repository implementation audit — 2026-09-26

This section is a **repository implementation audit**, not an external/Gemini audit. It checks whether the v1.3 specification has corresponding executable implementation and test artifacts in the current `main` codebase.

### Implementation finding

#### C5-IMPL-001 — CHUNK 5 EBI v1.3 production calculation engine is not present in the repository
**Severity:** MAJOR / lock-blocking

Repository search was performed for:
- `EBI`
- `CEI-ROIC`
- `Invested Capital`
- `EBI_COVERAGE_MIN`
- `EBI-INPUT-1.0`
- `DDE-1.0`
- `EBI-TEST-1.3`

No repository matches were returned.

The repository does contain `backend/src/contracts/fundamental.ts`, but that file is a **Module 10 fundamental data contract/validation layer**. It explicitly does not implement a Fundamental Score formula and only validates generic fundamental records. It is not an implementation of the v1.3 Parts 1–18 EBI engines (DDE, ENE, RGQ, PGQ, CFQ, BSQ, CEI, BNI, CPI, GVI, ECI, BERI, CDQ, IIC, OEP).

**Effect:** The v1.3 package currently exists as an authoritative specification/audit package, while the repository does not provide executable CHUNK 5 EBI implementations against which the CEI/CDQ and 32-checkpoint regression can be executed.

**Required action:** Do not manufacture a PASS result from the specification. Either:
1. connect the actual CHUNK 5 implementation if it exists outside the repository, or
2. implement CHUNK 5 from the v1.3 authority package before claiming executable regression/lock readiness.

### 32-checkpoint repository evidence matrix

| # | Checkpoint | Repository status | Evidence / disposition |
|---:|---|---|---|
| 1 | Mathematical correctness | NOT IMPLEMENTED | No EBI calculation engine found |
| 2 | ROCE/ROIC determinism | NOT IMPLEMENTED | No CEI engine/tests found |
| 3 | NOPAT & Invested Capital definitions | NOT IMPLEMENTED | v1.3 specifies them; no executable implementation found |
| 4 | Zero/negative denominator handling | NOT IMPLEMENTED | No CEI engine/tests found |
| 5 | Period consistency | NOT IMPLEMENTED | No EBI period-validation engine found |
| 6 | Missing-data behavior | PARTIAL / NOT EBI-VERIFIED | Generic fundamental contract has fail-closed status handling, but not v1.3 EBI calculations |
| 7 | Truth-state compatibility | PARTIAL / NOT EBI-VERIFIED | Generic provenance/freshness contracts exist; no EBI truth-state engine found |
| 8 | Coverage denominator integrity | NOT IMPLEMENTED | CDQ implementation not found |
| 9 | 40% coverage behavior | NOT IMPLEMENTED | `EBI_COVERAGE_MIN` not found |
| 10 | CoverageGate TRUE/FALSE behavior | NOT IMPLEMENTED | CDQ implementation/tests not found |
| 11 | No automatic weight redistribution | SPECIFICATION ONLY | v1.3 rule exists; no EBI engine implementation to verify |
| 12 | ENE/RGQ/PGQ overlap | NOT IMPLEMENTED | EBI sub-engines not found |
| 13 | CFQ/BSQ/CEI overlap | NOT IMPLEMENTED | EBI sub-engines not found |
| 14 | BNI/CPI separation | NOT IMPLEMENTED | BNI/CPI engines not found |
| 15 | GVI/ECI separation | NOT IMPLEMENTED | GVI/ECI engines not found |
| 16 | BERI independence | NOT IMPLEMENTED | BERI engine not found |
| 17 | CDQ independence | NOT IMPLEMENTED | CDQ engine not found |
| 18 | Rotation independence | PARTIAL / NOT EBI-VERIFIED | Existing locked rotation engine is separate; no EBI integration boundary exists to test |
| 19 | TIE independence | PARTIAL / NOT EBI-VERIFIED | No EBI integration boundary exists to test |
| 20 | RSE/DCS independence | PARTIAL / NOT EBI-VERIFIED | No EBI integration boundary exists to test |
| 21 | OCE independence | PARTIAL / NOT EBI-VERIFIED | No EBI integration boundary exists to test |
| 22 | Theme independence | PARTIAL / NOT EBI-VERIFIED | Existing theme contracts are separate; no EBI integration boundary exists to test |
| 23 | Shariah independence | PARTIAL / NOT EBI-VERIFIED | No EBI integration boundary exists to test |
| 24 | Stock Score independence | PARTIAL / NOT EBI-VERIFIED | Locked score engine is separate; no EBI integration boundary exists to test |
| 25 | Version-pinned integration | PARTIAL | Shared provenance supports formulaVersion, but no EBI integration implementation found |
| 26 | Circular dependency prevention | NOT IMPLEMENTED | No EBI dependency graph/guard found |
| 27 | Provenance/source conflicts | PARTIAL | Shared provenance validation exists; EBI-specific conflict handling not found |
| 28 | Restatement handling | NOT IMPLEMENTED | No EBI restatement implementation found |
| 29 | No-fabrication | PARTIAL | Generic fundamental contract rejects unusable data; EBI-specific no-fabrication tests are absent |
| 30 | Deterministic test adequacy | NOT IMPLEMENTED | No EBI-TEST-1.3 suite found |
| 31 | Output contract | SPECIFICATION ONLY | OEP contract is in v1.3 package; no EBI output implementation found |
| 32 | Governance/lock criteria | DOCUMENTED ONLY | v1.3 lock criteria exist; execution evidence and independent audit are absent |

### Important separation

The existing `backend/src/contracts/fundamental.ts` must **not** be treated as CHUNK 5 completion. It is a narrower Module 10 contract and its own tests explicitly preserve the scope boundary against scoring/verdict computation.

Likewise, the existing locked Rotation and Stock Score engines remain outside this audit and are not modified.

### Current decision after repository audit

**CHUNK 5: NOT READY / NOT LOCKED**

This is a stronger evidence state than the earlier source-only gate: the authoritative v1.3 package is present, but the repository currently lacks the executable CHUNK 5 EBI engine/test surface required to perform the claimed 32-checkpoint regression.

**Next technical step:** establish the actual CHUNK 5 implementation surface from the v1.3 authority before attempting a lock audit. No Gemini execution, test PASS, or lock certificate is claimed by this document.


## Implementation progress — CEI/CDQ core added

The branch now contains a deliberately narrow executable implementation of the unambiguous v1.3 CEI and CDQ rules:

- `backend/src/ebi/cei.ts`
  - ROE
  - ROCE
  - NOPAT
  - financing-side Invested Capital
  - Total Debt including short-term and long-term interest-bearing debt
  - Average Invested Capital
  - ROIC
  - missing-input fail-closed behavior
  - zero/negative capital handling
  - ETR outside [0,1] handling without clamping
- `backend/src/ebi/cdq.ts`
  - `EBI_COVERAGE_MIN = 40.0%`
  - exact v1.3 mandatory-engine registry
  - coverage calculation
  - CoverageGate TRUE/FALSE behavior
  - missing requirement denominator → REVIEW/CONFLICT
- `tests/chunk5-cei-cdq.test.ts`
  - CEI-ROIC-006 through CEI-ROIC-012
  - ETR boundaries
  - ROCE definition
  - CDQ 40% gate and registry

This is **implementation progress, not lock evidence**. The source package's remaining EBI engines and integration/output contracts are not yet implemented, and repository test execution has not been claimed or verified.

### Updated decision

**CHUNK 5: NOT READY / NOT LOCKED**

The correct next implementation sequence is to add the remaining v1.3-defined EBI surfaces only where the authoritative package supplies sufficient normative rules, then run the complete executable test suite. Where the package does not define enough detail for an implementation without invention, the item must remain explicitly open rather than being filled by assumption.


## Further implementation progress — explicit v1.3 CFQ/PGQ/evidence layers

Additional executable surfaces have now been added where the v1.3 package supplies explicit deterministic behavior:

- CFQ: CFO/PAT classification and FCF = CFO − Capex.
- PGQ: margin primitive, denominator handling, negative-base classification, and negative-to-positive TURNAROUND EVENT.
- Evidence-only contracts for DDE, BNI, CPI, GVI, ECI and BERI preserve the source package's categorical/evidence vocabulary without inventing scores or automatic conclusions.

The implementation intentionally does **not** invent unspecified scoring formulas, confidence mappings, severity mappings, or lifecycle transition rules.

### Current repository test state

A GitHub Actions **MarketNiora Validation** run has been created for the latest implementation commit. At the time of this audit update it is **QUEUED**, so no PASS/FAIL conclusion is recorded yet.

**No lock decision is changed:** CHUNK 5 remains **NOT READY / NOT LOCKED** until the complete implementation surface, full regression, independence checks, and independent fourth audit evidence are complete.


## Further implementation progress — ENE/RGQ/BSQ

Added explicit v1.3-supported primitives:

- ENE: earnings-growth classification and acceleration as current growth minus prior growth in percentage points.
- RGQ: revenue-growth primitive plus evidence fields that keep organic/inorganic, volume/realisation support, concentration, recurring quality and persistence separate.
- BSQ: D/E and net-debt primitives with fail-closed missing/zero handling.

No final EBI score, automatic qualitative verdict, or fabricated evidence was introduced.
