# Decisions log

## 2026-09-15
- Name: Ladder One Academy. Tagline: "Climb to certified."
- Path A: static single-shell HTML app, JSON content, localStorage progress, Cloudflare Pages.
- Fire content: NFPA 1001 base + Florida overlay.
- Cards: 3×5 in primary.
- Audio: browser text-to-speech.
- Single user; no accounts, sync, or disclaimers.

## 2026-09-15 — Schemas (Phase 1, step 1)

- Five schemas written in `/schemas/`: `concept`, `module`, `question`, `card`, `progress`. JSON Schema draft 2020-12, `additionalProperties: false` throughout so a typo fails loudly instead of being silently dropped.
- **Exclusion rule:** a concept with `verify: true`, or with no `reviewed_against`, is excluded from **module exams and full simulations**. Module exams gate progression, so unreviewed or unverified content never decides whether a module is complete. Such concepts still appear in lessons, lesson checks, decks and focus drills. Same rule applies to individual questions flagged `verify: true`.
- `reviewed_against` and `reviewed_on` are optional but must appear together — absent means "AI draft, not yet reviewed". Enforcing review in the schema would block drafting; the gate is enforced in code instead.
- `verify: true` requires `verify_notes`. A bare boolean does not tell future-you what was uncertain.
- `modes.read` is an object `{plain, standard, deep}`, only `plain` required — matches the layered Read mode in master-plan §5, not the flat string in the blueprint's shorthand example.
- Media moved to a top-level `media[]` array per concept carrying `src`, `alt`, `source`, `license`, `print_safe`; `modes.see` and question/card media reference it by id. This is the copyright manifest required by master-plan §10.7, and it makes alt text mandatory.
- `difficulty` is 1–5 on both concepts and questions.
- Domain enum (`AIR`, `CARD`, `TRAU`, `MED`, `OPS`) is **EMT-only** and will be extended with Fire (NFPA 1001 / Florida BFST) and Paramedic domain tags when those tiers begin.
- `concept.card_data` holds structured per-type card content (`drug`, `numbers`, `skill`, `mnemonic`, `compare`, `algorithm`). Every leaf is a string so figures never get coerced and printed wrong; the card renderer lays out, it never parses prose.
- One content file per module: `content/<tier>/<NN>-<slug>.json` validates against `module.schema.json`, which carries the lesson order and inlines the full concept records. One fetch per module.
- IDs are self-indexing: `EMT-02-03-04` (concept) → `EMT-02-03-04-Q001` (question) → `EMT-02-03-04-C01` (card). The parent is readable from the child's id alone.
- `progress.schema.json` is one format for both `localStorage` (`l1a.progress`) and the export file, so an export is a real backup. SRS state is SM-2 shaped (`interval_days`, `ease` 1.3–3.5, `due`, `last_result`, `confidence`).
- Questions carry optional `source` (text, edition, page) and an optional `retired` object (`on`, `reason`). Retired questions are **never served** — not in lesson checks, module exams, mixed review, focus drills or simulations — but stay in the file so past attempt records still resolve to the item that was actually asked. Retire, never delete.
- Questions and cards live in their own per-module files, not inside the module file: `content/<tier>/questions/<NN>-<slug>.json` and `content/<tier>/cards/<NN>-<slug>.json`, wrapped by `question-bank.schema.json` and `card-deck.schema.json`. At ~8 questions per concept a module's bank dwarfs its content; reading one lesson must not mean downloading every question in the module. Banks load on demand when a test starts.

## 2026-09-15 — Brand kit (Phase 1, step 2)

- `brand/theme.css` is the single source of brand truth: palette, tier colors, semantic tokens, paper tokens, type stacks, 1.25 type scale, 4px spacing scale, print geometry. No renderer hardcodes a hex value.
- Monospace face: **IBM Plex Mono** (Google Fonts), for doses, vitals, formulas and radio reports. Set with `tabular-nums` so figures line up in columns.
- Dyslexia-friendly option: **Atkinson Hyperlegible** (Google Fonts), toggled by `[data-font="hyperlegible"]` on `<html>`. Note this is *not* OpenDyslexic, which is not served by Google Fonts and would need self-hosting — swap it in later if Atkinson does not help.
- Text-size option is `[data-text-size="base|lg|xl"]` on `<html>`, scaling the root font size so the whole rem-based scale moves together.
- Logo: rails run from a 6px gap at the top to a 66px gap at the bottom; the triangle they enclose above the top rung is the A counter, and the top rung is its crossbar. Rungs carry ids `rung-1`/`rung-2`/`rung-3` so the app can light them as tiers unlock. Star of Life is star white, not the traditional blue — line blue is already spoken for by the Paramedic rung.
- `logo-mono.svg` uses `fill="currentColor"` and an outlined shield, so a single-color print mark inherits the surrounding text color.
- Print geometry: Letter, 0.5in margin → a 7.5 × 10in live area holding exactly two 3in columns with a 0.5in gutter and two 5in rows. Four cards per sheet.
- Duplex: backs sheet uses `direction: rtl` on the grid to mirror columns for a **long-edge** flip. Print all fronts, reload the stack unturned, print all backs.
- Black and white: the tier bar carries a pattern as well as a color — EMT solid, Fire hatched, Paramedic dotted — so a mono print is still unambiguous. `.l1a-mono` renders a grayscale proof on screen.
- Print classes are deliberately **not** wrapped in `@media print`, so `brand/preview.html` can render real sheets on screen. Only page setup and chrome suppression live in the print block.
- **Card footer is the short form.** Note cards print `Rung 1 · EMT · Module 2 — Airway` with no "Ladder One Academy" prefix — the stamp above already reads L1A, and the full string wraps to two lines at 3×5 in. Tests, worksheets and any full page keep the full form. master-plan §2 and §6, CLAUDE.md and `card.schema.json` updated to match.
- **Tier bar textures reassigned.** EMT = star white fill with a fine navy diagonal hatch (star white on white paper is otherwise invisible); Fire = solid ember; Paramedic = line blue, dotted. This supersedes the "solid / hatched / dotted" reading of master-plan §2, where the hatch sat on Fire. Textures live in `brand/print.css` only — `theme.css` carries the colors, not the textures.
- Star of Life redrawn as six straight bars with flat square ends crossing at the center (three rects at 0/60/120 degrees, no corner radius). Size and position unchanged.
- Ladder rails thickened from 10 to 13 units in **both** logo files — they were already geometrically identical; the colour version only *looked* thinner because `#C9D2E0` on navy is far lower contrast than solid `currentColor` on white. Rails also lightened to `#DCE3EC`. Rung widths recomputed so they still meet the rail centre lines. The two marks stay interchangeable.

