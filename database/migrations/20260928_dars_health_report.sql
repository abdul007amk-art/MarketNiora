-- DARS-1.2 durable health report persistence
-- Intentionally UNAPPLIED. Execute only through the approved database migration process.

create table if not exists governance_layer.dars_health_report (
  report_id text primary key,
  run_id text not null,
  knowledge_time timestamptz(6) not null,
  status text not null,
  report jsonb not null,
  created_at timestamptz(6) not null default now(),
  constraint dars_health_report_run_id_key unique (run_id)
);

create index if not exists dars_health_report_knowledge_time_idx
  on governance_layer.dars_health_report (knowledge_time);
