# MarketNiora Auth Security Review — Static Review

**Review type:** source-code review only  
**Runtime DB integration:** PENDING — requires local execution against the approved non-production Supabase clone  
**Production DB:** not accessed  
**Scope:** Google OIDC verifier, owner TOTP/MFA, session handling, Prisma auth stores, secret handling, auth routes.

## Executive summary

The current auth implementation has strong controls: server-side Google OIDC verification, RS256 enforcement, issuer/audience/expiry checks, email verification, JWKS caching, password-auth removal, owner allow-list + confirmed TOTP, hashed MFA challenges, hashed session tokens, AES-256-GCM non-production TOTP encryption, fail-closed non-production DB protection, and CSRF validation for logout.

No locked MarketNiora formula or rotation/stock-score engine was changed by this review.

## Findings

### MEDIUM — Production cookie hardening should be explicit

`backend/src/api/routes/auth.ts` currently sets `session_token` with `HttpOnly`, `SameSite=Strict`, and `Path=/`, but does not currently include the `Secure` attribute. For production HTTPS deployment, the session cookie should be issued with `Secure` explicitly.

**Recommended remediation:** production cookies should use `Secure; HttpOnly; SameSite=Strict; Path=/`. Development may use non-Secure cookies only when explicitly running local HTTP.

Do not apply this remediation as part of the DB integration task; handle it as a separate auth-hardening change with route tests.

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