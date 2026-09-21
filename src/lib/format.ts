// Pure formatting/math helpers used by Astro frontmatter and Preact islands.
// No dependencies — safe to import from anywhere.

// YoY / change direction colours, resolved from the design tokens (defined in
// tokens.css). Warm amber = up, cool teal = down, neutral = flat — always
// paired with an arrow glyph, never colour alone. Used in inline `style`
// `color:` on DOM/SVG elements where var() is valid (NOT Leaflet path/marker
// presentation attributes — those use resolved hex from map-and-charts.md).
export const TREND_UP_COLOR = 'var(--trend-up)';
export const TREND_DOWN_COLOR = 'var(--trend-down)';
export const TREND_FLAT_COLOR = 'var(--trend-flat)';

/** Resolve a YoyDir to its display colour. */
export function trendColor(dir: 'up' | 'down' | 'flat'): string {
  return dir === 'up' ? TREND_UP_COLOR : dir === 'down' ? TREND_DOWN_COLOR : TREND_FLAT_COLOR;
}

/**
 * Percent change from `a` to `b`. Returns 0 when `a` is zero (and there's no
 * mathematically defined delta). The styleguide uses the same convention.
 */
export function pctDelta(a: number, b: number): number {
  if (!a) return 0;
  return ((b - a) / a) * 100;
}

/**
 * Slice a year-keyed series to an inclusive [start, end] range. Used by the
 * Overview islands so the view rail's year selector actually narrows the hero,
 * trend, signal, and category cards (not just the map / neighbourhood index).
 */
export function sliceByYearRange<T extends { year: number }>(
  series: T[],
  start: number,
  end: number,
): T[] {
  return series.filter((p) => p.year >= start && p.year <= end);
}

/** Format a value according to the active unit. */
export function fmtUnit(value: number, unit: 'rate' | 'count'): string {
  if (unit === 'rate') return value.toFixed(0);
  return Math.round(value).toLocaleString('en-CA');
}

/** Suffix label for the unit toggle. */
export function unitSuffix(unit: 'rate' | 'count'): string {
  return unit === 'rate' ? '/ 10K' : '';
}

/** Word for the unit, used in headings ("rate" / "count"). */
export function unitWord(unit: 'rate' | 'count'): string {
  return unit === 'rate' ? 'rate' : 'count';
}

/**
 * Sum a value across a set of active categories at a given year. Used by
 * the hero, trend baseline, and the neighbourhood index when the user has
 * selected more than one category in the view rail — the visible number
 * becomes the sum across the selected cats. The choropleth map does NOT
 * use this: it is primary-category-only (see catValueAt) so its shading,
 * legend, heading, and hover panel all describe the same single category.
 *
 * Handles both schema shapes the codebase carries:
 *  - aggregate JSON points: { year, count, rate_per_10k }
 *  - reshaped UI points:    { year, count, rate }
 */
type AnyYearPoint = {
  year: number;
  count: number;
  rate?: number | null;
  rate_per_10k?: number | null;
};
export function sumActiveAt<C extends string>(
  seriesByCat: Record<C, AnyYearPoint[]>,
  activeCats: readonly C[],
  year: number,
  unit: 'rate' | 'count',
): number {
  let sum = 0;
  for (const cat of activeCats) {
    const series = seriesByCat[cat];
    if (!series) continue;
    const pt = series.find((p) => p.year === year);
    if (!pt) continue;
    sum += unit === 'rate' ? (pt.rate ?? pt.rate_per_10k ?? 0) : pt.count;
  }
  return sum;
}

/**
 * Value of a single category at a given year. The map surfaces (choropleth
 * shading, YoY arrows, legend scale, top-4 list) read this so every number
 * around the map describes the one primary category — never a cross-category
 * sum. Same dual-schema tolerance as sumActiveAt.
 */
export function catValueAt<C extends string>(
  seriesByCat: Record<C, AnyYearPoint[]>,
  cat: C,
  year: number,
  unit: 'rate' | 'count',
): number {
  const pt = seriesByCat[cat]?.find((p) => p.year === year);
  if (!pt) return 0;
  return unit === 'rate' ? (pt.rate ?? pt.rate_per_10k ?? 0) : pt.count;
}

