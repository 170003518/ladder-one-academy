/* ==========================================================================
   simulation.js — the Test Center: the full simulation and adaptive practice.

   Two things live here, because they share a question pool, a run state and a
   render shape, and splitting them would mean maintaining that shape twice.

   FULL SIMULATION
     - drawn across every built EMT module, weighted by the NREMT domain
       weights recorded in docs/decisions.md
     - 70, 100 or 120 questions, matching the real exam's length range
     - hard time limit of two hours: when it expires the paper ends and every
       unanswered question counts as wrong, which is what a time limit means
     - scored by domain, attempt stored under tiers.emt.simulations

   ADAPTIVE PRACTICE
     - difficulty rises and falls with each answer
     - stops when it is confident the ability estimate sits above or below the
       standard, or when it has stabilised, or at the item cap
     - stores an ability estimate rather than a percentage, because the
       percentage correct in an adaptive test converges on chance-of-getting-it
       and says nothing useful

   The adaptive engine is a deliberately simple one-parameter model: every item
   is treated as equally discriminating and its difficulty is the 1-5 number
   already on the question. That is a simplification of what a real testing
   body does, and the intro screen says so rather than implying otherwise.

   Run state is in memory, exactly as in exam.js. A refresh mid-run loses the
   attempt unrecorded, because a refresh cannot be told from a walk-away.
   ========================================================================== */

import { update as updateProgress, load as loadProgress, recordAnswer, devMode } from './progress.js';
import { pickByDomain, servable, shuffle, withheldSummary } from './bank.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Midpoints of the published NREMT-EMT ranges, normalised to 100. Logged in
   docs/decisions.md; the ranges themselves are in docs/emt-blueprint.md. */
export const SIM_WEIGHTS = { AIR: 20, CARD: 22, TRAU: 16, MED: 30, OPS: 12 };
export const SIM_LENGTHS = [70, 100, 120];
export const SIM_MINUTES = 120;
export const SIM_PASS_PCT = 80;

/* Adaptive engine constants. CUT is the difficulty at which an item is a
   coin-flip for a candidate sitting exactly on the standard. */
export const ADAPT = { start: 3, cut: 3, min: 30, max: 60, z: 1.96, seTarget: 0.32, seDecide: 0.4, k: 0.5 };

const CONFIDENCE = [['guessed', 'Guessed'], ['unsure', 'Unsure'], ['knew_it', 'Knew it']];

let run = null;

export function isRunning() { return Boolean(run); }
export function abandon() { if (run?.timer) clearInterval(run.timer); run = null; }
export function mode() { return run?.mode || null; }

