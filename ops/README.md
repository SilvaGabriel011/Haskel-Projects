# Haskel Ops

The internal back office for Haskel Project Pty — stock, orders, scheduling and
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
| 5 | Scheduling | Week view done; **Google sync still pending your credentials** |
| 6 | Financial dashboards | Done |
| 7 | Hardening and handover | Done |
| — | Settings (people and access) | Done |
| 8a | Booking requests from the website | Done |
| 8b | Calendar sync on accept | Done; needs the service account key (below) |
| 9 | Putting stock on the rack by hand | Done |
| 10 | Follow-up board (overdue, missing detail) | Done |
| 11 | Eleven stages and the stage timeline | Done |
| 12 | Grouping jobs that are near each other | Done |
| 13 | Finding a stone by typing on New job; adding one that isn't listed | Done |
| 14 | Finding a client by typing; the client's summary email and the job's calendar entries | Done; email needs a Resend key (below) |

Every screen now runs on real (seeded) data. No shells left.

## The eleven stages

Every job runs the same eleven stages, taken verbatim from the Tekton flow so
the two systems line up:

**Initial Stage → Quote Request → Quoted → Order Active → Purchase Order →
Measured → Details → Factory → Ready For Dispatch → Installation → Invoice**

Plus `LOST`, which is not a stage: a job abandoned before the order went active.

This replaced a two-pipeline design — a short run for offcut work, a long one
for benchtop installs. One flow for everything makes every job's timings
comparable and keeps the stages the same across projects, which is the point.
The cost, accepted deliberately: an offcut vanity top still passes through
Purchase Order and Factory, which on small work are often a few minutes each.

`pipeline` survives on the order as a **classification**, not a stage list —
the financials still split revenue between offcut/small work and benchtop
installs.

Quoting, activating the order, raising the purchase order, invoicing and
writing a job off stay with the office. An installer moves work along the
bench: measured, details, factory, out the door, installed.

## The stage timeline

Every move writes an `OrderStage` row — which stage, when it was entered, when
it was left, and who moved it. The row with no exit time is where the job is
now. **Status alone says where a job is, never how long it has been there**,
which is the question both the timeline and the follow-up board exist to answer.

On a job you get: total job time, the current stage with how long it has been
running, the longest stage, how many of the eleven are done, then the numbered
track — hours and days in each stage, in and out times, who moved it — and a
bar showing where the time actually went.

Hours are **calendar time, not working time**. A job sitting over a weekend has
genuinely sat over the weekend, and pretending otherwise flatters the numbers.

The move and its history are written in one transaction. If closing the old
spell and opening the new one could come apart, a job would be counted in two
stages at once or in none, and every figure would be wrong from then on.

## Jobs that are near each other

The system stores a suburb as free text and an address as a free line — there
are no coordinates anywhere. So "which jobs are close together" cannot be
answered from the data as stored.

`lib/suburbs.ts` is the smallest thing that answers it: a built-in table of
Adelaide suburbs with one approximate centre point each. It ships with the app
— **no API key, no cost per lookup, no network call and no failure mode.**

Two places use it:

- **The follow-up board** puts a line on a card: *"3 others within 5 km"*.
- **The schedule** groups the week into runs above the grid, each one naming
  its suburbs and how far apart the furthest two are.

Things worth knowing:

- **A suburb it does not recognise is not an error.** That job shows everywhere
  as normal and simply never groups. The schedule says how many were left out
  rather than quietly dropping them.
- **It reads what people actually type.** `Prospect`, `prospect`,
  `Prospect SA`, `Prospect, SA 5082` all reach the same place. Without that,
  grouping silently stops working on real data and looks like a broken feature.
- **Runs count visits, not jobs.** A job with a template on Tuesday and an
  install on Wednesday is two separate trips, so it appears twice — the label
  says `3 visits · 2 jobs` rather than pretending it is three customers.
- **It does not suggest a driving order.** That would look precise while being
  guesswork: the table places a suburb, not a house, and the difference between
  two addresses in one suburb is exactly what it cannot see. Grouping is the
  honest limit of this data.
- **Adding a suburb is adding a row** to `SUBURBS`. A centroid being slightly
  off only changes whether two jobs group; it cannot make any other figure in
  the system wrong.

Both roles see this — where jobs are is not money.

## The follow-up board

`/orders` answers "where is everything". `/board` answers the different
question of **what is going wrong**, and is the screen to open each morning.

Every job still in flight gets a card, coloured by the worse of two signals:

- **How long it has sat in its current stage**, read from the stage history:
  **over three days is amber, over five is red**. One pair of numbers everyone
  knows, shared with the timeline so the two can never disagree.
