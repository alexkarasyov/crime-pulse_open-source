// Client-safe aggregate schema — the shapes the islands fetch at runtime
// from /data/aggregates/*.json. This module has NO node:fs import (unlike
// src/lib/aggregates.ts, which is build-time/server-only), so islands can
// import it. Previously CompareScreen, TorontoMap, and MapSidebar each
// hand-rolled their own copy of these types and their own partial-point
// filter; this is the single definition.

import { CATEGORIES, YEARS, type CategoryId } from './categories';

/** Must match SCHEMA_VERSION in scripts/build_aggregates.py. */
export const SCHEMA_VERSION = 2;

export interface RawYearPoint {
  year: number;
  count: number;
  /** Null when `partial` is true (no denominator for an incomplete year). */
  rate_per_10k: number | null;
  /** True when the year is YTD; rate is uncomputable, count is partial. */
  partial?: boolean;
}

export interface RawMonthPoint {
  year: number;
  month: number;
  count: number;
}

export interface RawNeighbourhoodYear {
  id: string;
  name: string;
  population: number;
  series: Record<CategoryId, RawYearPoint[]>;
  total_series: RawYearPoint[];
}

export interface RawByNeighbourhoodYear {
  schema_version: number;
  generated_at: string;
  neighbourhoods: Record<string, RawNeighbourhoodYear>;
}

export interface RawTorontoByYear {
  schema_version: number;
  generated_at: string;
  categories: CategoryId[];
  city_population_by_year: Record<string, number>;
  series: Record<CategoryId, RawYearPoint[]>;
  total_series: RawYearPoint[];
  neighbourhood_resolution: NeighbourhoodResolutionSummary;
}

export interface NeighbourhoodResolutionYear {
  total_incidents: number;
  resolved_incidents: number;
  unresolved_incidents: number;
  unresolved_by_category: Record<CategoryId, number>;
}

export interface NeighbourhoodResolutionSummary {
  total_incidents: number;
  resolved_incidents: number;
  unresolved_incidents: number;
  unresolved_pct: number;
  by_year: Record<string, NeighbourhoodResolutionYear>;
}

/** UI-facing point: `rate` is never null (null collapses to 0 for plotting). */
export interface UiYearPoint {
  year: number;
  rate: number;
  count: number;
  partial?: boolean;
}

export function reshapeYearPoint(p: RawYearPoint): UiYearPoint {
  return {
    year: p.year,
    rate: p.rate_per_10k ?? 0,
    count: p.count,
    ...(p.partial ? { partial: true } : {}),
  };
}

/** Drop YTD-flagged partial points unless `includeYTD` is true. */
export function filterPartial<T extends { partial?: boolean }>(
  series: T[],
  includeYTD = false,
): T[] {
  return includeYTD ? series : series.filter((p) => !p.partial);
}

const FIRST_YEAR = YEARS[0]!;
const LAST_YEAR = YEARS[YEARS.length - 1]!;

/**
 * Validate a fetched by-neighbourhood-year payload and narrow its type.
 * Throws on schema drift so a malformed/old aggregate surfaces as a visible
 * island error instead of silently plotting values against the wrong years
 * (the charts map array index → YEARS axis, so a missing interior year would
 * otherwise misalign without any error).
 */
export function asByNeighbourhoodYear(data: unknown): RawByNeighbourhoodYear {
  if (!data || typeof data !== 'object') {
    throw new Error('by-neighbourhood-year: not an object');
  }
  const d = data as RawByNeighbourhoodYear;
  if (d.schema_version !== SCHEMA_VERSION) {
    throw new Error(`by-neighbourhood-year: schema_version ${d.schema_version} != ${SCHEMA_VERSION}`);
  }
  if (!d.neighbourhoods || typeof d.neighbourhoods !== 'object') {
    throw new Error('by-neighbourhood-year: missing neighbourhoods map');
  }
  for (const [id, neighbourhood] of Object.entries(d.neighbourhoods)) {
    if (!neighbourhood || typeof neighbourhood !== 'object') {
      throw new Error(`by-neighbourhood-year.${id}: not an object`);
    }
    if (neighbourhood.id !== id || typeof neighbourhood.name !== 'string') {
      throw new Error(`by-neighbourhood-year.${id}: invalid id or name`);
    }
    if (!Number.isFinite(neighbourhood.population) || neighbourhood.population <= 0) {
      throw new Error(`by-neighbourhood-year.${id}: invalid population`);
    }
    if (!neighbourhood.series || typeof neighbourhood.series !== 'object') {
      throw new Error(`by-neighbourhood-year.${id}: missing series map`);
    }
    for (const { id: cat } of CATEGORIES) {
      assertYearAxis(
        neighbourhood.series[cat],
        `by-neighbourhood-year.${id}.${cat}`,
      );
    }
    assertYearAxis(neighbourhood.total_series, `by-neighbourhood-year.${id}.total_series`);
  }
  return d;
}

