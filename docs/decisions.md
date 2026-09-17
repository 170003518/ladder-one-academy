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

## 2026-09-15 — Module exam, print, dev mode (Phase 1, step 3 complete)

- **Hero logo: the rung logic was already correct** — lit on `unlocked`, slate on `locked`, never keyed to `complete`. Measured it: EMT's rung was already `var(--star-white)`. The real problem was that the rails were `#DCE3EC`, almost the same value as a lit star-white rung, so "lit" did not read. Rails in the app mark now use `var(--navy-500)`: rails darkest, locked rungs mid slate, lit rungs bright. The static `brand/logo.svg` keeps the lighter rails — it has no state to show.
- **Unverified content is barred from every question context**, lesson checks included. One rule, one place: `isServable()` in `js/bank.js`, shared by the lesson check and the module exam so they cannot drift.
- **Dev mode** (`l1a.devMode` in localStorage, separate from progress, default off) lets flagged content through and puts a banner on every screen. Footer toggle, or `?dev=1` / `?dev=0` in the URL. Without it a stub bank makes the app correctly empty, which is unworkable while building.
- **Retired questions are never served — not even in dev mode.** Retirement is a content decision, not a verification state.
- **`export_version` bumped to 1.1.0** for `question_history`. Migration from 1.0.0 adds an empty array and re-saves; earlier answers were never recorded and inventing history would be worse than having none. An unknown version is still set aside under `l1a.progress.broken` rather than migrated by guesswork. Import applies the same migration.
- **`question_history` is the raw record**; per-concept `lesson_check` and per-module `exam_attempts` are rollups of it. Kept flat so it can be filtered by context or date without walking the tree. Every answer is written the moment it is tagged, not at the end of a run — abandoning a paper should not erase what was answered.
- **Cards gained `verify` / `verify_notes`.** A flagged card prints an "Unverified — not for study" mark and stays out of the SRS deck: drilling an unverified fact is worse than not drilling it, because repetition is what makes it stick.
- **The exam clock is wall time, not a limit.** Nothing is cut off. The number exists so time-per-question can be looked at afterwards.
- **No going back inside an exam.** Tagging confidence commits the answer and advances. Rationales are withheld until the review screen, which then shows all four options' reasoning.
- **A failed attempt locks the retake for `retake_after_hours`** and the retake draws a fresh set. A pass does not lock anything.
- **Exam run state is in memory.** Refreshing mid-paper loses the attempt, unrecorded — we cannot tell a refresh from a walk-away, and recording a partial paper as a score would be worse.
- **One card per print sheet still uses the real two-column grid**, so the single card sits in the cell it would occupy on a full sheet and the mirrored backs sheet puts its back in the opposite column. Verified: front at column 1, back at column 2, card exactly 3 × 5 in.

## 2026-09-15 — Content: EMT-02-03 Oxygen delivery

- First real content merged. Lesson EMT-02-03 goes from 2 stub concepts to **6 authored concepts**, the bank from 18 to **35 questions**, the deck from 6 to **12 cards**. Everything still carries `verify: true` — drafted at AAOS Emergency Care 12e level but not reviewed against a source text, so it stays barred from every question context unless dev mode is on.
- **Field adaptations made to fit the schemas, content untouched:** `card_data.compare.left_name` / `right_name` → `left_label` / `right_label`, and `rows[].label` → `rows[].feature`, on EMT-02-03-02 and EMT-02-03-04.
- **Card metadata supplied** (the draft carried none): `schema_version`, `print_size`, `number`, `footer`, and `verify_notes` on all 8 new cards. Deck numbering continues from the existing cards, 5–12.
- **`select_device` now covers two config shapes**, detected from the config rather than declared: `match` (`devices[]` + `patients[{text, correct, why}]`) and `choice` (`choices[]` + `correct_choice` + `worked_solution`). The oxygen-duration calculation is authored as `select_device` because `concept.schema.json`'s `type` enum has no calculation renderer; rather than change the content's declared type, the renderer handles both. If calculation activities become common, the enum should gain a `calculation` type and the content should be migrated to it.
- **Do It is practice, not assessment.** Picks are in memory, nothing is recorded to progress and nothing gates on it.

## 2026-09-15 — Hear It, Teach It Back, calculation type

