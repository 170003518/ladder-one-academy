/* ==========================================================================
   hear.js — Hear It mode, driven by the browser's SpeechSynthesis API.
   Decided in decisions.md: audio is text-to-speech, no generated files.

   Narrates modes.hear.script if the concept has one, otherwise the Read mode's
   standard layer, otherwise plain. Each paragraph is its own utterance, which
   is what makes per-paragraph highlighting possible and also sidesteps the
   long-utterance cutoff several browsers have.

   The highlight is written straight into the DOM rather than through a
   re-render: replacing innerHTML mid-speech would drop the highlighted node
   while the utterance kept going.
   ========================================================================== */

import { markViewed } from './lesson.js';

const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;

export const MIN_RATE = 0.8;
export const MAX_RATE = 1.5;

let state = { conceptId: null, paras: [], index: 0, rate: 1, status: 'idle' };

/** Which text gets read, and where it came from. */
export function narrationFor(concept) {
  const hear = concept.modes?.hear;
  const read = concept.modes?.read || {};
  if (hear?.script) return { text: hear.script, source: 'hear.script' };
  if (read.standard) return { text: read.standard, source: 'read.standard' };
  if (read.plain)    return { text: read.plain, source: 'read.plain' };
  return { text: '', source: null };
}

/**
 * Break the narration into speakable, highlightable pieces.
 *
 * Blank lines first, which is what the author intended. But read.standard is
 * usually authored as one unbroken 600-900 character block, and a single
 * paragraph makes the highlight meaningless and hands the browser one very long
 * utterance — which several of them truncate. So a long single block is chunked
 * on sentence boundaries instead, roughly two sentences at a time.
 */
