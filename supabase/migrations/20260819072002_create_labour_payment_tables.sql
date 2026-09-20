/*
# Create labour weekly payment tracking

1. New Tables
- `labourers`: plumbing workers/employees with daily wage info.
- `labour_payments`: weekly payment records (paid every Sunday) with paid/unpaid status.
2. Security
- RLS enabled with anon+authenticated CRUD (single-tenant, no auth).
3. Notes
- Each payment entry tracks the week ending date, amount, and whether it was paid.
- The `paid` boolean drives the sign/cross display in the UI.
*/

CREATE TABLE IF NOT EXISTS labourers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text,
  phone text,
  daily_wage numeric(12,2) NOT NULL DEFAULT 0,
  is_deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS labour_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labourer_id uuid NOT NULL REFERENCES labourers(id) ON DELETE CASCADE,
  week_ending date NOT NULL,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  paid boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labour_payments_week_idx ON labour_payments(week_ending);
CREATE INDEX IF NOT EXISTS labour_payments_labourer_idx ON labour_payments(labourer_id);

ALTER TABLE labourers ENABLE ROW LEVEL SECURITY;
ALTER TABLE labour_payments ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['labourers','labour_payments'] LOOP
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
