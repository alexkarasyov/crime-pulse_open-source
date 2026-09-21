// Build-time loader for the aggregates emitted by scripts/build_aggregates.py.
// Astro frontmatter runs in Node, so we read the JSON directly off disk
// instead of through fetch() — the aggregates ship to the browser as
// /data/aggregates/*.json too, but the *.astro pages render against the
// disk copy so we avoid an HTTP round trip during build.
//
// Schema reference:
//   public/data/aggregates/toronto-by-year.json
//   public/data/aggregates/by-neighbourhood-year.json
//   public/data/aggregates/by-neighbourhood-month.json
//   public/data/aggregates/neighbourhood-incidents/{id}.json
//
// All rates are `rate_per_10k`; counts are `count`. We expose them via
// `{ year, rate, count }` for parity with the styleguide-era `YearPoint`,
// so port-over screens don't have to re-key everywhere.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CATEGORIES, YEARS, type CategoryId } from './categories';
import type { NeighbourhoodResolutionSummary } from './aggregateTypes';

// Resolve aggregate paths from process.cwd() — Astro keeps cwd at the project
// root in both `astro dev` and `astro build`. We can't use `import.meta.url`
// here because the build copies this module into `dist/.prerender/chunks/`,
// at which point any `__dirname`-style resolution lands inside `dist/`.
const PROJECT_ROOT = process.cwd();
const AGG_DIR = resolve(PROJECT_ROOT, 'public', 'data', 'aggregates');
const INCIDENTS_DIR = resolve(AGG_DIR, 'neighbourhood-incidents');

// ─────────────────────────────────────────────────────────────────────────────
// Raw schema as emitted

interface RawYearPoint {
  year: number;
  count: number;
  /** Null when `partial` is true (no denominator for an incomplete year). */
  rate_per_10k: number | null;
  /** True when the year is YTD; rate is uncomputable, count is partial. */
  partial?: boolean;
}

interface RawMonthPoint {
  year: number;
  month: number;
  count: number;
}

interface RawTorontoByYear {
  schema_version: number;
  generated_at: string;
  /** When the TPS corpus was imported (from the importer's validation report). */
  data_imported_at?: string | null;
  /** Max report_date across the corpus — the honest "data through" date. */
  data_through?: string | null;
  /** Per partial (YTD) year: the max report_date the YTD file covers. */
  partial_year_through?: Record<string, string>;
  categories: CategoryId[];
  city_population_by_year: Record<string, number>;
  series: Record<CategoryId, RawYearPoint[]>;
  /** Category-summed total per year, with the rate computed directly from the
   *  city denominator (not by summing rounded per-category rates). */
  total_series: RawYearPoint[];
  neighbourhood_resolution: NeighbourhoodResolutionSummary;
}

interface RawNeighbourhoodYear {
  id: string;
  name: string;
  population: number;
  series: Record<CategoryId, RawYearPoint[]>;
  total_series: RawYearPoint[];
}

interface RawByNeighbourhoodYear {
  schema_version: number;
  generated_at: string;
  neighbourhoods: Record<string, RawNeighbourhoodYear>;
}

interface RawNeighbourhoodMonth {
  id: string;
  name: string;
  series: Record<CategoryId, RawMonthPoint[]>;
}

interface RawByNeighbourhoodMonth {
  schema_version: number;
  generated_at: string;
  neighbourhoods: Record<string, RawNeighbourhoodMonth>;
}

export interface RawIncident {
  date: string;
  category: CategoryId;
  offence: string;
  premises_type: string;
}

