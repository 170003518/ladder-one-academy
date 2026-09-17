# Overnight report 3

Batch 3, all six items. Everything below was committed and pushed as it was
finished, one commit per lesson for the two content modules.

---

## What was built

| Module | Lessons | Concepts | Questions | Cards |
|---|---|---|---|---|
| EMT-02 Airway, Respiration & Ventilation | 5 | 36 | 141 | 61 |
| EMT-03 Patient Assessment | 6 | 31 | 97 | 40 |
| EMT-04 Cardiology & Resuscitation | 4 | 28 | 88 | 42 |
| **EMT-05 Medical Emergencies** *(new)* | **10** | **40** | **221** | **63** |
| **EMT-06 Trauma** *(new)* | **9** | **50** | **297** | **75** |
| **Total** | **34** | **185** | **844** | **281** |

Card types across the whole deck: 184 concept, 31 skill, 27 compare, 22 numbers,
9 mnemonic, 4 algorithm, 4 drug.

Question styles: 389 recall, 305 application, 105 scenario, 42 sequence,
3 calculation.

Both new modules hit the requested shape exactly — Module 05 at 10 lessons and
40 concepts, Module 06 at 9 lessons and 50 concepts.

### Every card the batch asked for, and where it is

| Asked for | Where |
|---|---|
| Drug cards naming drug, class, indications, contraindications, route, doses left as "per protocol / verify" | Oral glucose (EMT-05-03-02), Epinephrine auto-injector (EMT-05-04-02), Naloxone (EMT-05-05-02), Activated charcoal (EMT-05-05-06) |
| Compare: hypo vs hyperglycemia | EMT-05-03-02 |
| Compare: stroke vs hypoglycemia | EMT-05-02-01 |
| Compare: allergic reaction vs anaphylaxis | EMT-05-04-01 |
| Mnemonic: AEIOU-TIPS | EMT-05-02-06 |
| Mnemonic: SLUDGEM | EMT-05-05-05 |
| Numbers: rule of nines, adult and pediatric | EMT-06-04-02 |
| Numbers: burn depth | EMT-06-04-01 |
| Compare: heat exhaustion vs heat stroke | EMT-06-09-01 |
| Compare: hypothermia stages | EMT-06-09-02 |
| Skill + sequence questions: tourniquet | EMT-06-02-02 |
| Skill + sequence questions: wound packing | EMT-06-02-03 |
| Skill + sequence questions: splinting | EMT-06-05-02 |
| Skill + sequence questions: pelvic binder | EMT-06-05-06 |

Seven further compare cards, six further skill cards, four algorithm cards and
seven further mnemonic cards were written where the material warranted them.

### Diagrams

Four new SVGs in `media/emt/06/`, all original:

- **rule_of_nines.svg** — adult and infant figures side by side, with **11 label
  coordinates** so the label-the-diagram worksheet places numbered pins on each
  body region and the answers are the percentages.
- **burn_depth_cross_section.svg** — three burns cutting to three depths through
  epidermis, dermis and subcutaneous tissue, with the depth and pain arrows
  drawn running in opposite directions.
- **tourniquet_placement.svg** — four panels: correct, over a joint, a second
  tourniquet above the first, and the two-condition tightening endpoint.
- **smr_decision_flow.svg** — the four selective criteria as a flowchart, with
  mechanism deliberately absent from the boxes.

### The Library

`#/library`, linked from the Ladder. One searchable index of 479 entries: 185
concepts, 281 cards, 9 mnemonics, 4 drugs. Every entry opens its lesson; card
entries also open their print view.

---

## Judgment calls

All of these are also logged in `docs/decisions.md`.

**Module 06 needed five concepts the blueprint does not list.** The batch asked
for 9 lessons and 50 concepts; the blueprint outline has 45 sub-items across
those 9 lessons. Rather than padding, the five were chosen where the batch's own
card requests implied a concept the outline had folded into a larger one:
tourniquet application and wound packing split out of "external bleeding
control", pelvic binder application split out of "pelvic fractures and pelvic
binder", plus helmet removal (a standard topic the outline omits) and trauma in
pregnancy (which the blueprint places nowhere — Module 07's obstetrics lesson
covers complications of pregnancy, not trauma to a pregnant patient).

