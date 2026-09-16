/* ==========================================================================
   exam.js — the module exam. The gate to the next module.

   Differs from a lesson check in every way that matters:
     - drawn across the whole module, weighted by domain_weighting
     - timed, and the clock is visible
     - no rationales during the paper — you find out at the end, like the real thing
     - a review screen afterwards with the rationale for all four options
     - scored by domain, so the breakdown looks like an NREMT score report
     - a failed attempt locks the retake for retake_after_hours, and the retake
       draws a fresh set

   Run state is in memory. Refresh mid-exam and the attempt is gone, unrecorded —
   which is the honest outcome, since we cannot tell a refresh from a walk-away.
   ========================================================================== */

import { update as updateProgress, load as loadProgress, recordAnswer, devMode } from './progress.js';
import { pickByDomain, withheldSummary } from './bank.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DEFAULTS = { length: 25, pass_pct: 80, retake_after_hours: 24 };
const CONFIDENCE = [['guessed', 'Guessed'], ['unsure', 'Unsure'], ['knew_it', 'Knew it']];

let run = null;

export function isRunning() { return Boolean(run); }
export function abandon() { if (run?.timer) clearInterval(run.timer); run = null; }

/* --- Retake lock ---------------------------------------------------------- */

/** When may this module be sat again? Returns null when it is open now. */
export function retakeBlockedUntil(state, mod) {
  const cfg = { ...DEFAULTS, ...(mod.exam || {}) };
  const attempts = state.modules?.[mod.id]?.exam_attempts || [];
  if (!attempts.length) return null;
  const last = attempts[attempts.length - 1];
  if (last.passed) return null;                      // passed: sit it again whenever
  const until = new Date(new Date(last.at).getTime() + cfg.retake_after_hours * 3600 * 1000);
  return until > new Date() ? until : null;
}

