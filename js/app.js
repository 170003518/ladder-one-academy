/* ==========================================================================
   app.js — router and state. The shell loads this and nothing else.
   Hash routing so the site stays a pile of static files: no server rewrites,
   which is what Cloudflare Pages wants anyway.

   Routes
     #/                      the Ladder (home)
     #/lesson/:conceptId      lesson view, first available mode
     #/lesson/:conceptId/:mode
   Anything else falls back to the Ladder.
   ========================================================================== */

import * as progress from './progress.js';
import { renderLadder } from './ladder.js';
import { renderLesson, markViewed, modesFor } from './lesson.js';
import * as quiz from './quiz.js';
import * as exam from './exam.js';
import * as sim from './simulation.js';
import { renderPrintCard } from './print.js';
import { pickDo, resetDo } from './interact.js';
import * as hear from './hear.js';
import * as teach from './teach.js';
import * as see from './see.js';
import * as sort from './sort.js';
import * as deckprint from './deckprint.js';
import * as deck from './deck.js';
import { renderOverview } from './overview.js';
import { buildWorksheet, renderWorksheetView, newSeed } from './worksheet.js';
import { renderReadiness } from './readiness.js';
import { buildIndex, renderLibrary, KINDS } from './library.js';

/* Every content file the app knows about. The Ladder reports "N of 11 modules
   built" from the length of the module list. Question banks are loaded lazily —
   a bank dwarfs its module and is only needed when a check starts. */
const MODULE_FILES = {
  emt:   ['content/emt/01-preparatory.json', 'content/emt/02-airway.json', 'content/emt/03-assessment.json', 'content/emt/04-cardiology.json',
          'content/emt/05-medical.json', 'content/emt/06-trauma.json',
          'content/emt/07-special-populations.json',
          'content/emt/08-ems-operations.json',
          'content/emt/09-pharmacology.json',
          'content/emt/10-psychomotor-skills.json',
          'content/emt/11-exam-prep.json'],
  fire:  [],
  medic: []
};
const QUESTION_FILES = {
  'EMT-01': 'content/emt/questions/01-preparatory.json',
  'EMT-02': 'content/emt/questions/02-airway.json',
  'EMT-03': 'content/emt/questions/03-assessment.json',
  'EMT-04': 'content/emt/questions/04-cardiology.json',
  'EMT-05': 'content/emt/questions/05-medical.json',
  'EMT-06': 'content/emt/questions/06-trauma.json',
  'EMT-07': 'content/emt/questions/07-special-populations.json',
  'EMT-08': 'content/emt/questions/08-ems-operations.json',
  'EMT-09': 'content/emt/questions/09-pharmacology.json',
  'EMT-10': 'content/emt/questions/10-psychomotor-skills.json'
};
const CARD_FILES = {
  'EMT-01': 'content/emt/cards/01-preparatory.json',
  'EMT-02': 'content/emt/cards/02-airway.json',
  'EMT-03': 'content/emt/cards/03-assessment.json',
  'EMT-04': 'content/emt/cards/04-cardiology.json',
  'EMT-05': 'content/emt/cards/05-medical.json',
  'EMT-06': 'content/emt/cards/06-trauma.json',
  'EMT-07': 'content/emt/cards/07-special-populations.json',
  'EMT-08': 'content/emt/cards/08-ems-operations.json',
  'EMT-09': 'content/emt/cards/09-pharmacology.json',
  'EMT-10': 'content/emt/cards/10-psychomotor-skills.json'
};

const app = {
  el: null,
  modulesByTier: { emt: [], fire: [], medic: [] },
  questionsByModule: {},
  decksByModule: {},
  cardsByTier: { emt: [], fire: [], medic: [] },
  libraryIndex: null,
  loadError: null,
  depth: 'plain'
};

/* --- Content -------------------------------------------------------------- */

function fetchFailMessage(path, err) {
  return location.protocol === 'file:'
    ? 'The app is open from a file:// path, so the browser blocks loading content. Serve the folder over http instead — see "Running locally" in CLAUDE.md.'
    : `Could not read ${path} — ${err.message}`;
}