function fmtClock(sec) {
  const m = Math.floor(Math.abs(sec) / 60), s = Math.abs(sec) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* --- Ability <-> readiness scale ------------------------------------------
   The other readiness components are percentages where the module-exam pass
   mark is 80. So the ability estimate is mapped to put the standard at 80:
   at the cut you read 80, at the ceiling 100, at the floor 0. Anything else
   would put an at-standard candidate at 50 and drag the meter down for no
   reason a reader could follow. */
export function abilityToScore(theta) {
  const { cut } = ADAPT;
  const t = Math.max(1, Math.min(5, theta));
  return Math.round(t >= cut
    ? 80 + ((t - cut) / (5 - cut)) * 20
    : ((t - 1) / (cut - 1)) * 80);
}

/* --- Lifecycle ------------------------------------------------------------ */

function newRun(kind, questions) {
  return {
    mode: kind,
    questions,                                  // full: the whole paper. adaptive: grows.
    pool: null,
    i: 0,
    answers: [],
    chosen: null,
    startedAt: Date.now(),
    elapsed: 0,
    stage: questions.length || kind === 'adaptive' ? 'question' : 'empty',
    reviewIndex: 0,
    theta: ADAPT.start,
    info: 0,
    stopped: null
  };
}

export function startFull(questions, length, onTick) {
  const picked = pickByDomain(SIM_WEIGHTS, questions, length);
  run = newRun('full', picked);
  run.length = length;
  run.deadline = run.startedAt + SIM_MINUTES * 60 * 1000;
  run.answers = new Array(picked.length).fill(null);
  run.timer = setInterval(() => {
    if (!run) return;
    run.elapsed = Math.floor((Date.now() - run.startedAt) / 1000);
    if (Date.now() >= run.deadline && run.stage === 'question') { run.expired = true; finish(); }
    if (typeof onTick === 'function') onTick(run);
  }, 1000);
  return run;
}

export function startAdaptive(questions, onTick) {
  run = newRun('adaptive', []);
  run.pool = shuffle(servable(questions));
  run.used = new Set();
  const first = nextAdaptiveItem();
  if (first) run.questions.push(first); else run.stage = 'empty';
  run.timer = setInterval(() => {
    if (!run) return;
    run.elapsed = Math.floor((Date.now() - run.startedAt) / 1000);
    if (typeof onTick === 'function') onTick(run);
  }, 1000);
  return run;
}

/* Pick the next adaptive item: keep the domain mix honest first, then take the
   item whose difficulty sits closest to the current ability estimate. Targeting
   the estimate is the whole point — an item the candidate is near-certain to
   get right or wrong tells you almost nothing about where they are. */
function nextAdaptiveItem() {
  const unused = run.pool.filter(q => !run.used.has(q.id));
  if (!unused.length) return null;

  const seen = run.questions.length;
  const counts = {};
  for (const q of run.questions) counts[q.domain] = (counts[q.domain] || 0) + 1;
  const totalW = Object.values(SIM_WEIGHTS).reduce((a, b) => a + b, 0);

  let wantDomain = null, worst = -Infinity;
  for (const [d, w] of Object.entries(SIM_WEIGHTS)) {
    if (!unused.some(q => q.domain === d)) continue;
    const deficit = (w / totalW) - (seen ? (counts[d] || 0) / seen : 0);
    if (deficit > worst) { worst = deficit; wantDomain = d; }
  }

  const candidates = wantDomain ? unused.filter(q => q.domain === wantDomain) : unused;
  let best = null, bestGap = Infinity;
  for (const q of candidates) {
    const gap = Math.abs((q.difficulty ?? 3) - run.theta);
    if (gap < bestGap) { bestGap = gap; best = q; }
  }
  return best || candidates[0] || unused[0];
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
    context: run.mode === 'full' ? 'full_simulation' : 'adaptive',
    correct,
    chosen: run.chosen,
    confidence
  });

  run.chosen = null;

  if (run.mode === 'adaptive') {
    run.used.add(q.id);
    updateAbility(q, correct);
    const n = run.questions.length;
    const se = standardError();
    // A decision needs both a gap from the standard AND an estimate precise enough
    // to trust it. Without the second half, an early lucky streak decides the run.
    const decided = se <= ADAPT.seDecide && Math.abs(run.theta - ADAPT.cut) > ADAPT.z * se;
    if (n >= ADAPT.min && decided) run.stopped = 'decided';
    else if (n >= ADAPT.min && se <= ADAPT.seTarget) run.stopped = 'stabilised';
    else if (n >= ADAPT.max) run.stopped = 'cap';

    if (run.stopped) return finish();
    const next = nextAdaptiveItem();
    if (!next) { run.stopped = 'exhausted'; return finish(); }
    run.questions.push(next);
    run.i++;
    return;
  }

  run.i++;
  if (run.i >= run.questions.length) finish();
}

/* One-parameter update. p is the model's expectation before the answer; the
   estimate moves by the surprise, with a step that shrinks as evidence
   accumulates so late answers cannot swing it wildly. */
function updateAbility(q, correct) {
  const d = q.difficulty ?? 3;
  const p = 1 / (1 + Math.exp(-(run.theta - d)));
  const n = run.answers.filter(Boolean).length;
  const step = ADAPT.k / (1 + n / 4);
  run.theta = Math.max(1, Math.min(5, run.theta + step * ((correct ? 1 : 0) - p)));
  run.info += p * (1 - p);
}

