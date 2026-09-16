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
import { renderLesson, markViewed, availableModes } from './lesson.js';
import * as quiz from './quiz.js';

/* Every content file the app knows about. The Ladder reports "N of 11 modules
   built" from the length of the module list. Question banks are loaded lazily —
   a bank dwarfs its module and is only needed when a check starts. */
const MODULE_FILES = {
  emt:   ['content/emt/02-airway.json'],
  fire:  [],
  medic: []
};
const QUESTION_FILES = { 'EMT-02': 'content/emt/questions/02-airway.json' };

const app = {
  el: null,
  modulesByTier: { emt: [], fire: [], medic: [] },
  questionsByModule: {},
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

/* --- Lookup --------------------------------------------------------------- */

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
    const questions = await loadQuestions(found.module.id);
    const modes = availableModes(found.concept, questions.some(q => !q.retired && found.lesson.concepts.includes(q.concept_id)));
    const wanted = parts[2];
    const mode = modes.includes(wanted) ? wanted : (modes[0] || 'read');

    // Leaving the lesson, or switching away from Quiz, throws away a running
    // check rather than letting it silently resume later.
    if (ctx && (ctx.lesson.id !== found.lesson.id || mode !== 'quiz')) quiz.abandon();

    ctx = { ...found, mode, depth: app.depth, questions };
    app.el.innerHTML = renderLesson(ctx);
    return done();
  }

  quiz.abandon();
  ctx = null;
  app.el.innerHTML = renderLadder(progress.load(), {
    modulesByTier: app.modulesByTier,
    loadError: app.loadError
  });
  done();
}

function done() {
  app.el.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

/** Re-render the current view in place, without touching the hash. */
function refresh() {
  if (!ctx) return route();
  ctx.depth = app.depth;
  app.el.innerHTML = renderLesson(ctx);
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
    const t = ev.target.closest('[data-depth], #mark-viewed, #quiz-start, [data-answer], [data-confidence], #quiz-again');
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
  await loadContent();
  wire();
  await route();
}

boot();
