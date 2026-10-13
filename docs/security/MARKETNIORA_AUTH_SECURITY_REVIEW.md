# MarketNiora Auth Security Review — Static Review

**Review type:** source-code review plus read-only Supabase advisor inspection  
**CI DB integration:** PASS on isolated PostgreSQL fixture; **actual Supabase NON_PROD runtime:** PENDING  
**Production DB:** not accessed  
**Scope:** Google OIDC verifier, owner TOTP/MFA, session handling, Prisma auth stores, secret handling, auth routes.

## Executive summary

The current auth implementation has strong controls: server-side Google OIDC verification, RS256 enforcement, issuer/audience/expiry checks, email verification, JWKS caching, password-auth removal, owner allow-list + confirmed TOTP, hashed MFA challenges, hashed session tokens, AES-256-GCM non-production TOTP encryption, fail-closed non-production DB protection, and CSRF validation for logout.

No locked MarketNiora formula or rotation/stock-score engine was changed by this review.

## Findings

### MEDIUM — Production cookie hardening (remediated in source; runtime release verification pending)

`backend/src/api/sessionCookies.ts` centralises session and CSRF cookie attributes. Production mode adds `Secure`; the session cookie remains `HttpOnly`; the CSRF cookie remains script-readable for the existing double-submit design.

**Source remediation:** merged to `main` and CI-tested, including explicit production/development attribute assertions. **Runtime release gate:** verify the attributes on the deployed HTTPS runtime after hosting is configured. CI/source tests alone do not prove production configuration.

### MEDIUM — Trigger functions have mutable search_path (Supabase Advisor, 2026-10-13)

The approved non-production Supabase clone's security advisor reported `function_search_path_mutable` warnings for:
- `public.reject_append_only_mutation()`
- `public.reject_locked_formula_mutation()`
- `public.enforce_owner_totp_owner_role()`

A reviewed source migration, `database/migrations/015_security_function_search_path.sql`, sets the functions' `search_path` to an explicit empty value. Their bodies use schema-qualified relations/types or PL/pgSQL trigger metadata, so they do not need implicit application-schema resolution.

**Status:** source-only remediation prepared for review. The migration has **not** been applied to the Supabase clone or production. An isolated PostgreSQL CI fixture validates the migration configuration. After approved NON_PROD migration application, rerun the Supabase Security Advisor and verify these three findings disappear before considering any production change.

Remediation reference: [Supabase database linter — Function Search Path Mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).

### MEDIUM — Chunked request body limit counted characters rather than bytes (source fix + CI verification)

The HTTP server previously converted each request chunk to UTF-8 text and incremented its limit counter by JavaScript string length. A chunked multibyte payload could therefore exceed the configured 1 MiB byte ceiling without exceeding the character count.

**Source remediation in review:** the server now counts raw received Buffer bytes before decoding, stops buffering once the 1 MiB limit is crossed, drains the remaining request without retaining it, and returns HTTP 413. A real HTTP regression test streams a 1.2 MiB UTF-8 JSON body with `Transfer-Encoding: chunked` and no `Content-Length`, asserting the 413 response. The existing early Content-Length guard remains.

### MEDIUM — Authentication rate limiter was not enforced by routes (source fix + CI verification)

The server already constructed a fixed-window limiter at 5 attempts per 60 seconds, but the Google OIDC login and Owner TOTP/MFA handlers did not consult it.

**Source remediation in review:** OIDC login and Owner MFA now call the limiter before token/challenge validation. Requests that exceed the per-socket-peer-IP window receive HTTP 429 with `Retry-After` and `Cache-Control: no-store`. Each route has a separate bucket. The address is derived from Node's socket peer, not the client-controlled `X-Forwarded-For` header. Tests exercise repeated HTTP requests, spoofed forwarding headers and Retry-After boundary behavior.

**Additional source hardening:** the default in-memory map is capped at 10,000 tracked keys. When capacity is needed, expired windows are pruned; if every slot is still active, unseen keys fail closed until a window expires. `Retry-After` reports the earliest expected capacity expiry, and regression tests cover this boundary.

**Remaining limitation:** this limiter is still in-memory and explicitly reports `productionReady=false`. It is effective only within one process, resets on restart, and does not enforce a shared limit across multiple instances. The production runtime gate must remain in place until a durable shared rate-limit store and deployed tests are approved.

### LOW — OIDC token-age policy could be stricter

The verifier checks `exp` and rejects an `iat` more than 60 seconds in the future, but does not impose a separate maximum token age. A bounded age policy could further reduce acceptance of unusually old-but-unexpired tokens. Do not invent a value without documenting the policy.

### LOW — JWKS operational hardening

The verifier refreshes JWKS when the cache expires and also refreshes when a requested key ID is absent. Future hardening could add bounded retry/backoff and configuration validation. No specific vulnerability was established from this behavior alone.

### INFORMATIONAL — Full browser OIDC flow needs state/nonce/PKCE

The current backend accepts a Google ID token at `/auth/oidc/google`; it is not the browser authorization-code redirect implementation. If a redirect flow is added later, use state validation, OIDC nonce validation, PKCE where applicable, and strict redirect URI registration.

### INFORMATIONAL — Runtime integration remains unverified

CI validates TypeScript/tests/Prisma schema but does not prove real CRUD against Supabase. `scripts/integrationTest.ts` is intentionally pending until it can be executed with the real non-production credentials.

## Reviewed with no specific defect established

- password fields in the new auth store interfaces
- plaintext session-token persistence
- plaintext TOTP persistence
- plaintext MFA challenge persistence
- MFA challenge replay after successful consumption
- five-attempt MFA limit
- five-minute MFA challenge expiry
- production/non-production DB separation guard
- secret loading without logging secret values
- client-supplied role fields being trusted directly during session validation

## Next runtime validation

1. Use the approved non-production DATABASE_URL.
2. Set `MARKETNIORA_DB_TARGET=NON_PROD`.
3. Set `KMS_PROVIDER=local-dev`.
4. Set `KMS_LOCAL_MASTER_KEY`.
5. Run `npx tsx scripts/integrationTest.ts`.
6. Confirm PASS and zero remaining test rows.

Until then, DB-backed auth is **CI-validated / runtime-integration-pending**, not fully integration-tested.