function standardError() {
  return 1 / Math.sqrt(Math.max(run.info, 0.04));   // floor keeps it finite early on
}

export function reviewGo(delta) {
  if (!run || run.stage !== 'review') return;
  run.reviewIndex = Math.max(0, Math.min(run.questions.length - 1, run.reviewIndex + delta));
}
export function toReview() { if (run && run.stage === 'result') run.stage = 'review'; }
export function toResult() { if (run && run.stage === 'review') run.stage = 'result'; }

function byDomain() {
  const domains = {};
  run.questions.forEach((q, i) => {
    const d = domains[q.domain] || (domains[q.domain] = { correct: 0, total: 0 });
    d.total++;
    if (run.answers[i]?.correct) d.correct++;
  });
  const flat = {};
  for (const [k, v] of Object.entries(domains)) flat[k] = Math.round((v.correct / v.total) * 1000) / 10;
  return { domains, flat };
}

function finish() {
  if (run.timer) { clearInterval(run.timer); run.timer = null; }
  run.elapsed = Math.floor((Date.now() - run.startedAt) / 1000);
  const at = new Date().toISOString();
  const { domains, flat } = byDomain();
  const total = run.questions.length;
  const correct = run.answers.filter(a => a?.correct).length;

  if (run.mode === 'full') {
    const pct = total ? Math.round((correct / total) * 1000) / 10 : 0;
    const passed = pct >= SIM_PASS_PCT;
    const unanswered = run.answers.filter(a => !a).length;
    updateProgress(state => {
      const t = state.tiers.emt || (state.tiers.emt = {});
      const sims = t.simulations || (t.simulations = []);
      sims.push({
        mode: 'full', at, score_pct: pct, correct, total, passed,
        unanswered, expired: Boolean(run.expired),
        duration_sec: run.elapsed, by_domain: flat
      });
    });
    run.result = { pct, correct, total, passed, domains, unanswered, expired: Boolean(run.expired), elapsed: run.elapsed };
  } else {
    const se = standardError();
    const score = abilityToScore(run.theta);
    const passed = run.theta >= ADAPT.cut;
    updateProgress(state => {
      const t = state.tiers.emt || (state.tiers.emt = {});
      const runs = t.adaptive || (t.adaptive = []);
      runs.push({
        at, items: total, correct, theta: Math.round(run.theta * 100) / 100,
        se: Math.round(se * 100) / 100, passed, score_pct: score,
        stopped: run.stopped, duration_sec: run.elapsed, by_domain: flat
      });
    });
    run.result = { theta: run.theta, se, score, passed, correct, total, domains, stopped: run.stopped, elapsed: run.elapsed };
  }
  run.stage = 'result';
}

/* --- Test Center ---------------------------------------------------------- */

