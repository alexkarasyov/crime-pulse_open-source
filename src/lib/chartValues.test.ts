import { describe, expect, it } from 'vitest';
import { chartMaximum, chartSegments, chartValue, chartYears, formatChartValue, segmentPath } from './chartValues';

describe('chart values', () => {
  it('distinguishes an actual zero from an unavailable or incomplete-year rate', () => {
    expect(chartValue({ year: 2025, count: 0, rate: 0 }, 'rate')).toBe(0);
    expect(formatChartValue({ year: 2025, count: 0, rate: 0 }, 'count')).toBe('0');
    expect(formatChartValue({ year: 2026, count: 43, rate: 0, partial: true }, 'rate')).toBe('Not available');
    expect(formatChartValue({ year: 2026, count: 43, rate: null, partial: true }, 'count')).toBe('43');
    expect(chartValue(undefined, 'count')).toBeNull();
    expect(chartValue({ year: 2025, count: 1, rate: NaN }, 'rate')).toBeNull();
  });

  it('aligns nonmatching years and leaves gaps for missing values', () => {
    const points = [{ year: 2016, count: 2, rate: 1 }, { year: 2018, count: 8, rate: 4 }];
    const years = chartYears([{ label: 'a', points }, { label: 'b', points: [{ year: 2017, count: 0, rate: 0 }] }]);
    expect(years).toEqual([2016, 2017, 2018]);
    expect(chartSegments(points, years, 'count', (i) => i * 100, (v) => v).map(segmentPath)).toEqual(['M0,2', 'M200,8']);
  });

  it('uses only visible data and keeps an all-zero view finite', () => {
    const neighbourhood = { label: 'a', points: [{ year: 2025, count: 100, rate: 12 }] };
    const city = { label: 'city', points: [{ year: 2025, count: 10000, rate: 14 }] };
    expect(chartMaximum([neighbourhood], 'count')).toBeCloseTo(115);
    expect(chartMaximum([neighbourhood, city], 'count')).toBeCloseTo(11500);
    expect(chartMaximum([], 'count')).toBeGreaterThan(0);
  });
});
