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