- **`calculation` added to `modes.do.type`**, and EMT-02-03-01's `cylinder_duration_calc` migrated to it. The renderer still detects the shape from the config rather than the declared type, so both `select_device` and `calculation` reach the same code — the type is now honest about what the activity is.
- **Hear It uses browser SpeechSynthesis**, per the locked audio decision. Narration source order: `modes.hear.script` → `read.standard` → `read.plain`. Voice and accent come from the operating system, not the app, and the screen says so.
- **Narration is chunked, not read as one utterance.** Blank-line paragraphs are used where the author wrote them, but `read.standard` is typically one unbroken 650–870 character block; a single block makes the highlight meaningless and hands the browser a very long utterance, which several of them truncate. A single block over 300 characters is therefore split on sentence boundaries into roughly 240-character chunks. Verified: an 868-character block becomes 5 chunks of 135–268 characters.
- **Speech controls do not re-render the view.** Replacing `innerHTML` mid-utterance would drop the highlighted node while the browser kept talking, so `hear.js` paints the highlight into the existing DOM itself. It also updates the Mark viewed button directly when playback finishes.
- **Pause then resume re-speaks the current chunk** rather than calling `resume()`, which is unreliable across browsers. Costs a repeated sentence or two; gains predictability.
- **Leaving any view cancels speech.** Nothing keeps talking after a route change.
- **Teach It Back never shows the model answer before submit.** Showing it first would turn the highest-retention mode in the plan into a reading exercise.
- **Teach matching is case-insensitive substring matching** against each `must_hit[].accept` list. It is crude on purpose and the screen says so: it can miss a good explanation that used different words, and credit a wrong one containing the right phrase. Missed points show what was looked for, so the accept list doubles as a hint after the fact.
- **Submitting records the mode-viewed flag**, including a blank submit — the result screen makes an empty answer obvious.
- **A Teach attempt survives switching modes but not switching concepts**, so tabbing away and back does not throw away what was written.
- Three concept cards added (EMT-02-03-02-C02, -03-C02, -06-C02), closing the gap where those concepts declared a `concept` card in `cards[]` that the draft never supplied. Every concept's declared `cards[]` is now covered by the deck.

## 2026-09-16 — Content: EMT-02-01 Airway anatomy; See It and sort renderers

- Lesson EMT-02-01 goes from 2 stub concepts to **5 authored concepts**; bank 35 → **48 questions**; deck 15 → **22 cards**. First real media in the repo: `media/emt/02/airway_upper_lower.svg`, registered in EMT-02-01-01's `media[]`. Everything still `verify: true`.
- **Field adaptations, content untouched:** `card_data.compare.left_name` / `right_name` → `left_label` / `right_label`, and `rows[].label` → `rows[].feature`, on EMT-02-01-02 and EMT-02-01-05 (13 rows). Card metadata supplied on all 9 new cards: `schema_version`, `print_size`, `number`, `footer`, `verify_notes`.
- **`media[].alt` cap raised from 300 to 1000 characters.** The airway diagram's alt is 327 characters because it names every labelled structure in both colour groups. Truncating it would gut the one thing alt text exists for, and accessibility is a stated non-negotiable. Long alt is correct for a labelled diagram; the teaching point belongs in `caption`, which everyone sees.
- **See It renders only what the concept's `media[]` manifest resolves**, by id. A `modes.see` entry with no manifest match renders a visible "missing from the manifest" box rather than a broken image — that is what keeps master-plan §10.7's copyright manifest enforceable instead of decorative. Each figure shows caption, kind, source and licence, and flags anything not print-safe.
- **Opening the See It tab marks the mode viewed.** There is nothing to complete in it — the mode is the looking.
- **`sort_into_buckets` takes two inputs**: tap an item then tap a bucket (works on touch), or drag an item onto a bucket (desktop only — touch never fires drag events, which is why the tap path is the primary one). Both routes call the same functions.
- **Sorting does not mark as you go.** Everything is placed, then Check reveals what was wrong and where each miss belonged. Marking each drop instantly would turn a judgement exercise into trial and error.
- **Calculation activities read `answer_value` + `answer_unit` as well as `answer_minutes`.** Oxygen duration was authored one way and alveolar ventilation another; the renderer reads both rather than forcing the content to pick.
- **Card numbering continued from the existing maximum**, so the new lesson-01 cards are numbered 16–24 while the lesson-03 cards they teach *after* hold 5–15. Print order therefore does not match teaching order, and numbers 1–2 are now unused. Left as instructed; renumbering by concept ID is a one-liner when wanted.

## 2026-09-16 — Card numbering and number formatting

