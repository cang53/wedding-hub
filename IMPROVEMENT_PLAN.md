# Wedding Hub — Improvement Plan

Plan of record for the next round of work. Based on a full review of the codebase,
git history, and merged PRs (#1–#4) as of 2026-07-27. Wedding date is 2026-09-05
(~6 weeks out), so priorities favor reliability and day-to-day usefulness over new
feature surface.

Current health check (fresh clone, `npm install`):

- `npm run typecheck` — ✅ passes
- `npm test` — ❌ broken: `@testing-library/react` fails to load under vitest 0.34
  (MODULE_NOT_FOUND in `dist/pure.js`); zero tests run
- `npm run lint` — ❌ 23 errors, 6 warnings (react-hooks violations, empty
  interface, etc.)

---

## Priority 1 — Security & correctness (do first)

### 1.1 Restore the auth gate
`src/lib/supabase/middleware.ts` now returns `NextResponse.next()` unconditionally —
the middleware no longer blocks anything, and every server action uses the
**service-role** client (`src/lib/supabase/service.ts`) with no auth check. Net
effect: anyone who discovers the deployed URL can read and write all wedding data.
The README still claims magic-link + allowlist + RLS protection.

- Decide the intended model with the couple in mind: either (a) re-enable the
  Supabase magic-link + allowlist flow that already exists (`/login`,
  `/auth/callback`, allowlist table), or (b) if passwordless-for-two was the
  deliberate choice, add at least a shared-secret cookie check in middleware.
- Add an auth assertion helper called at the top of every server action
  (all `actions.ts` files) — middleware alone doesn't protect action POSTs.
- Update README to match reality.

### 1.2 Fix the broken test suite
Vitest is pinned at `^0.34` (2023-era) with React 19 and Testing Library 16 —
incompatible. Upgrade to current vitest (3.x) + `@vitest/coverage` as needed,
fix `vitest.config.ts`/`vitest.setup.ts`, and get `todo.test.tsx` passing again.

### 1.3 Fix lint errors
23 errors across the repo (notably `react-hooks/set-state-in-effect` in
`src/components/role-selector.tsx`, empty interface in `src/types/testing.d.ts`).
Get `npm run lint` to zero errors so it can gate future PRs.

### 1.4 Add error handling to fire-and-forget actions
Several actions (e.g. `toggleTodo`, `deleteTodo` in `src/app/(dashboard)/todo/actions.ts`)
ignore Supabase errors — a failed write looks like success in the UI. Return and
surface errors consistently, matching the pattern the create/update actions use.

## Priority 2 — Stale seams left by past redesigns

### 2.1 Dashboard is out of date
`src/app/(dashboard)/dashboard/page.tsx` still queries the **legacy `honeymoon`
table** ("Honeymoon picks" stat), but the Honeymoon tab was redesigned into the
Trip Scenario Planner (`trip_scenarios` tables, PR #3). It also shows nothing
from the Life-After budget or Wedding-Day timeline.

- Replace the honeymoon stat with trip-planner data (e.g. final scenario name,
  total cost, nights).
- Add a Life budget stat (e.g. projected end-of-runway or wedding savings total).
- Consider a "days until" + next wedding-day timeline item card.

### 2.2 Remove or migrate the legacy `honeymoon` table
`db.ts` types, the dashboard query, and the old table remain. Either drop it in a
migration (after confirming data was migrated to scenarios) or clearly mark it
deprecated.

### 2.3 README refresh
The README describes a 7-table app with a Budget tab; the Budget tab was removed
(commit c1ab164), Life-Budget and Trip Planner exist, and there are 16 migrations.
Rewrite "What's in the app" and the setup notes (the "run all migrations" step
should mention `0002`–`0016`).

## Priority 3 — Consistency & maintainability

### 3.1 Break up `life-budget-client.tsx` (4,412 lines)
One file holds ~25 components, chart rendering, dialogs, and financial math
(68 `useState` calls). Split into a `life-budget/` module: `calc.ts` (pure
projection/share math — unit-testable), `charts/`, `dialogs/`, `views/`. No
behavior change; verify with typecheck + build.

### 3.2 Realtime parity
Todo, Agenda, Guests, Apartments, and Wedding-Day subscribe to Supabase realtime;
**Life-Budget and the Trip Planner do not** — edits from one phone don't appear on
the other without a refresh. Extract the shared subscription pattern into a
`useRealtimeTable` hook and adopt it in both tabs.

### 3.3 Unit tests for the money math
The life-budget projection logic (`personShare`, `calcMonthlyPayment`,
`isActiveInMonth`, cashflow projection) and the trip-planner totals are the
highest-stakes untested code. After 3.1's extraction, add focused vitest suites.
Target: the math modules fully covered; one smoke test per tab client.

### 3.4 Shared table/sort/filter helpers
Guest-list sorting (PR #4) is bespoke; apartments and other tables would benefit
from the same. Extract `SortHeader` + sort logic into `src/components/table/`.

## Priority 4 — Feature polish (nice-to-have, after the above)

- **Guests**: CSV export for the venue/caterer; dietary-notes field if needed.
- **Wedding-Day**: print-friendly view of the day-of timeline to hand to vendors.
- **Agenda**: ICS export or Google Calendar link per event.
- **PWA touches**: manifest + icons so the app installs nicely on both phones.

## Suggested execution order

1. P1.1 auth (own PR — security)
2. P1.2 + P1.3 + P1.4 tooling/health (one PR)
3. P2.1 + P2.2 + P2.3 stale-seams cleanup (one PR)
4. P3.1 + P3.3 refactor + tests (one PR)
5. P3.2 realtime parity, P3.4 shared table helpers (one PR)
6. P4 items individually, as desired

Each PR: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`
must pass. Migrations are applied manually in Supabase — call out any new
migration prominently in the PR description.
