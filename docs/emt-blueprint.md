# Ladder One Academy — Rung 1: EMT Concept Blueprint

*Phase 0 deliverable. This is the spine: every lesson, card, question, and worksheet in the EMT tier hangs off one of these concept IDs. Verify the module list against the current NREMT-EMT exam blueprint and National EMS Education Standards before writing content.*

---

## ID scheme

`EMT-MM-LL-CC`

- `EMT` = tier (later `FIRE`, `MEDIC`)
- `MM` = module (01–11)
- `LL` = lesson within module
- `CC` = concept within lesson

Example: `EMT-02-03-04` = EMT tier, Module 2 (Airway), Lesson 3 (Oxygen delivery), Concept 4 (Non-rebreather mask).

Every question, card, worksheet item, and media asset carries one primary concept ID and optional secondary IDs. Every concept carries a **NREMT domain tag** so exams can be weighted like the real thing.

### NREMT-EMT domain tags (approximate blueprint weights — verify current)
| Tag | Domain | Approx. weight |
|---|---|---|
| `AIR` | Airway, Respiration & Ventilation | 18–22% |
| `CARD` | Cardiology & Resuscitation | 20–24% |
| `TRAU` | Trauma | 14–18% |
| `MED` | Medical / Obstetrics / Gynecology | 27–31% |
| `OPS` | EMS Operations | 10–14% |

Preparatory, assessment, and pharmacology concepts get tagged with whichever domain they feed (assessment → mostly `MED`/`TRAU`, safety/legal → `OPS`).

---

## Concept spec — what each ID must contain

```json
{
  "id": "EMT-02-03-04",
  "title": "Non-rebreather mask",
  "domain": "AIR",
  "difficulty": 1,
  "prereqs": ["EMT-02-03-01"],
  "key_points": ["10–15 L/min", "Delivers ~90% O2", "Reservoir must be inflated before applying", "Use for adequate-breathing patient needing high-flow O2"],
  "misconceptions": ["Using NRB on an apneic patient (needs BVM)", "Applying with a deflated reservoir"],
  "exam_favorites": ["Flow rate", "Which patient gets NRB vs. nasal cannula vs. BVM"],
  "related": ["EMT-02-03-03", "EMT-02-04-01"],
  "modes": { "read": "...", "eli_new": "...", "see": ["nrb_diagram.svg"], "story": "...", "do": "select_device_scenario" },
  "cards": ["concept", "numbers"],
  "question_targets": { "recall": 3, "application": 3, "scenario": 2 },
  "reviewed_against": "AAOS Emergency Care 12e / AHA 2025",
  "reviewed_on": "2026-xx-xx"
}
```

---

## Module 01 — Preparatory & Foundations `(OPS/MED)`

**01-01 EMS systems**
- 01 History and levels of EMS providers (EMR, EMT, AEMT, Paramedic)
- 02 Components of an EMS system; medical direction (online/offline)
- 03 Roles and responsibilities of the EMT; professionalism
- 04 Quality improvement, research, evidence-based practice
- 05 Public health role of EMS

**01-02 Workforce safety and wellness**
- 01 Standard precautions and PPE selection
- 02 Infectious disease transmission and exposure reporting
- 03 Scene safety mindset; violent scenes; hazards
- 04 Stress, critical incident stress, resilience
- 05 Lifting mechanics and injury prevention
- 06 Sleep, nutrition, fitness for duty

**01-03 Medical, legal, and ethical issues**
- 01 Scope of practice vs. standard of care
- 02 Consent: expressed, implied, minors, involuntary
- 03 Refusal of care and documentation
- 04 Negligence: the four elements; abandonment
- 05 Confidentiality and HIPAA
- 06 Advance directives, DNR, POLST
- 07 Mandatory reporting; crime scene preservation
- 08 Good Samaritan and immunity concepts

**01-04 Communications and documentation**
- 01 Radio systems, repeaters, etiquette
- 02 The radio report and hospital notification (format)
- 03 Verbal handoff (SBAR/MIST style)
- 04 Therapeutic communication; special communication needs
- 05 Patient care report components and legal weight
- 06 Documentation errors and corrections; falsification

**01-05 Medical terminology**
- 01 Word roots, prefixes, suffixes
- 02 Directional and positional terms
- 03 Body planes, regions, cavities
- 04 Common abbreviations and the "do not use" list

