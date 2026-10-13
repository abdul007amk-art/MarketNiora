DO $$
BEGIN
  IF (SELECT COUNT(*) FROM governance_layer.v_check_row_count WHERE status = 'PASS') <> 1 THEN
    RAISE EXCEPTION 'Readiness fixture should pass the exact 4,187 row-count check';
  END IF;

  IF (SELECT status FROM governance_layer.v_check_staging_identity_status) <> 'FAIL' THEN
    RAISE EXCEPTION 'PENDING/QUARANTINED rows must fail identity verification gate';
  END IF;

  IF (SELECT status FROM governance_layer.v_check_owner_authorization) <> 'FAIL' THEN
    RAISE EXCEPTION 'A STAGED batch with NULL owner_authorized_at must fail owner authorization gate';
  END IF;

  IF (SELECT status FROM governance_layer.v_check_sector_coverage) <> 'FAIL' THEN
    RAISE EXCEPTION 'Zero eligible rows must not pass sector coverage';
  END IF;

  IF EXISTS (SELECT 1 FROM governance_layer.v_import_readiness WHERE import_ready) THEN
    RAISE EXCEPTION 'Import must not be ready while rows are pending/quarantined and the batch is unauthorised';
  END IF;
END
$$;

-- Simulate the state only inside this disposable CI database after all
-- governance checks have been reviewed/approved. This is not production data.
UPDATE staging_enrichment.master_4187_staging
SET identity_status = 'VERIFIED';

UPDATE governance_layer.identity_conflict
SET status = 'RESOLVED', resolved_at = now();

UPDATE governance_layer.master_import_batch
SET status = 'AUTHORIZED', owner_authorized_at = now()
WHERE batch_id = '00000000-0000-4000-8000-000000000001';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM governance_layer.v_import_readiness WHERE status = 'FAIL') THEN
    RAISE EXCEPTION 'All import-readiness checks should pass for the simulated verified/authorized CI fixture';
  END IF;

  IF NOT (SELECT bool_and(import_ready) FROM governance_layer.v_import_readiness) THEN
    RAISE EXCEPTION 'import_ready must be true on all rows after all gates pass';
  END IF;
END
$$;