**"Maximum three doses" was read as a count, not a dose.** The nitroglycerin fill
includes it, and no milligram figure appears anywhere in the module. The
head-injury contraindication states its reason — vasodilation worsening
intracranial bleeding — because a contraindication without its reason is not
studyable; it carries the same verify flag as everything else.

**The erectile dysfunction window is worded "24 to 48 hours depending on the
drug"** rather than picking one number, because it genuinely differs by agent and
the agent is not named.

**Labelled worksheets inline the SVG rather than using `<img>`.** The figures
print their own labels, and an `<img>` is opaque to the page stylesheet, so
numbered pins laid over one would sit next to the printed answers. Inlined,
every `<text>` and every `.lead` leader line is hidden and the worksheet's
numbers are the only writing left. Because an inlined SVG's `<style>` is
document-global and the figures use short generic class names, each rule is
rewritten at inline time to sit under `.ws-diagram--labelled`.

**Library search is plain multi-term substring matching.** Every term must
appear, so a second word narrows rather than widens. No stemming and no
fuzziness: for an index this size, predictable beats clever. Turning off the last
active filter chip re-enables them all rather than filtering to nothing.

**Two validator rules were relaxed as too strict.** A `related`/`prereqs`
reference into a *lesson* that has not been written yet is a deliberate forward
link, not a broken reference — only a miss inside a lesson that exists on disk is
an error. And `quiz.js` draws `min(pool_size, available)`, so a concept with
fewer questions than its `pool_size` degrades gracefully; that is thinness to
report, not a defect.

---

## Needs review

### Deliberate gaps — 23 concepts state a figure was withheld

Every one of these has a `verify_notes` saying so explicitly. Filling them is a
source-text job, not a guessing job.

- **COPD target saturation** (EMT-02-05-02) — left out at your instruction in
  batch 2 and still out.
- **All medication names, doses and puff counts** (EMT-02-05-10, and all seven
  concepts of EMT-04-02, and all seven of EMT-04-04) — protocol-specific.
- **Significant mechanism thresholds** — fall height, speed, intrusion
  (EMT-03-01-05, EMT-06-01-02) — these vary between trauma systems and are
  revised; local criteria govern.
- **Oral glucose dose and product** (EMT-05-03-02), **organophosphate antidotes**
  (EMT-05-05-05) — protocol-specific or outside EMT scope.
- **Intermediate paediatric rule-of-nines values** (EMT-06-04-02) — no clean rule
  exists between infant and adult, sources differ, and a confidently wrong figure
  for a seven-year-old is worse than an honest description. Adult and infant
  figures *are* stated and are standard curriculum values.
- **Burn centre referral criteria** (EMT-06-04-05) — set locally and by regional
  burn services.
- **Ventilation rate for signs of herniation** (EMT-06-06-02) — protocol-specific.

### Everything is still `verify: true`

Not one concept, question or card in any of the five modules has been reviewed
against a source text. Every `verify_notes` names what needs checking. The
practical consequence is unchanged and was confirmed in this sweep: with dev mode
off, a module exam for EMT-06 reports *"297 questions exist for this module but
are flagged verify: true, so none can be served."*

### Content points worth a second opinion when you review

- **Terminology around severe agitation** (EMT-05-08-03) is contested and varies
  between sources and jurisdictions. The concept says so; the clinical substance
  — that it is a medical emergency, that sudden quiet after struggling may be an
  arrest, that prone restraint kills — does not depend on the name.
- **The proportion of anaphylaxis presenting without skin findings**
  (EMT-05-04-01) is stated as "about a third" and flagged as approximate.
- **The golden hour** (EMT-06-01-04) is presented as a teaching construct rather
  than a biological threshold, which reflects current understanding but should be
  checked against your source's wording.
