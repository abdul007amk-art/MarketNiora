# MARKETNIORA
# MASTER PRODUCT BLUEPRINT v1.1

**Zero-to-Production AI Handover • Single Source of Truth • Product + Architecture + Governance**

| Field | Value |
|---|---|
| Document | MARKETNIORA MASTER PRODUCT BLUEPRINT v1.1 |
| Document status | **OWNER_APPROVED** |
| Authority | **Authoritative reference for MarketNiora** |
| Supersedes | Blueprint v1.0 as product/governance source-of-truth; Master Guide is archived by ODR-2026-002 |
| ODR basis | ODR-2026-001 and ODR-2026-002 |
| Scope | Product identity, architecture, intelligence layers, security, governance, data, workflows, implementation gates |
| Locked-math impact | **NONE beyond the explicitly recorded ODR clarifications** |

> **Important:** This document defines what MarketNiora must be. It does not convert implementation claims into runtime truth. Specification, Implementation and Runtime remain separate states.

---

## 0. HOW THIS FILE MUST BE USED

This document is the primary product and architecture handover for MarketNiora.

The build AI MUST:

- treat this Blueprint as the current source-of-truth;
- preserve OWNER_APPROVED + LOCKED rules exactly;
- use an Owner Decision Record (ODR) before changing any locked business rule, formula, hierarchy or governance control;
- distinguish specification from implementation and runtime evidence;
- never invent undefined financial formulas, classification thresholds, provider facts, live values, company facts or security approvals;
- decide ordinary technical details independently when they do not alter an approved business rule;
- stop only for business-rule/formula/hierarchy/governance changes, paid-service activation, or a compliance/security boundary that cannot be satisfied without an approved exception.

**Objective:** build a maintainable, auditable, secure, source-aware, production-grade MarketNiora platform — not a demo.

---

## 1. SOURCE HIERARCHY AND STATUS LANGUAGE

### 1.1 Authority order

1. **This Blueprint v1.1** — current authoritative product, architecture and governance reference.
2. **ODR-2026-001** — Google OAuth/OIDC adoption decision; incorporated into this Blueprint.
3. **ODR-2026-002** — C1–C10 governance conflict-resolution decisions; incorporated into this Blueprint.
4. **Archived Master Guide** — historical reference only; no competing authority.
5. Other historical design documents — reference only unless explicitly adopted by a future ODR.

### 1.2 Mandatory status language

Use only:

- **PASS**
- **FAIL**
- **BLOCKED**
- **NOT_DEFINED**
- **OWNER_DECISION_REQUIRED**
- **UNKNOWN**
- **COST_REQUIRED**

Where useful, pair a status with a truth level:

- **SPECIFICATION** — the document says the requirement exists.
- **IMPLEMENTATION** — the repository contains the relevant code/schema/configuration.
- **RUNTIME** — actual execution/test evidence verifies the behavior.

**Document Approved ≠ Code Implemented ≠ Runtime PASS.**

---

## 2. BRAND IDENTITY

| Element | Value |
|---|---|
| Brand | **MARKETNIORA** |
| Tagline | **Track Smart Money. Spot Sector Rotation.** |
| Hero supporting line | **See where the market is moving — then discover the sectors, themes, value chains and companies driving the story.** |
| Safe proof line | **MARKET DATA STATUS VISIBLE · 4,187+ STOCKS · SOURCE-AWARE RESEARCH** |

“Smart Money” is positioning language. It MUST NOT be presented as verified institutional-flow data unless validated flow data is actually available.

Value Chain is a major research concept/feature inside MarketNiora, not a replacement brand.

---

## 3. WHAT MARKETNIORA IS

MarketNiora is a **Market Research + Market Intelligence platform** combining:

- Market Rotation
- Stock Intelligence
- Fundamental Causal Intelligence
- Theme Intelligence
- Business / Value-Chain intelligence
- Peer analysis
- AI research/news discovery and verification
- Screening
- Portfolio connectivity
- Alerts and notifications

The product is:

- not a spreadsheet inside a website;
- not a generic stock screener;
- not a generic SaaS dashboard;
- not a fake AI trading terminal.

### Core mental model

```text
Market movement
      ↓
Canonical classification
      ↓
Theme / business context
      ↓
Companies / stocks affected
      ↓
Evidence + fundamentals
      ↓
Independent scores / signals
      ↓
Stock 360° research view
```

Powerful underneath, simple at the surface.

---

## 4. THREE INDEPENDENT STRUCTURAL LAYERS

ODR-2026-002 C1 and C2 are authoritative.

### 4.1 Market Classification

```text
SECTOR
  ↓
SUB-SECTOR
  ↓
STOCK
```

The **Master Stock Group** is a separate registry. It is NOT a Market Classification hierarchy level.

However, Stock Group remains a **Rotation aggregation level**:

```text
RAW STOCK OBSERVATIONS
        ↓
STOCK GROUP ROTATION
        ↓
SUB-SECTOR ROTATION
        ↓
SECTOR ROTATION
```

### 4.2 Theme Intelligence

```text
THEME
  ↓
SUB-THEME
  ↓
INDUSTRY
  ↓
STOCK
```

Theme membership is many-to-many and independent from Market Rotation.

### 4.3 Business / Value Chain

```text
STOCK 360°
    ↓
STOCK DETAILS
    ↓
BUSINESS / VALUE CHAIN
```