- **What the office is missing.** No phone number, no site address on a won
  job, nothing on the cut list — each card lists the gaps in words. Blocking
  gaps (the job cannot proceed) are red; the rest are amber.

A booked date that has come and gone with the job unfinished is red on its own.

Two things worth knowing:

- **It sees through placeholders.** `acceptBooking` writes "To confirm on the
  call" into the address, which is a real string in a required column — so a
  job can look complete while nobody knows where to drive. `TBC`, `n/a`,
  `unknown` and `---` count as blank too.
- **It does not cry wolf.** A fresh enquiry is *allowed* to have no address and
  no cut list; those only become gaps once the job is won. A board that flags
  everything gets ignored.

Filters across the top narrow to what needs a look, what is overdue, what is
missing detail, or what has a date gone by — each with a count.

An employee sees the board but never a money gap: `quoteCents` is not read for
them, and `lib/board.ts` treats absent as "not my business" rather than as
zero, so they are never shown something they cannot see or fix.

The rules are in `lib/board.ts`, free of the database and unit tested — the
thresholds are judgement calls, and they belong somewhere they can be read and
argued with rather than buried in a component.

## Putting stock on the rack

**Add stock** on `/stock` opens a short wizard: what you are adding, the
material, the piece itself, then a page that reads it all back before anything
is written. Three things go in this way — a slab, an offcut, or a consumable.

Admin only, and asserted in the action rather than assumed from the page: a
server action is its own endpoint and can be called without the modal ever
being opened. Every branch either records a cost or creates a material with a
cost per m², and money is admin-only throughout.

A few decisions worth knowing:

- **A new material can be created alongside the first slab that uses it**, so
  an empty database is not a dead end. With nothing on file the wizard says so
  and goes straight to the new-material fields.
- **Offcuts carry no cost of their own.** What one is worth follows from its
  material and the slab it came off, so there is no figure to type in wrong.
- **References are never reused.** `nextRef` takes the highest number in use
  rather than the count, so deleting `SLB-0003` cannot hand its number to a
  different slab later — people write these on the stone itself.
- **Every add writes a `RECEIVED` movement** naming what arrived and who put it
  there, so the log on `/stock` stays complete.
- **Amounts are parsed, not rounded.** `10.005` is refused rather than guessed
  at; `$1,200.50` is accepted. Money stays integer cents the whole way.

The rules live in `lib/stock-input.ts`, free of the database so they are unit
tested directly rather than only by clicking through the modal.

## Opening a job: who hears about it

New job finds a client or a stone by typing: a client by name, contact,
suburb or any run of their phone digits; a stone by colour or brand, in any
order. Before anything is typed, each box offers the recent picks, and the
stone box the most-chosen too. A stone on no list can be added as typed; it
is named on the job with no material behind it, like a catalogue colour not
yet on the rack, so nothing reads as free stone in Financials.

**After saving** sets a target completion day (presets of 1, 2, 4 and 6
weeks; it starts at 2 weeks for small work and 4 for a benchtop or
splashback) and any reminders before it (2 weeks, 1 week, 3 days, 1 day;
none ticked to start). Saving then:

- **emails the client**, automatically, if they have an address: the job
  number, kind of job, site, who is at the site, the stone and the target,
  ending with `BUSINESS_CONTACT`. **Only what a client should see**: the
  office's notes and any money never go out. Sent through Resend
  (`RESEND_API_KEY`, `MAIL_FROM`), the same sender as "Forgot PIN?";
- **adds all-day entries to the company calendar, marked free** so they
  block nobody's time: the day the job opened, the target day, and each
  reminder. Reminders are entries of their own, not alarms on the due entry:
  the app writes as a service account, and an alarm on an event only rings
  for whoever set it, which would be the robot. An entry on the day shows to
  everyone sharing the calendar and rings for anyone whose notifications for
  that calendar are on.

**As the job moves**, the client is emailed again when it reaches a stage
that means something to them: Quoted, Order Active, Measured, Factory,
Ready For Dispatch and Invoice (`STAGE_EMAILS` in `lib/job-notices.ts`).
The workshop's own stages (Purchase Order, Details and so on) stay quiet.
Each stage is entered once, so nobody is told twice. The button that moves
the job says when the client was emailed.

None of this ever stops a job opening or moving. The job page says what happened once,
straight after saving; a failure names what to do. The rules are in
`lib/job-notices.ts` (pure, unit tested), the sending in
`lib/job-notices-send.ts`.

On the job page, the client's email and phone are links: `mailto:` with the
job number as the subject, and `tel:`.

## The one public route

