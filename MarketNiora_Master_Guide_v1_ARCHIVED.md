# ARCHIVED — SUPERSEDED BY ODR-2026-002

> Historical reference only. This file is retained for provenance and audit history.
> It is not a competing authority. The current authoritative source-of-truth is `docs/MARKETNIORA_MASTER_PRODUCT_BLUEPRINT_v1.1.md`.

---

# MARKETNIORA — MASTER GUIDE
### Owner Working Baseline (Frozen) · A–Z · Product · Architecture · Intelligence · Security · Governance

> **Status:** PROPOSED · Security Version 1.0 · Owner Approval: FALSE · Locked: FALSE · Admin: NONE
> Jahan purane documents (v3.0 ya kisi bhi source) se conflict ho, ye Master Guide controlling hai.

---

## 0. Governance Rule

- Specification PASS ≠ Runtime PASS
- Missing evidence fabricate nahi karna
- UNKNOWN = PASS nahi hai
- Formula versions immutable; silent formula editing allowed nahi
- Locked rule change karna ho → **STOP → Owner Approval mandatory**

---

## 1. About MarketNiora

MarketNiora ek **Market Research + Market Intelligence platform** hai — stock screener, price app, generic SaaS dashboard, ya fake AI trading terminal nahi.

Objective: Market mein movement kahan hai → uske peeche ka theme kya hai → business/value chain kya hai → kaunsi companies affected hain → stock ki strength/quality kya hai → WHY kya hai → evidence kya kehta hai.

Central Stock Master ke around independent intelligence layers ka system hai.

---

## 2. Brand

| Element | Value |
|---|---|
| Brand | **MARKETNIORA** |
| Tagline | Track Smart Money. Spot Sector Rotation. |
| Supporting Line | See where the market is moving — then discover the sectors, themes, value chains and companies driving the story. |
| Safe Proof Line | MARKET DATA STATUS VISIBLE · 4,187+ STOCKS · SOURCE-AWARE RESEARCH |

"Smart Money" positioning language hai — jab tak validated institutional-flow data available na ho, ise verified fact nahi bolna.

---

## 3. Core Architecture (3 independent structural layers)

**Market Classification**
```
SECTOR → SUB-SECTOR → STOCK
```
Master Stock Group = separate registry, Classification hierarchy ka level nahi hai.

**Theme Intelligence**
```
THEME → SUB-THEME → INDUSTRY → STOCK
```
Many-to-many membership. Rotation se independent.

**Business / Value Chain**
```
STOCK 360° → STOCK DETAILS → BUSINESS / VALUE CHAIN
```
Theme hierarchy ka level nahi hai.

**Hard rule:** In teeno layers ko Rotation/Stock Score ke saath mathematically kabhi mix nahi karna.

---

## 4. Data Foundation

Central Stock Master ke around connect: Market Classification, Master Stock Group, Themes, Value Chain, Peers, Price/Market Data, Delivery, Fundamentals, Stock Score, Rotation Context, Research, News, Shariah, Portfolio mapping.

Search kabhi naya stock record automatically create nahi karega.

---

## 5. Market Rotation — v1.2 (Locked)

```
RAW STOCK OBSERVATIONS → STOCK GROUP ROTATION → SUB-SECTOR ROTATION → SECTOR ROTATION
```

| Component | Weight |
|---|---|
| Median Return | 40% |
| Participation | 30% |
| Equal-Weighted Capped Return | 20% |
| IQR Consistency | 10% |

**Horizon caps:** 1D 8% · 1W 12% · 1M 20% · 3M 30%
**Confidence:** CONF_MIN = 30 (inclusion gate, multiplier nahi)
**Reference:** N_REF = 20
**Breadth:** sirf MarketNiora-classified universe se, external index breadth ka role zero

---

## 6. Stock Score — SS-1.0-R3 (Locked)