Value Chain is NOT a Theme hierarchy level.

### 4.4 Hard independence rule

Never mathematically mix:

```text
Market Rotation
Stock Score
Theme Intelligence / Theme Score
Fundamental Intelligence / Fundamental Score
Business / Value Chain
Delivery Intelligence
Shariah
Portfolio data
AI discovery output
```

They may appear together on Stock 360°, but their mathematical/data responsibilities remain independent.

---

## 5. MARKET ROTATION — REVISION 3 / v1.2 BASELINE

**Status: OWNER_APPROVED + LOCKED**

### 5.1 Calculation flow

```text
RAW STOCK OBSERVATIONS
      ↓
STOCK GROUP ROTATION
      ↓
SUB-SECTOR ROTATION
      ↓
SECTOR ROTATION
```

### 5.2 Components

| Component | Baseline weight |
|---|---:|
| Median Return | 40% |
| Participation | 30% |
| Equal-Weighted Capped Return | 20% |
| IQR Consistency | 10% |

Protected baseline:

```text
ROTATION-MATH Revision 3 / v1.2
```

### 5.3 Horizon caps

| Horizon | Cap |
|---|---:|
| 1D | 8% |
| 1W | 12% |
| 1M | 20% |
| 3M | 30% |

### 5.4 Confidence gates — ODR-2026-002 C3

Two distinct gates exist:

- **CONF_MIN = 30** → Stock Group Rotation inclusion/publication gate.
- **60%** → higher-level aggregation/roll-up eligibility gate.

Confidence is an inclusion/reliability gate only. It MUST NOT multiply Rotation Score.

`N_REF = 20` remains the reference count parameter.

### 5.5 Breadth

Breadth uses only the **MarketNiora-classified universe**.

External index breadth — including Nifty 50 or another external index — has zero role in MarketNiora Rotation calculation.

### 5.6 D2 Flat State — ODR-2026-002 C6

If all valid capped returns are zero:

- state = **FLAT**;
- with default 40/30/20/10 weights, the mathematical score is **40**;
- with valid custom weights, the normal weighted formula is used;
- the engine MUST NOT force a custom-weight FLAT score to 40.

Required tests:

- default weights + all valid capped returns zero;
- valid custom weights + all valid capped returns zero.

### 5.7 Immutability and configuration

The 40/30/20/10 baseline is protected.

Admin configuration is permitted only when:

1. the configuration is valid;
2. it is explicitly versioned;
3. a calculation/configuration snapshot is retained;
4. the change is audited;
5. the change does not silently mutate an existing formula version.

A locked formula version is never edited in place.

### 5.8 Classification eligibility

Only stocks with the required verified MarketNiora classification and sufficient reliable observations can enter the relevant Rotation calculation.

Missing or unresolved classification MUST NOT be silently fabricated.

---

## 6. STOCK SCORE — SS-1.0-R3

**Status: OWNER_APPROVED + LOCKED**

### 6.1 Components

| Block | Weight |
|---|---:|
| Momentum | 22% |
| Earnings Momentum | 18% |
| Business Quality | 16% |
| Relative Strength | 10% |
| Valuation | 10% |
| Trend Quality | 8% |
| Volume Confirmation | 8% |
| Growth / Visibility | 8% |

### 6.2 Core formula

```text
Base = Σ(weight × normalized component)

StockScore = clamp(Base + RiskPenalty + Catalyst, 0, 100)
```

Risk Penalty:

```text
[-30, 0]
```

Catalyst:

```text
{0, +4, +8, +12}
```

Missing-block redistribution follows the approved SS-1.0-R3 rule. It MUST NOT be silently altered.

Suspended or delisted stock:

```text
Score = N/A
Confidence = 0
```

### 6.3 Growth / Visibility guidance

The approved Growth/Visibility guidance includes:

**Order Book / Revenue**
- `<0.5× → 20`
- `1.0× → 55`
- `≥2.0× → 100`
- linear interpolation in between where defined by the existing contract.

**Capacity Addition**
- `0% → 30`
- `20% → 70`
- `≥50% → 100`

**Management Guidance lookup — ODR-2026-002 C10**
- Positive → **80**
- Neutral → **50**
- Negative → **20**

The 80/50/20 lookup does NOT create an additional bonus, weight or score layer. It operates only inside the existing SS-1.0-R3 Growth/Visibility contract.

### 6.4 Historical comparison snap rule

For 1M/3M/6M/12M comparison, use the same calendar day N months earlier, then snap to the previous trading day when necessary.

Store:

- requested date;
- actual trading date used;
- calculation date.

1D/1W remain diagnostic horizons where defined.

### 6.5 Formula separation

Forbidden dependencies include:

- Rotation → Stock Score
- Stock Score → Rotation
- Theme → Stock Score
- Stock Score → Theme
- Group/Sub-sector/Sector Rotation → Stock Score
- Theme Score → Stock Score
- Shariah → Stock Score
- Delivery → Stock Score
- AI direct scoring → Stock Score

---

## 7. CONFIDENCE

Confidence measures **reliability**, not attractiveness.

It does not multiply Stock Score.

Reference formula:

```text
Confidence = 100 × (
  0.30 × PriceCoverage
+ 0.25 × FundamentalCoverage × FreshnessFactor
+ 0.15 × LiquidityScore/100
+ 0.15 × HistoryLength
+ 0.15 × SourceReliability
)
```

Suspended/Delisted:

