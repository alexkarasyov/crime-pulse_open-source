// Interactive yearly trend. Visible series alone determine the scale; missing
// values create gaps, and named geography/category/unit describe the SVG.

import { useId } from 'preact/hooks';
import type { YearPoint } from '../../lib/aggregates';
import { chartMaximum, chartSegments, chartUnitLabel, chartValue, chartYears, segmentPath } from '../../lib/chartValues';

interface Props {
  series: YearPoint[];
  baseline?: YearPoint[];
  color?: string;
  unit?: 'rate' | 'count';
  height?: number;
  showBaseline?: boolean;
  title?: string;
  /** Name the primary series; title names only the optional baseline. */
  seriesLabel?: string;
  gradientId?: string;
}

export default function TrendChart({
  series,
  baseline,
  color = 'var(--accent)',
  unit = 'rate',
  height = 280,
  showBaseline = true,
  title = 'Toronto-wide',
  seriesLabel = 'Incidents',
  gradientId,
}: Props) {
  // Per-instance gradient id by default, so two TrendCharts with different
  // colours on one page don't both resolve to the first <linearGradient>.
  const autoId = useId();
  const gid = gradientId ?? `trend-area-${autoId}`;
  const pad = { l: 48, r: 24, t: 24, b: 36 };
  const W = 800;
  const H = height;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const visibleBaseline = showBaseline ? baseline : undefined;
  const visibleSeries = [{ label: seriesLabel, points: series }, ...(visibleBaseline ? [{ label: title, points: visibleBaseline }] : [])];
  const keys = chartYears(visibleSeries);
  const xStep = innerW / (keys.length - 1 || 1);

  const max = chartMaximum(visibleSeries, unit);
  const min = 0;

  const yScale = (v: number): number =>
    pad.t + innerH - ((v - min) / (max - min || 1)) * innerH;
  const xScale = (i: number): number => pad.l + i * xStep;

  const segments = chartSegments(series, keys, unit, xScale, yScale);
  const path = segments.map(segmentPath).join(' ');
  const basePath = chartSegments(visibleBaseline ?? [], keys, unit, xScale, yScale).map(segmentPath).join(' ');
  const areaPath = segments.map((points) => `${segmentPath(points)} L${points[points.length - 1]![0]},${H - pad.b} L${points[0]![0]},${H - pad.b} Z`).join(' ');

  const ticks = 4;
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => (max / ticks) * i);

  const covidIdx = keys.indexOf(2020);
  const lastPoint = segments[segments.length - 1]?.at(-1);
  const lastBase = visibleBaseline?.at(-1);
  const lastBaseValue = chartValue(lastBase, unit);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      width="100%"
      style={{ display: 'block' }}
      role="img"
      aria-label={`${seriesLabel}, ${chartUnitLabel(unit)}${keys.length ? `, ${keys[0]}–${keys[keys.length - 1]}` : ', no data'}${visibleBaseline ? `; baseline: ${title}` : ''}. Values are available in View chart data.`}
    >
      {tickVals.map((v) => (
        <g>
          <line x1={pad.l} x2={W - pad.r} y1={yScale(v)} y2={yScale(v)} class="gridline" />
          <text x={pad.l - 8} y={yScale(v) + 3} text-anchor="end" class="axis-tick">
            {v.toFixed(0)}
          </text>
        </g>
      ))}
      {keys.map((y, i) => (
        <text x={xScale(i)} y={H - pad.b + 16} text-anchor="middle" class="axis-tick">
          {`'${String(y).slice(2)}`}
        </text>
      ))}
      {covidIdx >= 0 && (
        <>
          <line
            x1={xScale(covidIdx)}
            x2={xScale(covidIdx)}
            y1={pad.t}
            y2={H - pad.b}
            stroke="var(--border-soft)"
            stroke-dasharray="2 4"
          />
          <text
            x={xScale(covidIdx) + 6}
            y={pad.t + 12}
            class="axis-tick"
            style={{ fill: 'var(--ink-4)' }}
          >
            2020 · pandemic
          </text>
        </>
      )}
      {visibleBaseline && lastBaseValue !== null && (
        <>
          <path
            d={basePath}
            stroke="var(--ink-3)"
            stroke-width="1.5"
            stroke-dasharray="3 3"
            fill="none"
          />
          <text
            x={W - pad.r}
            y={yScale(lastBaseValue) - 6}
            text-anchor="end"
            class="baseline-label"
          >
            {title}
          </text>
        </>
      )}
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color={color} stop-opacity="0.18" />
          <stop offset="100%" stop-color={color} stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gid})`} />
      <path
        d={path}
        stroke={color}
        stroke-width="2"
        fill="none"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      {lastPoint && (
        <g>
          <circle
            cx={lastPoint[0]}
            cy={lastPoint[1]}
            r="4"
            fill={color}
          />
          <circle
            cx={lastPoint[0]}
            cy={lastPoint[1]}
            r="7"
            fill={color}
            opacity="0.2"
          />
        </g>
      )}
      <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} class="axis-line" />
    </svg>
  );
}
