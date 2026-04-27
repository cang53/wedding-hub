# Wedding Hub

Private wedding planning app for two. Next.js 16 + Supabase, magic-link auth gated by an email allowlist, RLS-protected data, realtime sync between phones.

Wedding date is set in `src/lib/config.ts` — edit `WEDDING_DATE` once it's locked.

---

## What's in Phase 1

End-to-end working pieces:

- App shell: masthead with live countdown, tab nav, footer
- Auth: `/login` magic-link page → `/auth/callback` → allowlist gate
- **Dashboard** with stats from all six feature tables
- **To-Do** — full CRUD, dialog, realtime
- **Agenda** — full CRUD, dialog, realtime, optional time + all-day support

Migration covers all 7 tables so everything is wired up DB-side; remaining feature pages (Budget, Honeymoon, Guests, Apartments) come in Phases 2 & 3.

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

### 4. Update the allowlist

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

### 5. Configure auth in Supabase

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

### 7. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000 — you'll be redirected to `/login`. Enter one of your allowlisted emails; click the magic link from your inbox; you'll land on the dashboard.

---

## Deploying to Vercel

1. Push the repo to GitHub (or GitLab/Bitbucket — Vercel supports all).
2. [vercel.com/new](https://vercel.com/new) → Import the repo. Framework: Next.js (auto-detected).
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. You'll get a `https://wedding-hub-xxx.vercel.app` URL.
5. Back in Supabase: **Authentication → URL Configuration**:
   - Update **Site URL** to the prod URL
   - Add `https://wedding-hub-xxx.vercel.app/auth/callback` to **Redirect URLs**
6. Try signing in on prod — magic link should now arrive and redirect correctly.

(Once you have a custom domain like `weddinghub.celal.dev`, update Site URL again and add the new callback to Redirect URLs.)

---

## Adding / removing allowlist emails later

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
- **Server Components** by default; **Client Components** only where state matters (`todo-client.tsx`, `agenda-client.tsx`, `tab-nav.tsx`, `login-form.tsx`).
- **Server Actions** for mutations — see `actions.ts` next to each feature page.
- **Supabase clients** in three flavours: `client.ts` (browser), `server.ts` (RSC + Server Actions), `middleware.ts` (per-request session refresh + auth gate).
- **Auth gate** — `middleware.ts` redirects unauthed users to `/login`; the callback then verifies email against `allowed_emails` via the `is_allowed()` RPC.
- **Realtime** is subscribed in the `*-client.tsx` files for `todos` and `agenda`. Local state is updated via the subscription; server actions don't call `revalidatePath` so we don't double-fetch.

---

## File map (Phase 1 final state)

```
src/
  app/
    layout.tsx                    # html + fonts + globals
    page.tsx                      # redirect → /dashboard
    globals.css                   # palette tokens, base styles, .stat-card etc.
    login/
      page.tsx                    # masthead + LoginForm
      login-form.tsx              # client form, useActionState
      actions.ts                  # signIn server action
    auth/
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

- **Phase 2** — Budget feature (line-item table, status pills, running totals).
- **Phase 3** — Honeymoon, Guests, Apartments (lower-traffic CRUD pages, batched).
- **Later** — invitation email merge from `guests.email`, RSVP public form, exportable budget summary.
