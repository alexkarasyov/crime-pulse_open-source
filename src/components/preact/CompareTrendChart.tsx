import type { ChartPoint } from '../../lib/chartValues';
import { chartMaximum, chartSegments, chartUnitLabel, segmentPath } from '../../lib/chartValues';
import { YEARS } from '../../lib/categories';
import type { Unit } from '../../lib/state';
import ChartDataTable from './ChartDataTable';

interface Pick {
  id: string;
  name: string;
  color: string;
  points: readonly ChartPoint[];
}

interface Props {
  picks: readonly Pick[];
  /** Omit the baseline entirely when hidden, including from scale and table. */
  baseline?: readonly ChartPoint[];
  category: string;
  unit: Unit;
}

// Line patterns, slot numbers, and full names supplement the category colours.
const PATTERNS = ['', '8 3', '2 3', '10 3 2 3'];

export default function CompareTrendChart({ picks, baseline, category, unit }: Props) {
  const W = 900;
  const H = 380;
  const pad = { l: 56, r: 24, t: 24, b: 36 };
  const series = [
    ...picks.map((pick, i) => ({ label: `Slot ${i + 1} · ${pick.name}`, points: pick.points })),
    ...(baseline ? [{ label: 'Toronto-wide (baseline)', points: baseline }] : []),
  ];
  const max = chartMaximum(series, unit);
  const y = (value: number) => H - pad.b - (value / max) * (H - pad.t - pad.b);
  const x = (i: number) => pad.l + i * (W - pad.l - pad.r) / (YEARS.length - 1);
  const line = (points: readonly ChartPoint[]) => chartSegments(points, YEARS, unit, x, y).map(segmentPath).join(' ');
  return (
    <>
      <svg
        class="compare-trend-chart"
        data-baseline-visible={Boolean(baseline)}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        style={{ display: 'block' }}
        role="img"
        aria-label={`${category}, ${chartUnitLabel(unit)}, ${YEARS[0]}–${YEARS[YEARS.length - 1]}; ${picks.map((p) => p.name).join(', ')}${baseline ? '; Toronto-wide baseline shown' : '; Toronto-wide baseline hidden'}. Values are available in View chart data.`}
      >
        {Array.from({ length: 5 }, (_, i) => max / 4 * i).map((value) => (
          <g key={value}>
            <line x1={pad.l} x2={W - pad.r} y1={y(value)} y2={y(value)} class="gridline" />
            <text x={pad.l - 8} y={y(value) + 3} text-anchor="end" class="axis-tick">{value.toFixed(0)}</text>
          </g>
        ))}
        {YEARS.map((year, i) => (
          <text key={year} x={x(i)} y={H - pad.b + 16} text-anchor="middle" class="axis-tick">{`'${String(year).slice(2)}`}</text>
        ))}
        <line x1={x(YEARS.indexOf(2020))} x2={x(YEARS.indexOf(2020))} y1={pad.t} y2={H - pad.b} stroke="var(--border-soft)" stroke-dasharray="2 4" />
        <text x={x(YEARS.indexOf(2020)) + 6} y={pad.t + 12} class="axis-tick">2020 · pandemic</text>
        {baseline && <path data-series="toronto" d={line(baseline)} stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="3 3" fill="none" />}
        {picks.map((pick, i) => (
          <path
            key={pick.id}
            data-series={pick.id}
            d={line(pick.points)}
            stroke={pick.color}
            stroke-width="2"
            stroke-dasharray={PATTERNS[i] || undefined}
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} class="axis-line" />
      </svg>
      <div class="compare-chart-legend" aria-label="Chart legend">
        {picks.map((pick, i) => (
          <span key={pick.id}>
            <svg width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke={pick.color} stroke-width="2" stroke-dasharray={PATTERNS[i] || undefined} /></svg>
            {i + 1}. {pick.name} · N°{pick.id}
          </span>
        ))}
        {baseline && <span><svg width="24" height="8" aria-hidden="true"><line x1="0" y1="4" x2="24" y2="4" stroke="var(--ink-3)" stroke-dasharray="3 3" /></svg>Toronto-wide baseline</span>}
      </div>
      <ChartDataTable title={`${category} neighbourhood comparison`} series={series} unit={unit} />
    </>
  );
}
