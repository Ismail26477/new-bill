/*
# Add per-day incentive and site name columns to labour_attendance

1. Modified Tables
- `labour_attendance`: add 7 numeric columns `incentive_mon` through
  `incentive_sun` (default 0) so each day can have its own incentive amount,
  and 7 text columns `site_mon` through `site_sun` (nullable) so each day
  can record which site the worker was at.
2. Notes
- The existing weekly `incentive` column is kept for backwards compatibility
  but new code will use the per-day columns. The total weekly amount is now
  calculated as: present_days * daily_wage + sum of per-day incentives.
- No security changes — RLS policies already cover the table.
*/

ALTER TABLE labour_attendance
  ADD COLUMN IF NOT EXISTS incentive_mon numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentive_tue numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentive_wed numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentive_thu numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentive_fri numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentive_sat numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS incentive_sun numeric(12,2) NOT NULL DEFAULT 0;

ALTER TABLE labour_attendance
  ADD COLUMN IF NOT EXISTS site_mon text,
  ADD COLUMN IF NOT EXISTS site_tue text,
  ADD COLUMN IF NOT EXISTS site_wed text,
  ADD COLUMN IF NOT EXISTS site_thu text,
  ADD COLUMN IF NOT EXISTS site_fri text,
  ADD COLUMN IF NOT EXISTS site_sat text,
  ADD COLUMN IF NOT EXISTS site_sun text;
