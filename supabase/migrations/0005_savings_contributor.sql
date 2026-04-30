ALTER TABLE public.wedding_savings
  ADD COLUMN contributor text NOT NULL DEFAULT 'both'
    CHECK (contributor IN ('bride', 'groom', 'both'));
