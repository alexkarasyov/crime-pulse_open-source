// Overview hero bigstat — the city-wide "All incidents" pulse.
// Redesign ("Live Signal" overview): shows the Toronto TOTAL across the
// view-rail-selected categories (all five by default), with a year-over-year
// delta and a Peak / Low / vs-first-year footer. Reacts to the unit toggle,
// year range, and category filter chips.

import { CATEGORIES } from '../../lib/categories';
import { unit, yearRange, activeCats } from '../../lib/state';
import { changeTrend, sliceByYearRange, sumSeriesAcross } from '../../lib/format';
import type { YearPoint } from '../../lib/aggregates';
import Sparkline from '../preact/Sparkline';

interface Props {
  /** City-wide category-summed total per year (rate + count). */
  totalSeries: YearPoint[];
  /** Per-category city-wide series, for partial sums when chips are off. */
  torontoSeries: Record<string, YearPoint[]>;
}

export default function OverviewHero({ totalSeries, torontoSeries }: Props) {
  const u = unit.value;
  const [startYear, endYear] = yearRange.value;
  const cats = activeCats.value;
  // All five on → use the build-emitted total verbatim so the default view
  // matches the aggregate exactly; a subset → sum the checked categories.
  const allOn = cats.length === CATEGORIES.length;
  const base = allOn ? totalSeries : sumSeriesAcross(torontoSeries, cats);
  const series = sliceByYearRange(base, startYear, endYear);
  const first = series[0];
  const last = series[series.length - 1];
  const prev = series[series.length - 2];

  const val = (p: YearPoint | undefined) => (p ? p[u] : 0);
  const fmt = (v: number) => (u === 'rate' ? v.toFixed(1) : Math.round(v).toLocaleString('en-CA'));

  // Year-over-year (headline delta) and the change since the first year (foot).
  const yoy = changeTrend(val(prev), val(last));
  const vsFirst = changeTrend(val(first), val(last));

  // Peak / low across the window.
  let peak = series[0];
  let low = series[0];
  for (const p of series) {
    if (val(p) > val(peak)) peak = p;
    if (val(p) < val(low)) low = p;
  }

  return (
    <div class="bigstat">
      <div class="bigstat-head">
        <span class="bigstat-cat">
          <span class="bigstat-cat-name">
            {allOn ? 'All incidents' : `${cats.length} of ${CATEGORIES.length} categories`}
          </span>
        </span>
        <span class={`bigstat-delta ${yoy.dir}`}>
          {yoy.dir === 'flat'
            ? `— flat vs ${prev?.year ?? startYear}`
            : `${yoy.glyph} ${Math.abs(yoy.delta).toFixed(1)}% vs ${prev?.year ?? startYear}`}
        </span>
      </div>
      <div class="bigstat-num">
        {fmt(val(last))}
        <span class="bigstat-unit">{u === 'rate' ? 'per 10k' : 'incidents'} · {endYear}</span>
      </div>
      <div class="bigstat-spark">
        <div style="height: 48px; color: var(--accent);">
          <Sparkline
            data={series.map((d) => ({ rate: d[u] }))}
            color="var(--accent)"
            accent
            fill
            height={48}
            width={320}
          />
        </div>
      </div>
      <div class="bigstat-foot">
        <div class="bigstat-foot-item">
          <div class="k">Peak</div>
          <div class="v">{fmt(val(peak))} · {peak?.year}</div>
        </div>
        <div class="bigstat-foot-item">
          <div class="k">Low</div>
          <div class="v">{fmt(val(low))} · {low?.year}</div>
        </div>
        <div class="bigstat-foot-item">
          <div class="k">vs {first?.year ?? startYear}</div>
          <div class="v">
            {vsFirst.dir === 'flat' ? '—' : `${vsFirst.delta > 0 ? '+' : '−'}${Math.abs(vsFirst.delta).toFixed(1)}%`}
          </div>
        </div>
      </div>
    </div>
  );
}
