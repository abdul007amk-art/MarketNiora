-- Harden trigger functions against mutable search_path resolution.
-- This migration only changes function runtime configuration; it does not
-- alter table schemas, rows, formula logic, or authorization policy.
BEGIN;

ALTER FUNCTION public.reject_append_only_mutation()
  SET search_path = '';

ALTER FUNCTION public.reject_locked_formula_mutation()
  SET search_path = '';

ALTER FUNCTION public.enforce_owner_totp_owner_role()
  SET search_path = '';

COMMIT;
