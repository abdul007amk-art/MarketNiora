-- Preserve source order and original source-only fields during MASTER_4187 staging.
-- This is intentionally a staging-layer migration; it does not write canonical stocks.
BEGIN;

ALTER TABLE staging_enrichment.master_4187_staging
  ADD COLUMN IF NOT EXISTS source_row_number integer,
  ADD COLUMN IF NOT EXISTS shariah_status text,
  ADD COLUMN IF NOT EXISTS google_finance_ticker text;

CREATE UNIQUE INDEX IF NOT EXISTS master_4187_staging_batch_id_source_row_number_key
  ON staging_enrichment.master_4187_staging (batch_id, source_row_number);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'master_4187_staging_batch_id_fkey'
      AND conrelid = 'staging_enrichment.master_4187_staging'::regclass
  ) THEN
    ALTER TABLE staging_enrichment.master_4187_staging
      ADD CONSTRAINT master_4187_staging_batch_id_fkey
      FOREIGN KEY (batch_id)
      REFERENCES governance_layer.master_import_batch(batch_id)
      ON DELETE RESTRICT
      NOT VALID;
  END IF;
END $$;

COMMIT;
