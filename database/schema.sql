-- MarketNiora authoritative SQL schema
-- Generated directly from database/prisma/schema.prisma.
-- Prisma schema SHA at generation: d3dfe1eb2c3df3eddbb2863de918f45757b9a013
-- Password authentication is deprecated; the legacy password column is intentionally absent.
-- No data, RLS policies, views, triggers, or functions are defined here unless
-- directly represented by the Prisma schema.

CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS governance_layer;
CREATE SCHEMA IF NOT EXISTS production_layer;
CREATE SCHEMA IF NOT EXISTS staging_enrichment;

CREATE TYPE public."IdentityRole" AS ENUM ('USER', 'ADMIN', 'OWNER');
CREATE TYPE production_layer."FreshnessStatus" AS ENUM ('LIVE', 'DELAYED', 'STALE', 'UNAVAILABLE');
CREATE TYPE production_layer."VerificationStatus" AS ENUM ('VERIFIED', 'UNKNOWN');
CREATE TYPE production_layer."InterpretationStatus" AS ENUM ('NOT_INTERPRETABLE', 'INTERPRETABLE');
CREATE TYPE production_layer."WorkflowStatus" AS ENUM ('SOURCE_REQUIRED', 'PENDING', 'MISSING');

CREATE TABLE public.app_user (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oidc_issuer text NOT NULL,
  oidc_subject text NOT NULL,
  email text NOT NULL UNIQUE,
  email_verified boolean NOT NULL,
  role public."IdentityRole" NOT NULL DEFAULT 'USER',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL,
  last_login_at timestamptz(6),
  disabled_at timestamptz(6),
  CONSTRAINT app_user_oidc_issuer_oidc_subject_key UNIQUE (oidc_issuer, oidc_subject)
);
CREATE INDEX app_user_role_idx ON public.app_user (role);

CREATE TABLE public.session (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  last_seen_at timestamptz(6),
  expires_at timestamptz(6) NOT NULL,
  revoked_at timestamptz(6),
  CONSTRAINT session_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(user_id) ON DELETE RESTRICT
);
CREATE INDEX session_user_id_expires_at_idx ON public.session (user_id, expires_at);
CREATE INDEX session_user_id_revoked_at_idx ON public.session (user_id, revoked_at);

CREATE TABLE public.entitlement (
  entitlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tier text NOT NULL,
  source text NOT NULL,
  status text NOT NULL,
  payment_ref text,
  starts_at timestamptz(6) NOT NULL,
  ends_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL,
  revoked_at timestamptz(6),
  CONSTRAINT entitlement_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(user_id) ON DELETE RESTRICT
);
CREATE INDEX entitlement_user_id_status_idx ON public.entitlement (user_id, status);
CREATE INDEX entitlement_user_id_starts_at_ends_at_idx ON public.entitlement (user_id, starts_at, ends_at);

CREATE TABLE public.feature_policy (
  feature_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL,
  updated_by_user_id uuid,
  reason text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL,
  CONSTRAINT feature_policy_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.app_user(user_id) ON DELETE RESTRICT
);
CREATE INDEX feature_policy_updated_by_user_id_idx ON public.feature_policy (updated_by_user_id);

CREATE TABLE public.formula_version (
  formula_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_key text NOT NULL,
  version text NOT NULL,
  formula_hash text NOT NULL,
  configuration_snapshot jsonb,
  owner_approved_by_user_id uuid,
  owner_approved_at timestamptz(6),
  locked_at timestamptz(6),
  supersedes_version_id uuid,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT formula_version_owner_approved_by_user_id_fkey FOREIGN KEY (owner_approved_by_user_id) REFERENCES public.app_user(user_id) ON DELETE RESTRICT,
  CONSTRAINT formula_version_supersedes_version_id_fkey FOREIGN KEY (supersedes_version_id) REFERENCES public.formula_version(formula_version_id) ON DELETE RESTRICT,
  CONSTRAINT formula_version_formula_key_version_key UNIQUE (formula_key, version)
);
CREATE INDEX formula_version_formula_key_locked_at_idx ON public.formula_version (formula_key, locked_at);

CREATE TABLE public.owner_totp_secret (
  user_id uuid PRIMARY KEY,
  secret_ciphertext bytea NOT NULL,
  kms_key_ref text NOT NULL,
  key_version text,
  confirmed_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  rotated_at timestamptz(6),
  disabled_at timestamptz(6),
  CONSTRAINT owner_totp_secret_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(user_id) ON DELETE RESTRICT
);