- **`media[].alt` cap of 1000 characters approved.**
- **Card `number` follows concept ID order**, which is teaching order because the IDs are zero-padded: `EMT-02-01-01` … `EMT-02-03-06`. Within a concept, the card id keeps its own order (C01 before C02). The deck is renumbered 1..N as a contiguous run — no gaps.
- **Cards are renumbered on every content merge, and will keep moving, until the deck is frozen for printing.** Merging a new lesson inserts cards in the middle of the sequence, so a card's number is not a stable identifier and nothing should reference it — the card `id` is the identity, `number` is only print order. When the tier's content is final, freeze the numbering and stop renumbering; until then, do not print a deck and expect the numbers to still match later.
- Calculation answers are formatted with thousands separators, pinned to `en-US` rather than the viewer's locale so the figure matches the worked solution written beside it ("2,400 mL/min" in both).
- A unit that is a plain word is singularised when its value is exactly 1 — "within 1 minute", not "within 1 minutes". Symbol units containing punctuation (`mL/min`) never pluralise and are left alone.

## 2026-09-16 — Deck print: multiple cards per sheet

- Deck print route at `#/print/deck/<moduleId>`. Scope is whole module, one lesson, or a hand-picked set; cards always print in deck `number` order.
- **Sheet order is front, back, front, back** through the deck, so each back sheet immediately follows the fronts it belongs to. Four cards per Letter sheet using the existing `.l1a-sheet` tiling — 2 columns × 2 rows inside a 7.5 × 10in live area.
- **Mirroring is an artefact of the flip, not a property of the deck.** That is the whole difference between the two modes:
  - **Double-sided**: the printer turns the paper on the long edge, flipping it left-to-right, so the backs grid is mirrored (`direction: rtl`) and each back lands behind its own front.
  - **Single-sided**: nothing is turned over — you print every sheet one side up, cut fronts and backs, and pair them by position. Mirroring here would put every back behind the *wrong* front, so backs are **not** mirrored in this mode.
  This was the ambiguous part of the brief ("alternates front and back sheets" describes both modes); the mirroring rule is the reading that actually produces correctly-assembled cards.
- Verified: a 12-card selection produces exactly **3 front sheets and 3 back sheets**, 4 cards each, in front/back alternation. In duplex, front columns 48/384/48/384 against back columns 384/48/384/48 with rows matching — every back mirrored onto its front. In single-sided, front and back columns are identical.

## 2026-09-16 — Content: EMT-02-02 Opening and maintaining the airway

- 7 concepts, 27 questions, 13 cards. Everything `verify: true` with notes naming what to confirm against AAOS Emergency Care 12e.
- **Numbers deliberately omitted where I was not confident of the standard textbook value.** Suction time limits (adult / child / infant maximum seconds) are *not* stated anywhere in this lesson — texts and editions differ, so the concept teaches the principle ("limited passes, reoxygenate between them") and the `verify_notes` on both the concept and the skill card say the exact seconds must be filled in from the source. Same for the number of infant back slaps and chest thrusts, which is described as "alternating" rather than given a count.
- Skill concepts (OPA, NPA, suction, FBAO) each got a skill card with critical steps flagged and at least one `sequence` question, per the brief. BVM belongs to EMT-02-04 and is handled there.
- Do It activities use only shapes that have renderers: `sort_into_buckets` for maneuver choice, OPA appropriateness and suction tip selection; `select_device` match for OPA/NPA/neither and for FBAO action by patient.
- EMT-02-02-07 carries three card types (concept, algorithm, skill) because the choking decision is both a tree and a psychomotor skill.

## 2026-09-16 — Content: EMT-02-04 Ventilation

- 8 concepts, 28 questions, 12 cards. New lesson — the module had never carried EMT-02-04, so the merge tool now creates a missing lesson and keeps `lessons[]` in ID order (which is teaching order, because the IDs are padded).
- **Pediatric and advanced-airway ventilation rates are deliberately blank.** These have been revised between guideline editions, and a half-remembered rate is worse than an obvious gap. The adult interval (about one breath every 5 to 6 seconds) and breath duration (about one second) are stated; the Numbers card shows the pediatric and advanced-airway rows as unfilled with a note saying where to get them. `verify_notes` on EMT-02-04-02 calls this out explicitly.
- **No CPAP pressure settings are given** (cmH2O). They are protocol-specific, not textbook constants, so the concept teaches indications, contraindications and coaching and leaves the numbers to local protocol.
- Cricoid pressure is taught as historical and explicitly "no longer routinely recommended", because an EMT will still hear the term.
- BVM is the skill concept in this lesson and got a skill card with critical steps plus a `sequence` question, per the brief.
- Merging this lesson resolved three previously dangling `related` links from EMT-02-03 concepts that pointed forward to EMT-02-04-01.

