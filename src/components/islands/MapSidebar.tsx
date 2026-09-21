// Right-rail of the Overview map: legend + hover panel + top-4 list.
// Each section reacts to primaryCat / unit. We fetch the aggregate once
// inside the panel; the parent island already has its own copy for the
// map itself, but we keep that boundary simple.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { CAT_BY_ID } from '../../lib/categories';
import { primaryCat, unit, yearRange } from '../../lib/state';
import { catValueAt } from '../../lib/format';
import { fetchJson } from '../../lib/fetchJson';
import { type RawByNeighbourhoodYear, asByNeighbourhoodYear } from '../../lib/aggregateTypes';
import TorontoMapPanel from './TorontoMapPanel';

interface NbhdRow {
  id: string;
  name: string;
  rate: number;
  count: number;
}

export default function MapSidebar() {
  const cat = primaryCat.value;
  const u = unit.value;
  // Display year = end of the user-selected range. This is always a full
  // (non-partial) year — the range is clamped to YEAR_MIN..YEAR_MAX — so it
  // matches the year the map itself shades, and never lands on the 2026 YTD
  // partial point (whose rate_per_10k is null).
  const displayYear = yearRange.value[1];
  const primary = CAT_BY_ID[cat];
  const [agg, setAgg] = useState<RawByNeighbourhoodYear | null>(null);
  const [loadError, setLoadError] = useState(false);

  // Fetch the aggregate once (shared with TorontoMap via the fetchJson
  // cache); filter changes only recompute the memo below — previously every
  // chip toggle refetched and re-parsed the whole file.
  useEffect(() => {
    let cancelled = false;
    fetchJson<unknown>('/data/aggregates/by-neighbourhood-year.json')
      .then((a) => {
        if (!cancelled) setAgg(asByNeighbourhoodYear(a));
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const { rows, vmin, vmax } = useMemo(() => {
    if (!agg) return { rows: [] as NbhdRow[], vmin: 0, vmax: 0 };
    const all: NbhdRow[] = [];
    for (const n of Object.values(agg.neighbourhoods)) {
      const v = catValueAt(n.series, cat, displayYear, u);
      all.push({ id: n.id, name: n.name, rate: u === 'rate' ? v : 0, count: u === 'count' ? v : 0 });
    }
    const vals = all.map((r) => (u === 'rate' ? r.rate : r.count));
    all.sort((a, b) => (u === 'rate' ? b.rate - a.rate : b.count - a.count));
    return { rows: all.slice(0, 4), vmin: Math.min(...vals), vmax: Math.max(...vals) };
  }, [agg, cat, u, displayYear]);

  const vmid = (vmin + vmax) / 2;
  return (
    <>
      <div>
        <div class="map-legend-title">
          {`${u === 'rate' ? 'Rate per 10K' : 'Count'} · ${primary.name} · ${displayYear}`}
        </div>
        <div
          class="legend-ramp"
          style={{
            background: `linear-gradient(90deg, ${primary.color} 10%, ${primary.color} 100%)`,
            opacity: 0.85,
            WebkitMaskImage: 'linear-gradient(90deg, rgba(0,0,0,0.1), rgba(0,0,0,1))',
            maskImage: 'linear-gradient(90deg, rgba(0,0,0,0.1), rgba(0,0,0,1))',
          }}
        />
        <div class="legend-scale">
          <span>{vmin.toFixed(0)}</span>
          <span>{vmid.toFixed(0)}</span>
          <span>{vmax.toFixed(0)}</span>
        </div>
        <div style="margin-top: 12px; font-family: var(--font-mono); font-size: 10px; color: var(--ink-4); letter-spacing: 0.04em; line-height: 1.5;">
          Toronto neighbourhoods · 2021 Census boundaries · Single-hue sequential ramp keyed to the active category
        </div>
      </div>
      <TorontoMapPanel />
      <div style="border-top: 1px dashed var(--border-soft); padding-top: 12px;">
        <div class="map-legend-title" style="margin-bottom: 6px;">
          {u === 'rate' ? 'Highest rates' : 'Highest counts'}
        </div>
        {loadError && (
          <div style="font-family: var(--font-mono); font-size: 11px; color: var(--ink-3);">
            Data failed to load. Reload the page to retry.
          </div>
        )}
        {rows.map((n) => (
          <a
            href={`/neighbourhood/${n.id}/`}
            style="display: flex; justify-content: space-between; padding: 5px 0; font-family: var(--font-mono); font-size: 11px; border-bottom: 1px dashed var(--border-soft);"
          >
            <span style="color: var(--ink-2);">{n.name.slice(0, 22)}</span>
            <span style={`color: ${primary.color};`}>
              {u === 'rate' ? n.rate.toFixed(0) : n.count.toLocaleString()}
            </span>
          </a>
        ))}
      </div>
    </>
  );
}