export function renderTestCenter(modules, questionCounts) {
  const state = loadProgress();
  const sims = state.tiers?.emt?.simulations || [];
  const adaptives = state.tiers?.emt?.adaptive || [];

  const examRows = modules.map(m => {
    const best = state.modules?.[m.id]?.best_pct;
    const n = questionCounts[m.id] || 0;
    return `<tr>
      <td>${esc(m.short_title || m.title)}</td>
      <td class="num">${n || '—'}</td>
      <td class="num">${best == null ? '—' : best + '%'}</td>
      <td>${n ? `<a href="#/exam/${encodeURIComponent(m.id)}">Sit it</a>` : '<span class="meta">no bank</span>'}</td>
    </tr>`;
  }).join('');

  const simRows = sims.length
    ? `<table class="attempts">
        <tr><th>#</th><th>Length</th><th>Score</th><th>Result</th><th>Time</th><th>When</th></tr>
        ${sims.map((s, i) => `<tr>
          <td class="num">${i + 1}</td>
          <td class="num">${s.total ?? '—'}</td>
          <td class="num">${s.score_pct}%</td>
          <td>${s.passed ? 'Pass' : 'Not yet'}${s.expired ? ' · timed out' : ''}</td>
          <td class="num">${s.duration_sec != null ? fmtClock(s.duration_sec) : '—'}</td>
          <td>${new Date(s.at).toLocaleString()}</td></tr>`).join('')}
      </table>`
    : '<p class="meta">No full simulation sat yet.</p>';

  const adaptRows = adaptives.length
    ? `<table class="attempts">
        <tr><th>#</th><th>Items</th><th>Ability</th><th>Readiness</th><th>Stopped</th><th>When</th></tr>
        ${adaptives.map((a, i) => `<tr>
          <td class="num">${i + 1}</td>
          <td class="num">${a.items}</td>
          <td class="num">${a.theta} ± ${a.se}</td>
          <td class="num">${a.score_pct}</td>
          <td>${esc(a.stopped || '—')}</td>
          <td>${new Date(a.at).toLocaleString()}</td></tr>`).join('')}
      </table>`
    : '<p class="meta">No adaptive run yet.</p>';

  return `
  <section class="testcenter tier-emt">
    <nav class="crumb"><a href="#/">Ladder</a> <span>›</span> Test Center</nav>
    <h1>Test Center</h1>
    <p class="meta">Everything that tests you rather than teaches you. Results feed the
      <a href="#/readiness/emt">exam readiness meter</a>.</p>

    <div class="tc-cards">
      <a class="tc-card" href="#/sim/full">
        <h2>Full simulation</h2>
        <p><span class="num">70</span>, <span class="num">100</span> or <span class="num">120</span> questions
           drawn across every built module by the NREMT domain weights, with a hard
           <span class="num">two-hour</span> limit. Scored by domain.</p>
        <span class="tc-go">Sit one →</span>
      </a>
      <a class="tc-card" href="#/sim/adaptive">
        <h2>Adaptive practice</h2>
        <p>Difficulty rises and falls with every answer and the run stops when the estimate
           has settled above or below the standard — the same principle the real exam uses.</p>
        <span class="tc-go">Start →</span>
      </a>
    </div>

    <h2 class="rd-sub">Module exams</h2>
    <table class="domains">
      <tr><th>Module</th><th>Questions</th><th>Best</th><th></th></tr>
      ${examRows}
    </table>

    <h2 class="rd-sub">Full simulation history</h2>
    ${simRows}

    <h2 class="rd-sub">Adaptive history</h2>
    ${adaptRows}
    <p class="meta">Ability is on the same 1–5 scale as question difficulty, with the standard at
      <span class="num">${ADAPT.cut}</span>. Readiness maps that onto the 0–100 scale the meter uses, putting the
      standard at <span class="num">80</span> so it lines up with the module-exam pass mark.</p>
  </section>`;
}

/* --- Simulation screens --------------------------------------------------- */

export function renderSim(kind, questions) {
  if (!run || run.mode !== kind) return renderIntro(kind, questions);
  if (run.stage === 'empty') return renderEmpty(questions);
  if (run.stage === 'review') return renderReview();
  if (run.stage === 'result') return renderResult();
  return renderQuestion();
}

function renderEmpty(questions) {
  const held = withheldSummary(questions);
  return `<div class="stub-box"><h2>No questions available</h2>
    ${held.unverified
      ? `<p><span class="num">${held.unverified}</span> questions exist but are flagged <code>verify: true</code>,
         so none can be served. Unverified content is barred from every question context.</p>
         <p class="quiz-note">Turn on dev mode in the footer to work with stub content.</p>`
      : '<p>Nothing is loaded to draw from.</p>'}
    <p><a class="back" href="#/test">Back to the Test Center</a></p></div>`;
}

