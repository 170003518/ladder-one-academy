/* ==========================================================================
   sort.js — sort_into_buckets for Do It mode.

   Two ways in, because the thing runs on a phone and a laptop:
     - tap an item to select it, then tap a bucket to drop it there
     - drag an item onto a bucket with a mouse

   Answers are not marked as you go. You place everything, hit Check, and only
   then find out what was wrong — sorting is a judgement exercise, and marking
   each drop instantly turns it into trial and error.
   ========================================================================== */

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** conceptId -> { placed: {itemIndex: bucketIndex}, selected, checked } */
const runs = new Map();

function runFor(conceptId) {
  if (!runs.has(conceptId)) runs.set(conceptId, { placed: {}, selected: null, checked: false });
  return runs.get(conceptId);
}

export function reset(conceptId) { runs.delete(conceptId); }
export function abandonAll() { runs.clear(); }

/** Tap an item: select it, or deselect if it was already selected. */
export function select(conceptId, itemIndex) {
  const run = runFor(conceptId);
  if (run.checked) return;
  run.selected = run.selected === itemIndex ? null : itemIndex;
}

/** Tap a bucket: drop the selected item, if there is one. */
export function drop(conceptId, bucketIndex, itemIndex) {
  const run = runFor(conceptId);
  if (run.checked) return;
  const item = itemIndex != null ? itemIndex : run.selected;
  if (item == null) return;
  run.placed[item] = bucketIndex;
  run.selected = null;
}

/** Take an item back out of its bucket. */
export function unplace(conceptId, itemIndex) {
  const run = runFor(conceptId);
  if (run.checked) return;
  delete run.placed[itemIndex];
  run.selected = null;
}

export function check(conceptId) {
  const run = runFor(conceptId);
  run.checked = true;
  run.selected = null;
}

export function isChecked(conceptId) { return runFor(conceptId).checked; }

/* --- Render --------------------------------------------------------------- */

export function renderSort(concept) {
  const mode = concept.modes.do;
  const cfg = mode.config || {};
  const buckets = cfg.buckets || [];
  const items = cfg.items || [];
  const run = runFor(concept.id);

  const unplaced = items.map((it, i) => i).filter(i => run.placed[i] === undefined);
  const allPlaced = unplaced.length === 0;
  const right = items.filter((it, i) => run.placed[i] === it.bucket).length;

  const tray = unplaced.map(i => `
    <button type="button" class="sort-item ${run.selected === i ? 'is-selected' : ''}"
            data-sort-item="${i}" draggable="true"
            aria-pressed="${run.selected === i}">${esc(items[i].text)}</button>`).join('');

  const bucketCols = buckets.map((name, b) => {
    const mine = items.map((it, i) => i).filter(i => run.placed[i] === b);
    const chips = mine.map(i => {
      const correct = items[i].bucket === b;
      const cls = run.checked ? (correct ? 'is-right' : 'is-wrong') : '';
      return `<button type="button" class="sort-item sort-item--placed ${cls}"
                data-sort-unplace="${i}" ${run.checked ? 'disabled' : ''}>
                ${esc(items[i].text)}
                ${run.checked && !correct ? `<em class="sort-belongs">→ ${esc(buckets[items[i].bucket])}</em>` : ''}
              </button>`;
    }).join('');
    return `
    <div class="sort-bucket ${run.selected !== null && !run.checked ? 'is-target' : ''}" data-sort-bucket="${b}">
      <h3>${esc(name)} <span class="sort-count num">${mine.length}</span></h3>
      <div class="sort-drop">${chips || `<p class="sort-empty">${run.checked ? 'Nothing here.' : 'Drop items here'}</p>`}</div>
    </div>`;
  }).join('');

  return `
  <div class="sort" data-activity="${esc(mode.activity || '')}">
    ${mode.prompt ? `<p class="do-prompt">${esc(mode.prompt)}</p>` : ''}

    ${run.checked ? '' : `
      <p class="sort-how">Tap an item, then tap a bucket. On a desktop you can drag instead.</p>
      <div class="sort-tray">${tray || '<p class="sort-empty">Everything is placed.</p>'}</div>`}

    <div class="sort-buckets">${bucketCols}</div>

    <div class="do-foot">
      ${run.checked
        ? `<p class="do-score"><span class="num">${right}</span> of <span class="num">${items.length}</span> sorted correctly</p>
           <button type="button" id="sort-reset">Start over</button>`
        : `<button type="button" id="sort-check" ${allPlaced ? '' : 'disabled'}>Check answers</button>
           <span class="mode-foot__hint">${allPlaced
             ? 'Everything is placed.'
             : `<span class="num">${unplaced.length}</span> still to place.`}</span>`}
    </div>
    <p class="do-note">Practice only — nothing here is recorded or gated on.</p>
  </div>`;
}