**01-06 Anatomy and physiology**
- 01 Skeletal system overview
- 02 Muscular system overview
- 03 Respiratory system: structures and mechanics
- 04 Circulatory system: heart, vessels, blood
- 05 Nervous system: CNS, PNS, autonomic
- 06 Integumentary system
- 07 Digestive system
- 08 Endocrine system
- 09 Urinary and reproductive systems
- 10 Lymphatic and immune systems

**01-07 Pathophysiology basics**
- 01 Cellular metabolism and oxygenation
- 02 Perfusion and the Fick principle (simplified)
- 03 Shock as a perfusion failure (introductory)
- 04 Respiratory failure basics
- 05 Acid–base basics (EMT level)

**01-08 Lifespan development**
- 01 Neonate and infant norms
- 02 Toddler and preschool norms
- 03 School-age and adolescent norms
- 04 Early, middle, late adulthood; geriatric physiology

---

## Module 02 — Airway, Respiration & Ventilation `(AIR)`

**02-01 Airway anatomy and physiology**
- 01 Upper vs. lower airway structures
- 02 Pediatric airway differences
- 03 Ventilation vs. respiration vs. oxygenation
- 04 Normal breathing: rate, depth, effort by age
- 05 Signs of adequate vs. inadequate breathing

**02-02 Opening and maintaining the airway**
- 01 Head-tilt/chin-lift
- 02 Jaw-thrust (when and why)
- 03 Recovery position
- 04 Oropharyngeal airway: sizing, insertion, contraindication
- 05 Nasopharyngeal airway: sizing, insertion, contraindication
- 06 Suctioning: devices, time limits, technique
- 07 Foreign body airway obstruction management by age

**02-03 Oxygen delivery**
- 01 Oxygen cylinders, regulators, safety, duration calc
- 02 Nasal cannula: flow and concentration
- 03 Non-rebreather mask: flow and concentration
- 04 Partial rebreather, Venturi, humidified O2 (awareness)
- 05 Pulse oximetry: use and limitations
- 06 Oxygen targets and when NOT to over-oxygenate

**02-04 Ventilation**
- 01 Bag-valve-mask: one- vs. two-rescuer technique
- 02 Ventilation rates by age and situation
- 03 Signs of adequate artificial ventilation
- 04 Cricoid pressure (historical) and gastric distention
- 05 CPAP: indications, contraindications, setup
- 06 Assisting a patient with inadequate breathing (breathing but poorly)
- 07 Stoma and tracheostomy ventilation
- 08 Capnography basics at the EMT level

**02-05 Respiratory emergencies**
- 01 Asthma
- 02 COPD (emphysema, chronic bronchitis)
- 03 Pneumonia
- 04 Pulmonary edema / CHF (respiratory presentation)
- 05 Pulmonary embolism
- 06 Spontaneous pneumothorax
- 07 Hyperventilation syndrome
- 08 Epiglottitis and croup (peds)
- 09 Pertussis, RSV, influenza, COVID (awareness)
- 10 Assisting with MDI and small-volume nebulizer

---

## Module 03 — Patient Assessment `(MED/TRAU)`

**03-01 Scene size-up**
- 01 Scene safety
- 02 Standard precautions determination
- 03 Nature of illness vs. mechanism of injury
- 04 Number of patients; additional resources
- 05 Significant vs. non-significant MOI

**03-02 Primary assessment**
- 01 General impression
- 02 Level of consciousness: AVPU, GCS intro
- 03 Airway assessment
- 04 Breathing assessment
- 05 Circulation: pulse, bleeding, skin (CTC)
- 06 Transport priority decision
- 07 XABC vs. ABC (life-threatening hemorrhage first)

**03-03 History taking**
- 01 SAMPLE
- 02 OPQRST
- 03 Chief complaint vs. primary problem
- 04 Interviewing techniques and difficult histories

**03-04 Secondary assessment**
- 01 Rapid full-body scan (trauma)
- 02 Focused assessment (medical)
- 03 DCAP-BTLS
- 04 Head-to-toe detailed exam
- 05 Assessing the unresponsive medical patient

**03-05 Vital signs**
- 01 Pulse: rate, rhythm, quality; normal ranges by age
- 02 Respirations: rate, quality; normal ranges by age
- 03 Blood pressure: auscultation, palpation, normal ranges by age
- 04 Pupils: PERRL and abnormal findings
- 05 Skin: color, temperature, condition
- 06 Pulse oximetry and capnography as vitals
- 07 Blood glucose measurement
- 08 Temperature