async function loadContent() {
  for (const [tier, files] of Object.entries(MODULE_FILES)) {
    const mods = [];
    for (const path of files) {
      try {
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        mods.push(await res.json());
      } catch (err) {
        app.loadError = fetchFailMessage(path, err);
        console.error('[l1a]', err);
      }
    }
    mods.sort((a, b) => a.number - b.number);
    app.modulesByTier[tier] = mods;
  }
  // Card retention feeds the readiness meter on the home screen, so every built
  // module's deck is loaded at boot rather than on demand.
  for (const [tier, mods] of Object.entries(app.modulesByTier)) {
    const all = [];
    for (const m of mods) all.push(...((await loadDeck(m.id)).cards || []));
    app.cardsByTier[tier] = all;
  }
}

/** Lazily pull a module's question bank. Returns [] if there is not one. */
async function loadQuestions(moduleId) {
  if (app.questionsByModule[moduleId]) return app.questionsByModule[moduleId];
  const path = QUESTION_FILES[moduleId];
  if (!path) return (app.questionsByModule[moduleId] = []);
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const bank = await res.json();
    app.questionsByModule[moduleId] = bank.questions || [];
  } catch (err) {
    console.error('[l1a] question bank:', err);
    app.questionsByModule[moduleId] = [];
  }
  return app.questionsByModule[moduleId];
}

/** Every EMT module's bank, concatenated. The simulation draws across all of them. */
async function loadAllQuestions(tierKey = 'emt') {
  const mods = app.modulesByTier[tierKey] || [];
  const banks = await Promise.all(mods.map(m => loadQuestions(m.id)));
  return banks.flat();
}

/** Lazily pull a module's card deck. */
async function loadDeck(moduleId) {
  if (app.decksByModule[moduleId]) return app.decksByModule[moduleId];
  const path = CARD_FILES[moduleId];
  if (!path) return (app.decksByModule[moduleId] = { cards: [] });
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    app.decksByModule[moduleId] = await res.json();
  } catch (err) {
    console.error('[l1a] card deck:', err);
    app.decksByModule[moduleId] = { cards: [] };
  }
  return app.decksByModule[moduleId];
}

/* --- Lookup --------------------------------------------------------------- */

function findModule(moduleId) {
  for (const mods of Object.values(app.modulesByTier)) {
    const m = mods.find(x => x.id === moduleId);
    if (m) return m;
  }
  return null;
}

function notFound(what) {
  return `<section class="stub"><h1>Not found</h1><p>${what}</p>
    <p><a class="back" href="#/">Back to the Ladder</a></p></section>`;
}

function findConcept(conceptId) {
  for (const mods of Object.values(app.modulesByTier)) {
    for (const mod of mods) {
      const concept = mod.concepts.find(c => c.id === conceptId);
      if (concept) {
        const lesson = mod.lessons.find(l => l.concepts.includes(conceptId));
        if (lesson) return { module: mod, lesson, concept };
      }
    }
  }
  return null;
}

/* --- Router --------------------------------------------------------------- */

let ctx = null;