```text
Score = N/A
Confidence = 0
```

For Rotation, Confidence is applied through the separately approved 30/60 gates defined in §5.4.

---

## 8. FUNDAMENTAL INTELLIGENCE

Fundamental Intelligence follows:

```text
WHAT → WHY → CHAIN → CONTEXT → CONCLUSION
```

A number is a clue, not an automatic verdict.

High ROE, high P/E, low P/E, negative FCF, leverage or other single metrics MUST NOT automatically be treated as good or bad without context.

### Core data areas

- Revenue / Sales
- EBITDA / EBIT / Operating Profit
- Net Income
- EPS
- Gross / Operating / Net Margin
- Earnings Quality
- PEG
- ROE
- CFO
- FCF
- Debt
- Liquidity
- Solvency
- Working Capital
- Capital Efficiency

Missing/stale/unverified data remains:

```text
MISSING / UNKNOWN / SOURCE_REQUIRED
```

Never zero-fill missing research.

Exact Fundamental Score mathematics is **NOT_DEFINED** and remains inactive until a separate Owner-approved formula decision exists.

---

## 9. MARKET DATA AND PROVIDER ARCHITECTURE

### 9.1 Source-aware data

MarketNiora must preserve source-aware:

- OHLC
- volume
- trading history
- corporate actions
- market status
- freshness/availability

### 9.2 Primary source policy

Preferred authoritative sources include:

- NSE/BSE official sources;
- Upstox where configured/authorized;
- company/exchange filings;
- licensed providers where required.

No fake/free assumption is permitted where a licensed/paid source is actually required.

### 9.3 Provider abstraction

Provider implementations live behind a server-side abstraction.

The business logic must not hard-code a single provider as a mathematical dependency.

Provider health/capabilities and source provenance must be retained.

### 9.4 Trading calendar

An authoritative Indian exchange trading-calendar source/update mechanism is required before production.

Do not invent holiday calendars.

### 9.5 Secrets

Provider tokens are server-side only.

Never expose provider credentials in:

- frontend JavaScript;
- HTML;
- localStorage/sessionStorage;
- mobile assets;
- public JSON;
- repository;
- logs;
- analytics.

---

## 10. BUSINESS / VALUE CHAIN INTELLIGENCE

Value Chain is a business-flow intelligence layer, not a score.

### Canonical chain

```text
RAW MATERIAL / INPUT
  ↓
MINING / EXTRACTION (if applicable)
  ↓
SOURCING / PROCUREMENT
  ↓
PROCESSING
  ↓
MANUFACTURING
  ↓
CAPACITY / UTILISATION / CAPEX
  ↓
PRODUCTS / BY-PRODUCTS
  ↓
CUSTOMERS / DISTRIBUTION
  ↓
DOWNSTREAM INDUSTRIES
  ↓
FINAL END-USE
```

Where applicable, evidence should cover:

- actual input;
- source/origin;
- supplier;
- import/domestic exposure;
- dependency;
- capacity;
- utilisation;
- capex;
- products;
- by-products;
- customers;
- distribution;
- downstream industry;
- final end-use.

### Evidence-based causal intelligence

```text
INPUT PRICE ↑
→ INPUT COST ↑
→ MARGIN IMPACT
→ EBITDA IMPACT
→ CASH FLOW IMPACT
→ EARNINGS IMPACT
```

and:

```text
DOWNSTREAM DEMAND ↑
→ ORDERS ↑
→ UTILISATION ↑
→ OPERATING LEVERAGE
→ MARGIN IMPROVEMENT
→ EARNINGS IMPACT
```

These are causal reasoning patterns, not permission to fabricate company-specific facts.

---

## 11. STOCK 360° — 21-SECTION CONTRACT

Stock 360° is the central structured research/evidence page.

Nothing is removed because of UI tab grouping.

```text
1.  OVERVIEW
2.  BASIC STOCK INFORMATION
3.  MARKET CLASSIFICATION
4.  ROTATION CONTEXT
5.  STOCK SCORE
6.  THEME INTELLIGENCE
7.  FUNDAMENTAL INTELLIGENCE
8.  FUNDAMENTAL SCORE — Not Active / Pending Owner Approval
9.  BUSINESS / VALUE CHAIN
10. MARKETNIORA SPECIAL PEERS
11. UNIVERSE PEERS
12. PRICE / MARKET DATA
13. DELIVERY INTELLIGENCE
14. FORECAST / SCENARIOS
15. PRO SIGNALS
16. SHARIAH
17. NEWS
18. AI RESEARCH
19. ALERTS
20. WATCHLIST / USER ACTIONS
21. DATA STATUS / PROVENANCE
```

### 11.1 Section contracts

**1–2 Overview / Basic Stock Information**
- company identity;
- exchange;
- symbol;
- verified ISIN where available;
- status/freshness;
- high-level research entry points.

**3 Market Classification**
- Sector;
- Sub-Sector;
- Master Stock Group reference.

**4 Rotation Context**
- Sector Rotation;
- Sub-Sector Rotation;
- Stock Group Rotation;
- stock-level context.

**5 Stock Score**
- score /100;
- confidence;
- 8 components;
- history;
- Base;
- Risk Penalty;
- Catalyst;
- Final.

**6 Theme Intelligence**
- Theme;
- Sub-Theme;
- Industry.

