/* ==========================================================================
   deck.js — the Deck screen. Today's due cards, flipped and graded.

   Unverified cards are kept out of the deck. That rule was set when `verify`
   was added to card.schema.json: drilling an unverified fact is worse than not
   drilling it, because repetition is exactly what makes something stick. While
   the whole deck is drafts that leaves the deck empty, so dev mode lets them
   through behind the usual banner — the same escape hatch the question bank has.

   Session state is in memory. A half-finished session is not progress, and the
   grades that have already been given are written the moment they are given.
   ========================================================================== */

import { load as loadProgress, update as updateProgress, devMode } from './progress.js';
import { GRADES, isDue, grade, previewAll, today, retention } from './srs.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TYPE_LABEL = {
  concept: 'Concept', drug: 'Drug', skill: 'Skill', numbers: 'Numbers',
  algorithm: 'Algorithm', mnemonic: 'Mnemonic', compare: 'Compare'
};

/** null when no session is running. */
let session = null;

export function abandon() { session = null; }
export function isRunning() { return Boolean(session); }

/** Cards this deck may serve at all. */
export function servableCards(deck) {
  return (deck?.cards || []).filter(c => !c.verify || devMode());
}

export function dueCards(state, deck) {
  return servableCards(deck).filter(c => isDue(state, c));
}

export function start(deck, mode) {
  const state = loadProgress();
  const pool = mode === 'all' ? servableCards(deck) : dueCards(state, deck);
  session = {
    mode,
    queue: pool.map(c => c.id),
    cards: Object.fromEntries(pool.map(c => [c.id, c])),
    i: 0,
    flipped: false,
    done: 0,
    graded: { again: 0, hard: 0, good: 0, easy: 0 }
  };
  return session;
}

export function flip() { if (session) session.flipped = true; }

export function rate(result) {
  if (!session || !session.flipped) return;
  const id = session.queue[session.i];
  if (!id) return;

  updateProgress(state => {
    const srs = state.srs || (state.srs = {});
    srs[id] = grade(srs[id], result);
  });

  session.graded[result] = (session.graded[result] || 0) + 1;
  session.done += 1;
  session.flipped = false;

  if (result === 'again') {
    // Still learning: move it to the back of today's queue rather than dropping it.
    session.queue.push(id);
  }
  session.i += 1;
}

/* --- Render --------------------------------------------------------------- */

function cardFace(card, side) {
  if (side === 'front') {
    return `<div class="dcard__body">
      <h2 class="dcard__title">${esc(card.front.title)}</h2>
      ${card.front.summary ? `<p class="dcard__summary">${esc(card.front.summary)}</p>` : ''}
    </div>`;
  }
  return `<div class="dcard__body">
    <p class="dcard__text">${esc(card.back.body)}</p>
    ${card.back.why_it_matters ? `<p class="dcard__why">Why it matters: ${esc(card.back.why_it_matters)}</p>` : ''}
  </div>`;
}