## 2026-09-16 — Content: EMT-02-05 Respiratory emergencies

- 10 concepts, 37 questions, 14 cards. Module 02 now stands at **36 concepts, 134 questions, 59 cards** across five lessons.
- **No medication names, doses or puff counts anywhere in this lesson.** EMT-02-05-10 teaches the MDI/spacer/nebulizer mechanics and the six rights, and says explicitly in `verify_notes` that the drug list and dosing are protocol-specific and were deliberately omitted. CLAUDE.md forbids inventing drug doses; this is that rule applied.
- **No oxygen target saturation range is stated for COPD.** The concept says plainly that oxygen is not withheld from a hypoxic patient and leaves any target range to the source, because that figure has moved between editions.
- Hyperventilation syndrome is taught as **a diagnosis of exclusion**, with the paper bag explicitly ruled out. This is the lesson's highest-risk teaching point and the story mode drives it with a post-caesarean patient dispatched as a panic attack.
- Epiglottitis carries an explicit never-examine-the-airway rule, and the concept frames keeping the child calm as treatment rather than comfort.
- **Seven rationales failed the schema's 10-character minimum** ("Correct.", "Never.", "It can.") and were rewritten as real explanations. The minimum is doing exactly what it exists for — a one-word rationale teaches nothing, and the schema caught every one.

## 2026-09-16 — Module 02 diagrams

- Three original SVGs added in the style of `airway_upper_lower.svg`: brand palette only, white ground, Inter labels, Oswald headings, slate leader lines.
  - `opa_npa_sizing.svg` — registered in **both** EMT-02-02-04 and EMT-02-02-05, since it shows the two measurements side by side and each concept needs it. The same `src` appears in two concept manifests with different captions; the manifest is per-concept, so this is duplication by design rather than a shared asset table.
  - `bvm_two_rescuer.svg` — EMT-02-04-01.
  - `resp_compare_flow.svg` — EMT-02-05-04, because the wheeze-versus-crackles decision is where the four conditions actually get confused.
- **Print-safe means never colour-only.** Every distinction carries a label as well as a colour, and the flowchart additionally uses solid versus dashed box outlines with a key explaining what the dash means — so the chart still works in black and white, which master-plan §2 requires.
- The flowchart deliberately includes a "chest sounds clear" box for pulmonary embolism, because the absence of a finding is the hardest thing to represent on a chart organised by what you hear.
- Alt text runs 300–900 characters and names every box and branch. This is why the `media[].alt` cap was raised to 1000; a screen-reader user gets the whole chart or none of it.

## 2026-09-16 — Deck v1 (spaced repetition)

- `js/srs.js` holds the scheduling as pure functions; `js/deck.js` is the screen. Route `#/deck/<moduleId>`.
- **SM-2 shaped, with two deliberate departures** so the four buttons behave the way a learner expects:
  - **Hard** multiplies by a fixed 1.2 rather than by ease. In textbook SM-2 a "hard" answer can still schedule *further out* than the previous interval, which reads as broken.
  - **Easy** multiplies by ease and then 1.3, so it visibly buys more time than Good.
  Ease is clamped to 1.3–3.5 because `progress.schema.json` bounds it there. Verified: good → 1, 6, 15 days; hard after that → 18 days with ease dropping 2.5 → 2.35; again → interval 0, due today, reps reset, lapse counted; ease floors at 1.3 and ceilings at 3.5.
- **A card graded Again goes to the back of today's queue** rather than disappearing until tomorrow. Relearning happens in the session it failed in.
- **Unverified cards are kept out of the deck**, as decided when `verify` was added to `card.schema.json` — repetition is what makes a fact stick, so drilling an unverified fact is worse than not drilling it. With all 59 cards currently drafts, the deck is correctly empty with dev mode off and says why.
- **"Study all" is the fallback** for studying ahead of an exam. It ignores the due date but still reschedules every card graded, and the screen says so — a study-ahead session that silently left the schedule untouched would be more surprising than one that moves it.
- Grades are written the moment they are given, not at the end of a session, so abandoning a session keeps the work already done. Session state itself stays in memory.
- The grade buttons show where each choice sends the card ("today", "tomorrow", "15 days") before it is pressed.

## 2026-09-17 — Fill standard ventilation and suction values

Values supplied by AJ and filled into the concepts, cards and questions that had been left deliberately blank. Everything stays `verify: true`, and every affected `verify_notes` now says the figure **was supplied from standard curriculum and must still be checked against AAOS Emergency Care 12e and the current AHA guidelines**.

