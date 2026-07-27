# Wedding Hub

Wedding planning app for two. Next.js 16 + Supabase, realtime sync between phones.

Wedding date is set in `src/lib/config.ts` — edit `WEDDING_DATE` once it's locked.

> ### ⚠️ The app has no sign-in
>
> The email login flow was removed in `18361bc`, and the middleware has passed
> every request straight through ever since. The landing page asks whether
> you're the bride or the groom, but that's a display preference in
> `localStorage` — it is not authentication and nothing checks it.
>
> Server Components and Server Actions all read and write through the
> **service-role** Supabase client (`src/lib/supabase/service.ts`), which
> bypasses RLS entirely, and none of them assert a caller. So **anyone who
> knows the deployed URL has full read and write access** to guests, budgets,
> savings and every other table, through the app's own UI.
>
> This is a deliberate trade-off for now, not an oversight — but if the URL
> is ever shared, posted, or guessed, treat everything in the database as
> public. Options if you want it closed: a shared passphrase in middleware,
> restoring the magic-link gate (the allowlist code and RLS policies are
> still in place, see below), or Vercel's deployment password protection.

---

## What's in the app

End-to-end working pieces:

- App shell: masthead with live countdown, tab nav, footer
- Entry: `/` role picker (bride/groom) → dashboard. `/login` now just redirects to `/`
- **Dashboard** with stats from all seven feature tables
- **To-Do** — full CRUD, dialog, realtime
- **Agenda** — full CRUD, dialog, realtime, optional time + all-day support
- **Budget** — line items, payment status, running totals
- **Honeymoon** — destination ideas with favourites and reference links
- **Guests** — RSVP tracking, plus-ones, contact details
- **Apartments** — listings, ratings, and application status
- **Wedding Day** — ceremony-day timeline planning

Migration covers all 7 feature tables plus the auth allowlist, so everything is wired up DB-side.

---

## Setup

### 1. Install dependencies

> ⚠️ The project was scaffolded inside a sandbox that couldn't finish `npm install` cleanly (FUSE mount quirk). Run this once on your Mac to repair:

```bash
cd ~/Documents/wedding-hub
rm -rf node_modules package-lock.json
npm install
```

That should produce a clean `node_modules` and `package-lock.json` you can commit. Then verify:

```bash
npm run typecheck
npm run build
```

Both should succeed.

### 2. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Region: pick **Frankfurt** or **Paris** (closest to Belgium → lower latency).
3. Name it whatever you like ("wedding-hub" works). Set a strong DB password — you won't need it for the app, but Supabase requires one.
4. Wait ~2 min for provisioning.

### 3. Run the migration

