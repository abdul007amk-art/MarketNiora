-- Fail-closed MASTER_4187 import readiness.
-- This changes governance views only; it neither imports staging rows nor
-- writes data. Owner authorization and verified identity are separate gates.
BEGIN;

CREATE OR REPLACE VIEW governance_layer.v_check_staging_identity_status
WITH (security_invoker = true)
AS
SELECT
  'STAGING_IDENTITY_STATUS'::text AS check_name,
  '0'::text AS expected,
  count(*) FILTER (
    WHERE identity_status IS DISTINCT FROM 'VERIFIED'
  )::text AS actual,
  CASE
    WHEN count(*) FILTER (WHERE identity_status IS DISTINCT FROM 'VERIFIED') = 0
      THEN 'PASS'
    ELSE 'FAIL'
  END AS status
FROM staging_enrichment.master_4187_staging;

CREATE OR REPLACE VIEW governance_layer.v_check_owner_authorization
WITH (security_invoker = true)
AS
SELECT
  'OWNER_AUTHORIZATION'::text AS check_name,
  '0'::text AS expected,
  count(*) FILTER (
    WHERE status = 'BLOCKED'
       OR (status <> 'BLOCKED' AND owner_authorized_at IS NULL)
  )::text AS actual,
  CASE
    WHEN count(*) FILTER (
      WHERE status = 'BLOCKED'
         OR (status <> 'BLOCKED' AND owner_authorized_at IS NULL)
    ) = 0
      THEN 'PASS'
    ELSE 'FAIL'
  END AS status
FROM governance_layer.master_import_batch;

CREATE OR REPLACE VIEW governance_layer.v_check_sector_coverage
WITH (security_invoker = true)
AS
WITH eligible_rows AS (
  SELECT staging_row_id, sector
  FROM staging_enrichment.master_4187_staging
  WHERE identity_status = 'VERIFIED'
),
coverage AS (
  SELECT
    count(*)::bigint AS eligible_count,
    count(*) FILTER (WHERE sector IS NULL OR btrim(sector) = '')::bigint AS missing_sector_count
  FROM eligible_rows
)
SELECT
  'SECTOR_COVERAGE'::text AS check_name,
  '0 missing sectors; at least one verified row'::text AS expected,
  CASE
    WHEN eligible_count = 0 THEN '0 eligible rows'
    ELSE missing_sector_count::text
  END AS actual,
  CASE
    WHEN eligible_count > 0 AND missing_sector_count = 0 THEN 'PASS'
    ELSE 'FAIL'
  END AS status
FROM coverage;

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
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_staging_identity_status
  UNION ALL SELECT check_name, expected, actual, status FROM governance_layer.v_check_owner_authorization
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

COMMIT;
