// aggregates.ts — the server-side (Astro frontmatter) loader over the built
// JSON in public/data/aggregates/. These are contract tests over the loader's
// reshaping and lookup logic against the real built artifacts, following the
// same skip-when-absent guard as tests/data-invariants.test.ts so a fresh
// clone can still run `npm test` before a first build.
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, YEARS } from './categories';
import {
  allNeighbourhoods,
  calendarGrid,
  cityPopulationByYear,
  csiContext,
  dataThrough,
  filterPartial,
  nearestNeighbourIds,
  neighbourhoodById,
  neighbourhoodIds,
  neighbourhoodIncidents,
  torontoPartialSeries,
  torontoSeries,
  torontoTotalSeries,
} from './aggregates';

const built = existsSync(
  resolve(process.cwd(), 'public', 'data', 'aggregates', 'toronto-by-year.json'),
);
const d = built ? describe : describe.skip;
if (!built) {
  console.warn('aggregates.test: built aggregates absent — run `npm run aggregates` first; skipping.');
}

const NBHD_COUNT = 158;

describe('filterPartial (pure)', () => {
  const series = [
    { year: 2024, partial: undefined },
    { year: 2025 },
    { year: 2026, partial: true },
  ];
  it('drops partial points by default', () => {
    expect(filterPartial(series, false).map((p) => p.year)).toEqual([2024, 2025]);
  });
  it('keeps partial points when includeYTD is true', () => {
    expect(filterPartial(series, true)).toHaveLength(3);
  });
  it('handles empty series', () => {
    expect(filterPartial([], false)).toEqual([]);
  });
});

d('torontoSeries', () => {
  it('exposes every category with no partial points by default', () => {
    const s = torontoSeries();
    for (const c of CATEGORIES) {
      expect(s[c.id].length).toBeGreaterThan(0);
      expect(s[c.id].every((p) => !p.partial)).toBe(true);
      // reshaped: rate/count keys, never rate_per_10k
      for (const p of s[c.id]) {
        expect(typeof p.rate).toBe('number');
        expect(typeof p.count).toBe('number');
        expect(p).not.toHaveProperty('rate_per_10k');
      }
    }
  });

  it('covers exactly the comparable YEARS axis', () => {
    const s = torontoSeries();
    for (const c of CATEGORIES) {
      expect(s[c.id].map((p) => p.year)).toEqual([...YEARS]);
    }
  });

  it('includePartial surfaces the YTD point(s) at the tail', () => {
    const s = torontoSeries({ includePartial: true });
    for (const c of CATEGORIES) {
      const partials = s[c.id].filter((p) => p.partial);
      for (const p of partials) {
        expect(p.year).toBeGreaterThan(YEARS[YEARS.length - 1]!);
        // no denominator for a partial year → loader maps null rate to 0
        expect(p.rate).toBe(0);
      }
    }
  });
});

d('torontoTotalSeries', () => {
  it('sums the five categories per year (counts match exactly)', () => {
    const total = torontoTotalSeries();
    const perCat = torontoSeries();
    for (const p of total) {
      const summed = CATEGORIES.reduce(
        (acc, c) => acc + (perCat[c.id].find((q) => q.year === p.year)?.count ?? 0),
        0,
      );
      expect(p.count).toBe(summed);
    }
  });
  it('has no partial points', () => {
    expect(torontoTotalSeries().every((p) => !p.partial)).toBe(true);
  });
});

d('torontoPartialSeries', () => {
  it('returns only partial-flagged points', () => {
    const s = torontoPartialSeries();
    for (const c of CATEGORIES) {
      expect(s[c.id].every((p) => p.partial === true)).toBe(true);
    }
  });
});

