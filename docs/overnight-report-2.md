# Overnight batch 2 — report

**Run:** 17 September 2026, autonomous.
**Branch:** `main`, pushed after each item.
**Status:** all seven items complete.

---

## 1. Where the repo stands

| | Before tonight | After |
|---|---|---|
| Modules built | 1 (Airway) | **3** — Airway, Patient Assessment, Cardiology & Resuscitation |
| Lessons | 5 | **15** |
| Concepts | 36 | **95** |
| Questions | 141 | **322** |
| Cards | 61 | **142** |
| Diagrams | 4 | **9** |
| App screens | Ladder, lesson, exam, deck, card print, deck print | **+ Module Overview, Worksheets, Exam Readiness** |

Everything remains `verify: true`. Nothing has been checked against a source text.

---

## 2. Item by item

**1 — Module 03 Patient Assessment** (6 commits, one per lesson). 31 concepts, 97 questions, 40 cards. Mnemonic cards for SAMPLE, OPQRST, DCAP-BTLS, AVPU and CTC. Skill cards plus `sequence` questions for the rapid full-body scan and blood glucose measurement. A Numbers card for normal vital signs by age.

**2 — Module 04 Cardiology & Resuscitation** (4 commits). 28 concepts, 84 questions, 41 cards. CPR depths, rates and ratios filled from current AHA guidelines as permitted. No medication doses anywhere.

**3 — Four diagrams.** `primary_assessment_flow.svg`, `heart_blood_flow.svg`, `chain_of_survival.svg`, `stages_of_shock.svg`, each registered in `media[]` with full alt text and added to `modes.see`.

**4 — Ladder and Module Overview.** "3 of 11 modules built" now comes from a blueprint-derived constant. Each module shows a completion ring and its lessons with their own rings. New `#/module/<id>` screen lists every concept with **eight mode dots**.

**5 — Worksheet generator v1.** `#/worksheet/<lessonId>[/<seed>]`. Fill-in-the-blank from `key_points`, label-the-diagram pages, answer key last, "new version" reshuffles.

**6 — Exam Readiness meter.** Score on the Ladder hero, breakdown at `#/readiness/emt` with a domain heat map and a focus list.

**7 — Validation and browser sweep.** This document.

---

## 3. Judgment calls

All logged in `docs/decisions.md` as they were made.

**The blueprint's own lesson listing for Module 03 gives 31 concepts, not the 32 its summary table quotes.** I built the 31 the per-lesson listing specifies and treated the table total as an approximation.

**Pediatric vital-sign ranges are deliberately incomplete.** Adult ranges, infant ranges and the `70 + (2 × age)` minimum systolic are given; the toddler, preschool, school-age and adolescent bands are explicitly left blank with a note saying where to get them. Those figures vary too much between texts for me to be confident, and a confidently wrong paediatric range is worse than an obvious gap.

**The readiness threshold is a placeholder and the screen says so.** §3.6 asks for a meter that "turns green when you're statistically ready". There is no statistics available — no outcome data exists to fit weights or a threshold against — so the breakdown screen leads with "This is not a validated prediction" rather than implying a pass probability.

**Coverage sits beside the readiness score and is never folded into it.** Three modules can produce a high score; presenting that as readiness for eleven would be a lie. The "ready" state additionally requires every module in the tier to exist.

**A readiness component with no data contributes nothing and its weight leaves the denominator** — otherwise the score would be dragged toward zero by full simulations, which are not built.

**Worksheet blanking is rule-based, not markup-based.** Priority: a figure with a unit, then a capitalised non-sentence-initial term, then the longest content word. The content carries no worksheet markup, which is why the same `key_points` can feed lessons, cards and worksheets without drifting.

**Worksheet label-the-diagram pages are honest about their limit.** They print the diagram with numbered write-on lines, but cannot place numbered pointers on the figure, because `media[]` carries no label coordinates. True per-label blanking needs a `labels` array with positions — a schema change I did not make for v1.

**Neck veins are the organising discriminator across the shock lesson.** Flat means volume loss and fluid helps; distended means pump failure or obstruction and fluid harms.

---

## 4. Numbers filled, and numbers deliberately not

**Filled** (from current AHA guidelines, as you permitted, each with `verify_notes` saying so):
compression rate 100–120/min at all ages; adult depth at least 2 in (5 cm) and no more than 2.4 in (6 cm); child about 2 in (5 cm), infant about 1.5 in (4 cm), or at least one third of chest depth; ratio 30:2 adult and single-rescuer paediatric, **15:2 two-rescuer child and infant**; interruptions under 10 s; compressor change about every 2 minutes; with an advanced airway, continuous compressions and 1 breath every 6 s.

