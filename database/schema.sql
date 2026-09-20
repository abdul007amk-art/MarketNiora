-- MarketNiora Core Schema
-- Status: IMPLEMENTATION (not yet run against a live database)
-- Reflects locked architecture: Market Classification, Master Stock Group,
-- Theme Intelligence, Rotation, Stock Score — kept as independent tables/engines.

create extension if not exists pgcrypto;

-- ============================================================
-- GOVERNANCE ENUMS (ODR-2026-002 C5/C9)
-- ============================================================
create type identity_role as enum ('OWNER','ADMIN','USER');
create type freshness_status as enum ('LIVE','DELAYED','STALE','UNAVAILABLE');
create type verification_status as enum ('VERIFIED','UNKNOWN');
create type interpretation_status as enum ('NOT_INTERPRETABLE','INTERPRETABLE');
create type workflow_status as enum ('SOURCE_REQUIRED','PENDING','MISSING');

-- ============================================================
-- USERS (Module 4 — Authentication/Identity)
-- password_hash stores a scrypt hash (see backend/src/auth/passwordHashing.ts),
-- never a plaintext or reversible value. This table is NOT yet wired to any
-- real authentication server — see docs/AUTHENTICATION.md for exact scope.
-- ============================================================
create table app_user (
  user_id         uuid primary key default gen_random_uuid(),
  email           text not null unique,
  password_hash   text not null,
  role            identity_role not null default 'USER',
  -- AI_AGENT is deliberately excluded here: it is not a login-capable identity.
  email_verified  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table app_user enable row level security;
-- No policies defined yet, on purpose — same fail-closed default as every
-- other table (see Section "ROW LEVEL SECURITY" below). Module 6/7 (Provider
-- Architecture / Data Pipeline) or the eventual API layer must add explicit
-- policies before any client-facing role can query this table directly.

-- ============================================================
-- CENTRAL STOCK MASTER
-- ============================================================
create table stock_master (
  stock_id        uuid primary key default gen_random_uuid(),
  symbol          text not null unique,
  isin            text unique,
  company_name    text not null,
  status          text not null default 'ACTIVE' check (status in ('ACTIVE','SUSPENDED','DELISTED')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- MARKET CLASSIFICATION: SECTOR -> SUB-SECTOR -> STOCK
-- ============================================================
create table sector (
  sector_id   uuid primary key default gen_random_uuid(),
  name        text not null unique
);

create table sub_sector (
  sub_sector_id uuid primary key default gen_random_uuid(),
  sector_id     uuid not null references sector(sector_id),
  name          text not null,
  unique (sector_id, name)
);

create table stock_classification (
  stock_id      uuid primary key references stock_master(stock_id),
  sub_sector_id uuid not null references sub_sector(sub_sector_id)
  -- NOTE: sector is derived via sub_sector, not stored redundantly here
);

-- ============================================================
-- MASTER STOCK GROUP (separate registry — NOT a classification level)
-- ============================================================
create table stock_group (
  group_id   uuid primary key default gen_random_uuid(),
  name       text not null unique
);

create table stock_group_membership (
  stock_id  uuid not null references stock_master(stock_id),
  group_id  uuid not null references stock_group(group_id),
  primary key (stock_id, group_id)
);

-- ============================================================
-- THEME INTELLIGENCE: THEME -> SUB-THEME -> INDUSTRY -> STOCK (many-to-many)
-- ============================================================
create table theme (
  theme_id   uuid primary key default gen_random_uuid(),
  name       text not null unique
);

create table sub_theme (
  sub_theme_id uuid primary key default gen_random_uuid(),
  theme_id     uuid not null references theme(theme_id),
  name         text not null,
  unique (theme_id, name)
);

create table industry (
  industry_id  uuid primary key default gen_random_uuid(),
  sub_theme_id uuid not null references sub_theme(sub_theme_id),
  name         text not null
);

create table stock_theme_membership (
  stock_id    uuid not null references stock_master(stock_id),
  industry_id uuid not null references industry(industry_id),
  primary key (stock_id, industry_id)
);

-- ============================================================
-- BUSINESS / VALUE CHAIN (Stock 360 detail — not a score)
-- ============================================================
create table value_chain_stage (
  stage_id    uuid primary key default gen_random_uuid(),
  stock_id    uuid not null references stock_master(stock_id),
  stage_name  text not null check (stage_name in (
    'RAW_MATERIAL_INPUT','MINING_EXTRACTION','SOURCING_PROCUREMENT','PROCESSING',
    'MANUFACTURING','CAPACITY_UTILISATION_CAPEX','PRODUCTS_BYPRODUCTS',
    'CUSTOMERS_DISTRIBUTION','DOWNSTREAM_INDUSTRIES','FINAL_END_USE'
  )),
  detail      jsonb,      -- source/origin, supplier, dependency, capacity etc.
  source      text,
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- RAW OBSERVATIONS (immutable, provenance-tracked — feeds Rotation & Score)
-- ============================================================
create table raw_stock_observation (
  observation_id   uuid primary key default gen_random_uuid(),
  stock_id         uuid not null references stock_master(stock_id),
  metric           text not null,               -- e.g. 'return_1d', 'volume'
  value            numeric,
  source           text not null,
  source_timestamp timestamptz not null,
  reported_period  text,
  freshness_status        freshness_status not null default 'UNAVAILABLE',
  verification_status     verification_status not null default 'UNKNOWN',
  interpretation_status   interpretation_status not null default 'INTERPRETABLE',
  workflow_status         workflow_status not null default 'PENDING',
  created_at       timestamptz not null default now()
);
-- Immutable by convention: no UPDATE grants in application role; corrections are new rows.

-- ============================================================
-- ROTATION (Stock Group -> Sub-sector -> Sector) — v1.2 LOCKED
-- ============================================================
create table rotation_score (
  rotation_id   uuid primary key default gen_random_uuid(),
  level         text not null check (level in ('STOCK_GROUP','SUB_SECTOR','SECTOR')),
  entity_id     uuid not null,        -- group_id / sub_sector_id / sector_id depending on level
  horizon       text not null check (horizon in ('1D','1W','1M','3M')),
  median_return numeric,
  participation numeric,
  ew_capped_return numeric,
  iqr_consistency numeric,
  confidence    numeric not null,     -- inclusion gate, CONF_MIN = 30
  final_score   numeric,
  calculated_at timestamptz not null default now(),
  formula_version text not null default 'ROTATION-1.2'
);

-- ============================================================
-- STOCK SCORE — SS-1.0-R3 LOCKED
-- ============================================================
create table stock_score (
  score_id       uuid primary key default gen_random_uuid(),
  stock_id       uuid not null references stock_master(stock_id),
  momentum       numeric,
  earnings_momentum numeric,
  business_quality numeric,
  relative_strength numeric,
  valuation      numeric,
  trend_quality  numeric,
  volume_confirmation numeric,
  growth_visibility numeric,
  base_score     numeric,
  risk_penalty   numeric check (risk_penalty between -30 and 0),
  catalyst       numeric check (catalyst in (0,4,8,12)),
  final_score    numeric check (final_score between 0 and 100 or final_score is null), -- NULL = N/A (suspended/delisted)
  confidence     numeric not null,   -- data reliability, NOT multiplied into final_score
  calculated_at  timestamptz not null default now(),
  formula_version text not null default 'SS-1.0-R3'
);

-- ============================================================
-- SHARIAH STATUS (verified-only display)
-- ============================================================
create table shariah_status (
  stock_id   uuid primary key references stock_master(stock_id),
  status     text not null check (status in ('VERIFIED_SHARIAH','NON_SHARIAH','PENDING')),
  -- application layer: only VERIFIED_SHARIAH renders; NON_SHARIAH/PENDING render nothing
  source     text,
  updated_at timestamptz not null default now()
);

-- ============================================================
-- AUDIT LOG (append-only — no application-level DELETE/UPDATE)
-- ============================================================
create table audit_log (
  audit_id    uuid primary key default gen_random_uuid(),
  actor_type  text not null check (actor_type in ('OWNER','ADMIN','USER','AI_AGENT','SYSTEM')),
  actor_id    uuid,
  action      text not null,
  target      text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY — fail-closed default (Client = Untrusted)
-- No policies are defined yet on purpose: with RLS enabled and zero
-- policies, Postgres denies ALL access to non-privileged roles by
-- default. Module 3 (Security Foundation) must add explicit policies
-- before any client-facing role can read/write these tables.
-- ============================================================
alter table stock_master enable row level security;
alter table sector enable row level security;
alter table sub_sector enable row level security;
alter table stock_classification enable row level security;
alter table stock_group enable row level security;
alter table stock_group_membership enable row level security;
alter table theme enable row level security;
alter table sub_theme enable row level security;
alter table industry enable row level security;
alter table stock_theme_membership enable row level security;
alter table value_chain_stage enable row level security;
alter table raw_stock_observation enable row level security;
alter table rotation_score enable row level security;
alter table stock_score enable row level security;
alter table shariah_status enable row level security;
alter table audit_log enable row level security;

-- ============================================================
-- IMMUTABILITY ENFORCEMENT — DB-level, not just convention
-- audit_log and raw_stock_observation are append-only: corrections
-- must be new rows, never edits to history.
-- ============================================================
create or replace function reject_update_delete()
returns trigger as $$
begin
  raise exception 'This table is append-only. % is not permitted on %.', TG_OP, TG_TABLE_NAME;
end;
$$ language plpgsql;

create trigger audit_log_immutable
  before update or delete on audit_log
  for each row execute function reject_update_delete();

create trigger raw_observation_immutable
  before update or delete on raw_stock_observation
  for each row execute function reject_update_delete();
