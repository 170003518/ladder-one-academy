# Overnight report 4

Nine items, all nine done, 27 commits, every one pushed. Every content file
validates; the app was swept twice, 2,044 views each time, once with dev mode on
and once off.

This report is written to be read by somebody deciding what to trust. The
"needs review" section is the important one.

---

## 1 · What was asked, and what landed

| # | Asked for | Landed | Where |
|---|---|---|---|
| 1 | Module 01 Preparatory, 8 lessons / 46 concepts | **8 / 46**, 265 questions, 58 cards | `2c3a672`…`790219e` |
| 2 | Module 07 Special Populations, 5 / 27 | **5 / 27**, 162 questions, 37 cards | `d359a9a`…`56eec43` |
| 3 | Module 08 EMS Operations, 6 / 21 | **6 / 21**, 126 questions, 28 cards | `7d1cbc6`…`e6a7171` |
| 4 | Module 09 Pharmacology, 3 / 19 | **3 / 19**, 114 questions, 28 cards | `9c22f64`…`c231394` |
| 5 | Module 10 skills (15) and Module 11 exam prep | **15 skill concepts; 9 exam-prep concepts** | `8343e57`, `91fcd42` |
| 6 | Every concept to ≥5 questions | **160 questions added** across Modules 02–05 | `9ee5ab2` |
| 7 | Full simulation + adaptive mode, wired to readiness | **Built, tuned and browser-verified** | `aa2432a` |
| 8 | Five diagrams | **Five original SVGs, attached and rendering** | `43361a1` |
| 9 | Validation, sweep, this report | **Below** | this commit |

### The EMT tier, complete

| Module | Title | Lessons | Concepts | Questions | Cards |
|---|---|---|---|---|---|
| EMT-01 | Preparatory & Foundations | 8 | 46 | 265 | 58 |
| EMT-02 | Airway, Respiration & Ventilation | 5 | 36 | 183 | 61 |
| EMT-03 | Patient Assessment | 6 | 31 | 155 | 40 |
| EMT-04 | Cardiology & Resuscitation | 4 | 28 | 143 | 42 |
| EMT-05 | Medical Emergencies | 10 | 40 | 227 | 63 |
| EMT-06 | Trauma | 9 | 50 | 297 | 75 |
| EMT-07 | Special Populations | 5 | 27 | 162 | 37 |
| EMT-08 | EMS Operations | 6 | 21 | 126 | 28 |
| EMT-09 | Pharmacology | 3 | 19 | 114 | 28 |
| EMT-10 | Psychomotor Skills | 3 | 15 | 90 | 30 |
| EMT-11 | Exam Preparation | 1 | 9 | 0 | 0 |
| **Total** | | **60** | **322** | **1,762** | **462** |

Card types across the tier: 312 concept, 55 skill, 37 compare, 27 numbers,
13 mnemonic, 12 drug, 6 algorithm.

**All 322 concepts carry `verify: true`.** Nothing in this platform has been
reviewed against a source text, and the app withholds every flagged question
from every question context unless dev mode is on. That is the rule working as
designed, not a gap to close by relaxing it.

---

## 2 · Every card the batch specifically asked for

| Asked for | Card | Concept |
|---|---|---|
| Mnemonic: four elements of negligence | "The four Ds" | EMT-01-03-04 |
| Mnemonic: consent types | "E-I-M-I" | EMT-01-03-02 |
| Numbers: lifespan vital signs, **by reference not duplicated** | referenced to EMT-03-05-01 | EMT-01-08-01 |
| Numbers: APGAR | "APGAR" | EMT-07-02-01 |
| Numbers: paediatric assessment triangle | "The triangle at a glance" | EMT-07-03-03 |
| Skill + sequence: normal delivery | "Normal delivery" | EMT-07-01-04 |
| Skill + sequence: neonatal resuscitation | "Neonatal resuscitation" | EMT-07-02-02 |
| Algorithm: START | "START" | EMT-08-04-03 |
| Algorithm: JumpSTART | "JumpSTART" | EMT-08-04-04 |
| Compare: hazmat zones | "Hot zone vs warm zone" | EMT-08-05-02 |
| Mnemonic: ERG use | "YBOG" | EMT-08-05-01 |
| Drug card per EMT medication, doses "per protocol / verify" | 8 drug cards | EMT-09-02-01…08 |
| Numbers: the six rights | "The six rights" | EMT-09-01-05 |
| Oxygen duration, **linked not duplicated** | links to EMT-02-03-01 | EMT-09-02-01 |
| Paediatric epinephrine, **linked not duplicated** | links to Module 05 | EMT-09-02-05 |
| 15 skill concepts, each with a critical-step skill card and ≥2 sequence questions | 15 skill cards, 30 sequence questions | EMT-10-01-01…10-03-05 |