CREATE TABLE public.owner_mfa_challenge (
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_hash bytea NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  expires_at timestamptz(6) NOT NULL,
  consumed_at timestamptz(6),
  CONSTRAINT owner_mfa_challenge_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.app_user(user_id) ON DELETE RESTRICT
);
CREATE INDEX owner_mfa_challenge_user_id_expires_at_idx ON public.owner_mfa_challenge (user_id, expires_at);
CREATE INDEX owner_mfa_challenge_user_id_consumed_at_idx ON public.owner_mfa_challenge (user_id, consumed_at);

CREATE TABLE public.app_audit_log (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT app_audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.app_user(user_id) ON DELETE RESTRICT
);
CREATE INDEX app_audit_log_actor_id_created_at_idx ON public.app_audit_log (actor_id, created_at);
CREATE INDEX app_audit_log_action_created_at_idx ON public.app_audit_log (action, created_at);

CREATE TABLE governance_layer.audit_log (
  audit_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT governance_audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES public.app_user(user_id) ON DELETE RESTRICT
);

CREATE TABLE governance_layer.master_import_batch (
  batch_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name text NOT NULL,
  source_hash text,
  status text NOT NULL,
  owner_authorized_at timestamptz(6),
  created_at timestamptz(6) NOT NULL DEFAULT now()
);

CREATE TABLE governance_layer.identity_conflict (
  conflict_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL,
  exchange text NOT NULL,
  symbol text NOT NULL,
  status text NOT NULL,
  resolution_note text,
  resolved_at timestamptz(6),
  CONSTRAINT identity_conflict_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES governance_layer.master_import_batch(batch_id) ON DELETE RESTRICT,
  CONSTRAINT identity_conflict_batch_id_exchange_symbol_key UNIQUE (batch_id, exchange, symbol)
);
CREATE INDEX identity_conflict_batch_id_status_idx ON governance_layer.identity_conflict (batch_id, status);

CREATE TABLE governance_layer.identity_resolution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol text NOT NULL,
  conflict_type text NOT NULL,
  evidence_url text,
  proposed_canonical_identity text NOT NULL,
  proposed_isin text,
  impact_on_4187_rows text NOT NULL,
  state text NOT NULL,
  owner_decision text,
  owner_decided_at timestamptz(6),
  owner_note text,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX identity_resolution_requests_symbol_idx ON governance_layer.identity_resolution_requests (symbol);
CREATE INDEX identity_resolution_requests_state_idx ON governance_layer.identity_resolution_requests (state);

CREATE TABLE governance_layer.provider_registry (
  provider_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name text NOT NULL UNIQUE,
  provider_type text NOT NULL,
  status text NOT NULL DEFAULT 'NOT_CONFIGURED',
  base_url text,
  secret_ref text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL
);

CREATE TABLE governance_layer.source_health (
  health_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL,
  checked_at timestamptz(6) NOT NULL DEFAULT now(),
  healthy boolean NOT NULL,
  latency_ms integer,
  error_code text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT source_health_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES governance_layer.provider_registry(provider_id) ON DELETE RESTRICT
);
CREATE INDEX source_health_provider_id_checked_at_idx ON governance_layer.source_health (provider_id, checked_at);

CREATE TABLE governance_layer.source_evidence (
  evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid,
  conflict_id uuid,
  evidence_type text NOT NULL,
  source_name text NOT NULL,
  source_url text,
  observed_at timestamptz(6),
  claim text NOT NULL,
  status text NOT NULL DEFAULT 'PROPOSED',
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT source_evidence_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES governance_layer.master_import_batch(batch_id) ON DELETE RESTRICT,
  CONSTRAINT source_evidence_conflict_id_fkey FOREIGN KEY (conflict_id) REFERENCES governance_layer.identity_conflict(conflict_id) ON DELETE RESTRICT
);
CREATE INDEX source_evidence_conflict_id_idx ON governance_layer.source_evidence (conflict_id);

CREATE TABLE governance_layer.classification_review (
  review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid,
  symbol text NOT NULL,
  company_name text,
  issue_type text NOT NULL,
  proposed_action text,
  status text NOT NULL DEFAULT 'OPEN',
  evidence_id uuid,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT classification_review_batch_id_fkey FOREIGN KEY (batch_id) REFERENCES governance_layer.master_import_batch(batch_id) ON DELETE RESTRICT,
  CONSTRAINT classification_review_evidence_id_fkey FOREIGN KEY (evidence_id) REFERENCES governance_layer.source_evidence(evidence_id) ON DELETE RESTRICT
);
CREATE INDEX classification_review_batch_id_status_idx ON governance_layer.classification_review (batch_id, status);

CREATE TABLE production_layer.canonical_stock (
  stock_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  symbol text NOT NULL,
  exchange text NOT NULL,
  identity_key text NOT NULL UNIQUE,
  sector text,
  sub_sector text,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  updated_at timestamptz(6) NOT NULL
);
CREATE INDEX canonical_stock_symbol_idx ON production_layer.canonical_stock (symbol);
CREATE INDEX canonical_stock_exchange_idx ON production_layer.canonical_stock (exchange);

