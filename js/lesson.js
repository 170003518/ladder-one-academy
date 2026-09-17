/* ==========================================================================
   lesson.js — the lesson view.
   Mode tabs across the top, the chosen mode's content, the same Key Points box
   at the bottom of every mode, and prev/next within the lesson. Switching modes
   never changes the key points — that consistency is the whole point of having
   eight of them.
   ========================================================================== */

import { load as loadProgress, update as updateProgress, isConceptComplete } from './progress.js';
import { renderQuiz } from './quiz.js';
import { isServable } from './bank.js';
import { renderDo } from './interact.js';
import { renderHear } from './hear.js';
import { renderTeach } from './teach.js';
import { renderSee } from './see.js';

export const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Tab order is the order in docs/master-plan.md §5, not the order the keys
   happen to appear in the JSON. */
export const MODE_ORDER = ['read', 'eli_new', 'see', 'hear', 'do', 'quiz', 'teach', 'story'];

export const MODE_LABEL = {
  read: 'Read', eli_new: "Explain Like I'm New", see: 'See It', hear: 'Hear It',
  do: 'Do It', quiz: 'Quiz It', teach: 'Teach It Back', story: 'Story It'
};

/**
 * Which tabs to show. Content modes appear only when the concept actually has
 * them — an empty tab is worse than a missing one. Quiz is the exception: it is
 * driven by the question bank, not by concept.modes, because the bank is a
 * separate file and modes.quiz only ever holds configuration.
 */
/**
 * The tab list for one concept in one lesson. Single source of truth — the
 * router and the renderer must never compute this differently, or the default
 * tab and the visible tabs can disagree.
 */
export function modesFor(concept, lesson, questions) {
  const hasServable = questions.some(q => isServable(q) && lesson.concepts.includes(q.concept_id));
  return availableModes(concept, hasServable);
}

export function availableModes(concept, hasQuestions) {
  const present = MODE_ORDER.filter(m => m !== 'quiz' && concept.modes && concept.modes[m]);
  if (hasQuestions) {
    const i = MODE_ORDER.indexOf('quiz');
    const before = present.filter(m => MODE_ORDER.indexOf(m) < i);
    const after = present.filter(m => MODE_ORDER.indexOf(m) > i);
    return [...before, 'quiz', ...after];
  }
  return present;
}

/* --- Pieces --------------------------------------------------------------- */

function verifyBanner(concept) {
  if (!concept.verify) return '';
  return `
  <div class="verify-banner" role="note">
    <b>Not verified.</b> ${esc(concept.verify_notes || 'This concept has been flagged for review.')}
    <span class="verify-banner__rule">Flagged concepts are kept out of module exams and full simulations.</span>
  </div>`;
}

function keyPoints(concept) {
  const pts = concept.key_points || [];
  if (!pts.length) return '';
  return `
  <section class="keypoints" aria-labelledby="kp-h">
    <h2 id="kp-h">Key points</h2>
    <ul>${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
  </section>`;
}

/** Read mode. Plain is the floor; the depth toggle appears only when there is
    more depth to show. */
