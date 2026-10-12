# MarketNiora

> **Track Smart Money. Spot Sector Rotation.**  
> Source-aware market research and market intelligence — evidence before interpretation.

**Runtime status as of 12 October 2026: NOT PRODUCTION READY.** The repository now contains a same-origin dashboard shell, API routes, locked calculation engines, provider interfaces, authentication/security modules and CI tests. The frontend shell is not proof that market data, database persistence, broker integrations or a production deployment are configured.

## Authoritative product rules

The current authority order is:

1. `docs/MARKETNIORA_MASTER_PRODUCT_BLUEPRINT_v1.1.md`
2. `docs/odr/ODR-2026-001.md`
3. `docs/odr/ODR-2026-002.md`

Do not change locked business rules, hierarchy, scoring formulas or governance controls without the applicable Owner Decision Record.

## What is implemented

| Area | Repository implementation | Runtime truth |
|---|---|---|
| Dashboard | Responsive same-origin UI at `frontend/index.html`, served by the Node HTTP server | UI can run; data surfaces explicit unavailable states |
| Market-data API | `GET /market-data/provider-health`, `GET /market-data/quote/:symbol` | Default provider is `NONE_CONFIGURED_MARKET_DATA`; no live price is claimed |
| Rotation | Locked Rotation v1.2 engine and calculation endpoint | Engine exists; verified persisted observations and full group → sub-sector → sector orchestration are not verified as running |
| Stock Score | Locked SS-1.0-R3 engine and calculation endpoint | Engine exists; scores are not populated from a verified canonical live data pipeline |
| Data pipeline | Provider parsing, normalization, validation, deduplication, conflict checks and quality gate modules | Raw/canonical stores are still in-memory; production PostgreSQL persistence is not wired |
| Company, theme and value chain | Contracts and validation/resolve endpoints; research workbooks contain evidence-linked records | Full canonical DB load, complete explorer API and runtime coverage remain unverified |
| Authentication | Google OIDC, owner TOTP/MFA, session and authorization modules | DB-backed auth is selectable for NON_PROD; clone CRUD integration script still must pass against the approved clone |
| Security & CI | RBAC, CSRF, security headers, rate limiting, audit components, Prisma migrations and tests | Main-branch CI is green; CI is not the same as production runtime validation |
| Broker / notifications | Upstox LTP V3 adapter and verified-symbol resolver contract now have tests | Not activated: no canonical instrument-mapping table/resolver, approved token provisioning or source-timestamp rule; Telegram delivery is also not configured |
| Deployment | Server and frontend can be served same-origin | No verified production deployment/runtime evidence is recorded |

## Data truth rules

- A missing price is `null` and remains unavailable; it is never converted to zero.
- Every quote carries source, timestamp and data status.
- The API distinguishes `LIVE`, `DELAYED`, `STALE`, `MISSING`, `SOURCE_REQUIRED` and `UNKNOWN`.
- `GET /market-data/provider-health` returns `configured: false` and `truthState: NOT_CONFIGURED` when no approved provider is wired.
- The dashboard's 4,187 stock-universe number is labelled a **canonical seed target**, not a claim about currently loaded database rows.
- Generic sector knowledge cannot be promoted to a confirmed supplier, customer or company-specific value-chain fact.
- Verified numerical zero is distinct from missing/unknown (`XX`).

## Locked calculation rules

### Rotation v1.2

Aggregation remains **raw stock observations → Stock Group Rotation → Sub-sector Rotation → Sector Rotation**. The locked score weights are median return 40%, participation 30%, equal-weighted capped return 20%, and IQR consistency 10%. Return caps remain 1D 8%, 1W 12%, 1M 20%, 3M 30%; `CONF_MIN=30`, `N_REF=20`. External-index breadth has zero role.

### Stock Score SS-1.0-R3

Weights remain Momentum 22%, Relative Strength 10%, Trend Quality 8%, Volume Confirmation 8%, Earnings Momentum 18%, Business Quality 16%, Valuation 10%, and Growth/Visibility 8%, with the approved risk-penalty and catalyst rules. The protected engine files must remain unchanged absent explicit Owner approval.

## API paths

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | MarketNiora dashboard |
| GET | `/assets/app.js` | Dashboard logic |
| GET | `/assets/styles.css` | Responsive styles |
| GET | `/health` | HTTP server health only |
| GET | `/market-data/provider-health` | Configured-provider status |
| GET | `/market-data/quote/:symbol` | One-symbol quote + provenance/status |
| POST | `/rotation/calculate` | Locked rotation calculation wrapper |
| POST | `/stock-score/calculate` | Locked Stock Score calculation wrapper |
| POST | `/theme/resolve` | Theme membership resolver |
| POST | `/fundamental/validate` | Fundamental record contract validation |
| POST | `/value-chain/validate` | Value-chain entry contract validation |
| POST | `/research/review` | Authenticated research review gate |
| GET | `/portfolio/:userId` | Authenticated portfolio endpoint |

## Local development

Install dependencies, run the checks, and start a **non-production** local server:

```bash
npm install
npm run typecheck
npm test
npm start
```

The server serves the same-origin dashboard at `/` and its whitelisted assets under `/assets/`. The non-production server binds to `HOST` (default `0.0.0.0`) and `PORT` (default `3000`). **A `NODE_ENV=production` launch is intentionally blocked** while production auth/KMS, durable market-data persistence/provider integration and runtime release gates remain unverified. Do not bypass that guard merely to publish the interface.

### NON_PROD authentication integration

The documented script is `npx tsx scripts/integrationTest.ts`. It must be run only with the approved non-production Supabase clone and the documented NON_PROD environment variables in `docs/validation/MARKETNIORA_DB_AUTH_RUNTIME_INTEGRATION_PENDING.md`. Do not run it using the production database URL. Mark the item complete only after real CRUD passes and test rows are cleaned up.

## Remaining release gates

1. Finalize the canonical Upstox instrument-mapping storage contract, reconcile mappings against official instrument JSON, provision the short-lived access token, approve the source-time/freshness policy, then activate the tested LTP V3 adapter and persist raw/canonical observations in PostgreSQL with provenance and conflict controls.
2. Populate the immutable stock master in the approved database only after import row/column validation and quarantine checks pass.
3. Wire verified observations into hierarchical Rotation and approved feature data into Stock Score without modifying the locked engines. The Upstox adapter intentionally keeps `asOf: null` / `UNKNOWN` until source timestamp and freshness semantics are explicitly approved.
4. Finish canonical company/theme/value-chain/fundamental reads and ensure every visible value has a source/date/truth state.
5. Run the NON_PROD authentication CRUD integration test and a backup/restore rehearsal.
6. Configure approved OIDC, key management, secrets, monitoring, deployment and security boundaries; prove the deployed runtime with integration tests before calling the product production-ready.

## Governance

- Keep specification, implementation and runtime claims separate.
- Do not commit secrets or sample market values.
- Do not apply migrations or perform database writes against production without the approved change and release process.
- Any workbook or research append must be checked against `MASTER_4187_CANONICAL`, `RESEARCH_QUEUE` and `BATCH_CONTROL`; the canonical master remains immutable.