**7 Fundamental Intelligence**
- metric;
- actual value;
- period;
- source;
- status;
- trend;
- WHY/root cause;
- positive/warning signals;
- related metrics;
- context;
- verdict;
- provenance.

**8 Fundamental Score**
- inactive;
- pending Owner approval;
- exact formula NOT_DEFINED.

**9 Value Chain**
- company-specific verified business flow;
- evidence by stage.

**10 Special Peers**
- same Master Stock Group;
- self-excluded.

**11 Universe Peers**
- broader business competitors.

Peer calculations use raw observations. Other scores must not become peer inputs.

**12 Price / Market Data**
- current price;
- change;
- OHLC;
- volume;
- history;
- freshness/status.

**13 Delivery Intelligence**
Official delivery data only. Volume must not be used as a substitute for Delivery data.

**14 Forecast / Scenarios**
- Bear;
- Base;
- Bull;
- 12-month horizon.

Forecast remains independent from Score, Rotation, Theme and Confidence except for an explicitly defined guidance boundary. Missing evidence remains missing.

**15 Pro Signals**
Five states and anti-whipsaw/hysteresis behavior are defined in §17.

**16 Shariah**
Only Verified status is displayed. All other states display nothing.

**17 News**
Verified source/event context with provenance.

**18 AI Research**
AI discovery/verification layer; not direct score writer.

**19 Alerts**
User/configured notifications and event transitions.

**20 Watchlist / User Actions**
User-scoped actions.

**21 Data Status / Provenance**
Truthful freshness, verification, interpretation, workflow state and evidence lineage.

### Suggested presentation grouping

1. Overview (1,2)
2. Classification & Rotation (3,4)
3. Score & Fundamentals (5,6,7,8)
4. Value Chain (9)
5. Peers & Market Data (10,11,12,13)
6. Forecast & Signals (14,15)
7. Research & Compliance (16,17,18,19,20,21)

---

## 12. PEERS

### Special Peers

Same Master Stock Group, self-excluded.

### Universe Peers

Broader business competitors.

Peer inputs are raw observations only. A peer's Rotation Score, Stock Score or Theme Score must not become another stock's peer input.

---

## 13. DELIVERY INTELLIGENCE

Delivery is diagnostic intelligence.

Official source data is required.

Do not estimate Delivery from volume.

Delivery does not replace Stock Score or Rotation and does not feed them unless a future Owner-approved formula explicitly says so.

Diagnostic concepts include:

- Delivery20;
- Delivery Trend;
- Delivery vs 60D.

---

## 14. SHARIAH

Shariah is an independent research/data layer.

### Display rule

```text
Verified Shariah → show ✓
Everything else → show nothing
```

Non-Shariah, Pending, Unknown and Review MUST NOT be displayed as a ❌.

Never infer Shariah status from:

- sector;
- theme;
- company name;
- stock price;
- market data;
- AI.

Shariah does not affect:

- Rotation;
- Stock Score;
- Theme Intelligence;
- Fundamental Intelligence.

---

## 15. FORECAST / SCENARIOS

Forecast structure:

- BEAR
- BASE
- BULL

Horizon:

**12 months**

Forecast is an estimate, never a guarantee.

Forecast remains independent from:

- Rotation;
- Stock Score;
- Theme Score;
- Confidence;

except where an explicitly defined guidance boundary is approved.

Missing evidence remains missing.

---

## 16. AUTHENTICATION AND IDENTITY — ODR-2026-001

**Status: OWNER_APPROVED**

### 16.1 User login

User login is **Google OAuth (OIDC) only**.

Server verifies Google ID tokens through Google JWKS and validates at minimum:

- `aud`
- `iss`
- `exp`
- `sub`
- `email_verified`

No user password is stored under the adopted authentication model.

### 16.2 Owner login

Owner login is:

```text
Google OAuth / OIDC
        ↓
Owner whitelist check
        ↓
MANDATORY TOTP MFA
        ↓
Owner session
```

Owner role is server-controlled through `OWNER_EMAILS` whitelist.

No public Owner signup.

Owner with no confirmed TOTP secret → **BLOCKED**.

### 16.3 Client authority restrictions

Client cannot set or elevate:

- role;
- entitlement tier;
- verification state;
- MFA verification state;
- payment flags.

### 16.4 User OTP toggle

User-level OTP toggle is permanently dropped from the current product decision.

### 16.5 Open authentication items

- Google-account-loss recovery → **NOT_DEFINED**; future ODR required.
- Additional identity providers such as GitHub/Apple → **NOT_DEFINED**; future ODR required.

---

## 17. PRO SIGNALS

MarketNiora Pro Signals are diagnostic signals.

### Five states

```text
VERY BULLISH
BULLISH
NEUTRAL
BEARISH
VERY BEARISH
```

### Anti-whipsaw

A direction requires **2 consecutive sessions of persistence** before a generated signal transition is accepted.

### Hysteresis

Hysteresis thresholds are used to avoid unstable rapid switching.

### Events

`TURNED TO` events are generated only from defined signal transitions.

### Isolation

Pro Signals do not mathematically feed:

- Stock Score;
- Rotation;
- Theme Intelligence;
- Confidence.

---

## 18. AI RESEARCH / NEWS / ALERTS

Canonical flow:

```text
PERMITTED SOURCE / FILING
        ↓
AI DISCOVERY
        ↓
SOURCE VERIFICATION
        ↓
PROVENANCE / CONFIDENCE
        ↓
CANONICAL EVENT / OBSERVATION
        ↓
OPTIONAL OWNER / ADMIN REVIEW
        ↓
NOTIFICATION
```