function renderIntro(kind, questions) {
  const held = withheldSummary(questions);
  if (!held.servable) { run = null; return renderEmpty(questions); }

  const weights = Object.entries(SIM_WEIGHTS)
    .map(([d, w]) => `<li><span class="num">${w}%</span> ${esc(d)}</li>`).join('');

  if (kind === 'full') {
    const lengths = SIM_LENGTHS.map(n =>
      `<button type="button" class="cta ${n === 100 ? '' : 'cta--quiet'}" data-sim-start="${n}">${n} questions</button>`).join('');
    return `<div class="exam-intro">
      <nav class="crumb"><a href="#/test">Test Center</a> <span>›</span> Full simulation</nav>
      <h2>Full simulation</h2>
      <p>Drawn across every built EMT module by domain weighting. Pass is
         <span class="num">${SIM_PASS_PCT}%</span>.</p>
      <p><b>Hard limit of ${SIM_MINUTES} minutes.</b> When the clock reaches zero the paper ends and every
         question you have not answered counts as wrong. That is what a time limit means, and pretending
         otherwise would make the practice worthless.</p>
      <p>No rationales until the end. You get every option's reasoning on the review screen.</p>
      <p class="weights-label">Drawn by domain weighting:</p><ul class="weights">${weights}</ul>
      ${held.servable < 70
        ? `<p class="quiz-note">Only <span class="num">${held.servable}</span> questions are servable, so the paper
           will be short of its length.</p>` : ''}
      ${devMode() && held.unverified
        ? `<p class="quiz-note">Dev mode is on — <span class="num">${held.unverified}</span> unverified questions are in the draw.</p>` : ''}
      <div class="sim-lengths">${lengths}</div>
    </div>`;
  }

  return `<div class="exam-intro">
    <nav class="crumb"><a href="#/test">Test Center</a> <span>›</span> Adaptive practice</nav>
    <h2>Adaptive practice</h2>
    <p>The difficulty of each question is chosen from how you answered the last one. The run ends when the
       estimate is confidently above or below the standard, when it has stopped moving, or at
       <span class="num">${ADAPT.max}</span> items — whichever comes first, with a minimum of
       <span class="num">${ADAPT.min}</span>.</p>
    <p><b>Expect it to feel hard.</b> A working adaptive test keeps you near your own limit, because that is
       where each answer tells it the most. Feeling uncertain throughout is the normal experience and is not
       a sign of how it is going.</p>
    <p class="quiz-note">This is a deliberately simple model: every item is treated as equally discriminating
       and its difficulty is the 1–5 number already on the question. A real testing body's engine is
       calibrated against outcome data that does not exist here. The estimate is also bounded by the
       difficulty of the questions that exist: a candidate who gets most of the hardest items right will
       sit at the top of the scale, because there is nothing harder to ask them.</p>
    ${devMode() && held.unverified
      ? `<p class="quiz-note">Dev mode is on — <span class="num">${held.unverified}</span> unverified questions are in the draw.</p>` : ''}
    <button type="button" class="cta" data-sim-start="adaptive">Start</button>
  </div>`;
}

function renderQuestion() {
  const q = run.questions[run.i];
  const n = run.i + 1;
  const isFull = run.mode === 'full';
  const left = isFull ? Math.max(0, Math.floor((run.deadline - Date.now()) / 1000)) : run.elapsed;
  const pct = isFull
    ? Math.round((run.i / run.questions.length) * 100)
    : Math.round(Math.min(1, n / ADAPT.max) * 100);

  return `<div class="exam">
    <div class="exam-bar">
      <span>Question <span class="num">${n}</span>${isFull ? ` of <span class="num">${run.questions.length}</span>` : ''}
        ${isFull ? '' : `· estimate <span class="num">${run.theta.toFixed(2)}</span> ± <span class="num">${standardError().toFixed(2)}</span>`}</span>
      <span class="exam-clock num ${isFull && left <= 300 ? 'is-low' : ''}" id="sim-clock">${fmtClock(left)}</span>
    </div>
    <div class="bar"><span style="width:${pct}%"></span></div>

    <p class="quiz-stem">${esc(q.stem)}</p>
    <ul class="opts">
      ${q.options.map((o, idx) => `
        <li class="opt ${run.chosen === idx ? 'is-picked' : ''}">
          <button type="button" data-sim-answer="${idx}">
            <span class="opt-letter num">${String.fromCharCode(65 + idx)}</span>
            <span class="opt-text">${esc(o.text)}</span>
          </button>
        </li>`).join('')}
    </ul>

    <div class="confidence ${run.chosen === null ? 'is-off' : ''}">
      <p>${run.chosen === null ? 'Pick an answer, then tag how sure you were' : 'How sure were you?'}</p>
      <div class="confidence-btns">
        ${CONFIDENCE.map(([k, l]) => `<button type="button" data-sim-confidence="${k}" ${run.chosen === null ? 'disabled' : ''}>${l}</button>`).join('')}
      </div>
      <p class="confidence-note">Tagging moves you on. No going back, and no rationale until the end.</p>
    </div>
  </div>`;
}

