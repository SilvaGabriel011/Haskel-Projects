# Haskel Ops

The internal back office for Haskel Projects Pty — stock, orders, scheduling and
financial analysis. Staff only. Nothing here is reachable from the public site.

The public marketing site is a separate, unrelated thing in `../haskel-site/`.
The two deploy independently and neither can break the other.

## Where things stand

| Phase | What | Status |
|---|---|---|
| 0 | Architecture drawing (`../docs/`) | Done |
| 1 | Sign-in, roles, app shell | Done |
| 2 | Database schema and demo data | Done |
| 3 | Stock (slabs, offcuts, consumables) | Done |
| 4 | Orders (two pipelines) | Done |
| 5 | Scheduling | **Week view done; Google sync pending credentials** |
| 6 | Financial dashboards | Next |
| 7 | Hardening and handover | |

Stock, offcuts, orders and the schedule run on real (seeded) data. Financials
and settings are still shells.

**Google Calendar sync is deliberately not implemented yet.** The half that can
be tested without Google — turning a booking into a calendar event, with the
right timezone and the site notes an installer needs — is written and unit
tested in `lib/google-calendar.ts`. The network call is not, because writing an
untested API call would look finished without being so. Until credentials
exist, sync returns `not-configured` and scheduling works regardless: the
booking is the record, the calendar is only a copy of it.

## Running it

```bash
cd ops
npm install
cp .env.example .env.local
npm run hash          # run three times, one per demo account
# paste each hash into .env.local, keep each password somewhere safe
npm run dev           # http://localhost:3000
```

`AUTH_SECRET` is required. Generate one with `openssl rand -base64 32`.

### Checks

```bash
npm run typecheck     # tsc, no emit
npm run lint
npm run build         # full production build
```

## Who can see what

Two roles, defined once in `lib/roles.ts` and read by everything else.

| | Admin | Employee |
|---|---|---|
| Stock, offcuts, orders, schedule | yes | yes |
| Cost prices, quotes, margins | yes | **no** |
| Financial dashboards | yes | **no** |
| Settings and people | yes | **no** |

The split is enforced in three places, because hiding a link is not access
control:

1. `proxy.ts` — blocks the route before any page renders
2. `lib/guard.ts` — every protected page asserts its own role server-side
3. `lib/queries/` never selects money columns for an employee — they are not
   read from the database, so there is nothing to strip and nothing to find

An employee who types `/financials` lands back on the dashboard with a note
saying why. Verified: signed-out hits on all seven routes go to `/login`; an
employee gets `/dashboard?denied=/financials`; an admin gets the page. The same
holds on the schedule — passing someone else's id in the query string does not
widen what an employee sees.

## Signing in

**Google Workspace SSO is the real sign-in.** Two gates must both pass: the
account must be on the company Workspace domain, and the email must be on the
staff list in `lib/staff.ts`. A valid Google account alone is not enough.

**Demo mode** (`DEMO_MODE=true`) adds password sign-in for the three seeded
accounts so the system can be explored before Google is set up. Setting
`DEMO_MODE` to anything else removes that provider entirely — there is no
password path left to attack.

Passwords are hashed with scrypt from the Node standard library. No dependency,
nothing to compile. Hashes go in `.env.local`, which is gitignored; plain
passwords are never written to disk.

> The hash format uses `:` separators, not `$`. A `$` inside a `.env` value is
> read as a variable reference and silently expanded away — locally and in
> Vercel's environment variables alike.

## Two things only you can do

Neither can be done from here; both are quick.

### 1. The Vercel project

This is a second, separate project in the same repository.

1. Vercel → Add New → Project → import `Haskel-Projects`
2. **Root Directory: `ops`** — this is the important one
3. Framework preset: Next.js (detected automatically)
4. Add the environment variables from `.env.example`
5. Deploy, then Settings → Domains → add `ops.<your-domain>`

The existing `haskel-projects` project is untouched and keeps serving the
public site from `haskel-site/`.

### 2. Google sign-in and Calendar

1. [console.cloud.google.com](https://console.cloud.google.com) → new project
2. APIs & Services → Library → enable **Google Calendar API**
3. OAuth consent screen → **Internal** (this requires Workspace, and is what
   restricts sign-in to your own domain)
4. Credentials → Create → OAuth client ID → Web application
5. Authorised redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://ops.<your-domain>/api/auth/callback/google`
6. Copy the client ID and secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
7. Set `GOOGLE_WORKSPACE_DOMAIN` to your domain, e.g. `haskelprojects.com.au`

Until `GOOGLE_WORKSPACE_DOMAIN` is set, the domain check is skipped and only the
staff list applies. Set it before this goes anywhere near real data.

## Layout

```
ops/
├── auth.config.ts     edge-safe auth: Google, callbacks, route guard
├── auth.ts            adds the demo password provider (Node runtime)
├── proxy.ts           route guard (Next 16's replacement for middleware.ts)
├── lib/
│   ├── roles.ts       roles, sections and who may open what — single source of truth
│   ├── guard.ts       server-side assertions used by every protected page
│   ├── staff.ts       staff lookups, backed by the User table
│   ├── pipeline.ts    the two pipelines, legal transitions, shared phase mapping
│   ├── queries/       role-aware reads — the money never leaves the server
│   └── google-calendar.ts  booking → calendar event (sync pending credentials)
├── app/
│   ├── login/         sign-in
│   └── (app)/         the back office, behind the guard
└── scripts/
    └── hash-password.mjs
```

Brand tokens in `app/globals.css` are lifted from `../haskel-site/styles.css` so
this reads as the same company. Do not start a second palette here.
