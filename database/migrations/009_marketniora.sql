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

