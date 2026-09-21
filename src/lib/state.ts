// Cross-island state.
//
// All islands import `unit`, `activeCats`, etc. from this module so the
// view rail in the page body and the segmented control in the topbar
// share the same in-memory store.
//
// Hydration: signals are initialised to DEFAULTS at module load — including
// in the browser — so the first client render matches the server HTML and we
// never trip a hydration mismatch. Persisted localStorage prefs are applied
// AFTER mount via `hydratePersisted()` (called once from the UrlSync island's
// effect, which is `client:load` on every page). That turns "saved unit=rate"
// into a controlled post-hydration update rather than a hydration error.
//
// We deliberately avoid `@preact/signals-react` etc. — plain Preact
// signals keep the bundle small.

import { batch, signal } from '@preact/signals';
import { CATEGORIES, type CategoryId } from './categories';

export type Unit = 'rate' | 'count';

/** Site-wide default unit (ADR-009 — counts by default, rates on toggle).
 *  urlState.ts keys share-link encoding off this: the `u=` param is emitted
 *  only for the non-default unit. */
export const DEFAULT_UNIT: Unit = 'count';

const STORAGE_KEY = 'crime-pulse.v1';

interface PersistedState {
  unit?: Unit;
  primaryCat?: CategoryId;
  activeCats?: CategoryId[];
  includeYTD?: boolean;
  showYoyArrows?: boolean;
  yearRange?: [number, number];
}

function loadPersisted(): PersistedState {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as PersistedState
      : {};
  } catch {
    return {};
  }
}

export const unit = signal<Unit>(DEFAULT_UNIT);
export const primaryCat = signal<CategoryId>('assault');
export const activeCats = signal<CategoryId[]>(CATEGORIES.map((c) => c.id));
export const includeYTD = signal<boolean>(false);
export const showYoyArrows = signal<boolean>(true);
// Year-range selection. Default is the full comparable 10-year window.
// Stored as a [start, end] tuple; both ends inclusive.
export const YEAR_MIN = 2016;
export const YEAR_MAX = 2025;
export const yearRange = signal<[number, number]>([YEAR_MIN, YEAR_MAX]);

let hydrated = false;

/**
 * Apply persisted localStorage prefs onto the signals. Idempotent and a no-op
 * on the server. MUST be called from an effect (post-mount), never at module
 * load, so the first client render still matches the server-rendered HTML.
 */
export function hydratePersisted(): void {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  const p = loadPersisted();
  if (p.unit === 'rate' || p.unit === 'count') unit.value = p.unit;
  if (p.primaryCat && CATEGORIES.some((c) => c.id === p.primaryCat)) {
    primaryCat.value = p.primaryCat;
  }
  if (Array.isArray(p.activeCats)) {
    const valid = p.activeCats.filter((c) => CATEGORIES.some((x) => x.id === c));
    if (valid.length) activeCats.value = valid;
  }
  if (typeof p.includeYTD === 'boolean') includeYTD.value = p.includeYTD;
  if (typeof p.showYoyArrows === 'boolean') showYoyArrows.value = p.showYoyArrows;
  if (Array.isArray(p.yearRange) && p.yearRange.length === 2) {
    const [s, e] = p.yearRange;
    // Guard against tampered/legacy localStorage: require integers, not just
    // values that coerce through the comparisons (e.g. numeric strings).
    if (
      Number.isInteger(s) && Number.isInteger(e) &&
      s >= YEAR_MIN && e <= YEAR_MAX && s < e
    ) {
      yearRange.value = [s, e];
    }
  }
}

function persist(): void {
  if (typeof window === 'undefined') return;
  const snapshot: PersistedState = {
    unit: unit.value,
    primaryCat: primaryCat.value,
    activeCats: activeCats.value,
    includeYTD: includeYTD.value,
    showYoyArrows: showYoyArrows.value,
    yearRange: yearRange.value,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // localStorage can throw in incognito / quota-exceeded scenarios.
  }
}

export function setUnit(u: Unit): void {
  unit.value = u;
  persist();
}

export function setPrimaryCat(c: CategoryId): void {
  // Every picker, including Compare, must keep its lens inside page scope.
  // Batch the signals so URL subscribers never observe a contradictory p/c.
  batch(() => {
    if (!activeCats.value.includes(c)) activeCats.value = [...activeCats.value, c];
    primaryCat.value = c;
  });
  persist();
}

/** Force a category into the active set (no-op if already on). Used when the
 * user picks a primary category that the scope chips had toggled off — the
 * primary lens must always be part of the page scope. */
export function ensureCatOn(id: CategoryId): void {
  if (activeCats.value.includes(id)) return;
  activeCats.value = [...activeCats.value, id];
  persist();
}

/** Choose an exact page scope, keeping the primary lens in that scope. */
export function setCategoryScope(ids: CategoryId[]): void {
  const next = [...new Set(ids)];
  if (next.length === 0) return;
  batch(() => {
    activeCats.value = next;
    if (!next.includes(primaryCat.value)) primaryCat.value = next[0]!;
  });
  persist();
}

export function toggleCat(id: CategoryId): void {
  const current = activeCats.value;
  if (current.includes(id)) {
    if (current.length <= 1) return; // never zero
    activeCats.value = current.filter((x) => x !== id);
  } else {
    activeCats.value = [...current, id];
  }
  persist();
}

export function setIncludeYTD(v: boolean): void {
  includeYTD.value = v;
  persist();
}

export function setShowYoyArrows(v: boolean): void {
  showYoyArrows.value = v;
  persist();
}

export function setYearRange(start: number, end: number): void {
  // Clamp to the comparable window; enforce a minimum 2-year range so YoY
  // arrows always have a prior year to compare against.
  let s = Math.max(YEAR_MIN, Math.min(start, YEAR_MAX));
  let e = Math.max(YEAR_MIN, Math.min(end, YEAR_MAX));
  if (e < s) [s, e] = [e, s];
  if (e - s < 1) {
    if (s > YEAR_MIN) s = e - 1;
    else e = s + 1;
  }
  yearRange.value = [s, e];
  persist();
}
