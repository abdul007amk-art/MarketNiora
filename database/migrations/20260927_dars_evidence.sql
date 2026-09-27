-- DARS-1.2 durable evidence persistence
-- INTENTIONALLY NOT EXECUTED HERE. Apply through the approved database migration/release process.
CREATE TABLE IF NOT EXISTS governance_layer.dars_evidence (
  evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id text NOT NULL UNIQUE,
  evidence_key text NOT NULL,
  source text NOT NULL,
  symbol text NOT NULL,
  value text NOT NULL,
  source_timestamp timestamptz NOT NULL,
  effective_time timestamptz NOT NULL,
  knowledge_time timestamptz NOT NULL,
  verification_status text NOT NULL,
  data_nature text NOT NULL,
  formula_version text NULL,
  origin text NULL,
  refreshed_at timestamptz NOT NULL,
  truth_state text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dars_evidence_key_knowledge_unique UNIQUE (evidence_key, knowledge_time)
);

CREATE INDEX IF NOT EXISTS dars_evidence_knowledge_time_idx
  ON governance_layer.dars_evidence (knowledge_time);

CREATE INDEX IF NOT EXISTS dars_evidence_key_knowledge_idx
  ON governance_layer.dars_evidence (evidence_key, knowledge_time);
