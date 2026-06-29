ALTER TABLE products
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS supplier_plan_id TEXT,
ADD COLUMN IF NOT EXISTS supplier_plan_name TEXT,
ADD COLUMN IF NOT EXISTS supplier_cost_twd NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier_cost_currency TEXT,
ADD COLUMN IF NOT EXISTS supplier_cost_original NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS supplier_raw JSONB;

CREATE INDEX IF NOT EXISTS idx_products_supplier_plan_id
ON products (supplier, supplier_plan_id);
