/* ==========================================================================
   app.js — router and state. The shell loads this and nothing else.
   Hash routing so the site stays a pile of static files: no server rewrites,
   which is what Cloudflare Pages wants anyway.

   Routes
     #/            the Ladder (home)
     #/lesson/:id  lesson view — not built yet, Phase 1 step 3
   Anything else falls back to the Ladder.
   ========================================================================== */

import * as progress from './progress.js';
import { renderLadder, nextIncomplete } from './ladder.js';

/* Every module file the app knows about. One entry per built module; the
   Ladder reports "N of 11 modules built" from the length of this list. */
const MODULE_FILES = {
  emt:   ['content/emt/02-airway.json'],
  fire:  [],
  medic: []
};

const app = {
  el: null,
  modulesByTier: { emt: [], fire: [], medic: [] },
  loadError: null
};

/* --- Content -------------------------------------------------------------- */

async function loadContent() {
  for (const [tier, files] of Object.entries(MODULE_FILES)) {
    const mods = [];
    for (const path of files) {
      try {
        const res = await fetch(path, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const mod = await res.json();
        mods.push(mod);
      } catch (err) {
        // file:// has no origin, so fetch is blocked outright. Say so plainly
        // rather than leaving a blank screen.
        app.loadError = location.protocol === 'file:'
          ? 'The app is open from a file:// path, so the browser blocks loading content. Serve the folder over http instead — see the README line in the terminal.'
          : `Could not read ${path} — ${err.message}`;
        console.error('[l1a]', err);
      }
    }
    mods.sort((a, b) => a.number - b.number);
    app.modulesByTier[tier] = mods;
  }
}

/* --- Views ---------------------------------------------------------------- */

function lessonStub(conceptId) {
  const state = progress.load();
  const mods = app.modulesByTier.emt;
  let found = null;
  for (const mod of mods) {
    const concept = mod.concepts.find(c => c.id === conceptId);
    if (concept) {
      const lesson = mod.lessons.find(l => l.concepts.includes(conceptId));
      found = { mod, lesson, concept };
      break;
    }
  }
  if (!found) {
    return `<section class="stub"><h1>Not found</h1>
      <p>No concept with the id <code>${conceptId.replace(/[<>&]/g, '')}</code> is loaded.</p>
      <p><a class="back" href="#/">Back to the Ladder</a></p></section>`;
  }
  const { mod, lesson, concept } = found;
  return `
  <section class="stub tier-emt">
    <p class="crumb">${mod.short_title || mod.title} · ${lesson.title}</p>
    <h1>${concept.title}</h1>
    <p class="verify-flag">Flagged <code>verify: true</code> — stub content, nothing checked against a source.</p>
    <div class="stub-box">
      <h2>Lesson view — not built yet</h2>
      <p>This is Phase 1, step 3: Read and Quiz modes, the Key Points box, and the lesson check.
         The router works and the concept resolves; the view itself is next.</p>
    </div>
    <p><a class="back" href="#/">Back to the Ladder</a></p>
  </section>`;
}

/* --- Router --------------------------------------------------------------- */

function route() {
  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  let html;
  if (parts[0] === 'lesson' && parts[1]) {
    html = lessonStub(decodeURIComponent(parts[1]));
  } else {
    html = renderLadder(progress.load(), {
      modulesByTier: app.modulesByTier,
      loadError: app.loadError
    });
  }

  app.el.innerHTML = html;
  app.el.focus({ preventScroll: true });
  window.scrollTo(0, 0);
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
  // Self-attest toggles are rendered fresh on every route, so listen on the
  // container rather than on the inputs.
  app.el.addEventListener('change', ev => {
    const tierKey = ev.target?.dataset?.attest;
    if (!tierKey) return;
    progress.setAttested(tierKey, ev.target.checked);
    say(ev.target.checked
      ? `${tierKey === 'fire' ? 'Fire' : 'Paramedic'} unlocked by self-attestation.`
      : `${tierKey === 'fire' ? 'Fire' : 'Paramedic'} locked again.`);
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
  route();
}

boot();