`/book` and `POST /api/book` are the **only** paths a stranger can reach — a
customer asks for a time, and it lands as a `BookingRequest`. Nothing else:
no Customer, no Order, no diary entry. Only an admin accepting it creates
those, so a form submission can never put anything in the day.

Everything else stays behind sign-in. `tests/booking.test.ts` asserts the guard
excludes exactly those two paths and nothing that holds data, so widening it by
accident fails a test.

It is an unauthenticated write, so it is defended accordingly: honeypot field,
five requests per IP per hour, every field length-capped, times restricted to
the next year, and a job-type list narrower than the internal enum. The rate
limit is per serverless instance, which slows a casual flood rather than
stopping a determined one — if real spam turns up, put Turnstile in front.

**Google Calendar sync** writes an accepted booking to one company calendar,
through a Google service account: a robot login only this app uses, so nobody's
personal Google account is tied to it and nothing asks anyone to sign in. Until
it is set up, sync returns `not-configured` and scheduling works regardless:
the booking is the record, the calendar is only a copy of it. A failure on
Google's side is logged and never stops a booking. Settings shows the real
state and has **Send a test event**, which writes an event and deletes it.

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
npm test              # 222 unit tests — query layer, pipeline rules, seed integrity, input rules
npm run build         # full production build
```

**End-to-end role separation** needs a seeded database and the app running,
and takes the demo passwords from the environment so none are hardcoded:

```bash
npm run dev -- -p 3111 &                        # the port playwright.config.ts expects
E2E_ADMIN_PASSWORD=... E2E_INSTALLER_PASSWORD=... npm run test:e2e
```

28 tests: every route's landing place signed out and per role, the absence of
any dollar amount on employee pages, that adding `?who=` to the schedule does
not widen what an employee sees, and that `/book` opens without signing in.

The port matters. `playwright.config.ts` defaults to **3111**, so a server on
3000 fails all 26 with `ERR_CONNECTION_REFUSED` — which looks exactly like a
real regression. Either use the flag above or set `E2E_BASE_URL`.

`@playwright/test` is pinned to **1.56.1** to match the preinstalled browsers.
Bumping it without matching browsers fails with "Executable doesn't exist".

## Who can see what

Two roles, defined once in `lib/roles.ts` and read by everything else.

| | Admin | Employee |
|---|---|---|
| Stock, offcuts, orders, schedule, follow-up board | yes | yes |
| Adding stock | yes | **no** |
| Booking requests from the website | yes | **no** |
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

**Demo mode** adds password sign-in for the seeded logins so the system
can be explored before Google is set up. It ships **off**; only the exact string
`DEMO_MODE=true` enables it. Anything else — including absent, `"1"` and
`"TRUE"` — removes the provider entirely, so there is no password path left to
attack.

Passwords are hashed with scrypt from the Node standard library. No dependency,
nothing to compile. Hashes go in `.env.local`, which is gitignored; plain
passwords are never written to disk.

> The hash format uses `:` separators, not `$`. A `$` inside a `.env` value is
> read as a variable reference and silently expanded away — locally and in
> Vercel's environment variables alike.

### Shared logins (info@ and the like)

Several people can sign in with one email. Each is their own person in
Settings, with their own role. Google proves the login; after signing in, each
person picks their name and types their own **4-digit PIN** (`/who`), and is
themselves until they sign out or press **Switch person**. Five wrong PINs in a
row lock that person for 15 minutes. The pick reaches the session as a ticket
signed with `AUTH_SECRET` (`lib/pin.ts`), so it cannot be faked from the
browser.

Every action is recorded with two labels (`lib/activity.ts`, shown under
Settings → Activity): the **owner**, the login that was signed in, and the
**user**, the person on it who did it. On someone's own login they are the same.

**Forgot PIN?** On the picker, after choosing their name, a person can have a
6-digit one-time code emailed to the shared login itself (info@…): whoever reads
that inbox already controls the login. The code lasts 10 minutes and 5 tries,
one can be sent a minute, and it sets a new PIN and lifts any lock
(`lib/pin-reset.ts`). The same link sets a first PIN for someone without one.
Email goes through [Resend](https://resend.com): verify `haskelproject.com.au`
there, then set `RESEND_API_KEY` and `MAIL_FROM` (e.g.
`Haskel Ops <noreply@haskelproject.com.au>`) in Vercel. Until then, an admin
sets PINs in Settings. Google sign-in passwords are Google's, reset at Google.

Adding a second person to a login makes it shared, so they need a PIN; anyone
already on it needs one too, and Settings flags them until they have it. The
seed has `info@haskelproject.com.au` shared by Mia (admin, PIN 2580) and Tom
(employee, PIN 1470); in demo mode it needs `DEMO_INFO_PASSWORD_HASH`.

## Before this goes live — read this

Two switches decide who can get in. Both now fail CLOSED, and both shout while
they are wrong, but they are still yours to set.

| Variable | Until you set it |
|---|---|
| `GOOGLE_WORKSPACE_DOMAIN` | **Google sign-in is refused outright in production.** Sign-in cannot be limited to your company without it, so it refuses rather than letting anyone through. Local development is unaffected. |
| `DEMO_MODE` | Ships as `false`. While it is `true`, anyone with a demo password can sign in, and every page carries a banner saying so. |

These used to fail open — an unset domain meant the check was skipped, and
`.env.example` shipped `DEMO_MODE=true`, so copying it handed a deployment a
working password login. Both are now the other way round, and
`tests/fail-closed.test.ts` keeps them that way.

## Two things only you can do

Neither can be done from here; both are quick.

### 1. The Vercel project

This is a second, separate project in the same repository.

1. Vercel → Add New → Project → import `Haskel-Projects`
2. **Root Directory: `ops`** — this is the important one
3. Framework preset: Next.js (detected automatically)
4. Add the environment variables from `.env.example`
   (`DATABASE_URL` is Supabase's transaction pooler on 6543 with
   `?pgbouncer=true`; `DIRECT_URL` is its **session** pooler on 5432)
5. Deploy, then Settings → Domains → add `ops.haskelproject.com.au`

Production deploys apply pending migrations before building
(`scripts/migrate-on-deploy.mjs`). Preview deploys never touch the schema, so a
branch cannot change the live database. Functions run in Sydney (`syd1`,
`vercel.json`); keep the Supabase project in Sydney too.

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
   - `https://ops.haskelproject.com.au/api/auth/callback/google`
