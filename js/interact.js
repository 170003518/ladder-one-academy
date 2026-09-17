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

import { renderSort } from './sort.js';

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
  if (Array.isArray(config.buckets) && Array.isArray(config.items)) return 'sort';
  if (Array.isArray(config.patients) && Array.isArray(config.devices)) return 'match';
  if (Array.isArray(config.choices) && Number.isInteger(config.correct_choice)) return 'choice';
  return 'unknown';
}

/**
 * Group a number for reading: 2400 becomes 2,400. Pinned to en-US rather than
 * the viewer's locale because the content itself is written US-style — the
 * worked solution beside it already says "2,400 mL/min", and the two must match.
 * Non-numeric values pass through untouched.
 */
function fmtNum(v) {
  return (typeof v === 'number' && Number.isFinite(v)) ? v.toLocaleString('en-US') : String(v);
}

/**
 * "within 1 minutes" reads badly. Singularise a plain-word unit when the value
 * is exactly 1. Symbol units like mL/min contain punctuation and never
 * pluralise, so they are left alone.
 */
function unitFor(value, unit) {
  if (!unit) return '';
  if (value === 1 && /^[A-Za-z]+s$/.test(unit)) return unit.slice(0, -1);
  return unit;
}

/**
 * The stated answer on a calculation, whatever unit the content used.
 * Oxygen duration was authored as answer_minutes; alveolar ventilation as
 * answer_value + answer_unit. Read both rather than making the content pick one.
 */
function statedAnswer(cfg) {
  if (cfg.answer_value != null) return { value: cfg.answer_value, unit: cfg.answer_unit || '' };
  if (cfg.answer_minutes != null) return { value: cfg.answer_minutes, unit: 'minutes' };
  return null;
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
          ${(() => {
            const a = statedAnswer(cfg);
            if (!a) return '';
            const answerUnit = unitFor(a.value, a.unit);
            const tolUnit = unitFor(cfg.tolerance, a.unit);
            return `The answer is <span class="num">${esc(fmtNum(a.value))}</span>${answerUnit ? ` ${esc(answerUnit)}` : ''}${
              cfg.tolerance ? ` (within <span class="num">${esc(fmtNum(cfg.tolerance))}</span>${tolUnit ? ` ${esc(tolUnit)}` : ''})` : ''}.`;
          })()}</p>
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

  // Sorting owns its own state and its own markup; it is not a pick-one.
  if (shape === 'sort') return renderSort(concept);

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
