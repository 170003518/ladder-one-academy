/* ==========================================================================
   teach.js — Teach It Back mode.
   The learner explains the concept in their own words; the app checks the
   response against the concept's must_hit points by case-insensitive keyword
   match on each point's accept[] list.

   The model answer is revealed only after submitting. Showing it first would
   turn the highest-retention mode in the plan into a reading exercise.

   The matching is deliberately crude — substring, case-insensitive. It is a
   prompt to self-check, not a grader, and the screen says so.
   ========================================================================== */

import { markViewed } from './lesson.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** conceptId -> { answer, results } — cleared when the view is left. */
const attempts = new Map();

export function reset(conceptId) { attempts.delete(conceptId); }
export function abandonAll() { attempts.clear(); }

/** Case-insensitive substring match of any accepted wording. */
export function check(answer, mustHit) {
  const hay = String(answer || '').toLowerCase();
  return (mustHit || []).map(p => ({
    point: p.point,
    accept: p.accept || [],
    hit: (p.accept || []).some(a => hay.includes(String(a).toLowerCase()))
  }));
}

export function submit(concept, answer) {
  const teach = concept.modes?.teach;
  if (!teach) return;
  attempts.set(concept.id, { answer, results: check(answer, teach.must_hit) });
  // Submitting is what counts as having worked the concept in this mode —
  // a blank submit still counts, and the result makes that obvious.
  markViewed(concept.id, 'teach');
}

export function renderTeach(concept) {
  const teach = concept.modes?.teach;
  if (!teach) return '';

  const done = attempts.get(concept.id);

  if (!done) {
    return `
    <div class="teach">
      <p class="teach-prompt">${esc(teach.prompt)}</p>
      <textarea id="teach-answer" class="teach-input" rows="8"
        placeholder="Say it the way you would say it to a new partner. Full sentences, no notes."></textarea>
      <div class="teach-foot">
        <button type="button" id="teach-submit">Check my explanation</button>
        <span class="mode-foot__hint">${teach.must_hit.length} point${teach.must_hit.length === 1 ? '' : 's'}
          are being looked for. The model answer appears after you submit.</span>
      </div>
    </div>`;
  }

  const hits = done.results.filter(r => r.hit).length;
  const total = done.results.length;

  return `
  <div class="teach">
    <p class="teach-prompt">${esc(teach.prompt)}</p>

    <div class="teach-yours">
      <h3>What you said</h3>
      <p class="teach-echo">${done.answer.trim() ? esc(done.answer) : '<em>You submitted nothing.</em>'}</p>
    </div>

    <div class="teach-results">
      <h3>${hits} of ${total} points covered</h3>
      <ul class="teach-points">
        ${done.results.map(r => `
          <li class="${r.hit ? 'is-hit' : 'is-miss'}">
            <span class="teach-mark">${r.hit ? '✓' : '✗'}</span>
            <span>
              ${esc(r.point)}
              ${r.hit ? '' : `<em class="teach-accept">looked for: ${r.accept.map(a => esc(a)).join(', ')}</em>`}
            </span>
          </li>`).join('')}
      </ul>
      <p class="teach-caveat">This is a keyword match, not a grader. It can miss a good explanation that
         used different words, and it can credit a wrong one that happened to contain the right phrase.
         Read the model answer and judge for yourself.</p>
    </div>

    ${teach.model_answer ? `
      <div class="teach-model">
        <h3>Model answer</h3>
        <div class="prose">${teach.model_answer.split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join('')}</div>
      </div>` : ''}

    <div class="teach-foot">
      <button type="button" id="teach-again">Try again</button>
    </div>
  </div>`;
}
