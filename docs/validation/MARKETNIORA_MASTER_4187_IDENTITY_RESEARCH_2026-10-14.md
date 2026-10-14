# MASTER_4187 Identity Conflict Research — 2026-10-14

**Purpose:** prepare evidence-based candidates for Owner review of the four exchange/symbol conflicts found in the staged MASTER_4187 batch.

**Scope:** research only. No staging rows, identity statuses, source-row order, canonical stocks, or import authorization were changed. This document is not an Owner resolution and does not authorize canonical import.

## Executive summary

Official NSE filings support the following instrument identities:

| Source rows | Staged symbol | Official exchange instrument | Evidence-based finding | Suggested review disposition |
|---|---|---|---|---|
| 755–756 | NSE:SUULD | Suumaya Industries Limited; ISIN INE591Q01016 | NSE-filed company disclosure identifies SUULD and the ISIN with Suumaya Industries Limited. No primary evidence reviewed here ties Suumaya Corporation Limited to this instrument. | Keep both source rows quarantined until the Owner confirms the intended entity and the source row that should represent the instrument. Do not merge the two legal names. |
| 2470–2471 | NSE:SURAJLTD | Suraj Limited; ISIN INE713C01016 | NSE Integrated Filing identifies SURAJLTD as Suraj Limited. | Candidate: retain Suraj Limited as the entity for SURAJLTD; keep Suraj Industries Ltd. row quarantined as a symbol/name conflict until Owner resolution. |
| 3303–3304 | NSE:DCMSHRIRAM | DCM Shriram Limited; ISIN INE499A01024 | NSE filing maps DCMSHRIRAM to DCM Shriram Limited. A separate NSE filing maps DCM Shriram Industries Limited to DCMSRIND, ISIN INE843D01027. | Candidate: DCMSHRIRAM belongs to DCM Shriram Limited; DCM Shriram Industries Limited must not retain this ticker. Owner must resolve the wrong-symbol row and review classification separately. |
| 4165–4166 | NSE:PTC | PTC India Limited; ISIN INE877F01012 | NSE filing maps PTC to PTC India Limited. NSE filing maps PTC Industries Limited to PTCIL, ISIN INE596F01018. | Candidate: PTC belongs to PTC India Limited; PTC Industries Limited must not retain this ticker. Owner must resolve the wrong-symbol row and review sector classification separately. |

## Primary exchange evidence

### 1. SUULD — Suumaya Industries Limited vs Suumaya Corporation Limited

- [NSE-filed disclosure dated 27 September 2025](https://nsearchives.nseindia.com/corporate/SUULD_27092025172618_Intimation-Closure_of_Trading_Window.pdf) identifies **Suumaya Industries Limited**, symbol **SUULD**, ISIN **INE591Q01016**.
- [NSE-filed company letter dated 1 June 2023](https://nsearchives.nseindia.com/corporate/SUULD_01062023181638_IntimationAdjudicationSIL.pdf) also identifies Suumaya Industries Limited and symbol SUULD.
- The staged row for “Suumaya Corporation Limited” carries the same `NSE:SUULD` ticker, but no ISIN is present in the staging schema. The reviewed exchange evidence does not establish that Suumaya Corporation Limited is the legal issuer of SUULD.

**Conclusion:** strong evidence for the SUULD instrument identity, but the source-row correction still requires Owner review. Do not merge legal entities based on similar names.

### 2. SURAJLTD — Suraj Industries Ltd vs Suraj Limited

- [NSE Integrated Filing, 24 July 2025](https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_105266_24072025172723_iXBRL_WEB.html) identifies symbol **SURAJLTD**, ISIN **INE713C01016**, company **SURAJ LIMITED**.
- [NSE-filed board-meeting outcome, October 2024](https://nsearchives.nseindia.com/corporate/SURAJLTD_24102024162227_Outcomeofboardmeeting3009.pdf) independently identifies Suraj Limited and SURAJLTD.

**Conclusion:** exchange identity supports Suraj Limited for SURAJLTD. “Suraj Industries Ltd” must not be silently rewritten or merged; it remains a separate quarantined source row pending Owner resolution.

### 3. DCMSHRIRAM — DCM Shriram Limited vs DCM Shriram Industries Limited

- [NSE Integrated Filing, 13 May 2026](https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_143628_14022026205330_iXBRL_WEB.html) identifies **DCMSHRIRAM**, ISIN **INE499A01024**, as **DCM Shriram Limited**.
- [NSE Integrated Filing, 20 May 2026](https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_159512_20052026231634_iXBRL_WEB.html) identifies **DCMSRIND**, ISIN **INE843D01027**, as **DCM Shriram Industries Limited**.

**Conclusion:** the staged row pairing DCM Shriram Industries Limited with DCMSHRIRAM conflicts with exchange instrument identity. Preserve it in quarantine until the Owner resolves the row. Any sector/sub-sector correction is a separate classification review, not implied by the ticker correction.

### 4. PTC — PTC India Limited vs PTC Industries Limited

- [NSE Integrated Filing, 19 May 2026](https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_158972_19052026191016_iXBRL_WEB.html) identifies **PTC**, ISIN **INE877F01012**, as **PTC India Limited**.
- [NSE Integrated Filing, 30 May 2026](https://nsearchives.nseindia.com/corporate/ixbrl/INTEGRATED_FILING_INDAS_165101_30052026211420_iXBRL_WEB.html) identifies **PTCIL**, ISIN **INE596F01018**, as **PTC Industries Limited**.

**Conclusion:** the staged row pairing PTC Industries Ltd with ticker PTC conflicts with exchange instrument identity. Its staged sector is also “Utilities”, which must be reviewed separately against the approved Market Classification evidence. Do not automatically reclassify it from this identity finding alone.

## Required workflow before import

1. Preserve all original staging rows and source-row numbers.
2. Record each Owner decision through the governed identity-resolution process; attach the cited primary exchange filing as evidence.
3. Resolve the four symbol/name conflicts without merging distinct legal entities.
4. Review sector/sub-sector classifications independently, including missing sector for source row 4187 (Emkay Tools Limited).
5. Re-run readiness checks. Migration 016 correctly keeps the batch blocked until all rows are explicitly VERIFIED, sector coverage is valid, conflicts are closed and Owner authorization is recorded.
6. Only then may the separate Owner-authorized canonical import transaction be considered.

**Current state remains:** batch `STAGED`; 4,178 rows PENDING, 9 QUARANTINED; four identity conflicts open; Owner authorization absent; canonical import not performed.