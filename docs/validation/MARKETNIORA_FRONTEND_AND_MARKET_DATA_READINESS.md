# MarketNiora Frontend + Market-Data API Boundary

**Status:** CANONICAL EXPLORER READ APIS ADDED / NON-PRODUCTION ONLY  
**Reviewed:** 12 October 2026  
**Product authority:** Blueprint v1.1 and ODR-2026-001 / ODR-2026-002

## What this change adds

- A responsive same-origin dashboard in `frontend/index.html`, `frontend/assets/styles.css` and `frontend/assets/app.js`.
- The Node API serves only three explicitly allow-listed static paths: `/`, `/assets/app.js`, and `/assets/styles.css`. Arbitrary filesystem paths are never resolved from a request path.
- `GET /market-data/provider-health` reports whether a provider is configured and healthy.
- `GET /market-data/quote/:symbol` returns a source- and timestamp-aware quote response.
- Both routes are wired to a fail-closed `NullMarketDataProvider` until an approved provider is explicitly integrated.
- Read-only canonical workspace APIs expose database counts, bounded stock search, approved Rotation snapshot reads, verified Theme memberships, canonical company detail, verified Value Chain evidence, verified fundamental-tagged DARS evidence and verified Research evidence.
- Endpoint paths: `/workspace/summary`, `/workspace/stocks`, `/workspace/rotation`, `/workspace/themes`, `/workspace/company/:symbol`, `/workspace/value-chain/:symbol`, `/workspace/fundamentals/:symbol`, `/workspace/research/:symbol`.
- The dashboard loads these API responses in the Overview, Stock Explorer, Company Detail, Rotation, Theme Explorer, Value Chain, Fundamentals and Research & Evidence views. Symbol collisions return an exchange-selection response instead of guessing. Missing database wiring returns `NOT_CONFIGURED`; unresolved identities return `NOT_FOUND` / `AMBIGUOUS`, and absent verified evidence remains explicitly unavailable.
- A runnable `backend/src/api/main.ts` entrypoint and `npm start` script are provided for non-production work.
- A production startup gate refuses to start while persistent production authentication/KMS, durable market-data integration and release validation have not been approved and verified.

## Truth semantics

When no provider is configured:

```json
{
  "provider": "NONE_CONFIGURED_MARKET_DATA",
  "configured": false,
  "status": "DOWN",
  "truthState": "NOT_CONFIGURED"
}
```

A quote request returns `price: null`, `dataStatus: SOURCE_REQUIRED`, and `truthState: NOT_CONFIGURED`. This is an intentional truth response, not a failed price lookup that can be filled with zero or a demo value.

A provider health response is not proof that every quote is fresh. Freshness and provenance are carried at the quote boundary and must continue into persisted observations and downstream calculation gates.

The visible 4,187 figure is labelled the canonical seed target. The dashboard does not claim that 4,187 rows are loaded into a runtime database.

## Tests added

The API tests cover:

- no-provider health truth;
- no-provider quote truth;
- workspace routes fail closed when the canonical read store is absent;
- Company Detail distinguishes missing from ambiguous identities;
- Value Chain returns only verified evidence records;
- Fundamental and Research endpoints preserve source/effective/knowledge timestamps;
- symbol-path validation before provider access;
- passthrough of configured provider price/status/source/timestamp;
- fail-closed provider exceptions without raw exception/secret leakage;
- same-origin dashboard asset MIME types and allow-listed asset paths;
- runtime production-startup block.

CI must pass typecheck, API/unit tests, PostgreSQL integration tests, Prisma validation and the protected-engine integrity gate before this PR may be merged.

## Still BLOCKED before production

1. **Real provider:** connect an approved market-data provider and secrets through the sanctioned secrets loader. No provider has been configured by this change.
2. **Instrument identity:** resolve exchange/symbol to a canonical instrument key from an approved mapping; reject unresolved, ambiguous and conflicting mappings.
3. **Durable ingestion:** persist immutable raw observations and canonical observations in PostgreSQL with source ID, observation time, fetch time, status, validation result, dedupe/conflict record and audit/job record. Existing in-memory pipeline stores are not production persistence.
4. **Rotation wiring:** feed verified observations through the locked Stock Group → Sub-sector → Sector rotation aggregation; do not let the UI or API submit unverified arbitrary observation arrays as canonical market truth.
5. **Stock Score wiring:** compute only from approved feature data with the locked SS-1.0-R3 engine and evidence gates.
6. **Stock master import:** validate headers, row count, symbol uniqueness, sector mapping and source provenance before any canonical import. Quarantine malformed/misaligned rows; never silently repair the source.
7. **Runtime population and completeness:** confirm the approved canonical DB has the required rows, source-linked classification paths, DARS evidence and verified value-chain evidence. Fundamentals endpoint is evidence-based, not a complete standardized fundamentals catalogue; populate and validate those source records before claiming coverage.
8. **Authentication/database runtime:** execute `scripts/integrationTest.ts` against the approved NON_PROD Supabase clone with zero rows left after cleanup.
9. **Deployment and operations:** verify OIDC redirect/cookies, production KMS, rate limits, backups/restore, telemetry/alerts and a real deployed smoke test.

## Release rule

Do not remove the production startup guard until all production-specific auth/KMS stores, data provider, durable ingestion, master import, score wiring, security review and deployed runtime checks have evidence of PASS. A green CI is necessary but not sufficient.