| Block | Weight |
|---|---|
| Momentum | 22% |
| Earnings Momentum | 18% |
| Business Quality | 16% |
| Relative Strength | 10% |
| Valuation | 10% |
| Trend Quality | 8% |
| Volume Confirmation | 8% |
| Growth / Visibility | 8% |

```
Base = Σ(weight × normalized component)
StockScore = clamp(Base + RiskPenalty + Catalyst, 0, 100)
```
- Risk Penalty: [-30, 0]
- Catalyst: {0, +4, +8, +12}
- Missing block → defined redistribution rule, formula silently modify nahi

### Growth/Visibility sub-formula
- Order Book/Revenue: <0.5× → 20 · 1.0× → 55 · ≥2.0× → 100 (linear beech mein)
- Capacity Addition: 0% → 30 · 20% → 70 · ≥50% → 100
- Management Guidance: Positive → 80 · Neutral → 50 · Negative → 20

### Historical/Momentum snap rule
1M/3M/6M/12M comparison = same calendar day N months earlier → previous trading day pe snap. Store: requested date, actual trading date, calculation date. 1D/1W diagnostic horizons hain.

---

## 7. Confidence

Data **reliability** hai — attractiveness nahi. Stock Score ko multiply nahi karta.

```
Confidence = 100 × (
  0.30 × PriceCoverage
+ 0.25 × FundamentalCoverage × FreshnessFactor
+ 0.15 × LiquidityScore/100
+ 0.15 × HistoryLength
+ 0.15 × SourceReliability
)
```

Suspended/Delisted → Score = N/A, Confidence = 0

---

## 8. Fundamental Intelligence

**Methodology:** WHAT → WHY → CHAIN → CONTEXT → CONCLUSION
> "A number is a clue, not an automatic verdict."

High ROE / high P/E / low P/E / negative FCF — koi bhi automatically good/bad nahi. Context + business cycle + cash flow + peers + future evidence dekhna hai.

**Data areas:** Revenue/Sales, EBITDA/EBIT/Operating Profit, Net Income, EPS, Gross/Operating/Net Margin, Earnings Quality, PEG, ROE, CFO, FCF, Debt, Liquidity, Solvency, Working Capital, Capital Efficiency

Missing/stale/unverified data → `MISSING / UNKNOWN / SOURCE REQUIRED` — zero se fill nahi karna. Fully-locked na hone waale exact formulas/thresholds invent nahi karne.

---

## 9. Market Data

OHLC, Volume, Trading history, Corporate actions, Market status — source-aware.

**Primary source policy:** NSE/BSE official, Upstox, Company/exchange filings, Licensed providers where required. Fake/free assumption nahi. Provider failure par fabricated value create nahi karna.

---

## 10. Business / Value Chain (detailed — score nahi, business-flow intelligence hai)

```
RAW MATERIAL / INPUT
  ↓ MINING / EXTRACTION (if applicable)
  ↓ SOURCING / PROCUREMENT
  ↓ PROCESSING
  ↓ MANUFACTURING
  ↓ CAPACITY / UTILISATION / CAPEX
  ↓ PRODUCTS / BY-PRODUCTS
  ↓ CUSTOMERS / DISTRIBUTION
  ↓ DOWNSTREAM INDUSTRIES
  ↓ FINAL END-USE
```

Har stage par: actual input, source/origin, supplier, import/domestic exposure, dependency, capacity, utilisation, capex, products, by-products, customers, distribution, downstream industry, final end-use.

**Causal intelligence (evidence-based, fact nahi banana bina proof ke):**
```
INPUT PRICE ↑ → INPUT COST ↑ → MARGIN IMPACT → EBITDA IMPACT → CASH FLOW IMPACT → EARNINGS IMPACT
DOWNSTREAM DEMAND ↑ → ORDERS ↑ → UTILISATION ↑ → OPERATING LEVERAGE → MARGIN IMPROVEMENT → EARNINGS IMPACT
```

---

