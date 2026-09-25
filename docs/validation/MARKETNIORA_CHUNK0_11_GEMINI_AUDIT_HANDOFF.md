# MarketNiora — Chunk 0–11 Gemini Independent Audit Handoff

Date: 2026-09-26

## Purpose

This document is the handoff package for an independent adversarial audit of the MarketNiora Chunk 0–11 architecture.

The audit must determine whether the CURRENT repository implementation matches the architecture and locked contracts established during the Chunk 0–11 development sequence.

**This is an AUDIT package, not a patch specification.**

**Do not modify code during the audit.**

## 1. Audit Source Hierarchy

Use sources in this order:
1. Current GitHub source code — implementation truth
2. Current executable tests — behavioral evidence
3. Explicitly LOCKED architecture/rule documents — design contract
4. Current validation/governance documentation
5. Historical handoff information — context only

If documentation conflicts with current source, report the conflict. Do not silently reconcile it.
If a historical Chunk requirement cannot be established from repository evidence, mark it **HISTORICAL EVIDENCE REQUIRED** rather than inventing it.

## 2. Core MarketNiora Architecture

**Rotation ≠ Theme ≠ Feature ≠ Score ≠ Decision**

These are separate responsibilities and must not silently contaminate one another.

Broader system areas include research/provenance, data ingestion and normalization, validation, DARS orchestration, protected scoring/rotation engines, database/persistence, frontend/backend contracts, governance and CI.

Audit the actual dependency graph rather than assuming the intended diagram is implemented.

## 3. Explicitly Locked Rules

The following rules are known locked contracts and must not be redesigned during the audit.

### Market Rotation hierarchy
**SECTOR → SUB-SECTOR → STOCK GROUP → STOCK**
 No additional hierarchy level is authorized inside the locked rotation model.

### Rotation calculation flow
**Stock raw observations → Stock Group Rotation → Sub-sector Rotation → Sector Rotation**

### Rotation Phase 2 v1.2
- Median Return: 40%
- Participation: 30%
- Equal-Weighted Capped Return: 20%
- IQR Consistency: 10%
- Caps: 1D=8%, 1W=12%, 1M=20%, 3M=30%
- Confidence: CONF_MIN=30, N_REF=20
- External-index breadth Nifty50/NSE/BSE = ZERO ROLE

### Theme hierarchy
**THEME → SUB-THEME → INDUSTRY → VALUE CHAIN → COMPANY → STOCK**

Theme classification must not silently become a Rotation input.

### Stock Master
Canonical discovery universe: **MASTER_4187**. The seed is immutable. Search/research must not mutate the Stock Master.

### Shariah display
- VERIFIED → show ✓
- NON-SHARIAH → show nothing
- PENDING → show nothing
Shariah status must not affect Rotation or Score.

### Stock Score SS-1.0-R3
- Momentum: 22%
- Relative Strength: 10%
- Trend Quality: 8%
- Volume Confirmation: 8%
- Earnings Momentum: 18%
- Business Quality: 16%
- Valuation: 10%
- Growth/Visibility: 8%

Formula: **StockScore = clamp(Base + RiskPenalty + CatBoost, 0, 100)**
RiskPenalty: -30 to 0. Catalyst Boost: 0 / +4 / +8 / +12.

Do not redesign these weights during audit.

## 4. Chunk 0–11 Audit Requirement

For EVERY Chunk 0 through 11 report:
- Intended responsibility
- Current implementation
- Relevant files
- Tests
- Locked contracts involved
- Complete / Partial / Missing
- Placeholder / simulation
- Dependencies
- Findings
- Risk

If original historical intent is not recoverable from repository evidence, state **HISTORICAL EVIDENCE REQUIRED**. Do not invent the missing Chunk definition.

## 5. Engine Isolation Audit

Verify dependency direction and data boundaries between Rotation Engine, Theme Engine, Feature Engine, Stock Score Engine, Decision Engine, Research Engine, Provenance/Governance and DARS.

Attempt to find paths where Theme changes Rotation; Rotation changes Score; Score changes Rotation; Research bypasses verification; DARS mutates protected scoring state; frontend duplicates backend scoring logic; or Decision logic bypasses Score/Feature contracts.

## 6. DARS Boundary

DARS-1.1 is frozen. Do not modify or recommend redesigning DARS-1.1 merely to simplify DARS-1.2.

Current DARS-1.2 areas requiring verification:
Provider Health → Fetch → Raw Ingest → Identity Resolution → Validation → Data Diff → Canonical Write → Freshness → Coverage → Readiness → Evidence Refresh → Formula Recalculation → FWHY Diagnostics → Provenance/Audit → Health Report

Critical invariant: **Evidence Refresh MUST succeed before Formula Recalculation.**

Also verify stale-evidence blocking, rollback, source_event_id replay/conflict behavior, effective_time/knowledge_time, formulaVersion consistency, deterministic output, OCE → reviewable Catalyst boundary, and protected-engine isolation.

