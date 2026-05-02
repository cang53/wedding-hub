ALTER TABLE public.life_expenses
  ADD COLUMN expense_type text NOT NULL DEFAULT 'fixed'
    CHECK (expense_type IN ('fixed', 'credit')),
  ADD COLUMN credit_total numeric(12, 2),
  ADD COLUMN credit_months integer CHECK (credit_months > 0),
  ADD COLUMN credit_interest_rate numeric(5, 2) DEFAULT 0
    CHECK (credit_interest_rate >= 0);
