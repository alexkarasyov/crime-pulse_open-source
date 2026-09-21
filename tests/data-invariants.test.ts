// Invariant checks over the BUILT aggregates in public/data/ — the JSON the
// site actually serves. These are integration tests for the Python pipeline's
// output contract (ADR-004): run `npm run aggregates` (or `npm run build`)
// first. The whole suite skips with a notice when the aggregates are absent
// (fresh clone) so `npm test` stays runnable before a first build.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CATEGORIES, YEARS } from '../src/lib/categories';
import {
  SCHEMA_VERSION,
  asByNeighbourhoodYear,
  asTorontoByYear,
  type RawByNeighbourhoodYear,
  type RawTorontoByYear,
  type RawYearPoint,
} from '../src/lib/aggregateTypes';

const AGG_DIR = resolve(process.cwd(), 'public', 'data', 'aggregates');
const GEO_PATH = resolve(
  process.cwd(),
  'public',
  'data',
  'geo',
  'toronto-neighbourhoods-158.geojson',
);
const built = existsSync(resolve(AGG_DIR, 'toronto-by-year.json'));

const NBHD_COUNT = 158;
// ADR-004 per-artifact gzip watch budget, also enforced by the aggregator.
const SIZE_BUDGET_BYTES = 200 * 1024;
const CAT_IDS = CATEGORIES.map((c) => c.id);

function load<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(AGG_DIR, name), 'utf8')) as T;
}

function fullYearsOf(series: RawYearPoint[]): number[] {
  return series.filter((p) => !p.partial).map((p) => p.year);
}

