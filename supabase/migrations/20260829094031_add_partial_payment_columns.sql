/*
# Add partial payment support to labour_payments

1. Modified Tables
- `labour_payments`
  - `amount_paid` (numeric, default 0): cumulative amount paid so far for this week
  - `balance` (numeric, default 0): remaining balance (amount - amount_paid)
  - `payment_status` (text, default 'Unpaid'): one of 'Unpaid', 'Partial', 'Paid'
2. Notes
- The existing `paid` boolean remains for backward compatibility; `payment_status` is the new source of truth.
- `amount` is the total wage for the week; `amount_paid` tracks partial payments; `balance` = amount - amount_paid.
- Backfill: existing rows get amount_paid = amount (if paid) or 0 (if unpaid), balance accordingly, and payment_status derived from paid flag.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labour_payments' AND column_name = 'amount_paid') THEN
    ALTER TABLE labour_payments ADD COLUMN amount_paid numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labour_payments' AND column_name = 'balance') THEN
    ALTER TABLE labour_payments ADD COLUMN balance numeric(12,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'labour_payments' AND column_name = 'payment_status') THEN
    ALTER TABLE labour_payments ADD COLUMN payment_status text NOT NULL DEFAULT 'Unpaid';
  END IF;
END $$;

-- Backfill existing rows
UPDATE labour_payments SET amount_paid = amount, balance = 0, payment_status = 'Paid' WHERE paid = true AND amount_paid = 0;
UPDATE labour_payments SET amount_paid = 0, balance = amount, payment_status = 'Unpaid' WHERE paid = false AND balance = 0;
