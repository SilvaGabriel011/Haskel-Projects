# Plan — what is left, and who acts on it

One list for the whole repository: the back office (`ops/`), the public site
(`haskel-site/`) and the open pull requests. Tick a box when it is done, add a
line when something new comes up, and keep the **Owner** honest — most of what
is left is not code.

Last reviewed: 2026-10-07

**Owners:** `Haskel` = the business (accounts, photos, decisions) ·
`Dev` = code changes in this repository

---

## 1. Go live with Haskel Ops — blocking

Nothing below is code. Until these are done, staff cannot use the app for real.
Full steps for each are in [`ops/README.md`](ops/README.md) under
*Two things only you can do*.

| # | Task | Owner | Status |
|---|---|---|---|
| 1.1 | Supabase project in **Sydney**; copy `DATABASE_URL` (pooler, 6543, `?pgbouncer=true`) and `DIRECT_URL` (session pooler, 5432) | Haskel | ☐ |
| 1.2 | Second Vercel project, **Root Directory `ops`**, env vars from `ops/.env.example` | Haskel | ☐ |
| 1.3 | `AUTH_SECRET` set in Vercel (`openssl rand -base64 32`) | Haskel | ☐ |
| 1.4 | Google Cloud project → OAuth consent **Internal** → OAuth client; set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Haskel | ☐ |
| 1.5 | Confirm `GOOGLE_WORKSPACE_DOMAIN=haskelproject.com.au` in Vercel (sign-in is refused in production without it) | Haskel | ☐ |
| 1.6 | Domain `ops.haskelproject.com.au` on the Vercel project; set `CANONICAL_HOST` to it | Haskel | ☐ |
| 1.7 | Real staff added in Settings, with roles; PINs set for anyone on a shared login | Haskel | ☐ |
| 1.8 | `DEMO_MODE=false` in production, confirmed (no demo banner on any page) | Haskel | ☐ |
| 1.9 | Replace demo data with real stock, materials and open jobs | Haskel | ☐ |

**Done when:** a staff member signs in with their Google account on
`ops.haskelproject.com.au`, and an account outside the domain is refused.

## 2. Google Calendar sync — finish phase 5 / 8b

The code is done; it is waiting on credentials. Steps: `ops/README.md`, step 8.

| # | Task | Owner | Status |
|---|---|---|---|
| 2.1 | Service account `haskel-ops-calendar` + JSON key | Haskel | ☐ |
| 2.2 | **Test** calendar shared with the service account (*Make changes to events*) | Haskel | ☐ |
| 2.3 | Set `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_ID`, `BUSINESS_TIMEZONE=Australia/Adelaide`; redeploy | Haskel | ☐ |
| 2.4 | Settings → **Send a test event** succeeds | Haskel | ☐ |
| 2.5 | Switch `GOOGLE_CALENDAR_ID` to the real company calendar | Haskel | ☐ |

**Done when:** accepting a booking puts it in the company calendar, and
Settings shows sync as connected.

## 3. Public site — before it is promoted

| # | Task | Owner | Status |
|---|---|---|---|
| 3.1 | Real photos into `haskel-site/images/` with the exact names in `images/LEIA-ME.txt` (hero, 6 materials, 8 services) | Haskel | ☐ |
| 3.2 | Before/after pair (`ba-1-before.jpg`, `ba-1-after.jpg`) and six job photos (`job-1…6.jpg`) — not yet listed in `LEIA-ME.txt` | Haskel | ☐ |
| 3.3 | Swap each `<div class="ph">` placeholder for an `<img>` once its photo exists | Dev | ☐ |
| 3.4 | Four testimonials are still "Customer name — Placeholder": real ones, or remove the section | Haskel | ☐ |
| 3.5 | `offcuts.html` shows six example cards: replace with real pieces (or link to live stock — see 5.2) | Haskel | ☐ |
| 3.6 | Contact email is `info.haskel@gmail.com`: confirm, or move to `@haskelproject.com.au` | Haskel | ☐ |
| 3.7 | Point the site's booking CTA at `ops.haskelproject.com.au/book` once 1.6 is live | Dev | ☐ |
| 3.8 | Custom domain on the public site's Vercel project | Haskel | ☐ |

