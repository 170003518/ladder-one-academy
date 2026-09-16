/* ==========================================================================
   progress.js — the only thing in the app that touches localStorage.
   One key: l1a.progress. The stored shape is exactly schemas/progress.schema.json,
   which is also the export file format, so an export is a real backup.

   Every read and write is wrapped in try/catch (CLAUDE.md non-negotiable):
   Safari private mode throws on setItem, storage can be full, and a corrupted
   value must never take the app down. A record that cannot be parsed is kept
   aside under l1a.progress.broken rather than overwritten.
   ========================================================================== */

const KEY = 'l1a.progress';
const BROKEN_KEY = 'l1a.progress.broken';
export const EXPORT_VERSION = '1.1.0';
const DEV_KEY = 'l1a.devMode';

/* --- Dev mode -------------------------------------------------------------
   Unverified content is barred from every question context. That makes the app
   correct and, while the whole bank is stubs, empty. Dev mode is the escape
   hatch: it lets flagged content through and puts a banner on every screen so
   there is no chance of mistaking a stub for study material. Default off. */
export function devMode() {
  try { return localStorage.getItem(DEV_KEY) === 'true'; }
  catch (err) { return false; }
}

export function setDevMode(on) {
  try { localStorage.setItem(DEV_KEY, on ? 'true' : 'false'); }
  catch (err) { console.warn('[l1a] could not persist dev mode:', err); }
  return devMode();
}

/** Tier order is the gating order. Index matters: each tier unlocks the next. */
export const TIERS = [
  { key: 'emt',   rung: 1, label: 'EMT',       name: 'Rung 1 — EMT',        css: 'tier-emt' },
  { key: 'fire',  rung: 2, label: 'Fire',      name: 'Rung 2 — Fire',       css: 'tier-fire' },
  { key: 'medic', rung: 3, label: 'Paramedic', name: 'Rung 3 — Paramedic',  css: 'tier-medic' }
];

function nowISO() { return new Date().toISOString(); }

/** A fresh record. EMT is open from day one; the rungs above it are not. */
export function blank() {
  return {
    export_version: EXPORT_VERSION,
    updated_at: nowISO(),
    concepts: {},
    modules: {},
    srs: {},
    question_history: [],
    tiers: {
      emt:   { status: 'unlocked', unlocked_on: nowISO(), simulations: [], skills_reviewed: false },
      fire:  { status: 'locked',  simulations: [], skills_reviewed: false },
      medic: { status: 'locked',  simulations: [], skills_reviewed: false }
    },
    current: { tier: 'emt' },
    streak: { current: 0, longest: 0 }
  };
}

let cache = null;

/** Read the record. Never throws — a bad or missing value yields a fresh one. */
export function load() {
  if (cache) return cache;
  let raw = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch (err) {
    console.warn('[l1a] localStorage unreadable, running in memory only:', err);
    cache = blank();
    return cache;
  }
  if (!raw) { cache = blank(); return cache; }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.tiers) throw new Error('not a progress record');
    const migrated = migrate(parsed);
    if (!migrated) {
      // A version we have no path from. Keep the old record, start clean —
      // never guess at a migration and never silently discard.
      console.warn('[l1a] progress written by version', parsed.export_version, '- expected', EXPORT_VERSION);
      try { localStorage.setItem(BROKEN_KEY, raw); } catch (_) { /* nothing more we can do */ }
      cache = blank();
      return cache;
    }
    cache = { ...blank(), ...migrated };
    if (migrated.export_version !== parsed.export_version) save(cache);
    return cache;
  } catch (err) {
    console.warn('[l1a] progress could not be parsed; set aside under', BROKEN_KEY, err);
    try { localStorage.setItem(BROKEN_KEY, raw); } catch (_) { /* ignore */ }
    cache = blank();
    return cache;
  }
}

/** Write the record. Returns true on success so callers can warn the user. */
export function save(state) {
  state.updated_at = nowISO();
  cache = state;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.warn('[l1a] progress could not be saved - changes are in memory only:', err);
    return false;
  }
}

/** Mutate through a callback, then persist. */
export function update(fn) {
  const state = load();
  fn(state);
  save(state);
  return state;
}

export function reset() {
  cache = null;
  try { localStorage.removeItem(KEY); } catch (err) { console.warn('[l1a] could not clear progress:', err); }
  return load();
}