const STOP_REASON = {
  decided: 'the estimate was confidently above or below the standard',
  stabilised: 'the estimate stopped moving',
  cap: `the ${ADAPT.max}-item cap was reached`,
  exhausted: 'the question pool ran out'
};

function renderResult() {
  const r = run.result;
  const rows = Object.entries(r.domains).map(([d, v]) => {
    const pct = Math.round((v.correct / v.total) * 1000) / 10;
    return `<tr><td>${esc(d)}</td><td class="num">${v.correct}/${v.total}</td>
      <td class="num">${pct}%</td><td><span class="dbar"><span style="width:${pct}%"></span></span></td></tr>`;
  }).join('');
  const guessedRight = run.answers.filter(a => a?.correct && a.confidence === 'guessed').length;

  const head = run.mode === 'full'
    ? `<h2>${r.passed ? 'Passed' : 'Not yet'}</h2>
       <p class="score"><span class="num">${r.pct}%</span> — <span class="num">${r.correct}</span> of
         <span class="num">${r.total}</span> correct, pass is <span class="num">${SIM_PASS_PCT}%</span>
         · <span class="num">${fmtClock(r.elapsed)}</span></p>
       ${r.expired
         ? `<p class="quiz-note"><b>Time ran out.</b> <span class="num">${r.unanswered}</span>
            unanswered ${r.unanswered === 1 ? 'question' : 'questions'} counted as wrong.</p>` : ''}`
    : `<h2>${r.passed ? 'Above the standard' : 'Below the standard'}</h2>
       <p class="score">Ability <span class="num">${r.theta.toFixed(2)}</span> ± <span class="num">${r.se.toFixed(2)}</span>
         on a 1–5 scale, standard at <span class="num">${ADAPT.cut}</span>
         · readiness <span class="num">${r.score}</span>/100
         · <span class="num">${r.total}</span> items · <span class="num">${fmtClock(r.elapsed)}</span></p>
       <p class="meta">Stopped because ${STOP_REASON[r.stopped] || 'the run ended'}. Percentage correct is
         <span class="num">${Math.round((r.correct / r.total) * 100)}%</span>, and in an adaptive run that number
         means very little — it converges toward the point where you are half likely to be right, whoever you are.</p>`;

  return `<div class="quiz-result ${r.passed ? 'is-pass' : 'is-fail'}">
    ${head}
    <h3>By domain</h3>
    <table class="domains"><tr><th>Domain</th><th>Correct</th><th>Score</th><th></th></tr>${rows}</table>
    ${guessedRight
      ? `<p class="focus-note"><span class="num">${guessedRight}</span> right ${guessedRight === 1 ? 'answer was' : 'answers were'}
         tagged a guess. They count here and they still come back.</p>` : ''}
    <p class="meta">Recorded against the exam readiness meter.</p>
    <div class="quiz-actions">
      <button type="button" class="cta" id="sim-review">Review every question</button>
      <a class="back" href="#/readiness/emt">Readiness meter</a>
      <a class="back" href="#/test">Test Center</a>
    </div>
  </div>`;
}

function renderReview() {
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
        · <span class="quiz-style">${esc(q.style)}</span> · ${esc(q.domain)} · difficulty
        <span class="num">${q.difficulty ?? '—'}</span></span>
      <span>${a ? (a.correct ? '<b class="ok">Correct</b>' : '<b class="no">Missed</b>') : '<b class="no">Unanswered</b>'}
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
