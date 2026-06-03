-- Allow one-time purchases to be marked as paid by a "gift" (covered by someone
-- else) or "free". Both mean the purchase costs the couple nothing, so the app
-- excludes them from the projection/calendar while still listing them.

ALTER TABLE public.life_purchases DROP CONSTRAINT IF EXISTS life_purchases_payer_check;
ALTER TABLE public.life_purchases ADD CONSTRAINT life_purchases_payer_check
  CHECK (payer IN ('bride', 'groom', 'both', 'gift', 'free'));
