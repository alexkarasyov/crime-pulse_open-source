// Chronological feed for the Neighbourhood screen.
// Local filter chips narrow within the page scope (activeCats from the view
// rail); scoped-out categories are hidden with an explanatory empty state —
// the rail is the visible control that explains why.
//
// Props carry only the FIRST page of incidents (server-rendered for SEO and
// no-JS readers). The full feed already ships as a static file at
// /data/aggregates/neighbourhood-incidents/{id}.json, so the island fetches
// it at hydration instead of inlining ~2MB of escaped JSON into every
// neighbourhood page's astro-island props attribute.

import { useEffect, useMemo, useState } from 'preact/hooks';
import { CATEGORIES, CAT_BY_ID, type CategoryId } from '../../lib/categories';
import { activeCats } from '../../lib/state';
import type { RawIncident } from '../../lib/aggregates';
import { fetchJson } from '../../lib/fetchJson';
import CatGlyph from '../preact/CatGlyph';

interface Props {
  nbhdId: string;
  /** First PAGE_SIZE incidents, already sorted desc by date on the server. */
  initialIncidents: RawIncident[];
  /** Total incident count of the full feed (for the footer label). */
  totalCount: number;
}

export const PAGE_SIZE = 14;

export default function NeighbourhoodFeed({ nbhdId, initialIncidents, totalCount }: Props) {
  const [filter, setFilter] = useState<'all' | CategoryId>('all');
  const [page, setPage] = useState(1);
  const [full, setFull] = useState<RawIncident[] | null>(null);
  const [error, setError] = useState(false);
  const scope = activeCats.value;

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ incidents: RawIncident[] }>(
      `/data/aggregates/neighbourhood-incidents/${nbhdId}.json`,
    )
      .then((f) => {
        if (!cancelled) setFull(f.incidents);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [nbhdId]);

  const loaded = full !== null;
  const incidents = full ?? initialIncidents;

  // Page scope first (the view rail's chips), then the local chips.
  const filtered = useMemo(
    () =>
      incidents.filter(
        (r) => scope.includes(r.category) && (filter === 'all' || r.category === filter),
      ),
    [filter, incidents, scope],
  );

  const visible = filtered.slice(0, page * PAGE_SIZE);

  // Until the full feed arrives we only know the unfiltered total; once any
  // filter narrows the view (or the fetch resolves) the filtered length is
  // the honest denominator.
  const unfiltered = filter === 'all' && scope.length === CATEGORIES.length;
  const totalForLabel = !loaded && unfiltered ? totalCount : filtered.length;

  return (
    <>
      <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
        <span class="vrail-label">Filter feed</span>
        <button
          type="button"
          class={`filter-chip ${filter === 'all' ? 'on' : ''}`}
          aria-pressed={filter === 'all'}
          onClick={() => {
            setFilter('all');
            setPage(1);
          }}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            type="button"
            class={`filter-chip ${filter === c.id ? 'on' : ''}`}
            aria-pressed={filter === c.id}
            onClick={() => {
              setFilter(c.id);
              setPage(1);
            }}
            style={filter === c.id ? `color: ${c.color}; border-color: ${c.color};` : ''}
          >
            <CatGlyph cat={c} size={8} /> {c.shortCode}
          </button>
        ))}
      </div>
      <div class="card feed4" style="padding: 0; overflow: hidden; margin-top: 16px;">
        <div class="feed-head">
          <span>DATE</span>
          <span>CATEGORY</span>
          <span>OFFENCE</span>
          <span>PREMISES</span>
        </div>
        {visible.length === 0 && (
          <div style="padding: 18px 16px; font-family: var(--font-mono); font-size: 12px; color: var(--ink-3);">
            No incidents in this view — widen the category scope in the rail above.
          </div>
        )}
        {visible.map((row, i) => {
          const c = CAT_BY_ID[row.category];
          return (
            <div class="feed-row" key={`${row.date}-${row.category}-${row.offence}-${i}`}>
              <div class="feed-date">{row.date}</div>
              <div class="feed-catcell">
                <CatGlyph cat={c} size={10} /> {c.name}
              </div>
              <div class="feed-offence">{row.offence}</div>
              <div class="feed-premises">{row.premises_type.toUpperCase()}</div>
            </div>
          );
        })}
        <div style="padding: 14px 16px; display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: 11px; color: var(--ink-3); border-top: 1px solid var(--border-soft); background: var(--surface-2);">
          <span>
            {visible.length === 0
              ? 'NO INCIDENTS'
              : `SHOWING 1–${visible.length.toLocaleString()} OF ${totalForLabel.toLocaleString()}`}
          </span>
          {/* On a failed fetch only the server-rendered first page exists —
              never claim END OF FEED then, even when a filter makes the
              filtered total equal the visible count. (Exception: a feed so
              small the first page already covers totalCount.) */}
          {error && !loaded && (!unfiltered || visible.length < totalCount) ? (
            <span style="color: var(--ink-4);">FEED UNAVAILABLE · SHOWING FIRST {visible.length}</span>
          ) : visible.length < filtered.length ? (
            <button
              type="button"
              style="color: var(--accent); cursor: pointer; background: none; border: 0;"
              onClick={() => setPage((p) => p + 1)}
            >
              LOAD NEXT {PAGE_SIZE} →
            </button>
          ) : !loaded && !error && visible.length < totalForLabel ? (
            <span style="color: var(--ink-4);">LOADING…</span>
          ) : (
            <span style="color: var(--ink-4);">END OF FEED</span>
          )}
        </div>
      </div>
    </>
  );
}
