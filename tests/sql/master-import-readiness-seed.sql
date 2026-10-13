-- Seeds an exact 4,187-row STAGED import case, matching the current
-- count/status shape seen in the approved non-production clone.
INSERT INTO governance_layer.master_import_batch (
  batch_id, source_name, source_hash, status, owner_authorized_at
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'MASTER_4187 readiness CI fixture',
  'ci-fixture-not-a-production-source-hash',
  'STAGED',
  NULL
);

INSERT INTO staging_enrichment.master_4187_staging (
  batch_id, source_row_number, name, symbol, exchange, sector, sub_sector,
  identity_status, shariah_status, google_finance_ticker
)
SELECT
  '00000000-0000-4000-8000-000000000001'::uuid,
  g,
  'Fixture Company ' || g::text,
  CASE g
    WHEN 755 THEN 'SUULD'
    WHEN 756 THEN 'SUULD'
    WHEN 2470 THEN 'SURAJLTD'
    WHEN 2471 THEN 'SURAJLTD'
    WHEN 3303 THEN 'DCMSHRIRAM'
    WHEN 3304 THEN 'DCMSHRIRAM'
    WHEN 4165 THEN 'PTC'
    WHEN 4166 THEN 'PTC'
    ELSE 'FIX' || lpad(g::text, 4, '0')
  END,
  'NSE',
  'Fixture sector',
  'Fixture sub-sector',
  CASE WHEN g IN (9,755,756,2470,2471,3303,3304,4165,4166)
       THEN 'QUARANTINED' ELSE 'PENDING' END,
  NULL,
  'NSE:' || CASE g
    WHEN 755 THEN 'SUULD'
    WHEN 756 THEN 'SUULD'
    WHEN 2470 THEN 'SURAJLTD'
    WHEN 2471 THEN 'SURAJLTD'
    WHEN 3303 THEN 'DCMSHRIRAM'
    WHEN 3304 THEN 'DCMSHRIRAM'
    WHEN 4165 THEN 'PTC'
    WHEN 4166 THEN 'PTC'
    ELSE 'FIX' || lpad(g::text, 4, '0')
  END
FROM generate_series(1,4187) AS g;

INSERT INTO governance_layer.identity_conflict (batch_id, exchange, symbol, status, resolution_note)
VALUES
 ('00000000-0000-4000-8000-000000000001','NSE','SUULD','OPEN','CI fixture: duplicate symbol rows retained'),
 ('00000000-0000-4000-8000-000000000001','NSE','SURAJLTD','OPEN','CI fixture: duplicate symbol rows retained'),
 ('00000000-0000-4000-8000-000000000001','NSE','DCMSHRIRAM','OPEN','CI fixture: duplicate symbol rows retained'),
 ('00000000-0000-4000-8000-000000000001','NSE','PTC','OPEN','CI fixture: duplicate symbol rows retained');
