DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'staging_enrichment'
      AND table_name = 'master_4187_staging'
      AND column_name = 'source_row_number'
      AND data_type = 'integer'
  ) THEN
    RAISE EXCEPTION 'source_row_number migration assertion failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'staging_enrichment'
      AND table_name = 'master_4187_staging'
      AND column_name = 'shariah_status'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'shariah_status migration assertion failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'staging_enrichment'
      AND table_name = 'master_4187_staging'
      AND column_name = 'google_finance_ticker'
      AND data_type = 'text'
  ) THEN
    RAISE EXCEPTION 'google_finance_ticker migration assertion failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'staging_enrichment'
      AND indexname = 'master_4187_staging_batch_id_source_row_number_key'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
  ) THEN
    RAISE EXCEPTION 'source-row uniqueness assertion failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'master_4187_staging_batch_id_fkey'
      AND conrelid = 'staging_enrichment.master_4187_staging'::regclass
      AND confrelid = 'governance_layer.master_import_batch'::regclass
  ) THEN
    RAISE EXCEPTION 'batch foreign-key assertion failed';
  END IF;
END $$;
