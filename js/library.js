/* ==========================================================================
   library.js — the Library: one searchable index of everything written.

   Four kinds of entry, drawn from different places in the content:
     concept   every concept in every loaded module
     card      every card in every loaded deck
     mnemonic  pulled out of concepts that carry card_data.mnemonic
     drug      pulled out of concepts that carry card_data.drug

   Mnemonics and drugs already exist as cards, so they would be findable
   anyway. They get their own entries because they are what you come to a
   library looking for by name — you want SLUDGEM or naloxone, not "the card
   attached to the concept about organophosphates". Their searchable text
   includes the full expansion and the drug fields, so searching for a letter
   of an acronym or an indication finds them.

   Everything links into the lesson. A card entry also links to its print view.
   ========================================================================== */

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const KINDS = ['concept', 'card', 'mnemonic', 'drug'];
const KIND_LABEL = { concept: 'Concept', card: 'Card', mnemonic: 'Mnemonic', drug: 'Drug' };

/* --- Index ---------------------------------------------------------------- */

/** Lower-cased haystack for one entry. Built once, searched many times. */
function haystack(parts) {
  return parts.filter(Boolean).join(' · ').toLowerCase();
}

/**
 * Build the whole index from loaded modules and decks.
 * @param {object[]} modules loaded module files
 * @param {object} decksByModule moduleId -> { cards: [] }
 */
export function buildIndex(modules, decksByModule) {
  const entries = [];

  for (const mod of modules) {
    const lessonOf = {};
    for (const l of mod.lessons) for (const id of l.concepts) lessonOf[id] = l;

    for (const c of mod.concepts) {
      const lesson = lessonOf[c.id];
      const where = { moduleId: mod.id, moduleTitle: mod.short_title || mod.title,
                      lessonId: lesson?.id, lessonTitle: lesson?.title };

      entries.push({
        kind: 'concept', id: c.id, title: c.title,
        sub: `${where.moduleTitle} · ${where.lessonTitle || ''}`.trim(),
        detail: (c.key_points || []).slice(0, 2).join(' · '),
        conceptId: c.id, verify: Boolean(c.verify), high: Boolean(c.high_yield),
        domain: c.domain, ...where,
        text: haystack([c.id, c.title, where.moduleTitle, where.lessonTitle, c.domain,
                        ...(c.key_points || []), ...(c.exam_favorites || [])])
      });

      const cd = c.card_data || {};

      if (cd.mnemonic) {
        const m = cd.mnemonic;
        entries.push({
          kind: 'mnemonic', id: `${c.id}#mnemonic`, title: m.acronym,
          sub: `${c.title} · ${where.moduleTitle}`,
          detail: (m.expansion || []).join(' · '),
          conceptId: c.id, verify: Boolean(c.verify), ...where,
          text: haystack([m.acronym, ...(m.expansion || []), m.memory_image,
                          c.title, where.moduleTitle, where.lessonTitle])
        });
      }

      if (cd.drug) {
        const d = cd.drug;
        entries.push({
          kind: 'drug', id: `${c.id}#drug`, title: d.generic,
          sub: [d.trade, d.class].filter(Boolean).join(' · '),
          detail: [d.route && `Route: ${d.route}`,
                   (d.indications || []).length && `For: ${d.indications.join('; ')}`,
                   d.scope].filter(Boolean).join(' · '),
          conceptId: c.id, verify: Boolean(c.verify), ...where,
          text: haystack([d.generic, d.trade, d.class, d.route, d.scope,
                          ...(d.indications || []), ...(d.contraindications || []),
                          ...(d.side_effects || []), c.title, where.moduleTitle])
        });
      }
    }

    for (const card of (decksByModule[mod.id]?.cards || [])) {
      const lesson = lessonOf[card.concept_id];
      entries.push({
        kind: 'card', id: card.id, title: card.front?.title || card.id,
        sub: `${KIND_LABEL.card} ${card.number} · ${card.type} · ${mod.short_title || mod.title}`,
        detail: card.front?.summary || '',
        conceptId: card.concept_id, cardId: card.id, cardType: card.type,
        verify: Boolean(card.verify), high: Boolean(card.high_yield),
        moduleId: mod.id, moduleTitle: mod.short_title || mod.title,
        lessonId: lesson?.id, lessonTitle: lesson?.title,
        text: haystack([card.id, card.type, card.front?.title, card.front?.summary,
                        card.back?.body, card.back?.why_it_matters,
                        mod.short_title || mod.title, lesson?.title])
      });
    }
  }

  entries.sort((a, b) => a.title.localeCompare(b.title));
  return entries;
}

