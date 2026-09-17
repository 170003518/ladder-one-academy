/* ==========================================================================
   overview.js — the Module Overview screen.
   One module: its lessons, the concepts inside each, and for every concept a
   row of eight dots showing which learning modes have been viewed.

   The dots are the point. Progress elsewhere is a percentage; here it is
   visible which specific mode you have and have not been through, which is what
   the eight-mode idea is for.
   ========================================================================== */

import { load as loadProgress, isConceptComplete } from './progress.js';
import { MODE_ORDER, MODE_LABEL } from './lesson.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SHORT = { read: 'R', eli_new: 'E', see: 'S', hear: 'H', do: 'D', quiz: 'Q', teach: 'T', story: 'Y' };

/** A concept's modes, each tagged present / viewed / absent. */
function modeDots(concept, state, hasQuestions) {
  const viewed = state.concepts?.[concept.id]?.modes_viewed || {};
  return MODE_ORDER.map(m => {
    const present = m === 'quiz' ? hasQuestions : Boolean(concept.modes?.[m]);
    const seen = Boolean(viewed[m]);
    const cls = !present ? 'is-absent' : seen ? 'is-viewed' : 'is-unseen';
    const label = `${MODE_LABEL[m]}: ${!present ? 'not written' : seen ? 'viewed' : 'not yet viewed'}`;
    return `<span class="dot ${cls}" title="${esc(label)}" aria-label="${esc(label)}">${SHORT[m]}</span>`;
  }).join('');
}

/** Completion of one lesson, as a fraction of its concepts. */
export function lessonProgress(state, lesson) {
  const total = lesson.concepts.length;
  const done = lesson.concepts.filter(id => isConceptComplete(state, id)).length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/** An SVG ring. Simpler than it looks: one circle, one dash offset. */
export function ring(pct, size = 34) {
  const r = (size / 2) - 4;
  const c = 2 * Math.PI * r;
  const off = c * (1 - (pct / 100));
  return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"
      aria-label="${pct}% complete">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--border)" stroke-width="4"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--tier-color)" stroke-width="4"
      stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"
      transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

export function renderOverview(mod, questions) {
  if (!mod) {
    return `<section class="stub"><h1>Not found</h1><p>No loaded module has that id.</p>
      <p><a class="back" href="#/">Back to the Ladder</a></p></section>`;
  }
  const state = loadProgress();
  const byId = Object.fromEntries(mod.concepts.map(c => [c.id, c]));
  const overall = mod.lessons.reduce((acc, l) => {
    const p = lessonProgress(state, l);
    return { done: acc.done + p.done, total: acc.total + p.total };
  }, { done: 0, total: 0 });
  const overallPct = overall.total ? Math.round((overall.done / overall.total) * 100) : 0;
  const unverified = mod.concepts.filter(c => c.verify).length;

  return `
  <section class="overview tier-emt">
    <nav class="crumb"><a href="#/">Ladder</a> <span>›</span> Module ${mod.number}</nav>

    <header class="ov-head">
      ${ring(overallPct, 64)}
      <div>
        <h1>${esc(mod.title)}</h1>
        <p class="meta">
          <span class="num">${mod.lessons.length}</span> lessons ·
          <span class="num">${mod.concepts.length}</span> concepts ·
          <span class="num">${overall.done}</span> of <span class="num">${overall.total}</span> complete
        </p>
        <div class="ov-actions">
          <a class="cta" href="#/exam/${encodeURIComponent(mod.id)}">Module exam</a>
          <a href="#/deck/${encodeURIComponent(mod.id)}">Study the deck</a>
          <a href="#/print/deck/${encodeURIComponent(mod.id)}">Print the deck</a>
        </div>
      </div>
    </header>

    ${unverified ? `<div class="verify-banner" role="note">
      <b>${unverified} of ${mod.concepts.length} concepts are unverified.</b>
      Nothing in this module has been checked against a source text. Flagged content is barred from lesson checks,
      module exams and the deck unless dev mode is on.
    </div>` : ''}

    <div class="ov-key">
      <span class="ov-key__t">Modes</span>
      ${MODE_ORDER.map(m => `<span class="key-item"><span class="dot is-viewed">${SHORT[m]}</span>${esc(MODE_LABEL[m])}</span>`).join('')}
      <span class="key-item"><span class="dot is-unseen">·</span>written, not yet viewed</span>
      <span class="key-item"><span class="dot is-absent">·</span>not written</span>
    </div>

    ${mod.lessons.map(lesson => {
      const p = lessonProgress(state, lesson);
      const hasQ = id => questions.some(q => !q.retired && lesson.concepts.includes(q.concept_id));
      return `
      <section class="ov-lesson">
        <header>
          ${ring(p.pct)}
          <div>
            <h2>${esc(lesson.title)}</h2>
            <p class="meta"><span class="num">${lesson.id}</span> ·
              <span class="num">${p.done}</span> of <span class="num">${p.total}</span> concepts complete</p>
          </div>
        </header>
        <ul class="ov-concepts">
          ${lesson.concepts.map(id => {
            const c = byId[id];
            if (!c) return `<li class="ov-missing">${esc(id)} — not in this module's concepts</li>`;
            const done = isConceptComplete(state, id);
            const focus = state.concepts?.[id]?.focus;
            return `<li class="${done ? 'is-done' : ''}">
              <a href="#/lesson/${encodeURIComponent(id)}">
                <span class="ov-t">${esc(c.title)}</span>
                <span class="ov-flags">
                  ${c.high_yield ? '<span class="l1a-highyield">High-yield</span>' : ''}
                  ${focus ? '<span class="ov-focus">Focus</span>' : ''}
                  ${done ? '<span class="ov-done">Complete</span>' : ''}
                </span>
              </a>
              <span class="dots">${modeDots(c, state, hasQ(id))}</span>
            </li>`;
          }).join('')}
        </ul>
      </section>`;
    }).join('')}
  </section>`;
}
