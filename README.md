# MarketNiora Repository

> Source-aware Market Research + Market Intelligence platform.
> Full spec: see `/docs/MARKETNIORA_MASTER_PRODUCT_BLUEPRINT_v1.1.md`

## ⚠ Current Status (read before assuming anything works)

Per Blueprint v1.1 Section 34 (Implementation Truth), this repo distinguishes:
- **SPECIFICATION** — described in docs, not yet code
- **IMPLEMENTATION** — code exists, NOT runtime-tested
- **RUNTIME** — actually tested and verified

| Module | Status |
|---|---|
| Repository structure | IMPLEMENTATION |
| Database schema (core tables) | IMPLEMENTATION — audited (pgcrypto extension, RLS fail-closed on all 16 tables, immutability DB-triggers on audit_log/raw_stock_observation); still not yet run against a real DB |
| Security Foundation (RBAC, fail-closed authz, audit, secrets, headers, rate limiter, CSRF) | IMPLEMENTATION — RUNTIME TESTED, OWNER APPROVED (see docs/SECURITY_FOUNDATION.md). Login/signup/MFA itself is Module 4/5 |
| Authentication / Identity (signup, login, sessions, verification tokens) | IMPLEMENTATION — RUNTIME TESTED, OWNER APPROVED (see docs/AUTHENTICATION.md) |
| Owner Authorization + MFA (TOTP, atomic recovery codes, atomic MFA proof, Admin↛Owner boundary) | IMPLEMENTATION — RUNTIME TESTED, OWNER APPROVED (see docs/OWNER_MFA.md) |
| Provider Architecture (market data, notifications, provider registry, secrets-based config) | IMPLEMENTATION — RUNTIME TESTED, OWNER APPROVED (see docs/PROVIDER_ARCHITECTURE.md) |
| Data Pipeline + Provenance (raw store, normalize, validate, dedupe, conflict resolution, quality check, canonical store, job log) | IMPLEMENTATION — RUNTIME TESTED, OWNER APPROVED (Quality-Check-before-Canonical-DB locked as Option A). See docs/DATA_PIPELINE.md |
| Rotation Engine v1.2 + Stock Score Engine SS-1.0-R3 (Modules 8/9, standalone audit) | RUNTIME TESTED, OWNER APPROVED. Finding 9-A (catalyst runtime guard) closed. See docs/ROTATION_STOCKSCORE_AUDIT.md |
| Peers / Theme / Fundamental / Value Chain contracts (Module 10) | RUNTIME TESTED, OWNER APPROVED. See docs/PEERS_THEME_FUNDAMENTAL_VALUECHAIN.md. NO Theme Score or Fundamental Score formula (deliberately deferred, scope lock) |
| AI Research / News / Alerts (Module 11) | RUNTIME TESTED, OWNER APPROVED. See docs/AI_RESEARCH.md |
| Portfolio / OAuth (Module 12) | RUNTIME TESTED, OWNER APPROVED. See docs/PORTFOLIO_OAUTH.md |
| API Layer (Module 13) | IMPLEMENTATION — RUNTIME TESTED (25 tests, see docs/API_LAYER.md). **Real `node:http` server, tested via real HTTP requests** (not mocked) — session auth, RBAC, portfolio privacy, CSRF, rate limiting, and error sanitization all verified over actual HTTP round trips. ⚠ NOT connected to real Postgres or real Upstox/Telegram — in-memory stores only, dependency-injected providers not wired to real network. HTTP runtime: implemented and tested locally; persistence/external-provider integration remains a pending boundary |
| API layer | **NOT STARTED** |
| Frontend (web/mobile) | **NOT STARTED** |
| Payments/entitlements | **NOT STARTED** |

**Run `npm test` yourself — 319/319 as of this commit.** No claim of "production ready" applies to anything in this repo yet: modules are runtime-tested at the unit level, but nothing is wired to a live server, load-tested, or independently penetration-tested. Do not deploy this with real user data or real money flows.

## Stack decision (zero/near-zero cost)

- **Database + Auth:** Supabase (Postgres + built-in Auth + Row Level Security) — free tier
- **Backend:** Node.js + TypeScript, deployable as serverless functions
- **Hosting:** Vercel or Cloudflare Pages — free tier
- **Alerts:** Telegram Bot API — free
- **Market data (Phase 1):** NSE/BSE official end-of-day bhavcopy (free, delayed) — live paid feed is a later, explicit Owner decision, not assumed here

## Folder structure

```
/docs        → governance & master guide
/database    → schema.sql (core tables)
/backend
  /src/protected   → locked formula engines (Rotation, Stock Score) — Owner-approval required to touch
  /src/services    → business logic (not yet built)
  /src/routes      → API routes (not yet built)
  /src/middleware  → auth/security middleware (not yet built)
/infra       → deployment notes
/scripts     → data import/utility scripts (not yet built)
/tests       → REAL test suite — run `npm test` (319/319 passing, see docs/TESTING.md)
```

## Next module (per Approval Gate — needs Owner sign-off before starting)

Module 14: **Website** — public pages (Landing, About, How It Works, Pricing, Security/Trust, Legal, Privacy, Terms, Support) per Master Guide Section 30. No new backend logic — this wires the existing API layer (Module 13) into a real frontend.