function fmtLeft(until) {
  // Round to whole minutes first, then split — rounding the remainder on its own
  // produces "23h 60m".
  const mins = Math.max(0, Math.ceil((until - new Date()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtClock(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* --- Lifecycle ------------------------------------------------------------ */

export function start(mod, questions, onTick) {
  const cfg = { ...DEFAULTS, ...(mod.exam || {}) };
  const picked = pickByDomain(mod.domain_weighting, questions, cfg.length);
  run = {
    moduleId: mod.id,
    cfg,
    questions: picked,
    i: 0,
    answers: new Array(picked.length).fill(null),   // { chosen, confidence }
    chosen: null,
    startedAt: Date.now(),
    elapsed: 0,
    stage: picked.length ? 'question' : 'empty',
    reviewIndex: 0
  };
  // The clock is wall time, not a limit. Nothing is cut off; the number is
  // there so time-per-question can be looked at afterwards.
  run.timer = setInterval(() => {
    if (!run) return;
    run.elapsed = Math.floor((Date.now() - run.startedAt) / 1000);
    if (typeof onTick === 'function') onTick(run.elapsed);
  }, 1000);
  return run;
}

export function choose(index) {
  if (!run || run.stage !== 'question') return;
  run.chosen = index;
}

export function tagAndAdvance(confidence) {
  if (!run || run.stage !== 'question' || run.chosen === null) return;
  const q = run.questions[run.i];
  const correct = run.chosen === q.correct_index;
  run.answers[run.i] = { chosen: run.chosen, confidence, correct };

  recordAnswer({
    questionId: q.id,
    conceptId: q.concept_id,
    context: 'module_exam',
    correct,
    chosen: run.chosen,
    confidence
  });

  run.chosen = null;
  run.i++;
  if (run.i >= run.questions.length) finish();
}

export function reviewGo(delta) {
  if (!run || run.stage !== 'review') return;
  run.reviewIndex = Math.max(0, Math.min(run.questions.length - 1, run.reviewIndex + delta));
}

export function toReview() { if (run && run.stage === 'result') run.stage = 'review'; }
export function toResult() { if (run && run.stage === 'review') run.stage = 'result'; }

function finish() {
  if (run.timer) { clearInterval(run.timer); run.timer = null; }
  run.elapsed = Math.floor((Date.now() - run.startedAt) / 1000);

  const total = run.questions.length;
  const correct = run.answers.filter(a => a?.correct).length;
  const pct = total ? Math.round((correct / total) * 1000) / 10 : 0;
  const passed = pct >= run.cfg.pass_pct;
  const at = new Date().toISOString();

  /* Score by domain — the breakdown the real score report gives you. */
  const domains = {};
  run.questions.forEach((q, i) => {
    const d = domains[q.domain] || (domains[q.domain] = { correct: 0, total: 0 });
    d.total++;
    if (run.answers[i]?.correct) d.correct++;
  });
  const by_domain = {};
  for (const [k, v] of Object.entries(domains)) by_domain[k] = Math.round((v.correct / v.total) * 1000) / 10;

  updateProgress(state => {
    const m = state.modules[run.moduleId] || (state.modules[run.moduleId] = {});
    const attempts = m.exam_attempts || (m.exam_attempts = []);
    attempts.push({
      score_pct: pct, at, passed, correct, total,
      duration_sec: run.elapsed,
      by_domain,
      question_ids: run.questions.map(q => q.id)
    });
    m.best_pct = Math.max(m.best_pct ?? 0, pct);
    if (passed && !m.complete) { m.complete = true; m.completed_on = at; }
    if (!passed) {
      m.retake_available_at = new Date(Date.now() + run.cfg.retake_after_hours * 3600 * 1000).toISOString();
    } else {
      delete m.retake_available_at;
    }
  });

  run.result = { pct, correct, total, passed, by_domain, domains, elapsed: run.elapsed };
  run.stage = 'result';
}

/* --- Render --------------------------------------------------------------- */

export function renderExam(mod, questions) {
  const state = loadProgress();
  const cfg = { ...DEFAULTS, ...(mod.exam || {}) };

  if (!run || run.moduleId !== mod.id) return renderIntro(state, mod, questions, cfg);
  if (run.stage === 'review') return renderReview(mod);
  if (run.stage === 'result') return renderResult(mod);
  return renderQuestion(mod);
}

function renderIntro(state, mod, questions, cfg) {
  const held = withheldSummary(questions);
  const blockedUntil = retakeBlockedUntil(state, mod);
  const attempts = state.modules?.[mod.id]?.exam_attempts || [];
  const best = state.modules?.[mod.id]?.best_pct;

  const history = attempts.length
    ? `<table class="attempts">
         <tr><th>Attempt</th><th>Score</th><th>Result</th><th>Time</th><th>When</th></tr>
         ${attempts.map((a, i) => `<tr>
           <td class="num">${i + 1}</td>
           <td class="num">${a.score_pct}%</td>
           <td>${a.passed ? 'Pass' : 'Fail'}</td>
           <td class="num">${a.duration_sec != null ? fmtClock(a.duration_sec) : '—'}</td>
           <td>${new Date(a.at).toLocaleString()}</td></tr>`).join('')}
       </table>`
    : '';

  if (!held.servable) {
    return `<div class="stub-box"><h2>No questions available</h2>
      ${held.unverified
        ? `<p><span class="num">${held.unverified}</span> questions exist for this module but are flagged
           <code>verify: true</code>, so none can be served. Unverified content is barred from every
           question context — module exams most of all, because they gate progression.</p>
           <p class="quiz-note">Turn on dev mode in the footer to work with stub content.</p>`
        : `<p>This module has no question bank yet.</p>`}
      ${history}</div>`;
  }

  if (blockedUntil) {
    return `<div class="exam-intro">
      <h2>${esc(mod.title)} — module exam</h2>
      <div class="exam-locked">
        <b>Retake locked for ${fmtLeft(blockedUntil)}.</b>
        <p>The last attempt did not pass. The review period runs until
           ${blockedUntil.toLocaleString()}, and the retake will draw a fresh set of questions.</p>
        <p class="quiz-note">Go back through the lessons in the meantime — that is what the period is for.</p>
      </div>
      ${history}
    </div>`;
  }

  const weights = Object.entries(mod.domain_weighting || {})
    .map(([d, w]) => `<li><span class="num">${w}%</span> ${esc(d)}</li>`).join('');

  return `<div class="exam-intro">
    <h2>${esc(mod.title)} — module exam</h2>
    <p><span class="num">${Math.min(cfg.length, held.servable)}</span> questions,
       pass at <span class="num">${cfg.pass_pct}%</span>. Timed, but not time-limited —
       the clock is there so you can see how long you took.</p>
    <p>No rationales until the end. You will get every option's reasoning on the review screen.</p>
    ${weights ? `<p class="weights-label">Drawn by domain weighting:</p><ul class="weights">${weights}</ul>` : ''}
    ${best != null ? `<p class="meta">Best so far: <span class="num">${best}%</span></p>` : ''}
    ${held.servable < cfg.length
      ? `<p class="quiz-note">Only <span class="num">${held.servable}</span> questions are servable, so the paper
         will be short of the ${cfg.length} it should be.</p>` : ''}
    ${devMode() && held.unverified
      ? `<p class="quiz-note">Dev mode is on — <span class="num">${held.unverified}</span> unverified questions are in the draw.</p>` : ''}
    <button type="button" class="cta" id="exam-start">Start the exam</button>
    ${history}
  </div>`;
}

function renderQuestion(mod) {
  const q = run.questions[run.i];
  const n = run.i + 1;
  const pct = Math.round((run.i / run.questions.length) * 100);

  return `<div class="exam">
    <div class="exam-bar">
      <span>Question <span class="num">${n}</span> of <span class="num">${run.questions.length}</span></span>
      <span class="exam-clock num" id="exam-clock">${fmtClock(run.elapsed)}</span>
    </div>
    <div class="bar"><span style="width:${pct}%"></span></div>

    <p class="quiz-stem">${esc(q.stem)}</p>
    <ul class="opts">
      ${q.options.map((o, idx) => `
        <li class="opt ${run.chosen === idx ? 'is-picked' : ''}">
          <button type="button" data-exam-answer="${idx}">
            <span class="opt-letter num">${String.fromCharCode(65 + idx)}</span>
            <span class="opt-text">${esc(o.text)}</span>
          </button>
        </li>`).join('')}
    </ul>

    <div class="confidence ${run.chosen === null ? 'is-off' : ''}">
      <p>${run.chosen === null ? 'Pick an answer, then tag how sure you were' : 'How sure were you?'}</p>
      <div class="confidence-btns">
        ${CONFIDENCE.map(([k, l]) => `<button type="button" data-exam-confidence="${k}" ${run.chosen === null ? 'disabled' : ''}>${l}</button>`).join('')}
      </div>
      <p class="confidence-note">Tagging moves you on. No going back, and no rationale until the end.</p>
    </div>
  </div>`;
}

function renderResult(mod) {
  const r = run.result;
  const rows = Object.entries(r.domains).map(([d, v]) => {
    const pct = Math.round((v.correct / v.total) * 1000) / 10;
    return `<tr>
      <td>${esc(d)}</td>
      <td class="num">${v.correct}/${v.total}</td>
      <td class="num">${pct}%</td>
      <td><span class="dbar"><span style="width:${pct}%"></span></span></td>
    </tr>`;
  }).join('');

  const guessedRight = run.answers.filter((a, i) => a?.correct && a.confidence === 'guessed').length;

  return `<div class="quiz-result ${r.passed ? 'is-pass' : 'is-fail'}">
    <h2>${r.passed ? 'Passed' : 'Not yet'}</h2>
    <p class="score"><span class="num">${r.pct}%</span> — <span class="num">${r.correct}</span> of
      <span class="num">${r.total}</span> correct, pass is <span class="num">${run.cfg.pass_pct}%</span>
      · <span class="num">${fmtClock(r.elapsed)}</span></p>

    <h3>By domain</h3>
    <table class="domains"><tr><th>Domain</th><th>Correct</th><th>Score</th><th></th></tr>${rows}</table>

    ${guessedRight
      ? `<p class="focus-note"><span class="num">${guessedRight}</span> right ${guessedRight === 1 ? 'answer was' : 'answers were'}
         tagged a guess. They count here and they still come back.</p>` : ''}

    <p>${r.passed
      ? 'Module marked complete.'
      : `Retake opens in ${run.cfg.retake_after_hours}h with a fresh set of questions.`}</p>

    <div class="quiz-actions">
      <button type="button" class="cta" id="exam-review">Review every question</button>
      <a class="back" href="#/">Back to the Ladder</a>
    </div>
  </div>`;
}

function renderReview(mod) {
  const i = run.reviewIndex;
  const q = run.questions[i];
  const a = run.answers[i];

  const options = q.options.map((o, idx) => {
    const isCorrect = idx === q.correct_index;
    const isChosen = a && idx === a.chosen;
    const cls = isCorrect ? 'is-correct' : isChosen ? 'is-wrong' : '';
    return `<li class="opt ${cls}">
      <div class="opt-static">
        <span class="opt-letter num">${String.fromCharCode(65 + idx)}</span>
        <span class="opt-text">${esc(o.text)}${isChosen ? ' <em>— your answer</em>' : ''}</span>
      </div>
      <p class="rationale"><b>${isCorrect ? 'Why this is right' : 'Why this is wrong'}:</b> ${esc(o.rationale)}</p>
    </li>`;
  }).join('');

  return `<div class="exam-review">
    <div class="exam-bar">
      <span>Review <span class="num">${i + 1}</span> of <span class="num">${run.questions.length}</span>
        · <span class="quiz-style">${esc(q.style)}</span> · ${esc(q.domain)}</span>
      <span>${a?.correct ? '<b class="ok">Correct</b>' : '<b class="no">Missed</b>'}
        · tagged <span class="quiz-style">${esc(a?.confidence || '—')}</span></span>
    </div>
    <p class="quiz-stem">${esc(q.stem)}</p>
    <ul class="opts opts--review">${options}</ul>
    ${q.verify ? `<p class="quiz-note">This item is flagged <code>verify: true</code> — it was served because dev mode is on.</p>` : ''}
    <div class="review-nav">
      <button type="button" id="review-prev" ${i === 0 ? 'disabled' : ''}>← Previous</button>
      <button type="button" id="review-back">Back to the score</button>
      <button type="button" id="review-next" ${i === run.questions.length - 1 ? 'disabled' : ''}>Next →</button>
    </div>
  </div>`;
}
