/* ==========================================================================
   worksheet.js — worksheet generator v1.

   For any lesson, builds a branded printable worksheet:
     - fill-in-the-blank items generated from each concept's key_points, with
       one term blanked per item
     - a label-the-diagram page for any concept that has media
     - an answer key on the last page

   Everything is generated from a seed, so "new version" produces a different
   worksheet from the same content rather than the same sheet reshuffled into a
   different order. The seed is shown on the sheet so a printed worksheet can be
   regenerated exactly.

   What gets blanked is chosen by a small set of rules rather than by marking up
   the content: a figure with units, a capitalised term, or the longest content
   word. Those rules are documented in pickBlank() because they are the part
   most likely to need tuning once real worksheets get used.
   ========================================================================== */

import { STAMP } from './print.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* --- Seeded randomness ---------------------------------------------------- */

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function newSeed() { return Math.floor(Math.random() * 1e6); }

function shuffled(arr, rnd) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* --- Blanking ------------------------------------------------------------- */

const STOP = new Set(['the','and','that','with','from','this','their','than','when','which','into','over',
  'them','they','have','been','will','what','while','because','before','after','every','other','there',
  'about','under','where','being','does','only','more','most','some','also','make','makes','need','needs',
  'until','through','patient','patients']);

/**
 * Choose what to blank in one key point, in priority order:
 *   1. a figure with a unit or range — "10 to 15 L/min", "15 seconds", "30:2"
 *   2. a capitalised term or acronym that is not sentence-initial
 *   3. the longest remaining content word
 * Returns null when nothing is worth blanking, and the caller skips that item.
 */
