-- ===== MIGRATION 008 =====
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'freshness_status'
  ) THEN
    CREATE TYPE production_layer.freshness_status AS ENUM (
      'LIVE', 'DELAYED', 'STALE', 'UNAVAILABLE'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'verification_status'
  ) THEN
    CREATE TYPE production_layer.verification_status AS ENUM (
      'VERIFIED', 'UNKNOWN'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'interpretation_status'
  ) THEN
    CREATE TYPE production_layer.interpretation_status AS ENUM (
      'NOT_INTERPRETABLE', 'INTERPRETABLE'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'workflow_status'
  ) THEN
    CREATE TYPE production_layer.workflow_status AS ENUM (
      'SOURCE_REQUIRED', 'PENDING', 'MISSING'
    );
  END IF;
END $$;

ALTER TABLE production_layer.raw_stock_observation
  ADD COLUMN IF NOT EXISTS freshness_status production_layer.freshness_status,
  ADD COLUMN IF NOT EXISTS verification_status production_layer.verification_status,
  ADD COLUMN IF NOT EXISTS interpretation_status production_layer.interpretation_status,
  ADD COLUMN IF NOT EXISTS workflow_status production_layer.workflow_status,
  ADD COLUMN IF NOT EXISTS retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_status text,
  ADD COLUMN IF NOT EXISTS configuration_snapshot jsonb;

DO $$
DECLARE
  v_rows bigint;
  v_null_status_rows bigint;
BEGIN
  SELECT count(*) INTO v_rows
  FROM production_layer.raw_stock_observation;

  SELECT count(*) INTO v_null_status_rows
  FROM production_layer.raw_stock_observation
  WHERE freshness_status IS NULL
     OR verification_status IS NULL
     OR interpretation_status IS NULL
     OR workflow_status IS NULL;

  IF v_rows <> 0 OR v_null_status_rows <> 0 THEN
    RAISE EXCEPTION
      'Migration 008 requires an explicit deterministic C5 backfill before NOT NULL enforcement; existing rows=%, rows missing C5=%',
      v_rows, v_null_status_rows;
  END IF;
END $$;

ALTER TABLE production_layer.raw_stock_observation
  ALTER COLUMN freshness_status SET NOT NULL,
  ALTER COLUMN verification_status SET NOT NULL,
  ALTER COLUMN interpretation_status SET NOT NULL,
  ALTER COLUMN workflow_status SET NOT NULL;

COMMIT;

-- ===== MIGRATION 009 =====
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'identity_role'
  ) THEN
    CREATE TYPE public.identity_role AS ENUM ('USER', 'ADMIN', 'OWNER');
  END IF;
END $$;

COMMIT;

-- ===== MIGRATION 010 =====
BEGIN;

CREATE TABLE IF NOT EXISTS public.app_user (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oidc_issuer text NOT NULL,
  oidc_subject text NOT NULL,
  email text NOT NULL,
  email_verified boolean NOT NULL,
  role public.identity_role NOT NULL DEFAULT 'USER',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  disabled_at timestamptz,
  UNIQUE (email),
  UNIQUE (oidc_issuer, oidc_subject)
);

CREATE INDEX IF NOT EXISTS app_user_role_idx
  ON public.app_user(role);