AI MUST NEVER:

- exercise Owner authority;
- exercise Admin authority beyond explicitly permitted AI scope;
- modify locked formulas;
- access secrets;
- access private portfolio data;
- bypass payment controls;
- write directly into protected score outputs.

AI is a discovery/verification layer, not a ranked market-data provider.

---

## 19. SEARCH AND DISCOVERY

Global search accepts canonical identifiers and research terms such as:

- ticker/symbol;
- company name;
- partial name/symbol;
- ISIN;
- sector/sub-sector labels;
- theme labels;
- product/value-chain terms.

Search resolves existing canonical identities.

Search MUST NOT:

- create a new stock silently;
- mutate canonical stock data;
- bypass authorization.

### Search result groups

Where applicable, results may be grouped into:

- companies;
- sectors;
- themes;
- product groups;
- value chains.

---

## 20. SCREENER

The Screener is **filter-only**.

It MUST NOT modify:

- formulas;
- classification;
- Theme Intelligence;
- Rotation;
- Stock Score.

### Allowed modes

```text
RUN_NOW
SCHEDULED
EVENT_TRIGGERED
```

### Alert states

```text
ENTERED
REMOVED
CONDITION_CHANGED
```

### Rank Score

The approved screening rank context is:

```text
Rank Score
= 50% Stock Score
+ 20% Confidence
+ 30% Rotation Context
```

Tie-break:

```text
Confidence
→ Stock Score
→ Symbol A-Z
→ stock_id
```

Filters execute only against approved raw/canonical fields.

User-created grouped AND/OR screeners are user-scoped and cannot mutate protected formulas.

---

## 21. PORTFOLIO / UPSTOX

Portfolio architecture is server-side.

Canonical flow:

```text
USER
 ↓
UPSTOX OAUTH
 ↓
SECURE SERVER TOKEN STORAGE
 ↓
HOLDINGS / POSITIONS
 ↓
SYMBOL / ISIN NORMALIZATION
 ↓
CANONICAL STOCK MASTER
 ↓
USER-SCOPED PORTFOLIO
```

Rules:

- User A → User B portfolio = **DENY**.
- AI_AGENT → portfolio = **DENY**.
- Owner does not automatically receive private user portfolio access.
- Broker tokens never reach the client.
- Portfolio data never mutates the market-wide Stock Master.

User trading/order placement is outside the current research-platform core and requires its own explicit approved provider/action contract before implementation.

---

## 22. PAYMENTS / ENTITLEMENTS / FEATURE CONTROL

### Entitlement flow

```text
PLAN / TRIAL / OWNER GRANT
        ↓
ENTITLEMENT
        ↓
SERVER AUTHORIZATION
        ↓
FEATURE
```

### Payment flow

```text
PAYMENT
 ↓
PROVIDER VERIFICATION
 ↓
SUBSCRIPTION
 ↓
ENTITLEMENT
 ↓
FEATURE ACCESS
```

Client-side payment success is never authoritative.

Webhook requirements:

- signature verification;
- replay protection;
- idempotency.

### Global feature switch

An Owner global feature OFF switch can override plan/trial/Owner-grant access to the affected feature.

### Open provider choice

Exact production payment provider is **NOT_DEFINED** until explicitly selected and verified.

---

## 23. OWNER CONTROL CENTER AND ADMIN MATRIX

### 23.1 Role hierarchy

```text
OWNER
  ↓
ADMIN
  ↓
USER
```

### 23.2 Owner

Owner may control, subject to governance and authorization:

- users;
- admins;
- roles;
- plans/trials/entitlements;
- providers and market data;
- auto-sync;
- Rotation configuration/version control;
- Stock Score governance;
- themes/fundamentals/business map;
- peers;
- AI research/news/alerts;
- screener;
- portfolio/broker controls where authorized;
- notifications;
- branding/legal settings;
- authentication/security;
- audit;
- backups/recovery;
- emergency controls.

Critical Owner actions require re-authentication and required MFA.

### 23.3 Admin

Admin has delegated operational authority only.

Admin MUST NOT:

- block/delete/disable/revoke Owner;
- bypass Owner MFA;
- create/grant Owner-level authority;
- access plaintext secrets;
- change locked formulas;
- bypass payment integrity;
- modify/delete audit history;
- become superior to Owner.

Admin changes are audited.

### 23.4 User

User can access permitted product features, own account, own entitlements and own private portfolio.

User cannot access Owner/Admin controls or another user's private data.

### 23.5 AI_AGENT

AI_AGENT is not a login-capable human role.

It has only explicitly scoped machine permissions. It cannot grant itself Owner/Admin authority.

---

## 24. SECURITY — ZERO-TRUST GOVERNANCE

### Core rule

```text
SERVER = SOLE AUTHORITY
CLIENT = UNTRUSTED
CLIENT → DATABASE = DENY
```

### Required controls

- secure sessions;
- Google OIDC validation;
- Owner TOTP MFA;
- reauthentication for critical actions;
- RBAC;
- CSRF protection;
- rate limiting;
- secure headers;
- audit logging;
- secure secret storage;
- parameterized queries;
- input validation;
- fail-closed authorization;
- backup/recovery;
- incident response.

Secrets MUST never appear in:

- frontend;
- browser storage;
- source repository;
- Git history;
- logs;
- analytics;
- normal API responses;
- AI_AGENT context unless explicitly designed secret metadata only.

### Security boundary matrix

| Component | Access | Can modify | Must not access/modify |
|---|---|---|---|
| Website | own UI data | own user actions | DB, secrets, formulas, Owner auth |
| Mobile | own UI data | own user actions | DB, secrets, formulas, Owner auth |
| USER | permitted features | own data/actions | Owner, other users' data, secrets, formulas |
| ADMIN | delegated operational features | delegated operations | Owner authority, MFA bypass, locked formulas, audit history |
| OWNER | governance/business controls | approved governance/configuration | plaintext secrets, direct locked-formula mutation |
| Formula Engine | approved formula inputs | versioned calculation outputs | governance bypass |
| Governance Service | formula/configuration metadata | version/create/approve/lock | unrestricted direct data mutation |
| Payment Service | payment state | payment/subscription state | formulas, Pro signals |
| Provider Service | provider data/health | provider data state | formulas, Pro logic |
| Secret Manager | secret metadata | secrets server-side | client access |
| Database | data via services | service-controlled persistence | direct client access |
| Audit Service | audit logs | append only | update/delete history |

---

## 25. DATA STATUS — FOUR SEMANTIC DIMENSIONS

ODR-2026-002 C5 establishes four independent status dimensions.

### 25.1 Freshness / Availability

```text
LIVE
DELAYED
STALE
UNAVAILABLE
```

### 25.2 Verification

```text
VERIFIED
UNKNOWN
```

### 25.3 Interpretation

```text
NOT_INTERPRETABLE
INTERPRETABLE
```

### 25.4 Workflow

```text
SOURCE_REQUIRED
PENDING
MISSING
```

**Missing ≠ Zero.**

**Unknown ≠ Fail.**

**Pending ≠ Negative.**

A single overloaded `DataStatus` field MUST NOT be used as a substitute for the four semantic dimensions.

---

## 26. DATA PIPELINE AND PROVENANCE

Canonical order:

```text
SOURCE HEALTH
      ↓
FETCH
      ↓
IMMUTABLE RAW STORE
      ↓
VALIDATE
      ↓
NORMALIZE
      ↓
DEDUPLICATE
      ↓
CONFLICT RESOLUTION
      ↓
CANONICAL DB
      ↓
QUALITY CHECK
      ↓
AFFECTED SCORE REFRESH
      ↓
CACHE / MATERIALIZED VIEW
      ↓
JOB LOG
```

Every observation should retain, where applicable:

- source;
- source timestamp;
- retrieved date/time;
- reported date/period;
- data nature/state;
- validation status;
- verification status;
- formula version;
- configuration snapshot;
- provenance evidence.

### Raw immutability

Raw observations are append-only. Corrections create new observations and preserve history.

### Conflict resolution

Conflicts are resolved through explicit provenance-aware logic. Silent source replacement is prohibited.

### Quality gate

Quality Check is mandatory before an observation becomes canonical. Failed QC does not enter the canonical store.

---

## 27. 4,187 RESEARCH UNIVERSE

The 4,187-stock dataset is a **research source**, not a blindly canonical production universe.

Required flow:

```text
INSPECT
  ↓
MAP
  ↓
VALIDATE
  ↓
STAGE
  ↓
CONFLICT RESOLUTION
  ↓
OWNER-AUTHORIZED IMPORT
```

Blind import is prohibited.

Only fields relevant to the approved architecture may be imported.

Identity collisions require manual resolution where evidence is insufficient.

Classification gaps remain explicit.

Only sufficiently verified MarketNiora classifications enter the relevant Rotation/Score calculations.

---

## 28. WEBSITE / PRODUCT SURFACES

### 28.1 First-open experience

After login, open to **OVERVIEW**, not an oversized stock table.

```text
HEADER
  ↓
MARKET STATUS
  ↓
HERO
  ↓
LIVE MARKET STRIP (only when truly live)
  ↓
COVERAGE KPIs
  ↓
MARKET PULSE
  ↓
ROTATION WATCH
  ↓
THEME / BUSINESS MAP PREVIEW
  ↓
RESEARCH COVERAGE
  ↓
QUICK EXPLORE
  ↓
METHODOLOGY / SOURCE NOTE
```

Never label data LIVE unless the required provider is actually connected and verified.

### 28.2 Major product areas

- Overview / Market Pulse
- Rotation
- Sectors / Sub-sectors / Stock Groups
- Themes / Sub-themes / Industries
- Stocks / Global Search
- Screener
- Signals / TURNED TO events
- Research / AI Research / News
- Alerts / Notifications
- Portfolio
- Subscription
- Settings
- Owner Control Center

### 28.3 Mobile

Mobile is a first-class surface.

Required principles include:

- touch-friendly interaction;
- compact filter drawer;
- responsive cards instead of forced-wide tables;
- deep-link support;
- no horizontal page overflow.

### 28.4 Desktop

Use a persistent or context-appropriate navigation model, wide editorial content, efficient tables and detailed charts.

Powerful backend, simple frontend.

---

## 29. USER FLOW AND NAVIGATION SAFETY

### Product flow