/**
 * Bring an older record forward. Returns null when there is no path, which is
 * the signal to set the record aside rather than mangle it.
 *
 *   1.0.0 -> 1.1.0   adds question_history (empty: earlier answers were never
 *                    recorded, and inventing history would be worse than having
 *                    none). Per-concept lesson_check rollups are untouched.
 */
export function migrate(record) {
  let r = record;
  if (r.export_version === '1.0.0') {
    r = { ...r, question_history: Array.isArray(r.question_history) ? r.question_history : [], export_version: '1.1.0' };
    console.info('[l1a] migrated progress 1.0.0 -> 1.1.0');
  }
  return r.export_version === EXPORT_VERSION ? r : null;
}

/**
 * Record one answer. Called for every question in every context, so the history
 * is the raw truth and everything else is a rollup of it.
 */
export function recordAnswer({ questionId, conceptId, context, correct, chosen, confidence }) {
  return update(state => {
    const hist = state.question_history || (state.question_history = []);
    hist.push({
      question_id: questionId,
      concept_id: conceptId,
      at: new Date().toISOString(),
      context,
      correct: Boolean(correct),
      chosen,
      confidence
    });
  });
}

/** Every answer for one question, oldest first. */
export function historyFor(state, questionId) {
  return (state.question_history || []).filter(h => h.question_id === questionId);
}

/* --- Export / import ------------------------------------------------------ */

export function toJSON() {
  const state = load();
  return JSON.stringify({ ...state, exported_at: nowISO() }, null, 2);
}

/** Hands the browser a file. Single user, no accounts — this is the backup. */
export function exportFile() {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([toJSON()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `l1a-progress-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Replace the record from an export file.
 * Returns { ok, message } — the caller decides how to tell the user.
 */
export function importJSON(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { ok: false, message: 'That file is not valid JSON.' };
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, message: 'That file is not a progress record.' };
  if (!parsed.tiers) return { ok: false, message: 'That file has no tier state, so it is not an L1A export.' };
  const migrated = migrate(parsed);
  if (!migrated) {
    return { ok: false, message: `That file is export version ${parsed.export_version || 'unknown'}; this app reads ${EXPORT_VERSION} and has no migration from it.` };
  }
  const incoming = { ...blank(), ...migrated };
  delete incoming.exported_at;
  const written = save(incoming);
  return {
    ok: true,
    message: written
      ? `Imported${migrated.export_version !== parsed.export_version ? ` and migrated from ${parsed.export_version}` : ''}. Last updated ${new Date(incoming.updated_at).toLocaleString()}.`
      : 'Imported into memory, but it could not be written to storage.'
  };
}

/* --- Derived state -------------------------------------------------------- */

export function isConceptComplete(state, conceptId) {
  return Boolean(state.concepts?.[conceptId]?.complete);
}

/** Has this tier been self-attested ("I'm already certified")? */
export function isAttested(state, tierKey) {
  return Boolean(state.tiers?.[tierKey]?.self_attest?.attested);
}

/**
 * Gating, recomputed from scratch every render rather than trusted from
 * storage — the stored status is a cache, the rules are the truth.
 * A tier opens when the tier below it is complete, or when it has been
 * self-attested. EMT is always open.
 */
export function tierStatus(state, tierKey, tierCompleteFn) {
  if (state.tiers?.[tierKey]?.status === 'complete') return 'complete';
  if (tierKey === 'emt') return 'unlocked';
  if (isAttested(state, tierKey)) return 'unlocked';

  const idx = TIERS.findIndex(t => t.key === tierKey);
  const below = TIERS[idx - 1];
  return below && tierCompleteFn(below.key) ? 'unlocked' : 'locked';
}

/** Flip the self-attest override for a tier. */
export function setAttested(tierKey, attested, credential) {
  return update(state => {
    const tier = state.tiers[tierKey] || (state.tiers[tierKey] = { status: 'locked', simulations: [], skills_reviewed: false });
    if (attested) {
      tier.self_attest = {
        attested: true,
        attested_on: nowISO(),
        credential: credential || 'Self-attested — already certified at the rung below.'
      };
      tier.status = 'unlocked';
      tier.unlocked_on = nowISO();
    } else {
      delete tier.self_attest;
      tier.status = 'locked';
      delete tier.unlocked_on;
    }
  });
}
