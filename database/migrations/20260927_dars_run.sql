-- DARS-1.2 durable run/job state
-- INTENTIONALLY NOT EXECUTED HERE. Apply through the approved database migration/release process.
CREATE TABLE IF NOT EXISTS governance_layer.dars_run (
  run_id text PRIMARY KEY,
  knowledge_time timestamptz NOT NULL,
  status text NOT NULL,
  provider_healthy boolean NOT NULL,
  ready boolean NOT NULL,
  healthy boolean NOT NULL,
  truth_state text NOT NULL,
  formula_executed boolean NOT NULL,
  started_at timestamptz NOT NULL,
  completed_at timestamptz NULL,
  stage_events jsonb NOT NULL DEFAULT '[]'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  duplicate_source_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dars_run_knowledge_time_idx
  ON governance_layer.dars_run (knowledge_time);

CREATE INDEX IF NOT EXISTS dars_run_status_started_idx
  ON governance_layer.dars_run (status, started_at);
