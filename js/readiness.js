/* ==========================================================================
   readiness.js — the Exam Readiness meter (master-plan §3.6).

   One 0–100 score per tier, built from three components:

     Module exams      40%   best score on each built module's exam, averaged
     Card retention    25%   proportion of seen cards not currently lapsing
     Full simulations  20%   average of the best two full simulations
     Adaptive estimate 15%   the most recent adaptive run's ability estimate

   The weights are a judgement, not a statistic. §3.6 says the meter "turns
   green when you're statistically ready", and there is no statistics here yet —
   no outcome data exists to fit against. So the threshold is a placeholder and
   the breakdown screen says so rather than implying a validated prediction.

   Coverage is reported alongside the score and never folded into it. A tier
   with three of eleven modules built can produce a high score from the three,
   and presenting that as readiness for the whole exam would be a lie. The
   number is what it is; the caveat sits next to it.
   ========================================================================== */

import { load as loadProgress } from './progress.js';
import { retention } from './srs.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const WEIGHTS = { exams: 0.4, retention: 0.25, simulations: 0.2, adaptive: 0.15 };
export const READY_AT = 85;           // placeholder threshold — see the note above
export const DOMAINS = ['AIR', 'CARD', 'TRAU', 'MED', 'OPS'];

/* --- Score ---------------------------------------------------------------- */

export function compute(state, modules, cards, tierKey = 'emt', modulesInTier = 11) {
  const built = modules.length;

  const examScores = modules
    .map(m => state.modules?.[m.id]?.best_pct)
    .filter(v => typeof v === 'number');
  const exams = examScores.length ? examScores.reduce((a, b) => a + b, 0) / examScores.length : null;

  const ret = retention(state, cards);

  const sims = (state.tiers?.[tierKey]?.simulations || [])
    .map(s => s.score_pct).sort((a, b) => b - a).slice(0, 2);
  const simulations = sims.length ? sims.reduce((a, b) => a + b, 0) / sims.length : null;

  /* The adaptive component takes the MOST RECENT run, not the best. The others
     are performances, and taking your best of them is fair. An adaptive run is
     a measurement of where you are now, and taking the best measurement you
     ever produced is not a measurement of anything. */
  const adaptRuns = state.tiers?.[tierKey]?.adaptive || [];
  const lastAdapt = adaptRuns.length ? adaptRuns[adaptRuns.length - 1] : null;
  const adaptive = lastAdapt ? lastAdapt.score_pct : null;

  /* Components that have no data yet contribute nothing and their weight is
     removed from the denominator, so an early score is not dragged toward zero
     by simulations nobody has sat. */
  const parts = [
    { key: 'exams', value: exams, weight: WEIGHTS.exams },
    { key: 'retention', value: ret, weight: WEIGHTS.retention },
    { key: 'simulations', value: simulations, weight: WEIGHTS.simulations },
    { key: 'adaptive', value: adaptive, weight: WEIGHTS.adaptive }
  ];
  const active = parts.filter(p => p.value != null);
  const denom = active.reduce((a, p) => a + p.weight, 0);
  const score = denom ? Math.round(active.reduce((a, p) => a + p.value * p.weight, 0) / denom) : null;

  return {
    score,
    ready: score != null && score >= READY_AT && built >= modulesInTier,
    components: {
      exams: { value: exams == null ? null : Math.round(exams), n: examScores.length, of: built, weight: WEIGHTS.exams },
      retention: { value: ret, n: cards.filter(c => state.srs?.[c.id]?.last_result).length, of: cards.length, weight: WEIGHTS.retention },
      simulations: { value: simulations == null ? null : Math.round(simulations), n: sims.length, of: 2, weight: WEIGHTS.simulations },
      adaptive: {
        value: adaptive == null ? null : Math.round(adaptive),
        n: adaptRuns.length, of: adaptRuns.length || 1, weight: WEIGHTS.adaptive,
        theta: lastAdapt ? lastAdapt.theta : null, se: lastAdapt ? lastAdapt.se : null,
        items: lastAdapt ? lastAdapt.items : null
      }
    },
    coverage: { built, total: modulesInTier, pct: Math.round((built / modulesInTier) * 100) }
  };
}