CREATE TABLE IF NOT EXISTS public.session (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_user(user_id),
  token_hash bytea NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS session_user_expiry_idx
  ON public.session(user_id, expires_at);

CREATE INDEX IF NOT EXISTS session_user_revoked_idx
  ON public.session(user_id, revoked_at);

CREATE TABLE IF NOT EXISTS public.entitlement (
  entitlement_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_user(user_id),
  tier text NOT NULL,
  source text NOT NULL,
  status text NOT NULL,
  payment_ref text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS entitlement_user_status_idx
  ON public.entitlement(user_id, status);

CREATE TABLE IF NOT EXISTS public.feature_policy (
  feature_policy_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL,
  updated_by_user_id uuid REFERENCES public.app_user(user_id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feature_policy_updated_by_idx
  ON public.feature_policy(updated_by_user_id);

CREATE TABLE IF NOT EXISTS public.formula_version (
  formula_version_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_key text NOT NULL,
  version text NOT NULL,
  formula_hash text NOT NULL,
  configuration_snapshot jsonb,
  owner_approved_by_user_id uuid REFERENCES public.app_user(user_id),
  owner_approved_at timestamptz,
  locked_at timestamptz,
  supersedes_version_id uuid REFERENCES public.formula_version(formula_version_id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formula_key, version),
  CHECK (
    locked_at IS NULL
    OR (
      owner_approved_by_user_id IS NOT NULL
      AND owner_approved_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS formula_version_key_locked_idx
  ON public.formula_version(formula_key, locked_at);

CREATE TABLE IF NOT EXISTS public.owner_totp_secret (
  user_id uuid PRIMARY KEY REFERENCES public.app_user(user_id),
  secret_ciphertext bytea NOT NULL,
  kms_key_ref text NOT NULL,
  key_version text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  disabled_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.owner_mfa_challenge (
  challenge_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_user(user_id),
  challenge_hash bytea NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS owner_mfa_challenge_user_expiry_idx
  ON public.owner_mfa_challenge(user_id, expires_at);

CREATE TABLE IF NOT EXISTS public.app_audit_log (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid REFERENCES public.app_user(user_id),
  action text NOT NULL,
  target_type text,
  target_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_audit_log_actor_created_idx
  ON public.app_audit_log(actor_id, created_at);

CREATE INDEX IF NOT EXISTS app_audit_log_action_created_idx
  ON public.app_audit_log(action, created_at);

COMMIT;

-- ===== MIGRATION 011 =====
BEGIN;

-- Market Classification
CREATE TABLE IF NOT EXISTS production_layer.sector (
  sector_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS production_layer.sub_sector (
  sub_sector_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES production_layer.sector(sector_id),
  name text NOT NULL,
  UNIQUE (sector_id, name)
);

CREATE TABLE IF NOT EXISTS production_layer.stock_classification (
  stock_id uuid PRIMARY KEY REFERENCES production_layer.canonical_stock(stock_id),
  sub_sector_id uuid NOT NULL REFERENCES production_layer.sub_sector(sub_sector_id),
  verified_at timestamptz,
  source text
);

-- Master Stock Group registry — separate from Market Classification hierarchy.
CREATE TABLE IF NOT EXISTS production_layer.stock_group (
  group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS production_layer.stock_group_membership (
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  group_id uuid NOT NULL REFERENCES production_layer.stock_group(group_id),
  verified_at timestamptz,
  source text,
  PRIMARY KEY (stock_id, group_id)
);

-- Theme Intelligence: THEME -> SUB-THEME -> INDUSTRY -> STOCK.
CREATE TABLE IF NOT EXISTS production_layer.theme (
  theme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS production_layer.sub_theme (
  sub_theme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES production_layer.theme(theme_id),
  name text NOT NULL,
  UNIQUE (theme_id, name)
);

CREATE TABLE IF NOT EXISTS production_layer.industry (
  industry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_theme_id uuid NOT NULL REFERENCES production_layer.sub_theme(sub_theme_id),
  name text NOT NULL,
  UNIQUE (sub_theme_id, name)
);

CREATE TABLE IF NOT EXISTS production_layer.stock_theme_membership (
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  industry_id uuid NOT NULL REFERENCES production_layer.industry(industry_id),
  verified_at timestamptz,
  source text,
  PRIMARY KEY (stock_id, industry_id)
);

-- Business / Value Chain
CREATE TABLE IF NOT EXISTS production_layer.value_chain_stage (
  stage_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  stage_name text NOT NULL CHECK (stage_name IN (
    'RAW_MATERIAL_INPUT',
    'MINING_EXTRACTION',
    'SOURCING_PROCUREMENT',
    'PROCESSING',
    'MANUFACTURING',
    'CAPACITY_UTILISATION_CAPEX',
    'PRODUCTS_BYPRODUCTS',
    'CUSTOMERS_DISTRIBUTION',
    'DOWNSTREAM_INDUSTRIES',
    'FINAL_END_USE'
  )),
  detail jsonb,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_layer.value_chain_evidence (
  evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES production_layer.value_chain_stage(stage_id),
  evidence_type text NOT NULL,
  source_name text NOT NULL,
  source_url text,
  observed_at timestamptz,
  claim text NOT NULL,
  verification production_layer.verification_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS value_chain_stage_stock_idx
  ON production_layer.value_chain_stage(stock_id, stage_name);

CREATE INDEX IF NOT EXISTS value_chain_evidence_stage_idx
  ON production_layer.value_chain_evidence(stage_id);

-- Rotation outputs.
CREATE TABLE IF NOT EXISTS production_layer.rotation_score (
  rotation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  horizon text NOT NULL,
  stock_group_id uuid REFERENCES production_layer.stock_group(group_id),
  sub_sector_id uuid REFERENCES production_layer.sub_sector(sub_sector_id),
  sector_id uuid REFERENCES production_layer.sector(sector_id),
  median_return numeric,
  participation numeric,
  ew_capped_return numeric,
  iqr_consistency numeric,
  confidence numeric NOT NULL,
  state text,
  final_score numeric,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  formula_version_id uuid NOT NULL REFERENCES public.formula_version(formula_version_id),
  configuration_snapshot jsonb NOT NULL,
  CHECK (level IN ('STOCK_GROUP','SUB_SECTOR','SECTOR')),
  CHECK (horizon IN ('1D','1W','1M','3M')),
  CHECK (
    (level = 'STOCK_GROUP' AND stock_group_id IS NOT NULL AND sub_sector_id IS NULL AND sector_id IS NULL)
    OR
    (level = 'SUB_SECTOR' AND stock_group_id IS NULL AND sub_sector_id IS NOT NULL AND sector_id IS NULL)
    OR
    (level = 'SECTOR' AND stock_group_id IS NULL AND sub_sector_id IS NULL AND sector_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS rotation_score_level_horizon_time_idx
  ON production_layer.rotation_score(level, horizon, calculated_at);

-- Stock Score historical outputs — NOT unique by stock, because history is required.
CREATE TABLE IF NOT EXISTS production_layer.stock_score (
  score_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  momentum numeric,
  earnings_momentum numeric,
  business_quality numeric,
  relative_strength numeric,
  valuation numeric,
  trend_quality numeric,
  volume_confirmation numeric,
  growth_visibility numeric,
  base_score numeric,
  risk_penalty numeric CHECK (risk_penalty BETWEEN -30 AND 0),
  catalyst integer CHECK (catalyst IN (0,4,8,12)),
  final_score numeric CHECK (final_score BETWEEN 0 AND 100 OR final_score IS NULL),
  confidence numeric NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  formula_version_id uuid NOT NULL REFERENCES public.formula_version(formula_version_id),
  configuration_snapshot jsonb NOT NULL,
  comparison_snapshot jsonb
);

CREATE INDEX IF NOT EXISTS stock_score_stock_time_idx
  ON production_layer.stock_score(stock_id, calculated_at);

CREATE INDEX IF NOT EXISTS stock_score_formula_time_idx
  ON production_layer.stock_score(formula_version_id, calculated_at);

-- Shariah display/status storage.
CREATE TABLE IF NOT EXISTS production_layer.shariah_status (
  stock_id uuid PRIMARY KEY REFERENCES production_layer.canonical_stock(stock_id),
  status text NOT NULL CHECK (status IN ('VERIFIED_SHARIAH','NON_SHARIAH','PENDING')),
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;

-- ===== MIGRATION 012 =====
BEGIN;

-- ------------------------------------------------------------
-- Server-only DB boundary: revoke direct client access.
-- ------------------------------------------------------------
REVOKE ALL ON TABLE
  public.app_user,
  public.session,
  public.entitlement,
  public.feature_policy,
  public.formula_version,
  public.owner_totp_secret,
  public.owner_mfa_challenge,
  public.app_audit_log
FROM anon, authenticated;

REVOKE ALL ON TABLE
  production_layer.sector,
  production_layer.sub_sector,
  production_layer.stock_classification,
  production_layer.stock_group,
  production_layer.stock_group_membership,
  production_layer.theme,
  production_layer.sub_theme,
  production_layer.industry,
  production_layer.stock_theme_membership,
  production_layer.value_chain_stage,
  production_layer.value_chain_evidence,
  production_layer.rotation_score,
  production_layer.stock_score,
  production_layer.shariah_status
FROM anon, authenticated;

ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_version ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_totp_secret ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_mfa_challenge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE production_layer.sector ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.sub_sector ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_classification ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_group ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_group_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.sub_theme ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.industry ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_theme_membership ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.value_chain_stage ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.value_chain_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.rotation_score ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.stock_score ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_layer.shariah_status ENABLE ROW LEVEL SECURITY;

-- Explicit fail-closed policies for client roles.
CREATE POLICY app_user_deny_anon ON public.app_user FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY app_user_deny_auth ON public.app_user FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY session_deny_anon ON public.session FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY session_deny_auth ON public.session FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY entitlement_deny_anon ON public.entitlement FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY entitlement_deny_auth ON public.entitlement FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY feature_policy_deny_anon ON public.feature_policy FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY feature_policy_deny_auth ON public.feature_policy FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY formula_version_deny_anon ON public.formula_version FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY formula_version_deny_auth ON public.formula_version FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY owner_totp_secret_deny_anon ON public.owner_totp_secret FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY owner_totp_secret_deny_auth ON public.owner_totp_secret FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY owner_mfa_challenge_deny_anon ON public.owner_mfa_challenge FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY owner_mfa_challenge_deny_auth ON public.owner_mfa_challenge FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY app_audit_log_deny_anon ON public.app_audit_log FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY app_audit_log_deny_auth ON public.app_audit_log FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY sector_deny_anon ON production_layer.sector FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sector_deny_auth ON production_layer.sector FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY sub_sector_deny_anon ON production_layer.sub_sector FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sub_sector_deny_auth ON production_layer.sub_sector FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_classification_deny_anon ON production_layer.stock_classification FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_classification_deny_auth ON production_layer.stock_classification FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_group_deny_anon ON production_layer.stock_group FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_group_deny_auth ON production_layer.stock_group FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_group_membership_deny_anon ON production_layer.stock_group_membership FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_group_membership_deny_auth ON production_layer.stock_group_membership FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY theme_deny_anon ON production_layer.theme FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY theme_deny_auth ON production_layer.theme FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY sub_theme_deny_anon ON production_layer.sub_theme FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY sub_theme_deny_auth ON production_layer.sub_theme FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY industry_deny_anon ON production_layer.industry FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY industry_deny_auth ON production_layer.industry FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_theme_membership_deny_anon ON production_layer.stock_theme_membership FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_theme_membership_deny_auth ON production_layer.stock_theme_membership FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY value_chain_stage_deny_anon ON production_layer.value_chain_stage FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY value_chain_stage_deny_auth ON production_layer.value_chain_stage FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY value_chain_evidence_deny_anon ON production_layer.value_chain_evidence FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY value_chain_evidence_deny_auth ON production_layer.value_chain_evidence FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY rotation_score_deny_anon ON production_layer.rotation_score FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY rotation_score_deny_auth ON production_layer.rotation_score FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY stock_score_deny_anon ON production_layer.stock_score FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY stock_score_deny_auth ON production_layer.stock_score FOR ALL TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY shariah_status_deny_anon ON production_layer.shariah_status FOR ALL TO anon USING (false) WITH CHECK (false);
CREATE POLICY shariah_status_deny_auth ON production_layer.shariah_status FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ------------------------------------------------------------
-- Provenance and formula governance.
-- ------------------------------------------------------------
ALTER TABLE production_layer.raw_stock_observation
  ADD COLUMN IF NOT EXISTS formula_version_id uuid;

ALTER TABLE production_layer.raw_stock_observation
  ADD CONSTRAINT raw_stock_observation_formula_version_fkey
  FOREIGN KEY (formula_version_id)
  REFERENCES public.formula_version(formula_version_id)
  NOT VALID;

ALTER TABLE production_layer.raw_stock_observation
  VALIDATE CONSTRAINT raw_stock_observation_formula_version_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM production_layer.raw_stock_observation r
    LEFT JOIN production_layer.canonical_stock c ON c.stock_id = r.stock_id
    WHERE r.stock_id IS NULL OR c.stock_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Raw observation contains NULL or orphan stock_id; refusing to strengthen provenance constraint.';
  END IF;
END $$;

ALTER TABLE production_layer.raw_stock_observation
  ALTER COLUMN stock_id SET NOT NULL;

ALTER TABLE production_layer.raw_stock_observation
  ADD CONSTRAINT raw_stock_observation_derived_formula_check
  CHECK (
    data_nature <> 'DERIVED'
    OR (
      formula_version IS NOT NULL
      AND formula_version_id IS NOT NULL
      AND configuration_snapshot IS NOT NULL
    )
  );

-- Governance audit actor relationship to the application identity plane.
ALTER TABLE governance_layer.audit_log
  ADD CONSTRAINT governance_audit_actor_user_fkey
  FOREIGN KEY (actor_user_id)
  REFERENCES public.app_user(user_id)
  NOT VALID;

ALTER TABLE governance_layer.audit_log
  VALIDATE CONSTRAINT governance_audit_actor_user_fkey;

-- ------------------------------------------------------------
-- Append-only trigger shared by raw observations and audit logs.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Append-only table: % is not permitted on %.', TG_OP, TG_TABLE_NAME;
END;
$$;

REVOKE ALL ON FUNCTION public.reject_append_only_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS raw_observation_immutable ON production_layer.raw_stock_observation;
CREATE TRIGGER raw_observation_immutable
  BEFORE UPDATE OR DELETE ON production_layer.raw_stock_observation
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

DROP TRIGGER IF EXISTS governance_audit_immutable ON governance_layer.audit_log;
CREATE TRIGGER governance_audit_immutable
  BEFORE UPDATE OR DELETE ON governance_layer.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

DROP TRIGGER IF EXISTS app_audit_immutable ON public.app_audit_log;
CREATE TRIGGER app_audit_immutable
  BEFORE UPDATE OR DELETE ON public.app_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.reject_append_only_mutation();

-- ------------------------------------------------------------
-- Locked formula versions cannot be edited in place.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reject_locked_formula_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.locked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Locked formula version % cannot be updated or deleted.', OLD.formula_version_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.reject_locked_formula_mutation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS formula_version_locked_guard ON public.formula_version;
CREATE TRIGGER formula_version_locked_guard
  BEFORE UPDATE OR DELETE ON public.formula_version
  FOR EACH ROW EXECUTE FUNCTION public.reject_locked_formula_mutation();

-- ------------------------------------------------------------
-- Owner-only control-plane invariants enforced server-side/DB-side.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_owner_totp_owner_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_role public.identity_role;
BEGIN
  SELECT role INTO v_role
  FROM public.app_user
  WHERE user_id = NEW.user_id;

  IF v_role IS DISTINCT FROM 'OWNER'::public.identity_role THEN
    RAISE EXCEPTION 'TOTP secret may only belong to an OWNER.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_owner_totp_owner_role() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS owner_totp_owner_role_guard ON public.owner_totp_secret;
CREATE TRIGGER owner_totp_owner_role_guard
  BEFORE INSERT OR UPDATE ON public.owner_totp_secret
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_totp_owner_role();

DROP TRIGGER IF EXISTS owner_mfa_owner_role_guard ON public.owner_mfa_challenge;
CREATE TRIGGER owner_mfa_owner_role_guard
  BEFORE INSERT OR UPDATE ON public.owner_mfa_challenge
  FOR EACH ROW EXECUTE FUNCTION public.enforce_owner_totp_owner_role();

COMMIT;

-- ===== MIGRATION 013 =====
BEGIN;

CREATE OR REPLACE VIEW governance_layer.v_check_row_count
WITH (security_invoker = true)
AS
SELECT
  'ROW_COUNT'::text AS check_name,
  '4187'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 4187 THEN 'PASS' ELSE 'FAIL' END AS status
FROM staging_enrichment.master_4187_staging;

CREATE OR REPLACE VIEW governance_layer.v_check_open_identity_conflicts
WITH (security_invoker = true)
AS
SELECT
  'OPEN_IDENTITY_CONFLICTS'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM governance_layer.identity_conflict
WHERE status = 'OPEN';

CREATE OR REPLACE VIEW governance_layer.v_check_pending_resolution_requests
WITH (security_invoker = true)
AS
SELECT
  'PENDING_RESOLUTION_REQUESTS'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM governance_layer.identity_resolution_requests
WHERE state = 'AWAITING_OWNER';

CREATE OR REPLACE VIEW governance_layer.v_check_orphan_foreign_keys
WITH (security_invoker = true)
AS
SELECT
  'ORPHAN_FOREIGN_KEYS'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM production_layer.raw_stock_observation r
LEFT JOIN production_layer.canonical_stock c ON c.stock_id = r.stock_id
WHERE r.stock_id IS NOT NULL AND c.stock_id IS NULL;

CREATE OR REPLACE VIEW governance_layer.v_check_isin_format
WITH (security_invoker = true)
AS
SELECT
  'ISIN_FORMAT'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM governance_layer.identity_resolution_requests
WHERE proposed_isin IS NOT NULL
  AND proposed_isin !~ '^IN[A-Za-z0-9]{10}$';

CREATE OR REPLACE VIEW governance_layer.v_check_sector_coverage
WITH (security_invoker = true)
AS
WITH eligible_rows AS (
  SELECT staging_row_id, sector
  FROM staging_enrichment.master_4187_staging
  WHERE coalesce(identity_status, 'PENDING') NOT IN ('QUARANTINED','PENDING')
),
coverage AS (
  SELECT
    count(*)::bigint AS eligible_count,
    count(*) FILTER (WHERE sector IS NULL OR btrim(sector) = '')::bigint AS missing_sector_count
  FROM eligible_rows
)
SELECT
  'SECTOR_COVERAGE'::text AS check_name,
  '0'::text AS expected,
  missing_sector_count::text AS actual,
  CASE WHEN missing_sector_count = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM coverage;

CREATE OR REPLACE VIEW governance_layer.v_check_c5_status_completeness
WITH (security_invoker = true)
AS
SELECT
  'C5_STATUS_COMPLETENESS'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM production_layer.raw_stock_observation
WHERE freshness_status IS NULL
   OR verification_status IS NULL
   OR interpretation_status IS NULL
   OR workflow_status IS NULL;

CREATE OR REPLACE VIEW governance_layer.v_check_derived_formula_version
WITH (security_invoker = true)
AS
SELECT
  'DERIVED_FORMULA_PROVENANCE'::text AS check_name,
  '0'::text AS expected,
  count(*)::text AS actual,
  CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
FROM production_layer.raw_stock_observation
WHERE data_nature = 'DERIVED'
  AND (
    formula_version IS NULL
    OR formula_version_id IS NULL
    OR configuration_snapshot IS NULL
  );

CREATE OR REPLACE VIEW governance_layer.v_import_readiness
WITH (security_invoker = true)
AS
WITH checks AS (
  SELECT check_name, expected, actual, status FROM governance_layer.v_check_row_count
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_open_identity_conflicts
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_pending_resolution_requests
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_orphan_foreign_keys
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_isin_format
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_sector_coverage
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_c5_status_completeness
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_derived_formula_version
)
SELECT
  check_name,
  expected,
  actual,
  status,
  NOT EXISTS (
    SELECT 1 FROM checks failed WHERE failed.status = 'FAIL'
  ) AS import_ready
FROM checks
ORDER BY check_name;

CREATE OR REPLACE VIEW governance_layer.v_pending_resolutions
WITH (security_invoker = true)
AS
SELECT
  id,
  symbol,
  conflict_type,
  evidence_url,
  proposed_canonical_identity,
  proposed_isin,
  impact_on_4187_rows,
  state,
  owner_decision,
  owner_decided_at,
  owner_note,
  created_at
FROM governance_layer.identity_resolution_requests
WHERE state = 'AWAITING_OWNER'
ORDER BY symbol;

CREATE OR REPLACE VIEW governance_layer.v_resolution_status
WITH (security_invoker = true)
AS
SELECT
  irr.symbol,
  irr.state AS resolution_state,
  ic.status AS conflict_state,
  COALESCE(irr.owner_note, ic.resolution_note) AS resolution_note,
  ic.resolved_at
FROM governance_layer.identity_resolution_requests AS irr
JOIN governance_layer.identity_conflict AS ic
  ON ic.symbol = irr.symbol;

CREATE OR REPLACE FUNCTION governance_layer.resolve_identity_conflict(
  p_symbol text,
  p_resolution_note text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, governance_layer
AS $$
DECLARE
  v_now timestamptz := now();
  v_resolution_state text;
  v_conflict_state text;
BEGIN
  IF p_symbol IS NULL OR btrim(p_symbol) = '' THEN
    RAISE EXCEPTION 'p_symbol must not be null or empty';
  END IF;

  IF p_resolution_note IS NULL OR btrim(p_resolution_note) = '' THEN
    RAISE EXCEPTION 'p_resolution_note must not be null or empty';
  END IF;

  SELECT state INTO v_resolution_state
  FROM governance_layer.identity_resolution_requests
  WHERE symbol = p_symbol
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No identity_resolution_requests row exists for symbol %', p_symbol;
  END IF;

  IF v_resolution_state = 'APPROVED' THEN
    RAISE EXCEPTION 'Identity resolution for symbol % is already APPROVED', p_symbol;
  ELSIF v_resolution_state <> 'AWAITING_OWNER' THEN
    RAISE EXCEPTION
      'Identity resolution for symbol % is not AWAITING_OWNER (state=%)',
      p_symbol, v_resolution_state;
  END IF;

  SELECT status INTO v_conflict_state
  FROM governance_layer.identity_conflict
  WHERE symbol = p_symbol
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No identity_conflict row exists for symbol %', p_symbol;
  END IF;

  IF v_conflict_state = 'RESOLVED' THEN
    RAISE EXCEPTION 'Identity conflict for symbol % is already RESOLVED', p_symbol;
  ELSIF v_conflict_state <> 'OPEN' THEN
    RAISE EXCEPTION
      'Identity conflict for symbol % is not OPEN (status=%)',
      p_symbol, v_conflict_state;
  END IF;

  UPDATE governance_layer.identity_resolution_requests
  SET state = 'APPROVED',
      owner_decision = 'APPROVED',
      owner_decided_at = v_now,
      owner_note = p_resolution_note
  WHERE symbol = p_symbol
    AND state = 'AWAITING_OWNER';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Resolution request for symbol % was not updated', p_symbol;
  END IF;

  UPDATE governance_layer.identity_conflict
  SET status = 'RESOLVED',
      resolution_note = p_resolution_note,
      resolved_at = v_now
  WHERE symbol = p_symbol
    AND status = 'OPEN';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Identity conflict for symbol % was not updated', p_symbol;
  END IF;

  RETURN true;
END;
$$;

ALTER FUNCTION governance_layer.resolve_identity_conflict(text, text)
  OWNER TO service_role;

REVOKE ALL ON FUNCTION governance_layer.resolve_identity_conflict(text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION governance_layer.resolve_identity_conflict(text, text)
  TO service_role;

REVOKE ALL ON governance_layer.v_check_row_count FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_open_identity_conflicts FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_pending_resolution_requests FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_orphan_foreign_keys FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_isin_format FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_sector_coverage FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_c5_status_completeness FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_check_derived_formula_version FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_import_readiness FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_pending_resolutions FROM anon, authenticated;
REVOKE ALL ON governance_layer.v_resolution_status FROM anon, authenticated;

COMMIT;
