// Preact mirror of src/components/SmallMultiples.astro.
//
// With `scoped` (Neighbourhood v2), the grid reacts to the page-scope signals:
// only activeCats tiles render, the year window slices each series, and the
// primary tile gets a highlighted border. The since-first-year delta always
// runs through the small-base guard — a % over a sub-10 incident base
// exaggerates the change, so it switches to raw counts with a tag.

import { CATEGORIES } from '../../lib/categories';
import { activeCats, primaryCat, yearRange } from '../../lib/state';
import { guardedChange, sliceByYearRange, SMALL_BASE_NOTE, trendColor } from '../../lib/format';
import type { YearPoint } from '../../lib/aggregates';
import CatGlyph from './CatGlyph';
import Sparkline from './Sparkline';
import ChartDataTable from './ChartDataTable';
import { chartUnitLabel } from '../../lib/chartValues';

interface Props {
  // Either pass a per-cat series map (Neighbourhood) or `torontoSeries` (city).
  seriesByCat: Record<string, YearPoint[]>;
  unit?: 'rate' | 'count';
  /** React to the page-scope signals: activeCats filter + yearRange slice. */
  scoped?: boolean;
  /** Outline the primaryCat tile. */
  highlightPrimary?: boolean;
  geography?: string;
}

export default function SmallMultiples({
  seriesByCat,
  unit = 'rate',
  scoped = false,
  highlightPrimary = false,
  geography = 'Selected neighbourhood',
}: Props) {
  const cats = scoped
    ? CATEGORIES.filter((c) => activeCats.value.includes(c.id))
    : CATEGORIES;
  const [ys, ye] = yearRange.value;
  return (
    <>
    <div class="sm-grid">
      {cats.map((cat) => {
        const full = seriesByCat[cat.id] ?? [];
        const series = scoped ? sliceByYearRange(full, ys, ye) : full;
        const latest = series[series.length - 1];
        const first = series[0];
        if (!latest || !first) return null;
        const change = guardedChange(first.count, latest.count);
        const deltaColor = trendColor(change.trend.dir);
        const isPrimary = highlightPrimary && primaryCat.value === cat.id;
        return (
          <div
            class="sm-tile"
            style={`--c: ${cat.color};${isPrimary ? ' border-color: var(--border);' : ''}`}
          >
            <div class="sm-tile-head">
              <CatGlyph cat={cat} size={10} />
              <div class="sm-tile-name">{cat.name}</div>
            </div>
            <div class="sm-tile-rate" style={`color: ${cat.color};`}>
              {unit === 'rate' ? latest.rate.toFixed(0) : latest.count.toLocaleString()}
              <span style="font-size: 9px; font-family: var(--font-mono); color: var(--ink-3); margin-left: 4px; letter-spacing: 0.06em;">
                {unit === 'rate' ? '/ 10K' : ''}
              </span>
            </div>
            <div style="height: 36px; margin-top: 8px;" role="img" aria-label={`${geography}, ${cat.name.toLowerCase()}, ${chartUnitLabel(unit)}, ${first.year}–${latest.year}. Values are available in View chart data.`}>
              <Sparkline
                data={series.map((d) => ({ rate: d[unit] }))}
                color={cat.color}
                accent
                fill
                height={36}
                width={140}
              />
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 8px; font-family: var(--font-mono); font-size: 10px; color: var(--ink-3); letter-spacing: 0.04em;">
              <span>'{String(first.year).slice(2)}</span>
              {change.kind === 'counts' ? (
                <span
                  style={`color: ${deltaColor}; display: inline-flex; align-items: center; gap: 6px; min-width: 0; flex-wrap: wrap;`}
                >
                  <span style="white-space: nowrap;">
                    {change.diff === 0
                      ? '—'
                      : `${change.trend.glyph} ${change.diff > 0 ? '+' : '−'}${Math.abs(change.diff)}`}
                  </span>
                  <span class="sm-tag" title={SMALL_BASE_NOTE}>small base</span>
                </span>
              ) : (
                <span style={`color: ${deltaColor};`}>
                  {change.trend.dir === 'flat'
                    ? '—'
                    : `${change.trend.glyph} ${Math.abs(change.trend.delta).toFixed(0)}%`}
                </span>
              )}
              <span>'{String(latest.year).slice(2)}</span>
            </div>
          </div>
        );
      })}
    </div>
    <ChartDataTable
      title={`${geography} category trends`}
      unit={unit}
      series={cats.map((cat) => ({
        label: cat.name,
        points: scoped ? sliceByYearRange(seriesByCat[cat.id] ?? [], ys, ye) : seriesByCat[cat.id] ?? [],
      }))}
    />
    </>
  );
}
