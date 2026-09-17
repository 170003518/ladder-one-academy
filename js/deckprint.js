/* ==========================================================================
   deckprint.js — print a whole deck, four 3x5 cards to a Letter sheet.

   Sheet order is front, back, front, back … through the deck, so each back
   sheet immediately follows the fronts it belongs to. What changes between the
   two modes is whether the backs are mirrored:

     duplex        The printer turns the paper over on the long edge, which
                   flips the sheet left-to-right. The backs grid is therefore
                   mirrored (direction: rtl) so each back lands behind its own
                   front. Print double-sided, flip on long edge.

     single-sided  Nothing is turned over. You print every sheet one-sided, cut
                   the fronts and the backs, and pair them by position. A mirror
                   would put every back behind the wrong front, so the backs are
                   NOT mirrored in this mode.

   Mirroring is an artefact of the flip, not a property of the deck. That is the
   whole difference between the two modes.
   ========================================================================== */

import { cardFront, cardBack } from './print.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PER_SHEET = 4;   // 2 columns x 2 rows of 3x5in inside a 7.5x10in live area

const state = {
  scope: 'module',       // module | lesson | custom
  moduleId: null,
  lessonId: null,
  selected: new Set(),   // card ids, for scope 'custom'
  mode: 'duplex'         // duplex | single
};

export function getState() { return state; }
export function setScope(scope) { state.scope = scope; }
export function setLesson(lessonId) { state.lessonId = lessonId; state.scope = 'lesson'; }
export function setModule(moduleId) { state.moduleId = moduleId; }
export function setMode(mode) { state.mode = mode; }

export function toggleCard(cardId) {
  if (state.selected.has(cardId)) state.selected.delete(cardId);
  else state.selected.add(cardId);
}
export function selectAll(cards) { cards.forEach(c => state.selected.add(c.id)); }
export function selectNone() { state.selected.clear(); }

