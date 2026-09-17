/* ==========================================================================
   srs.js — spaced-repetition scheduling. Pure functions; no DOM, no storage.

   SM-2 shaped, which is what progress.schema.json describes: an ease factor
   that moves with how the card felt, and an interval that multiplies by it.
   Two deliberate departures from textbook SM-2, both to make the four buttons
   behave the way a learner expects:

     hard   multiplies by a fixed 1.2 rather than by ease, so "hard" always
            means a shorter next gap than "good" — in plain SM-2 a hard answer
            can still schedule further out, which reads as broken.
     easy   multiplies by ease and then by 1.3, so "easy" visibly buys more
            time than "good".

   Ease is clamped to 1.3–3.5 because progress.schema.json bounds it there.
   ========================================================================== */

export const GRADES = [
  ['again', 'Again', 'Got it wrong, or blanked'],
  ['hard',  'Hard',  'Right, but it was a struggle'],
  ['good',  'Good',  'Right, with normal effort'],
  ['easy',  'Easy',  'Instant, no hesitation']
];

export const EASE_MIN = 1.3;
export const EASE_MAX = 3.5;
export const EASE_START = 2.5;

const clampEase = e => Math.min(EASE_MAX, Math.max(EASE_MIN, Math.round(e * 100) / 100));

export function blankState() {
  return { interval_days: 0, ease: EASE_START, due: today(), reps: 0, lapses: 0 };
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(isoDate, days) {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + Math.round(days));
  return d.toISOString().slice(0, 10);
}

/** Is this card due on or before today? A card with no state at all is new, and new is due. */
export function isDue(state, card) {
  const s = state.srs?.[card.id];
  if (!s) return true;
  return !s.due || s.due <= today();
}

/**
 * Apply a grade. Returns the new srs entry — the caller persists it.
 * Intervals are in days; 0 means "still learning, show it again today".
 */
export function grade(prev, result) {
  const s = { ...blankState(), ...(prev || {}) };
  const ease = s.ease ?? EASE_START;
  const interval = s.interval_days ?? 0;
  const reps = s.reps ?? 0;

  let nextInterval, nextEase = ease, nextReps = reps, lapses = s.lapses ?? 0;

  switch (result) {
    case 'again':
      // Back to the start. The card stays in today's queue.
      nextInterval = 0;
      nextEase = clampEase(ease - 0.20);
      nextReps = 0;
      lapses += 1;
      break;
    case 'hard':
      nextInterval = interval <= 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
      nextEase = clampEase(ease - 0.15);
      nextReps = reps + 1;
      break;
    case 'good':
      nextInterval = reps === 0 ? 1 : (reps === 1 ? 6 : Math.max(1, Math.round(interval * ease)));
      nextReps = reps + 1;
      break;
    case 'easy':
      nextInterval = reps === 0 ? 2 : (reps === 1 ? 8 : Math.max(1, Math.round(interval * ease * 1.3)));
      nextEase = clampEase(ease + 0.15);
      nextReps = reps + 1;
      break;
    default:
      return s;
  }

  return {
    interval_days: nextInterval,
    ease: nextEase,
    due: nextInterval <= 0 ? today() : addDays(today(), nextInterval),
    last_result: result,
    last_reviewed: new Date().toISOString(),
    reps: nextReps,
    lapses
  };
}

/** Human-readable preview of where each button would send the card. */
export function previewAll(prev) {
  const out = {};
  for (const [key] of GRADES) {
    const next = grade(prev, key);
    out[key] = next.interval_days <= 0
      ? 'today'
      : next.interval_days === 1 ? 'tomorrow' : `${next.interval_days} days`;
  }
  return out;
}

/** Retention across a set of cards: proportion that have been answered and are not lapsing. */
export function retention(state, cards) {
  const seen = cards.filter(c => state.srs?.[c.id]?.reps != null && state.srs[c.id].last_result);
  if (!seen.length) return null;
  const holding = seen.filter(c => state.srs[c.id].last_result !== 'again').length;
  return Math.round((holding / seen.length) * 100);
}
