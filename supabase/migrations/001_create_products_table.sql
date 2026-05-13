CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  country TEXT NOT NULL,
  data_amount TEXT NOT NULL,
  validity_days INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