| Value | Where it landed |
|---|---|
| Suction max per pass — adult 15 s, child 10 s, infant 5 s | EMT-02-02-06 key points, both Read layers, Teach `must_hit` and model answer, skill-card step, concept card, **new Numbers card** |
| Infant FBAO — cycles of 5 back slaps then 5 chest thrusts | EMT-02-02-07 key points, both Read layers, Teach, algorithm node, concept and algorithm cards |
| Respiratory arrest with a pulse — adult 1 breath every 5–6 s, infant/child 1 every 2–3 s | EMT-02-04-02 key points, both Read layers, Teach, Numbers card |
| Advanced airway during CPR — 1 breath every 6 s, compressions continuous | EMT-02-04-02, same places |
| CPAP typical start — 5–10 cm H2O per protocol | EMT-02-04-05 key points, both Read layers, Teach, **new Numbers card** |

- **Six new questions** test the supplied figures: adult and infant suction limits, the infant 5-and-5 cycle, the pediatric ventilation interval, the advanced-airway interval, and the CPAP starting pressure. `question_targets` recomputed from the actual bank for the four affected concepts.
- **Two new Numbers cards** (`EMT-02-02-06-C11` Suction limits, `EMT-02-04-05-C09` CPAP at a glance), so both concepts now declare and supply a numbers card. Deck renumbered by concept order as the policy requires — **61 cards**, and card numbers have moved again.
- **Still omitted by instruction**: the COPD target saturation range, and all medication names, doses and puff counts. Verified absent by pattern search across all three content files.
- One incidental fix: EMT-02-05-10's story said a nurse had helped a child with "two puffs". That reads as a dose, so it is now "helped him with it once" — no loss to the narrative.
- **`accept` keywords must be at least 2 characters.** Adding "5" to two Teach `must_hit` lists failed the schema. Replaced with "5 seconds", "5 back", "5 chest" and "five" — a bare "5" would have matched almost any answer containing a digit anyway, so the constraint was protecting the check as well as the data.
- **Flowchart alt trimmed 998 → 776 characters**, keeping every box name (ASTHMA, COPD, PULMONARY EDEMA, PNEUMOTHORAX, GETTING WORSE, CHEST SOUNDS CLEAR, PULMONARY EMBOLISM), every branch label, and the named findings. The SVG's own `<desc>` was updated to the identical text — they had been allowed to drift apart when the diagram was first written, and now match exactly.

## 2026-09-17 — Module 03 Patient Assessment

- New module file `content/emt/03-assessment.json` with its own question bank and card deck, registered in `app.js`. Domain weighting `MED 50 / TRAU 50`, since assessment feeds both.
- **The blueprint's own lesson listing gives 31 concepts, not the 32 its summary table quotes** (5 + 7 + 4 + 5 + 8 + 2). The per-lesson listing is the authoritative one and is what was built; the table total appears to be an approximation.
- **Merge tool generalised** (`merge2.py`): it now takes a module slug, creates the module, bank and deck files on first use, and validates any module. The Module 02 tool was hardcoded to one file set.
- **The authoring helper now fails the build on a rationale under 10 characters** before anything is merged, listing every offender at once. Four were caught this way in lesson 01 alone — the same class of defect that reached the repo during Module 02 and had to be fixed afterwards.
- **A schema error briefly reached a commit.** A one-character `accept` keyword ("5") in EMT-03-06-01 failed `minLength: 2`, but the validator's summary line printed "ALL CHECKS OK" because it only reflected the referential checks and ignored the schema result. Fixed in the data and in the validator, which now says "** PROBLEMS **" when the schema rejects anything. This is the second time a one-character keyword has slipped in; the underlying lesson is that a bare digit is a useless matcher anyway.

## 2026-09-17 — Module 04 Cardiology & Resuscitation

