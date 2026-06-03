-- Pin income / expenses / purchases to a specific day of the month so the
-- Life After calendar can place them on the right date. Idempotent so it is
-- safe to run even if the columns were already added by hand in production.

ALTER TABLE public.life_income
  ADD COLUMN IF NOT EXISTS day_of_month integer
    CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31);

ALTER TABLE public.life_expenses
  ADD COLUMN IF NOT EXISTS day_of_month integer
    CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31);

ALTER TABLE public.life_purchases
  ADD COLUMN IF NOT EXISTS day_of_month integer
    CHECK (day_of_month IS NULL OR day_of_month BETWEEN 1 AND 31);
