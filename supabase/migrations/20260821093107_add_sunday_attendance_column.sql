ALTER TABLE labour_attendance
  ADD COLUMN IF NOT EXISTS day_sun boolean NOT NULL DEFAULT false;