export function renderDeck(mod, deck) {
  const state = loadProgress();
  const all = deck?.cards || [];
  const servable = servableCards(deck);
  const withheld = all.length - servable.length;
  const due = dueCards(state, deck);
  const ret = retention(state, servable);

  if (session) return renderSession(deck);

  if (!servable.length) {
    return `<section class="deckview">
      <nav class="crumb"><a href="#/">Ladder</a> <span>›</span> Deck</nav>
      <h1>Deck</h1>
      <div class="stub-box">
        <h2>Nothing to study</h2>
        ${withheld
          ? `<p><span class="num">${withheld}</span> card${withheld === 1 ? ' is' : 's are'} flagged
             <code>verify: true</code> and kept out of the spaced-repetition deck. Repetition is what makes a
             fact stick, so drilling an unverified one is worse than not drilling it.</p>
             <p class="quiz-note">Turn on dev mode in the footer to study stub cards anyway.</p>`
          : `<p>This module has no cards yet.</p>`}
      </div>
    </section>`;
  }

  return `
  <section class="deckview">
    <nav class="crumb"><a href="#/">Ladder</a> <span>›</span> Deck</nav>
    <h1>${esc(mod?.short_title || mod?.title || 'Deck')}</h1>

    <div class="deck-stats">
      <div class="stat"><span class="stat__n num">${due.length}</span><span class="stat__l">due today</span></div>
      <div class="stat"><span class="stat__n num">${servable.length}</span><span class="stat__l">cards in deck</span></div>
      <div class="stat"><span class="stat__n num">${ret == null ? '—' : ret + '%'}</span><span class="stat__l">retention</span></div>
    </div>

    ${withheld ? `<div class="verify-banner" role="note">
      <b>${withheld} card${withheld === 1 ? '' : 's'} withheld.</b> Flagged <code>verify: true</code> and kept out of
      the deck unless dev mode is on — repetition is what makes a fact stick, so drilling an unverified one is worse
      than not drilling it.
    </div>` : ''}

    <div class="deck-actions">
      <button type="button" class="cta" id="deck-study" ${due.length ? '' : 'disabled'}>
        Study ${due.length} due card${due.length === 1 ? '' : 's'}
      </button>
      <button type="button" id="deck-study-all">Study all ${servable.length} cards</button>
    </div>
    ${due.length ? '' : `<p class="meta">Nothing is due today. "Study all" runs the whole module without waiting
      for the schedule — useful before an exam, but it reschedules every card you grade.</p>`}

    <h2 class="deck-sub">What is in the deck</h2>
    <ul class="deck-table">
      ${servable.map(c => {
        const s = state.srs?.[c.id];
        const when = !s ? 'new' : (s.due <= today() ? 'due' : s.due);
        return `<li>
          <span class="num">${String(c.number).padStart(2, '0')}</span>
          <span class="deck-table__t">${esc(c.front.title)}</span>
          <em>${esc(TYPE_LABEL[c.type] || c.type)}</em>
          <span class="deck-table__d ${when === 'due' || when === 'new' ? 'is-due' : ''}">${esc(when)}</span>
        </li>`;
      }).join('')}
    </ul>
  </section>`;
}

function renderSession(deck) {
  const id = session.queue[session.i];

  if (!id) {
    const g = session.graded;
    return `
    <section class="deckview">
      <nav class="crumb"><a href="#/">Ladder</a> <span>›</span> Deck</nav>
      <div class="quiz-result is-pass">
        <h2>Session finished</h2>
        <p class="score"><span class="num">${session.done}</span> card${session.done === 1 ? '' : 's'} reviewed</p>
        <table class="domains">
          <tr><th>Again</th><th>Hard</th><th>Good</th><th>Easy</th></tr>
          <tr><td class="num">${g.again}</td><td class="num">${g.hard}</td><td class="num">${g.good}</td><td class="num">${g.easy}</td></tr>
        </table>
        <p>Anything graded <b>Again</b> came back to the end of today's queue and is scheduled for today.</p>
        <div class="quiz-actions">
          <button type="button" class="cta" id="deck-back">Back to the deck</button>
          <a class="back" href="#/">Back to the Ladder</a>
        </div>
      </div>
    </section>`;
  }

  const card = session.cards[id];
  const state = loadProgress();
  const preview = previewAll(state.srs?.[id]);
  const remaining = session.queue.length - session.i;

  return `
  <section class="deckview">
    <nav class="crumb"><a href="#/">Ladder</a> <span>›</span> Deck
      <span>›</span> ${session.mode === 'all' ? 'Studying all' : 'Due today'}</nav>

    <div class="deck-progress">
      <span><span class="num">${remaining}</span> left in this session</span>
      <button type="button" id="deck-stop">End session</button>
    </div>

    <div class="dcard tier-emt ${session.flipped ? 'is-flipped' : ''}">
      <div class="dcard__bar"></div>
      <div class="dcard__head">
        <span class="dcard__type">${esc(TYPE_LABEL[card.type] || card.type)}</span>
        <span class="dcard__n num">${String(card.number).padStart(2, '0')}</span>
      </div>
      ${cardFace(card, session.flipped ? 'back' : 'front')}
      ${card.verify ? `<p class="dcard__verify">Unverified — not study material</p>` : ''}
    </div>

    ${session.flipped
      ? `<div class="deck-grade">
           ${GRADES.map(([key, label, hint]) => `
             <button type="button" data-grade="${key}" class="grade grade--${key}">
               <span class="grade__l">${label}</span>
               <span class="grade__w num">${esc(preview[key])}</span>
               <span class="grade__h">${esc(hint)}</span>
             </button>`).join('')}
         </div>`
      : `<div class="deck-actions">
           <button type="button" class="cta" id="deck-flip">Show the answer</button>
           <span class="mode-foot__hint">Say it out loud first. Recall beats recognition.</span>
         </div>`}
  </section>`;
}
