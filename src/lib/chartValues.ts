import type { Unit } from './state';

/** A chart value can be unavailable; an incomplete-year rate is never zero. */
export interface ChartPoint {
  year: number;
  count: number | null;
  rate: number | null;
  partial?: boolean;
}

export interface ChartSeries {
  label: string;
  points: readonly ChartPoint[];
}

export function chartValue(point: ChartPoint | undefined, unit: Unit): number | null {
  if (!point || (unit === 'rate' && point.partial)) return null;
  const value = point[unit];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function chartYears(series: readonly ChartSeries[]): number[] {
  return [...new Set(series.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);
}

/** Callers supply only visible series so hidden references cannot flatten a chart. */
export function chartMaximum(series: readonly ChartSeries[], unit: Unit): number {
  const values = series.flatMap((s) => s.points.map((p) => chartValue(p, unit)))
    .filter((v): v is number => v !== null);
  return Math.max(1, ...values) * 1.15;
}

/** Align to calendar years, leaving a gap when a year/value is unavailable. */
export function chartSegments(
  points: readonly ChartPoint[],
  years: readonly number[],
  unit: Unit,
  x: (index: number) => number,
  y: (value: number) => number,
): Array<Array<[number, number]>> {
  const byYear = new Map(points.map((p) => [p.year, p]));
  const segments: Array<Array<[number, number]>> = [];
  let current: Array<[number, number]> = [];
  years.forEach((year, i) => {
    const value = chartValue(byYear.get(year), unit);
    if (value === null) {
      current = [];
    } else {
      if (!current.length) segments.push(current);
      current.push([x(i), y(value)]);
    }
  });
  return segments;
}

export function segmentPath(points: readonly [number, number][]): string {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
}

export const chartUnitLabel = (unit: Unit): string =>
  unit === 'rate' ? 'incidents per 10,000 residents' : 'incident counts';

export function formatChartValue(point: ChartPoint | undefined, unit: Unit): string {
  const value = chartValue(point, unit);
  if (value === null) return 'Not available';
  return value.toLocaleString('en-CA', {
    minimumFractionDigits: unit === 'rate' ? 2 : 0,
    maximumFractionDigits: unit === 'rate' ? 2 : 0,
  });
}
