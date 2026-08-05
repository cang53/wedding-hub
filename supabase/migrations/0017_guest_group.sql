-- ============================================================================
-- Migration 0017: Guest groups
--
-- Adds a free-form "group" to each guest (e.g. "Uni friends", "Work — Selver",
-- "Neighbours"). Groups are created simply by typing a new name on a guest;
-- there is no separate table to keep in sync. The colour shown for a group is
-- derived from its name in the UI, so no colour column is needed either.
-- ============================================================================

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS guest_group text;

CREATE INDEX IF NOT EXISTS guests_guest_group_idx ON public.guests (guest_group);
