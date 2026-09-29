CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS governance_layer;

CREATE TABLE IF NOT EXISTS public.app_audit_log (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type text NOT NULL,
  actor_id uuid NULL,
  action text NOT NULL,
  target_type text NULL,
  target_id text NULL,
  metadata jsonb NULL,
  created_at timestamptz(6) NOT NULL DEFAULT now()
);
