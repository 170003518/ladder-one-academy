/* ==========================================================================
   print.js — the print route. Renders one card's front and back using the real
   classes from brand/print.css, so what is on screen is what comes out of the
   printer. The only difference is the paper-coloured stage behind it.

   Print at 100% scale, not "fit to page", or the card will not measure 3x5.
   ========================================================================== */

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const TIER_CLASS = { EMT: 'tier-emt', Fire: 'tier-fire', Paramedic: 'tier-medic' };

export const TYPE_LABEL = {
  concept: 'Concept', drug: 'Drug', skill: 'Skill', numbers: 'Numbers',
  algorithm: 'Algorithm', mnemonic: 'Mnemonic', compare: 'Compare'
};

/* The mark, single colour, inherits the surrounding ink. Same geometry as
   brand/logo-mono.svg. */
export const STAMP = `<svg viewBox="0 0 200 240" aria-hidden="true">
  <path d="M100 6 L188 30 V132 C188 186 148 218 100 234 C52 218 12 186 12 132 V30 Z"
        fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>
  <rect x="93.5" y="37" width="13" height="50"/>
  <rect x="93.5" y="37" width="13" height="50" transform="rotate(60 100 62)"/>
  <rect x="93.5" y="37" width="13" height="50" transform="rotate(120 100 62)"/>
  <rect x="85.44" y="106.5" width="29.11" height="11" rx="2"/>
  <rect x="75.44" y="142.5" width="49.11" height="11" rx="2"/>
  <rect x="65.44" y="178.5" width="69.11" height="11" rx="2"/>
  <polygon points="84.5,92 97.5,92 67.5,200 54.5,200"/>
  <polygon points="115.5,92 102.5,92 132.5,200 145.5,200"/>
</svg>`;

/** Footer short form: "Rung 1 · EMT · Module 2 — Airway". No L1A prefix on cards. */
function footerLine(f) {
  return `Rung ${f.rung} · ${esc(f.tier)} · Module ${f.module_number} — ${esc(f.module_name)}`;
}

export function cardFront(card) {
  const f = card.footer;
  return `
  <div class="l1a-card ${TIER_CLASS[f.tier] || 'tier-emt'}">
    <div class="l1a-bar"></div>
    <div class="l1a-card__head">
      <span class="l1a-card__stamp">${STAMP}L1A</span>
      <span class="l1a-card__type">${esc(TYPE_LABEL[card.type] || card.type)}</span>
    </div>
    <h3 class="l1a-card__title">${esc(card.front.title)}</h3>
    ${card.front.summary ? `<p class="l1a-card__summary">${esc(card.front.summary)}</p>` : ''}
    <hr class="l1a-card__rule">
    ${card.high_yield ? '<span class="l1a-highyield">High-yield</span>' : ''}
    ${card.verify ? '<p class="l1a-card__verify">Unverified — not for study</p>' : ''}
    <div class="l1a-card__footer">
      <span>${footerLine(f)}</span>
      ${card.number != null ? `<span class="num">${String(card.number).padStart(2, '0')}</span>` : ''}
    </div>
  </div>`;
}

export function cardBack(card) {
  const f = card.footer;
  return `
  <div class="l1a-card ${TIER_CLASS[f.tier] || 'tier-emt'}">
    <div class="l1a-bar"></div>
    <div class="l1a-card__head">
      <span class="l1a-card__type">Back${card.number != null ? ` · ${String(card.number).padStart(2, '0')}` : ''}</span>
      <span class="l1a-card__stamp">${STAMP}L1A</span>
    </div>
    <hr class="l1a-card__rule">
    <div class="l1a-card__body"><p>${esc(card.back.body)}</p></div>
    ${card.back.why_it_matters ? `<p class="l1a-card__why">Why it matters: ${esc(card.back.why_it_matters)}</p>` : ''}
    <div class="l1a-card__footer">
      <span>${footerLine(f)}</span>
      ${card.number != null ? `<span class="num">${String(card.number).padStart(2, '0')}</span>` : ''}
    </div>
  </div>`;
}

export function renderPrintCard(card, deck) {
  if (!card) {
    return `<section class="stub"><h1>Card not found</h1>
      <p>Nothing in the loaded deck has that id.</p>
      <p><a class="back" href="#/">Back to the Ladder</a></p></section>`;
  }

  const others = (deck?.cards || []).filter(c => c.id !== card.id);

  return `
  <section class="printview">
    <div class="printview__chrome">
      <nav class="crumb"><a href="#/">Ladder</a> <span>›</span> Print a card</nav>
      <h1>${esc(card.front.title)}</h1>
      <p class="meta"><span class="num">${esc(card.id)}</span> · ${esc(TYPE_LABEL[card.type] || card.type)}
        · ${esc(card.print_size || '3x5')} in</p>
      ${card.verify ? `<div class="verify-banner" role="note">
        <b>Not verified.</b> ${esc(card.verify_notes || 'This card has been flagged for review.')}
        <span class="verify-banner__rule">It prints with an unverified mark and stays out of the spaced-repetition deck.</span>
      </div>` : ''}
      <div class="printview__actions">
        <button type="button" id="do-print">Print this card</button>
        <span class="mode-foot__hint">Print at <b>100% scale</b>, not "fit to page", or it will not measure 3 × 5 in.
          Front and back are on separate sheets so a duplex pass lands them together.</span>
      </div>
      ${others.length ? `<p class="meta">Others in this deck:
        ${others.map(c => `<a href="#/print/card/${encodeURIComponent(c.id)}">${esc(c.front.title)}</a>`).join(' · ')}</p>` : ''}
    </div>

    <div class="paper-stage">
      <p class="stage-label">Front</p>
      <div class="l1a-sheet">${cardFront(card)}</div>
      <p class="stage-label">Back — mirrored for a long-edge duplex flip</p>
      <div class="l1a-sheet l1a-sheet--backs">${cardBack(card)}</div>
    </div>
  </section>`;
}