async function route() {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  // Nothing should keep talking after the view changes.
  hear.abandon();
  if (ctx?.kind === 'deck' && parts[0] !== 'deck') deck.abandon();
  // A running simulation is dropped the moment you navigate off it. Leaving the
  // timer running behind another screen would quietly time out a paper nobody
  // is sitting any more.
  if (parts[0] !== 'sim') sim.abandon();

  if (parts[0] === 'exam' && parts[1]) {
    const mod = findModule(decodeURIComponent(parts[1]));
    if (!mod) { ctx = null; app.el.innerHTML = notFound('No loaded module has that id.'); return done(); }
    quiz.abandon();
    const questions = await loadQuestions(mod.id);
    ctx = { kind: 'exam', module: mod, questions };
    app.el.innerHTML = shell(exam.renderExam(mod, questions));
    return done();
  }

  if (parts[0] === 'test') {
    exam.abandon(); quiz.abandon(); sim.abandon();
    const mods = app.modulesByTier.emt || [];
    const banks = await Promise.all(mods.map(m => loadQuestions(m.id)));
    const counts = {};
    mods.forEach((m, i) => { counts[m.id] = banks[i].length; });
    ctx = { kind: 'testcenter', modules: mods, counts };
    app.el.innerHTML = shell(sim.renderTestCenter(mods, counts));
    return done();
  }

  if (parts[0] === 'sim' && (parts[1] === 'full' || parts[1] === 'adaptive')) {
    exam.abandon(); quiz.abandon();
    const kind = parts[1];
    // Leaving a running simulation for the other mode throws it away; coming
    // back to the same one mid-run keeps it, so a stray re-render is survivable.
    if (sim.isRunning() && sim.mode() !== kind) sim.abandon();
    const questions = await loadAllQuestions('emt');
    ctx = { kind: 'sim', simMode: kind, questions };
    app.el.innerHTML = shell(sim.renderSim(kind, questions));
    return done();
  }

  if (parts[0] === 'library') {
    exam.abandon(); quiz.abandon();
    // The index is built once from everything already loaded at boot, then
    // filtered in place — retyping a search should not re-walk the content.
    if (!app.libraryIndex) {
      const mods = Object.values(app.modulesByTier).flat();
      app.libraryIndex = buildIndex(mods, app.decksByModule);
    }
    ctx = { kind: 'library', query: '', kinds: new Set(KINDS), limit: 60 };
    app.el.innerHTML = shell(renderLibrary(app.libraryIndex, ctx));
    return done();
  }

  if (parts[0] === 'readiness') {
    exam.abandon(); quiz.abandon(); sim.abandon();
    ctx = { kind: 'readiness' };
    app.el.innerHTML = shell(renderReadiness(app.modulesByTier.emt, app.cardsByTier.emt));
    return done();
  }

  if (parts[0] === 'worksheet' && parts[1]) {
    exam.abandon(); quiz.abandon();
    const lessonId = decodeURIComponent(parts[1]);
    let mod = null, lesson = null;
    for (const mods of Object.values(app.modulesByTier)) {
      for (const m of mods) {
        const l = m.lessons.find(x => x.id === lessonId);
        if (l) { mod = m; lesson = l; break; }
      }
      if (lesson) break;
    }
    const seed = parts[2] ? Number(decodeURIComponent(parts[2])) : newSeed();
    const sheet = (mod && lesson) ? await buildWorksheet(mod, lesson, seed) : { items: [], diagrams: [], seed };
    ctx = { kind: 'worksheet', module: mod, lesson, sheet };
    app.el.innerHTML = shell(renderWorksheetView(mod, lesson, sheet));
    return done();
  }

  if (parts[0] === 'module' && parts[1]) {
    exam.abandon(); quiz.abandon();
    const moduleId = decodeURIComponent(parts[1]);
    const mod = findModule(moduleId);
    const questions = await loadQuestions(moduleId);
    ctx = { kind: 'overview', module: mod, questions };
    app.el.innerHTML = shell(renderOverview(mod, questions));
    return done();
  }

  if (parts[0] === 'deck') {
    exam.abandon(); quiz.abandon();
    const moduleId = parts[1] ? decodeURIComponent(parts[1]) : 'EMT-02';
    const mod = findModule(moduleId);
    const d = await loadDeck(moduleId);
    ctx = { kind: 'deck', module: mod, deck: d };
    app.el.innerHTML = shell(deck.renderDeck(mod, d));
    return done();
  }

  if (parts[0] === 'print' && parts[1] === 'deck') {
    exam.abandon(); quiz.abandon();
    const moduleId = parts[2] ? decodeURIComponent(parts[2]) : 'EMT-02';
    const mod = findModule(moduleId);
    const deck = await loadDeck(moduleId);
    deckprint.setModule(moduleId);
    ctx = { kind: 'deckprint', module: mod, deck };
    app.el.innerHTML = shell(deckprint.renderDeckPrint(mod, deck));
    return done();
  }

  if (parts[0] === 'print' && parts[1]) {
    exam.abandon(); quiz.abandon();
    const first = decodeURIComponent(parts[1]);
    // #/print/<moduleId> opens the first card; #/print/card/<cardId> opens one.
    let deck, card;
    if (first === 'card' && parts[2]) {
      const cardId = decodeURIComponent(parts[2]);
      const moduleId = cardId.slice(0, cardId.indexOf('-', cardId.indexOf('-') + 1));
      deck = await loadDeck(moduleId);
      card = (deck.cards || []).find(c => c.id === cardId);
    } else {
      deck = await loadDeck(first);
      card = (deck.cards || [])[0];
    }
    ctx = { kind: 'print' };
    app.el.innerHTML = shell(renderPrintCard(card, deck));
    return done();
  }

  if (parts[0] === 'lesson' && parts[1]) {
    const conceptId = decodeURIComponent(parts[1]);
    const found = findConcept(conceptId);
    if (!found) {
      ctx = null;
      app.el.innerHTML = `<section class="stub"><h1>Not found</h1>
        <p>No loaded concept has the id <code>${conceptId.replace(/[<>&]/g, '')}</code>.</p>
        <p><a class="back" href="#/">Back to the Ladder</a></p></section>`;
      return done();
    }
    exam.abandon();
    const questions = await loadQuestions(found.module.id);
    // The Quiz tab appears only when something can actually be served — the
    // verify bar applies here exactly as it does in an exam. modesFor() is the
    // single source of truth, shared with the renderer.
    const modes = modesFor(found.concept, found.lesson, questions);
    const wanted = parts[2];
    const mode = modes.includes(wanted) ? wanted : (modes[0] || 'read');

    // Keep a running check alive only when we are staying in the same lesson AND
    // still on the Quiz tab. Anything else — a different lesson, a different
    // mode, or arriving from the exam or print route where ctx has no lesson at
    // all — throws it away rather than letting it silently resume later.
    if (ctx?.kind !== 'lesson' || ctx.lesson.id !== found.lesson.id || mode !== 'quiz') quiz.abandon();

    // Switching concept clears a Teach It Back attempt; switching mode does not,
    // so tabbing away and back does not throw away what was written.
    if (ctx?.kind === 'lesson' && ctx.concept.id !== found.concept.id) {
      teach.reset(ctx.concept.id);
      sort.reset(ctx.concept.id);
    }
    see.closeZoom();

    ctx = { kind: 'lesson', ...found, mode, depth: app.depth, questions };
    app.el.innerHTML = shell(renderLesson(ctx));
    return done();
  }

  quiz.abandon();
  exam.abandon();
  sim.abandon();
  ctx = null;
  app.el.innerHTML = shell(renderLadder(progress.load(), {
    modulesByTier: app.modulesByTier,
    cardsByTier: app.cardsByTier,
    loadError: app.loadError
  }));
  done();
}

