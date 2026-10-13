# MarketNiora — Zero-Cost Hosting and Build Plan

**Status:** planning / review required  
**Last checked:** 2026-10-14  
**Goal:** maximise useful work on free tiers without claiming that any provider is unlimited or changing protected architecture without owner approval.

## 1. Current verified starting point

- Public research preview: https://marketniora.miniup.app
- Source of truth: https://github.com/abdul007amk-art/MarketNiora
- Existing reviewable public-site branch / PR: https://github.com/abdul007amk-art/MarketNiora/pull/39
- The MiniUp preview currently hosts six research datasets, each with a 4,187-row source where applicable. The published UI queries those datasets in-browser with DuckDB-Wasm.
- The browser preview is not a production backend. Account login, OIDC session enforcement, owner Google + mandatory TOTP, live market data, canonical observations, and official score outputs are not connected to this public preview.
- Market-data provider D-001 remains OPEN / NOT_SELECTED. Do not advertise the site as a live-data terminal.
- Rotation v1.2 and Stock Score SS-1.0-R3 are OWNER_APPROVED + LOCKED under Blueprint v1.1 and ODR-2026-002. However, this browser-only public preview still must not display official scores because verified market observations/features, the production API path and canonical score snapshots are not connected here.
- Theme Score and Fundamental Score remain NOT_DEFINED until separately approved; keep those outputs disabled.

## 2. Free does not mean unlimited

No platform found for this project offers an unlimited production-grade combination of site builds, hosted database, server execution, authentication, live exchange feeds, and storage at zero cost. Free tiers are quota-limited and may change. Market-data and exchange redistribution rights may add cost or contractual restrictions.

### MiniUp
The existing site is useful for a no-builder-credit, static research preview. The connected account currently reports finite limits (including 1,000 Table API calls/month, up to five tables and 128 records/table, and a finite site count). MiniUp's published default is one Function with 100 production calls/month for signed-in accounts; check account-specific limits before relying on it. Keep bulk research data in existing hosted data files rather than moving it into row tables. Do not build an auth/market-data backend on the assumption that MiniUp Functions or API calls are unlimited.

Official docs: https://www.miniup.io/faqs

### GitHub
Keep source code, methodology, lock manifest, change history and CI in the repository. Use branches and pull requests; do not merge a change merely because one feature branch passes CI if the target branch has unresolved failures.

GitHub Pages can host static public content under its published limits, but it is not the preferred hosting plan for the complete research SaaS. GitHub also restricts use of Pages for certain commercial/SaaS purposes. Prefer a proper application host for the actual product.

Official docs: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages

### Cloudflare Pages / Workers / D1 — possible future option, not yet selected
Cloudflare Pages is a strong candidate for free static frontend hosting. Workers and D1 provide useful free quotas, but these are quotas—not unlimited service. Moving the current backend to Workers/D1 would be a technology and persistence migration, because the repository currently documents Node.js, Prisma and PostgreSQL. **Do not silently migrate** the protected backend, database schema or auth model. A migration would need an explicit architecture decision, a compatibility design, security review, tests and owner approval.

Official docs:
- Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- Workers limits: https://developers.cloudflare.com/workers/platform/limits/
- D1 pricing / limits: https://developers.cloudflare.com/d1/platform/pricing/

### Supabase — non-production read-only audit (2026-10-13/14)
- Production project `MarketNiora` is **INACTIVE**. It was not modified.
- `MarketNiora-NP-Clone-20260920` is **ACTIVE_HEALTHY**. Read-only SQL connectivity succeeded and 14 applied migrations were reported.
- Public auth/session/MFA tables have RLS enabled and zero rows. This proves schema presence, not that the TypeScript auth runtime has passed real CRUD.
- `staging_enrichment.master_4187_staging` contains **4,187 rows**. Its governance import batch is `STAGED`; `owner_authorized_at` is null.
- Canonical `production_layer.canonical_stock`, `raw_stock_observation`, `rotation_score`, `stock_score`, `stock_classification`, `stock_theme_membership`, `value_chain_evidence`, and `shariah_status` are all currently **0 rows** in the inspected non-production clone.
- `governance_layer.provider_registry` and `source_health` are **0 rows**; there are no Supabase Edge Functions in that clone.
- The existing DB-backed auth integration script now **passes in CI** on an isolated PostgreSQL 16 database. It verifies user/session/TOTP/MFA CRUD, token/challenge hashing, AES-GCM encryption, revoke and cleanup. That CI result is not the same as running against the approved Supabase clone.
- Direct runtime CRUD against `MarketNiora-NP-Clone-20260920` remains **PENDING** because the approved clone `DATABASE_URL` and local-dev KMS key are not provisioned to the execution environment. Do not claim the actual clone has passed.

Do not import staged rows into canonical tables without the required Owner authorization and the documented validation/reconciliation gate. Do not create another database, apply migrations, enable paid services or write to production as a workaround. Production and non-production remain separate.

Official docs: https://supabase.com/pricing

## 3. Recommended free-first operating model

