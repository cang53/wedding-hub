-- Allow recurring expenses to be marked as paid by a "gift" (covered by
-- someone else) or "free". Both mean the expense costs the couple nothing, so
-- the app excludes them from the projection while still listing them.

ALTER TABLE public.life_expenses DROP CONSTRAINT IF EXISTS life_expenses_payer_check;
ALTER TABLE public.life_expenses ADD CONSTRAINT life_expenses_payer_check
  CHECK (payer IN ('bride', 'groom', 'both', 'gift', 'free'));