interface RawIncidentsFile {
  id: string;
  name: string;
  incidents: RawIncident[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Public types — what the rest of the app actually consumes

export type YearPoint = { year: number; rate: number; count: number; partial?: boolean };

/**
 * Drop YTD-flagged partial points unless `includeYTD` is true. Most charts
 * read 2016–2025 by default; only the bigstat + the YTD-aware islands opt
 * into seeing 2026.
 */
export function filterPartial<T extends { partial?: boolean }>(
  series: T[],
  includeYTD: boolean,
): T[] {
  return includeYTD ? series : series.filter((p) => !p.partial);
}

export interface NeighbourhoodSummary {
  id: string;
  name: string;
  population: number;
  series: Record<CategoryId, YearPoint[]>;
  total_series: YearPoint[];
}

export interface CalendarCell {
  month: number;
  year: number;
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Loaders — cached per module evaluation; Astro re-imports per build pass.

let _torontoByYear: RawTorontoByYear | null = null;
let _byNbhdYear: RawByNeighbourhoodYear | null = null;
let _byNbhdMonth: RawByNeighbourhoodMonth | null = null;

function loadJSON<T>(absPath: string): T {
  return JSON.parse(readFileSync(absPath, 'utf8')) as T;
}

function torontoByYear(): RawTorontoByYear {
  if (_torontoByYear) return _torontoByYear;
  _torontoByYear = loadJSON<RawTorontoByYear>(
    resolve(AGG_DIR, 'toronto-by-year.json'),
  );
  return _torontoByYear;
}

function byNbhdYear(): RawByNeighbourhoodYear {
  if (_byNbhdYear) return _byNbhdYear;
  _byNbhdYear = loadJSON<RawByNeighbourhoodYear>(
    resolve(AGG_DIR, 'by-neighbourhood-year.json'),
  );
  return _byNbhdYear;
}

function byNbhdMonth(): RawByNeighbourhoodMonth {
  if (_byNbhdMonth) return _byNbhdMonth;
  _byNbhdMonth = loadJSON<RawByNeighbourhoodMonth>(
    resolve(AGG_DIR, 'by-neighbourhood-month.json'),
  );
  return _byNbhdMonth;
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-shapers — RawYearPoint → YearPoint

function reshapeYearPoint(p: RawYearPoint): YearPoint {
  return {
    year: p.year,
    rate: p.rate_per_10k ?? 0,
    count: p.count,
    ...(p.partial ? { partial: true } : {}),
  };
}

function reshapeSeries(raw: Record<CategoryId, RawYearPoint[]>): Record<CategoryId, YearPoint[]> {
  const out = {} as Record<CategoryId, YearPoint[]>;
  for (const c of CATEGORIES) {
    out[c.id] = (raw[c.id] ?? []).map(reshapeYearPoint);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API

/** Toronto-wide series for each of the five categories. Excludes partial
 * (YTD) points by default; pass `{ includePartial: true }` to include them. */
export function torontoSeries(
  opts: { includePartial?: boolean } = {},
): Record<CategoryId, YearPoint[]> {
  const reshaped = reshapeSeries(torontoByYear().series);
  if (opts.includePartial) return reshaped;
  const out = {} as Record<CategoryId, YearPoint[]>;
  for (const c of CATEGORIES) out[c.id] = filterPartial(reshaped[c.id], false);
  return out;
}

/** Pre-rolled Toronto-wide total (sum of all five categories) per year.
 * Uses the aggregator's emitted `total_series`, whose rate is computed from
 * the city denominator directly — more accurate than summing the five
 * per-category rates, each already rounded to 2 decimals. Excludes partial
 * (YTD) points; those have no rate at the rollup level. */
export function torontoTotalSeries(): YearPoint[] {
  const raw = torontoByYear().total_series ?? [];
  return filterPartial(raw, false).map(reshapeYearPoint);
}

/** Toronto-wide partial-year points (e.g. 2026 YTD), one per category.
 * Used by the YTD-aware bigstat on the Overview. */
export function torontoPartialSeries(): Record<CategoryId, YearPoint[]> {
  const reshaped = reshapeSeries(torontoByYear().series);
  const out = {} as Record<CategoryId, YearPoint[]>;
  for (const c of CATEGORIES) out[c.id] = reshaped[c.id].filter((p) => p.partial);
  return out;
}

/** The partial-year axis (e.g. [2026]). Empty if the aggregator hasn't
 * emitted any partial years. */
export function partialYears(): number[] {
  return (torontoByYear() as RawTorontoByYear & { partial_years?: number[] }).partial_years ?? [];
}

/** Toronto city-wide population per year (from the aggregate). */
export function cityPopulationByYear(): Record<number, number> {
  const raw = torontoByYear().city_population_by_year;
  const out: Record<number, number> = {};
  for (const [k, v] of Object.entries(raw)) out[Number(k)] = v;
  return out;
}

/** Generated-at timestamp from the toronto-by-year aggregate. NOTE: this is
 * when the aggregates were last rebuilt, which advances on any local rerun —
 * for user-facing freshness use dataThrough()/dataImportedAt() instead. */
export function generatedAt(): string {
  return torontoByYear().generated_at;
}

/** Latest report date the corpus covers (yyyy-mm-dd) — the honest
 * "data through" date for freshness displays. Falls back to generated_at's
 * date if the importer metadata is missing. */
export function dataThrough(): string {
  return torontoByYear().data_through ?? generatedAt().slice(0, 10);
}

/** When the TPS corpus was last imported (yyyy-mm-dd). Falls back to
 * generated_at's date if the importer metadata is missing. */
export function dataImportedAt(): string {
  const raw = torontoByYear().data_imported_at;
  return raw ? raw.slice(0, 10) : generatedAt().slice(0, 10);
}

/** Per partial (YTD) year, the max report date that year's data covers —
 * e.g. { "2026": "2026-03-31" }. Empty if no partial year is loaded. */
export function partialYearThrough(): Record<string, string> {
  return torontoByYear().partial_year_through ?? {};
}

/** Coverage split between records that can and cannot be assigned to one of
 * the 158 neighbourhoods. Both contribute to Toronto-wide totals; only the
 * resolved subset can appear in neighbourhood views. */
export function neighbourhoodResolution(): NeighbourhoodResolutionSummary {
  return torontoByYear().neighbourhood_resolution;
}

function stripPartialFromNbhd(n: NeighbourhoodSummary): NeighbourhoodSummary {
  const series = {} as Record<CategoryId, YearPoint[]>;
  for (const c of CATEGORIES) series[c.id] = filterPartial(n.series[c.id], false);
  return {
    ...n,
    series,
    total_series: filterPartial(n.total_series, false),
  };
}

/** All 158 neighbourhood summaries in the order the aggregate exposes them.
 * Excludes partial (YTD) points by default. */
export function allNeighbourhoods(): NeighbourhoodSummary[] {
  const raw = byNbhdYear().neighbourhoods;
  return Object.values(raw).map((n) => stripPartialFromNbhd({
    id: n.id,
    name: n.name,
    population: n.population,
    series: reshapeSeries(n.series),
    total_series: n.total_series.map(reshapeYearPoint),
  }));
}

/** Look up one neighbourhood summary by id. Returns null when missing.
 * Excludes partial (YTD) points by default. */
export function neighbourhoodById(id: string): NeighbourhoodSummary | null {
  const raw = byNbhdYear().neighbourhoods[id];
  if (!raw) return null;
  return stripPartialFromNbhd({
    id: raw.id,
    name: raw.name,
    population: raw.population,
    series: reshapeSeries(raw.series),
    total_series: raw.total_series.map(reshapeYearPoint),
  });
}

/** Sorted-by-id list — used for static path generation. */
export function neighbourhoodIds(): string[] {
  return Object.keys(byNbhdYear().neighbourhoods).sort(
    (a, b) => parseInt(a, 10) - parseInt(b, 10),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Geographic adjacency — centroids from the shipped boundary GeoJSON.

let _centroids: Map<string, [number, number]> | null = null;

/** Mean of every coordinate vertex per neighbourhood — a cheap centroid good
 *  enough to rank by proximity. Computed once from the slim 158-area GeoJSON. */
function centroids(): Map<string, [number, number]> {
  if (_centroids) return _centroids;
  const m = new Map<string, [number, number]>();
  try {
    const geo = loadJSON<{
      features: Array<{ properties: { id: string }; geometry: { coordinates: unknown } }>;
    }>(resolve(PROJECT_ROOT, 'public', 'data', 'geo', 'toronto-neighbourhoods-158.geojson'));
    for (const f of geo.features) {
      let sx = 0;
      let sy = 0;
      let n = 0;
      const walk = (node: unknown): void => {
        if (!Array.isArray(node)) return;
        if (typeof node[0] === 'number' && typeof node[1] === 'number') {
          sx += node[0];
          sy += node[1];
          n += 1;
        } else {
          for (const child of node) walk(child);
        }
      };
      walk(f.geometry?.coordinates);
      if (n > 0) m.set(f.properties.id, [sx / n, sy / n]);
    }
  } catch {
    // GeoJSON not built yet — callers degrade to an empty adjacency list.
  }
  _centroids = m;
  return m;
}

/**
 * The `count` geographically-nearest neighbourhood ids to `id`, by centroid
 * distance. Replaces the old "nearest by numeric ID" heuristic — Toronto's
 * neighbourhood numbers are administrative, not spatial, so numeric adjacency
 * was not geographic adjacency. Returns [] if centroids are unavailable.
 */
export function nearestNeighbourIds(id: string, count: number): string[] {
  const c = centroids();
  const self = c.get(id);
  if (!self) return [];
  const scored: Array<{ id: string; d: number }> = [];
  for (const [k, p] of c) {
    if (k === id) continue;
    const dx = p[0] - self[0];
    const dy = p[1] - self[1];
    scored.push({ id: k, d: dx * dx + dy * dy });
  }
  scored.sort((a, b) => a.d - b.d);
  return scored.slice(0, count).map((s) => s.id);
}

/**
 * Returns a 12-month × 10-year grid of incident counts for one neighbourhood
 * and one category. Falls back to a zero-fill cell when a month is missing.
 */
export function calendarGrid(nbhdId: string, catId: CategoryId): CalendarCell[][] {
  const raw = byNbhdMonth().neighbourhoods[nbhdId];
  // Build a (month, year) → count map for O(1) lookup.
  const lookup = new Map<string, number>();
  if (raw) {
    for (const pt of raw.series[catId] ?? []) {
      lookup.set(`${pt.year}-${pt.month}`, pt.count);
    }
  }
  const grid: CalendarCell[][] = [];
  for (let m = 1; m <= 12; m++) {
    const row: CalendarCell[] = [];
    for (const y of YEARS) {
      row.push({ month: m, year: y, count: lookup.get(`${y}-${m}`) ?? 0 });
    }
    grid.push(row);
  }
  return grid;
}

/** Read the per-neighbourhood incident feed off disk at build time. */
export function neighbourhoodIncidents(nbhdId: string): RawIncident[] {
  try {
    const file = loadJSON<RawIncidentsFile>(
      resolve(INCIDENTS_DIR, `${nbhdId}.json`),
    );
    return file.incidents;
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CSI context — StatCan 35-10-0026-01. Optional; returns null if the
// aggregate hasn't been emitted yet (i.e. data/csi/ is empty).

export interface CSIPoint {
  year: number;
  csi_total: number | null;
  csi_violent: number | null;
  csi_non_violent: number | null;
}
export interface CSIGeo {
  label: string;
  accent?: boolean;
  series: CSIPoint[];
}
export interface CSIContext {
  schema_version: number;
  generated_at: string;
  years: number[];
  geographies: CSIGeo[];
  source: { name: string; license: string; attribution: string };
}

export function csiContext(): CSIContext | null {
  try {
    return loadJSON<CSIContext>(resolve(AGG_DIR, 'csi-context.json'));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CMA context — StatCan 35-10-0177-01. Optional; returns null if the
// aggregate hasn't been emitted yet.

export interface CmaPoint {
  year: number;
  rate_per_100k: number | null;
}
export interface CmaGeo {
  label: string;
  accent?: boolean;
  series: CmaPoint[];
}
export interface CmaContext {
  schema_version: number;
  generated_at: string;
  years: number[];
  geographies: CmaGeo[];
  metric: { violation: string; unit: string };
  source: { name: string; license: string; attribution: string };
}

export function cmaContext(): CmaContext | null {
  try {
    return loadJSON<CmaContext>(resolve(AGG_DIR, 'cma-context.json'));
  } catch {
    return null;
  }
}