/* --- Search --------------------------------------------------------------- */

/**
 * Filter the index. Every whitespace-separated term must appear somewhere in
 * the entry, so "naloxone dose" narrows rather than widens. Matching is plain
 * substring: no stemming, no fuzziness — for an index this size, predictable
 * beats clever.
 */
export function search(entries, query, kinds) {
  const terms = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter(e => {
    if (kinds && kinds.size && !kinds.has(e.kind)) return false;
    return terms.every(t => e.text.includes(t));
  });
}

/* --- Render --------------------------------------------------------------- */

function entryRow(e) {
  const links = [`<a class="lib-go" href="#/lesson/${encodeURIComponent(e.conceptId)}">Open lesson</a>`];
  if (e.kind === 'card') {
    links.push(`<a class="lib-go" href="#/print/card/${encodeURIComponent(e.cardId)}">Print card</a>`);
  }
  return `<li class="lib-row" data-kind="${e.kind}">
    <div class="lib-row__head">
      <span class="lib-kind lib-kind--${e.kind}">${KIND_LABEL[e.kind]}</span>
      <h3 class="lib-row__title">${esc(e.title)}</h3>
      ${e.high ? '<span class="lib-high" title="High yield">★</span>' : ''}
      ${e.verify ? '<span class="verify-flag" title="Unverified content">unverified</span>' : ''}
    </div>
    ${e.sub ? `<p class="lib-row__sub">${esc(e.sub)}</p>` : ''}
    ${e.detail ? `<p class="lib-row__detail">${esc(e.detail)}</p>` : ''}
    <p class="lib-row__links">${links.join('')}</p>
  </li>`;
}

/**
 * @param {object[]} entries the full index
 * @param {object} state { query, kinds:Set, limit }
 */
export function renderLibrary(entries, state) {
  const kinds = state.kinds;
  const hits = search(entries, state.query, kinds);
  const shown = hits.slice(0, state.limit);
  const counts = KINDS.reduce((a, k) => (a[k] = entries.filter(e => e.kind === k).length, a), {});

  return `<section class="library">
    <nav class="crumbs"><a href="#/">Ladder</a> <span>&rsaquo;</span> Library</nav>
    <h1>Library</h1>
    <p class="lead">Everything written so far, in one list: ${entries.length} entries across
      ${counts.concept} concepts, ${counts.card} cards, ${counts.mnemonic} mnemonics and
      ${counts.drug} drugs. Every entry opens its lesson.</p>

    <div class="lib-controls">
      <label class="lib-search">
        <span class="visually-hidden">Search the library</span>
        <input id="lib-q" type="search" placeholder="Search titles, key points, card text, drug indications…"
          value="${esc(state.query)}" autocomplete="off" spellcheck="false">
      </label>
      <div class="lib-kinds" role="group" aria-label="Filter by kind">
        ${KINDS.map(k => `<button class="lib-chip${kinds.has(k) ? ' is-on' : ''}" data-kind="${k}"
            aria-pressed="${kinds.has(k)}">${KIND_LABEL[k]}<span>${counts[k]}</span></button>`).join('')}
      </div>
    </div>

    <p class="lib-count" role="status">${hits.length} ${hits.length === 1 ? 'match' : 'matches'}${
      hits.length > shown.length ? ` · showing the first ${shown.length}` : ''}</p>

    ${hits.length === 0
      ? `<p class="lib-empty">Nothing matches that. Try fewer words, or turn a filter back on.</p>`
      : `<ul class="lib-list">${shown.map(entryRow).join('')}</ul>`}

    ${hits.length > shown.length
      ? `<p class="lib-more"><button id="lib-more" class="btn">Show more</button></p>` : ''}
  </section>`;
}