Current implementation files:
- backend/src/dars12/dars12Engine.ts
- tests/dars12.test.ts

Current DARS regression contract:
- docs/validation/MARKETNIORA_DARS12_REGRESSION_GATE.md

Current DARS independent audit package:
- docs/validation/MARKETNIORA_DARS12_GEMINI_ADVERSARIAL_AUDIT.md

## 7. Research / Provenance Audit

Verify source → sourceTimestamp → effectiveTime → knowledgeTime → verificationStatus → dataNature → formulaVersion.

Verify AI discovery does not automatically become VERIFIED; verification requires the review gate; unverified evidence cannot silently enter protected scoring/rotation; provenance is retained through transformations; and derived data has valid formula metadata.

## 8. Pipeline Audit

Known pipeline structure:
**Immutable Raw Store → Normalize → Validate → Deduplicate → Conflict Resolution → Quality Check → Canonical DB → Job Log**

The repository documents quality check before canonical insert as a deliberate deviation. Audit whether actual implementation matches this flow.

## 9. Persistence / Production Readiness

Distinguish actual implementation from in-memory or simulated behavior.
Audit raw observation storage, canonical observation storage, authentication stores, DARS persistence, provider integration, scheduler integration, transaction semantics and concurrency behavior.

Do not call explicitly documented future implementation a defect; classify it as **DOCUMENTED GAP / FUTURE IMPLEMENTATION**.

## 10. Frontend / Backend Contract

Audit hardcoded KPIs, duplicated business calculations, fake/placeholder data, incorrect Stock Master assumptions, incorrect hierarchy, missing provenance, incorrect Shariah behavior and unsupported UI states.

## 11. CI / Regression

Inspect current CI configuration and actual workflow evidence. Do not infer successful CI from documentation.

Known validation workflow: .github/workflows/marketniora-validation.yml

It includes npm install, Prisma generate, typecheck, tests, Prisma validation and protected-file diff checks.

Protected files include:
- backend/src/protected/rotationEngine.ts
- backend/src/protected/stockScoreEngine.ts

Determine whether current CI genuinely enforces the architecture.

## 12. Adversarial Testing

Attempt duplicates, conflicting duplicates, missing fields, malformed values, empty datasets, extreme values, future knowledge_time, knowledge_time before sourceTimestamp, effective_time/knowledge_time mismatch, exact reconstruction boundaries, later knowledge leaking into earlier history, unverified evidence, SOURCE_REQUIRED evidence, invalid formulaVersion, unauthorized catalyst paths, protected-engine import paths, partial failure, rollback, retry, repeated replay, reordered input and nondeterministic behavior.

## 13. Finding Classification

Every finding must be exactly one of:
- **A. ACTUAL DEFECT** — current implementation violates an established contract.
- **B. ARCHITECTURAL INCONSISTENCY** — components contradict intended architecture.
- **C. MISSING IMPLEMENTATION** — required component is absent.
- **D. DOCUMENTED GAP** — known future work explicitly acknowledged.
- **E. AUDIT UNCERTAINTY** — evidence is insufficient to establish historical requirement.

Do not convert category D or E into a false defect.

## 14. Required Finding Format

For every material finding provide:
- Severity: CRITICAL / HIGH / MEDIUM / LOW
- Category: A / B / C / D / E
- Chunk: 0–11 or CROSS-CHUNK
- File
- Function / Section
- Evidence
- Observed behavior
- Expected behavior
- Impact
- Required correction
- Touches a LOCKED rule? YES / NO
- Touches DARS-1.1? YES / NO

## 15. Final Audit Report

Return:
1. Executive result
2. Repository state verified
3. Chunk 0–11 audit table
4. Locked-rule compliance matrix
5. Engine isolation audit
6. Data-flow audit
7. Research/provenance audit
8. DARS audit
9. Persistence/production-readiness audit
10. Frontend/backend contract audit
11. CI/test audit
12. Adversarial findings
13. Documented gaps vs actual defects
14. Required patch plan
15. Final status

Final status must be exactly one: **PASS / CONDITIONAL PASS / FAIL**.

Do not award PASS merely because tests pass or documentation says something is complete. Use current source code and executable evidence as primary implementation truth.

## 16. Critical Audit Rule

This is an INDEPENDENT AUDIT.

Do not modify code, rewrite locked architecture, silently fix findings, assume missing historical information, or declare PASS without evidence.

First identify problems. Then report the minimum required corrective action. Findings will be independently verified before any patch is made.

## Current known state

The repository contains a DARS-1.2 implementation and regression suite, but repository CI verification is not currently established by the available workflow evidence.

Therefore the audit must independently verify current source and obtain real test evidence before making a PASS determination.

**DARS-1.1 remains frozen throughout this process.**