- 4 lessons, 28 concepts, 84 questions, 41 cards. New module file, bank and deck, registered in `app.js`. Domain weighting `CARD 100`.
- **CPR figures filled from current AHA guidelines, as permitted**: rate 100–120/min at every age; adult depth at least 2 in (5 cm) and no more than 2.4 in (6 cm); child about 2 in (5 cm) and infant about 1.5 in (4 cm), or at least one third of chest depth; ratio 30:2 for adults and single-rescuer paediatric, **15:2 for two-rescuer child and infant**; interruptions under 10 seconds; compressor change about every 2 minutes; with an advanced airway, continuous compressions and 1 breath every 6 seconds. Every one of these carries a `verify_notes` saying the figures are revised between guideline editions and must be confirmed against AAOS 12e and the AHA edition the course uses.
- **No medication doses anywhere in the module.** EMT-04-02-08 teaches assisting with aspirin and nitroglycerin — why aspirin is chewed, blood pressure before and after every nitroglycerin dose, and the erectile-dysfunction-medication contraindication — and names no dose. The drug names appear only as the medications being assisted with, which is unavoidable in a concept about assisting with them.
- **The neck veins are used as the organising discriminator across the shock lesson.** Flat means volume loss and fluid helps; distended means pump failure or obstruction and fluid harms. Neurogenic shock is taught explicitly as the exception that breaks the cool-pale-clammy-and-tachycardic pattern.
- A recurring authoring defect: bare `"Correct."` rationales failing the 10-character minimum. The `lib.py` guard now reports all offenders in one pass before anything merges, and for Module 04 they were expanded in bulk before the first run rather than one per attempt.

## 2026-09-17 — Module 03 and 04 diagrams

- Four original SVGs in the established style (brand palette, white ground, Inter labels, Oswald headings): `primary_assessment_flow.svg` on EMT-03-02-01, `heart_blood_flow.svg` on EMT-04-01-01, `chain_of_survival.svg` on EMT-04-03-01, `stages_of_shock.svg` on EMT-04-04-01. All registered in `media[]` with full alt text and added to `modes.see`.
- **Print-safe throughout**: every distinction carries a label as well as a colour, and where a colour does carry meaning the diagram says so in a key — the chain-of-survival link 3 is blue *and* captioned as the converting link; the shock graph's dashed blue line is labelled as blood pressure.
- **The primary assessment chart uses dashed outlines for rules rather than steps.** X for catastrophic bleeding and "fix before you move on" are both properties of the sequence, not stages within it, and the key says so.
- Alt text runs 541–889 characters, comfortably inside the 1000 cap raised for exactly this purpose.

## 2026-09-17 — Ladder rings and the Module Overview screen

- The "N of 11 modules built" denominator now comes from `MODULES_IN_TIER` in `ladder.js` (EMT 11, Fire 17, Paramedic 10, from the blueprint) rather than a literal 11, so the Fire and Paramedic rungs will read correctly when they exist. Tier completion uses the same constant.
- Each built module on the Ladder now shows a completion ring, its lessons each with their own ring and an `n/total` count, and links to Overview, Module exam, Study the deck and Print the deck.
- **New Module Overview screen** at `#/module/<moduleId>`: overall ring, per-lesson rings, and every concept listed with **eight mode dots**. Each dot is one of three states — viewed, written but not yet viewed, or not written at all — with a key above. That three-state distinction is the point: a percentage cannot tell you *which* mode you have not been through, and the whole eight-mode design depends on being able to see that.
- The dots also surface `focus` and `high_yield` flags per concept, so the Focus List is visible somewhere other than at the end of a quiz.
- Rings are a single SVG circle with a `stroke-dashoffset`, shared by `ladder.js` and `overview.js` rather than duplicated.

## 2026-09-17 — Worksheet generator v1

- Route `#/worksheet/<lessonId>[/<seed>]`. Generates fill-in-the-blank items from each concept's `key_points`, a label-the-diagram page for every concept with media, and an answer key on the last page. Linked from each lesson row in the Module Overview.
- **Everything derives from a seed, and the seed is printed on every page** (`v121021 · page 2 of 5`) and carried in the URL. "New version" picks a new seed and rewrites the hash, so a printed worksheet can be regenerated exactly from the number on the sheet. Verified: two versions blank different terms, and re-entering a seed reproduces the sheet character for character.
- **What gets blanked is chosen by rule, not by markup**, in priority order: a figure with a unit or range ("10 to 15 L/min", "30:2", "6 seconds"); then a capitalised term or acronym that is not sentence-initial; then the longest content word that is not a stopword and not sentence-initial. Those rules live in `pickBlank()` and are the part most likely to need tuning once real worksheets get used — the content carries no worksheet markup at all, which is why the same key points can feed lessons, cards and worksheets without drifting.
- Sentence-initial words are excluded after the first run produced "______ with the bevel toward the septum", which starts with a rule and reads badly.
- **Label-the-diagram is honest about its limit.** The page prints the diagram large with numbered write-on lines and asks the learner to name the labelled structures, but it cannot place numbered pointers on the figure, because `media[]` carries no label coordinates. True per-label blanking would need a `labels` array on the media entry with positions — a schema change, deliberately not made for v1. The answer key says where the answers come from rather than pretending to enumerate them.
- The worksheet view warns when the lesson's concepts are unverified, because an answer key is only as correct as the content it was generated from.

