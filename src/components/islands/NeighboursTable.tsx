// Table of "this nbhd + nearby IDs" for the active cat, with the city-wide
// figure as an anchor row on top. Reacts to primaryCat + unit + yearRange.
//
// Props are slim per-category number arrays (parallel to `years`) rather
// than full YearPoint objects, to keep the serialized island props small.
//
// The change column runs through the small-base guard: a % over a sub-10
// incident base exaggerates the change, so those rows show raw counts with a
// "small base" tag. The Toronto anchor row never trips it (city-scale counts).

import { CAT_BY_ID, type CategoryId } from '../../lib/categories';
import { primaryCat, unit, yearRange } from '../../lib/state';
import { changeTrend, guardedChange, SMALL_BASE_NOTE, trendColor } from '../../lib/format';
import Sparkline from '../preact/Sparkline';

export interface NeighbourRow {
  id: string;
  name: string;
  population: number;
  /** Per category: rates and counts, parallel to the `years` prop. */
  byCat: Record<CategoryId, { rates: number[]; counts: number[] }>;
}

interface Props {
  /** The full-year axis the per-category arrays are parallel to. */
  years: number[];
  rows: NeighbourRow[];
  /** ID of the "this is me" row — gets highlighted. */
  selfId: string;
  /** City-wide series (same shape/axis) rendered as the anchor row. */
  cityByCat?: NeighbourRow['byCat'];
  /** Annual city denominators, keyed by year, for the anchor population. */
  cityPopulationByYear?: Record<number, number>;
}

export default function NeighboursTable({
  years,
  rows,
  selfId,
  cityByCat,
  cityPopulationByYear,
}: Props) {
  const cat = primaryCat.value;
  const u = unit.value;
  const [ys, ye] = yearRange.value;
  const primary = CAT_BY_ID[cat];
  // Slice the parallel arrays down to the selected year window.
  const startIdx = Math.max(0, years.findIndex((y) => y >= ys));
  let endIdx = years.length - 1;
  while (endIdx > 0 && years[endIdx]! > ye) endIdx--;
  const span = years.slice(startIdx, endIdx + 1);
  const yearSpan = span.length
    ? `'${String(span[0]).slice(2)} → '${String(span[span.length - 1]).slice(2)}`
    : '—';

  const slice = (arr: number[]): number[] => arr.slice(startIdx, endIdx + 1);

  function dataCells(byCat: NeighbourRow['byCat'], guard: boolean) {
    const series = byCat[cat];
    if (!series) return null;
    const vals = slice(u === 'rate' ? series.rates : series.counts);
    const counts = slice(series.counts);
    if (vals.length === 0) return null;
    const last = vals[vals.length - 1]!;
    const lastCount = counts[counts.length - 1]!;
    const change = guard
      ? guardedChange(counts[0]!, lastCount)
      // City denominators change annually, so a rate change can differ from
      // the count change. The city anchor must follow the displayed unit.
      : ({ kind: 'pct', trend: changeTrend(vals[0]!, last) } as const);
    const deltaColor = trendColor(change.trend.dir);
    return { vals, last, lastCount, change, deltaColor };
  }

  const city = cityByCat ? dataCells(cityByCat, false) : null;
  const cityPopulation = cityPopulationByYear?.[span[span.length - 1]!];

  return (
    <div class="card" style="padding: 0; overflow: hidden;">
      <table
        class="cmp-table"
        tabIndex={0}
        aria-label={`Nearby neighbourhood ${primary.name.toLowerCase()} comparison, ${ys}–${ye}, ${u === 'rate' ? 'rates per 10,000 residents' : 'incident counts'}`}
      >
        <thead>
          <tr>
            <th>Neighbourhood</th>
            <th>N°</th>
            <th>Population</th>
            <th>{primary.name} {u === 'rate' ? 'rate / 10K' : 'count'}</th>
            <th>{span[span.length - 1] ?? ''} count</th>
            <th>{yearSpan}</th>
            <th style="width: 140px;">{span.length}-year trace</th>
          </tr>
        </thead>
        <tbody>
          {city && (
            <tr class="anchor-row">
              <td>Toronto · city-wide</td>
              <td class="v">—</td>
              <td class="v">{cityPopulation ? cityPopulation.toLocaleString() : '—'}</td>
              <td class="v">{u === 'rate' ? city.last.toFixed(1) : city.last.toLocaleString()}</td>
              <td class="v">{city.lastCount.toLocaleString()}</td>
              <td class="v" style={`color: ${city.deltaColor};`}>
                {city.change.trend.dir === 'flat'
                  ? '—'
                  : `${city.change.trend.glyph} ${Math.abs(city.change.trend.delta).toFixed(0)}%`}
              </td>
              <td>
                <div style="height: 28px;">
                  <Sparkline
                    data={city.vals.map((v) => ({ rate: v }))}
                    color="var(--ink-3)"
                    height={28}
                    width={140}
                  />
                </div>
              </td>
            </tr>
          )}
          {rows.map((n) => {
            const cells = dataCells(n.byCat, true);
            if (!cells) return null;
            const isMe = n.id === selfId;
            const { vals, last, lastCount, change, deltaColor } = cells;
            return (
              <tr
                class={isMe ? 'nbhd-row self-row' : ''}
                style={isMe ? 'background: var(--accent-soft);' : ''}
              >
                <td style={`color: ${isMe ? 'var(--accent)' : 'var(--ink)'};`}>
                  {n.name}
                  {isMe ? '  ◀' : ''}
                </td>
                <td class="v">{n.id}</td>
                <td class="v">{n.population.toLocaleString()}</td>
                <td class="v" style={`color: ${primary.color};`}>
                  {u === 'rate' ? last.toFixed(1) : last.toLocaleString()}
                </td>
                <td class="v">{lastCount}</td>
                <td class="v" style={`color: ${deltaColor}; white-space: nowrap;`}>
                  {change.kind === 'counts' ? (
                    <>
                      {change.diff === 0
                        ? '—'
                        : `${change.trend.glyph} ${change.diff > 0 ? '+' : '−'}${Math.abs(change.diff)}`}
                      {' '}
                      <span class="sm-tag" title={SMALL_BASE_NOTE}>small base</span>
                    </>
                  ) : change.trend.dir === 'flat' ? (
                    '—'
                  ) : (
                    `${change.trend.glyph} ${Math.abs(change.trend.delta).toFixed(0)}%`
                  )}
                </td>
                <td>
                  <div style={`height: 28px; color: ${primary.color};`}>
                    <Sparkline
                      data={vals.map((v) => ({ rate: v }))}
                      color={primary.color}
                      height={28}
                      width={140}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