Also filled where I was confident of the standard textbook value: adult pulse 60–100, respirations 12–20, systolic roughly 90–140; infant pulse 100–160, respirations 30–60; paediatric minimum systolic 70 + (2 × age); normal end-tidal CO2 35–45 mmHg.

**Not filled, by instruction or by caution:**
- Intermediate paediatric vital-sign bands (toddler through adolescent)
- Any COPD target saturation range
- All medication names, doses and puff counts — Module 04's aspirin and nitroglycerin concept teaches the procedure and names no dose
- Specific significant-mechanism thresholds (fall heights, collision speeds), which vary by trauma system
- Exact suction times were filled from your earlier instruction and remain flagged

---

## 5. Found and fixed during the run

- **A schema error briefly reached a commit.** A one-character `accept` keyword failed `minLength: 2`, but the validator printed "ALL CHECKS OK" because its summary line only reflected referential checks and ignored the schema result. Fixed in the data and in the validator, which now prints "** PROBLEMS **" when the schema rejects anything.
- **Bare `"Correct."` rationales** kept failing the 10-character minimum. The authoring helper now reports every offender in one pass before anything merges, rather than one per attempt.
- **Worksheets blanked sentence-initial words**, producing prompts that began with a rule and read badly. Excluded.
- **The merge tool was hardcoded to one module.** Generalised to create and validate any module.

---

## 6. Verified in the browser

- **601 mode renders across all 95 concepts** — every mode each concept declares. Zero failures, zero console errors. *(An initial sweep reported 14 failures in the first two concepts; re-testing with a longer wait showed all 14 render correctly. That was my test harness polling too fast at boot, not an app defect.)*
- **22 Do It activities** render the right widget for their config shape — 16 sorters, 6 choice sets.
- **All three module exams** start, score, store an attempt, write `question_history`, and show a review screen with all four rationales. A full 25-question Module 04 exam scored 80%, passed, with a CARD domain breakdown.
- **Deck** grades write SM-2 state; **deck print** for Module 03 produced 10 front and 10 back sheets with **zero card overflow** across 142 cards.
- **Worksheets** for three lessons: 23, 24 and 26 items, each with a matching answer key. Two versions blank different terms; re-entering a seed reproduces the sheet exactly.
- **Module Overview** for all three modules: correct lesson and concept counts, zero unresolved concepts, eight mode dots each with the right present/viewed/absent state.
- **Readiness meter** arithmetic checked by hand: 82(0.5) + 80(0.3) + 82(0.2) = 81, matching the display.
- **7 schemas legal draft 2020-12**; all nine content files validate; all referential checks pass; the live 1.1.0 progress record validates with zero errors.
- **13 of 13 skill concepts have a `sequence` question.** No declared card type is missing from any deck.

---

## 7. What needs your review

**The clinical content is the whole of the risk, and it has tripled.** 95 concepts, 322 questions and 142 cards, none checked against a source. Dev mode is on, which is what makes the app usable and also what makes studying unverified material possible by accident.

Priorities, roughly in order of consequence:

1. **Module 04's CPR numbers.** Filled from AHA guidelines at your instruction, and they are the figures most likely to have moved between editions. The 15:2 two-rescuer paediatric ratio is the one most often got wrong.
2. **EMT-04-02-08, assisting with nitroglycerin** — the erectile-dysfunction-medication contraindication. I have taught it as ask-every-patient-privately. Confirm the wording and your protocol's blood pressure thresholds.
3. **EMT-04-03-08, when not to start and when to stop.** DNR validity is jurisdiction-specific and I have deliberately not asserted what a valid one looks like where you are.
4. **The paediatric vital-sign gaps** in EMT-03-05's Numbers card — real holes in a lesson, not placeholders that read fine.
5. **A content defect in the EMT-02-01 draft you supplied.** Card `EMT-02-01-01-C02` is typed `mnemonic` and titled *"The tongue is the obstruction"*, but its parent concept's `card_data.mnemonic` is about the upper airway ending at the larynx, and tongue obstruction belongs to EMT-02-02-01. The card front and its own card data disagree. I have not touched it, because it is your content and the fix is a judgement about which one is right.
6. **`media[].alt` has no label coordinates**, so worksheets cannot do true label-the-diagram blanking. Adding a `labels` array to the media entry would unlock it.

**Not done, because nothing asked for it:** Modules 01 and 05–11 remain unbuilt. Full-length simulations do not exist, so that readiness component is always empty. There is no Anki/Quizlet export and no Fire or Paramedic content.
