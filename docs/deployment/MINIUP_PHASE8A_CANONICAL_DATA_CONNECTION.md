# MiniUp Phase 8A — canonical source connection

**Published site:** https://marketniora-phase8a-proxy-fix.miniup.app  
**Page:** `index.html`  
**Last checked:** 2026-10-15  
**Architecture:** Browser-side DuckDB-Wasm reads six owner-approved hosted Parquet datasets via their grant endpoints. No copy of the 4,187 stock rows or legacy value-chain profile JSON is embedded in the published HTML.

## Approved read-only bundles

Both bundles are active and targeted at site `marketniora-phase8a-proxy-fix`. Inspection confirms the target site is included in selected-site access.

| Bundle | ID | Datasets |
|---|---|---|
| MarketNiora Canonical Workspace Bundle | `6dbdca4f-e10a-403c-bf03-47423541eabc` | Immutable MASTER_4187 canonical source (4,187 rows); Full Hierarchy Mapping Register (4,187 rows) |
| MarketNiora Taxonomy & Research Workspace Bundle | `c8efbd1a-1b91-421c-8614-5ca22ece2e97` | Market Classification (4,187); Stock Group Registry (145); Theme Map (161); Company Profiles (4,187) |

The page calls each data-file `grantUrl` with POST, downloads the returned secure URL, registers Parquet with DuckDB-Wasm, and queries only the declared source columns.

## Integrity and truth-state rules

- MASTER_4187 and the hierarchy register must each return exactly 4,187 rows before the canonical stock list is applied.
- Supplemental sources must match their recorded row counts: 4,187 / 145 / 161 / 4,187. A mismatch causes that feed to be marked unavailable rather than partially displayed.
- Identity linking uses exchange + symbol for the canonical source/register and strict symbol + normalized company name where a source lacks exchange. Ambiguous matches are not guessed.
- Source order is reported as aligned only if the full row-order sequence and identity keys agree. Source files are never rewritten or reordered in storage.
- Mapping labels are displayed literally. `EVIDENCE_PRESENT`, `Needs Verification`, `Existing Theme Group — Review`, and source `Research_Status=Verified` are not silently normalized into a universal verified status. Theme membership never alters Rotation v1.2 or Stock Score SS-1.0-R3.
- The Shariah display rule is preserved: no non-verified or pending label/marker is surfaced.
- Stock 360 and CSV export use the hosted Company Profiles feed. The old embedded `VALUE_CHAIN_DATA` payload was removed to avoid stale or conflicting fallback facts.
- Data access failure remains a visible unavailable state. There is no static/demo data fallback and no fabricated price, score, mapping or source status.

## Non-production and market-data boundaries

GitHub’s canonical read APIs (`/workspace/summary`, `/workspace/stocks`, `/workspace/rotation`, `/workspace/themes`, `/workspace/company/:symbol`, `/workspace/value-chain/:symbol`, `/workspace/fundamentals/:symbol`, `/workspace/research/:symbol`) remain guarded by the existing approved NON_PROD database target. The MiniUp page’s bundled Parquet feed is a separate read path; neither implies that the backend is deployed to production.

Yahoo Finance via a public CORS relay is still an unofficial quote snapshot with unverified freshness/entitlement. Watchlist, price alerts and paper positions are browser-local only. Upstox OAuth and Master import remain disabled until server-side credential storage, callback validation, identity-conflict review and deployment integration tests pass.

## Validation record and outstanding release gate

- Published HTML: 264,796 bytes at last MiniUp site-details check.
- Classic JavaScript and module JavaScript passed `node --check` in the generation environment.
- GitHub main at `778a834f230f9c6ba1b4298d2d97747f91281d6b` had passing MarketNiora CI and Validation runs.
- **Not yet verified:** actual browser execution of the DuckDB-Wasm loader and cross-origin grant/download requests. A browser smoke test must confirm both 4,187-row gates, all four optional feeds, Theme Explorer filters, and visible unavailable states when a feed is blocked. Until that run, do not declare the entire site production-ready.
