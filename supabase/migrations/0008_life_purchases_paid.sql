ALTER TABLE public.life_purchases
  ADD COLUMN already_paid numeric(12, 2) NOT NULL DEFAULT 0
    CHECK (already_paid >= 0);
