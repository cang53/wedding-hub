ALTER TABLE public.budget
  ADD COLUMN payer text NOT NULL DEFAULT 'both'
    CHECK (payer IN ('bride', 'groom', 'both')),
  ADD COLUMN payer_groom_pct numeric(5, 2) DEFAULT 50
    CHECK (payer_groom_pct BETWEEN 0 AND 100);