## 2026-09-17 — Exam Readiness meter

- Meter on the Ladder hero, breakdown screen at `#/readiness/emt`. Score is a weighted average: **module exams 50%, card retention 30%, full simulations 20%**, per master-plan §3.6.
- **A component with no data contributes nothing and its weight leaves the denominator.** Otherwise the score would be dragged toward zero by simulations nobody has sat and full-length simulations do not exist yet. Verified by hand: exams 82, retention 80, simulations 82 → 82(0.5) + 80(0.3) + 82(0.2) = 81, matching what the app displays.
- **The threshold is a placeholder and the screen says so.** §3.6 says the meter "turns green when you're statistically ready"; there is no statistics here, because no outcome data exists to fit weights or a threshold against. The breakdown screen leads with "This is not a validated prediction" rather than implying a pass probability. That caveat should be removed only when there is real data behind it.
- **Coverage sits beside the score and is never folded into it.** Three of eleven modules can produce a high score from the three; presenting that as readiness for the whole exam would be a lie. The screen states the coverage explicitly and the "ready" state additionally requires every module in the tier to be built.
- **The domain heat map resolves domains through the loaded modules**, because `question_history` stores `concept_id` rather than `domain`. That means a domain appears only once its module is built, which the screen says.
- The Focus List ranks concepts by miss rate, counting **a right answer tagged "guessed" as a miss** — it looks identical to knowledge in a score and is not. That is the whole reason confidence is captured.

## Diagram labels on worksheets

`media[].labels` carries an optional list of `{id, text, x, y}` where `x`/`y` are
percentages of the rendered figure. When a figure has them, the label-the-diagram
worksheet page inlines the SVG rather than using `<img>`, hides every `<text>` and
every `.lead` leader line inside it, and drops its own numbered pointer at each
coordinate — one write-on line per label, and the answer key lists them by number.
The pointer order is reshuffled per seed, so two versions of the same sheet do not
have the same answers running down the page.

Inlining is what makes the exercise possible: the diagrams print their own labels,
and an `<img>` is opaque to the page stylesheet, so the answers would be sitting on
the sheet. Because an inlined SVG's `<style>` is document-global and the figures use
short generic class names (`.sub`, `.hd`, `.flow`), each rule is rewritten at inline
time to sit under `.ws-diagram--labelled`.

Figures without `labels` keep the previous page: the image as authored, a generic
instruction, and eight blank lines. A flowchart whose boxes *are* the content has
nothing to label and should not get the array.

## Nitroglycerin contraindication figures (batch 3, item 1)

The four figures supplied — systolic floor 90 mmHg, erectile dysfunction medication
window 24 to 48 hours, head injury, maximum three doses — went into `EMT-04-02-08`'s
key points, both read depths, the skill card steps, a new `numbers` card, and four new
questions. All stay `verify: true`, and every `verify_notes` now names the four figures
explicitly and says local protocol overrides them. The erectile dysfunction window is
worded "24 to 48 hours depending on the drug" rather than picking one number, because
it genuinely differs by agent and the agent is not named here.

Two judgment calls. The head-injury rationale (vasodilation worsening intracranial
bleeding and raising intracranial pressure) is stated, because a contraindication
without its reason is not studyable — but it carries the same verify flag. And "maximum
three doses" was read as a count, not a dose, so it is inside the no-doses rule: no
milligram figure appears anywhere.

## Pre-existing defects found while validating

`EMT-03-05-01` (pulse) had a "Normal vital signs by age" `numbers` card in the deck that
the concept never declared in `cards[]` and had no `card_data` for. The card was right
and the concept was incomplete, so the concept now declares it and carries the figures,
intermediate paediatric bands still deliberately blank.

Two validator rules were too strict and have been relaxed:

- A `related`/`prereqs` reference into a module that has not been written yet is a
  deliberate forward link, not a broken reference. Only a miss inside a module that
  exists on disk is an error; the rest are counted as notes.
- `quiz.js` draws `min(pool_size, available)`, so a concept with fewer questions than
  its `pool_size` degrades gracefully. That is thinness to report, not a defect.

## Module 06 concept count (batch 3, item 3)

The batch asked for 9 lessons and 50 concepts. The blueprint's Module 06 outline
lists 45 sub-items across those 9 lessons, so five concepts had to be added. Rather
than padding, the five were chosen where the batch's own card requests implied a
concept that the outline had folded into a larger one:

