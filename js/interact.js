/* ==========================================================================
   interact.js — Do It mode renderers.

   Only select_device exists so far, and it covers two config shapes that the
   content actually uses:

     match  { devices: [...], patients: [{ text, correct, why }] }
            Assign a device to each patient. Feedback per patient, drawn from
            the content's own `why`.

     choice { choices: [...], correct_choice, worked_solution, answer_minutes,
              tolerance }
            A single multiple-choice question with a worked solution revealed
            after answering. The oxygen-duration calculation uses this.

   The shape is detected from the config rather than declared, because
   concept.schema.json's `type` enum has no separate calculation renderer and
   the content was authored against select_device for both.

   Picks are in memory. Do It is practice, not assessment — nothing here is
   recorded to progress and nothing gates on it.
   ========================================================================== */

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** conceptId -> { [itemIndex]: choiceIndex } */
const picks = new Map();

export function resetDo(conceptId) { picks.delete(conceptId); }
export function abandonAll() { picks.clear(); }

export function pickDo(conceptId, itemIndex, choiceIndex) {
  const state = picks.get(conceptId) || {};
  state[itemIndex] = choiceIndex;
  picks.set(conceptId, state);
}

function shapeOf(config) {
  if (!config) return 'none';
  if (Array.isArray(config.patients) && Array.isArray(config.devices)) return 'match';
  if (Array.isArray(config.choices) && Number.isInteger(config.correct_choice)) return 'choice';
  return 'unknown';
}

/* --- match: one device per patient ---------------------------------------- */

function renderMatch(concept, cfg, state) {
  const answered = Object.keys(state).length;
  const total = cfg.patients.length;
  const right = cfg.patients.filter((p, i) => state[i] === p.correct).length;

  const items = cfg.patients.map((p, i) => {
    const chosen = state[i];
    const done = chosen !== undefined;
    const correct = done && chosen === p.correct;

    const buttons = cfg.devices.map((dev, j) => {
      const isPick = chosen === j;
      const isAnswer = p.correct === j;
      const cls = !done ? '' : isAnswer ? 'is-correct' : isPick ? 'is-wrong' : 'is-dim';
      return `<button type="button" class="do-choice ${cls}" data-do-pick="${i}:${j}" ${done ? 'disabled' : ''}>
        ${esc(dev)}</button>`;
    }).join('');

    return `<li class="do-item ${done ? (correct ? 'is-right' : 'is-wrong') : ''}">
      <p class="do-stem"><span class="do-num num">${i + 1}</span> ${esc(p.text)}</p>
      <div class="do-choices">${buttons}</div>
      ${done ? `<p class="do-why"><b>${correct ? 'Right' : 'Not this one'} — ${esc(cfg.devices[p.correct])}:</b> ${esc(p.why || '')}</p>` : ''}
    </li>`;
  }).join('');

  return `
    <ul class="do-list">${items}</ul>
    <div class="do-foot">
      ${answered ? `<p class="do-score"><span class="num">${right}</span> of <span class="num">${total}</span> matched
        ${answered < total ? `· <span class="num">${total - answered}</span> to go` : ''}</p>` : ''}
      ${answered ? `<button type="button" id="do-reset">Start over</button>` : ''}
    </div>`;
}

/* --- choice: one question, worked solution after ------------------------- */

function renderChoice(concept, cfg, state) {
  const chosen = state[0];
  const done = chosen !== undefined;
  const correct = done && chosen === cfg.correct_choice;

  const buttons = cfg.choices.map((text, j) => {
    const isPick = chosen === j;
    const isAnswer = cfg.correct_choice === j;
    const cls = !done ? '' : isAnswer ? 'is-correct' : isPick ? 'is-wrong' : 'is-dim';
    return `<li class="opt ${cls}">
      <button type="button" data-do-pick="0:${j}" ${done ? 'disabled' : ''}>
        <span class="opt-letter num">${String.fromCharCode(65 + j)}</span>
        <span class="opt-text">${esc(text)}</span>
      </button>
    </li>`;
  }).join('');

  return `
    <ul class="opts">${buttons}</ul>
    ${done ? `
      <div class="do-solution ${correct ? 'is-right' : 'is-wrong'}">
        <p class="do-verdict">${correct ? 'Correct.' : 'Not quite.'}
          ${cfg.answer_minutes != null
            ? `The answer is <span class="num">${esc(String(cfg.answer_minutes))}</span> minutes${
                cfg.tolerance ? ` (within <span class="num">${esc(String(cfg.tolerance))}</span>)` : ''}.`
            : ''}</p>
        ${cfg.worked_solution ? `<p class="do-worked num">${esc(cfg.worked_solution)}</p>` : ''}
      </div>
      <div class="do-foot"><button type="button" id="do-reset">Try it again</button></div>` : ''}`;
}

/* --- entry ---------------------------------------------------------------- */

export function renderDo(concept) {
  const mode = concept.modes?.do;
  if (!mode) return '';

  const cfg = mode.config;
  const shape = shapeOf(cfg);

  if (shape === 'none' || shape === 'unknown') {
    return `<div class="stub-box">
      <h2>Do It — renderer missing</h2>
      <p>This concept declares the activity <code>${esc(mode.activity || '?')}</code> of type
         <code>${esc(mode.type || '?')}</code>, but its config is not a shape any renderer handles yet.</p>
    </div>`;
  }

  const state = picks.get(concept.id) || {};
  const body = shape === 'match'
    ? renderMatch(concept, cfg, state)
    : renderChoice(concept, cfg, state);

  return `<div class="do" data-activity="${esc(mode.activity || '')}">
    ${mode.prompt ? `<p class="do-prompt">${esc(mode.prompt)}</p>` : ''}
    ${body}
    <p class="do-note">Practice only — nothing here is recorded or gated on.</p>
  </div>`;
}
