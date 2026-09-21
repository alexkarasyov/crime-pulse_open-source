// The entire Compare screen body — picker strip, shared-axis chart,
// numeric comparison table, per-pick small multiples.
//
// The Compare flow is essentially impossible to render statically: the
// user picks 2–4 of 158 neighbourhoods, so we fetch the year aggregate
// once and re-render everything when the picks (or category, or unit)
// change.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { CATEGORIES, CAT_BY_ID, YEARS } from '../../lib/categories';
import { primaryCat, setPrimaryCat, unit } from '../../lib/state';
import { comparePicks, setComparePicks, compareBaseline, setCompareBaseline } from '../../lib/urlState';
import {
  changeTrend,
  guardedChange,
  SMALL_BASE_NOTE,
  trendColor,
} from '../../lib/format';
import { fetchJson } from '../../lib/fetchJson';
import {
  type RawByNeighbourhoodYear,
  type RawTorontoByYear,
  type RawYearPoint,
  type RawNeighbourhoodYear,
  type UiYearPoint,
  asByNeighbourhoodYear,
  asTorontoByYear,
  filterPartial,
  reshapeYearPoint,
} from '../../lib/aggregateTypes';
import CatGlyph from '../preact/CatGlyph';
import SmallMultiples from '../preact/SmallMultiples';
import CompareTrendChart from '../preact/CompareTrendChart';

// Drop partial (YTD) rows; their rate_per_10k is null and they would
// otherwise read as the "latest year" in the last-year-anchored table.
// Tolerates a missing category key (returns []).
function reshape(s: RawYearPoint[] | undefined): UiYearPoint[] {
  return filterPartial(s ?? []).map(reshapeYearPoint);
}

const LAST_YEAR = YEARS[YEARS.length - 1]!;

const COMPARE_COLORS = [
  'var(--cat-autoTheft)',
  'var(--cat-assault)',
  'var(--cat-robbery)',
  'var(--cat-breakEnter)',
];

const MAX_PICKS = 4;