### Where to take the photos

Your own: at your jobs and on your rack. Photos from Google or other companies'
sites are usually copyrighted.

| Photo | Where | How |
|---|---|---|
| Hero | Your best finished kitchen | Landscape, daylight plus room lights, bench cleared |
| Services (8) | One finished job of each kind | Landscape 4:3, at the end of the install, stone wiped down |
| Before / after | The same job, at measure and at install | Same spot, same angle |
| Job photos (6) | Recent installs | Edge and join close-ups mixed with whole-room shots |
| Materials (6) | Close-up of the slab on your rack, or supplier images | Square, pattern filling the frame; get the supplier's OK in writing |
| Offcuts | Each piece as it goes on the rack | Flat, tape measure in shot |

Ask clients before photographing their home; leave out house numbers and faces.

## Being built now: faster stone picking on New job

Requested 2026-10-07: type a stone that is not on the list, see the most and
most recently chosen, and search by typing.

| # | Task | Owner | Status |
|---|---|---|---|
| B.1 | Type to search every stone, from a supplier range or on file | Dev | ☑ |
| B.2 | "Recently chosen" and "Most chosen" before anything is typed | Dev | ☑ |
| B.3 | Add a stone that is not listed, any thickness, typed finish | Dev | ☑ |
| B.4 | Reviewed and merged | Haskel | ☐ |

## 4. Open pull requests — decide on each

Old PRs drift further from `main` every week. Merge, rework or close.

| PR | What | Suggested action | Status |
|---|---|---|---|
| [#27](https://github.com/SilvaGabriel011/Haskel-Projects/pull/27) | Forgot PIN: one-time code emailed to the shared login | Review and merge — it closes a real gap in shared logins. Needs an email sender configured | ☐ |
| [#11](https://github.com/SilvaGabriel011/Haskel-Projects/pull/11) | Label the nav button "Contact us" | Small; merge or close | ☐ |
| [#5](https://github.com/SilvaGabriel011/Haskel-Projects/pull/5) | Four three-page site options with prototypes | Pick a direction, then close — it is a proposal, not a change to ship | ☐ |
| [#4](https://github.com/SilvaGabriel011/Haskel-Projects/pull/4) | Tab panels size to content, "Why us" weight | Check it still applies to the current site; merge or close | ☐ |

## 5. Next improvements — after go-live

Not blocking. Pick from here once sections 1–2 are done, and only once real
use shows they matter.

| # | Idea | Why | Status |
|---|---|---|---|
| 5.1 | Turnstile on `/book` | The rate limit is per serverless instance; add only if spam appears | ☐ |
| 5.2 | Public offcuts page fed from Ops stock | Ends hand-editing `offcuts.html`; must expose no cost data | ☐ |
| 5.3 | Website contact form posts to Ops (or Formspree) instead of `mailto:` | Leads arrive without the visitor's mail app | ☐ |
| 5.4 | Add suburbs to `ops/lib/suburbs.ts` as unrecognised ones show up on the schedule | Grouping silently skips unknown suburbs | ☐ |
| 5.5 | Revisit the board thresholds (3 days amber / 5 red) after a month of real jobs | They were judgement calls | ☐ |
| 5.6 | Backups: confirm Supabase point-in-time recovery or scheduled dumps | Real data has no other copy | ☐ |

## 6. Keep it healthy — ongoing

- CI must stay green on every PR (site links, typecheck/lint/build, unit, e2e).
- Every schema change goes in a Prisma migration; production applies it on deploy.
- Update the phase table in `ops/README.md` and this file in the same PR as the work.
- `@playwright/test` stays pinned to 1.56.1 unless the browsers move with it.

---

### How to use this file

1. Work top to bottom: section 1 blocks everything else.
2. When you finish something, change ☐ to ☑ in the same PR (or commit) that did it.
3. New work goes in the right section with an owner. If it is bigger than a
   line, open a GitHub issue and link it from the row.
