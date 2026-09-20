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

