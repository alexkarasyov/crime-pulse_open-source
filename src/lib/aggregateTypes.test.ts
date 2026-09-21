// Unit tests for the client-safe aggregate schema guards. These are the
// checks that turn schema drift into a visible island error instead of a
// silently misaligned x-axis (see P2.7).
import { describe, expect, it } from 'vitest';
import {
  asByNeighbourhoodYear,
  asTorontoByYear,
  filterPartial,
  reshapeYearPoint,
  SCHEMA_VERSION,
  type RawYearPoint,
} from './aggregateTypes';
import { CATEGORIES, YEARS } from './categories';

function fullSeries(): RawYearPoint[] {
  return YEARS.map((year) => ({ year, count: 100, rate_per_10k: 3.5 }));
}

function withPartial(series: RawYearPoint[]): RawYearPoint[] {
  return [...series, { year: 2026, count: 40, rate_per_10k: null, partial: true }];
}

function allCategorySeries(series: RawYearPoint[]): Record<string, RawYearPoint[]> {
  return Object.fromEntries(CATEGORIES.map(({ id }) => [id, series]));
}

function resolution() {
  const byYear = Object.fromEntries(
    YEARS.map((year) => [
      String(year),
      {
        total_incidents: 500,
        resolved_incidents: 495,
        unresolved_incidents: 5,
        unresolved_by_category: Object.fromEntries(
          CATEGORIES.map(({ id }) => [id, 1]),
        ),
      },
    ]),
  );
  return {
    total_incidents: 5000,
    resolved_incidents: 4950,
    unresolved_incidents: 50,
    unresolved_pct: 1,
    by_year: byYear,
  };
}

function torontoPayload(overrides: Record<string, unknown> = {}): unknown {
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: '2026-07-16T00:00:00Z',
    categories: CATEGORIES.map(({ id }) => id),
    city_population_by_year: { '2025': 3_000_000 },
    series: allCategorySeries(withPartial(fullSeries())),
    total_series: fullSeries(),
    neighbourhood_resolution: resolution(),
    ...overrides,
  };
}

function nbhdPayload(series: RawYearPoint[]): unknown {
  return {
    schema_version: SCHEMA_VERSION,
    generated_at: '2026-07-16T00:00:00Z',
    neighbourhoods: {
      '73': {
        id: '73',
        name: 'Moss Park',
        population: 21490,
        series: allCategorySeries(series),
        total_series: series,
      },
    },
  };
}

describe('reshapeYearPoint', () => {
  it('renames rate_per_10k to rate', () => {
    expect(reshapeYearPoint({ year: 2020, count: 9, rate_per_10k: 4.2 })).toEqual({
      year: 2020,
      rate: 4.2,
      count: 9,
    });
  });

  it('collapses a null rate to 0 and preserves the partial flag', () => {
    expect(
      reshapeYearPoint({ year: 2026, count: 5, rate_per_10k: null, partial: true }),
    ).toEqual({ year: 2026, rate: 0, count: 5, partial: true });
  });

  it('omits the partial key entirely for full years', () => {
    expect(
      'partial' in reshapeYearPoint({ year: 2020, count: 9, rate_per_10k: 4.2 }),
    ).toBe(false);
  });
});

describe('filterPartial', () => {
  const series = withPartial(fullSeries());

  it('drops partial points by default', () => {
    expect(filterPartial(series)).toHaveLength(YEARS.length);
    expect(filterPartial(series).every((p) => !p.partial)).toBe(true);
  });

  it('keeps partial points when includeYTD is true', () => {
    expect(filterPartial(series, true)).toHaveLength(YEARS.length + 1);
  });
});

describe('asTorontoByYear', () => {
  it('accepts a well-formed payload (with a trailing partial year)', () => {
    const d = asTorontoByYear(torontoPayload());
    expect(d.series.assault).toHaveLength(YEARS.length + 1);
  });

  it('rejects non-objects', () => {
    expect(() => asTorontoByYear(null)).toThrow(/not an object/);
    expect(() => asTorontoByYear('{}')).toThrow(/not an object/);
  });

  it('rejects a schema_version mismatch', () => {
    expect(() =>
      asTorontoByYear(torontoPayload({ schema_version: SCHEMA_VERSION + 1 })),
    ).toThrow(/schema_version/);
  });

  it('rejects a missing series map', () => {
    expect(() => asTorontoByYear(torontoPayload({ series: undefined }))).toThrow(
      /missing series/,
    );
  });

  it('rejects a series that starts on the wrong year', () => {
    const shifted = fullSeries().slice(1); // starts at 2017
    expect(() =>
      asTorontoByYear(torontoPayload({ series: allCategorySeries(shifted) })),
    ).toThrow(/full-year axis/);
  });

  it('rejects a series whose last full year is stale', () => {
    const stale = fullSeries().slice(0, -1); // ends at 2024
    expect(() =>
      asTorontoByYear(torontoPayload({ series: allCategorySeries(stale) })),
    ).toThrow(/full-year axis/);
  });

  it('rejects an empty series', () => {
    expect(() =>
      asTorontoByYear(torontoPayload({ series: allCategorySeries([]) })),
    ).toThrow(/empty or missing/);
  });

  it('rejects a missing interior year', () => {
    const missing = fullSeries().filter((p) => p.year !== 2020);
    expect(() =>
      asTorontoByYear(torontoPayload({ series: allCategorySeries(missing) })),
    ).toThrow(/full-year axis/);
  });

  it('validates every category, not only assault', () => {
    const series = allCategorySeries(fullSeries());
    series.robbery = fullSeries().filter((p) => p.year !== 2021);
    expect(() => asTorontoByYear(torontoPayload({ series }))).toThrow(/robbery/);
  });

  it('requires reconciled neighbourhood-resolution metadata', () => {
    expect(() =>
      asTorontoByYear(
        torontoPayload({
          neighbourhood_resolution: {
            ...resolution(),
            resolved_incidents: 1,
          },
        }),
      ),
    ).toThrow(/totals do not reconcile/);
  });
});

describe('asByNeighbourhoodYear', () => {
  it('accepts a well-formed payload', () => {
    const d = asByNeighbourhoodYear(nbhdPayload(fullSeries()));
    expect(Object.keys(d.neighbourhoods)).toEqual(['73']);
  });

  it('rejects a missing neighbourhoods map', () => {
    expect(() =>
      asByNeighbourhoodYear({ schema_version: SCHEMA_VERSION }),
    ).toThrow(/neighbourhoods/);
  });

  it('validates each neighbourhood series axis', () => {
    expect(() => asByNeighbourhoodYear(nbhdPayload(fullSeries().slice(1)))).toThrow(
      /full-year axis/,
    );
  });

  it('rejects a missing interior year in a non-assault category', () => {
    const payload = nbhdPayload(fullSeries()) as {
      neighbourhoods: Record<string, { series: Record<string, RawYearPoint[]> }>;
    };
    payload.neighbourhoods['73']!.series.theftOver = fullSeries().filter(
      (p) => p.year !== 2022,
    );
    expect(() => asByNeighbourhoodYear(payload)).toThrow(/theftOver/);
  });

  it('rejects a schema_version mismatch', () => {
    expect(() =>
      asByNeighbourhoodYear({
        schema_version: SCHEMA_VERSION - 1,
        neighbourhoods: {},
      }),
    ).toThrow(/schema_version/);
  });
});
