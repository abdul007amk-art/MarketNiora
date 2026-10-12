# Upstox LTP V3 Adapter — Readiness and Integration Gate

**Status:** Adapter implemented with tests; runtime wiring intentionally blocked pending canonical instrument mapping and an owner-approved persistence contract.  
**Reviewed:** 12 October 2026.

## Official upstream documentation

- [Upstox LTP Quotes V3](https://upstox.com/developer/api-documentation/ltp-v3/)
- [Upstox Instruments](https://upstox.com/developer/api-documentation/instruments/)
- [Upstox Get Token](https://upstox.com/developer/api-documentation/get-token/)

The V3 quote request uses a server-side bearer access token and a uniquely resolved `instrument_key`. Upstox recommends its JSON instrument files; its documentation identifies `instrument_key` as the durable instrument identifier and notes that exchange tokens may be reused.

## Implemented in this PR

- `backend/src/providers/upstoxLtpProvider.ts` implements the Upstox V3 LTP HTTP request through an injectable fetch function.
- `resolveVerifiedNseInstrumentKey()` and `VerifiedNseInstrumentKeyResolver` accept only one distinct, `VERIFIED` NSE mapping in the injected mapping snapshot.
- Missing, malformed, unverified or conflicting instrument mappings return `price: null` and `SOURCE_REQUIRED`; the provider never guesses an instrument.
- HTTP/transport failures return a generic provider exception to the API boundary; upstream bodies, tokens and internal details are not included in error messages.
- A returned numerical LTP is marked `UNKNOWN` with `asOf: null` because the fields consumed by this adapter do not provide an approved source timestamp for MarketNiora's truth/freshness contract. The API must not relabel the value as `LIVE` merely because an HTTP request succeeded.
- The latest successful quote request can verify provider connectivity for up to 60 seconds. Health status is not a per-quote freshness guarantee.

## Configuration

Use `UPSTOX_ACCESS_TOKEN` only in the server secret environment. It must never be included in frontend JavaScript, JSON responses, logs, screenshots, the repository, or a committed `.env` file.

Upstox documentation says access tokens expire at **03:30 IST on the following day**. This adapter does not implement OAuth authorization, code exchange, automated token rotation or renewal; a valid token must be provisioned via the approved OAuth flow.

## Why it is not activated by default

The current Prisma schema contains `CanonicalStock` and `RawStockObservation`, but it does not yet provide an approved durable table/contract for exchange symbol → Upstox `instrument_key` mapping and mapping evidence. Existing mapping rows from an untrusted workbook or Base44 export must not be assumed canonical. The provider therefore stays an injected adapter and the running application keeps `NullMarketDataProvider` as its default.

## Required before runtime activation

1. Owner-approved instrument-mapping storage/API contract and a data migration plan.
2. An import/reconciliation job that matches canonical stock identity, exchange, trading symbol, segment, instrument type, unique key and current source status.
3. A duplicate/conflict gate: only one `VERIFIED` NSE EQ mapping per canonical instrument; ambiguity returns `SOURCE_REQUIRED`.
4. Secret provisioning through the approved secrets manager and an approved Upstox OAuth token lifecycle.
5. A data timestamp/freshness rule that can justify a `LIVE` or `DELAYED` label. Until that is approved and supported by response data, keep `asOf: null` / `UNKNOWN`.
6. Non-production integration tests that call Upstox using an explicitly provisioned token and mapping; do not put real credentials into CI fixtures.
7. PostgreSQL persistence for immutable raw observations and canonical observations, plus validation, audit/job logs, source health and conflict records.
8. Only after all gates pass, inject this provider into `AppDependencies`; do not remove the production startup block before broader production security and runtime gates also pass.

No credentials, mapping rows or production configuration have been added by this change.
