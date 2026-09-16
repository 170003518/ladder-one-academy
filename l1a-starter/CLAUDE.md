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
- Every printed page carries the L1A stamp top-left, tier color bar on the left edge, footer `Ladder One Academy · Rung N · Tier · Module N — Name`.

## Repo layout
```
index.html          app shell
js/                 app.js (router/state), ladder.js, lesson.js, deck.js, tests.js, print.js, progress.js, srs.js
brand/              theme.css, logo.svg, print.css
content/emt/        01-preparatory.json … 11-exam-prep.json
content/fire/       (later)
content/medic/      (later)
media/              diagrams, images, audio
schemas/            concept.schema.json, question.schema.json, card.schema.json, progress.schema.json
docs/               master-plan.md, emt-blueprint.md, decisions.md
```

## Working style
- Small commits, one feature per commit, plain-English messages.
- Before building a screen, restate what it does in two sentences and confirm.
- When unsure about a clinical fact, mark it `"verify": true` in the JSON rather than guessing. Never invent drug doses.
- Keep `docs/decisions.md` updated with any architecture or content decision made in a session.
- Do not add dependencies without asking. Vanilla first.

## Phase 1 (current)
1. Schemas in `/schemas/`.
2. `brand/theme.css`, `brand/logo.svg`, `brand/print.css`.
3. Shell v1: Ladder home, lesson view (Read + Quiz modes), module exam, print one card.
4. `content/emt/02-airway.json` — first real module, built from the blueprint.
