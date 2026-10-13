-- Ephemeral PostgreSQL-only fixtures for testing migration 015.
-- These functions are simplified test stand-ins. This file is never applied
-- to Supabase or production; it exists solely to verify pg_proc configuration.
CREATE OR REPLACE FUNCTION public.reject_append_only_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Append-only table mutation rejected.';
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_locked_formula_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_owner_totp_owner_role()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN NEW;
END;
$$;