```text
SEARCH
 → LANDING
 → EXPLAIN
 → SIGNUP/LOGIN
 → VERIFY
 → DASHBOARD
 → MARKET
 → ROTATION / THEMES
 → SCREENER
 → STOCK 360°
 → FUNDAMENTAL / BUSINESS / VALUE CHAIN
 → STOCK SCORE / CONFIDENCE / FORECAST
 → PRO SIGNALS
 → RESEARCH / NEWS
 → WATCHLIST / ALERTS
 → OWN PORTFOLIO
 → SUBSCRIPTION
 → SETTINGS
 → SUPPORT / LEGAL
 → LOGOUT
```

### Breadcrumbs

```text
Home > Rotation > Sector > Sub-Sector > Stock Group > Stock
```

For Theme:

```text
Home > Themes > Theme > Sub-Theme > Industry > Stock
```

For Stock 360°:

```text
Stock > Section > Detail
```

### Navigation safety

UI navigation must not create hidden calculations.

Stock Score is not a replacement for Rotation.

Theme Intelligence is not a replacement for Market Rotation.

Value Chain remains within Stock 360° / Stock Details.

Server authorization controls protected routes and actions.

Private portfolio routes remain user-scoped.

---

## 30. WHAT MUST NOT BE INVENTED

Never invent:

- undefined classification thresholds;
- undefined financial formulas;
- Theme Score formula when no approved formula exists;
- Fundamental Score formula when not approved;
- fake live market values;
- fake institutional-flow data;
- unverified company/value-chain facts presented as verified;
- holiday calendars without authoritative source;
- Owner credentials or identity;
- client-authoritative payment success;
- client-authoritative premium entitlement;
- security approval that has not been granted;
- alternative role privileges not approved by governance;
- any locked Rotation Math change without an ODR.

When required information does not exist, use:

```text
NOT_DEFINED
UNKNOWN
PENDING
SOURCE_REQUIRED
```

as appropriate.

---

## 31. IMPLEMENTATION ROADMAP

Implementation order is gated.

1. Product/architecture governance baseline
2. Clean repository + infrastructure foundation
3. Security/governance primitives + database foundation
4. Authentication + Owner authorization + entitlement foundation
5. Provider abstraction + provenance
6. Market Rotation Engine
7. Stock Score Engine
8. Confidence / approved intelligence contracts
9. Peers / Theme / Fundamental / Value Chain
10. AI Research / News / Alerts
11. Portfolio connectivity
12. API layer
13. Web frontend
14. Mobile Flutter
15. Screener + Stock 360° product surface
16. Observability
17. Backup/recovery
18. Full mathematical/regression/security/E2E testing
19. Production security gate
20. Production deployment only after explicit Owner approval

No phase is considered complete because code exists; its exit gate must pass.

---

## 32. MANDATORY IMPLEMENTATION GATES

Every module follows:

```text
DESIGN
  ↓
AUDIT
  ↓
OWNER APPROVAL
  ↓
IMPLEMENT
  ↓
FUNCTIONAL TEST
  ↓
SECURITY TEST
  ↓
DATA / PROVENANCE TEST
  ↓
REGRESSION
  ↓
NEXT MODULE
```

Global exit gates:

1. Blueprint reviewed and current status map confirmed.
2. Target repository created/audited.
3. Database schema + access control implemented/tested.
4. Security foundation tested.
5. Authentication + Owner MFA/authorization tested.
6. Provider capability/licensing configured and verified.
7. Protected engines implemented from approved formulas with version/hash/diff checks.
8. API contracts + entitlement enforcement tested.
9. Web/mobile implemented.
10. Observability + backup/recovery prepared.
11. Unit + integration + security + E2E tests executed with actual evidence.
12. Production security/readiness gate passed.
13. Explicit Owner approval received before production deployment.

---

## 33. QUALITY / AUDIT RULES

- Every calculation must be reconstructible from raw observations, formula version and configuration snapshot.
- Formula files are versioned/protected.
- Deviations from locked formulas are BLOCKED without Owner approval.
- Tests include edge cases, missing data, invalid configuration and regression protection.
- Do not claim tests passed unless they were actually executed.
- Do not claim database/deployment validation without actual validation.
- A historical report is not runtime evidence.
- A UI screenshot is not proof of backend correctness.
- A successful build is not proof of data correctness.
- An API response is not proof of provenance correctness unless the provenance chain is tested.

---

## 34. IMPLEMENTATION TRUTH / GOVERNANCE STATUS REGISTRY

Every major requirement tracks four governance/runtime states:

1. **Document status**
2. **Rule/formula status**
3. **Implementation status**
4. **Runtime status**

Example:

| Item | Document | Rule/Formula | Implementation | Runtime |
|---|---|---|---|---|
| Rotation v1.2 | OWNER_APPROVED | OWNER_APPROVED + LOCKED | UNKNOWN until repository audit | UNKNOWN until execution |
| Google OAuth | OWNER_APPROVED | OWNER_APPROVED | UNKNOWN until code audit | UNKNOWN until runtime test |
| Theme Score formula | OWNER_APPROVED feature boundary | NOT_DEFINED | NOT_IMPLEMENTED | NOT_DEFINED |
| Fundamental Score | OWNER_APPROVED as inactive boundary | NOT_DEFINED | NOT_IMPLEMENTED | NOT_DEFINED |

A document cannot upgrade implementation or runtime truth.

If documentation says something is built but the repository does not contain it, issue a discrepancy report. Do not silently recreate it as though it had always existed.

---

## 35. CURRENTLY OPEN / NOT_DEFINED ITEMS

