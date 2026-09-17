# Overnight batch — report

**Run:** 16–17 September 2026, autonomous.
**Branch:** `main`, pushed after each item.
**Status:** all six items complete.

---

## 1. What the module looks like now

| | Before tonight | After |
|---|---|---|
| Lessons | 2 of 5 | **5 of 5** (EMT-02-01 … 02-05) |
| Concepts | 11 | **36** |
| Questions | 48 | **135** |
| Cards | 22 | **59** |
| Diagrams | 1 | **4** |
| Modes with renderers | 6 of 8 | **8 of 8** |

Module 02 (Airway, Respiration & Ventilation) is now **content-complete against `docs/emt-blueprint.md`**. Everything in it is `verify: true`.

App screens added: the **Deck** (spaced repetition) and **deck printing** (many cards per sheet).

---

## 2. Item by item

**1 — Card renumbering and number formatting.** Already done in the previous session (`20a0f80`). Verified rather than repeated: 22 cards numbered 1..N in concept order, decisions.md carries the renumbering policy, `fmtNum` is in `interact.js`.

**2 — Deck print** (`01d5b7f`). Route `#/print/deck/<moduleId>`. Scope: whole module, one lesson, or hand-picked cards. Four 3×5 cards per Letter sheet, front/back/front/back through the deck. Acceptance test from the brief passed exactly: **12 cards → 3 front sheets and 3 back sheets**, and at full module scope 59 cards → 15 + 15, every pair mirrored correctly.

**3 — Three lessons** (`46fd472`, `056b4d2`, `2c2bcd3`). EMT-02-02 Opening and maintaining the airway (7 concepts, 27 questions, 13 cards), EMT-02-04 Ventilation (8 / 28 / 12), EMT-02-05 Respiratory emergencies (10 / 37 / 14). Each concept carries layered Read, ELI-new with an analogy line, TTS Hear, Teach with `must_hit` and a model answer, Story with a dispatch line, quiz settings, and a Do It activity where a skill or decision fits.

**4 — Diagrams** (`016c58e`). `opa_npa_sizing.svg`, `bvm_two_rescuer.svg`, `resp_compare_flow.svg`, in the style of the existing airway diagram, registered with full alt text and added to `modes.see`.

**5 — Deck v1** (`16a53e5`). `js/srs.js` (pure SM-2 scheduling) and `js/deck.js` (the screen). Due-today queue, flip to reveal, four grades with the resulting interval shown on each button, "study all" fallback.

**6 — Validation and browser sweep.** This document, plus one real fix found by the sweep.

---

## 3. Judgment calls

Everything here was decided without you and logged in `docs/decisions.md` as it happened.

**Single-sided printing does not mirror the backs.** The brief said the single-sided option "alternates front and back sheets", which describes both modes. The real difference is mirroring: duplex flips the paper on the long edge, so backs must be mirrored to land behind their fronts; single-sided is cut and paired by hand, where a mirror would put every back behind the *wrong* front. Mirroring is an artefact of the flip, not a property of the deck.

**"Study all" reschedules the cards you grade.** A study-ahead session that silently left the schedule untouched would be more surprising than one that moves it. The screen says so.

**Two departures from textbook SM-2.** *Hard* multiplies by a fixed 1.2 rather than by ease — in plain SM-2 a "hard" answer can schedule *further out* than the last interval, which reads as broken. *Easy* multiplies by ease then 1.3 so it visibly buys more than Good. Ease clamped 1.3–3.5 because the schema bounds it there.

**A card graded Again returns to the back of today's queue** rather than vanishing until tomorrow.

**Unverified cards are kept out of the SRS deck**, per the rule set when `verify` was added to `card.schema.json`. With every card currently a draft, the deck is correctly empty with dev mode off, and says why.

**The merge tool now creates missing lessons.** EMT-02-04 and 02-05 had never existed in the module; `lessons[]` is kept in ID order, which is teaching order because the IDs are padded.

**`opa_npa_sizing.svg` is registered in two concepts.** It shows both measurements side by side and both OPA and NPA need it. The manifest is per-concept, so the same `src` appears twice with different captions — duplication by design, not a shared asset table.

**Print-safe means never colour-only.** Every distinction in the new diagrams carries a label as well as a colour, and the flowchart uses solid vs dashed outlines with a key.

---

## 4. Numbers I deliberately did not write

You said to omit anything I was not confident was the standard textbook value. These gaps are intentional and each is named in the relevant `verify_notes`.

