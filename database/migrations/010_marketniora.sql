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

