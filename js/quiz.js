/* ==========================================================================
   quiz.js — the lesson check.
   Draws pool_size questions across the whole lesson's concepts, one at a time.
   Answer, then the rationale for what you picked and for the right answer
   appear immediately; then you tag how confident you were before moving on.

   Passing at pass_pct marks a concept complete, but only if it has also been
   viewed in at least one mode — both halves of the rule in master-plan §8.

   Run state is deliberately in memory only. A half-finished check is not
   progress, and persisting it would just let you resume a check you were
   failing.
   ========================================================================== */

import { update as updateProgress, recordAnswer, devMode } from './progress.js';
import { pickAcrossConcepts, withheldSummary } from './bank.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DEFAULTS = { pool_size: 5, pass_pct: 80 };

const CONFIDENCE = [
  ['guessed', 'Guessed'],
  ['unsure',  'Unsure'],
  ['knew_it', 'Knew it']
];

/** null when no check is running. */
let run = null;

export function isRunning() { return Boolean(run); }
export function abandon() { run = null; }

/* --- Selection ------------------------------------------------------------ */

/**
 * Pick the questions for a lesson check. The rule about what may be served
 * lives in bank.js — retired never, unverified only in dev mode — so the
 * lesson check and the module exam cannot drift apart.
 */
export function selectQuestions(lesson, allQuestions, poolSize) {
  return pickAcrossConcepts(lesson.concepts, allQuestions, poolSize);
}

/* --- Lifecycle ------------------------------------------------------------ */

export function start(ctx) {
  const { lesson, concept, questions } = ctx;
  const cfg = { ...DEFAULTS, ...(concept.modes?.quiz || {}) };
  const picked = selectQuestions(lesson, questions, cfg.pool_size);
  run = {
    lessonId: lesson.id,
    cfg,
    questions: picked,
    i: 0,
    answers: [],        // { questionId, conceptId, chosen, correct, confidence }
    chosen: null,
    stage: picked.length ? 'question' : 'empty'
  };
  return run;
}

export function answer(index) {
  if (!run || run.stage !== 'question') return;
  run.chosen = index;
  run.stage = 'rationale';
}

export function tag(confidence) {
  if (!run || run.stage !== 'rationale') return;
  const q = run.questions[run.i];
  const correct = run.chosen === q.correct_index;
  run.answers.push({ questionId: q.id, conceptId: q.concept_id, chosen: run.chosen, correct, confidence });

  // Every answer goes into question_history the moment it is tagged, not at the
  // end of the run — abandoning a check should not erase what was answered.
  recordAnswer({
    questionId: q.id,
    conceptId: q.concept_id,
    context: 'lesson_check',
    correct,
    chosen: run.chosen,
    confidence
  });
  run.chosen = null;
  run.i++;
  if (run.i >= run.questions.length) {
    run.stage = 'result';
    commit();
  } else {
    run.stage = 'question';
  }
}

/**
 * Write the result. One lesson_check attempt is recorded against every concept
 * in the lesson, because the check covers the lesson as a whole.
 *
 * A concept is marked complete only when it has been viewed in at least one
 * mode AND the check passed — master-plan §8, both halves.
 *
 * Confidence feeds the Focus List: a wrong answer, or a right one the learner
 * admits was a guess, flags that concept. Per-question confidence itself is not
 * persisted — progress.schema.json has no field for it, and inventing one here
 * would put the code and the schema out of step.
 */
function commit() {
  const total = run.answers.length;
  const correct = run.answers.filter(a => a.correct).length;
  const pct = total ? Math.round((correct / total) * 1000) / 10 : 0;
  const passed = pct >= run.cfg.pass_pct;
  const at = new Date().toISOString();

  const lessonConcepts = run.lessonConcepts || [...new Set(run.questions.map(q => q.concept_id))];

  updateProgress(state => {
    for (const cid of lessonConcepts) {
      const c = state.concepts[cid] || (state.concepts[cid] = {});
      const lc = c.lesson_check || (c.lesson_check = {});
      const attempts = lc.attempts || (lc.attempts = []);
      attempts.push({ pct, at, correct, total });
      lc.last_pct = pct;
      lc.best_pct = Math.max(lc.best_pct ?? 0, pct);

      const viewed = Object.values(c.modes_viewed || {}).some(Boolean);
      if (passed && viewed && !c.complete) {
        c.complete = true;
        c.completed_on = at;
      }
    }
    for (const a of run.answers) {
      if (!a.correct || a.confidence === 'guessed') {
        const c = state.concepts[a.conceptId] || (state.concepts[a.conceptId] = {});
        c.focus = true;
      }
    }
  });

  run.result = { pct, correct, total, passed, lessonConcepts };
}

/* --- Render --------------------------------------------------------------- */

