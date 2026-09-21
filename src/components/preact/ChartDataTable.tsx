import { chartYears, chartUnitLabel, formatChartValue, type ChartSeries } from '../../lib/chartValues';
import type { Unit } from '../../lib/state';
import './chart-data.css';

interface Props {
  title: string;
  series: readonly ChartSeries[];
  unit: Unit;
}

/** Native disclosure/table semantics work with keyboard, touch, and screen readers. */
export default function ChartDataTable({ title, series, unit }: Props) {
  const years = chartYears(series);
  const lookup = series.map((s) => new Map(s.points.map((p) => [p.year, p])));
  const hasPartial = series.some((s) => s.points.some((p) => p.partial));
  const caption = `${title} · ${chartUnitLabel(unit)}${years.length ? ` · ${years[0]}–${years[years.length - 1]}` : ''}`;
  return (
    <details class="chart-data">
      <summary>View chart data</summary>
      <p class="chart-data-note">
        {hasPartial
          ? 'YTD counts cover an incomplete year and are not comparable with full years. YTD rates are not computed.'
          : 'Full years only; incomplete YTD totals are excluded.'}
        {' '}Not available means a value is missing, not zero.
      </p>
      <div class="chart-data-scroll" tabIndex={0} role="region" aria-label={`${title} data table`}>
        <table>
          <caption>{caption}</caption>
          <thead>
            <tr>
              <th scope="col">Year</th>
              {series.map((s) => <th scope="col" key={s.label}>{s.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {years.map((year) => (
              <tr key={year}>
                <th scope="row">{year}{lookup.some((values) => values.get(year)?.partial) ? ' YTD' : ''}</th>
                {lookup.map((values, i) => <td key={i}>{formatChartValue(values.get(year), unit)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {!years.length && <p class="chart-data-note">No values in this view.</p>}
      </div>
    </details>
  );
}