The following remain open unless separately resolved by an Owner decision:

- exact numeric classification thresholds — **NOT_DEFINED**;
- exact Theme Score formula — **NOT_DEFINED**;
- exact Fundamental Score formula — **NOT_DEFINED**;
- authoritative Indian exchange calendar mechanism before production — **OWNER_DECISION_REQUIRED / CONFIGURATION**;
- exact production hosting vendor — **NOT_DEFINED**;
- exact payment provider — **NOT_DEFINED / COST_REQUIRED when activation is requested**;
- exact fallback market-data provider set — **NOT_DEFINED**;
- production secret-manager deployment choice — **NOT_DEFINED / COST_REQUIRED if paid service is required**;
- exact market-data licensing/entitlement terms — **NOT_DEFINED**;
- Google-account-loss recovery — **NOT_DEFINED**;
- multi-provider identity expansion beyond Google — **NOT_DEFINED**.

No implementation may silently fill these gaps.

---

## 36. EMERGENCY CONTROL

Emergency controls are Owner-governed and fail-closed.

Conceptual control surface:

```text
OWNER
  ↓
EMERGENCY CONTROL
  ├─ Website OFF
  ├─ API OFF
  ├─ Login OFF
  ├─ Registration OFF
  ├─ AI OFF
  ├─ Alerts OFF
  ├─ Screener OFF
  ├─ Portfolio OFF
  ├─ Broker OFF
  ├─ Provider OFF
  ├─ Revoke Sessions
  ├─ Read-only mode
  └─ Maintenance mode
      ↓
AUDIT
```

Emergency controls must be protected by Owner authorization, audited, and fail closed.

---

## 37. DATA / VERSION GOVERNANCE

### Locked

- Market Rotation Revision 3 / v1.2 baseline
- Stock Score SS-1.0-R3
- Market Classification terminology
- Theme hierarchy terminology
- Shariah display rule
- Owner authority model
- Security principles
- Peer definitions
- Delivery diagnostic-only principle
- Formula isolation principles

### Versioned / evolving

- Theme Score methodology until formally approved
- Fundamental Intelligence details where contract not fully locked
- Fundamental Score
- Forecast methodology refinements
- Provider configurations
- Feature flags
- Entitlements/plans
- User screeners
- research/provider routing subject to legal verification

Locked changes follow:

```text
STOP
 → ODR
 → OWNER APPROVAL
 → NEW VERSION
 → AUDIT
 → IMPLEMENT
 → TEST
```

No silent edits.

---

## 38. ARCHIVED MASTER GUIDE

ODR-2026-002 supersedes the prior Master Guide as a competing authority.

The archived file remains historical reference:

```text
docs/archive/MarketNiora_Master_Guide_v1_ARCHIVED.md
```

The archive must not be treated as a current requirement source when it conflicts with this Blueprint.

---

## 39. FINAL DEFINITION

MarketNiora is a **source-aware Market Research + Market Intelligence platform** that connects market movement, canonical classification, themes, business/value-chain intelligence, stock-level evidence, fundamental context, independent scores/signals and user-owned portfolio information through independent intelligence layers with strict provenance and governance.

---

## 40. FINAL INSTRUCTION TO THE BUILD AI

Start from the current repository only after performing a forensic audit.

Do not assume the repository matches this document.

Do not rewrite historical implementation into compliance silently.

Do not claim PASS without evidence.

Do not infer business rules from UI.

Do not create data to make the system look complete.

For ordinary technical implementation decisions, choose robust, secure, maintainable solutions independently.

For any conflict that would alter an Owner-approved formula, hierarchy, governance rule or authorization boundary:

```text
STOP → OWNER_DECISION_REQUIRED
```

The target is a secure, auditable, testable, production-grade system — not a demo.

---

## 41. COMPANION BUILD PROMPT

You are the Lead Product Architect, Principal Engineer, Database Architect, Security Engineer, QA Lead and DevOps Engineer for MarketNiora.

You are building a source-aware market research/intelligence platform. Use **MARKETNIORA MASTER PRODUCT BLUEPRINT v1.1** as the authoritative product and governance reference.

Read the entire Blueprint before implementation.

Build systematically:

```text
GOVERNANCE
→ REPOSITORY
→ DATABASE
→ SECURITY
→ AUTHENTICATION
→ OWNER AUTHORIZATION
→ PROVIDERS
→ DATA PIPELINE
→ PROTECTED ENGINES
→ API
→ WEB
→ MOBILE
→ OBSERVABILITY
→ BACKUP/RECOVERY
→ TESTING
→ PRODUCTION GATE
```

Rules:

- server is the sole authority;
- client is untrusted;
- Client → DB = DENY;
- secrets are server-side only;
- Google OIDC is the current login mechanism;
- Owner requires Google OIDC + mandatory TOTP;
- C1–C10 ODR decisions are authoritative;
- Rotation and Stock Score formulas remain protected;
- Theme Score formula remains NOT_DEFINED until separately approved;
- Fundamental Score remains inactive until separately approved;
- missing ≠ zero;
- unknown ≠ pass;
- no fabricated data;
- no silent formula changes;
- no production deployment without explicit Owner approval;
- every major module must pass DESIGN → AUDIT → OWNER APPROVAL → IMPLEMENT → FUNCTIONAL TEST → SECURITY TEST → DATA/PROVENANCE TEST → REGRESSION.

Report all work using the status language defined in §1.