- **06-02-05 Tourniquet application** and **06-02-06 Wound packing and hemostatic
  dressings** split out of the outline's single "external bleeding control" item,
  because the batch asks for a skill card with sequence questions for each.
- **06-05-06 Pelvic binder application**, split from "pelvic fractures and pelvic
  binder", for the same reason.
- **06-06-08 Helmet removal**, a standard trauma topic the outline omits.
- **06-08-04 Trauma in pregnancy**, which the blueprint does not place anywhere:
  Module 07's obstetrics lesson covers complications of pregnancy, not trauma to a
  pregnant patient, so it sits in multi-system trauma.

Final shape: 06-01 (4), 06-02 (6), 06-03 (4), 06-04 (5), 06-05 (6), 06-06 (8),
06-07 (6), 06-08 (4), 06-09 (7) = 50.

## Module 01 and 08 concept counts (batch 4)

The batch asked for Module 01 at 46 concepts and Module 08 at 21. The blueprint
outline lists 48 and 22. Two merges in Module 01 and one in Module 08, chosen
where the outline already separates things an EMT meets at the same awareness
level:

- **01-06-07 Digestive, urinary and reproductive systems** merges the outline's
  separate digestive and urinary/reproductive items.
- **01-06-08 Endocrine, lymphatic and immune systems** merges the outline's
  separate endocrine and lymphatic/immune items.
- **08-03-02 The EMT's role at an extrication: simple and complex access** merges
  the outline's "roles of EMS at an extrication" and "simple vs complex access",
  which are the same question asked twice.

Module 01 lesson 06 therefore holds 8 concepts rather than 10, and Module 08
lesson 03 holds 2 rather than 3. Every other lesson follows the outline exactly.

## NREMT domain weights used by the full simulation (batch 4)

The blueprint gives ranges, not points: AIR 18–22%, CARD 20–24%, TRAU 14–18%,
MED 27–31%, OPS 10–14%. The simulation needs a single number per domain, so it
uses the midpoint of each range, normalised to 100:

| Domain | Range | Used |
|---|---|---|
| AIR | 18–22% | 20% |
| CARD | 20–24% | 22% |
| TRAU | 14–18% | 16% |
| MED | 27–31% | 30% |
| OPS | 10–14% | 12% |

The midpoints sum to 99, so MED absorbs the rounding — it has the widest range
and the largest share. These live in one exported constant in `js/simulation.js`
so they can be corrected in one place when the current NREMT blueprint is
checked, which the blueprint itself says still needs doing.

## Batch 4 — Module 08 hazmat zones compare card

The batch asked for "a compare card for hazmat zones". There are three zones
and the compare card schema is strictly two-column (`left_label` /
`right_label`, with every row filling both sides). Rather than drop a zone or
invent a third column, the card compares HOT against WARM across the rows that
actually get confused — who enters, what care is permitted, what happens there,
whether an EMT belongs there — and its final row, "Beyond both: the COLD ZONE",
uses the two cells to describe the cold zone rather than to contrast the other
two. The full three-zone picture also appears in the concept card and the
concept body, so nothing is lost if the compare card is read alone.

## Batch 4 — the ERG mnemonic

The batch asked for "a mnemonic for ERG use". There is no single standard
mnemonic for this in the literature. The card uses **YBOG** — Yellow, Blue,
Orange, Green — over the guidebook's own colour sections, with the memory line
"Yellow by number · Blue by name · Orange for what to do · Green for how far
back". The colour-section structure is genuine and standard; the acronym is an
authoring device rather than a published mnemonic, and the concept's verify note
flags that the guidebook's section arrangement is revised periodically.

## Batch 4 — Module 11 has no question or card files

Module 11's concepts are read-only by design: 11-01 through 11-05 and 11-09 carry
no cards, and 11-06 through 11-08 are placeholders pointing at the Test Center.
That leaves the module with nothing at all to put in a question bank or a card
deck, and the question-bank and card-deck schemas both require a non-empty array.

Rather than invent questions nobody asked for, or weaken a schema that is doing
useful work everywhere else, Module 11 simply has no `questions/11-exam-prep.json`
and no `cards/11-exam-prep.json`, and it is absent from `QUESTION_FILES` and
`CARD_FILES` in js/app.js. Both loaders already return an empty result for a
module with no registered path, and tools/validate.py already treats an absent
bank as "this module has none" rather than as a failure. The concepts declare
only a `read` mode, so `availableModes()` renders them read-only without any
special casing.

Consequence worth knowing: Module 11 has no module exam and contributes nothing
to the full simulation. That is correct — it is a guide to the exam, not content
the exam tests.