CREATE TABLE production_layer.raw_stock_observation (
  observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid,
  source text NOT NULL,
  source_timestamp timestamptz(6),
  reported_date date,
  data_nature text NOT NULL,
  formula_version text,
  payload jsonb NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  freshness_status production_layer."FreshnessStatus" NOT NULL,
  verification_status production_layer."VerificationStatus" NOT NULL,
  interpretation_status production_layer."InterpretationStatus" NOT NULL,
  workflow_status production_layer."WorkflowStatus" NOT NULL,
  retrieved_at timestamptz(6),
  validation_status text,
  configuration_snapshot jsonb,
  formula_version_id uuid,
  CONSTRAINT raw_stock_observation_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES production_layer.canonical_stock(stock_id) ON DELETE RESTRICT,
  CONSTRAINT raw_stock_observation_formula_version_id_fkey FOREIGN KEY (formula_version_id) REFERENCES public.formula_version(formula_version_id) ON DELETE RESTRICT
);
CREATE INDEX raw_stock_observation_stock_id_idx ON production_layer.raw_stock_observation (stock_id);
CREATE INDEX raw_stock_observation_source_source_timestamp_idx ON production_layer.raw_stock_observation (source, source_timestamp);
CREATE INDEX raw_stock_observation_workflow_status_verification_status_idx ON production_layer.raw_stock_observation (workflow_status, verification_status);

