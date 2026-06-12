-- ============================================================================
-- Migration 0016: Trip Scenario Planner — seed data (dev / testing)
--
-- Pre-populates one realistic scenario ("Bali Sept 2026 – Budget Combo") with
-- three stages and two accommodation candidates each. Fixed UUIDs + ON CONFLICT
-- DO NOTHING make this safe to re-run; delete the rows by hand if you want a
-- clean slate.
--
-- Totals: Ubud 205€ + Gili Air 92€ + Nusa Dua 158€ = 455€ chosen.
--         Promo "LASTMINUTE100" −100€  →  355€ to pay.
-- ============================================================================

insert into public.trip_scenarios (id, name, description, is_selected, promo_code, promo_amount, color)
values (
  '11111111-1111-1111-1111-111111111111',
  'Bali Sept 2026 – Budget Combo',
  'Ubud → Gili Air → Nusa Dua, three islands in eleven nights',
  true,
  'LASTMINUTE100',
  100,
  'sage'
)
on conflict (id) do nothing;

-- ---- Stages ---------------------------------------------------------------

insert into public.trip_stages (id, scenario_id, order_index, name, destination, nights, date_from, date_to, emoji)
values
  ('22222222-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 0, 'Ubud',     'Ubud, Bali',         5, '2026-09-10', '2026-09-15', '🌴'),
  ('22222222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 1, 'Gili Air', 'Gili Air, Lombok',   2, '2026-09-15', '2026-09-17', '🏝️'),
  ('22222222-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', 2, 'Nusa Dua', 'Nusa Dua, Bali',     3, '2026-09-17', '2026-09-20', '🏖️')
on conflict (id) do nothing;

-- ---- Accommodations -------------------------------------------------------

insert into public.stage_accommodations
  (id, stage_id, name, platform, price_total, price_per_night, rating, rating_count, is_chosen)
values
  -- Ubud
  ('33333333-0000-0000-0000-000000000001', '22222222-0000-0000-0000-000000000001', 'Nyoman Sandi Guest House', 'Booking', 205, 41,    9.4,  893, true),
  ('33333333-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'Jati 3 Bungalows',         'Booking', 123, 24.6,  8.3, 1311, false),
  -- Gili Air
  ('33333333-0000-0000-0000-000000000003', '22222222-0000-0000-0000-000000000002', 'Captain Goodtimes',        'Booking',  92, 46,    9.0,  517, true),
  ('33333333-0000-0000-0000-000000000004', '22222222-0000-0000-0000-000000000002', 'Si Pitung Village',        'Booking',  51, 25.5,  8.1,  440, false),
  -- Nusa Dua
  ('33333333-0000-0000-0000-000000000005', '22222222-0000-0000-0000-000000000003', 'The Nest Hotel',           'Booking', 158, 52.67, 8.9, 1605, true),
  ('33333333-0000-0000-0000-000000000006', '22222222-0000-0000-0000-000000000003', 'Amnaya Resort',            'Booking', 300, 100,   9.4, 3998, false)
on conflict (id) do nothing;