- **Three-sided chest seal taping** (EMT-06-07-03) is included as the fallback
  where only a plain occlusive dressing is available; some services no longer
  teach it. Check yours.
- **Pelvic stability assessment** (EMT-06-05-04) is described as once-only or
  not-at-all, because a number of services have stopped testing it entirely.
  Check yours.
- **Head-down positioning** is described as no longer routinely recommended in
  both hemorrhagic shock (EMT-06-02-05) and diving emergencies (EMT-06-09-04).

### Quiz pool thinness

94 concepts have fewer questions than their `pool_size` of 5 — most have 3 or 4.
Nothing breaks: `quiz.js` draws `min(pool_size, available)`. But a lesson check
on those concepts repeats the same small pool, which blunts it as a study tool.
Worth topping up before any of this is drilled seriously.

---

## Validation

`tools/validate.py` was moved into the repo this batch so the checks are
reproducible. It exits non-zero on any failure, so it is safe in front of a
commit.

```bash
python3 tools/validate.py
```

Per module it checks: every schema is itself legal; module, bank and deck
validate; concept ids unique; lesson references resolve; no orphans; prereqs and
related resolve; every question points at a real concept with exactly four
options and no rationale under ten characters; everything flagged verify with
notes where required; card ids unique and numbered 1..N with no gaps; card print
order follows concept order; declared card types exist and vice versa; every
declared type has matching `card_data`; every media file resolves on disk with
unique label ids.

**Result: all checks pass on all five modules.** 185 concepts, 844 questions,
281 cards.

Two things are reported as notes rather than failures, for the reasons given
above: 94 short quiz pools, and 8 forward links into lessons not yet written.

## Browser sweep

Served over http and driven in a real browser.

| Check | Result |
|---|---|
| Every concept × every declared mode | **1,141 views, 0 failures** |
| Every lesson entry point | 34 of 34 |
| Every lesson worksheet | 34 of 34 |
| Module overview, exam, deck, deck print (05 and 06) | 8 of 8 |
| Readiness, Library, Ladder | 3 of 3 |
| Print one card, sampled across all 7 card types | 21 of 21 |
| Every media file resolves and parses as SVG | 13 of 13 |
| Console errors and unhandled rejections during the sweep | **none** |

Interactive paths driven end to end: lesson check start → answer → confidence →
advance; module exam start → answer → confidence; deck select-all → study → flip
→ grade. All worked.

Labelled-diagram worksheets, checked for both pin count and answer leakage:

| Worksheet | Pins | Leaked label text |
|---|---|---|
| EMT-02-01 airway | 13 | 0 of 17 |
| EMT-04-01 heart | 8 | 0 |
| EMT-06-04 rule of nines | 11 | 0 of 33 |
| EMT-06-06 (unlabelled figure) | 0 — falls back correctly | — |

The verify bar was confirmed both ways: dev mode on serves the content behind a
banner, dev mode off bars all 297 EMT-06 questions from the module exam.

### Two false alarms in my own harness, for the record

A first pass reported the two print-deck screens as failures. They had rendered
fine — 66KB of content — and my "Not found" regex had matched the phrase *"Part
not found?"* inside the amputated-part card. Separately, a check for the dev
banner reported it still present after switching dev mode off; the banner was
gone from the DOM and the match was the footer's own "Dev mode: off" label. Both
were harness bugs, not app bugs, and both were re-tested with tighter checks
before anything was concluded.

### Two defects found and fixed

Both were pre-existing, found while validating rather than while writing:

- `EMT-03-05-01` (pulse) carried a "Normal vital signs by age" numbers card in
  the deck that the concept never declared in `cards[]` and had no `card_data`
  for. The card was right and the concept was incomplete; the concept now carries
  the figures, intermediate paediatric bands still deliberately blank.
- A card id (`EMT-04-02-08-C12`) had been written in a format the schema's id
  pattern rejects. Caught by validation before it reached a commit.