CREATE TABLE production_layer.sector (
  sector_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE production_layer.sub_sector (
  sub_sector_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL,
  name text NOT NULL,
  CONSTRAINT sub_sector_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES production_layer.sector(sector_id) ON DELETE RESTRICT,
  CONSTRAINT sub_sector_sector_id_name_key UNIQUE (sector_id, name)
);

CREATE TABLE production_layer.stock_classification (
  stock_id uuid PRIMARY KEY,
  sub_sector_id uuid NOT NULL,
  verified_at timestamptz(6),
  source text,
  CONSTRAINT stock_classification_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES production_layer.canonical_stock(stock_id) ON DELETE RESTRICT,
  CONSTRAINT stock_classification_sub_sector_id_fkey FOREIGN KEY (sub_sector_id) REFERENCES production_layer.sub_sector(sub_sector_id) ON DELETE RESTRICT
);

CREATE TABLE production_layer.stock_group (
  group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE production_layer.stock_group_membership (
  stock_id uuid NOT NULL,
  group_id uuid NOT NULL,
  verified_at timestamptz(6),
  source text,
  PRIMARY KEY (stock_id, group_id),
  CONSTRAINT stock_group_membership_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES production_layer.canonical_stock(stock_id) ON DELETE RESTRICT,
  CONSTRAINT stock_group_membership_group_id_fkey FOREIGN KEY (group_id) REFERENCES production_layer.stock_group(group_id) ON DELETE RESTRICT
);

CREATE TABLE production_layer.theme (
  theme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE production_layer.sub_theme (
  sub_theme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL,
  name text NOT NULL,
  CONSTRAINT sub_theme_theme_id_fkey FOREIGN KEY (theme_id) REFERENCES production_layer.theme(theme_id) ON DELETE RESTRICT,
  CONSTRAINT sub_theme_theme_id_name_key UNIQUE (theme_id, name)
);

CREATE TABLE production_layer.industry (
  industry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_theme_id uuid NOT NULL,
  name text NOT NULL,
  CONSTRAINT industry_sub_theme_id_fkey FOREIGN KEY (sub_theme_id) REFERENCES production_layer.sub_theme(sub_theme_id) ON DELETE RESTRICT,
  CONSTRAINT industry_sub_theme_id_name_key UNIQUE (sub_theme_id, name)
);

CREATE TABLE production_layer.stock_theme_membership (
  stock_id uuid NOT NULL,
  industry_id uuid NOT NULL,
  verified_at timestamptz(6),
  source text,
  PRIMARY KEY (stock_id, industry_id),
  CONSTRAINT stock_theme_membership_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES production_layer.canonical_stock(stock_id) ON DELETE RESTRICT,
  CONSTRAINT stock_theme_membership_industry_id_fkey FOREIGN KEY (industry_id) REFERENCES production_layer.industry(industry_id) ON DELETE RESTRICT
);

CREATE TABLE production_layer.value_chain_stage (
  stage_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL,
  stage_name text NOT NULL,
  detail jsonb,
  source text,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT value_chain_stage_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES production_layer.canonical_stock(stock_id) ON DELETE RESTRICT
);
CREATE INDEX value_chain_stage_stock_id_stage_name_idx ON production_layer.value_chain_stage (stock_id, stage_name);

CREATE TABLE production_layer.value_chain_evidence (
  evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL,
  evidence_type text NOT NULL,
  source_name text NOT NULL,
  source_url text,
  observed_at timestamptz(6),
  claim text NOT NULL,
  verification production_layer."VerificationStatus" NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT value_chain_evidence_stage_id_fkey FOREIGN KEY (stage_id) REFERENCES production_layer.value_chain_stage(stage_id) ON DELETE RESTRICT
);
CREATE INDEX value_chain_evidence_stage_id_idx ON production_layer.value_chain_evidence (stage_id);

CREATE TABLE production_layer.rotation_score (
  rotation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  horizon text NOT NULL,
  stock_group_id uuid,
  sub_sector_id uuid,
  sector_id uuid,
  median_return decimal,
  participation decimal,
  ew_capped_return decimal,
  iqr_consistency decimal,
  confidence decimal NOT NULL,
  state text,
  final_score decimal,
  calculated_at timestamptz(6) NOT NULL DEFAULT now(),
  formula_version_id uuid NOT NULL,
  configuration_snapshot jsonb NOT NULL,
  CONSTRAINT rotation_score_stock_group_id_fkey FOREIGN KEY (stock_group_id) REFERENCES production_layer.stock_group(group_id) ON DELETE RESTRICT,
  CONSTRAINT rotation_score_sub_sector_id_fkey FOREIGN KEY (sub_sector_id) REFERENCES production_layer.sub_sector(sub_sector_id) ON DELETE RESTRICT,
  CONSTRAINT rotation_score_sector_id_fkey FOREIGN KEY (sector_id) REFERENCES production_layer.sector(sector_id) ON DELETE RESTRICT,
  CONSTRAINT rotation_score_formula_version_id_fkey FOREIGN KEY (formula_version_id) REFERENCES public.formula_version(formula_version_id) ON DELETE RESTRICT
);
CREATE INDEX rotation_score_level_horizon_calculated_at_idx ON production_layer.rotation_score (level, horizon, calculated_at);
CREATE INDEX rotation_score_stock_group_id_horizon_calculated_at_idx ON production_layer.rotation_score (stock_group_id, horizon, calculated_at);
CREATE INDEX rotation_score_sub_sector_id_horizon_calculated_at_idx ON production_layer.rotation_score (sub_sector_id, horizon, calculated_at);
CREATE INDEX rotation_score_sector_id_horizon_calculated_at_idx ON production_layer.rotation_score (sector_id, horizon, calculated_at);

CREATE TABLE production_layer.stock_score (
  score_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL,
  momentum decimal,
  earnings_momentum decimal,
  business_quality decimal,
  relative_strength decimal,
  valuation decimal,
  trend_quality decimal,
  volume_confirmation decimal,
  growth_visibility decimal,
  base_score decimal,
  risk_penalty decimal,
  catalyst integer,
  final_score decimal,
  confidence decimal NOT NULL,
  calculated_at timestamptz(6) NOT NULL DEFAULT now(),
  formula_version_id uuid NOT NULL,
  configuration_snapshot jsonb NOT NULL,
  comparison_snapshot jsonb,
  CONSTRAINT stock_score_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES production_layer.canonical_stock(stock_id) ON DELETE RESTRICT,
  CONSTRAINT stock_score_formula_version_id_fkey FOREIGN KEY (formula_version_id) REFERENCES public.formula_version(formula_version_id) ON DELETE RESTRICT
);
CREATE INDEX stock_score_stock_id_calculated_at_idx ON production_layer.stock_score (stock_id, calculated_at);
CREATE INDEX stock_score_formula_version_id_calculated_at_idx ON production_layer.stock_score (formula_version_id, calculated_at);

CREATE TABLE production_layer.shariah_status (
  stock_id uuid PRIMARY KEY,
  status text NOT NULL,
  source text,
  updated_at timestamptz(6) NOT NULL DEFAULT now(),
  CONSTRAINT shariah_status_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES production_layer.canonical_stock(stock_id) ON DELETE RESTRICT
);

CREATE TABLE staging_enrichment.master_4187_staging (
  staging_row_id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  batch_id uuid,
  name text NOT NULL,
  symbol text NOT NULL,
  exchange text NOT NULL,
  sector text,
  sub_sector text,
  identity_status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
CREATE INDEX master_4187_staging_exchange_symbol_idx ON staging_enrichment.master_4187_staging (exchange, symbol);

-- Prisma @updatedAt fields are ORM-managed and therefore intentionally have
-- no SQL trigger/default. Prisma relation fields are represented by the FKs
-- above. No CHECK constraints are emitted because the Prisma schema contains
-- no explicit CHECK constraints.
