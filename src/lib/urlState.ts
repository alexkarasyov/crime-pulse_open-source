// URL sync for shareable filter state.
//
// State lives in the QUERY STRING (not the hash) so in-page anchors — the
// skip link (#main-content) and the About-page TOC (#sources, …) — can use
// the hash without clobbering the shareable filter state, and vice versa.
//
// Encoding (query string, after the ?):
//   u=rate|count       — unit
//   c=as,at,be,ro,to   — active categories (comma-separated short codes)
//   p=as               — primary category
//   y=2016-2025        — year range, both ends inclusive
//   ytd=1|0            — include 2026 YTD
//   cmp=87,73,143      — compare-screen picks (neighbourhood ids, 2–4)
//   cb=01              — Toronto baseline visibility, counts then rates (0/1)
//
// On module init we read the query and override any localStorage defaults
// so a shared link wins over the recipient's stored preferences. After
// hydration we subscribe to signal changes and write back into the query
// (via history.replaceState, preserving any #anchor, so it does not pollute
// history). On back/forward (popstate) we restore that entry's full state.

import { effect, signal } from '@preact/signals';
import { CATEGORIES, type CategoryId } from './categories';
import {
  unit,
  DEFAULT_UNIT,
  primaryCat,
  activeCats,
  includeYTD,
  yearRange,
  YEAR_MIN,
  YEAR_MAX,
  hydratePersisted,
} from './state';

// Compare-screen picks live here rather than in state.ts because they
// are scoped to one surface — keeping them out of the persisted localStorage
// snapshot avoids "I changed my picks on Compare and now the Overview is
// behaving weirdly" classes of bugs.
export const DEFAULT_COMPARE_PICKS = ['87', '73', '143'];
export const comparePicks = signal<string[]>(DEFAULT_COMPARE_PICKS);
export function setComparePicks(ids: string[]): void {
  comparePicks.value = ids;
}

// Keep a distinct choice for each unit: totals compress neighbourhood counts,
// while rates share a meaningful per-capita scale. These view preferences are
// URL state, like picks, and do not leak into site-wide localStorage defaults.
export const DEFAULT_COMPARE_BASELINE = { count: false, rate: true };
export const compareBaseline = signal({ ...DEFAULT_COMPARE_BASELINE });
export function setCompareBaseline(visible: boolean): void {
  compareBaseline.value = { ...compareBaseline.value, [unit.value]: visible };
}

// Short codes — kept stable for shareable links; do not reorder.
const CAT_CODE: Record<CategoryId, string> = {
  assault: 'as',
  autoTheft: 'at',
  breakEnter: 'be',
  robbery: 'ro',
  theftOver: 'to',
};
const CODE_CAT: Record<string, CategoryId> = Object.fromEntries(
  Object.entries(CAT_CODE).map(([k, v]) => [v, k as CategoryId]),
);
const ALL_CAT_IDS: CategoryId[] = CATEGORIES.map((c) => c.id);

// The state keys we own in the query string. Used to decide whether a URL is
// asserting filter state (so history nav can reset unmentioned keys).
// Preserve recognition of complete links created before cb was introduced.
const LEGACY_STATE_KEYS = ['u', 'c', 'p', 'y', 'ytd', 'cmp'] as const;
const STATE_KEYS = [...LEGACY_STATE_KEYS, 'cb'] as const;

