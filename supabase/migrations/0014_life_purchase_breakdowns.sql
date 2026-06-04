-- ============================================================================
-- Migration 0014: life_purchase_breakdowns
--
-- Adds a breakdown_items JSONB column to life_purchases so each purchase can
-- be optionally split into named sub-items (e.g. "Honeymoon package €2500" →
-- "Flights €1000, Hotel €800, Excursions €700"). The parent amount remains
-- authoritative for projections; the breakdown is purely for display/detail.
--
-- Shape per element: { "label": string, "amount": number }
-- ============================================================================

ALTER TABLE public.life_purchases
  ADD COLUMN IF NOT EXISTS breakdown_items jsonb NOT NULL DEFAULT '[]'::jsonb;