/** The cards this selection resolves to, in deck (print) order. */
export function selectedCards(mod, deck) {
  const all = (deck?.cards || []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
  if (state.scope === 'module') return all;
  if (state.scope === 'lesson') {
    const lesson = (mod?.lessons || []).find(l => l.id === state.lessonId);
    if (!lesson) return [];
    return all.filter(c => lesson.concepts.includes(c.concept_id));
  }
  return all.filter(c => state.selected.has(c.id));
}

export function chunk(cards, size = PER_SHEET) {
  const out = [];
  for (let i = 0; i < cards.length; i += size) out.push(cards.slice(i, i + size));
  return out;
}

/* --- Sheets --------------------------------------------------------------- */

function sheet(cards, kind, index, total, mirrored) {
  const label = kind === 'front' ? 'Fronts' : 'Backs';
  const body = cards.map(c => (kind === 'front' ? cardFront(c) : cardBack(c))).join('');
  const range = cards.length
    ? `cards ${cards[0].number}–${cards[cards.length - 1].number}`
    : 'empty';
  return `
    <p class="stage-label no-print">Sheet ${index} of ${total} · ${label} · ${range}${
      mirrored ? ' · mirrored for the flip' : ''}</p>
    <div class="l1a-sheet${mirrored ? ' l1a-sheet--backs' : ''}" data-sheet="${kind}" data-sheet-index="${index}">
      ${body}
    </div>`;
}

export function renderSheets(cards) {
  const groups = chunk(cards);
  const mirrorBacks = state.mode === 'duplex';
  const totalSheets = groups.length * 2;
  let n = 0;
  return groups.map(group => {
    const front = sheet(group, 'front', ++n, totalSheets, false);
    const back = sheet(group, 'back', ++n, totalSheets, mirrorBacks);
    return front + back;
  }).join('');
}

/* --- Render --------------------------------------------------------------- */

export function renderDeckPrint(mod, deck) {
  if (!mod || !deck) {
    return `<section class="stub"><h1>Nothing to print</h1>
      <p>No module is loaded.</p><p><a class="back" href="#/">Back to the Ladder</a></p></section>`;
  }
  if (!state.moduleId) state.moduleId = mod.id;

  const all = (deck.cards || []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
  const cards = selectedCards(mod, deck);
  const sheets = chunk(cards).length;
  const unverified = cards.filter(c => c.verify).length;

  const lessonOptions = (mod.lessons || []).map(l => {
    const count = all.filter(c => l.concepts.includes(c.concept_id)).length;
    return `<option value="${esc(l.id)}" ${state.lessonId === l.id ? 'selected' : ''}>
      ${esc(l.title)} (${count} card${count === 1 ? '' : 's'})</option>`;
  }).join('');

  const picker = state.scope === 'custom'
    ? `<div class="deck-pick">
         <div class="deck-pick__bar">
           <button type="button" id="deck-all">Select all</button>
           <button type="button" id="deck-none">Select none</button>
           <span class="mode-foot__hint"><span class="num">${state.selected.size}</span> selected</span>
         </div>
         <ul class="deck-list">
           ${all.map(c => `
             <li>
               <label>
                 <input type="checkbox" data-deck-card="${esc(c.id)}" ${state.selected.has(c.id) ? 'checked' : ''}>
                 <span class="num">${String(c.number).padStart(2, '0')}</span>
                 <span>${esc(c.front.title)}</span>
                 <em>${esc(c.type)}${c.verify ? ' · unverified' : ''}</em>
               </label>
             </li>`).join('')}
         </ul>
       </div>`
    : '';

  return `
  <section class="printview deckprint">
    <div class="printview__chrome no-print">
      <nav class="crumb"><a href="#/">Ladder</a> <span>›</span> Print a deck</nav>
      <h1>${esc(mod.title)} — deck</h1>

      <div class="deck-opts">
        <fieldset>
          <legend>What to print</legend>
          <label><input type="radio" name="deck-scope" data-deck-scope="module" ${state.scope === 'module' ? 'checked' : ''}>
            Whole module <em>${all.length} cards</em></label>
          <label><input type="radio" name="deck-scope" data-deck-scope="lesson" ${state.scope === 'lesson' ? 'checked' : ''}>
            One lesson</label>
          <select id="deck-lesson" ${state.scope === 'lesson' ? '' : 'disabled'}>
            <option value="">Choose a lesson…</option>${lessonOptions}
          </select>
          <label><input type="radio" name="deck-scope" data-deck-scope="custom" ${state.scope === 'custom' ? 'checked' : ''}>
            Pick cards</label>
        </fieldset>

        <fieldset>
          <legend>How your printer feeds</legend>
          <label><input type="radio" name="deck-mode" data-deck-mode="duplex" ${state.mode === 'duplex' ? 'checked' : ''}>
            Double-sided <em>flip on the <b>long edge</b>; backs are mirrored so they land behind their fronts</em></label>
          <label><input type="radio" name="deck-mode" data-deck-mode="single" ${state.mode === 'single' ? 'checked' : ''}>
            Single-sided <em>print every sheet one side up, cut both, pair by position; backs are <b>not</b> mirrored</em></label>
        </fieldset>
      </div>

      ${picker}

      <div class="printview__actions">
        <button type="button" id="do-print" ${cards.length ? '' : 'disabled'}>Print ${cards.length} card${cards.length === 1 ? '' : 's'}</button>
        <span class="mode-foot__hint">
          <span class="num">${sheets}</span> front sheet${sheets === 1 ? '' : 's'} +
          <span class="num">${sheets}</span> back sheet${sheets === 1 ? '' : 's'} =
          <span class="num">${sheets * 2}</span> pages.
          Print at <b>100% scale</b>, not "fit to page".
        </span>
      </div>

      ${unverified ? `<div class="verify-banner" role="note">
        <b>${unverified} of ${cards.length} cards are unverified.</b>
        They print with an "Unverified — not for study" mark. Nothing in this deck has been
        checked against a source text yet.
      </div>` : ''}

      ${cards.length ? '' : `<p class="meta">Nothing selected, so there is nothing to print.</p>`}
    </div>

    <div class="paper-stage">${renderSheets(cards)}</div>
  </section>`;
}
