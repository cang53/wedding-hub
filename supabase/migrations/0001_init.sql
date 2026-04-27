-- ============================================================================
-- Wedding Hub — initial schema
--
-- One file. Paste it into the Supabase SQL editor (Dashboard → SQL Editor →
-- New query → paste → Run). Idempotent where reasonable so you can re-run it
-- if you tweak something.
--
-- After running:
--   1. UPDATE the two seeded rows in `allowed_emails` to your real emails
--      (the example seeds use placeholders — sign-in WILL fail until you
--      change them).
--   2. In the Supabase dashboard go to Authentication → URL Configuration
--      and add http://localhost:3000 and your production URL to the allowed
--      redirect list. Set Site URL to whichever you use most.
--   3. (Optional) Authentication → Email Templates → Magic Link — tweak the
--      copy if you want.
--
-- Schema layout:
--   - 7 feature tables (todos, agenda, budget, honeymoon, guests, apartments)
--   - allowed_emails (the auth gate)
--   - is_allowed() function used by every RLS policy
--   - shared updated_at trigger
--   - supabase_realtime publication scoped to todos/agenda/budget/guests
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";   -- for gen_random_uuid()

-- ---------------------------------------------------------------------------
-- Shared: updated_at trigger function
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Allowlist: only these two (or however many) emails can authenticate
-- ---------------------------------------------------------------------------

create table if not exists public.allowed_emails (
  email      text primary key,
  created_at timestamptz not null default now()
);

-- Seed with placeholders. UPDATE these to your real emails before signing in.
insert into public.allowed_emails (email) values
  ('me@example.com'),
  ('her@example.com')
on conflict (email) do nothing;

-- is_allowed() — used by every RLS policy below.
-- SECURITY DEFINER so it can read allowed_emails even when the caller is
-- a freshly authenticated user without their own SELECT grant on the table.
create or replace function public.is_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.allowed_emails ae
    where ae.email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- Lock down the function so anonymous users can't probe it.
revoke all on function public.is_allowed() from public;
grant execute on function public.is_allowed() to authenticated;

-- Lock down the allowed_emails table itself: only managed via SQL editor
-- (i.e. service_role / superuser). Authenticated users get nothing.
alter table public.allowed_emails enable row level security;

drop policy if exists "no client access to allowed_emails" on public.allowed_emails;
create policy "no client access to allowed_emails"
  on public.allowed_emails
  for all
  to authenticated
  using (false)
  with check (false);

-- ---------------------------------------------------------------------------
-- 1. todos
-- ---------------------------------------------------------------------------

create table if not exists public.todos (
  id          uuid        primary key default gen_random_uuid(),
  text        text        not null,
  category    text        not null default 'wedding'
    check (category in ('wedding', 'honeymoon', 'home', 'personal')),
  priority    text        not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  due_date    date,
  done        boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_todos_updated_at on public.todos;
create trigger trg_todos_updated_at
  before update on public.todos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. agenda
-- ---------------------------------------------------------------------------

create table if not exists public.agenda (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  date        timestamptz not null,
  all_day     boolean     not null default true,
  location    text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_agenda_updated_at on public.agenda;
create trigger trg_agenda_updated_at
  before update on public.agenda
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. budget
-- ---------------------------------------------------------------------------

create table if not exists public.budget (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  category    text,
  status      text        not null default 'pending'
    check (status in ('pending', 'deposit', 'paid')),
  vendor      text,
  estimated   numeric(12, 2),
  paid        numeric(12, 2) default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_budget_updated_at on public.budget;
create trigger trg_budget_updated_at
  before update on public.budget
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 4. honeymoon
-- ---------------------------------------------------------------------------

create table if not exists public.honeymoon (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  country     text,
  budget      numeric(12, 2),
  duration    text,
  best_time   text,
  notes       text,
  link        text,
  favorite    boolean     not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_honeymoon_updated_at on public.honeymoon;
create trigger trg_honeymoon_updated_at
  before update on public.honeymoon
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 5. guests
-- ---------------------------------------------------------------------------

create table if not exists public.guests (
  id              uuid        primary key default gen_random_uuid(),
  name            text        not null,
  side            text        not null default 'both'
    check (side in ('bride', 'groom', 'both')),
  category        text,
  plus_one        boolean     not null default false,
  plus_one_name   text,
  rsvp            text        not null default 'pending'
    check (rsvp in ('pending', 'yes', 'no')),
  invited         boolean     not null default false,
  email           text,
  phone           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_guests_updated_at on public.guests;
create trigger trg_guests_updated_at
  before update on public.guests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. apartments
-- ---------------------------------------------------------------------------

create table if not exists public.apartments (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null,
  address     text,
  rent        numeric(10, 2),
  charges     numeric(10, 2),
  size        numeric(6, 2),
  bedrooms    int,
  pros        text,
  cons        text,
  status      text        not null default 'interested'
    check (status in ('interested', 'visited', 'applied', 'rejected')),
  rating      int         not null default 0
    check (rating between 0 and 5),
  link        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists trg_apartments_updated_at on public.apartments;
create trigger trg_apartments_updated_at
  before update on public.apartments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: allowlisted users get full access; everyone else nothing.
--
-- Same shape for all 6 feature tables: one policy per table, FOR ALL,
-- delegated to is_allowed(). No user_id column — both users share all rows.
-- ---------------------------------------------------------------------------

alter table public.todos      enable row level security;
alter table public.agenda     enable row level security;
alter table public.budget     enable row level security;
alter table public.honeymoon  enable row level security;
alter table public.guests     enable row level security;
alter table public.apartments enable row level security;

drop policy if exists "allowlist full access" on public.todos;
create policy "allowlist full access" on public.todos
  for all to authenticated using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists "allowlist full access" on public.agenda;
create policy "allowlist full access" on public.agenda
  for all to authenticated using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists "allowlist full access" on public.budget;
create policy "allowlist full access" on public.budget
  for all to authenticated using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists "allowlist full access" on public.honeymoon;
create policy "allowlist full access" on public.honeymoon
  for all to authenticated using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists "allowlist full access" on public.guests;
create policy "allowlist full access" on public.guests
  for all to authenticated using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists "allowlist full access" on public.apartments;
create policy "allowlist full access" on public.apartments
  for all to authenticated using (public.is_allowed()) with check (public.is_allowed());

-- ---------------------------------------------------------------------------
-- Realtime publication
--
-- Only the high-traffic / collaborative tables need realtime. Honeymoon and
-- apartments are low-frequency edits; the dashboard re-queries on navigation,
-- so it doesn't subscribe either.
-- ---------------------------------------------------------------------------

-- supabase_realtime publication is created by Supabase by default. Drop the
-- tables from it first (no-op if not present) so re-running this script
-- doesn't error on duplicate adds.
alter publication supabase_realtime drop table if exists public.todos;
alter publication supabase_realtime drop table if exists public.agenda;
alter publication supabase_realtime drop table if exists public.budget;
alter publication supabase_realtime drop table if exists public.guests;

alter publication supabase_realtime add table public.todos;
alter publication supabase_realtime add table public.agenda;
alter publication supabase_realtime add table public.budget;
alter publication supabase_realtime add table public.guests;

-- ---------------------------------------------------------------------------
-- Done.
--
-- Quick smoke test (run after updating allowed_emails):
--   select public.is_allowed();   -- false from anon role, true from your user
--   insert into public.todos (text) values ('Test row');
--   select * from public.todos;
-- ---------------------------------------------------------------------------