/* --- Domain heat map ------------------------------------------------------ */

/**
 * Accuracy per exam domain, from question_history joined to concepts.
 * question_history stores concept_id rather than domain, so the domain is
 * resolved through the loaded modules — which means a domain only appears once
 * its module has been built.
 */
export function domainHeat(state, modules, filterContext = null) {
  const domainOf = {};
  for (const m of modules) for (const c of m.concepts) domainOf[c.id] = c.domain;

  const out = {};
  for (const d of DOMAINS) out[d] = { correct: 0, total: 0, guessedRight: 0 };

  for (const h of (state.question_history || [])) {
    if (filterContext && h.context !== filterContext) continue;
    const d = domainOf[h.concept_id];
    if (!d || !out[d]) continue;
    out[d].total++;
    if (h.correct) out[d].correct++;
    if (h.correct && h.confidence === 'guessed') out[d].guessedRight++;
  }
  for (const d of DOMAINS) {
    const v = out[d];
    v.pct = v.total ? Math.round((v.correct / v.total) * 100) : null;
  }
  return out;
}

/** Weakest concepts by miss rate, for the Focus List. */
export function weakestConcepts(state, modules, limit = 8) {
  const titleOf = {};
  for (const m of modules) for (const c of m.concepts) titleOf[c.id] = c.title;
  const agg = {};
  for (const h of (state.question_history || [])) {
    const a = agg[h.concept_id] || (agg[h.concept_id] = { total: 0, wrong: 0, guessed: 0 });
    a.total++;
    if (!h.correct) a.wrong++;
    if (h.correct && h.confidence === 'guessed') a.guessed++;
  }
  return Object.entries(agg)
    .map(([id, a]) => ({ id, title: titleOf[id] || id, ...a, miss: (a.wrong + a.guessed) / a.total }))
    .filter(x => x.wrong + x.guessed > 0)
    .sort((a, b) => b.miss - a.miss || b.total - a.total)
    .slice(0, limit);
}

/* --- Render --------------------------------------------------------------- */

export function meter(r) {
  if (r.score == null) {
    return `<div class="readiness is-empty">
      <span class="readiness__n">—</span>
      <span class="readiness__l">Exam readiness</span>
      <span class="readiness__h">Sit a module exam to start it</span>
    </div>`;
  }
  return `<a class="readiness ${r.ready ? 'is-ready' : ''}" href="#/readiness/emt">
    <span class="readiness__n num">${r.score}</span>
    <span class="readiness__l">Exam readiness</span>
    <span class="readiness__h">${r.ready ? 'Statistically ready' : `Based on ${r.coverage.built} of ${r.coverage.total} modules`}</span>
    <span class="readiness__bar"><span style="width:${r.score}%"></span></span>
  </a>`;
}

function bar(pct, label, sub) {
  const known = pct != null;
  return `<div class="rd-row">
    <span class="rd-row__l">${esc(label)}</span>
    <span class="rd-row__bar"><span style="width:${known ? pct : 0}%" class="${known ? '' : 'is-empty'}"></span></span>
    <span class="rd-row__n num">${known ? pct + '%' : '—'}</span>
    <span class="rd-row__s">${esc(sub)}</span>
  </div>`;
}