Every dose field on every drug card in the tier — all twelve cards, including
the four written into Module 05 in batch 3 — either reads `per protocol /
verify` or states that no paediatric dose applies at EMT level. **No medication
dose appears anywhere in this batch**, and a grep for a numeric dose across all
twelve cards returns nothing.

Note the deliberate overlap: Module 05 carries drug cards on the clinical
concepts where those medications are used (oral glucose, epinephrine, naloxone,
activated charcoal), and Module 09 carries the complete pharmacology set of
eight. They are not duplicates of each other — one is reached while learning the
emergency, the other while learning the drug.

---

## 3 · Judgment calls

All are logged in `docs/decisions.md` with the reasoning. The ones worth reading
before trusting anything downstream:

**Module 11 has no question bank or card deck at all.** Its concepts are
read-only by design and its placeholders are signposts, so there was nothing to
put in either file — and both schemas require a non-empty array. Rather than
invent questions nobody asked for or weaken a schema doing useful work
everywhere else, Module 11 has neither file and is absent from `QUESTION_FILES`
and `CARD_FILES`. Consequence: **Module 11 has no module exam and contributes
nothing to the full simulation.** That is correct — it is a guide to the exam,
not content the exam tests.

**"Servable" was read as "of the kind that gets served."** The literal
`isServable()` predicate withholds every `verify: true` question, and the
standing instruction has been `verify: true` everywhere — so under the literal
reading no question in the platform is servable and item 6's target would be
unreachable. The operative target is the quiz pool (`pool_size` 5), and every
concept that has a pool now has at least five questions.

**The readiness meter gained a fourth component and the weights were
rebalanced** (exams 50→40, retention 30→25, simulations 20, adaptive 15). An
adaptive run's percentage correct converges toward chance-of-being-right for
everyone, so it could not be recorded as a score. It contributes an ability
estimate instead, taken from the **most recent** run rather than the best,
because the best measurement you ever produced is not a measurement of anything.

**The hazmat compare card covers two of three zones in its columns.** The
compare schema is strictly two-column and there are three zones; hot and warm are
set against each other across the rows that actually get confused, and the final
row uses both cells to describe the cold zone. The full three-zone picture is in
the concept and the concept card.

**The ERG mnemonic is an authoring device.** There is no standard published
mnemonic for guidebook use. YBOG maps the book's own real colour sections; the
acronym is ours.

**The concept schema gained an optional `pointer` field** so Module 11's three
placeholders could actually link to the Test Center. Concept prose is escaped on
render and `related` only takes concept ids, so the alternative was
string-matching titles in the UI.

---

## 4 · Needs review

### 4.1 Figures deliberately withheld

Seventeen concepts state in their `verify_notes` that a figure was withheld
rather than guessed. Each needs a reviewer with the source text to fill it in:

EMT-01-08-01 (paediatric vital ranges, referenced out), EMT-02-05-02 (COPD
target saturation), EMT-03-01-05 and EMT-06-01-02 (significant-mechanism
thresholds), EMT-05-03-02 (oral glucose dose), EMT-05-05-05 (organophosphate
antidotes), EMT-05-08-04, EMT-06-04-02 (intermediate paediatric rule-of-nines
values), EMT-06-04-05 (burn centre criteria), EMT-06-06-02 (herniation
ventilation rate), EMT-07-03-02/03/04/05/09 (paediatric vital ranges and
mechanism thresholds), EMT-08-01-05 (landing zone dimensions), EMT-09-02-01
(oxygen targets and cylinder duration, referenced out).

### 4.2 Figures that ARE stated and must be checked first

These are the ones a reader could act on, so they are the priority:

- **START**: rate above 30, capillary refill over 2 seconds, follow-commands.
- **JumpSTART**: rate below 15 or above 45, five rescue breaths, AVPU.
- **Neonatal resuscitation**: ventilate below 100, compressions below 60 after
  30 seconds of effective ventilation, 3:1 ratio. Resuscitation guidance is
  revised on a cycle and these must be checked against the current edition.