describe.skipIf(!built)('built aggregates (run npm run aggregates first)', () => {
  const toronto = built ? load<RawTorontoByYear>('toronto-by-year.json') : null!;
  const byNbhd = built
    ? load<RawByNeighbourhoodYear>('by-neighbourhood-year.json')
    : null!;

  describe('toronto-by-year.json', () => {
    it('passes the client-side schema guard', () => {
      expect(() => asTorontoByYear(toronto)).not.toThrow();
    });

    it('carries the pinned schema version and freshness metadata', () => {
      expect(toronto.schema_version).toBe(SCHEMA_VERSION);
      expect(toronto.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const t = toronto as RawTorontoByYear & {
        data_through?: string;
        data_imported_at?: string;
      };
      expect(t.data_through).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(t.data_imported_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it('covers exactly the five canonical categories', () => {
      expect([...toronto.categories].sort()).toEqual([...CAT_IDS].sort());
    });

    it('every category series spans the comparable window, in order', () => {
      for (const cat of CAT_IDS) {
        expect(fullYearsOf(toronto.series[cat]), cat).toEqual([...YEARS]);
      }
    });

    it('full years have a real rate; partial years have none', () => {
      for (const cat of CAT_IDS) {
        for (const p of toronto.series[cat]) {
          expect(Number.isInteger(p.count), `${cat} ${p.year} count`).toBe(true);
          expect(p.count, `${cat} ${p.year} count`).toBeGreaterThanOrEqual(0);
          if (p.partial) {
            expect(p.rate_per_10k, `${cat} ${p.year} partial rate`).toBeNull();
          } else {
            expect(p.rate_per_10k, `${cat} ${p.year} rate`).toBeGreaterThan(0);
          }
        }
      }
    });

    it('partial (YTD) years sit after the comparable window', () => {
      const lastFull = YEARS[YEARS.length - 1]!;
      for (const cat of CAT_IDS) {
        for (const p of toronto.series[cat].filter((x) => x.partial)) {
          expect(p.year).toBeGreaterThan(lastFull);
        }
      }
    });

    it('total_series counts equal the sum of the five categories', () => {
      for (const pt of toronto.total_series) {
        const catSum = CAT_IDS.reduce((acc, cat) => {
          const p = toronto.series[cat].find((x) => x.year === pt.year);
          return acc + (p?.count ?? 0);
        }, 0);
        expect(pt.count, `total ${pt.year}`).toBe(catSum);
      }
    });

    it('has a plausible city denominator for every comparable year', () => {
      for (const y of YEARS) {
        const pop = toronto.city_population_by_year[String(y)];
        expect(pop, `population ${y}`).toBeGreaterThan(2_500_000);
        expect(pop, `population ${y}`).toBeLessThan(3_500_000);
      }
    });

    it('rates are consistent with count / population × 10k (±0.5%)', () => {
      for (const cat of CAT_IDS) {
        for (const p of toronto.series[cat].filter((x) => !x.partial)) {
          const pop = toronto.city_population_by_year[String(p.year)]!;
          const expected = (p.count / pop) * 10_000;
          expect(
            Math.abs(p.rate_per_10k! - expected),
            `${cat} ${p.year}`,
          ).toBeLessThan(expected * 0.005 + 0.01);
        }
      }
    });

    it('tracks unresolved-neighbourhood coverage explicitly', () => {
      const coverage = toronto.neighbourhood_resolution;
      expect(coverage.unresolved_incidents).toBeGreaterThan(0);
      expect(coverage.resolved_incidents + coverage.unresolved_incidents).toBe(
        coverage.total_incidents,
      );
      expect(coverage.unresolved_pct).toBeGreaterThan(0);
      expect(coverage.unresolved_pct).toBeLessThan(5);
    });
  });

  describe('by-neighbourhood-year.json', () => {
    it('passes the client-side schema guard', () => {
      expect(() => asByNeighbourhoodYear(byNbhd)).not.toThrow();
    });

    it(`carries exactly ${NBHD_COUNT} neighbourhoods keyed by their own id`, () => {
      const entries = Object.entries(byNbhd.neighbourhoods);
      expect(entries).toHaveLength(NBHD_COUNT);
      for (const [key, n] of entries) {
        expect(n.id).toBe(key);
        expect(n.name.length).toBeGreaterThan(0);
        expect(n.population).toBeGreaterThan(0);
      }
    });

    it('every neighbourhood series spans the comparable window', () => {
      for (const n of Object.values(byNbhd.neighbourhoods)) {
        for (const cat of CAT_IDS) {
          expect(fullYearsOf(n.series[cat]), `${n.id} ${cat}`).toEqual([...YEARS]);
        }
      }
    });

    it('neighbourhood counts plus unresolved rows equal city-wide counts', () => {
      for (const cat of CAT_IDS) {
        for (const pt of toronto.series[cat]) {
          let sum = 0;
          for (const n of Object.values(byNbhd.neighbourhoods)) {
            const p = n.series[cat].find((x) => x.year === pt.year);
            sum += p?.count ?? 0;
          }
          const unresolved =
            toronto.neighbourhood_resolution.by_year[String(pt.year)]!
              .unresolved_by_category[cat];
          expect(sum + unresolved, `${cat} ${pt.year}`).toBe(pt.count);
        }
      }
    });
  });

  describe('choropleth GeoJSON', () => {
    it('ships one feature per neighbourhood with matching ids', () => {
      const geo = JSON.parse(readFileSync(GEO_PATH, 'utf8')) as {
        features: Array<{ properties: { id: string; name?: string } }>;
      };
      expect(geo.features).toHaveLength(NBHD_COUNT);
      const geoIds = new Set(geo.features.map((f) => String(f.properties.id)));
      const aggIds = new Set(Object.keys(byNbhd.neighbourhoods));
      expect(geoIds).toEqual(aggIds);
    });
  });

  describe('ADR-004 size budget', () => {
    it('every aggregate artifact gzips under 200 KB', () => {
      const files = readdirSync(AGG_DIR).filter((f) => f.endsWith('.json'));
      expect(files.length).toBeGreaterThan(0);
      for (const f of files) {
        // Level 9 matches the aggregator's own measurement (Python gzip
        // default) — the level the ADR-004 budget is enforced at.
        const gz = gzipSync(readFileSync(resolve(AGG_DIR, f)), { level: 9 }).length;
        expect(gz, `${f} gzipped`).toBeLessThan(SIZE_BUDGET_BYTES);
      }
    });
  });
});

if (!built) {
  it('skipped: aggregates not built (run npm run aggregates, then re-run)', () => {
    expect(built).toBe(false);
  });
}