6. Copy the client ID and secret into `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
7. `GOOGLE_WORKSPACE_DOMAIN` is already set to `haskelproject.com.au`
8. Calendar sync, in the same Google Cloud project:
   1. IAM & Admin → Service accounts → **Create service account**, named e.g.
      `haskel-ops-calendar`. No roles needed. Note its email
      (`…@….iam.gserviceaccount.com`).
   2. Open it → Keys → Add key → **JSON**. A file downloads. Keep it private.
   3. In Google Calendar, make a **test** calendar first. Its Settings and
      sharing → Share with specific people → add the service account's email
      with **Make changes to events**. Integrate calendar → copy the Calendar ID.
   4. In Vercel, set:
      - `GOOGLE_SERVICE_ACCOUNT_JSON`: the whole downloaded file, pasted as is
      - `GOOGLE_CALENDAR_ID`: the Calendar ID
      - `BUSINESS_TIMEZONE`: `Australia/Adelaide`
   5. Redeploy, open Settings → **Send a test event**. It says exactly what is
      wrong if anything is. Once it works, share the real company calendar the
      same way and change `GOOGLE_CALENDAR_ID` to it.

   Staff are named in the event, not invited: a service account cannot send
   invitations without Workspace-wide delegation.

**In production, Google sign-in is refused until `GOOGLE_WORKSPACE_DOMAIN` is
set.** Not "restricted to the staff list" — refused. Without it there is no way
to limit sign-in to your company, so it declines rather than guessing. Local
development runs without it so you are not blocked while setting this up.

(This used to be the opposite: an unset value meant the check was skipped.
`lib/access-config.ts:googleSignInBlockedReason` is the behaviour now, and
`tests/fail-closed.test.ts` keeps it that way.)

## Layout

```
ops/
├── auth.config.ts     edge-safe auth: Google, callbacks, route guard
├── auth.ts            adds the demo password provider (Node runtime)
├── proxy.ts           route guard (Next 16's replacement for middleware.ts)
├── lib/
│   ├── roles.ts       roles, sections and who may open what — single source of truth
│   ├── access-config.ts  who may sign in at all — env reads, kept testable
│   ├── guard.ts       server-side assertions used by every protected page
│   ├── staff.ts       staff lookups, backed by the User table
│   ├── pipeline.ts    the two pipelines, legal transitions, shared phase mapping
│   ├── stock-input.ts what may go on the rack — pure rules, unit tested
│   ├── board.ts       follow-up thresholds and missing-detail rules
│   ├── stage-timing.ts   how long each stage took, and where the time went
│   ├── suburbs.ts     Adelaide suburb centroids, and reading a typed suburb
│   ├── routes.ts      grouping jobs that are near each other
│   ├── business-time.ts  days, weeks and months in the business's zone
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
