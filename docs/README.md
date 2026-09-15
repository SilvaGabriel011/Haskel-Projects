# docs

## haskel-ops-architecture.excalidraw

The proposed internal system (stock, orders, scheduling, financials) drawn out
across five frames, for sign-off before any code is written:

1. **system map** — the public page vs the staff-only app, and where a client's view stops
2. **roles** — admin vs employee, and how the split is enforced
3. **order lifecycle** — enquiry through complete, and what each step touches
4. **screens** — every screen, colour-coded by who can open it
5. **build order** — the eight phases

Open it at [excalidraw.com](https://excalidraw.com) (File → Open, or just drag the
file onto the canvas). It is plain JSON and edits cleanly by hand — moving a box
is a perfectly good way to ask for something different.

A read-only web version of the same plan is published as a Claude Artifact.

Nothing in this folder affects the deployed site. The marketing page is
`haskel-site/index.html`, served by the root `vercel.json`.