- **Suction time limits** (adult / child / infant maximum seconds). Texts and editions differ. EMT-02-02-06 teaches "limited passes, reoxygenate between them" and the skill card's step says the seconds must be filled in from the source.
- **Infant back slap and chest thrust counts.** Described as "alternating" rather than given a number.
- **Pediatric and infant ventilation rates, and the rate with an advanced airway in place.** These have been revised between guideline editions. The adult interval (about one breath every 5–6 seconds) and breath duration (about one second) *are* stated. The Numbers card shows the pediatric and advanced-airway rows explicitly unfilled.
- **CPAP pressure settings (cmH2O).** Protocol-specific, not a textbook constant.
- **Any COPD target oxygen saturation range.** The concept states plainly that oxygen is not withheld from a hypoxic patient and leaves the range to the source.
- **Every medication name, dose and puff count.** EMT-02-05-10 teaches MDI / spacer / nebulizer mechanics and the six rights and names no drug. CLAUDE.md forbids inventing doses; this is that rule applied.

---

## 5. Things the sweep found and I fixed

- **Seven rationales were shorter than the schema's 10-character minimum** ("Correct.", "Never.", "It can."). Rewritten as real explanations. The minimum did exactly what it exists for.
- **`EMT-02-03-03` had a skill card but no `sequence` question** — inherited from the earlier Oxygen delivery merge, not from tonight. Added `EMT-02-03-03-Q005`. All 7 skill concepts now have one.
- **Two label collisions** in `opa_npa_sizing.svg` (the mouth-corner label ran across the face; the footer collided with the measurement row). Fixed with a leader line and a separate footer band.
- **Rescuer 2's grip was invisible** on the BVM diagram. Added finger strokes.

---

## 6. Verified in the browser, not just asserted

- **232 mode renders across all 36 concepts** — every mode each concept declares. Zero render errors, zero console errors.
- **15 Do It activities** render the right widget for their config shape (9 sorters, 6 choice sets); declared type and rendered widget agree in every case.
- **Lesson check** on a new lesson: 5 questions drawn across the lesson's concepts, 100%, passed.
- **Module exam** across the 135-question bank: 25 drawn, scored 72%, "Not yet", domain table, attempt stored, 25 entries written to `question_history`, review screen showing all four rationales.
- **Deck**: 59 due, flip, four grades. SM-2 checked directly — good → 1, 6, 15 days; hard after that → 18 days with ease 2.5 → 2.35; again → interval 0, due today, reps reset, lapse counted; ease floors at 1.3 and ceilings at 3.5. The live record validates against `progress.schema.json` with zero errors.
- **Deck print**: 59 cards → 15 front + 15 back sheets, **every pair mirrored correctly**; lesson scope 13 cards → 8 sheets; cards measure exactly 3 × 5 in; **no overflow on any of the 118 card faces**.
- **All four diagrams load** in See It with caption, credit and alt text; zoom opens and closes.
- **7 schemas legal draft 2020-12**; module, bank and deck all validate with zero errors; 16 referential checks pass.

---

## 7. What needs your review

**The clinical content is the whole of it.** 36 concepts, 135 questions and 59 cards were drafted by me at textbook level and **none of it has been checked against a source**. Every item is `verify: true` and barred from lesson checks, module exams and the SRS deck unless dev mode is on. Dev mode is currently **on**, which is what makes the app usable — and also what makes it possible to study unverified material by accident. That is the single biggest risk in the repo right now.

Specific things to look at first:

1. **The omitted numbers in §4** — each is a real gap in a lesson, not a placeholder that reads fine.
2. **EMT-02-05-07 hyperventilation syndrome** is the highest-risk teaching point I wrote. It is framed as a diagnosis of exclusion with the paper bag explicitly ruled out. Check that framing against your source.
3. **EMT-02-05-08 epiglottitis** carries a never-examine-the-airway rule. Confirm the wording.
4. **Cricoid pressure** is taught as historical and "no longer routinely recommended". Confirm your text agrees.
5. **The `resp_compare_flow.svg` alt text is 998 characters against a 1000 cap.** Any edit to that diagram will overflow the schema. Either keep it short or raise the cap again.
6. **13 `related` links point at concepts in modules that do not exist yet** (Modules 01, 03, 04, 05, 09). Schema-valid forward references; they will resolve as those modules get built.
7. **Card numbers moved again.** The deck is renumbered on every merge until you freeze it. Do not print a deck and expect the numbers to match later.

**Not done, because nothing asked for it:** Modules 01 and 03–11 remain unbuilt, so the Ladder still reports "1 of 11 modules built" and EMT can never read as complete. `See It` exists but only four concepts have media. There is no worksheet generator, no full-length simulation, and no Anki/Quizlet export.