/** Validate a fetched toronto-by-year payload and narrow its type. */
export function asTorontoByYear(data: unknown): RawTorontoByYear {
  if (!data || typeof data !== 'object') {
    throw new Error('toronto-by-year: not an object');
  }
  const d = data as RawTorontoByYear;
  if (d.schema_version !== SCHEMA_VERSION) {
    throw new Error(`toronto-by-year: schema_version ${d.schema_version} != ${SCHEMA_VERSION}`);
  }
  if (!d.series || typeof d.series !== 'object') {
    throw new Error('toronto-by-year: missing series');
  }
  const categories = new Set(d.categories);
  if (
    categories.size !== CATEGORIES.length ||
    CATEGORIES.some(({ id }) => !categories.has(id))
  ) {
    throw new Error('toronto-by-year: categories do not match the canonical set');
  }
  for (const { id: cat } of CATEGORIES) {
    assertYearAxis(d.series[cat], `toronto-by-year.${cat}`);
  }
  assertYearAxis(d.total_series, 'toronto-by-year.total_series');
  assertResolution(d.neighbourhood_resolution);
  return d;
}

/** Require the complete comparable axis in order, followed only by strictly
 * increasing partial years. Validate the point fields the charts consume. */
function assertYearAxis(series: RawYearPoint[] | undefined, label: string): void {
  if (!Array.isArray(series) || series.length === 0) {
    throw new Error(`${label}: empty or missing series`);
  }
  const full = series.filter((p) => !p.partial);
  const fullYears = full.map((p) => p.year);
  if (
    fullYears.length !== YEARS.length ||
    fullYears.some((year, index) => year !== YEARS[index])
  ) {
    throw new Error(
      `${label}: full-year axis ${fullYears.join(',')} != ${FIRST_YEAR}–${LAST_YEAR}`,
    );
  }
  let priorYear = LAST_YEAR;
  for (const [index, point] of series.entries()) {
    if (!point || !Number.isInteger(point.year)) {
      throw new Error(`${label}[${index}]: invalid year`);
    }
    if (!Number.isInteger(point.count) || point.count < 0) {
      throw new Error(`${label}[${index}]: invalid count`);
    }
    if (point.partial) {
      if (index < YEARS.length || point.year <= priorYear || point.rate_per_10k !== null) {
        throw new Error(`${label}[${index}]: invalid partial point`);
      }
      priorYear = point.year;
    } else if (typeof point.rate_per_10k !== 'number' || !Number.isFinite(point.rate_per_10k)) {
      throw new Error(`${label}[${index}]: invalid full-year rate`);
    }
  }
}

function assertResolution(value: NeighbourhoodResolutionSummary | undefined): void {
  if (!value || typeof value !== 'object' || !value.by_year) {
    throw new Error('toronto-by-year: missing neighbourhood-resolution metadata');
  }
  for (const key of ['total_incidents', 'resolved_incidents', 'unresolved_incidents'] as const) {
    if (!Number.isInteger(value[key]) || value[key] < 0) {
      throw new Error(`toronto-by-year.neighbourhood_resolution: invalid ${key}`);
    }
  }
  if (value.resolved_incidents + value.unresolved_incidents !== value.total_incidents) {
    throw new Error('toronto-by-year.neighbourhood_resolution: totals do not reconcile');
  }
  if (typeof value.unresolved_pct !== 'number' || !Number.isFinite(value.unresolved_pct)) {
    throw new Error('toronto-by-year.neighbourhood_resolution: invalid percentage');
  }
  for (const year of YEARS) {
    const row = value.by_year[String(year)];
    if (!row || row.resolved_incidents + row.unresolved_incidents !== row.total_incidents) {
      throw new Error(`toronto-by-year.neighbourhood_resolution.${year}: invalid totals`);
    }
    for (const { id: cat } of CATEGORIES) {
      if (!Number.isInteger(row.unresolved_by_category?.[cat]) || row.unresolved_by_category[cat] < 0) {
        throw new Error(
          `toronto-by-year.neighbourhood_resolution.${year}.${cat}: invalid count`,
        );
      }
    }
  }
}
