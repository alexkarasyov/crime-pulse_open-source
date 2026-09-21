// Big stat + delta strip on the Neighbourhood screen. Re-reacts to
// primaryCat + unit + yearRange. Series + baseline arrive as props from page
// frontmatter.
//
// Small-base guard (v2 design): the "vs previous year" cell switches from a
// percentage to raw counts when either endpoint has under 10 incidents, and
// the eyebrow grows a "small base" chip — a % over a sub-10 base exaggerates
// the change.

import { CAT_BY_ID } from '../../lib/categories';
import { primaryCat, unit, yearRange } from '../../lib/state';
import {
  changeTrend,
  guardedChange,
  sliceByYearRange,
  SMALL_BASE_NOTE,
} from '../../lib/format';
import type { YearPoint } from '../../lib/aggregates';
import CatGlyph from '../preact/CatGlyph';

interface Props {
  seriesByCat: Record<string, YearPoint[]>;
  torontoByCat: Record<string, YearPoint[]>;
}

export default function NeighbourhoodHero({ seriesByCat, torontoByCat }: Props) {
  const cat = primaryCat.value;
  const u = unit.value;
  const [ys, ye] = yearRange.value;
  const primary = CAT_BY_ID[cat];
  const series = sliceByYearRange(seriesByCat[cat] ?? [], ys, ye);
  const last = series[series.length - 1];
  const prev = series[series.length - 2];
  const avg =
    series.length > 0
      ? series.reduce((s, d) => s + d[u], 0) / series.length
      : 0;
  const avgCount =
    series.length > 0
      ? series.reduce((s, d) => s + d.count, 0) / series.length
      : 0;
  const torontoSeries = sliceByYearRange(torontoByCat[cat] ?? [], ys, ye);
  const torontoLast = torontoSeries[torontoSeries.length - 1];
  if (!last || !prev || !torontoLast) return null;
  // "vs prev year" runs through the small-base guard (keyed on counts — the
  // % change of the rate equals the % change of the count, same denominator).
  // "vs Toronto" always compares per-capita levels: a neighbourhood's raw
  // count is a small share of the city total, not a comparable risk measure.
  const vsYear = guardedChange(prev.count, last.count);
  const vsAvg = changeTrend(avg, last[u]);
  const vsToronto = changeTrend(torontoLast.rate, last.rate);
  const smallBase = vsYear.kind === 'counts';
  return (
    <div>
      <div class="eyebrow" style="margin-bottom: 12px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
        <span style="display: inline-flex; align-items: center; gap: 6px;">
          <CatGlyph cat={primary} size={10} /> {primary.name.toUpperCase()} · {last.year}
        </span>
        {smallBase && (
          <span class="sb-chip" title={SMALL_BASE_NOTE}>
            Small base · {last.count} incident{last.count === 1 ? '' : 's'} in {last.year}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '88px',
          lineHeight: 0.95,
          letterSpacing: '-0.03em',
          fontVariantNumeric: 'tabular-nums',
          color: 'var(--ink)',
          display: 'flex',
          alignItems: 'baseline',
          gap: '14px',
        }}
      >
        {u === 'rate' ? last.rate.toFixed(0) : last.count.toLocaleString()}
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            color: 'var(--ink-3)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {u === 'rate' ? 'per 10,000' : 'incidents'}
        </span>
      </div>
      <div class="delta-strip" style="margin-top: 24px;">
        <div class="delta-cell">
          <span class="k">vs. {prev.year}</span>
          {vsYear.kind === 'counts' ? (
            <span class={`v ${vsYear.trend.dir}`} title={SMALL_BASE_NOTE}>
              {vsYear.diff === 0
                ? '— no change'
                : `${vsYear.trend.glyph} ${vsYear.diff > 0 ? '+' : '−'}${Math.abs(vsYear.diff)} · ${vsYear.from} → ${vsYear.to}`}
            </span>
          ) : (
            <span class={`v ${vsYear.trend.dir}`}>
              {vsYear.trend.dir === 'flat'
                ? '—'
                : `${vsYear.trend.glyph} ${Math.abs(vsYear.trend.delta).toFixed(1)}%`}
            </span>
          )}
        </div>
        <div class="delta-cell">
          <span class="k">vs. {series.length}-yr avg</span>
          {smallBase ? (
            <span class="v flat" title={SMALL_BASE_NOTE}>
              {avgCount.toFixed(1)}/yr
            </span>
          ) : (
            <span class={`v ${vsAvg.dir}`}>
              {vsAvg.dir === 'flat' ? '—' : `${vsAvg.glyph} ${Math.abs(vsAvg.delta).toFixed(1)}%`}
            </span>
          )}
        </div>
        <div class="delta-cell">
          <span class="k" title="Compared with the Toronto-wide rate per 10,000 residents.">vs. Toronto (rate)</span>
          <span class={`v ${vsToronto.dir}`}>
            {vsToronto.dir === 'flat' ? '—' : `${vsToronto.glyph} ${Math.abs(vsToronto.delta).toFixed(0)}%`}
          </span>
        </div>
      </div>
    </div>
  );
}
