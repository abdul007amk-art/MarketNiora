BEGIN;

-- Market Classification
CREATE TABLE IF NOT EXISTS production_layer.sector (
  sector_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS production_layer.sub_sector (
  sub_sector_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid NOT NULL REFERENCES production_layer.sector(sector_id),
  name text NOT NULL,
  UNIQUE (sector_id, name)
);

CREATE TABLE IF NOT EXISTS production_layer.stock_classification (
  stock_id uuid PRIMARY KEY REFERENCES production_layer.canonical_stock(stock_id),
  sub_sector_id uuid NOT NULL REFERENCES production_layer.sub_sector(sub_sector_id),
  verified_at timestamptz,
  source text
);

-- Master Stock Group registry — separate from Market Classification hierarchy.
CREATE TABLE IF NOT EXISTS production_layer.stock_group (
  group_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS production_layer.stock_group_membership (
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  group_id uuid NOT NULL REFERENCES production_layer.stock_group(group_id),
  verified_at timestamptz,
  source text,
  PRIMARY KEY (stock_id, group_id)
);

-- Theme Intelligence: THEME -> SUB-THEME -> INDUSTRY -> STOCK.
CREATE TABLE IF NOT EXISTS production_layer.theme (
  theme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS production_layer.sub_theme (
  sub_theme_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  theme_id uuid NOT NULL REFERENCES production_layer.theme(theme_id),
  name text NOT NULL,
  UNIQUE (theme_id, name)
);

CREATE TABLE IF NOT EXISTS production_layer.industry (
  industry_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_theme_id uuid NOT NULL REFERENCES production_layer.sub_theme(sub_theme_id),
  name text NOT NULL,
  UNIQUE (sub_theme_id, name)
);

CREATE TABLE IF NOT EXISTS production_layer.stock_theme_membership (
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  industry_id uuid NOT NULL REFERENCES production_layer.industry(industry_id),
  verified_at timestamptz,
  source text,
  PRIMARY KEY (stock_id, industry_id)
);

-- Business / Value Chain
CREATE TABLE IF NOT EXISTS production_layer.value_chain_stage (
  stage_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  stage_name text NOT NULL CHECK (stage_name IN (
    'RAW_MATERIAL_INPUT',
    'MINING_EXTRACTION',
    'SOURCING_PROCUREMENT',
    'PROCESSING',
    'MANUFACTURING',
    'CAPACITY_UTILISATION_CAPEX',
    'PRODUCTS_BYPRODUCTS',
    'CUSTOMERS_DISTRIBUTION',
    'DOWNSTREAM_INDUSTRIES',
    'FINAL_END_USE'
  )),
  detail jsonb,
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS production_layer.value_chain_evidence (
  evidence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES production_layer.value_chain_stage(stage_id),
  evidence_type text NOT NULL,
  source_name text NOT NULL,
  source_url text,
  observed_at timestamptz,
  claim text NOT NULL,
  verification production_layer.verification_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS value_chain_stage_stock_idx
  ON production_layer.value_chain_stage(stock_id, stage_name);

CREATE INDEX IF NOT EXISTS value_chain_evidence_stage_idx
  ON production_layer.value_chain_evidence(stage_id);

-- Rotation outputs.
CREATE TABLE IF NOT EXISTS production_layer.rotation_score (
  rotation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  horizon text NOT NULL,
  stock_group_id uuid REFERENCES production_layer.stock_group(group_id),
  sub_sector_id uuid REFERENCES production_layer.sub_sector(sub_sector_id),
  sector_id uuid REFERENCES production_layer.sector(sector_id),
  median_return numeric,
  participation numeric,
  ew_capped_return numeric,
  iqr_consistency numeric,
  confidence numeric NOT NULL,
  state text,
  final_score numeric,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  formula_version_id uuid NOT NULL REFERENCES public.formula_version(formula_version_id),
  configuration_snapshot jsonb NOT NULL,
  CHECK (level IN ('STOCK_GROUP','SUB_SECTOR','SECTOR')),
  CHECK (horizon IN ('1D','1W','1M','3M')),
  CHECK (
    (level = 'STOCK_GROUP' AND stock_group_id IS NOT NULL AND sub_sector_id IS NULL AND sector_id IS NULL)
    OR
    (level = 'SUB_SECTOR' AND stock_group_id IS NULL AND sub_sector_id IS NOT NULL AND sector_id IS NULL)
    OR
    (level = 'SECTOR' AND stock_group_id IS NULL AND sub_sector_id IS NULL AND sector_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS rotation_score_level_horizon_time_idx
  ON production_layer.rotation_score(level, horizon, calculated_at);

-- Stock Score historical outputs — NOT unique by stock, because history is required.
CREATE TABLE IF NOT EXISTS production_layer.stock_score (
  score_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id uuid NOT NULL REFERENCES production_layer.canonical_stock(stock_id),
  momentum numeric,
  earnings_momentum numeric,
  business_quality numeric,
  relative_strength numeric,
  valuation numeric,
  trend_quality numeric,
  volume_confirmation numeric,
  growth_visibility numeric,
  base_score numeric,
  risk_penalty numeric CHECK (risk_penalty BETWEEN -30 AND 0),
  catalyst integer CHECK (catalyst IN (0,4,8,12)),
  final_score numeric CHECK (final_score BETWEEN 0 AND 100 OR final_score IS NULL),
  confidence numeric NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  formula_version_id uuid NOT NULL REFERENCES public.formula_version(formula_version_id),
  configuration_snapshot jsonb NOT NULL,
  comparison_snapshot jsonb
);

CREATE INDEX IF NOT EXISTS stock_score_stock_time_idx
  ON production_layer.stock_score(stock_id, calculated_at);

CREATE INDEX IF NOT EXISTS stock_score_formula_time_idx
  ON production_layer.stock_score(formula_version_id, calculated_at);

-- Shariah display/status storage.
CREATE TABLE IF NOT EXISTS production_layer.shariah_status (
  stock_id uuid PRIMARY KEY REFERENCES production_layer.canonical_stock(stock_id),
  status text NOT NULL CHECK (status IN ('VERIFIED_SHARIAH','NON_SHARIAH','PENDING')),
  source text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMIT;