function readMode(concept, depth) {
  const read = concept.modes.read;
  const layers = ['plain', 'standard', 'deep'].filter(l => read[l]);
  const current = layers.includes(depth) ? depth : 'plain';
  const label = { plain: 'Plain English', standard: 'Standard', deep: 'Deep dive' };

  const toggle = layers.length > 1
    ? `<div class="depth" role="group" aria-label="Depth">
         ${layers.map(l => `<button type="button" data-depth="${l}" aria-pressed="${l === current}">${label[l]}</button>`).join('')}
       </div>`
    : `<p class="depth-none">Plain English only so far — the standard and deep-dive layers are not written yet.</p>`;

  return `${toggle}<div class="prose">${read[current].split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
}

function simpleMode(mode, concept) {
  const m = concept.modes[mode];
  switch (mode) {
    case 'eli_new':
      return `${m.analogy ? `<p class="analogy">${esc(m.analogy)}</p>` : ''}<div class="prose"><p>${esc(m.body)}</p></div>`;
    case 'story':
      return `${m.title ? `<h2>${esc(m.title)}</h2>` : ''}${m.dispatch ? `<p class="dispatch">${esc(m.dispatch)}</p>` : ''}<div class="prose">${m.body.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('')}</div>`;
    case 'do':
      return renderDo(concept);
    case 'hear':
      return renderHear(concept);
    case 'teach':
      return renderTeach(concept);
    case 'see':
      return renderSee(concept);
    default:
      return `<div class="stub-box"><h2>${esc(MODE_LABEL[mode])} — not built yet</h2>
        <p>The concept carries data for this mode, but the renderer is still to come.</p></div>`;
  }
}

/* --- Render --------------------------------------------------------------- */

export function renderLesson(ctx) {
  const { module: mod, lesson, concept, mode, depth, questions } = ctx;
  const state = loadProgress();
  const modes = modesFor(concept, lesson, questions);
  const active = modes.includes(mode) ? mode : (modes[0] || 'read');

  const ids = lesson.concepts;
  const i = ids.indexOf(concept.id);
  const prev = i > 0 ? ids[i - 1] : null;
  const next = i < ids.length - 1 ? ids[i + 1] : null;

  const viewed = Boolean(state.concepts?.[concept.id]?.modes_viewed?.[active]);
  const complete = isConceptComplete(state, concept.id);

  const body = active === 'quiz'
    ? renderQuiz(ctx)
    : active === 'read'
      ? readMode(concept, depth)
      : simpleMode(active, concept);

  /* The quiz owns its own footer — a "mark viewed" button mid-question would be
     noise, and the key points are the answer key while a check is running. */
  const showFooter = active !== 'quiz';

  return `
  <article class="lesson tier-emt">
    <nav class="crumb" aria-label="Breadcrumb">
      <a href="#/">Ladder</a> <span>›</span>
      ${esc(mod.short_title || mod.title)} <span>›</span> ${esc(lesson.title)}
    </nav>

    <header class="lesson-head">
      <h1>${esc(concept.title)}</h1>
      <p class="lesson-meta">
        <span class="num">${esc(concept.id)}</span>
        · ${esc(concept.domain)}
        · difficulty <span class="num">${concept.difficulty}</span>
        ${concept.high_yield ? '<span class="l1a-highyield">High-yield</span>' : ''}
        ${complete ? '<span class="done-flag">Complete</span>' : ''}
      </p>
    </header>

    ${verifyBanner(concept)}

    <div class="tabs" role="tablist" aria-label="Learning modes">
      ${modes.map(m => `
        <a role="tab" aria-selected="${m === active}" class="tab ${m === active ? 'is-active' : ''}"
           href="#/lesson/${encodeURIComponent(concept.id)}/${m}">${esc(MODE_LABEL[m])}</a>`).join('')}
    </div>

    <div class="mode-body" role="tabpanel">${body}</div>

    ${showFooter ? `
      <div class="mode-foot">
        <button type="button" id="mark-viewed" data-mode="${active}" ${viewed ? 'disabled' : ''}>
          ${viewed ? `Viewed in ${esc(MODE_LABEL[active])}` : 'Mark viewed'}
        </button>
        <span class="mode-foot__hint">${viewed
          ? 'Recorded. A lesson also needs the lesson check at or above pass to count as complete.'
          : 'Records that you have been through this concept in this mode.'}</span>
      </div>` : ''}

    ${keyPoints(concept)}

    <nav class="concept-nav" aria-label="Within this lesson">
      ${prev
        ? `<a class="nav-prev" href="#/lesson/${encodeURIComponent(prev)}/${active}">← Previous</a>`
        : `<span class="nav-prev is-off">← Previous</span>`}
      <span class="nav-pos">Concept <span class="num">${i + 1}</span> of <span class="num">${ids.length}</span> in this lesson</span>
      ${next
        ? `<a class="nav-next" href="#/lesson/${encodeURIComponent(next)}/${active}">Next →</a>`
        : `<span class="nav-next is-off">Next →</span>`}
    </nav>
  </article>`;
}

/** Record that this concept has been seen in this mode. */
export function markViewed(conceptId, mode) {
  updateProgress(state => {
    const c = state.concepts[conceptId] || (state.concepts[conceptId] = {});
    const mv = c.modes_viewed || (c.modes_viewed = {});
    mv[mode] = true;
  });
}