## 11. Stock 360° — Complete Structure (nothing deleted, only re-organized into tabs)

Central research/evidence page. **Overview default open rahega, deep sections tabs/accordions mein.**

```
STOCK 360°
├── 1.  OVERVIEW
├── 2.  BASIC STOCK INFORMATION
├── 3.  MARKET CLASSIFICATION (Sector, Sub-Sector, Stock Group ref)
├── 4.  ROTATION CONTEXT (Sector / Sub-Sector / Stock Group Rotation)
├── 5.  STOCK SCORE (Score/100, Confidence, 8 Components, History, Base, Risk Penalty, Catalyst, Final)
├── 6.  THEME INTELLIGENCE (Theme, Sub-Theme, Industry)
├── 7.  FUNDAMENTAL INTELLIGENCE (Metric, Actual Value, Period, Source, Status, Trend, WHY/Root Cause,
│        Positive/Warning Signals, Related Metrics, Context, Verdict, Provenance)
├── 8.  FUNDAMENTAL SCORE  ⚠ Not Active — Pending Owner Approval
├── 9.  BUSINESS / VALUE CHAIN (full 12-stage chain, see Section 10 above)
├── 10. MARKETNIORA SPECIAL PEERS (same Stock Group, self-excluded)
├── 11. UNIVERSE PEERS (broader competitors)
├── 12. PRICE / MARKET DATA (Current Price, Change, OHLC, Volume, History, Freshness/Status)
├── 13. DELIVERY INTELLIGENCE
├── 14. FORECAST / SCENARIOS (Bear / Base / Bull, 12M horizon)
├── 15. PRO SIGNALS
├── 16. SHARIAH (Verified only — else nothing shown)
├── 17. NEWS
├── 18. AI RESEARCH
├── 19. ALERTS
├── 20. WATCHLIST / USER ACTIONS
└── 21. DATA STATUS / PROVENANCE
```

### Suggested UI tab grouping (presentation only — no section removed)
1. **Overview** (1, 2)
2. **Classification & Rotation** (3, 4)
3. **Score & Fundamentals** (5, 6, 7, 8)
4. **Value Chain** (9)
5. **Peers & Market Data** (10, 11, 12, 13)
6. **Forecast & Signals** (14, 15)
7. **Research & Compliance** (16, 17, 18, 19, 20, 21)

---

## 12. Peers

- **Special Peers:** same Master Stock Group, self-excluded
- **Universe Peers:** broader business competitors
- Calculations raw observations pe based — dusre scores ko peer input nahi banana

## 13. Delivery Intelligence
Official source data required, volume se estimate nahi. Score/Rotation ka replacement nahi. Diagnostics: Delivery20, Delivery Trend, Delivery vs 60D.

## 14. Shariah
Verified → ✓ · Non-Shariah / Pending / Unknown / Review → kuch bhi nahi dikhega. Kabhi infer nahi karna. Rotation/Score/Theme/Fundamental — kisi ko bhi affect nahi karta.

## 15. Forecast
BEAR / BASE / BULL, 12-month horizon. Score/Rotation/Theme/Confidence se independent (except defined guidance boundary). Missing evidence = missing.

## 16. Screener
Filter-only engine — formula/classification/theme/rotation modify nahi karta. Rank Score = 50% Stock Score + 20% Confidence + 30% Rotation Context. Tie-break: Confidence → Stock Score → Symbol A-Z → stock_id.

## 17. MarketNiora Pro Signals
VERY BULLISH / BULLISH / NEUTRAL / BEARISH / VERY BEARISH. Anti-whipsaw (2 consecutive sessions persistence) + hysteresis thresholds. TURNED TO events defined transitions se generate.

## 18. AI Research / News
```
PERMITTED SOURCE/FILING → AI DISCOVERY → SOURCE VERIFICATION → PROVENANCE/CONFIDENCE
→ CANONICAL EVENT/OBSERVATION → OPTIONAL OWNER/ADMIN REVIEW → NOTIFICATION
```
AI kabhi bhi: Owner authority, Admin authority, formula modify, secrets access, portfolio access, ya payment bypass nahi kar sakta. AI direct scoring writer nahi hai.