/**
 * Sum full series across a set of active categories, year by year. The
 * Overview hero and trend baseline use this when the view rail has a subset
 * of categories selected — the "total" line becomes the sum of just the
 * checked categories. Category rates share the same population denominator,
 * so summing rates equals the rate of the summed counts (± rounding).
 * The year axis is taken from the first active category's series; all
 * city-wide series share the same axis.
 */
export function sumSeriesAcross<C extends string>(
  seriesByCat: Record<C, { year: number; rate: number; count: number }[]>,
  activeCats: readonly C[],
): { year: number; rate: number; count: number }[] {
  const axis = seriesByCat[activeCats[0]!] ?? [];
  return axis.map(({ year }) => ({
    year,
    rate: sumActiveAt(seriesByCat, activeCats, year, 'rate'),
    count: sumActiveAt(seriesByCat, activeCats, year, 'count'),
  }));
}

/**
 * YoY trend symbol. Returns an arrow plus a direction class for styling.
 * |delta| under `threshold` percent is "flat" — matches the styleguide ▲▼—
 * convention. Used by /neighbourhood/ index, the map hover panel, and the
 * neighbourhood delta strip.
 */
export type YoyDir = 'up' | 'down' | 'flat';
export interface YoyTrend {
  glyph: string;
  dir: YoyDir;
  delta: number;
}
export function yoyTrend(prev: number, curr: number, threshold = 1): YoyTrend {
  const delta = pctDelta(prev, curr);
  if (Math.abs(delta) < threshold) return { glyph: '—', dir: 'flat', delta };
  if (delta > 0) return { glyph: '▲', dir: 'up', delta };
  return { glyph: '▼', dir: 'down', delta };
}

/**
 * Like `yoyTrend` but with no flat threshold — the only "flat" case is a
 * zero/undefined baseline (where the delta is mathematically undefined, not a
 * real 0%). Use for "since first year" change indicators so a category that
 * was zero in the base year renders "—" instead of a confident "▼ 0%".
 */
export function changeTrend(prev: number, curr: number): YoyTrend {
  if (!prev) return { glyph: '—', dir: 'flat', delta: 0 };
  const delta = pctDelta(prev, curr);
  if (delta > 0) return { glyph: '▲', dir: 'up', delta };
  if (delta < 0) return { glyph: '▼', dir: 'down', delta };
  return { glyph: '—', dir: 'flat', delta: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Small-base guard — a percentage over a sub-10 incident base exaggerates the
// change ("▲ 200%" for 1 → 3 robberies), so change indicators switch to raw
// counts when either comparison endpoint is at or below this many incidents.

export const SMALL_BASE_MAX = 9;

/** Tooltip copy shown on the "small base" tag wherever the guard trips. */
export const SMALL_BASE_NOTE =
  'At least one compared year has under 10 incidents — counts shown; a percentage would exaggerate the change.';

export type DeltaDisplay =
  /** Base is big enough — show the usual percentage. */
  | { kind: 'pct'; trend: YoyTrend }
  /** Small base — show the raw count change instead ("▲ +3 · 5 → 8"). */
  | { kind: 'counts'; trend: YoyTrend; diff: number; from: number; to: number };

/**
 * Change indicator with the small-base guard. Always keyed on COUNTS, even
 * when the page displays rates: category rates share one population
 * denominator, so the percent change of the rate equals the percent change of
 * the count — and the guard's whole point is that the underlying incident
 * count is too small for a percentage to be meaningful.
 */
export function guardedChange(prevCount: number, currCount: number): DeltaDisplay {
  if (prevCount > SMALL_BASE_MAX && currCount > SMALL_BASE_MAX) {
    return { kind: 'pct', trend: changeTrend(prevCount, currCount) };
  }
  const diff = currCount - prevCount;
  const dir: YoyDir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
  const glyph = diff > 0 ? '▲' : diff < 0 ? '▼' : '—';
  return {
    kind: 'counts',
    trend: { glyph, dir, delta: diff },
    diff,
    from: prevCount,
    to: currCount,
  };
}