**03-06 Reassessment**
- 01 Reassessment intervals (stable vs. unstable)
- 02 Trending vitals and recognizing deterioration

---

## Module 04 — Cardiology & Resuscitation `(CARD)`

**04-01 Cardiovascular review**
- 01 Cardiac anatomy and blood flow
- 02 Electrical conduction system
- 03 Cardiac output, stroke volume, preload/afterload (simplified)
- 04 Coronary circulation

**04-02 Cardiac emergencies**
- 01 Acute coronary syndrome: angina vs. MI
- 02 Atypical presentations (women, diabetics, elderly)
- 03 Heart failure (cardiac presentation)
- 04 Cardiogenic shock
- 05 Hypertensive emergency
- 06 Aortic aneurysm/dissection (recognition)
- 07 Cardiac arrest causes; sudden cardiac death
- 08 Aspirin and nitroglycerin: assist protocol (links to Module 09)

**04-03 CPR and AED**
- 01 Chain of survival
- 02 Adult CPR: compressions, ratio, depth, rate
- 03 Child and infant CPR differences
- 04 AED: operation, pad placement, special situations
- 05 High-performance CPR / pit-crew concepts
- 06 Mechanical CPR devices (awareness)
- 07 Return of spontaneous circulation: post-arrest care
- 08 When to stop resuscitation; DNR in arrest
- 09 Special resuscitation situations: drowning, hypothermia, pregnancy, trauma

**04-04 Shock (perfusion)**
- 01 Shock definition and stages (compensated/decompensated/irreversible)
- 02 Hypovolemic shock
- 03 Cardiogenic shock
- 04 Distributive: septic, anaphylactic, neurogenic
- 05 Obstructive: tension pneumothorax, tamponade, PE
- 06 Assessment findings by stage
- 07 EMT management of shock

---

## Module 05 — Medical Emergencies `(MED)`

**05-01 Medical overview**
- 01 Approach to the medical patient
- 02 Common medical chief complaints

**05-02 Neurologic**
- 01 Stroke: ischemic vs. hemorrhagic; TIA
- 02 Stroke scales (Cincinnati, FAST, BE-FAST); last-known-well
- 03 Seizures: types, status epilepticus, postictal care
- 04 Syncope
- 05 Headache red flags
- 06 Altered mental status differential (AEIOU-TIPS)

**05-03 Endocrine**
- 01 Diabetes physiology: insulin, glucose
- 02 Hypoglycemia: presentation and treatment (oral glucose)
- 03 Hyperglycemia, DKA, HHS
- 04 Thyroid and adrenal emergencies (awareness)

**05-04 Allergic reactions and anaphylaxis**
- 01 Allergic reaction vs. anaphylaxis
- 02 Anaphylaxis recognition and epinephrine auto-injector
- 03 Common allergens; biphasic reactions

**05-05 Toxicology**
- 01 Routes of exposure
- 02 Opioids and naloxone
- 03 Stimulants, sedatives, alcohol
- 04 Carbon monoxide and cyanide
- 05 Organophosphates (SLUDGEM/DUMBELS)
- 06 Poison control and activated charcoal (where applicable)
- 07 Toxidromes overview

**05-06 Abdominal and gastrointestinal**
- 01 Abdominal pain assessment; referred pain
- 02 Peritonitis, appendicitis, bowel obstruction
- 03 GI bleeding
- 04 Cholecystitis, pancreatitis (awareness)
- 05 Esophageal varices; dialysis patients

**05-07 Genitourinary and renal**
- 01 Kidney stones, UTI, urinary retention
- 02 Renal failure and dialysis emergencies

**05-08 Psychiatric and behavioral**
- 01 Behavioral emergency assessment; safety
- 02 Suicide risk assessment
- 03 Agitation and excited delirium concepts; restraint principles
- 04 Legal aspects of psychiatric transport

**05-09 Hematology, immunology, infectious disease**
- 01 Sickle cell crisis
- 02 Anticoagulated patients; hemophilia
- 03 Sepsis recognition
- 04 Common infectious diseases and precautions

**05-10 Gynecologic**
- 01 Vaginal bleeding; ectopic pregnancy
- 02 Sexual assault: care and evidence preservation
- 03 PID and other gynecologic pain

---

