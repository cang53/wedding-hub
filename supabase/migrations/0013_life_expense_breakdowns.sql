-- ============================================================================
-- Migration 0013: life_expense_breakdowns
--
-- Adds a breakdown_items JSONB column to life_expenses so each expense can be
-- optionally split into named sub-items (e.g. "Honeymoon: 2500€" →
-- "Flights: 1000€, Hotel: 200€, …"). The parent amount remains authoritative
-- for projections; the breakdown is purely for display / budgeting detail.
--
-- Shape per element: { "label": string, "amount": number }
-- ============================================================================

ALTER TABLE public.life_expenses
  ADD COLUMN IF NOT EXISTS breakdown_items jsonb NOT NULL DEFAULT '[]'::jsonb;
