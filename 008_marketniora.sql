BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'freshness_status'
  ) THEN
    CREATE TYPE production_layer.freshness_status AS ENUM (
      'LIVE', 'DELAYED', 'STALE', 'UNAVAILABLE'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'verification_status'
  ) THEN
    CREATE TYPE production_layer.verification_status AS ENUM (
      'VERIFIED', 'UNKNOWN'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'interpretation_status'
  ) THEN
    CREATE TYPE production_layer.interpretation_status AS ENUM (
      'NOT_INTERPRETABLE', 'INTERPRETABLE'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'production_layer' AND t.typname = 'workflow_status'
  ) THEN
    CREATE TYPE production_layer.workflow_status AS ENUM (
      'SOURCE_REQUIRED', 'PENDING', 'MISSING'
    );
  END IF;
END $$;

ALTER TABLE production_layer.raw_stock_observation
  ADD COLUMN IF NOT EXISTS freshness_status production_layer.freshness_status,
  ADD COLUMN IF NOT EXISTS verification_status production_layer.verification_status,
  ADD COLUMN IF NOT EXISTS interpretation_status production_layer.interpretation_status,
  ADD COLUMN IF NOT EXISTS workflow_status production_layer.workflow_status,
  ADD COLUMN IF NOT EXISTS retrieved_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_status text,
  ADD COLUMN IF NOT EXISTS configuration_snapshot jsonb;

DO $$
DECLARE
  v_rows bigint;
  v_null_status_rows bigint;
BEGIN
  SELECT count(*) INTO v_rows
  FROM production_layer.raw_stock_observation;

  SELECT count(*) INTO v_null_status_rows
  FROM production_layer.raw_stock_observation
  WHERE freshness_status IS NULL
     OR verification_status IS NULL
     OR interpretation_status IS NULL
     OR workflow_status IS NULL;

  IF v_rows <> 0 OR v_null_status_rows <> 0 THEN
    RAISE EXCEPTION
      'Migration 008 requires an explicit deterministic C5 backfill before NOT NULL enforcement; existing rows=%, rows missing C5=%',
      v_rows, v_null_status_rows;
  END IF;
END $$;

ALTER TABLE production_layer.raw_stock_observation
  ALTER COLUMN freshness_status SET NOT NULL,
  ALTER COLUMN verification_status SET NOT NULL,
  ALTER COLUMN interpretation_status SET NOT NULL,
  ALTER COLUMN workflow_status SET NOT NULL;

COMMIT;

