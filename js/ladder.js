/* ==========================================================================
   ladder.js — the Ladder home screen.
   One screen: three rungs stacked vertically, where you are, why the locked
   ones are locked, and one primary action. Nothing more than two taps from here.
   ========================================================================== */

import { TIERS, tierStatus, isAttested, isConceptComplete } from './progress.js';
import { lessonProgress, ring } from './overview.js';
import { compute as computeReadiness, meter } from './readiness.js';

/* How many modules each tier has in the blueprint, so "3 of 11 built" is a real
   fraction rather than a hardcoded denominator. From docs/emt-blueprint.md. */
export const MODULES_IN_TIER = { emt: 11, fire: 17, medic: 10 };

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Why each rung is shut, in one line. Shown on the locked card itself so the
   goal stays visible instead of being a dead end. */
const LOCK_REASON = {
  fire:  'Complete the EMT rung to unlock Fire.',
  medic: 'Complete the Fire rung to unlock Paramedic.'
};

const ATTEST_LABEL = {
  fire:  "I'm already a certified EMT",
  medic: "I'm already a certified Firefighter"
};

/* --- The mark, with rungs lit by unlock status ----------------------------
   The logo is the progress indicator: a rung is dark slate until its tier
   opens. Geometry is identical to brand/logo.svg. */
function markSVG(status) {
  /* A rung lights as soon as its tier is UNLOCKED — not when it is complete.
     Locked rungs are slate; the rails behind them are darker still so a lit
     rung reads as lit even when it is star white. */
  const fill = (key, color) => (status[key] === 'locked' ? 'var(--slate)' : color);
  return `
  <svg class="mark" viewBox="0 0 200 240" role="img" aria-label="Ladder One Academy — ${
    TIERS.filter(t => status[t.key] !== 'locked').map(t => t.label).join(' and ') || 'no'
  } rungs unlocked">
    <path d="M100 6 L188 30 V132 C188 186 148 218 100 234 C52 218 12 186 12 132 V30 Z"
          fill="var(--navy)" stroke="var(--star-white)" stroke-width="3" stroke-linejoin="round"/>
    <path d="M100 17 L178 38 V131 C178 179 143 207 100 222 C57 207 22 179 22 131 V38 Z"
          fill="none" stroke="var(--star-white)" stroke-width="1.25" stroke-opacity="0.35" stroke-linejoin="round"/>
    <g fill="var(--star-white)">
      <rect x="93.5" y="37" width="13" height="50"/>
      <rect x="93.5" y="37" width="13" height="50" transform="rotate(60 100 62)"/>
      <rect x="93.5" y="37" width="13" height="50" transform="rotate(120 100 62)"/>
    </g>
    <rect x="85.44" y="106.5" width="29.11" height="11" rx="2" fill="${fill('medic', 'var(--line-blue)')}"/>
    <rect x="75.44" y="142.5" width="49.11" height="11" rx="2" fill="${fill('fire', 'var(--ember)')}"/>
    <rect x="65.44" y="178.5" width="69.11" height="11" rx="2" fill="${fill('emt', 'var(--star-white)')}"/>
    <polygon points="84.5,92 97.5,92 67.5,200 54.5,200" fill="var(--navy-500)"/>
    <polygon points="115.5,92 102.5,92 132.5,200 145.5,200" fill="var(--navy-500)"/>
  </svg>`;
}

const LOCK_ICON = `<svg class="lock" viewBox="0 0 24 24" aria-hidden="true">
  <path d="M7 10V7a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  <rect x="4" y="10" width="16" height="10" rx="2" fill="currentColor"/>
</svg>`;

/* --- Tier progress -------------------------------------------------------- */

/** Walk the loaded modules in order and count concepts done. */
function tierProgress(state, modules) {
  let done = 0, total = 0;
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      for (const id of lesson.concepts) {
        total++;
        if (isConceptComplete(state, id)) done++;
      }
    }
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

/**
 * The next thing to do: first concept, in lesson order, that is not complete.
 * Returns null when everything loaded is finished.
 */
export function nextIncomplete(state, modules) {
  for (const mod of modules) {
    for (const lesson of mod.lessons) {
      for (const id of lesson.concepts) {
        if (!isConceptComplete(state, id)) {
          const concept = mod.concepts.find(c => c.id === id);
          return { module: mod, lesson, conceptId: id, title: concept ? concept.title : id };
        }
      }
    }
  }
  return null;
}

/* --- Render --------------------------------------------------------------- */

