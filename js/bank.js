/* ==========================================================================
   bank.js — question selection, shared by the lesson check and the module exam.
   One place decides what may be served, so the rule cannot drift between them.
   ========================================================================== */

import { devMode } from './progress.js';

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * May this question be served, anywhere?
 *
 *   - Retired items are never served. Not in any context, not in dev mode.
 *     They exist so old attempt records still resolve, nothing more.
 *   - Items flagged verify:true are never served either — the same rule
 *     everywhere, lesson check included. Unless dev mode is on, which is the
 *     only reason a stub bank is usable at all right now.
 */
export function isServable(q) {
  if (q.retired) return false;
  if (q.verify && !devMode()) return false;
  return true;
}

export function servable(questions) {
  return questions.filter(isServable);
}

/** How many of this bank's questions are being withheld, and why. */
export function withheldSummary(questions, scopeIds) {
  const inScope = scopeIds
    ? questions.filter(q => scopeIds.includes(q.concept_id))
    : questions;
  return {
    total: inScope.length,
    retired: inScope.filter(q => q.retired).length,
    unverified: inScope.filter(q => !q.retired && q.verify).length,
    servable: inScope.filter(isServable).length
  };
}

/**
 * Round-robin across concepts so one concept cannot dominate a small draw.
 * Used by the lesson check, where every concept in the lesson deserves a look.
 */
export function pickAcrossConcepts(conceptIds, questions, count) {
  const pools = conceptIds.map(id => shuffle(servable(questions).filter(q => q.concept_id === id)));
  const picked = [];
  let round = 0;
  while (picked.length < count) {
    let took = false;
    for (const pool of pools) {
      if (pool[round]) { picked.push(pool[round]); took = true; }
      if (picked.length >= count) break;
    }
    if (!took) break;
    round++;
  }
  return shuffle(picked);
}

/**
 * Domain-weighted draw for a module exam, so the paper mirrors the blueprint
 * weighting instead of sampling flat.
 *
 * `weighting` is { DOMAIN: percent }. Each domain's share is rounded down, the
 * remainder goes to the domains with the largest fractional parts, and anything
 * a thin domain cannot fill is redistributed to whatever is left — a short
 * exam is worse than a slightly off-weight one.
 */
export function pickByDomain(weighting, questions, count) {
  const pool = servable(questions);
  const byDomain = new Map();
  for (const q of pool) {
    if (!byDomain.has(q.domain)) byDomain.set(q.domain, []);
    byDomain.get(q.domain).push(q);
  }
  for (const [k, v] of byDomain) byDomain.set(k, shuffle(v));

  const entries = Object.entries(weighting || {});
  const total = entries.reduce((s, [, w]) => s + w, 0) || 1;

  const quota = entries.map(([domain, w]) => {
    const exact = (w / total) * count;
    return { domain, exact, n: Math.floor(exact) };
  });
  let assigned = quota.reduce((s, q) => s + q.n, 0);
  quota.sort((a, b) => (b.exact - b.n) - (a.exact - a.n));
  for (let i = 0; assigned < count && quota.length; i++, assigned++) {
    quota[i % quota.length].n++;
  }

  const picked = [];
  const shortfall = [];
  for (const { domain, n } of quota) {
    const available = byDomain.get(domain) || [];
    const take = available.splice(0, n);
    picked.push(...take);
    if (take.length < n) shortfall.push(n - take.length);
  }

  // Backfill from anything still unused, in any domain.
  let missing = count - picked.length;
  if (missing > 0) {
    const leftovers = shuffle([...byDomain.values()].flat().filter(q => !picked.includes(q)));
    picked.push(...leftovers.slice(0, missing));
  }

  return shuffle(picked);
}