1. In the Supabase dashboard sidebar: **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_init.sql` from this repo, copy the whole file, paste into the editor.
3. Click **Run**. You should see `Success. No rows returned`.

This creates: 7 feature tables, the `allowed_emails` table seeded with two placeholders, the `is_allowed()` function, RLS policies on every table, and a realtime publication scoped to `todos`/`agenda`/`budget`/`guests`.

### 4. Update the allowlist (dormant)

The allowlist and its RLS policies are still in the schema, but nothing
consults them while sign-in is disabled — server-side reads and writes use the
service-role key, which bypasses RLS. Keep this accurate anyway, so restoring
the auth gate is a one-commit job rather than a migration.

Still in the SQL Editor, run:

```sql
update public.allowed_emails set email = 'your-real@email.com' where email = 'me@example.com';
update public.allowed_emails set email = 'her-real@email.com' where email = 'her@example.com';
```

Verify:

```sql
select * from public.allowed_emails;
```

You should see exactly two rows with the real addresses.

### 5. Configure auth in Supabase (only if you restore sign-in)

Skip this while the app is open — no magic links are sent. It's kept here
because `/auth/callback` still works and would need these settings.

1. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` (you'll change this to your Vercel URL after deploying)
   - **Redirect URLs**: add both `http://localhost:3000/auth/callback` and (later) `https://YOUR-PROD-DOMAIN/auth/callback`
2. **Authentication → Providers → Email**:
   - Enable **Email** provider (it's on by default)
   - Make sure **Confirm email** is OFF or set to "magic link only" — we don't want a separate sign-up step
3. (Optional) **Authentication → Email Templates → Magic Link** — tweak the copy if you want to.

### 6. Fill in `.env.local`

```bash
cp .env.local.example .env.local
```

Then in Supabase: **Settings → API**.
- Copy **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copy **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copy **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is required — every Server Component and Server Action
uses it. It has no `NEXT_PUBLIC_` prefix and must never get one: it bypasses
RLS, so shipping it to the browser would hand the whole database to anyone
who opens devtools.

### 7. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 — pick bride or groom and you'll land on the dashboard. There's no sign-in step.

---

## Deploying to Vercel

1. Push the repo to GitHub (or GitLab/Bitbucket — Vercel supports all).
2. [vercel.com/new](https://vercel.com/new) → Import the repo. Framework: Next.js (auto-detected).
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy. You'll get a `https://wedding-hub-xxx.vercel.app` URL.

That URL is the only thing standing between the internet and your data — see
the warning at the top. If you'd rather not rely on the URL being unguessable,
Vercel's **Settings → Deployment Protection** puts a password in front of the
whole deployment without touching the code.

Steps 5–6 of the Supabase auth setup only matter if you restore sign-in: update
**Site URL** to the prod URL and add `https://wedding-hub-xxx.vercel.app/auth/callback`
to **Redirect URLs**.

---

## Adding / removing allowlist emails later

Only relevant once sign-in is restored — see the note in step 4.

Run in the Supabase SQL Editor:

```sql
-- Add an email
insert into public.allowed_emails (email) values ('new@person.com');

-- Remove an email
delete from public.allowed_emails where email = 'old@person.com';
```

The change takes effect immediately — `is_allowed()` re-checks on every request.

---

## Architecture, briefly

- **Routes**: everything under `app/(dashboard)/` shares the masthead/tabs/footer chrome via `app/(dashboard)/layout.tsx`. Login + auth callback live outside the group.
- **Server Components** by default; **Client Components** only where state matters (`todo-client.tsx`, `agenda-client.tsx`, `tab-nav.tsx`, `role-selector.tsx`).
- **Server Actions** for mutations — see `actions.ts` next to each feature page.
- **Supabase clients** in four flavours: `client.ts` (browser, anon key), `server.ts` (cookie-scoped, used only by the dormant auth routes), `service.ts` (service-role — what every page and action actually uses), `middleware.ts` (currently a pass-through).
- **No auth gate** — `middleware.ts` returns `NextResponse.next()` for every request. `/auth/callback` and its `is_allowed()` allowlist check still exist and still work, but nothing routes users through them. See the warning at the top.
- **Realtime** is subscribed in the `*-client.tsx` files for `todos` and `agenda`. Local state is updated via the subscription; server actions don't call `revalidatePath` so we don't double-fetch.

---

## File map

```
src/
  app/
    layout.tsx                    # html + fonts + globals
    page.tsx                      # bride/groom role picker → /dashboard
    globals.css                   # palette tokens, base styles, .stat-card etc.
    login/                        # dormant — page.tsx just redirects to /
      page.tsx
      login-form.tsx              # client form, useActionState (unreferenced)
      actions.ts                  # signIn server action (unreferenced)
    auth/                         # dormant — reachable, but nothing links here
      callback/route.ts           # exchange code, gate by allowlist
      error/page.tsx              # rejection page
    (dashboard)/
      layout.tsx                  # masthead + tab nav + footer
      actions.ts                  # signOut server action
      dashboard/page.tsx          # stats + Next up + Open tasks
      todo/
        page.tsx                  # initial fetch
        todo-client.tsx           # list, dialog, realtime
        actions.ts                # create/update/toggle/delete
      agenda/
        page.tsx
        agenda-client.tsx
        actions.ts
      budget/
        page.tsx
        budget-client.tsx
        actions.ts
      honeymoon/
        page.tsx
        honeymoon-client.tsx
        actions.ts
      guests/
        page.tsx
        guests-client.tsx
        actions.ts
      apartments/
        page.tsx
        apartments-client.tsx
        actions.ts
      wedding-day/
        page.tsx
        wedding-day-client.tsx
        actions.ts
  components/
    ui/                           # shadcn-style primitives
    masthead.tsx
    tab-nav.tsx
    ornament.tsx
  lib/
    config.ts                     # WEDDING_DATE, LOCALE, CURRENCY
    utils.ts                      # cn(), formatMoney(), formatDate(), …
    supabase/
      client.ts
      server.ts
      middleware.ts
  types/
    db.ts                         # Database type matching the migration
middleware.ts                     # delegates to lib/supabase/middleware.ts
supabase/migrations/0001_init.sql
```

---

## Roadmap

- **Later** — invitation email merge from `guests.email`, RSVP public form, exportable budget summary.
