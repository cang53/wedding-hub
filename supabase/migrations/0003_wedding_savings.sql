-- ============================================================================
-- Migration 0003: wedding_savings
--
-- Tracks money set aside for the wedding (the "revenue" side of the budget).
-- Each row is a single contribution: an amount, the date it was saved,
-- and an optional source label (e.g., "Celal salary", "Selver salary",
-- "Family gift"). The Overview view aggregates these into a monthly trend
-- and compares total saved vs. total estimated cost.
-- ============================================================================

create table if not exists public.wedding_savings (
  id uuid primary key default gen_random_uuid(),
  amount numeric not null check (amount >= 0),
  saved_on date not null default current_date,
  source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- RLS: same allowlist policy as other tables.
alter table public.wedding_savings enable row level security;

drop policy if exists wedding_savings_allowlist on public.wedding_savings;
create policy wedding_savings_allowlist on public.wedding_savings
  for all
  using (public.is_allowed())
  with check (public.is_allowed());

-- Realtime
alter publication supabase_realtime add table public.wedding_savings;

-- Index for fast monthly aggregation
create index if not exists wedding_savings_saved_on_idx
  on public.wedding_savings (saved_on desc);
