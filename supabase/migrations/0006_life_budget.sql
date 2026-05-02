-- Life budget: post-wedding daily-life finances (income, recurring expenses,
-- one-time purchases) plus a single-row settings table for the projection.

CREATE TABLE public.life_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  person text NOT NULL DEFAULT 'both' CHECK (person IN ('bride', 'groom', 'both')),
  start_month text,  -- 'YYYY-MM' or NULL meaning "always active"
  end_month text,    -- 'YYYY-MM' or NULL meaning "no end"
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.life_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  category text,
  payer text NOT NULL DEFAULT 'both' CHECK (payer IN ('bride', 'groom', 'both')),
  payer_groom_pct numeric(5, 2) DEFAULT 50 CHECK (payer_groom_pct BETWEEN 0 AND 100),
  start_month text,
  end_month text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.life_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  category text,
  target_month text NOT NULL,  -- 'YYYY-MM' when this purchase is planned
  payer text NOT NULL DEFAULT 'both' CHECK (payer IN ('bride', 'groom', 'both')),
  payer_groom_pct numeric(5, 2) DEFAULT 50 CHECK (payer_groom_pct BETWEEN 0 AND 100),
  scheduled boolean NOT NULL DEFAULT true,  -- toggle off to exclude from projection
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Single-row settings table. The boolean PK trick enforces only one row.
CREATE TABLE public.life_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id = true),
  start_month text NOT NULL DEFAULT '2026-09',
  horizon_months integer NOT NULL DEFAULT 24 CHECK (horizon_months BETWEEN 6 AND 60),
  starting_cash_mode text NOT NULL DEFAULT 'from_wedding'
    CHECK (starting_cash_mode IN ('manual', 'from_wedding')),
  starting_cash_manual numeric(12, 2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row so reads always return one row.
INSERT INTO public.life_settings (id) VALUES (true);

-- Reuses public.set_updated_at() from 0001_init.sql.
CREATE TRIGGER life_income_updated_at BEFORE UPDATE ON public.life_income
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER life_expenses_updated_at BEFORE UPDATE ON public.life_expenses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER life_purchases_updated_at BEFORE UPDATE ON public.life_purchases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER life_settings_updated_at BEFORE UPDATE ON public.life_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
