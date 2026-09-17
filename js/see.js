/* ==========================================================================
   see.js — See It mode.
   Renders every media id listed in modes.see, resolved against the concept's
   own media[] manifest. Nothing renders that is not in the manifest — that is
   what makes master-plan §10.7's "nothing copyrighted slips in" enforceable.

   Click any figure to enlarge it into an overlay. Viewing marks the mode.
   ========================================================================== */

import { markViewed } from './lesson.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** conceptId -> media id currently enlarged, or null. */
let zoomed = { conceptId: null, mediaId: null };

export function zoom(conceptId, mediaId) { zoomed = { conceptId, mediaId }; }
export function closeZoom() { zoomed = { conceptId: null, mediaId: null }; }
export function isZoomed(conceptId) { return zoomed.conceptId === conceptId ? zoomed.mediaId : null; }

function resolve(concept) {
  const manifest = new Map((concept.media || []).map(m => [m.id, m]));
  return (concept.modes?.see || []).map(id => ({ id, item: manifest.get(id) }));
}

export function renderSee(concept) {
  const entries = resolve(concept);
  if (!entries.length) {
    return `<div class="stub-box"><h2>Nothing to show</h2>
      <p>This concept lists no media for See It.</p></div>`;
  }

  // Opening the tab is the whole of the mode — there is nothing to complete.
  markViewed(concept.id, 'see');

  const open = isZoomed(concept.id);

  const figures = entries.map(({ id, item }) => {
    if (!item) {
      return `<div class="stub-box">
        <h2>Missing from the manifest</h2>
        <p>See It lists <code>${esc(id)}</code>, but the concept's <code>media[]</code> has no entry with that id,
           so there is nothing to resolve it to.</p></div>`;
    }
    return `
    <figure class="see-fig">
      <button type="button" class="see-open" data-see-zoom="${esc(item.id)}"
              aria-label="Enlarge: ${esc(item.alt)}">
        <img src="${esc(item.src)}" alt="${esc(item.alt)}" loading="lazy">
        <span class="see-hint">Click to enlarge</span>
      </button>
      ${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ''}
      <p class="see-credit">
        ${esc(item.kind)}${item.source ? ` · ${esc(item.source)}` : ''}${item.license ? ` · ${esc(item.license)}` : ''}
        ${item.print_safe === false ? ' · <b>not print-safe</b>' : ''}
      </p>
    </figure>`;
  }).join('');

  const openItem = open ? (concept.media || []).find(m => m.id === open) : null;

  return `
  <div class="see">
    ${figures}
    ${openItem ? `
      <div class="see-zoom" role="dialog" aria-modal="true" aria-label="${esc(openItem.alt)}">
        <div class="see-zoom__bar">
          <span>${esc(openItem.caption || openItem.alt)}</span>
          <button type="button" id="see-close" aria-label="Close">Close</button>
        </div>
        <div class="see-zoom__stage">
          <img src="${esc(openItem.src)}" alt="${esc(openItem.alt)}">
        </div>
      </div>` : ''}
  </div>`;
}