function parseParams(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

function parseCats(raw: string): CategoryId[] | null {
  const codes = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const ids: CategoryId[] = [];
  for (const c of codes) {
    const id = CODE_CAT[c];
    if (!id) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.length > 0 ? ids : null;
}

function parseYearRange(raw: string): [number, number] | null {
  const m = raw.match(/^(\d{4})-(\d{4})$/);
  if (!m) return null;
  const s = parseInt(m[1]!, 10);
  const e = parseInt(m[2]!, 10);
  if (s < YEAR_MIN || e > YEAR_MAX || s >= e) return null;
  return [s, e];
}

// Neighbourhood ids in the archive are unpadded integers (currently 1–174).
// Anything else — including built-in property names — is not a pick.
const NEIGHBOURHOOD_ID = /^\d{1,3}$/;

function parseCompareIds(raw: string): string[] | null {
  const ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
  if (ids.length < 2 || ids.length > 4) return null;
  if (ids.some((id) => !NEIGHBOURHOOD_ID.test(id))) return null;
  return ids;
}

/**
 * Apply state from the URL query.
 *
 * `resetAbsent`: when true, every key the URL does not mention is reset to
 * its default first (a URL with no state keys at all resets everything) —
 * used on history traversal (popstate) so going back/forward restores that
 * entry's exact state instead of leaving stale signal values. On initial
 * load it is false, so a shared link that names only `u` still merges over
 * the recipient's other localStorage preferences rather than wiping them.
 */
function hydrateFromUrl(resetAbsent: boolean): void {
  if (typeof window === 'undefined') return;
  const p = parseParams(window.location.search);
  const hasState = STATE_KEYS.some((k) => p.has(k));
  // On history traversal (resetAbsent) an entry with NO state keys encodes
  // the all-defaults view, so fall through and let the reset block restore
  // it — returning early here would leave stale signal values under a clean
  // URL. On initial load, bail so localStorage preferences survive.
  if (!hasState && !resetAbsent) return;

  if (resetAbsent) {
    if (!p.has('u')) unit.value = DEFAULT_UNIT;
    if (!p.has('p')) primaryCat.value = 'assault';
    if (!p.has('c')) activeCats.value = ALL_CAT_IDS.slice();
    if (!p.has('y')) yearRange.value = [YEAR_MIN, YEAR_MAX];
    if (!p.has('ytd')) includeYTD.value = false;
    if (!p.has('cmp')) comparePicks.value = DEFAULT_COMPARE_PICKS.slice();
    if (!p.has('cb')) compareBaseline.value = { ...DEFAULT_COMPARE_BASELINE };
  }

  const u = p.get('u');
  if (u === 'rate' || u === 'count') unit.value = u;
  const pc = p.get('p');
  if (pc && CODE_CAT[pc]) primaryCat.value = CODE_CAT[pc]!;
  const c = p.get('c');
  if (c) {
    const cats = parseCats(c);
    if (cats) activeCats.value = cats;
  }
  // The primary lens is always part of page scope. A tampered or hand-edited
  // shared link can assert p=as&c=ro; resolve that contradiction the same way
  // ViewRail does when a user scopes out the current primary category.
  if (!activeCats.value.includes(primaryCat.value)) {
    primaryCat.value = activeCats.value[0]!;
  }
  const y = p.get('y');
  if (y) {
    const r = parseYearRange(y);
    if (r) yearRange.value = r;
  }
  const ytd = p.get('ytd');
  if (ytd === '1') includeYTD.value = true;
  else if (ytd === '0') includeYTD.value = false;
  const cmp = p.get('cmp');
  if (cmp) {
    const ids = parseCompareIds(cmp);
    if (ids) comparePicks.value = ids;
  }
  const cb = p.get('cb');
  if (cb && /^[01]{2}$/.test(cb)) {
    compareBaseline.value = { count: cb[0] === '1', rate: cb[1] === '1' };
  }
}

/** Build a query without `?`. Copy view includes defaults so a recipient's
 * saved preferences cannot change the shared view; ordinary URLs stay short. */
export function buildQuery(includeDefaults = false): string {
  const parts: string[] = [];
  if (includeDefaults || unit.value !== DEFAULT_UNIT) parts.push(`u=${unit.value}`);
  if (includeDefaults || primaryCat.value !== 'assault') parts.push(`p=${CAT_CODE[primaryCat.value]}`);
  const cats = activeCats.value;
  if (includeDefaults || cats.length !== ALL_CAT_IDS.length) {
    parts.push(`c=${cats.map((c) => CAT_CODE[c]).join(',')}`);
  }
  const [ys, ye] = yearRange.value;
  if (includeDefaults || ys !== YEAR_MIN || ye !== YEAR_MAX) parts.push(`y=${ys}-${ye}`);
  if (includeDefaults || includeYTD.value) parts.push(`ytd=${includeYTD.value ? '1' : '0'}`);
  const cmp = comparePicks.value;
  const cmpDefault =
    cmp.length === DEFAULT_COMPARE_PICKS.length &&
    cmp.every((id, i) => id === DEFAULT_COMPARE_PICKS[i]);
  if (includeDefaults || !cmpDefault) parts.push(`cmp=${cmp.join(',')}`);
  const cb = compareBaseline.value;
  if (includeDefaults || cb.count || !cb.rate) parts.push(`cb=${cb.count ? '1' : '0'}${cb.rate ? '1' : '0'}`);
  return parts.join('&');
}

let syncing = false;

function writeQuery(): void {
  if (typeof window === 'undefined' || syncing) return;
  // A complete Copy view query must stay complete after hydration and edits.
  // Dropping explicit defaults would let saved preferences win on reload.
  const params = parseParams(window.location.search);
  const query = buildQuery(LEGACY_STATE_KEYS.every((key) => params.has(key)));
  // Preserve any #anchor on the URL (skip link, About TOC) — only the search
  // portion is ours to own.
  const next =
    window.location.pathname + (query ? `?${query}` : '') + window.location.hash;
  const current =
    window.location.pathname + window.location.search + window.location.hash;
  if (next === current) return;
  window.history.replaceState(null, '', next);
}

let initialised = false;

export function initUrlSync(): void {
  if (initialised || typeof window === 'undefined') return;
  initialised = true;
  syncing = true;
  // localStorage prefs first, then let any URL-query params override them
  // (a shared link should win over the recipient's stored preferences).
  hydratePersisted();
  hydrateFromUrl(false);
  syncing = false;
  effect(() => {
    void unit.value;
    void primaryCat.value;
    void activeCats.value;
    void yearRange.value;
    void includeYTD.value;
    void comparePicks.value;
    void compareBaseline.value;
    writeQuery();
  });
  // Back/forward: restore the exact state encoded in that history entry.
  window.addEventListener('popstate', () => {
    syncing = true;
    hydrateFromUrl(true);
    syncing = false;
  });
}

export function buildShareUrl(): string {
  if (typeof window === 'undefined') return '';
  const query = buildQuery(true);
  return (
    window.location.origin +
    window.location.pathname +
    (query ? `?${query}` : '') +
    window.location.hash
  );
}
