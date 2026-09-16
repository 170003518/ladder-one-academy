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
import { renderPrintCard } from './print.js';
import { pickDo, resetDo } from './interact.js';
import * as hear from './hear.js';
import * as teach from './teach.js';

/* Every content file the app knows about. The Ladder reports "N of 11 modules
   built" from the length of the module list. Question banks are loaded lazily —
   a bank dwarfs its module and is only needed when a check starts. */
const MODULE_FILES = {
  emt:   ['content/emt/02-airway.json'],
  fire:  [],
  medic: []
};
const QUESTION_FILES = { 'EMT-02': 'content/emt/questions/02-airway.json' };
const CARD_FILES     = { 'EMT-02': 'content/emt/cards/02-airway.json' };

const app = {
  el: null,
  modulesByTier: { emt: [], fire: [], medic: [] },
  questionsByModule: {},
  decksByModule: {},
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

  if (parts[0] === 'exam' && parts[1]) {
    const mod = findModule(decodeURIComponent(parts[1]));
    if (!mod) { ctx = null; app.el.innerHTML = notFound('No loaded module has that id.'); return done(); }
    quiz.abandon();
    const questions = await loadQuestions(mod.id);
    ctx = { kind: 'exam', module: mod, questions };
    app.el.innerHTML = shell(exam.renderExam(mod, questions));
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
    if (ctx?.kind === 'lesson' && ctx.concept.id !== found.concept.id) teach.reset(ctx.concept.id);

    ctx = { kind: 'lesson', ...found, mode, depth: app.depth, questions };
    app.el.innerHTML = shell(renderLesson(ctx));
    return done();
  }

  quiz.abandon();
  exam.abandon();
  ctx = null;
  app.el.innerHTML = shell(renderLadder(progress.load(), {
    modulesByTier: app.modulesByTier,
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

function examClock() {
  const el = document.getElementById('exam-clock');
  return el ? el.textContent : '';
}

/** Re-render the current view in place, without touching the hash. */
function refresh() {
  if (!ctx) return route();
  if (ctx.kind === 'exam') { app.el.innerHTML = shell(exam.renderExam(ctx.module, ctx.questions)); return; }
  if (ctx.kind === 'print') return route();
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
  app.el.addEventListener('click', ev => {
    const t = ev.target.closest('[data-depth], #mark-viewed, #quiz-start, [data-answer], [data-confidence], #quiz-again, '
      + '#exam-start, [data-exam-answer], [data-exam-confidence], #exam-review, #review-prev, #review-next, #review-back, #do-print, '
      + '[data-do-pick], #do-reset, #hear-play, #hear-stop, #teach-submit, #teach-again');
    if (!t) return;

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
    if (t.id === 'review-back') { exam.toResult(); return refresh(); }
    if (t.id === 'review-prev') { exam.reviewGo(-1); return refresh(); }
    if (t.id === 'review-next') { exam.reviewGo(1); return refresh(); }

    if (t.id === 'do-print') { window.print(); return; }

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
  });

  app.el.addEventListener('input', ev => {
    if (ev.target?.id === 'hear-rate') hear.setRate(ev.target.value);
  });

  app.el.addEventListener('change', ev => {
    const tierKey = ev.target?.dataset?.attest;
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
