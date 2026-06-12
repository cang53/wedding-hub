-- ============================================================================
-- Migration 0015: Trip Scenario Planner
--
-- Redesigns the Honeymoon tab from a flat destination tracker into a
-- multi-scenario, multi-stage trip planner.
--
--   trip_scenarios       — a full candidate itinerary ("Scenario A – Budget")
--     └─ trip_stages     — ordered legs of the trip ("Ubud · 5 nights")
--          └─ stage_accommodations — competing places to stay for that stage
--
-- Cost model: each stage_accommodation carries a price_total for the whole
-- stage. Exactly one accommodation per stage is is_chosen = true; a scenario's
-- total is the sum of its chosen accommodations, minus promo_amount.
--
-- RLS mirrors every other table: full access for allowlisted authenticated
-- users via public.is_allowed(). The legacy public.honeymoon table is left
-- untouched so nothing else breaks.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. trip_scenarios
-- ---------------------------------------------------------------------------

create table if not exists public.trip_scenarios (
  id           uuid        primary key default gen_random_uuid(),
  name         text        not null,
  description  text,
  is_selected  boolean     not null default false,
  promo_code   text,
  promo_amount numeric(12, 2) not null default 0,
  color        text        not null default 'sage',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_trip_scenarios_updated_at on public.trip_scenarios;
create trigger trg_trip_scenarios_updated_at
  before update on public.trip_scenarios
  for each row execute function public.set_updated_at();

-- Enforce "only one scenario selected at a time" at the DB level: a partial
-- unique index lets at most one row carry is_selected = true.
drop index if exists trip_scenarios_one_selected_idx;
create unique index trip_scenarios_one_selected_idx
  on public.trip_scenarios ((is_selected))
  where is_selected;

-- ---------------------------------------------------------------------------
-- 2. trip_stages
-- ---------------------------------------------------------------------------

create table if not exists public.trip_stages (
  id           uuid        primary key default gen_random_uuid(),
  scenario_id  uuid        not null references public.trip_scenarios(id) on delete cascade,
  order_index  integer     not null default 0,
  name         text        not null,
  destination  text,
  nights       integer     not null default 1 check (nights >= 0),
  date_from    date,
  date_to      date,
  notes        text,
  emoji        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists trip_stages_scenario_id_idx
  on public.trip_stages (scenario_id, order_index);

drop trigger if exists trg_trip_stages_updated_at on public.trip_stages;
create trigger trg_trip_stages_updated_at
  before update on public.trip_stages
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. stage_accommodations
-- ---------------------------------------------------------------------------

create table if not exists public.stage_accommodations (
  id              uuid        primary key default gen_random_uuid(),
  stage_id        uuid        not null references public.trip_stages(id) on delete cascade,
  name            text        not null,
  platform        text        not null default 'Other',
  url             text,
  price_total     numeric(12, 2),
  price_per_night numeric(12, 2),
  rating          numeric(4, 2),
  rating_count    integer,
  breakfast       boolean     not null default false,
  pool            boolean     not null default false,
  ac              boolean     not null default false,
  halal_nearby    boolean     not null default false,
  pros            text,
  cons            text,
  notes           text,
  is_chosen       boolean     not null default false,
  image_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists stage_accommodations_stage_id_idx
  on public.stage_accommodations (stage_id);

-- At most one chosen accommodation per stage.
drop index if exists stage_accommodations_one_chosen_idx;
create unique index stage_accommodations_one_chosen_idx
  on public.stage_accommodations (stage_id)
  where is_chosen;

drop trigger if exists trg_stage_accommodations_updated_at on public.stage_accommodations;
create trigger trg_stage_accommodations_updated_at
  before update on public.stage_accommodations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security — same allowlist policy as every other table.
-- ---------------------------------------------------------------------------

alter table public.trip_scenarios       enable row level security;
alter table public.trip_stages          enable row level security;
alter table public.stage_accommodations enable row level security;

drop policy if exists trip_scenarios_allowlist on public.trip_scenarios;
create policy trip_scenarios_allowlist on public.trip_scenarios
  for all using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists trip_stages_allowlist on public.trip_stages;
create policy trip_stages_allowlist on public.trip_stages
  for all using (public.is_allowed()) with check (public.is_allowed());

drop policy if exists stage_accommodations_allowlist on public.stage_accommodations;
create policy stage_accommodations_allowlist on public.stage_accommodations
  for all using (public.is_allowed()) with check (public.is_allowed());