/* Dev mode gets a banner on every screen. Unverified content is barred
   everywhere by default; if it is coming through, that has to be impossible
   to miss. */
function shell(html) {
  const banner = progress.devMode()
    ? `<div class="devbanner" role="status">DEV MODE — unverified content is being served. Nothing here is study material.</div>`
    : '';
  return banner + html;
}

function done() {
  app.el.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

/* The simulation clock ticks once a second. Re-rendering the whole view that
   often would be wasteful and would fight the confidence buttons, so only the
   clock element is touched — unless the run has ended, which only the two-hour
   limit can do on its own, and that needs the full screen. */
function simClockText(r) {
  const sec = r.mode === 'full'
    ? Math.max(0, Math.floor((r.deadline - Date.now()) / 1000))
    : r.elapsed;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

function onSimTick(r) {
  if (r.stage !== 'question') return refresh();
  const el = document.getElementById('sim-clock');
  if (!el) return;
  el.textContent = simClockText(r);
  if (r.mode === 'full' && (r.deadline - Date.now()) <= 5 * 60 * 1000) el.classList.add('is-low');
}

function examClock() {
  const el = document.getElementById('exam-clock');
  return el ? el.textContent : '';
}

/** Re-render the current view in place, without touching the hash. */
function refresh() {
  if (!ctx) return route();
  if (ctx.kind === 'exam') { app.el.innerHTML = shell(exam.renderExam(ctx.module, ctx.questions)); return; }
  if (ctx.kind === 'sim') { app.el.innerHTML = shell(sim.renderSim(ctx.simMode, ctx.questions)); return; }
  if (ctx.kind === 'testcenter') { app.el.innerHTML = shell(sim.renderTestCenter(ctx.modules, ctx.counts)); return; }
  if (ctx.kind === 'print') return route();
  if (ctx.kind === 'library') { app.el.innerHTML = shell(renderLibrary(app.libraryIndex, ctx)); return; }
  if (ctx.kind === 'readiness') { app.el.innerHTML = shell(renderReadiness(app.modulesByTier.emt, app.cardsByTier.emt)); return; }
  if (ctx.kind === 'worksheet') { app.el.innerHTML = shell(renderWorksheetView(ctx.module, ctx.lesson, ctx.sheet)); return; }
  if (ctx.kind === 'overview') { app.el.innerHTML = shell(renderOverview(ctx.module, ctx.questions)); return; }
  if (ctx.kind === 'deck') { app.el.innerHTML = shell(deck.renderDeck(ctx.module, ctx.deck)); return; }
  if (ctx.kind === 'deckprint') { app.el.innerHTML = shell(deckprint.renderDeckPrint(ctx.module, ctx.deck)); return; }
  ctx.depth = app.depth;
  app.el.innerHTML = shell(renderLesson(ctx));
}

/* --- Events --------------------------------------------------------------- */

function say(message, isError) {
  const el = document.getElementById('say');
  if (!el) return;
  el.textContent = message;
  el.className = isError ? 'say say--error' : 'say';
  clearTimeout(say._t);
  say._t = setTimeout(() => { el.textContent = ''; el.className = 'say'; }, 6000);
}

function wire() {
  /* Everything inside <main> is re-rendered constantly, so all of it is
     delegated from the container rather than bound to elements. */
  app.el.addEventListener('click', async ev => {
    const t = ev.target.closest('[data-depth], #mark-viewed, #quiz-start, [data-answer], [data-confidence], #quiz-again, '
      + '#exam-start, [data-exam-answer], [data-exam-confidence], #exam-review, #review-prev, #review-next, #review-back, #do-print, '
      + '[data-sim-start], [data-sim-answer], [data-sim-confidence], #sim-review, '
      + '[data-do-pick], #do-reset, #hear-play, #hear-stop, #teach-submit, #teach-again, '
      + '[data-see-zoom], #see-close, [data-sort-item], [data-sort-bucket], [data-sort-unplace], #sort-check, #sort-reset, '
      + '#ws-new, #deck-all, #deck-none, #deck-study, #deck-study-all, #deck-flip, [data-grade], #deck-stop, #deck-back, '
      + '.lib-chip, #lib-more');
    if (!t) return;

    // Library: the filter chips and the show-more button re-render in place,
    // then the search box is refocused with the caret where it was.
    if (ctx?.kind === 'library' && (t.classList.contains('lib-chip') || t.id === 'lib-more')) {
      if (t.id === 'lib-more') ctx.limit += 60;
      else {
        const k = t.dataset.kind;
        if (ctx.kinds.has(k)) ctx.kinds.delete(k); else ctx.kinds.add(k);
        if (!ctx.kinds.size) KINDS.forEach(x => ctx.kinds.add(x));  // never filter to nothing
        ctx.limit = 60;
      }
      refresh();
      const box = document.getElementById('lib-q');
      if (box) { box.focus(); box.setSelectionRange(box.value.length, box.value.length); }
      return;
    }

    if (t.dataset.depth) { app.depth = t.dataset.depth; return refresh(); }

    if (t.id === 'mark-viewed') {
      markViewed(ctx.concept.id, t.dataset.mode);
      say(`Marked viewed in ${t.dataset.mode}.`);
      return refresh();
    }

    if (t.id === 'quiz-start' || t.id === 'quiz-again') {
      quiz.abandon();
      quiz.start(ctx);
      quiz.setLessonConcepts(ctx.lesson.concepts);
      return refresh();
    }

    if (t.dataset.answer !== undefined) { quiz.answer(Number(t.dataset.answer)); return refresh(); }

    if (t.dataset.confidence) {
      quiz.tag(t.dataset.confidence);
      return refresh();
    }

    /* --- Full simulation and adaptive practice --- */
    if (t.dataset.simStart !== undefined) {
      if (t.dataset.simStart === 'adaptive') sim.startAdaptive(ctx.questions, onSimTick);
      else sim.startFull(ctx.questions, Number(t.dataset.simStart), onSimTick);
      return refresh();
    }
    if (t.dataset.simAnswer !== undefined) { sim.choose(Number(t.dataset.simAnswer)); return refresh(); }
    if (t.dataset.simConfidence) { sim.tagAndAdvance(t.dataset.simConfidence); return refresh(); }
    if (t.id === 'sim-review') { sim.toReview(); return refresh(); }

    /* --- Module exam --- */
    if (t.id === 'exam-start') {
      exam.abandon();
      // The clock ticks without a full re-render; repainting the paper every
      // second would fight the radio buttons and lose scroll position.
      exam.start(ctx.module, ctx.questions, () => {
        const el = document.getElementById('exam-clock');
        if (el) el.textContent = examClock();
      });
      return refresh();
    }
    if (t.dataset.examAnswer !== undefined) { exam.choose(Number(t.dataset.examAnswer)); return refresh(); }
    if (t.dataset.examConfidence) { exam.tagAndAdvance(t.dataset.examConfidence); return refresh(); }
    if (t.id === 'exam-review') { exam.toReview(); return refresh(); }
    // The review nav is shared by the module exam and the simulation; which one
    // it drives is decided by the view you are in, not by a second set of ids.
    const reviewer = ctx?.kind === 'sim' ? sim : exam;
    if (t.id === 'review-back') { reviewer.toResult(); return refresh(); }
    if (t.id === 'review-prev') { reviewer.reviewGo(-1); return refresh(); }
    if (t.id === 'review-next') { reviewer.reviewGo(1); return refresh(); }

    if (t.id === 'do-print') { window.print(); return; }

    /* --- Worksheet --- */
    if (t.id === 'ws-new') {
      const seed = newSeed();
      ctx.sheet = await buildWorksheet(ctx.module, ctx.lesson, seed);
      // The seed goes in the hash so a printed sheet can be regenerated exactly.
      history.replaceState(null, '', `#/worksheet/${encodeURIComponent(ctx.lesson.id)}/${seed}`);
      return refresh();
    }

    /* --- Do It --- */
    if (t.dataset.doPick) {
      const [item, choice] = t.dataset.doPick.split(':').map(Number);
      pickDo(ctx.concept.id, item, choice);
      return refresh();
    }
    if (t.id === 'do-reset') { resetDo(ctx.concept.id); return refresh(); }

    /* --- Hear It ---
       Speech controls deliberately do NOT re-render: replacing innerHTML
       mid-utterance would drop the highlighted paragraph while it kept talking.
       hear.js paints the highlight into the existing DOM itself. */
    if (t.id === 'hear-play') { hear.toggle(ctx.concept); return; }
    if (t.id === 'hear-stop') { hear.stop(); return; }

    /* --- Teach It Back --- */
    if (t.id === 'teach-submit') {
      const box = document.getElementById('teach-answer');
      teach.submit(ctx.concept, box ? box.value : '');
      return refresh();
    }
    if (t.id === 'teach-again') { teach.reset(ctx.concept.id); return refresh(); }

    /* --- See It --- */
    if (t.dataset.seeZoom) { see.zoom(ctx.concept.id, t.dataset.seeZoom); return refresh(); }
    if (t.id === 'see-close') { see.closeZoom(); return refresh(); }

    /* --- Do It: sort into buckets --- */
    if (t.dataset.sortItem !== undefined) { sort.select(ctx.concept.id, Number(t.dataset.sortItem)); return refresh(); }
    if (t.dataset.sortUnplace !== undefined) { sort.unplace(ctx.concept.id, Number(t.dataset.sortUnplace)); return refresh(); }
    if (t.dataset.sortBucket !== undefined) { sort.drop(ctx.concept.id, Number(t.dataset.sortBucket)); return refresh(); }
    if (t.id === 'sort-check') { sort.check(ctx.concept.id); return refresh(); }
    if (t.id === 'sort-reset') { sort.reset(ctx.concept.id); return refresh(); }

    /* --- Deck print --- */
    if (t.id === 'deck-all')  { deckprint.selectAll(ctx.deck.cards || []); return refresh(); }
    if (t.id === 'deck-none') { deckprint.selectNone(); return refresh(); }

    /* --- SRS deck --- */
    if (t.id === 'deck-study')     { deck.start(ctx.deck, 'due'); return refresh(); }
    if (t.id === 'deck-study-all') { deck.start(ctx.deck, 'all'); return refresh(); }
    if (t.id === 'deck-flip')      { deck.flip(); return refresh(); }
    if (t.dataset.grade)           { deck.rate(t.dataset.grade); return refresh(); }
    if (t.id === 'deck-stop' || t.id === 'deck-back') { deck.abandon(); return refresh(); }
  });

  /* Drag and drop is the desktop path into the same sort functions the taps use.
     dragstart carries the item index; a bucket accepts the drop. Touch never
     fires these, which is why tap-then-tap exists. */
  app.el.addEventListener('dragstart', ev => {
    const item = ev.target.closest?.('[data-sort-item]');
    if (!item) return;
    ev.dataTransfer.setData('text/plain', item.dataset.sortItem);
    ev.dataTransfer.effectAllowed = 'move';
  });
  app.el.addEventListener('dragover', ev => {
    if (ev.target.closest?.('[data-sort-bucket]')) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; }
  });
  app.el.addEventListener('drop', ev => {
    const bucket = ev.target.closest?.('[data-sort-bucket]');
    if (!bucket) return;
    ev.preventDefault();
    const idx = Number(ev.dataTransfer.getData('text/plain'));
    if (Number.isInteger(idx)) { sort.drop(ctx.concept.id, Number(bucket.dataset.sortBucket), idx); refresh(); }
  });

  app.el.addEventListener('input', ev => {
    if (ev.target?.id === 'hear-rate') hear.setRate(ev.target.value);

    if (ev.target?.id === 'lib-q' && ctx?.kind === 'library') {
      const caret = ev.target.selectionStart;
      ctx.query = ev.target.value;
      ctx.limit = 60;
      refresh();
      const box = document.getElementById('lib-q');
      if (box) { box.focus(); box.setSelectionRange(caret, caret); }
    }
  });

  app.el.addEventListener('change', ev => {
    const el = ev.target;
    if (el?.dataset?.deckScope)  { deckprint.setScope(el.dataset.deckScope); return refresh(); }
    if (el?.dataset?.deckMode)   { deckprint.setMode(el.dataset.deckMode); return refresh(); }
    if (el?.id === 'deck-lesson'){ deckprint.setLesson(el.value); return refresh(); }
    if (el?.dataset?.deckCard)   { deckprint.toggleCard(el.dataset.deckCard); return refresh(); }

    const tierKey = el?.dataset?.attest;
    if (!tierKey) return;
    progress.setAttested(tierKey, ev.target.checked);
    const name = tierKey === 'fire' ? 'Fire' : 'Paramedic';
    say(ev.target.checked ? `${name} unlocked by self-attestation.` : `${name} locked again.`);
    route();
  });

  document.getElementById('export').addEventListener('click', () => {
    progress.exportFile();
    say('Progress exported.');
  });

  const file = document.getElementById('import-file');
  document.getElementById('import').addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    try {
      const result = progress.importJSON(await f.text());
      say(result.message, !result.ok);
      if (result.ok) route();
    } catch (err) {
      say('That file could not be read.', true);
      console.error('[l1a]', err);
    }
    file.value = '';
  });

  const devBtn = document.getElementById('devmode');
  const paintDev = () => {
    const on = progress.devMode();
    devBtn.setAttribute('aria-pressed', String(on));
    devBtn.textContent = on ? 'Dev mode: on' : 'Dev mode: off';
  };
  devBtn.addEventListener('click', () => {
    const on = progress.setDevMode(!progress.devMode());
    paintDev();
    say(on
      ? 'Dev mode on — unverified content will be served.'
      : 'Dev mode off — unverified content is barred again.');
    route();
  });
  paintDev();

  document.getElementById('reset').addEventListener('click', () => {
    if (!confirm('Clear all progress on this device? Export first if you want a backup.')) return;
    progress.reset();
    quiz.abandon();
    say('Progress cleared.');
    route();
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && ctx?.kind === 'lesson' && see.isZoomed(ctx.concept.id)) {
      see.closeZoom();
      refresh();
    }
  });

  window.addEventListener('hashchange', route);
}

/* --- Boot ----------------------------------------------------------------- */

async function boot() {
  app.el = document.getElementById('main');
  app.el.innerHTML = '<p class="loading">Loading…</p>';
  progress.load();

  // ?dev=1 / ?dev=0 flips the flag and drops out of the URL, so a link can turn
  // it on without anyone having to open devtools.
  const q = new URLSearchParams(location.search);
  if (q.has('dev')) {
    progress.setDevMode(q.get('dev') !== '0' && q.get('dev') !== 'false');
    q.delete('dev');
    const rest = q.toString();
    history.replaceState(null, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  }
  await loadContent();
  wire();
  await route();
}

boot();