## 19. Search
Ticker, Company name, Partial symbol/name, ISIN — sirf canonical Stock Master resolve karta hai. Naya record create nahi karta, koi data mutate nahi karta.

## 20. Portfolio / Upstox
```
USER → UPSTOX OAUTH → SECURE SERVER TOKEN STORAGE → HOLDINGS/POSITIONS
→ SYMBOL/ISIN NORMALIZATION → CANONICAL STOCK MASTER → USER-SCOPED PORTFOLIO
```
User A → User B portfolio = DENY. AI_AGENT → Portfolio = DENY. Owner ko bhi automatic access nahi. Portfolio data market-wide Stock Master modify nahi karta.

## 21. Payment / Entitlement
```
USER → PLAN/TRIAL/OWNER GRANT → ENTITLEMENT → SERVER AUTH → FEATURE
PAYMENT → PROVIDER VERIFICATION → SUBSCRIPTION → ENTITLEMENT → FEATURE ACCESS
```
Client-side payment success authoritative nahi. Webhook: signature verification, replay protection, idempotency.

## 22. Feature On/Off
Owner ka global switch — OFF hone par Plan/Trial/Owner-grant sab override ho jaate hain.

## 23. Owner Control Center
Users, Admins, Roles, Plans, Trials, Entitlements, Payments, Market Data, Providers, Auto-sync, Rotation, Stock Score, Fundamentals, Themes, Business Map, Peers, AI Research, News, Alerts, Screener, Portfolio, Brokers, Upstox, Notifications, Branding, Authentication, Security, Audit, Backups, Emergency Controls.

## 24. Admin vs Owner
```
OWNER → ADMIN → USER
```
Admin: Owner ko block/delete/disable/revoke nahi kar sakta, MFA bypass nahi, authority create/grant nahi, plaintext secrets access nahi, locked formulas change nahi, payment integrity bypass nahi, audit history modify/delete nahi. Admin kabhi Owner se upar nahi jaa sakta.

## 25. Security — Zero-Trust Governance
**Server = Sole Authority. Client = Untrusted. Client → Database = DENY.**
Secure sessions, MFA, Reauthentication, RBAC, CSRF protection, Rate limiting, Security headers, Audit, Secure storage, Parameterized queries, Input validation, Fail-closed authorization, Backup/Recovery, Incident response.
Secrets kabhi frontend/browser/source/Git/logs/analytics/normal API/AI_AGENT mein expose nahi honge.

## 26. Data Pipeline & Provenance
```
SOURCE HEALTH → FETCH → IMMUTABLE RAW STORE → VALIDATE → NORMALIZE → DEDUPLICATE
→ CONFLICT RESOLUTION → CANONICAL DB → QUALITY CHECK → AFFECTED SCORE REFRESH
→ CACHE/MATERIALIZED VIEW → JOB LOG
```
Har observation ke saath: source, source timestamp, reported date/period, verification status, raw/derived/normalized status, formula version — retained.

## 27. 4,187 Master Data
Research source hai, automatically canonical production DB nahi.
```
INSPECT → MAP → VALIDATE → STAGE → CONFLICT RESOLUTION → OWNER-AUTHORIZED IMPORT
```
Blind import prohibited. Original source + provenance preserve karna.

## 28. Data Status Language
Sirf ye states: `LIVE` · `DELAYED` · `STALE` · `MISSING` · `NOT INTERPRETABLE` · `SOURCE REQUIRED` · `UNKNOWN`
**Golden rule:** UNKNOWN ≠ PASS · Missing ≠ Zero · Unverified ≠ Verified · AI claim ≠ Fact

## 29. Navigation

