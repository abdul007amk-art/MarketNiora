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