1. **Design and source control:** GitHub branches and PRs; keep main protected by tests and review.
2. **Public preview:** retain https://marketniora.miniup.app for the existing public research-data explorer; display clear preview / NOT_CONFIGURED truth states.
3. **No fake runtime:** do not generate placeholder prices, rankings, rotational returns, score snapshots, or successful-login states.
4. **Backend readiness:** repair and test existing source and non-production integration before choosing a production host. No paid service activation or secret provisioning without explicit owner action.
5. **Hosting decision:** after backend verification, compare (a) a compatible free Node/Postgres host and its sleep/availability limits against (b) a formal Cloudflare Workers/D1 migration. Pick one after a documented decision, not a prompt-driven guess.
6. **Market data:** activate no data provider until access, source timestamps, instrument mapping, exchange/calendar handling, data rights and freshness semantics are approved and tested.
7. **Production gate:** enable production only after authentication/MFA, database, provider, monitoring, backup/restore, security tests and deployed end-to-end checks pass.

## 4. Locked rules — cannot be weakened to fit free limits

- Market Classification hierarchy: Sector → Sub-sector → Stock. Master Stock Group is a separate registry, but Stock Group remains a Rotation aggregation level. Rotation aggregation: raw stock observations → Stock Group Rotation → Sub-sector Rotation → Sector Rotation.
- External Nifty 50 / NSE / BSE breadth has ZERO ROLE in Rotation.
- Rotation v1.2 weights: median return 40%, participation 30%, equal-weighted capped return 20%, IQR consistency 10%. Caps: 1D ±8%, 1W ±12%, 1M ±20%, 3M ±30%. CONF_MIN=30 is the Stock Group inclusion/publication gate; 60% is the higher-level aggregation/roll-up eligibility gate; N_REF=20. Confidence is a gate and never a score multiplier.
- D2 FLAT is OWNER_APPROVED by ODR-2026-002 C6: when all valid capped returns are zero, state = FLAT; default 40/30/20/10 weights yield score 40. With valid custom weights, the normal weighted formula applies; do not force a score of 40.
- Stock Score SS-1.0-R3 is OWNER_APPROVED + LOCKED. Official score/rank/rating outputs remain off in the public browser preview until verified features, API integration and canonical score snapshots are connected and tested.
- Theme hierarchy is OWNER_APPROVED by ODR-2026-002 C2: Theme → Sub-theme → Industry → Stock. Company is not a Theme level. Business / Value Chain stays separate inside Stock 360°. Current hosted theme data does not contain a separately verified Sub-theme field, so do not infer one.
- UNKNOWN is never PASS. Missing database/source data is not a real zero.
- Canonical MASTER_4187 seed is immutable. Searches and UI filters must not modify it.
- Exactly five genuinely new, unique stocks per research batch, in original master order.
- Show Shariah ✓ only for explicitly verified compliant status; other states show no marker. Shariah does not affect scores or rotation.
- OIDC-only user login; Owner login uses Google plus mandatory TOTP. Never expose tokens, secrets or MFA data to the client.
- Do not run database migrations, alter schemas, configure providers, enable paid services, or weaken auth as part of free hosting experiments.

## 5. Release checklist

- [ ] Verify the required regression cases for approved D2 FLAT: default weights and valid custom weights; do not change the locked formula.
- [ ] Preserve Theme → Sub-theme → Industry → Stock and verify that missing Sub-theme data is not fabricated; keep Business / Value Chain independent.
- [ ] Verify Stock Score implementation, missing-input redistribution, bounds and edge cases against SS-1.0-R3; do not alter the approved formula.
- [ ] Verify existing DB and NON_PROD auth integration without production writes.
- [ ] Reconcile master rows, symbols and quarantined rows; preserve the immutable seed order.
- [ ] Verify source provenance, freshness, missing-value handling, conflict resolution, backup and restore.
- [ ] Select and approve provider, instrument mapping and market-data usage rights.
- [ ] Wire verified observations to feature calculation and the locked hierarchical Rotation Engine.
- [ ] Wire verified features to the OWNER_APPROVED + LOCKED Stock Score API only after provenance, completeness and missing-input handling are validated.
- [ ] Verify OIDC and Owner Google + TOTP against the running server, not a front-end mock.
- [ ] Run unit, API, security, integration, regression and production smoke tests.
- [ ] Verify the real deployment URL, error monitoring and rollback.
- [ ] Publish only truthful live-data/provider status. Otherwise keep NOT_CONFIGURED / UNAVAILABLE.

## 6. Immediate next actions

- Keep the current MiniUp research preview and its finite usage quotas.
- Maintain code changes on reviewable GitHub branches.
- Correct preview links so the public page directs to the real research preview.
- Continue implementation only in areas that do not require a formula decision, production DB write or paid activation.
- Before deployment, inspect the existing Supabase project health and repository CI in the intended scope. If tooling is not authorised or a service times out, stop and report the blocker instead of retrying destructive actions.

This document records a zero-cost strategy and release gates; it does not assert that production infrastructure or live-market feeds are already active.
