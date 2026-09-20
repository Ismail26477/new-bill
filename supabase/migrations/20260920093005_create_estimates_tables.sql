/*
# Create estimates and estimate_items tables

1. New Tables
- `estimates`: header record for an estimate/list given to a client for purchasing.
  - `id` (uuid, primary key)
  - `estimate_number` (text, unique) — auto-generated document number like EST-0001
  - `customer_id` (uuid, references customers, nullable) — optional link to a customer
  - `estimate_date` (date) — when the estimate was created
  - `status` (text, default 'Draft') — Draft or Sent
  - `notes` (text, nullable) — optional notes
  - `created_at` (timestamp)
- `estimate_items`: line items belonging to an estimate.
  - `id` (uuid, primary key)
  - `estimate_id` (uuid, references estimates, cascade delete)
  - `description` (text) — what the item is
  - `particulars` (text, nullable) — extra details/specifications
  - `quantity` (numeric, default 1) — how many
  - `created_at` (timestamp)
2. Security
- Enable RLS on both tables.
- Single-tenant no-auth workspace: anon + authenticated get full CRUD (same as all other tables).
3. Notes
- Estimates are simple lists (SN, Description, Particulars, QTY) given to clients for purchasing.
- No rate/amount columns — this is a purchase list, not a priced document.
- Deleting an estimate cascades to its items.
*/

CREATE TABLE IF NOT EXISTS estimates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_number text NOT NULL UNIQUE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  estimate_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'Draft',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS estimate_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id uuid NOT NULL REFERENCES estimates(id) ON DELETE CASCADE,
  description text NOT NULL,
  particulars text,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estimates_date_idx ON estimates(estimate_date);
CREATE INDEX IF NOT EXISTS estimate_items_estimate_idx ON estimate_items(estimate_id);

ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimate_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "single_tenant_select_estimates" ON estimates;
CREATE POLICY "single_tenant_select_estimates" ON estimates FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "single_tenant_insert_estimates" ON estimates;
CREATE POLICY "single_tenant_insert_estimates" ON estimates FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "single_tenant_update_estimates" ON estimates;
CREATE POLICY "single_tenant_update_estimates" ON estimates FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "single_tenant_delete_estimates" ON estimates;
CREATE POLICY "single_tenant_delete_estimates" ON estimates FOR DELETE
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "single_tenant_select_estimate_items" ON estimate_items;
CREATE POLICY "single_tenant_select_estimate_items" ON estimate_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "single_tenant_insert_estimate_items" ON estimate_items;
CREATE POLICY "single_tenant_insert_estimate_items" ON estimate_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "single_tenant_update_estimate_items" ON estimate_items;
CREATE POLICY "single_tenant_update_estimate_items" ON estimate_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "single_tenant_delete_estimate_items" ON estimate_items;
CREATE POLICY "single_tenant_delete_estimate_items" ON estimate_items FOR DELETE
  TO anon, authenticated USING (true);