## Module 06 — Trauma `(TRAU)`

**06-01 Trauma overview**
- 01 Kinematics: blunt vs. penetrating
- 02 Mechanism-based index of suspicion
- 03 Trauma triage and destination (trauma center criteria)
- 04 Golden period and platinum ten minutes

**06-02 Bleeding**
- 01 External bleeding control: direct pressure, tourniquet, hemostatic gauze, wound packing
- 02 Internal bleeding recognition
- 03 Hemorrhagic shock (links to 04-04)
- 04 Epistaxis

**06-03 Soft tissue injuries**
- 01 Closed injuries: contusion, hematoma, crush
- 02 Open injuries: abrasion, laceration, avulsion, amputation, impaled objects
- 03 Dressing and bandaging principles
- 04 Amputated part care

**06-04 Burns**
- 01 Burn depth classification
- 02 Rule of nines / palm method; adult vs. peds
- 03 Thermal, chemical, electrical, radiation burns
- 04 Airway burns and inhalation injury
- 05 Burn management and transport criteria

**06-05 Musculoskeletal**
- 01 Fractures, dislocations, sprains, strains
- 02 Splinting principles and types
- 03 Traction splint: indication and contraindication
- 04 Pelvic fractures and pelvic binder
- 05 Compartment syndrome; neurovascular checks (PMS/CSM)

**06-06 Head, face, neck, spine**
- 01 Skull fractures and scalp wounds
- 02 Traumatic brain injury; Cushing triad; herniation signs
- 03 Concussion
- 04 Eye, ear, nose, dental injuries
- 05 Neck injuries; open neck wounds
- 06 Spinal motion restriction: current guidelines and selective criteria
- 07 Neurogenic shock

**06-07 Chest and abdomen**
- 01 Rib fractures and flail chest
- 02 Pneumothorax and tension pneumothorax
- 03 Open chest wound: vented chest seal
- 04 Hemothorax, cardiac tamponade
- 05 Abdominal trauma; evisceration
- 06 Commotio cordis

**06-08 Multi-system trauma**
- 01 Prioritizing injuries
- 02 Rapid extrication decision
- 03 Blast injuries

**06-09 Environmental**
- 01 Heat exhaustion vs. heat stroke
- 02 Hypothermia (stages) and frostbite
- 03 Drowning
- 04 Diving emergencies (awareness)
- 05 Bites and stings; envenomation
- 06 Lightning
- 07 High-altitude illness (awareness)

---

## Module 07 — Special Populations `(MED)`

**07-01 Obstetrics**
- 01 Pregnancy anatomy and physiology changes
- 02 Complications: preeclampsia, eclampsia, placenta previa, abruption
- 03 Stages of labor; imminent delivery signs
- 04 Normal delivery steps
- 05 Abnormal deliveries: breech, prolapsed cord, nuchal cord, shoulder dystocia
- 06 Postpartum hemorrhage

**07-02 Neonatal care**
- 01 Initial newborn care; APGAR
- 02 Neonatal resuscitation triangle (warm, dry, stimulate → ventilate → compress)
- 03 Premature infants

**07-03 Pediatrics**
- 01 Pediatric assessment triangle
- 02 Developmental approach by age
- 03 Pediatric vitals and airway differences (links)
- 04 Respiratory distress vs. failure vs. arrest in kids
- 05 Pediatric shock
- 06 Fever, seizures, dehydration
- 07 Child abuse and neglect recognition
- 08 SIDS/BRUE
- 09 Pediatric trauma considerations

**07-04 Geriatrics**
- 01 Physiologic changes of aging
- 02 Polypharmacy
- 03 Falls and trauma in the elderly
- 04 Elder abuse
- 05 Dementia vs. delirium; communication

**07-05 Patients with special challenges**
- 01 Physical, sensory, developmental disabilities
- 02 Bariatric patients
- 03 Home-care and technology-dependent patients (trach, vent, feeding tubes, LVAD)
- 04 Hospice and palliative care patients

---

## Module 08 — EMS Operations `(OPS)`

**08-01 Ambulance operations**
- 01 Phases of an ambulance call
- 02 Vehicle inspection and equipment
- 03 Emergency driving, lights and sirens, due regard
- 04 Air medical: when to call, landing zone safety
- 05 Cleaning and decontamination