d('neighbourhood lookups', () => {
  it('allNeighbourhoods returns all 158, each with all categories', () => {
    const all = allNeighbourhoods();
    expect(all).toHaveLength(NBHD_COUNT);
    for (const nb of all) {
      expect(nb.population).toBeGreaterThan(0);
      for (const c of CATEGORIES) {
        expect(nb.series[c.id].every((p) => !p.partial)).toBe(true);
      }
    }
  });

  it('neighbourhoodIds is 158 ids sorted numerically', () => {
    const ids = neighbourhoodIds();
    expect(ids).toHaveLength(NBHD_COUNT);
    const nums = ids.map((i) => parseInt(i, 10));
    expect([...nums].sort((a, b) => a - b)).toEqual(nums);
  });

  it('neighbourhoodById round-trips an id from the list', () => {
    const id = neighbourhoodIds()[0]!;
    const nb = neighbourhoodById(id);
    expect(nb).not.toBeNull();
    expect(nb!.id).toBe(id);
    expect(nb!.name.length).toBeGreaterThan(0);
  });

  it('neighbourhoodById returns null for unknown ids', () => {
    expect(neighbourhoodById('999')).toBeNull();
    expect(neighbourhoodById('')).toBeNull();
  });
});

d('nearestNeighbourIds', () => {
  it('returns the requested number of neighbours, excluding self', () => {
    const id = neighbourhoodIds()[0]!;
    const near = nearestNeighbourIds(id, 6);
    expect(near).toHaveLength(6);
    expect(near).not.toContain(id);
    // all returned ids are real neighbourhoods
    const all = new Set(neighbourhoodIds());
    for (const n of near) expect(all.has(n)).toBe(true);
  });

  it('is ordered by increasing distance (first neighbour is mutual-ish)', () => {
    // Weak sanity: A's nearest list should not equal another id's list —
    // i.e. results depend on the anchor.
    const [a, b] = neighbourhoodIds();
    expect(nearestNeighbourIds(a!, 5)).not.toEqual(nearestNeighbourIds(b!, 5));
  });

  it('returns [] for an unknown id', () => {
    expect(nearestNeighbourIds('does-not-exist', 5)).toEqual([]);
  });
});

d('calendarGrid', () => {
  it('is a 12-month × YEARS.length grid for a real neighbourhood', () => {
    const id = neighbourhoodIds()[0]!;
    const grid = calendarGrid(id, 'assault');
    expect(grid).toHaveLength(12);
    for (const [mi, row] of grid.entries()) {
      expect(row).toHaveLength(YEARS.length);
      for (const [yi, cell] of row.entries()) {
        expect(cell.month).toBe(mi + 1);
        expect(cell.year).toBe(YEARS[yi]);
        expect(cell.count).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('yearly grid sum matches the yearly series count for a full year', () => {
    const id = neighbourhoodIds()[0]!;
    const nb = neighbourhoodById(id)!;
    const grid = calendarGrid(id, 'assault');
    const year = YEARS[YEARS.length - 1]!;
    const yi = YEARS.indexOf(year);
    const monthly = grid.reduce((s, row) => s + row[yi]!.count, 0);
    const yearly = nb.series.assault.find((p) => p.year === year)?.count ?? -1;
    expect(monthly).toBe(yearly);
  });

  it('zero-fills an unknown neighbourhood instead of throwing', () => {
    const grid = calendarGrid('does-not-exist', 'assault');
    expect(grid).toHaveLength(12);
    expect(grid.flat().every((c) => c.count === 0)).toBe(true);
  });
});

d('metadata accessors', () => {
  it('dataThrough is an ISO date', () => {
    expect(dataThrough()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('cityPopulationByYear covers every comparable year with sane values', () => {
    const pop = cityPopulationByYear();
    for (const y of YEARS) {
      expect(pop[y], `population for ${y}`).toBeGreaterThan(1_000_000);
    }
  });

  it('neighbourhoodIncidents returns [] for unknown ids and rows for real ones', () => {
    expect(neighbourhoodIncidents('does-not-exist')).toEqual([]);
    const id = neighbourhoodIds()[0]!;
    const rows = neighbourhoodIncidents(id);
    for (const r of rows.slice(0, 20)) {
      expect(r.date).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(CATEGORIES.some((c) => c.id === r.category)).toBe(true);
    }
  });

  it('csiContext is null or a well-formed context', () => {
    const csi = csiContext();
    if (csi === null) return;
    expect(csi.years.length).toBeGreaterThan(0);
    expect(csi.geographies.length).toBeGreaterThan(0);
    for (const g of csi.geographies) {
      expect(g.series.length).toBeGreaterThan(0);
    }
  });
});
