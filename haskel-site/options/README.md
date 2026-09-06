# Site options — Haskel Projects

Four ways to turn the current one-page site into a three-page site.
Each option is a different **strategy**, with a matching design direction and a
clickable prototype.

Open `options/index.html` to compare them side by side.

```
haskel-site/options/
├── index.html          comparison hub — sitemaps, rationale, links
├── a/                  Option A — The Classic Three   (Warm Editorial)
├── b/                  Option B — Two Doors           (Workshop)
├── c/                  Option C — The Craft           (Gallery)
└── d/                  Option D — The Offer           (Bold)
```

Every prototype is plain static HTML plus one `style.css`. No build step, no
framework, no dependencies — same as the current site. Each folder is
self-contained, so the chosen one can be promoted and the rest deleted.

---

## What is identical in all four

A separate "Contact" page would burn one of only three slots for a business with
one phone number, so **contact lives on every page instead**: click-to-call in
the nav, a quote form on the page that closes, and details in the footer.

All four also keep: the eight services, the six stones, the 10% first-job offer,
the free-quote promise, the mailto quote form, and Mon–Sat / same-day-reply.

**Mission and values** and **trade work** appear in all four. What changes is how
much room each gets.

---

## Option A — The Classic Three

**Design: Warm Editorial** — cream, blush and rose; rounded cards, soft shadows,
Playfair italic accents. An evolution of what you have now.

| Page | Slug | Carries |
|---|---|---|
| Home | `/` | Hero · top 3 services · 10% offer · who you're dealing with · 4-step process · service area |
| Services & Stone | `/services` | All 8 services · all 6 stones · recent work · lead capture |
| About | `/about` | Story · **mission** · **5 values** · **trade work** · contact + quote form |

**Best if** you want the safest option and the strongest search results for
"stone benchtops Adelaide".

- Keeps everything already built — nothing to relearn.
- One dense services page is the easiest thing to rank.
- Trade clients get a section, not a page — weaker B2B signal.
- Least differentiated from every other stonemason site.

---

## Option B — Two Doors

**Design: Workshop** — concrete grey and rust, square corners, numbered sections,
spec tables, Archivo + IBM Plex Mono. Reads as tradesperson, not marketing.

| Page | Slug | Carries |
|---|---|---|
| Home | `/` | Hero + spec strip · **the fork**: home vs trade · **mission & 5 values** · capability table |
| For Your Home | `/residential` | 6 homeowner services · stone spec table · process · quote form |
| For Trade | `/trade` | 6 trade capabilities · **terms & credentials** · workflow · trade enquiry form |

**Best if** trade work (builders, cabinet makers, kitchen companies, plumbers)
is or could be a real second income line.

- Two audiences stop competing for the same paragraph.
- The trade page can carry ABN, insurance and payment terms — what builders check first.
- The homepage asks a question instead of selling, which costs a click.
- Only worth it if you actually want trade work.

---

## Option C — The Craft

**Design: Gallery** — bone and sage, hairline rules, huge whitespace, full-bleed
photography, Cormorant Garamond + Jost. Premium and architectural.

| Page | Slug | Carries |
|---|---|---|
| Home | `/` | Full-bleed hero · **mission** · selected work gallery · belief panel · capability list |
| The Craft | `/craft` | Story · **5 values as a manifesto** · stone library · process · trade panel |
| Start a Project | `/project` | All 8 services · trade section · **FAQ** · enquiry form |

**Best if** you want to charge more and attract design-led renovations rather
than compete on price.

- Mission and values get the most room of any option — it is the whole middle page.
- The FAQ quietly filters out wrong enquiries before they reach your phone.
- **Needs genuinely good photography.** This design fails hardest with weak images.
- "Start a Project" reads less clearly than "Services" to someone searching Google.

---

## Option D — The Offer

**Design: Bold** — navy and amber, chunky buttons, badges, oversized numbers,
Manrope, plus a sticky call bar on mobile. The loudest of the four.

| Page | Slug | Carries |
|---|---|---|
| Home | `/` | Offer hero · 3 money-savers · top 4 services · **offcut rack** · **5 values** · process |
| Stone & Offcuts | `/stone` | 6 stones with specs · **live offcut rack** · what-suits-what guide |
| Jobs & Repairs | `/jobs` | All 8 services · repair types · **trade work** · contact + quote form |

**Best if** you want the phone to ring today, and the offcut rack is a hook you
can keep up to date.

- Highest expected call rate; the offer is visible on every screen.
- The sticky mobile call bar matters — most traffic is a phone in a kitchen.
- **The rack needs updating every week or two** or it costs you trust.
- Reads cheaper, so it is harder to charge a premium.

---

## Side by side

| | A · Classic Three | B · Two Doors | C · The Craft | D · The Offer |
|---|---|---|---|---|
| Page 2 | Services & Stone | For Your Home | The Craft | Stone & Offcuts |
| Page 3 | About | For Trade | Start a Project | Jobs & Repairs |
| Mission & values | About page | Homepage block | Whole middle page | Homepage block |
| Trade work | Section on About | **Own page** | Panel + section | Section on Jobs |
| Search strength | **Strongest** | Good (two intents) | Weakest slugs | Good |
| Photos needed | Medium | Low — type carries it | **High** | Medium |
| Ongoing upkeep | Low | Low | Low | **Weekly (rack)** |
| Change from today | Smallest | Large | Large | Largest |

---

## Before any of these goes live

Every prototype marks these as `PLACEHOLDER` so nothing invented reaches a
customer. They are all facts only you can supply:

- **ABN, licence number and public liability cover** — trade clients check these
  first. Biggest gap in Option B, which has a whole credentials block for them.
- **Silica compliance / control measures** — worth stating explicitly in SA.
- **Real reviews, job names and suburbs** — all sample text is generic.
- **Photos** — every image is still a grey placeholder box. See `../images/LEIA-ME.txt`.
- **Turnaround and pricing** — the FAQ in C and the offcut rack in D both have blanks.
- **Founding year and background** — the About/Craft story paragraph in A and C.

## Promoting the option you pick

1. Move the chosen folder's files up into `haskel-site/`
   (`index.html` replaces the current landing page; the other two pages sit
   beside it; `style.css` comes with them).
2. Delete `haskel-site/options/`.
3. Remove the `<meta name="robots" content="noindex">` line and the grey
   PROTOTYPE banner `<div>` from each page.
4. Swap the `.ph` placeholder blocks for real `<img>` tags, per `images/LEIA-ME.txt`.
5. Fill in every `PLACEHOLDER` noted above.

`vercel.json` already points at `haskel-site` with `cleanUrls`, so `/services`,
`/trade`, `/craft` etc. work without the `.html`. Nothing else needs changing.