**08-02 Lifting and moving**
- 01 Body mechanics
- 02 Emergency, urgent, non-urgent moves
- 03 Equipment: stretcher, stair chair, scoop, backboard, vacuum mattress
- 04 Bariatric moving

**08-03 Gaining access and extrication**
- 01 Vehicle safety: airbags, power, stabilization
- 02 Roles of EMS at an extrication
- 03 Simple vs. complex access

**08-04 Incident management**
- 01 ICS/NIMS structure and EMT's role
- 02 Multiple-casualty incidents
- 03 Triage: START and JumpSTART
- 04 Triage tags and treatment areas

**08-05 Hazardous materials**
- 01 Recognizing hazmat: placards, ERG, NFPA 704
- 02 Zones: hot, warm, cold
- 03 Decontamination and EMS role at awareness level

**08-06 Terrorism and disaster response**
- 01 CBRNE agents overview
- 02 Active shooter / tactical EMS concepts (rescue task force, warm zone care)
- 03 Personal safety and secondary devices

---

## Module 09 — Pharmacology (EMT scope) `(MED/CARD)`

**09-01 Pharmacology principles**
- 01 Drug names: generic vs. trade
- 02 Routes of administration and onset
- 03 Forms of medication
- 04 Indications, contraindications, side effects, dosing
- 05 The six rights of medication administration
- 06 Medical direction for medication assist

**09-02 EMT medications (one concept each)**
- 01 Oxygen
- 02 Oral glucose
- 03 Aspirin
- 04 Epinephrine auto-injector
- 05 Naloxone
- 06 Nitroglycerin (assist)
- 07 Metered-dose inhaler (assist)
- 08 Small-volume nebulizer (assist, where applicable)
- 09 Activated charcoal (where applicable)
- 10 Acetaminophen / ibuprofen (where applicable by protocol)

**09-03 Drug math (EMT level)**
- 01 Oxygen duration calculation
- 02 Pediatric weight-based epinephrine dosing
- 03 Reading a drug label

---

## Module 10 — Psychomotor Skills `(all)`

Each skill is a checklist concept with steps, critical criteria, and common fail points.

- 10-01 Patient assessment: medical
- 10-02 Patient assessment: trauma
- 10-03 BVM ventilation of an apneic adult
- 10-04 Oxygen administration by NRB
- 10-05 Cardiac arrest management / AED
- 10-06 Spinal motion restriction: supine and seated
- 10-07 Bleeding control and shock management
- 10-08 Long-bone immobilization
- 10-09 Joint immobilization
- 10-10 Traction splinting
- 10-11 Oropharyngeal and nasopharyngeal airway insertion; suctioning
- 10-12 Supplemental oxygen setup
- 10-13 Childbirth (simulated)
- 10-14 Vital signs measurement
- 10-15 Medication administration: assist and administer

---

## Module 11 — Exam Prep `(all)`

- 11-01 How the NREMT computer-adaptive test works
- 11-02 Question anatomy: stem, distractors, "best" vs. "correct"
- 11-03 Strategy: scene safety first, ABCs, least invasive, follow protocols
- 11-04 Common traps: absolutes, assuming ALS resources, skipping reassessment
- 11-05 Time management and mindset
- 11-06 Full-length simulation 1
- 11-07 Full-length simulation 2
- 11-08 Adaptive simulation
- 11-09 Readiness review and weak-spot plan

---

## Blueprint totals

| Module | Lessons | Concepts (approx.) |
|---|---|---|
| 01 Preparatory | 8 | 46 |
| 02 Airway | 5 | 36 |
| 03 Assessment | 6 | 32 |
| 04 Cardiology | 4 | 28 |
| 05 Medical | 10 | 40 |
| 06 Trauma | 9 | 50 |
| 07 Special populations | 5 | 27 |
| 08 Operations | 6 | 21 |
| 09 Pharmacology | 3 | 19 |
| 10 Skills | 15 | 15 |
| 11 Exam prep | 9 | 9 |
| **Total** | **80** | **~323** |

At ~8 questions per concept that lands near the 2,500-question EMT bank target. At ~2 cards per concept that yields ~650 curated note cards for the tier.

---

## What comes next

1. Approve or edit this blueprint (add, remove, merge concepts).
2. Write the JSON schemas for concept, question, card, worksheet, and progress.
3. Draft the brand kit file.
4. Start Phase 1 content with Module 02 (Airway) — highest exam weight per concept and the module where the "8 modes" idea is easiest to prove out.
