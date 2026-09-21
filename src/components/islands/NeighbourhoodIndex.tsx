// /neighbourhood/ index — sortable, searchable, category- and unit-aware list
// of all 158 Toronto neighbourhoods. Each row carries a YoY arrow comparing
// the latest year against the previous one.

import { useMemo, useState } from 'preact/hooks';
import { CATEGORIES, CAT_BY_ID, type CategoryId } from '../../lib/categories';
import { primaryCat, setCategoryScope, activeCats, unit, yearRange, YEAR_MIN } from '../../lib/state';
import {
  fmtUnit,
  guardedChange,
  SMALL_BASE_NOTE,
  unitSuffix,
  trendColor,
  yoyTrend,
} from '../../lib/format';
import CatGlyph from '../preact/CatGlyph';
import Sparkline from '../preact/Sparkline';

interface SeriesPair {
  counts: number[];
  rates: number[];
}
export interface SlimRow {
  id: string;
  name: string;
  population: number;
  series: Record<CategoryId, SeriesPair>;
}

type SortKey = 'name' | 'population' | 'value' | 'yoy';
type SortDir = 'asc' | 'desc';

interface Props {
  rows: SlimRow[];
}

export default function NeighbourhoodIndex({ rows }: Props) {
  const cat = primaryCat.value;
  const cats = activeCats.value;
  const u = unit.value;
  const [rangeStart, rangeEnd] = yearRange.value;
  const multi = cats.length > 1;
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const enriched = useMemo(() => {
    // When multiple cats are selected, the current value, prev value, and
    // sparkline series are summed across active cats. When only one is
    // active (and the primary cat is in it) we fall back to that single
    // cat's series so colours/labels match the rest of the page.
    const single = !multi && cats.length === 1 ? cats[0]! : cat;
    // Map the year-range to array indices.
    const startIdx = rangeStart - YEAR_MIN;
    const endIdx = rangeEnd - YEAR_MIN;
    return rows.map((r) => {
      let fullArr: number[];
      let fullCounts: number[];
      if (multi) {
        const yearCount = r.series[cat].counts.length;
        fullArr = new Array(yearCount).fill(0);
        fullCounts = new Array(yearCount).fill(0);
        for (const c of cats) {
          const pts = u === 'rate' ? r.series[c].rates : r.series[c].counts;
          for (let i = 0; i < pts.length && i < fullArr.length; i++) {
            fullArr[i]! += pts[i]!;
            fullCounts[i]! += r.series[c].counts[i] ?? 0;
          }
        }
      } else {
        fullArr = u === 'rate' ? r.series[single].rates : r.series[single].counts;
        fullCounts = r.series[single].counts;
      }
      // Slice to the user-selected range. Current = end of range; prev =
      // year before end. Sparkline shows the in-range slice.
      const arr = fullArr.slice(Math.max(0, startIdx), endIdx + 1);
      const curr = fullArr[endIdx] ?? 0;
      const prev = fullArr[endIdx - 1] ?? 0;
      const currCount = fullCounts[endIdx] ?? 0;
      const prevCount = fullCounts[endIdx - 1] ?? 0;
      const guarded = guardedChange(prevCount, currCount);
      // Preserve the index's established <1% flat band for sufficiently large
      // bases; small bases always use the raw-count direction.
      const change = guarded.kind === 'pct'
        ? { ...guarded, trend: yoyTrend(prevCount, currCount) }
        : guarded;
      const sortDelta = prevCount === 0
        ? currCount === 0 ? 0 : Number.POSITIVE_INFINITY
        : ((currCount - prevCount) / prevCount) * 100;
      return { ...r, curr, prev, change, sortDelta, arr };
    });
  }, [rows, cat, cats, u, multi, rangeStart, rangeEnd]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return enriched;
    return enriched.filter((r) => r.name.toLowerCase().includes(q));
  }, [enriched, query]);

  const sorted = useMemo(() => {
    const sign = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name':       return sign * a.name.localeCompare(b.name, 'en');
        case 'population': return sign * (a.population - b.population);
        case 'value':      return sign * (a.curr - b.curr);
        // `|| 0` guards Infinity - Infinity = NaN (two prev=0 rows), which
        // would make the comparator non-total and the order unstable.
        case 'yoy':        return sign * ((a.sortDelta - b.sortDelta) || 0);
      }
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey, defaultDir: SortDir = 'asc'): void {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(defaultDir);
    }
  }

  const catMeta = CAT_BY_ID[cat];
  // Column label + colour change based on multi-cat selection.
  const valueColor = multi ? 'var(--accent)' : catMeta.color;
  const valueLabel = multi
    ? `${rangeEnd} sum across ${cats.length} categories ${unitSuffix(u) || '(count)'}`
    : `${rangeEnd} ${catMeta.name} ${unitSuffix(u) || '(count)'}`;

  return (
    <>
      {/* Category chips + search */}
      <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; align-items: center;">
        <span class="label-sm">Show</span>
        <button
          type="button"
          class={`filter-chip ${cats.length === CATEGORIES.length ? 'on' : ''}`}
          aria-pressed={cats.length === CATEGORIES.length}
          aria-label="Show all five categories"
          onClick={() => setCategoryScope(CATEGORIES.map((c) => c.id))}
        >All five categories</button>
        {CATEGORIES.map((c) => (
          <button
            type="button"
            class={`filter-chip ${!multi && cats[0] === c.id ? 'on' : ''}`}
            aria-pressed={!multi && cats[0] === c.id}
            aria-label={`Show only ${c.name}`}
            onClick={() => setCategoryScope([c.id])}
            style={!multi && cats[0] === c.id ? `color: ${c.color}; border-color: ${c.color};` : ''}
          >
            <CatGlyph cat={c} size={8} /> {c.name}
          </button>
        ))}
        <span style="flex: 1;" />
        <input
          type="search"
          placeholder="Search 158 neighbourhoods…"
          value={query}
          onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
          aria-label="Search neighbourhoods by name"
          class="nbhd-index-search"
        />
      </div>

      {/* Result count */}
      <div
        aria-live="polite"
        style="font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); letter-spacing: 0.06em; margin-bottom: 12px;"
      >
        SHOWING {sorted.length} OF {rows.length} · {multi ? `${cats.length} CATEGORIES SUMMED` : catMeta.name.toUpperCase()} · {u === 'rate' ? 'RATE / 10K' : 'COUNT'}
      </div>

      {/* Table */}
      <div class="card" style="padding: 0; overflow: hidden;">
        <table class="cmp-table nbhd-index-table">
          <thead>
            <tr>
              <SortableTh label="Neighbourhood" active={sortKey === 'name'}       dir={sortDir} onClick={() => toggleSort('name', 'asc')} />
              <th>N°</th>
              <SortableTh label="Population" active={sortKey === 'population'} dir={sortDir} onClick={() => toggleSort('population', 'desc')} />
              <SortableTh label={valueLabel} active={sortKey === 'value'} dir={sortDir} onClick={() => toggleSort('value', 'desc')} align="right" />
              <SortableTh label={`vs ${rangeEnd - 1}`} active={sortKey === 'yoy'} dir={sortDir} onClick={() => toggleSort('yoy', 'desc')} align="right" />
              <th style="width: 120px;">{rangeEnd - rangeStart + 1}-yr trace</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const arrowColor = trendColor(r.change.trend.dir);
              const changeLabel = r.change.kind === 'counts'
                ? r.change.diff === 0
                  ? `No change: ${r.change.from} incidents in both years; small base`
                  : `${r.change.trend.dir === 'up' ? 'Increase' : 'Decrease'} by ${Math.abs(r.change.diff)} incidents, from ${r.change.from} to ${r.change.to}; small base`
                : r.change.trend.dir === 'flat'
                  ? 'Year over year change under 1 percent'
                  : `Year over year ${r.change.trend.dir}, ${Math.abs(r.change.trend.delta).toFixed(1)} percent`;
              return (
                <tr class="nbhd-index-row">
                  <td><a class="nbhd-index-link" href={`/neighbourhood/${r.id}/`}>{r.name}</a></td>
                  <td class="v">{r.id}</td>
                  <td class="v">{r.population.toLocaleString()}</td>
                  <td class="v" style={`color: ${valueColor}; text-align: right;`}>
                    {fmtUnit(r.curr, u)}
                  </td>
                  <td
                    class="v"
                    style={`color: ${arrowColor}; text-align: right; font-variant-numeric: tabular-nums;`}
                    aria-label={changeLabel}
                  >
                    {r.change.kind === 'counts' ? (
                      <span style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">
                        <span>
                          {r.change.diff === 0
                            ? '—'
                            : `${r.change.trend.glyph} ${r.change.diff > 0 ? '+' : '−'}${Math.abs(r.change.diff)} · ${r.change.from}→${r.change.to}`}
                        </span>
                        <span class="sm-tag" title={SMALL_BASE_NOTE}>small base</span>
                      </span>
                    ) : r.change.trend.dir === 'flat' ? (
                      '— <1%'
                    ) : (
                      `${r.change.trend.glyph} ${Math.abs(r.change.trend.delta).toFixed(1)}%`
                    )}
                  </td>
                  <td>
                    <div style={`height: 24px; color: ${valueColor};`}>
                      <Sparkline
                        data={r.arr.map((v) => ({ rate: v }))}
                        color={valueColor}
                        height={24}
                        width={120}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} style="padding: 32px; text-align: center; color: var(--ink-3); font-family: var(--font-mono); font-size: 12px;">
                  No neighbourhoods match "{query}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p style="margin-top: 16px; font-family: var(--font-mono); font-size: 11px; color: var(--ink-4); letter-spacing: 0.04em;">
        Open a neighbourhood name to view its detail page. ▲ / ▼ / — compares {rangeEnd} against {rangeEnd - 1}; changes under 1% read as flat, and comparisons with a sub-10 endpoint use counts. Year range: {rangeStart}–{rangeEnd}.
      </p>
    </>
  );
}

interface SortableThProps {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  align?: 'left' | 'right';
}
function SortableTh({ label, active, dir, onClick, align = 'left' }: SortableThProps) {
  const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : '';
  return (
    <th
      style={`text-align: ${align};`}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        class="sort-button"
        onClick={onClick}
        style={`justify-content: ${align === 'right' ? 'flex-end' : 'flex-start'};`}
      >
        {label}{arrow}
      </button>
    </th>
  );
}
