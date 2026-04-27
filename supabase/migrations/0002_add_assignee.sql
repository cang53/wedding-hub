-- ============================================================================
-- Migration 0002: Add assignee field to wedding_day_events
--
-- Allows tagging each wedding day event as relevant to:
--   - 'bride'  (bride only — e.g., bridal preparation)
--   - 'groom'  (groom only — e.g., groomsmen photos)
--   - 'both'   (both partners — e.g., ceremony, reception)
--
-- Default is 'both' since most events are shared.
-- ============================================================================

alter table public.wedding_day_events
  add column if not exists assignee text not null default 'both'
  check (assignee in ('bride', 'groom', 'both'));