const SENTENCE = /[^.!?]+[.!?]+[\s"')\]]*|[^.!?]+$/g;
const CHUNK_MAX = 240;
const CHUNK_IF_LONGER_THAN = 300;

export function split(text) {
  const paras = String(text || '').split(/\n{2,}/).map(t => t.trim()).filter(Boolean);
  if (paras.length > 1) return paras;

  const only = paras[0] || '';
  if (only.length <= CHUNK_IF_LONGER_THAN) return paras;

  const sentences = (only.match(SENTENCE) || [only]).map(t => t.trim()).filter(Boolean);
  const chunks = [];
  let cur = '';
  for (const sentence of sentences) {
    if (cur && cur.length + sentence.length + 1 > CHUNK_MAX) { chunks.push(cur); cur = sentence; }
    else cur = cur ? `${cur} ${sentence}` : sentence;
  }
  if (cur) chunks.push(cur);
  return chunks;
}

export function isSupported() { return Boolean(synth && typeof SpeechSynthesisUtterance === 'function'); }

/* --- DOM side ------------------------------------------------------------- */

function paint() {
  const root = document.querySelector('.hear');
  if (!root) return;
  root.querySelectorAll('.hear-para').forEach(el => {
    el.classList.toggle('is-reading', Number(el.dataset.i) === state.index && state.status === 'playing');
    el.classList.toggle('is-read', Number(el.dataset.i) < state.index);
  });
  const status = root.querySelector('.hear-status');
  if (status) {
    status.textContent = {
      idle: 'Ready.',
      playing: `Reading paragraph ${state.index + 1} of ${state.paras.length}.`,
      paused: `Paused at paragraph ${state.index + 1}.`,
      done: 'Finished.'
    }[state.status] || '';
  }
  const play = root.querySelector('#hear-play');
  if (play) play.textContent = state.status === 'playing' ? 'Pause' : (state.status === 'paused' ? 'Resume' : 'Play');
}

/* --- Playback ------------------------------------------------------------- */

function speakFrom(i) {
  if (!isSupported() || !state.paras.length) return;
  synth.cancel();
  state.index = Math.max(0, Math.min(i, state.paras.length - 1));
  state.status = 'playing';

  const speakOne = () => {
    if (state.status !== 'playing') return;
    if (state.index >= state.paras.length) {
      state.status = 'done';
      paint();
      // Playback ran to the end — that is what counts as having been through
      // the concept in this mode.
      if (state.conceptId) markViewed(state.conceptId, 'hear');
      const btn = document.querySelector('#mark-viewed');
      if (btn) { btn.disabled = true; btn.textContent = 'Viewed in Hear It'; }
      return;
    }
    const u = new SpeechSynthesisUtterance(state.paras[state.index]);
    u.rate = state.rate;
    u.onend = () => {
      if (state.status !== 'playing') return;
      state.index++;
      paint();
      speakOne();
    };
    u.onerror = err => {
      // A cancel() fires onerror in some browsers; only a real failure should stop us.
      if (state.status === 'playing' && err?.error && err.error !== 'interrupted' && err.error !== 'canceled') {
        console.warn('[l1a] speech error:', err.error);
        state.status = 'idle';
        paint();
      }
    };
    paint();
    synth.speak(u);
  };
  speakOne();
}

export function toggle(concept) {
  if (!isSupported()) return;
  if (state.conceptId !== concept.id) load(concept);

  if (state.status === 'playing') {
    synth.pause();
    state.status = 'paused';
    paint();
    return;
  }
  if (state.status === 'paused') {
    // resume() is unreliable across browsers; re-speaking the current paragraph
    // is predictable, at the cost of repeating a sentence or two.
    speakFrom(state.index);
    return;
  }
  speakFrom(state.status === 'done' ? 0 : state.index);
}

export function stop() {
  if (isSupported()) synth.cancel();
  state.status = 'idle';
  state.index = 0;
  paint();
}

export function setRate(rate) {
  state.rate = Math.min(MAX_RATE, Math.max(MIN_RATE, Number(rate) || 1));
  const label = document.querySelector('#hear-rate-label');
  if (label) label.textContent = `${state.rate.toFixed(2).replace(/0$/, '')}×`;
  // Rate only applies to a new utterance, so restart the paragraph in progress.
  if (state.status === 'playing') speakFrom(state.index);
  return state.rate;
}

export function load(concept) {
  const { text } = narrationFor(concept);
  if (isSupported()) synth.cancel();
  state = { conceptId: concept.id, paras: split(text), index: 0, rate: state.rate, status: 'idle' };
}

/** Called when leaving the view — nothing should keep talking. */
export function abandon() {
  if (isSupported()) synth.cancel();
  state = { conceptId: null, paras: [], index: 0, rate: state.rate, status: 'idle' };
}

/* --- Render --------------------------------------------------------------- */

export function renderHear(concept) {
  const { text, source } = narrationFor(concept);

  if (!text) {
    return `<div class="stub-box"><h2>Nothing to narrate</h2>
      <p>This concept has no <code>hear.script</code> and no Read mode text to fall back on.</p></div>`;
  }
  if (!isSupported()) {
    return `<div class="stub-box"><h2>Speech not available</h2>
      <p>This browser has no SpeechSynthesis support, so Hear It cannot play. The text it would read is
         the ${esc(source)} layer — use Read mode instead.</p></div>`;
  }

  if (state.conceptId !== concept.id) load(concept);
  const paras = state.paras;

  const SOURCE_LABEL = {
    'hear.script': 'a script written for listening',
    'read.standard': 'the Read mode, standard layer',
    'read.plain': 'the Read mode, plain English layer'
  };

  return `
  <div class="hear">
    <div class="hear-controls">
      <button type="button" id="hear-play">Play</button>
      <button type="button" id="hear-stop">Stop</button>
      <label class="hear-rate">
        Speed
        <input type="range" id="hear-rate" min="${MIN_RATE}" max="${MAX_RATE}" step="0.05" value="${state.rate}">
        <span id="hear-rate-label" class="num">${state.rate.toFixed(2).replace(/0$/, '')}×</span>
      </label>
      <span class="hear-status" role="status" aria-live="polite">Ready.</span>
    </div>
    <p class="hear-source">Reading ${esc(SOURCE_LABEL[source] || source)}. Voice and accent come from your
       operating system, not from the app.</p>
    <div class="hear-text">
      ${paras.map((p, i) => `<p class="hear-para" data-i="${i}">${esc(p)}</p>`).join('')}
    </div>
  </div>`;
}
