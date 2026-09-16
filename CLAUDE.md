# Ladder One Academy (L1A)

Personal EMT → Fire → Paramedic learning platform and test-prep program for AJ. Single user. Read `docs/master-plan.md` (product plan, brand, learning modes, gating) and `docs/emt-blueprint.md` (concept IDs — the content spine) before doing anything.

## Non-negotiables
- Static site only. Plain HTML/CSS/JS, no framework, no build step, no server, no database.
- One app shell: `index.html`. Feature views live in `/js/` modules loaded by the shell.
- All content is data in `/content/<tier>/<module>.json`. Code never hardcodes content.
- Progress lives in `localStorage` under the key `l1a.progress` with export/import to a JSON file. Wrap every read/write in try/catch.
- Tier gating is enforced in code: Fire locked until EMT complete, Paramedic locked until Fire complete. Locked tiers are browsable but not openable. An "already certified" self-attest override exists per tier.
- Print views use `@media print`. 3×5 in card tiling on Letter with cut guides and duplex-aligned backs.
- Every question carries a rationale for all four options and a primary concept ID.
- Accessibility: keyboard navigable, dyslexia-friendly font option, text size option.
- Deploy target: Cloudflare Pages from `main`. Keep the repo deployable at every commit.

## Brand (from docs/master-plan.md §2)
- Name: Ladder One Academy. Short: L1A. Tagline: "Climb to certified."
- Colors in `brand/theme.css` as CSS variables: `--navy #0F1F3D`, `--ember #F25C19`, `--line-blue #2E7DFF`, `--star-white #F5F7FA`, `--signal-yellow #FFC72C`, `--slate #8A94A6`.
- Tier colors: EMT = star white, Fire = ember, Paramedic = line blue.
- Fonts: headings Oswald, body Inter, numbers/doses in a monospace. Load from Google Fonts with system fallbacks.
- Logo: `brand/logo.svg` (shield, three-rung ladder, Star of Life). Rungs light up by tier in the app.
- Every printed piece carries the L1A stamp top-left and a tier color bar on the left edge. Footer on tests and worksheets: `Ladder One Academy · Rung N · Tier · Module N — Name`. Footer on note cards (short form, fits one line at 3×5): `Rung N · Tier · Module N — Name`.

## Repo layout
```
index.html              app shell
js/                     app.js (router/state), ladder.js, lesson.js, deck.js, tests.js, print.js, progress.js, srs.js
brand/                  theme.css, logo.svg, logo-mono.svg, print.css, preview.html
content/emt/            01-preparatory.json … 11-exam-prep.json   (module + concepts)
content/emt/questions/  01-preparatory.json … 11-exam-prep.json   (question bank, loaded on demand)
content/emt/cards/      01-preparatory.json … 11-exam-prep.json   (curated deck)
content/fire/           (later, same three-folder shape)
content/medic/          (later, same three-folder shape)
media/                  diagrams, images, audio
schemas/                concept, module, question, question-bank, card, card-deck, progress (.schema.json)
docs/                   master-plan.md, emt-blueprint.md, decisions.md
```

## Working style
- Small commits, one feature per commit, plain-English messages.
- Before building a screen, restate what it does in two sentences and confirm.
- When unsure about a clinical fact, mark it `"verify": true` in the JSON rather than guessing. Never invent drug doses.
- Keep `docs/decisions.md` updated with any architecture or content decision made in a session.
- Do not add dependencies without asking. Vanilla first.

## Running locally
The shell uses ES modules and `fetch` for content, so `file://` will not work — the browser
blocks both. Serve the folder over http from the repo root:

```
python3 -m http.server 8000
```

then open `http://localhost:8000`. On Cloudflare Pages this is a non-issue; it is served over http already.

**Dev mode.** Unverified content (`verify: true`) is barred from every question context — lesson checks,
module exams, everything. While the bank is stubs that leaves the app empty, so dev mode lets flagged
content through behind a banner on every screen. Toggle it in the footer, or open
`http://localhost:8000/?dev=1` (`?dev=0` turns it off). It is stored under `l1a.devMode`, separately from
progress, and defaults to off.

## Phase 1 (current)
1. ~~Schemas in `/schemas/`.~~ Done — concept, module, question, question-bank, card, card-deck, progress.
2. ~~`brand/theme.css`, `brand/logo.svg`, `brand/logo-mono.svg`, `brand/print.css`.~~ Done, with `brand/preview.html` to check them.
3. ~~Shell v1: Ladder home, lesson view (Read + Quiz modes), module exam, print one card.~~ Done.
4. `content/emt/02-airway.json` — currently a six-concept stub, all `verify: true`. Needs the real module built from the blueprint.
