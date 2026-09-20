-- MarketNiora — Migration 007a
-- Purpose: prerequisite ACLs required by migration 007/013 on fresh non-production Supabase projects.
-- Forward-only. Does NOT edit, drop, reset, or rewrite migrations 001-007.
-- NOTE: PostgreSQL GRANT is inherently idempotent. The DO block adds an explicit
-- privilege check so repeated application is a no-op when the grant already exists.

BEGIN;

DO $$
BEGIN
  IF NOT has_schema_privilege('service_role', 'governance_layer', 'USAGE') THEN
    GRANT USAGE ON SCHEMA governance_layer TO service_role;
  END IF;

  IF NOT has_schema_privilege('service_role', 'governance_layer', 'CREATE') THEN
    GRANT CREATE ON SCHEMA governance_layer TO service_role;
  END IF;

  IF NOT has_table_privilege('service_role', 'governance_layer.identity_resolution_requests', 'SELECT') THEN
    GRANT SELECT ON TABLE governance_layer.identity_resolution_requests TO service_role;
  END IF;

  IF NOT has_table_privilege('service_role', 'governance_layer.identity_resolution_requests', 'UPDATE') THEN
    GRANT UPDATE ON TABLE governance_layer.identity_resolution_requests TO service_role;
  END IF;

  IF NOT has_table_privilege('service_role', 'governance_layer.identity_conflict', 'SELECT') THEN
    GRANT SELECT ON TABLE governance_layer.identity_conflict TO service_role;
  END IF;

  IF NOT has_table_privilege('service_role', 'governance_layer.identity_conflict', 'UPDATE') THEN
    GRANT UPDATE ON TABLE governance_layer.identity_conflict TO service_role;
  END IF;
END $$;

COMMIT;

-- Verification query (run after migration)
SELECT n.nspname,
       has_schema_privilege('service_role', n.nspname, 'USAGE')  AS service_role_usage,
       has_schema_privilege('service_role', n.nspname, 'CREATE') AS service_role_create
FROM pg_namespace n
WHERE n.nspname = 'governance_layer';

SELECT table_schema, table_name,
       string_agg(privilege_type, ',' ORDER BY privilege_type) AS service_role_privileges
FROM information_schema.role_table_grants
WHERE grantee = 'service_role'
  AND table_schema = 'governance_layer'
  AND table_name IN ('identity_conflict', 'identity_resolution_requests')
GROUP BY table_schema, table_name
ORDER BY table_name;