export function renderReadiness(modules, cards) {
  const state = loadProgress();
  const r = compute(state, modules, cards);
  const heat = domainHeat(state, modules);
  const weak = weakestConcepts(state, modules);
  const answered = (state.question_history || []).length;

  const c = r.components;
  return `
  <section class="readinessview tier-emt">
    <nav class="crumb"><a href="#/">Ladder</a> <span>›</span> Exam readiness</nav>
    <h1>Exam readiness — Rung 1, EMT</h1>

    <div class="rd-head">
      <div class="readiness ${r.ready ? 'is-ready' : ''} is-big">
        <span class="readiness__n num">${r.score == null ? '—' : r.score}</span>
        <span class="readiness__l">out of 100</span>
      </div>
      <div>
        <p class="rd-caveat">
          <b>This is not a validated prediction.</b> The weights below are a judgement, not a statistic —
          there is no outcome data to fit them against yet, so the ${READY_AT} threshold is a placeholder.
          Treat the number as a rough progress indicator, not as a pass probability.
        </p>
        <p class="meta">Coverage: <span class="num">${r.coverage.built}</span> of
          <span class="num">${r.coverage.total}</span> modules built
          (<span class="num">${r.coverage.pct}%</span>). Coverage is reported beside the score and never folded
          into it — a high score from three modules is not readiness for eleven.</p>
      </div>
    </div>

    <h2 class="rd-sub">What it is made of</h2>
    <div class="rd-rows">
      ${bar(c.exams.value, `Module exams · ${Math.round(c.exams.weight * 100)}%`,
        c.exams.n ? `best score on ${c.exams.n} of ${c.exams.of} built modules` : 'no module exam sat yet')}
      ${bar(c.retention.value, `Card retention · ${Math.round(c.retention.weight * 100)}%`,
        c.retention.n ? `${c.retention.n} of ${c.retention.of} cards reviewed at least once` : 'no cards reviewed yet')}
      ${bar(c.simulations.value, `Full simulations · ${Math.round(c.simulations.weight * 100)}%`,
        c.simulations.n ? `best ${c.simulations.n} of 2 counted` : 'no full simulation sat yet')}
      ${bar(c.adaptive.value, `Adaptive estimate · ${Math.round(c.adaptive.weight * 100)}%`,
        c.adaptive.n
          ? `latest of ${c.adaptive.n} run${c.adaptive.n === 1 ? '' : 's'} · ability ${c.adaptive.theta} ± ${c.adaptive.se} over ${c.adaptive.items} items`
          : 'no adaptive run yet')}
    </div>
    <p class="meta">Both are sat in the <a href="#/test">Test Center</a>. The adaptive row uses the
      <b>most recent</b> run rather than the best one, because an ability estimate is a measurement of where you
      are now — the best measurement you ever produced is not a measurement of anything.</p>
    <p class="meta">A component with no data contributes nothing and its weight is removed from the denominator,
      so the score is not dragged down by a simulation nobody has sat.</p>

    <h2 class="rd-sub">Domain heat map</h2>
    <p class="meta">From <span class="num">${answered}</span> answered questions in
      <code>question_history</code>. A domain appears only once its module is built.</p>
    <table class="domains rd-heat">
      <tr><th>Domain</th><th>Answered</th><th>Correct</th><th>Right but guessed</th><th></th></tr>
      ${DOMAINS.map(d => {
        const v = heat[d];
        const cls = v.pct == null ? '' : v.pct >= 85 ? 'is-good' : v.pct >= 70 ? 'is-mid' : 'is-poor';
        return `<tr class="${cls}">
          <td>${d}</td>
          <td class="num">${v.total || '—'}</td>
          <td class="num">${v.pct == null ? '—' : v.pct + '%'}</td>
          <td class="num">${v.total ? v.guessedRight : '—'}</td>
          <td><span class="dbar"><span style="width:${v.pct || 0}%"></span></span></td>
        </tr>`;
      }).join('')}
    </table>

    <h2 class="rd-sub">Focus list</h2>
    ${weak.length
      ? `<ul class="rd-weak">${weak.map(w => `<li>
          <a href="#/lesson/${encodeURIComponent(w.id)}">${esc(w.title)}</a>
          <span class="num">${w.wrong} missed${w.guessed ? ` · ${w.guessed} guessed right` : ''} of ${w.total}</span>
        </li>`).join('')}</ul>`
      : `<p class="meta">Nothing on the focus list yet. Concepts land here when you miss a question or get one
         right on a guess — a right answer you admit you guessed counts, because it looks identical to knowledge
         in a score and is not.</p>`}
  </section>`;
}
