/*
# Add weekly attendance tracking and incentives for labourers

1. New Tables
- `labour_attendance`: one row per worker per week, storing Monday-Saturday
  present/absent flags, an optional weekly incentive amount, and the auto-
  calculated total wage for that week. Sunday is the payment day.
2. Modified Tables
- `labourers`: add `weekly_incentive` numeric column (default 0) so each
  worker can have a recurring weekly incentive that is added when all six
  working days are ticked present.
3. Security
- RLS enabled on `labour_attendance` with anon+authenticated CRUD
  (single-tenant, no auth), matching the existing labour tables.
4. Notes
- A week runs Monday to Saturday. Toggling a day updates the stored flags
  and the computed amount (present_days * daily_wage + incentive when all
  six days are present). Sunday is treated as the payment/settlement day.
- The `amount` column on `labour_attendance` is the final payable wage for
  the week and is mirrored into `labour_payments` when settled, so existing
  payment history and totals remain intact.
*/

ALTER TABLE labourers
  ADD COLUMN IF NOT EXISTS weekly_incentive numeric(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS labour_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  labourer_id uuid NOT NULL REFERENCES labourers(id) ON DELETE CASCADE,
  week_ending date NOT NULL,
  day_mon boolean NOT NULL DEFAULT false,
  day_tue boolean NOT NULL DEFAULT false,
  day_wed boolean NOT NULL DEFAULT false,
  day_thu boolean NOT NULL DEFAULT false,
  day_fri boolean NOT NULL DEFAULT false,
  day_sat boolean NOT NULL DEFAULT false,
  incentive numeric(12,2) NOT NULL DEFAULT 0,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  settled boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (labourer_id, week_ending)
);

CREATE INDEX IF NOT EXISTS labour_attendance_week_idx ON labour_attendance(week_ending);
CREATE INDEX IF NOT EXISTS labour_attendance_labourer_idx ON labour_attendance(labourer_id);

ALTER TABLE labour_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "single_tenant_select_labour_attendance" ON labour_attendance;
CREATE POLICY "single_tenant_select_labour_attendance" ON labour_attendance FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "single_tenant_insert_labour_attendance" ON labour_attendance;
CREATE POLICY "single_tenant_insert_labour_attendance" ON labour_attendance FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "single_tenant_update_labour_attendance" ON labour_attendance;
CREATE POLICY "single_tenant_update_labour_attendance" ON labour_attendance FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "single_tenant_delete_labour_attendance" ON labour_attendance;
CREATE POLICY "single_tenant_delete_labour_attendance" ON labour_attendance FOR DELETE TO anon, authenticated USING (true);
