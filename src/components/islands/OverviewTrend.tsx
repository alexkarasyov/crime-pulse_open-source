// Overview screen — section 04 trend chart card. Keyed by primaryCat + unit;
// the baseline follows the view rail's category selection.

import { CATEGORIES, CAT_BY_ID } from '../../lib/categories';
import { primaryCat, unit, yearRange, activeCats } from '../../lib/state';
import { sliceByYearRange, sumSeriesAcross } from '../../lib/format';
import type { YearPoint } from '../../lib/aggregates';
import TrendChart from '../preact/TrendChart';
import ChartDataTable from '../preact/ChartDataTable';

interface Props {
  torontoSeries: Record<string, YearPoint[]>;
  totalSeries: YearPoint[];
}

export default function OverviewTrend({ torontoSeries, totalSeries }: Props) {
  const cat = primaryCat.value;
  const u = unit.value;
  const [startYear, endYear] = yearRange.value;
  const cats = activeCats.value;
  const allOn = cats.length === CATEGORIES.length;
  const baselineLabel = allOn ? 'all categories' : `${cats.length} selected categories`;
  const primary = CAT_BY_ID[cat];
  // Slice the primary series and baseline to the same selected window.
  const series = sliceByYearRange(torontoSeries[cat] ?? [], startYear, endYear);
  const baseline = sliceByYearRange(
    allOn ? totalSeries : sumSeriesAcross(torontoSeries, cats),
    startYear,
    endYear,
  );
  return (
    <div class="card">
      <div class="card-head">
        <h3 class="card-title">{u === 'rate' ? 'Rate' : 'Count'} by year</h3>
        <span class="card-sub">{u === 'rate' ? 'per 10k' : 'counts'} · {startYear}–{endYear} · baseline = {baselineLabel}</span>
      </div>
      <TrendChart
        series={series}
        baseline={baseline}
        color={primary.color}
        unit={u}
        title={allOn ? 'All categories' : `${cats.length} selected categories`}
        seriesLabel={`Toronto-wide ${primary.name.toLowerCase()}`}
      />
      <div style="display: flex; gap: 12px 24px; margin-top: 12px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); flex-wrap: wrap;">
        <span><span style={`color: ${primary.color};`}>●</span> {primary.name}</span>
        <span>
          <span style="display: inline-block; width: 12px; height: 1px; background: var(--ink-3); vertical-align: middle; border-top: 1px dashed;" />
          {allOn ? 'All categories' : `${cats.length} selected categories`} (baseline)
        </span>
      </div>
      <ChartDataTable
        title="Toronto-wide yearly trend"
        unit={u}
        series={[
          { label: primary.name, points: series },
          { label: allOn ? 'All categories (baseline)' : `${cats.map((id) => CAT_BY_ID[id].name).join(' + ')} (baseline)`, points: baseline },
        ]}
      />
    </div>
  );
}