export function pickBlank(text, rnd) {
  const candidates = [];

  const numeric = /\b\d+(?:\.\d+)?(?:\s*(?:to|–|-|:)\s*\d+(?:\.\d+)?)?(?:\s*(?:%|per cent|seconds?|minutes?|hours?|L\/min|mmHg|cm H2O|cm|in|inches?|mL\/min|beats? per minute|per minute))?/gi;
  for (const m of text.matchAll(numeric)) {
    if (m[0].trim().length >= 2) candidates.push({ text: m[0].trim(), index: m.index, weight: 3 });
  }

  const caps = /\b(?:[A-Z]{2,}(?:-[A-Z]+)?|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  for (const m of text.matchAll(caps)) {
    if (m.index > 0 && m[0].length >= 3) candidates.push({ text: m[0], index: m.index, weight: 2 });
  }

  // Prefer a word that is not sentence-initial: blanking the first word of an
  // item leaves a prompt that starts with a rule and reads badly.
  const words = [...text.matchAll(/\b[a-z]{6,}\b/gi)]
    .filter(m => !STOP.has(m[0].toLowerCase()) && m.index > 0)
    .sort((a, b) => b[0].length - a[0].length);
  if (words[0]) candidates.push({ text: words[0][0], index: words[0].index, weight: 1 });

  if (!candidates.length) return null;
  const top = Math.max(...candidates.map(c => c.weight));
  const best = candidates.filter(c => c.weight === top);
  return best[Math.floor(rnd() * best.length)];
}

export function blankItem(text, rnd) {
  const pick = pickBlank(text, rnd);
  if (!pick) return null;
  const rule = '_'.repeat(Math.max(10, Math.min(30, pick.text.length + 6)));
  return {
    prompt: text.slice(0, pick.index) + rule + text.slice(pick.index + pick.text.length),
    answer: pick.text
  };
}

/* --- Building ------------------------------------------------------------- */

export function buildWorksheet(mod, lesson, seed, perConcept = 3) {
  const rnd = mulberry32(seed);
  const byId = Object.fromEntries(mod.concepts.map(c => [c.id, c]));
  const items = [];
  const diagrams = [];

  for (const id of lesson.concepts) {
    const c = byId[id];
    if (!c) continue;
    const picked = shuffled(c.key_points || [], rnd).slice(0, perConcept);
    for (const kp of picked) {
      const item = blankItem(kp, rnd);
      if (item) items.push({ ...item, conceptId: id, conceptTitle: c.title });
    }
    for (const m of (c.media || [])) diagrams.push({ ...m, conceptId: id, conceptTitle: c.title });
  }

  return { items: shuffled(items, rnd), diagrams, seed };
}

/* --- Render --------------------------------------------------------------- */

function footer(mod, lesson, page, pages, seed) {
  return `<div class="l1a-page__footer">
    <span>Ladder One Academy · Rung 1 · EMT · Module ${mod.number} — ${esc(mod.short_title || mod.title)} · ${esc(lesson.title)}</span>
    <span class="num">v${seed} · page ${page} of ${pages}</span>
  </div>`;
}

function head(mod, lesson, title, sub) {
  return `<div class="l1a-page__head">
    <span class="l1a-page__stamp">
      <svg viewBox="0 0 200 240" aria-hidden="true">${STAMP.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>
      <span>Ladder One Academy<small>Climb to certified</small></span>
    </span>
    <span>
      <h1 class="l1a-page__title">${esc(title)}</h1>
      <p class="l1a-page__meta">${esc(sub)}</p>
    </span>
  </div>`;
}

export function renderWorksheet(mod, lesson, sheet) {
  const { items, diagrams, seed } = sheet;
  const PER_PAGE = 12;
  const pages = [];
  for (let i = 0; i < items.length; i += PER_PAGE) pages.push(items.slice(i, i + PER_PAGE));
  const total = pages.length + diagrams.length + 1;
  let n = 0;
  let out = '';

  pages.forEach(group => {
    n++;
    const start = (n - 1) * PER_PAGE;
    out += `
    <div class="l1a-page tier-emt worksheet">
      <div class="l1a-bar"></div>
      ${head(mod, lesson, 'Worksheet', `${lesson.title} · fill in the blank`)}
      <div class="l1a-page__fields"><span>Name</span><span>Date</span><span>Score</span></div>
      <ol class="ws-items" start="${start + 1}">
        ${group.map(it => `<li><span class="ws-q">${esc(it.prompt)}</span></li>`).join('')}
      </ol>
      ${footer(mod, lesson, n, total, seed)}
    </div>`;
  });

  diagrams.forEach(d => {
    n++;
    out += `
    <div class="l1a-page tier-emt worksheet">
      <div class="l1a-bar"></div>
      ${head(mod, lesson, 'Label the diagram', esc(d.conceptTitle))}
      <div class="l1a-page__fields"><span>Name</span><span>Date</span></div>
      <p class="ws-instr">Name each labelled structure or box shown. Write your answers in the numbered lines.</p>
      <div class="ws-diagram"><img src="${esc(d.src)}" alt="${esc(d.alt)}"></div>
      <ol class="ws-lines">
        ${Array.from({ length: 8 }, () => '<li></li>').join('')}
      </ol>
      ${footer(mod, lesson, n, total, seed)}
    </div>`;
  });

  n++;
  out += `
  <div class="l1a-page tier-emt worksheet answers">
    <div class="l1a-bar"></div>
    ${head(mod, lesson, 'Answer key', `${lesson.title} · version ${seed}`)}
    <ol class="ws-key">
      ${items.map(it => `<li><b>${esc(it.answer)}</b> <em>${esc(it.conceptTitle)}</em></li>`).join('')}
    </ol>
    ${diagrams.length ? `<p class="ws-instr"><b>Label-the-diagram pages:</b> answers are the structures named in
      each diagram itself. ${diagrams.map(d => esc(d.caption || d.conceptTitle)).join(' ')}</p>` : ''}
    ${footer(mod, lesson, n, total, seed)}
  </div>`;

  return out;
}

export function renderWorksheetView(mod, lesson, sheet) {
  if (!mod || !lesson) {
    return `<section class="stub"><h1>Not found</h1><p>No loaded lesson has that id.</p>
      <p><a class="back" href="#/">Back to the Ladder</a></p></section>`;
  }
  const unverified = mod.concepts.filter(c => lesson.concepts.includes(c.id) && c.verify).length;
  return `
  <section class="printview worksheetview">
    <div class="printview__chrome no-print">
      <nav class="crumb"><a href="#/">Ladder</a> <span>›</span>
        <a href="#/module/${encodeURIComponent(mod.id)}">${esc(mod.short_title || mod.title)}</a>
        <span>›</span> Worksheet</nav>
      <h1>${esc(lesson.title)}</h1>
      <p class="meta"><span class="num">${sheet.items.length}</span> fill-in-the-blank items ·
        <span class="num">${sheet.diagrams.length}</span> label-the-diagram page${sheet.diagrams.length === 1 ? '' : 's'} ·
        answer key on the last page · version <span class="num">${sheet.seed}</span></p>

      ${unverified ? `<div class="verify-banner" role="note">
        <b>Generated from unverified content.</b> ${unverified} of this lesson's concepts are flagged
        <code>verify: true</code>, so the answer key is only as correct as the source it came from.
      </div>` : ''}

      <div class="printview__actions">
        <button type="button" id="ws-new">New version</button>
        <button type="button" id="do-print">Print worksheet</button>
        <span class="mode-foot__hint">Print at <b>100% scale</b>. A new version reshuffles which term is blanked
          in each item as well as the order, so the same lesson gives a different sheet each time.</span>
      </div>
    </div>
    <div class="paper-stage">${renderWorksheet(mod, lesson, sheet)}</div>
  </section>`;
}