export default function CompareScreen() {
  const [agg, setAgg] = useState<RawByNeighbourhoodYear | null>(null);
  const [totals, setTotals] = useState<RawTorontoByYear | null>(null);
  const [loadError, setLoadError] = useState(false);
  const pickIds = comparePicks.value;
  const setPickIds = (ids: string[]) => setComparePicks(ids);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<unknown>('/data/aggregates/by-neighbourhood-year.json'),
      fetchJson<unknown>('/data/aggregates/toronto-by-year.json'),
    ])
      .then(([a, t]) => {
        if (cancelled) return;
        setAgg(asByNeighbourhoodYear(a));
        setTotals(asTorontoByYear(t));
      })
      .catch(() => {
        // Without this, a failed fetch left the island stuck on the
        // loading message forever.
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cat = primaryCat.value;
  const u = unit.value;
  const showBaseline = compareBaseline.value[u];
  const primary = CAT_BY_ID[cat];

  // Resolve picks to actual neighbourhoods, dropping ids missing from the
  // aggregate and de-duplicating. This is the single source of truth for the
  // rendered slots; all slot mutations key off `validIds` (below) so the
  // edit indices always line up with what's on screen — never the raw,
  // possibly-stale `pickIds` from the URL.
  const picks = useMemo(() => {
    if (!agg) return [] as RawNeighbourhoodYear[];
    const seen = new Set<string>();
    const out: RawNeighbourhoodYear[] = [];
    for (const id of pickIds) {
      if (seen.has(id)) continue;
      const n = agg.neighbourhoods[id];
      if (n) {
        seen.add(id);
        out.push(n);
      }
    }
    return out;
  }, [agg, pickIds]);

  // All 158 neighbourhood {id, name}s for the native <select> dropdowns —
  // browsers handle typeahead-by-keystroke on these for free.
  // NOTE: declared before the early return so hook order is stable across
  // the loading→loaded transition (Rules of Hooks).
  const allOptions = useMemo(() => {
    if (!agg) return [] as { id: string; name: string }[];
    return Object.values(agg.neighbourhoods)
      .map((n) => ({ id: n.id, name: n.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }, [agg]);

  if (loadError) {
    return (
      <div style="padding: 32px var(--gutter); color: var(--ink-3); font-family: var(--font-mono); font-size: 12px;">
        Comparison data failed to load. Reload the page to retry.
      </div>
    );
  }

  if (!agg || !totals) {
    return (
      <div style="padding: 32px var(--gutter); color: var(--ink-3); font-family: var(--font-mono); font-size: 12px;">
        Loading comparison data…
      </div>
    );
  }

  // Canonical, sanitized id list — mirrors the rendered slots 1:1.
  const validIds = picks.map((n) => n.id);

  function setSlot(slot: number, newId: string): void {
    if (validIds[slot] === newId) return;
    const next = validIds.slice();
    // If the chosen neighbourhood already occupies another slot, swap the two
    // so we never end up with duplicate picks.
    const existing = validIds.indexOf(newId);
    if (existing !== -1) next[existing] = validIds[slot]!;
    next[slot] = newId;
    setPickIds(next);
  }

  function addSlot(): void {
    if (validIds.length >= MAX_PICKS) return;
    // Pick the first available id that isn't already in the picks.
    const candidate = allOptions.find((o) => !validIds.includes(o.id));
    if (candidate) setPickIds([...validIds, candidate.id]);
  }

  function removeSlot(slot: number): void {
    if (validIds.length <= 2) return; // never below 2
    setPickIds(validIds.filter((_, j) => j !== slot));
  }

  const torontoBase = reshape(totals.series[cat] ?? []);

  return (
    <>
      {/* PICKER STRIP */}
      <section style="padding: 0 0 24px;">
        <div class="main">
          <div class="eyebrow" style="margin-bottom: 12px;">§ 01 · Selection</div>
          <div class="compare-pickers">
            {picks.map((n, i) => {
              const s = reshape(n.series[cat]);
              const last = s[s.length - 1];
              const canRemove = picks.length > 2;
              return (
                <div
                  class="compare-picker"
                  style={`border-left: 2px solid ${COMPARE_COLORS[i]};`}
                >
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                    <span class="chip-color" style={`background: ${COMPARE_COLORS[i]};`} />
                    <span class="pid">SLOT {i + 1} · N° {n.id}</span>
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() => removeSlot(i)}
                        title="Remove this slot"
                        style="margin-left: auto; font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); cursor: pointer; background: none; border: 0; padding: 0 4px;"
                        aria-label={`Remove slot ${i + 1}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <div class="pname">{n.name}</div>
                  <div class="pmeta">
                    Pop {n.population.toLocaleString()} · {primary.name}{' '}
                    {last
                      ? u === 'rate'
                        ? `${last.rate.toFixed(0)} / 10K`
                        : `${last.count.toLocaleString()} count`
                      : '—'}
                  </div>
                  <label class="compare-picker-select">
                    <span class="compare-picker-select-label">CHANGE</span>
                    <select
                      value={n.id}
                      onChange={(e) => setSlot(i, (e.currentTarget as HTMLSelectElement).value)}
                      aria-label={`Pick neighbourhood for slot ${i + 1}`}
                    >
                      {allOptions.map((o) => (
                        <option value={o.id}>
                          {o.name} (N° {o.id})
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              );
            })}
            {picks.length < MAX_PICKS && (
              <button type="button" class="compare-picker add" onClick={addSlot}>
                + Add a neighbourhood
              </button>
            )}
          </div>
          <div style="display: flex; gap: 8px; margin-top: 16px; flex-wrap: wrap;">
            <span class="label-sm" style="align-self: center;">Category</span>
            {CATEGORIES.map((c) => (
              <button
                type="button"
                class={`filter-chip ${cat === c.id ? 'on' : ''}`}
                aria-pressed={cat === c.id}
                onClick={() => setPrimaryCat(c.id)}
                style={cat === c.id ? `color: ${c.color}; border-color: ${c.color};` : ''}
              >
                <CatGlyph cat={c} size={8} /> {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SHARED-AXIS CHART */}
      <section class="section">
        <div class="main">
          <div class="section-head">
            <div>
              <div class="eyebrow section-eye">
                § 02 · Shared y-axis · {u === 'rate' ? 'Rate / 10K' : 'Counts'}
              </div>
              <h2 class="section-title">
                {primary.name}, {YEARS[0]}–{YEARS[YEARS.length - 1]}
              </h2>
            </div>
          </div>
          <div class="card">
            <label class="compare-baseline-control">
              <input
                type="checkbox"
                checked={showBaseline}
                onChange={(event) => setCompareBaseline(event.currentTarget.checked)}
              />
              Show Toronto-wide baseline
            </label>
            <p class="chart-data-note">
              {u === 'count'
                ? 'The Toronto total is much larger than a neighbourhood count. Showing it expands the shared scale; rates compare incidents per resident.'
                : 'Rates compare incidents per 10,000 residents. The Toronto line provides a city-wide reference.'}
            </p>
            <CompareTrendChart
              picks={picks.map((n, i) => ({ id: n.id, name: n.name, color: COMPARE_COLORS[i]!, points: reshape(n.series[cat]) }))}
              baseline={showBaseline ? torontoBase : undefined}
              category={primary.name}
              unit={u}
            />
          </div>
        </div>
      </section>

      {/* TABLE */}
      <section class="section">
        <div class="main">
          <div class="section-head">
            <div>
              <div class="eyebrow section-eye">§ 03 · Numeric comparison · {LAST_YEAR}</div>
              <h2 class="section-title">Same numbers, different lenses</h2>
            </div>
          </div>
          <div class="card" style="padding: 0; overflow: hidden;">
            <table
              class="cmp-table"
              tabIndex={0}
              aria-label={`Neighbourhood comparison for ${LAST_YEAR}, ${u === 'rate' ? 'rates per 10,000 residents' : 'incident counts'}`}
            >
              <thead>
                <tr>
                  <th>Neighbourhood</th>
                  <th>N°</th>
                  <th>Population</th>
                  {CATEGORIES.map((c) => (
                    <th style={`color: ${c.color};`}>
                      <span style="display: inline-flex; align-items: center; gap: 6px;">
                        <CatGlyph cat={c} size={8} /> {c.shortCode}
                      </span>
                    </th>
                  ))}
                  <th>Δ '{String(YEARS[0]).slice(2)}→'{String(LAST_YEAR).slice(2)}</th>
                  <th title="Current-year per-capita delta vs the Toronto-wide rate for the selected category. Always rate-based, since a single neighbourhood's absolute count is far below the city total.">vs Toronto (rate)</th>
                </tr>
              </thead>
              <tbody>
                {picks.map((n, i) => {
                  const series = reshape(n.series[cat]);
                  const first = series[0];
                  const last = series[series.length - 1];
                  const delta = guardedChange(first?.count ?? 0, last?.count ?? 0);
                  const deltaColor = trendColor(delta.trend.dir);
                  // vsToronto is always per-capita (rate). Comparing a single
                  // nbhd's count to the city's total count is structurally
                  // meaningless (always ~ -99%); only rate gives a usable lens.
                  const lastRate = last?.rate ?? 0;
                  const torontoLastRate = torontoBase[torontoBase.length - 1]?.rate ?? 0;
                  const vsToronto = changeTrend(torontoLastRate, lastRate);
                  const vsTorontoColor = trendColor(vsToronto.dir);
                  return (
                    <tr class="nbhd-row">
                      <td style={`color: ${COMPARE_COLORS[i]}; font-weight: 600;`}>{n.name}</td>
                      <td class="v">{n.id}</td>
                      <td class="v">{n.population.toLocaleString()}</td>
                      {CATEGORIES.map((c) => {
                        const s = reshape(n.series[c.id]);
                        const l = s[s.length - 1]?.[u] ?? 0;
                        return (
                          <td
                            class="v"
                            style={`color: ${c.id === cat ? 'var(--ink)' : 'var(--ink-2)'};`}
                          >
                            {u === 'rate' ? l.toFixed(0) : Math.round(l).toLocaleString()}
                          </td>
                        );
                      })}
                      <td class="v" style={`color: ${deltaColor};`}>
                        {delta.kind === 'counts' ? (
                          <span style="display: inline-flex; align-items: center; gap: 6px;">
                            <span>
                              {delta.diff === 0
                                ? '—'
                                : `${delta.trend.glyph} ${delta.diff > 0 ? '+' : '−'}${Math.abs(delta.diff)} · ${delta.from}→${delta.to}`}
                            </span>
                            <span class="sm-tag" title={SMALL_BASE_NOTE}>small base</span>
                          </span>
                        ) : delta.trend.dir === 'flat' ? (
                          '—'
                        ) : (
                          `${delta.trend.glyph} ${Math.abs(delta.trend.delta).toFixed(0)}%`
                        )}
                      </td>
                      <td class="v" style={`color: ${vsTorontoColor};`}>
                        {vsToronto.dir === 'flat' ? '—' : `${vsToronto.delta > 0 ? '+' : ''}${vsToronto.delta.toFixed(0)}%`}
                      </td>
                    </tr>
                  );
                })}
                <tr style="background: var(--surface-2);">
                  <td style="color: var(--ink-2);">Toronto baseline</td>
                  <td class="v" style="color: var(--ink-3);">—</td>
                  <td class="v">
                    {(totals.city_population_by_year[String(LAST_YEAR)] ?? 0).toLocaleString()}
                  </td>
                  {CATEGORIES.map((c) => {
                    const s = reshape(totals.series[c.id]);
                    const l = s[s.length - 1]?.[u] ?? 0;
                    return <td class="v">{u === 'rate' ? l.toFixed(0) : Math.round(l).toLocaleString()}</td>;
                  })}
                  <td class="v">—</td>
                  <td class="v">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SMALL MULTIPLES */}
      <section class="section">
        <div class="main">
          <div class="section-head">
            <div>
              <div class="eyebrow section-eye">§ 04 · Per-neighbourhood breakdown</div>
              <h2 class="section-title">All five categories, by pick</h2>
            </div>
          </div>
          <div
            class="compare-multiples"
            style={`--compare-cols: ${Math.max(picks.length, 1)};`}
          >
            {picks.map((n, i) => {
              const seriesByCat: Record<string, UiYearPoint[]> = {};
              for (const c of CATEGORIES) {
                seriesByCat[c.id] = reshape(n.series[c.id]);
              }
              return (
                <div class="card" style={`border-left: 2px solid ${COMPARE_COLORS[i]};`}>
                  <div class="card-head">
                    <h3 class="card-title" style={`color: ${COMPARE_COLORS[i]};`}>{n.name}</h3>
                    <span class="card-sub">N° {n.id}</span>
                  </div>
                  <SmallMultiples seriesByCat={seriesByCat} unit={u} geography={n.name} />
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