function tierCard(tier, status, { modules, progress, attested, progressByModule, state }) {
  const locked = status === 'locked';
  const stateLabel = status === 'complete' ? 'Complete' : locked ? 'Locked' : 'In progress';

  const body = locked
    ? `<p class="lock-why">${LOCK_ICON}<span>${esc(LOCK_REASON[tier.key])}</span></p>
       <p class="browse">You can still see what is inside — it just will not open yet.</p>`
    : modules.length
      ? `<p class="meta"><span class="num">${progress.done}</span> of <span class="num">${progress.total}</span> concepts complete
           · <span class="num">${modules.length}</span> of <span class="num">${MODULES_IN_TIER[tier.key] || '?'}</span> modules built</p>
         <div class="bar" role="img" aria-label="${progress.pct}% complete">
           <span style="width:${progress.pct}%"></span>
         </div>
         <ul class="modlist">${modules.map(m => {
           const ex = progressByModule[m.id] || {};
           const mp = m.lessons.reduce((a, l) => {
             const lp = lessonProgress(state, l);
             return { done: a.done + lp.done, total: a.total + lp.total };
           }, { done: 0, total: 0 });
           const mpct = mp.total ? Math.round((mp.done / mp.total) * 100) : 0;
           return `<li class="modrow">
             <div class="modrow__head">
               ${ring(mpct, 40)}
               <div>
                 <a class="modrow__t" href="#/module/${encodeURIComponent(m.id)}">
                   <span class="num">${String(m.number).padStart(2, '0')}</span> ${esc(m.title)}</a>
                 <em>${m.lessons.length} lessons · ${m.concepts.length} concepts${
                   ex.best_pct != null ? ` · exam best <span class="num">${ex.best_pct}%</span>` : ''}${
                   ex.complete ? ' · <b>passed</b>' : ''}</em>
               </div>
             </div>
             <ul class="lessonlist">
               ${m.lessons.map(l => {
                 const lp = lessonProgress(state, l);
                 return `<li>
                   ${ring(lp.pct, 26)}
                   <a href="#/lesson/${encodeURIComponent(l.concepts[0])}">${esc(l.title)}</a>
                   <span class="num">${lp.done}/${lp.total}</span>
                 </li>`;
               }).join('')}
             </ul>
             <span class="modlinks">
               <a href="#/module/${encodeURIComponent(m.id)}">Overview</a>
               <a href="#/exam/${encodeURIComponent(m.id)}">Module exam</a>
               <a href="#/print/${encodeURIComponent(m.id)}">Print a card</a>
               <a href="#/deck/${encodeURIComponent(m.id)}">Study the deck</a>
               <a href="#/print/deck/${encodeURIComponent(m.id)}">Print the deck</a>
             </span>
           </li>`; }).join('')}</ul>`
      : `<p class="meta">No modules built yet.</p>`;

  /* The self-attest override. Offered on the locked tier itself: attesting that
     you already hold the rung below opens this one without redoing it. */
  const attest = (tier.key === 'emt') ? '' : `
    <div class="attest">
      <label>
        <input type="checkbox" data-attest="${tier.key}" ${attested ? 'checked' : ''}>
        <span>${esc(ATTEST_LABEL[tier.key])} — unlock ${esc(tier.label)} without redoing the rung below</span>
      </label>
      ${attested ? `<p class="attest-on">Self-attested. Unlocked on the honour system — nothing is verified.</p>` : ''}
    </div>`;

  return `
  <article class="rung ${tier.css} ${locked ? 'is-locked' : ''}" data-tier="${tier.key}">
    <div class="rung-bar"></div>
    <header>
      <h2>${esc(tier.name)}</h2>
      <span class="status">${locked ? LOCK_ICON : ''}${stateLabel}</span>
    </header>
    ${body}
    ${attest}
  </article>`;
}

export function renderLadder(state, { modulesByTier, loadError, cardsByTier = {} }) {
  const status = {};
  const progressByTier = {};

  const tierComplete = key => {
    const mods = modulesByTier[key] || [];
    const p = tierProgress(state, mods);
    // A tier is only complete when it has content AND all of it is done.
    // With one stub module built, EMT can never be complete yet — correct.
    return mods.length > 0 && p.total > 0 && p.done === p.total && mods.length >= (MODULES_IN_TIER[key] || Infinity);
  };

  for (const tier of TIERS) {
    status[tier.key] = tierStatus(state, tier.key, tierComplete);
    progressByTier[tier.key] = tierProgress(state, modulesByTier[tier.key] || []);
  }

  const next = nextIncomplete(state, modulesByTier.emt || []);
  const continueBtn = next
    ? `<a class="cta" href="#/lesson/${encodeURIComponent(next.conceptId)}">
         Continue
         <em>${esc(next.module.short_title || next.module.title)} · ${esc(next.lesson.title)} → ${esc(next.title)}</em>
       </a>`
    : `<p class="cta cta--done">Everything built so far is complete. More modules to come.</p>`;

  const banner = loadError
    ? `<div class="banner banner--error">
         <b>Content did not load.</b> ${esc(loadError)}
       </div>`
    : `<div class="banner">
         <b>Stub content.</b> Module 02 is six placeholder concepts, all flagged
         <code>verify: true</code>. No clinical numbers have been entered and nothing has been
         reviewed against a source text.
       </div>`;

  return `
  <section class="ladder">
    <div class="hero">
      ${markSVG(status)}
      <div>
        <h1>Ladder One Academy</h1>
        <p class="tagline">Climb to certified.</p>
        ${continueBtn}
      </div>
      ${meter(computeReadiness(state, modulesByTier.emt || [], cardsByTier.emt || [], 'emt', MODULES_IN_TIER.emt))}
    </div>
    ${banner}
    <p class="ladder-tools">
      <a href="#/test">Test Center</a> — module exams, the full simulation and adaptive practice.
      <span class="sep">·</span>
      <a href="#/library">Library</a> — search every concept, card, mnemonic and drug written so far.
    </p>
    <div class="rungs">
      ${TIERS.map(t => tierCard(t, status[t.key], {
        modules: modulesByTier[t.key] || [],
        progress: progressByTier[t.key],
        attested: isAttested(state, t.key),
        progressByModule: state.modules || {},
        state
      })).join('')}
    </div>
  </section>`;
}