## 2026-09-15 — Shell v1: Ladder home (Phase 1, step 3)

- **Hash routing** (`#/`, `#/lesson/:conceptId`). No server rewrites needed, which is what a static Pages deploy wants. Unknown routes fall back to the Ladder.
- `js/progress.js` is the only module that touches `localStorage`. One key, `l1a.progress`, holding exactly the `progress.schema.json` shape — verified: a populated runtime record validates against the schema with zero errors.
- A progress record that cannot be parsed, or that carries an unknown `export_version`, is **set aside under `l1a.progress.broken`** and a fresh record is started. Never overwrite a record we failed to understand, and never guess at a migration.
- **Gating is recomputed from the rules on every render**, never trusted from stored `status`. The stored value is a cache; `tierStatus()` is the truth. A hand-edited import cannot unlock a tier it has not earned.
- **Self-attest lives on the tier being unlocked**, not the tier being skipped — checking it on the Fire card means "I'm already a certified EMT", and it opens Fire only. Paramedic stays locked. Labelled on screen as the honour system, because for a single user that is exactly what it is.
- The **logo is the progress indicator**: `ladder.js` renders the mark inline with rung fills driven by unlock status, locked rungs in `--slate`. Confirmed working — attesting Fire turns the middle rung ember without a reload.
- **Continue** resolves to the first incomplete concept in lesson order across loaded modules, and routes to `#/lesson/<id>`. With no lesson view yet, that route renders a stub that still resolves the concept, lesson and module, so the wiring is visibly real.
- `MODULE_FILES` in `app.js` is the manifest of built modules. The Ladder reports "N of 11 modules built" from it rather than pretending the tier is complete.
- Tier completion deliberately requires all 11 EMT modules, so EMT cannot read as complete off one stub module.
- `content/emt/02-airway.json` is a **stub**: 3 lessons, 6 concepts, only `title`, `key_points` and `modes.read.plain` filled. Every concept is `verify: true` with notes naming exactly what is missing. No flow rates, concentrations, ages or equipment sizes have been entered anywhere — the blueprint quotes some figures, but they have not been checked against a source text, so they stay out.

## 2026-09-15 — Lesson view and lesson check (Phase 1, step 3)

- **Gating is recomputed from the rules on every render** (approved). Stored `tiers[].status` is a cache; `tierStatus()` in `progress.js` is the truth. A hand-edited or imported progress file cannot unlock a tier it has not earned.
- **Tier completion requires all 11 EMT modules** (approved). Placeholder rule so EMT cannot read as complete off a single stub module. The real gate is master-plan §8 — all modules + two simulations ≥ 85% + card retention ≥ 90% + skills reviewed — and needs the test and SRS engines before it can be implemented.
- **Mode tabs show only the modes the concept actually has.** An empty tab is worse than a missing one. Quiz It is the one exception: it is driven by whether the question bank holds items for the lesson, because the bank is a separate file and `modes.quiz` only ever carries configuration (`pool_size`, `pass_pct`), never content. Stub concepts have no `modes.quiz`, so defaults apply — pool 5, pass 80.
- **Read mode's depth toggle appears only when there is depth to show.** With `plain` alone, a line says the other layers are not written rather than offering dead buttons.
- **The lesson check covers the lesson, not the concept.** Questions are drawn across all of the lesson's concepts, round-robin so one concept cannot dominate the draw, and the result is recorded against every concept in the lesson.
- **A pass alone does not complete a concept.** master-plan §8 needs both halves: viewed in at least one mode *and* lesson check at or above pass. Verified — passing at 100% with nothing marked viewed records the score and completes nothing.
- **Retired questions are never drawn.** Items flagged `verify: true` *are* served in a lesson check; they are barred only from module exams and full simulations, which gate progression. Worth knowing that this means a lesson can currently be completed off unverified questions — acceptable while the bank is a stub, but it is the reason the stub bank announces itself in the quiz intro.
- **Per-question confidence is not persisted.** `progress.schema.json` has no field for it, and inventing one in code would put the app and the schema out of step. What it does drive is the Focus List: a wrong answer, or a right one tagged "guessed", sets `concepts[id].focus`. If per-question confidence history turns out to matter, it needs a schema change first.
- **Quiz run state is in memory only.** A half-finished check is not progress, and persisting it would let you resume a check you were failing. Leaving the lesson or switching off the Quiz tab abandons the run.