export function renderQuiz(ctx) {
  const { lesson, concept, questions } = ctx;
  const cfg = { ...DEFAULTS, ...(concept.modes?.quiz || {}) };

  if (!run || run.lessonId !== lesson.id) {
    const held = withheldSummary(questions, lesson.concepts);
    if (!held.servable) {
      return `<div class="stub-box"><h2>No questions available</h2>
        ${held.unverified
          ? `<p><span class="num">${held.unverified}</span> question${held.unverified === 1 ? ' is' : 's are'} written for this
             lesson but flagged <code>verify: true</code>, so ${held.unverified === 1 ? 'it is' : 'they are'} not served.
             Unverified content is barred from every question context.</p>
             <p class="quiz-note">Turn on dev mode in the footer to work with stub content.</p>`
          : `<p>The bank has nothing for this lesson.</p>`}
      </div>`;
    }
    const available = held.servable;
    return `
    <div class="quiz-intro">
      <h2>Lesson check</h2>
      <p>${Math.min(cfg.pool_size, available)} questions drawn across all
         <span class="num">${lesson.concepts.length}</span> concepts in
         <b>${esc(lesson.title)}</b>. Pass is <span class="num">${cfg.pass_pct}%</span>.</p>
      ${devMode() && held.unverified
        ? `<p class="quiz-note">Dev mode is on, so <span class="num">${held.unverified}</span> unverified
             question${held.unverified === 1 ? '' : 's'} ${held.unverified === 1 ? 'is' : 'are'} being served.
             Placeholder items written from the stub key points — fine for wiring up the check, not study material.</p>`
        : ''}
      <button type="button" class="cta" id="quiz-start">Start the check</button>
    </div>`;
  }

  if (run.stage === 'result') return renderResult();

  const q = run.questions[run.i];
  const answered = run.stage === 'rationale';
  const n = run.i + 1;

  const options = q.options.map((o, idx) => {
    const isCorrect = idx === q.correct_index;
    const isChosen = idx === run.chosen;
    const cls = !answered ? '' : isCorrect ? 'is-correct' : isChosen ? 'is-wrong' : 'is-dim';
    return `
    <li class="opt ${cls}">
      <button type="button" data-answer="${idx}" ${answered ? 'disabled' : ''}>
        <span class="opt-letter num">${String.fromCharCode(65 + idx)}</span>
        <span class="opt-text">${esc(o.text)}</span>
      </button>
      ${answered && (isChosen || isCorrect)
        ? `<p class="rationale"><b>${isCorrect ? 'Why this is right' : 'Why this is wrong'}:</b> ${esc(o.rationale)}</p>`
        : ''}
    </li>`;
  }).join('');

  return `
  <div class="quiz">
    <p class="quiz-progress">Question <span class="num">${n}</span> of <span class="num">${run.questions.length}</span>
      · <span class="quiz-style">${esc(q.style)}</span></p>
    <p class="quiz-stem">${esc(q.stem)}</p>
    <ul class="opts">${options}</ul>
    ${answered ? `
      <div class="confidence">
        <p>How sure were you?</p>
        <div class="confidence-btns">
          ${CONFIDENCE.map(([k, label]) => `<button type="button" data-confidence="${k}">${label}</button>`).join('')}
        </div>
        <p class="confidence-note">A right answer you guessed still comes back — that is what the tag is for.</p>
      </div>` : ''}
  </div>`;
}

function renderResult() {
  const r = run.result;
  return `
  <div class="quiz-result ${r.passed ? 'is-pass' : 'is-fail'}">
    <h2>${r.passed ? 'Passed' : 'Not yet'}</h2>
    <p class="score"><span class="num">${r.pct}%</span>
      — <span class="num">${r.correct}</span> of <span class="num">${r.total}</span> correct,
      pass is <span class="num">${run.cfg.pass_pct}%</span></p>
    <p>${r.passed
      ? 'Every concept in this lesson that you have also been through in at least one mode is now marked complete.'
      : 'Nothing was marked complete. Go back through the concepts and run the check again.'}</p>
    ${renderFocusNote()}
    <div class="quiz-actions">
      <button type="button" class="cta" id="quiz-again">Run it again</button>
      <a class="back" href="#/">Back to the Ladder</a>
    </div>
  </div>`;
}

function renderFocusNote() {
  const flagged = [...new Set(run.answers.filter(a => !a.correct || a.confidence === 'guessed').map(a => a.conceptId))];
  if (!flagged.length) return '<p class="focus-note">Nothing added to the Focus List.</p>';
  return `<p class="focus-note">Added to the Focus List: ${flagged.map(id => `<span class="num">${esc(id)}</span>`).join(', ')}
    — missed, or answered right on a guess.</p>`;
}

/** The lesson's full concept list, so a pass records against all of them and
    not only the ones that happened to be drawn. */
export function setLessonConcepts(ids) {
  if (run) run.lessonConcepts = ids;
}