**Web:** Dashboard → Market/Rotation → Themes → Screener → Stock 360° → Portfolio → Alerts → Profile
**Mobile:** Home | Rotation | Themes | Search | Portfolio
Owner/Admin controls normal market browsing ke saath mix nahi honge.

## 30. Complete User Flow
```
SEARCH → LANDING → EXPLAIN → SIGNUP/LOGIN → VERIFY → DASHBOARD → MARKET
→ ROTATION/THEMES → SCREENER → STOCK 360° → FUNDAMENTAL/BUSINESS/VALUE CHAIN
→ STOCK SCORE/CONFIDENCE/FORECAST → PRO SIGNALS → RESEARCH/NEWS
→ WATCHLIST/ALERTS → OWN PORTFOLIO → SUBSCRIPTION → SETTINGS → SUPPORT/LEGAL → LOGOUT
```

## 31. Exact Score/Formula Isolation (Hard Rule)
```
Rotation → Stock Score = FORBIDDEN        Stock Score → Rotation = FORBIDDEN
Theme → Stock Score = FORBIDDEN           Stock Score → Theme = FORBIDDEN
Group/Sub-sector/Sector Rotation → Stock Score = FORBIDDEN     Rotation → Theme = FORBIDDEN
```
Delivery = diagnostic only. Shariah impact = zero. AI direct scoring = never. Portfolio market-wide data modify nahi karta.

## 32. Implementation Order
1. Architecture/Governance → 2. Database Schema + Access Control → 3. Security Foundation → 4. Authentication/Identity → 5. Owner Authorization + MFA → 6. Provider Architecture → 7. Data Pipeline + Provenance → 8. Locked Rotation Engine → 9. Stock Score Engine → 10. Peers/Theme/Fundamental/Value Chain → 11. AI Research/News/Alerts → 12. Portfolio/OAuth → 13. API → 14. Website → 15. Mobile → 16. Screener + Stock 360° → 17. Observability → 18. Backup/Recovery → 19. Complete Testing → 20. Production Security Gate

## 33. Approval Gate (every module)
```
DESIGN → AUDIT → OWNER APPROVAL → IMPLEMENT → FUNCTIONAL TEST → SECURITY TEST
→ DATA/PROVENANCE TEST → REGRESSION → NEXT MODULE
```
"Code ban gaya" kehkar complete nahi maana jayega. Locked rule change karna ho → STOP → Owner approval.

## 34. Implementation Truth (3 levels — mix nahi karna)
- **SPECIFICATION** — document says it should exist
- **IMPLEMENTATION** — actual repo mein code/schema hai
- **RUNTIME** — actual tests/execution se verified

Document "built" bole but repo mein na ho → DISCREPANCY REPORT, silent recreation nahi.

## 35. Current Build Status

**READY/LOCKED:** Core architecture, Engine separation, Rotation v1.2 math, Stock Score SS-1.0-R3 math, Delivery principle, Peer principles, Provenance/no-fake-value principles, Security/Owner-control principles

**SPECIFIED, NOT YET IMPLEMENTED:** Stock Score runtime, Theme runtime, Fundamental runtime, Value Chain runtime, Live data pipeline, Stock 360° UI, Screener, AI/news/alerts, Portfolio, Auth/RBAC, Payments, Mobile

**OPEN:** Fundamental exact formulas/edge cases, some Value Chain rules, provider/legal choices, final API/storage contracts

## 36. Final One-Line Definition

> MarketNiora ek source-aware Market Research + Market Intelligence platform hai jo market movement, canonical classification, themes, business/value-chain intelligence, stock-level evidence, fundamental context, scores, signals aur user-owned portfolio information ko independent intelligence layers ke through connect karta hai.

## 37. Final Governance Rules

No silent changes · No invented data · No invented formulas · No automatic Owner approval · No formula modification without formal revision · No production claim without implementation + runtime evidence · No unauthorized client authority · No cross-user private-data access · No architecture change without Owner decision
