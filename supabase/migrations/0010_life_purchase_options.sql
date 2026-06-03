-- ============================================================================
-- Migration 0010: life_purchase_options
--
-- Lets a one-time purchase hold several alternatives to compare (e.g. three
-- vacuum cleaners at different prices). Each option carries a price, an
-- optional link, and a "like" flag for each partner. One option is "chosen"
-- via life_purchases.selected_option_id; the app mirrors that option's price
-- into life_purchases.amount so the projection and calendar keep using a single
-- amount field with no extra logic.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.life_purchase_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.life_purchases(id) ON DELETE CASCADE,
  label text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  link text,
  notes text,
  groom_like boolean NOT NULL DEFAULT false,
  bride_like boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- The chosen option. ON DELETE SET NULL so deleting an option just clears the
-- selection rather than removing the purchase.
ALTER TABLE public.life_purchases
  ADD COLUMN IF NOT EXISTS selected_option_id uuid
    REFERENCES public.life_purchase_options(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS life_purchase_options_purchase_id_idx
  ON public.life_purchase_options (purchase_id);

-- RLS: same allowlist policy as every other table.
ALTER TABLE public.life_purchase_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS life_purchase_options_allowlist ON public.life_purchase_options;
CREATE POLICY life_purchase_options_allowlist ON public.life_purchase_options
  FOR ALL
  USING (public.is_allowed())
  WITH CHECK (public.is_allowed());

-- Reuses public.set_updated_at() from 0001_init.sql.
DROP TRIGGER IF EXISTS life_purchase_options_updated_at ON public.life_purchase_options;
CREATE TRIGGER life_purchase_options_updated_at BEFORE UPDATE ON public.life_purchase_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
