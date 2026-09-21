// The two-column block on the Neighbourhood screen: nbhd vs Toronto trend +
// small multiples. Reacts to primaryCat + unit + yearRange + activeCats.
//
// Counts mode drops the Toronto overlay (v2 design): city-wide counts live on
// a ~100× different scale, so plotting both flattens the neighbourhood line
// into noise. Rate mode keeps the overlay — same denominator, comparable.

import { CAT_BY_ID } from '../../lib/categories';
import { primaryCat, unit, yearRange } from '../../lib/state';
import { sliceByYearRange } from '../../lib/format';
import type { YearPoint } from '../../lib/aggregates';
import TrendChart from '../preact/TrendChart';
import SmallMultiples from '../preact/SmallMultiples';
import ChartDataTable from '../preact/ChartDataTable';

interface Props {
  nbhdName: string;
  seriesByCat: Record<string, YearPoint[]>;
  torontoByCat: Record<string, YearPoint[]>;
}

export default function NeighbourhoodTrend({
  nbhdName,
  seriesByCat,
  torontoByCat,
}: Props) {
  const cat = primaryCat.value;
  const u = unit.value;
  const [ys, ye] = yearRange.value;
  const primary = CAT_BY_ID[cat];
  const series = sliceByYearRange(seriesByCat[cat] ?? [], ys, ye);
  const baseline = u === 'rate' ? sliceByYearRange(torontoByCat[cat] ?? [], ys, ye) : undefined;
  return (
    <div class="two-col">
      <div class="card">
        <div class="card-head">
          <h3 class="card-title">{primary.name} · {nbhdName}{u === 'rate' ? ' vs. Toronto' : ''}</h3>
          <span class="card-sub">{u === 'rate' ? 'rate / 10K' : 'counts'} · {ys} – {ye}</span>
        </div>
        <TrendChart
          series={series}
          baseline={baseline}
          color={primary.color}
          unit={u}
          title={`Toronto-wide ${primary.name.toLowerCase()}`}
          seriesLabel={`${nbhdName} ${primary.name.toLowerCase()}`}
        />
        <div style="display: flex; gap: 24px; margin-top: 12px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); flex-wrap: wrap;">
          <span><span style={`color: ${primary.color};`}>●</span> {nbhdName}</span>
          {u === 'rate' ? (
            <span>
              <span style="display: inline-block; width: 12px; height: 1px; background: var(--ink-3); vertical-align: middle; border-top: 1px dashed;" />
              Toronto-wide
            </span>
          ) : (
            <span>city overlay hidden in counts mode (different scale; switch to rate to compare)</span>
          )}
        </div>
        <ChartDataTable
          title={`${nbhdName} ${primary.name.toLowerCase()} yearly trend`}
          unit={u}
          series={[
            { label: nbhdName, points: series },
            ...(baseline ? [{ label: 'Toronto-wide (baseline)', points: baseline }] : []),
          ]}
        />
      </div>
      <div class="card">
        <div class="card-head">
          <h3 class="card-title">Categories in scope · small multiples</h3>
          <span class="card-sub">Same {series.length}-year window</span>
        </div>
        <SmallMultiples seriesByCat={seriesByCat} unit={u} scoped highlightPrimary geography={nbhdName} />
      </div>
    </div>
  );
}
