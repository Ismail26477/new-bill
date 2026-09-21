create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  project_name text,
  address text,
  city text,
  state text,
  pincode text,
  phone text,
  email text,
  gst_number text,
  notes text,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.company_settings (
  id uuid primary key default gen_random_uuid(),
  company_name text not null default 'SHRI VENKTESH PLUMBING CONTRACTOR WSHIM',
  proprietor_name text not null default 'HARISH S PHUSE',
  address text not null default 'SHRI VENKTESH PLUMBING CONTRACTOR WSHIM',
  phone text not null default '9623199934',
  email text not null default '',
  invoice_prefix text not null default 'INV-',
  quotation_prefix text not null default 'QUO-',
  default_tax numeric not null default 0,
  default_footer text not null default '',
  trust_text text not null default '',
  currency text not null default 'INR',
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'Unpaid',
  grand_total numeric not null default 0,
  amount_paid numeric not null default 0,
  balance_due numeric not null default 0,
  discount numeric not null default 0,
  tax numeric not null default 0,
  invoice_date date not null default current_date,
  due_date date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quotation_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'Draft',
  grand_total numeric not null default 0,
  discount numeric not null default 0,
  tax numeric not null default 0,
  quotation_date date not null default current_date,
  valid_until date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  estimate_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  estimate_date date not null default current_date,
  status text not null default 'Draft',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.labourers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text,
  phone text,
  daily_wage numeric not null default 0,
  weekly_incentive numeric not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.labour_payments (
  id uuid primary key default gen_random_uuid(),
  labourer_id uuid not null references public.labourers(id) on delete cascade,
  week_ending date not null,
  amount numeric not null default 0,
  amount_paid numeric not null default 0,
  balance numeric not null default 0,
  payment_status text not null default 'Unpaid',
  paid boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.labour_attendance (
  id uuid primary key default gen_random_uuid(),
  labourer_id uuid not null references public.labourers(id) on delete cascade,
  week_ending date not null,
  day_mon boolean not null default false,
  day_tue boolean not null default false,
  day_wed boolean not null default false,
  day_thu boolean not null default false,
  day_fri boolean not null default false,
  day_sat boolean not null default false,
  day_sun boolean not null default false,
  incentive numeric not null default 0,
  amount numeric not null default 0,
  settled boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.labour_advances (
  id uuid primary key default gen_random_uuid(),
  labourer_id uuid not null references public.labourers(id) on delete cascade,
  amount numeric not null default 0,
  amount_remaining numeric not null default 0,
  given_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  description text not null,
  unit text not null default 'Nos',
  quantity numeric not null default 1,
  rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  description text not null,
  unit text not null default 'Nos',
  quantity numeric not null default 1,
  rate numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates(id) on delete cascade,
  description text not null,
  particulars text,
  quantity numeric not null default 1,
  created_at timestamptz not null default now()
);

insert into public.company_settings (company_name, proprietor_name, address, phone)
select 'SHRI VENKTESH PLUMBING CONTRACTOR WSHIM', 'HARISH S PHUSE', 'SHRI VENKTESH PLUMBING CONTRACTOR WSHIM', '9623199934'
where not exists (select 1 from public.company_settings);

alter table public.customers enable row level security;
alter table public.company_settings enable row level security;
alter table public.invoices enable row level security;
alter table public.quotations enable row level security;
alter table public.estimates enable row level security;
alter table public.labourers enable row level security;
alter table public.labour_payments enable row level security;
alter table public.labour_attendance enable row level security;
alter table public.labour_advances enable row level security;
alter table public.invoice_items enable row level security;
alter table public.quotation_items enable row level security;
alter table public.estimate_items enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'customers', 'company_settings', 'invoices', 'quotations', 'estimates',
    'labourers', 'labour_payments', 'labour_attendance', 'labour_advances',
    'invoice_items', 'quotation_items', 'estimate_items'
  ] loop
    execute format('drop policy if exists %I on public.%I', table_name || '_app_access', table_name);
    execute format(
      'create policy %I on public.%I for all to anon, authenticated using (true) with check (true)',
      table_name || '_app_access', table_name
    );
  end loop;
end $$;

create index if not exists invoices_customer_id_idx on public.invoices(customer_id);
create index if not exists quotations_customer_id_idx on public.quotations(customer_id);
create index if not exists estimates_customer_id_idx on public.estimates(customer_id);
create index if not exists invoice_items_invoice_id_idx on public.invoice_items(invoice_id);
create index if not exists quotation_items_quotation_id_idx on public.quotation_items(quotation_id);
create index if not exists estimate_items_estimate_id_idx on public.estimate_items(estimate_id);
create index if not exists labour_payments_labourer_id_idx on public.labour_payments(labourer_id);
create index if not exists labour_attendance_labourer_id_idx on public.labour_attendance(labourer_id);
create index if not exists labour_advances_labourer_id_idx on public.labour_advances(labourer_id);
