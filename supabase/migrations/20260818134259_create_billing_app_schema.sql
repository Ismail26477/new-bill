/*
# Create plumbing billing workspace

1. New Tables
- `company_settings`: one-row business profile and document preferences.
- `customers`: customer and project contact records.
- `items`: reusable plumbing services and rates.
- `quotations` and `quotation_items`: estimates with line items and statuses.
- `invoices` and `invoice_items`: bills with line items and payment summaries.
- `payments`: invoice payment entries.
2. Security
- Every table has RLS enabled.
- This is a single-tenant, no-sign-in workspace, so anon and authenticated roles receive CRUD access.
3. Notes
- Document numbers are unique.
- Line items are deleted with their parent document.
- Starter company settings and plumbing services are inserted only when absent.
*/

CREATE TABLE IF NOT EXISTS company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL DEFAULT 'SHRI TIRUPATI PLUMBING CONTRACTOR',
  proprietor_name text NOT NULL DEFAULT 'Bandu S. Pathe',
  address text NOT NULL DEFAULT 'SHRI DR ANIL KAD SIR WASHIM',
  phone text NOT NULL DEFAULT '9766677051',
  alternate_phone text,
  email text NOT NULL DEFAULT 'vaibhavpathe060@gmail.com',
  website text,
  gst_number text,
  pan_number text,
  logo text,
  bank_name text,
  account_holder text,
  account_number text,
  ifsc_code text,
  upi_id text,
  invoice_prefix text NOT NULL DEFAULT 'INV-',
  quotation_prefix text NOT NULL DEFAULT 'QT-',
  invoice_start_number integer NOT NULL DEFAULT 1,
  quotation_start_number integer NOT NULL DEFAULT 1,
  default_tax numeric(12,2) NOT NULL DEFAULT 0,
  default_discount numeric(12,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT '₹',
  date_format text NOT NULL DEFAULT 'DD MMM YYYY',
  default_footer text NOT NULL DEFAULT 'Thank you for choosing us. SHRI TIRUPATI PLUMBING — The smart choice for better toilet experience.',
  trust_text text NOT NULL DEFAULT '30 years of plumbing trust',
  default_terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  project_name text,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  email text,
  gst_number text,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'General Plumbing',
  unit text NOT NULL DEFAULT 'NOS.',
  default_rate numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  quotation_date date NOT NULL DEFAULT current_date,
  valid_until date,
  status text NOT NULL DEFAULT 'Draft',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'NOS.',
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  rate numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  invoice_date date NOT NULL DEFAULT current_date,
  due_date date,
  status text NOT NULL DEFAULT 'Draft',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  tax numeric(12,2) NOT NULL DEFAULT 0,
  round_off numeric(12,2) NOT NULL DEFAULT 0,
  grand_total numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  balance_due numeric(12,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id uuid REFERENCES items(id) ON DELETE SET NULL,
  description text NOT NULL,
  unit text NOT NULL DEFAULT 'NOS.',
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  rate numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  payment_date date NOT NULL DEFAULT current_date,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'Cash',
  reference_number text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_name_idx ON customers(name);
CREATE INDEX IF NOT EXISTS items_category_idx ON items(category);
CREATE INDEX IF NOT EXISTS quotations_date_idx ON quotations(quotation_date);
CREATE INDEX IF NOT EXISTS invoices_date_idx ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS payments_date_idx ON payments(payment_date);

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['company_settings','customers','items','quotations','quotation_items','invoices','invoice_items','payments'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "single_tenant_select_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "single_tenant_insert_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "single_tenant_update_%s" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "single_tenant_delete_%s" ON %I', t, t);
    EXECUTE format('CREATE POLICY "single_tenant_select_%s" ON %I FOR SELECT TO anon, authenticated USING (true)', t, t);
    EXECUTE format('CREATE POLICY "single_tenant_insert_%s" ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "single_tenant_update_%s" ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "single_tenant_delete_%s" ON %I FOR DELETE TO anon, authenticated USING (true)', t, t);
  END LOOP;
END $$;

INSERT INTO company_settings (id) SELECT gen_random_uuid() WHERE NOT EXISTS (SELECT 1 FROM company_settings);

INSERT INTO items (name, description, category, unit, default_rate)
SELECT * FROM (VALUES
  ('Toilet and bath arrangement', 'Toilet and bath including wall-hung installation', 'Toilet & Bath', 'SET', 18000),
  ('Concealed cistern installation', 'Toilet and bath with concealed cistern', 'Toilet & Bath', 'SET', 22000),
  ('Shower with mixer', 'Supply and installation of shower with mixer', 'Bathroom Fittings', 'SET', 6500),
  ('Wash basin', 'Wash basin installation with waste connection', 'Bathroom Fittings', 'NOS.', 4500),
  ('Kitchen and wash-up arrangement', 'Complete kitchen and wash-up plumbing arrangement', 'Kitchen & Wash', 'SET', 16000),
  ('Drainage pipeline', 'PVC drainage pipeline including fittings', 'Drainage', 'RFT.', 350),
  ('Rain water pipeline', 'Rain water pipeline with supports', 'Drainage', 'RFT.', 280),
  ('Water tank connection', 'Overhead water tank connection and fittings', 'Water Tank', 'SET', 8500),
  ('Motor connection', 'Pump motor connection with valves', 'Water Pipeline', 'SET', 6500),
  ('Extra tap connection', 'Extra tap point with concealed piping', 'General Plumbing', 'NOS.', 1200),
  ('AC drain outlet', 'AC drain outlet with trap', 'Drainage', 'NOS.', 950),
  ('Brick work', 'RCC/PCC brick work for plumbing chase', 'Labour', 'SQ.FT.', 180),
  ('Pipe connection', 'General pipe connection and fitting work', 'General Plumbing', 'NOS.', 850)
) AS seed(name, description, category, unit, default_rate)
WHERE NOT EXISTS (SELECT 1 FROM items);
