// Unit tests for the pure formatting/math helpers.
import { describe, expect, it } from 'vitest';
import {
  catValueAt,
  changeTrend,
  fmtUnit,
  guardedChange,
  pctDelta,
  SMALL_BASE_MAX,
  sliceByYearRange,
  sumActiveAt,
  sumSeriesAcross,
  trendColor,
  TREND_DOWN_COLOR,
  TREND_FLAT_COLOR,
  TREND_UP_COLOR,
  unitSuffix,
  unitWord,
  yoyTrend,
} from './format';

describe('pctDelta', () => {
  it('computes percent change from a to b', () => {
    expect(pctDelta(100, 150)).toBe(50);
    expect(pctDelta(200, 100)).toBe(-50);
    expect(pctDelta(80, 80)).toBe(0);
  });

  it('returns 0 on a zero baseline (undefined delta convention)', () => {
    expect(pctDelta(0, 42)).toBe(0);
  });
});

describe('trendColor', () => {
  it('maps each direction to its token', () => {
    expect(trendColor('up')).toBe(TREND_UP_COLOR);
    expect(trendColor('down')).toBe(TREND_DOWN_COLOR);
    expect(trendColor('flat')).toBe(TREND_FLAT_COLOR);
  });
});

describe('sliceByYearRange', () => {
  const series = [2016, 2017, 2018, 2019, 2020].map((year) => ({ year }));

  it('keeps both ends inclusive', () => {
    expect(sliceByYearRange(series, 2017, 2019).map((p) => p.year)).toEqual([
      2017, 2018, 2019,
    ]);
  });

  it('returns everything when the range covers the series', () => {
    expect(sliceByYearRange(series, 2000, 2100)).toHaveLength(5);
  });

  it('returns empty for a disjoint range', () => {
    expect(sliceByYearRange(series, 2021, 2025)).toEqual([]);
  });
});

describe('fmtUnit / unitSuffix / unitWord', () => {
  it('formats rates with no decimals', () => {
    expect(fmtUnit(12.4, 'rate')).toBe('12');
    expect(fmtUnit(12.5, 'rate')).toBe('13');
  });

  it('formats counts with en-CA thousands separators', () => {
    expect(fmtUnit(12345.6, 'count')).toBe((12346).toLocaleString('en-CA'));
  });

  it('suffixes and words follow the unit', () => {
    expect(unitSuffix('rate')).toBe('/ 10K');
    expect(unitSuffix('count')).toBe('');
    expect(unitWord('rate')).toBe('rate');
    expect(unitWord('count')).toBe('count');
  });
});

describe('sumActiveAt', () => {
  // Both schema shapes the helper promises to handle.
  const seriesByCat = {
    assault: [
      { year: 2024, count: 10, rate: 5 },
      { year: 2025, count: 20, rate: 8 },
    ],
    robbery: [
      { year: 2024, count: 3, rate_per_10k: 1.5 },
      { year: 2025, count: 7, rate_per_10k: 2.5 },
    ],
  };

  it('sums counts across active categories at a year', () => {
    expect(sumActiveAt(seriesByCat, ['assault', 'robbery'], 2025, 'count')).toBe(27);
  });

  it('sums rates across both rate/rate_per_10k shapes', () => {
    expect(sumActiveAt(seriesByCat, ['assault', 'robbery'], 2024, 'rate')).toBe(6.5);
  });

  it('skips categories with no series and years with no point', () => {
    // The signature promises every key exists; the runtime guard tolerates a
    // missing one anyway. Cast past the type to exercise that guard.
    const sparse = { assault: seriesByCat.assault } as unknown as Record<
      'missing',
      { year: number; count: number }[]
    >;
    expect(sumActiveAt(sparse, ['missing'], 2025, 'count')).toBe(0);
    expect(sumActiveAt(seriesByCat, ['assault'], 1999, 'count')).toBe(0);
  });

  it('treats a null rate as 0', () => {
    const withNull = { assault: [{ year: 2026, count: 5, rate_per_10k: null }] };
    expect(sumActiveAt(withNull, ['assault'], 2026, 'rate')).toBe(0);
    expect(sumActiveAt(withNull, ['assault'], 2026, 'count')).toBe(5);
  });
});