- **Span of control**: three to seven.
- **Nitroglycerin contraindications**: carried in EMT-04-02-08 from batch 3 with
  its own verify note.

### 4.3 Things that are simplifications, stated as such in the app

- The **adaptive engine** is a one-parameter model treating every item as equally
  discriminating, with difficulty taken from the 1–5 number already on the
  question. The intro screen says so. It is not calibrated against outcome data,
  because none exists.
- The **readiness threshold of 85** remains a placeholder, as it was before this
  batch. The screen still says so.
- **Skill sheets vary** between programmes and testing bodies. Every Module 10
  concept carries a verify note saying to check the step list, the critical
  criteria and the failure criteria against the sheet the reader's own programme
  uses.
- **Exam format details** in Module 11 — length, retake intervals, attempt
  limits, identification requirements — are deliberately described in general
  terms and deferred to the current official handbook.

### 4.4 A defect found and fixed, worth knowing about

The four Module 06 diagrams shipped in batch 3 had a `media[]` manifest entry
but were never listed in `modes.see`. `see.js` renders nothing that is not in
both, so **those four figures had never appeared in the app at all** — they were
reachable only through the worksheet generator, which reads `media[]` directly.
Fixed for all nine concepts that carry media. If anything else was attached the
same way in an earlier batch, this is the failure mode to look for.

---

## 5 · Validation

`tools/validate.py` over all eleven modules: **ALL CHECKS OK.**

It checks schema legality against draft 2020-12 with `additionalProperties:
false`; id uniqueness; that every lesson's concept references resolve; orphaned
concepts; prereq and related resolution; exactly four options per question;
rationale length on all four; universal verify flags; contiguous card numbering;
card order following concept order; declared-versus-present card types;
`card_data` presence for every declared type; media resolution and label id
uniqueness; and quiz pool adequacy.

Notes (not failures) remaining: a small number of forward `related` links into
modules written later in the batch, which now all resolve.

---

## 6 · Browser sweep

Served over http on a local server, driven through the real UI.

**2,044 distinct views**, each checked for the not-found render, an empty main
element, and any console error, uncaught exception or unhandled rejection. The
sweep covers every concept in every mode it declares, every module overview,
every module exam intro, every deck and print-deck, every worksheet, the
library, the Test Center, both simulation screens and the readiness meter.

Run twice — **once with dev mode on and once with it off**, because those are
different code paths and the off state is what a real user sees.

| Run | Views | Failures | Console errors |
|---|---|---|---|
| Dev mode ON | 2,044 | 0 | 0 |
| Dev mode OFF | 2,044 | 0 | 0 |

With dev mode off, the module exams, the full simulation and adaptive practice
all render the "no questions available" screen explaining that unverified
content is barred — which is correct behaviour, not a failure.

### The simulation, exercised rather than inspected

- A 70-question full simulation drew MED 21, CARD 16, AIR 14, TRAU 11, OPS 8 —
  the domain weighting to within a question. Scoring, the domain breakdown, the
  attempt record and the rationale review all behaved.
- The adaptive engine was tuned against synthetic responders driven through the
  real UI. The first constants sent a 75%-correct responder to the ceiling in 20
  items and gave a 50% responder anything between 1.7 and 4.3. The shipped
  constants put a 50% responder at **2.67–3.33** across four runs, a 25%
  responder at **1.84**, and an 85% responder at **4.06–4.39**.
- Both attempt types reach the readiness meter: a run of each produced a score of
  87 with the simulation row at 83% and the adaptive row showing ability 4.2 ±
  0.37 over 30 items.

### Diagram rendering

All five new SVGs were rendered and inspected. Three needed layout fixes before
they were right: a clipped final line in the paediatric assessment triangle, and
two colliding boxes plus a note overlapping a decision diamond in the START
flow.

---

## 7 · What this batch did not do

- **Nothing was verified against a source text.** Every concept, question and
  card is still `verify: true`. This batch added content and features; it did not
  add review.
- **No FIRE or MEDIC content.** The EMT tier is now complete in structure; the
  other two rungs are untouched.
- **The readiness threshold is still a guess.** Wiring the simulation in gives
  the meter better inputs; it does not make the number a prediction.
- **Module 11's placeholders are signposts, not content.** That was the
  instruction, and they say so plainly on the screen.
