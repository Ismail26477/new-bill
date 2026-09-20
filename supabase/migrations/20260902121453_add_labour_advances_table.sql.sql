/*
# Add labour advance payment tracking

1. New Tables
- `labour_advances`: records money given to a worker in advance of earned wages.
  - `amount`: total advance given.
  - `amount_remaining`: how much is still unrecovered; starts equal to `amount`
    and decreases as future weeks' earnings recover it. This column (not a
    settled boolean) is what lets a single advance spread across multiple weeks.
  - `given_date`: the day the advance was handed over (defaults to today).
  - `note`: optional description.
2. Security
- RLS enabled on `labour_advances` with anon+authenticated CRUD
  (single-tenant, no auth), matching the existing labour tables.
3. Notes
- Advances are not tied to a specific week. A worker can take an advance any
  day, and the `amount_remaining` column keeps reducing from whatever future
  weeks he earns until it reaches 0.
- Deleting a labourer cascades to their advances (FK ON DELETE CASCADE).
*/

CREATE TABLE IF NOT EXISTS labour_advances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labourer_id uuid NOT NULL REFERENCES labourers(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  amount_remaining numeric(12,2) NOT NULL,
  given_date date NOT NULL DEFAULT current_date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS labour_advances_labourer_idx ON labour_advances(labourer_id);
CREATE INDEX IF NOT EXISTS labour_advances_pending_idx ON labour_advances(labourer_id) WHERE amount_remaining > 0;

ALTER TABLE labour_advances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "single_tenant_select_labour_advances" ON labour_advances;
CREATE POLICY "single_tenant_select_labour_advances" ON labour_advances FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "single_tenant_insert_labour_advances" ON labour_advances;
CREATE POLICY "single_tenant_insert_labour_advances" ON labour_advances FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "single_tenant_update_labour_advances" ON labour_advances;
CREATE POLICY "single_tenant_update_labour_advances" ON labour_advances FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "single_tenant_delete_labour_advances" ON labour_advances;
CREATE POLICY "single_tenant_delete_labour_advances" ON labour_advances FOR DELETE TO anon, authenticated USING (true);