describe('catValueAt', () => {
  const seriesByCat = {
    assault: [
      { year: 2024, count: 10, rate: 5 },
      { year: 2025, count: 20, rate: 8 },
    ],
    robbery: [{ year: 2025, count: 7, rate_per_10k: 3.5 }],
  };

  it('reads a single category at a year, never summing across cats', () => {
    expect(catValueAt(seriesByCat, 'assault', 2025, 'count')).toBe(20);
    expect(catValueAt(seriesByCat, 'robbery', 2025, 'count')).toBe(7);
  });

  it('handles both rate and rate_per_10k schema shapes', () => {
    expect(catValueAt(seriesByCat, 'assault', 2024, 'rate')).toBe(5);
    expect(catValueAt(seriesByCat, 'robbery', 2025, 'rate')).toBe(3.5);
  });

  it('returns 0 for a missing series, year, or null rate', () => {
    const sparse = {} as unknown as Record<'missing', { year: number; count: number }[]>;
    expect(catValueAt(sparse, 'missing', 2025, 'count')).toBe(0);
    expect(catValueAt(seriesByCat, 'assault', 1999, 'count')).toBe(0);
    const withNull = { assault: [{ year: 2026, count: 5, rate_per_10k: null }] };
    expect(catValueAt(withNull, 'assault', 2026, 'rate')).toBe(0);
  });
});

describe('sumSeriesAcross', () => {
  const seriesByCat = {
    assault: [
      { year: 2024, rate: 5, count: 10 },
      { year: 2025, rate: 8, count: 20 },
    ],
    robbery: [
      { year: 2024, rate: 1, count: 3 },
      { year: 2025, rate: 2, count: 7 },
    ],
  };

  it('sums year by year across the active categories', () => {
    expect(sumSeriesAcross(seriesByCat, ['assault', 'robbery'])).toEqual([
      { year: 2024, rate: 6, count: 13 },
      { year: 2025, rate: 10, count: 27 },
    ]);
  });

  it('uses the first active category as the year axis', () => {
    expect(sumSeriesAcross(seriesByCat, ['robbery']).map((p) => p.year)).toEqual([
      2024, 2025,
    ]);
  });

  it('returns empty for no resolvable axis', () => {
    expect(sumSeriesAcross(seriesByCat as never, [] as never[])).toEqual([]);
  });
});

describe('yoyTrend', () => {
  it('flags up/down beyond the 1% flat band', () => {
    expect(yoyTrend(100, 110)).toMatchObject({ glyph: '▲', dir: 'up' });
    expect(yoyTrend(100, 90)).toMatchObject({ glyph: '▼', dir: 'down' });
  });

  it('treats |delta| under the threshold as flat', () => {
    expect(yoyTrend(1000, 1005)).toMatchObject({ glyph: '—', dir: 'flat' });
    expect(yoyTrend(1000, 995)).toMatchObject({ glyph: '—', dir: 'flat' });
  });

  it('a zero baseline is flat (pctDelta convention)', () => {
    expect(yoyTrend(0, 50)).toMatchObject({ dir: 'flat', delta: 0 });
  });

  it('honours a custom threshold', () => {
    expect(yoyTrend(100, 104, 5)).toMatchObject({ dir: 'flat' });
    expect(yoyTrend(100, 106, 5)).toMatchObject({ dir: 'up' });
  });
});

describe('changeTrend', () => {
  it('has no flat band — any nonzero delta gets a direction', () => {
    expect(changeTrend(1000, 1001)).toMatchObject({ dir: 'up' });
    expect(changeTrend(1000, 999)).toMatchObject({ dir: 'down' });
  });

  it('zero/undefined baseline renders flat, not a confident 0%', () => {
    expect(changeTrend(0, 50)).toEqual({ glyph: '—', dir: 'flat', delta: 0 });
  });

  it('identical values are flat', () => {
    expect(changeTrend(42, 42)).toMatchObject({ dir: 'flat', delta: 0 });
  });
});

describe('guardedChange (small-base guard)', () => {
  it('shows a percentage when both endpoints exceed the small-base cap', () => {
    const d = guardedChange(SMALL_BASE_MAX + 1, 20);
    expect(d.kind).toBe('pct');
    expect(d.trend.dir).toBe('up');
  });

  it('switches to counts when either endpoint is at or below the cap', () => {
    expect(guardedChange(5, 8)).toMatchObject({
      kind: 'counts',
      diff: 3,
      from: 5,
      to: 8,
      trend: { glyph: '▲', dir: 'up' },
    });
    // Big base collapsing to a small one still trips the guard.
    expect(guardedChange(120, 4)).toMatchObject({ kind: 'counts', diff: -116 });
  });

  it('a 1 → 3 change never renders as "▲ 200%"', () => {
    const d = guardedChange(1, 3);
    expect(d.kind).toBe('counts');
    if (d.kind === 'counts') expect(d.diff).toBe(2);
  });

  it('zero baseline shows counts instead of an undefined percentage', () => {
    expect(guardedChange(0, 5)).toMatchObject({ kind: 'counts', diff: 5 });
  });

  it('no change on a small base is flat', () => {
    expect(guardedChange(4, 4)).toMatchObject({
      kind: 'counts',
      diff: 0,
      trend: { glyph: '—', dir: 'flat' },
    });
  });
});
