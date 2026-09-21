// View rail — the single control surface over every data screen (design
// proposal "neighbourhood v2"). One collapsed row: unit toggle, a category
// scope summary button, a year-window summary button, and Copy view. Both
// summary buttons expand the same panel with the actual controls.
//
// Control model: chips here set PAGE SCOPE (activeCats — which categories
// the sections below include); the PRIMARY lens is picked in the page body
// (trend-chart tabs, category cards, list tabs — see each page's hint). The
// unit toggle lives only here — the topbar one is hidden on pages that
// render this rail.
//
// The rail condenses (tighter padding) once the page is scrolled.

import { useEffect, useState } from 'preact/hooks';
import { CATEGORIES } from '../../lib/categories';
import {
  unit,
  setUnit,
  activeCats,
  toggleCat,
  primaryCat,
  setPrimaryCat,
  yearRange,
  setYearRange,
  includeYTD,
  setIncludeYTD,
  YEAR_MIN,
  YEAR_MAX,
} from '../../lib/state';
import CopyViewButton from '../preact/CopyViewButton';
import CatGlyph from '../preact/CatGlyph';

const ALL_YEARS: number[] = Array.from(
  { length: YEAR_MAX - YEAR_MIN + 1 },
  (_, i) => YEAR_MIN + i,
);

interface Props {
  /** What the scope chips drive on this page (rendered under the chips).
   *  Plain string — island props must serialize across the Astro boundary. */
  scopeHint?: string;
  /** What the year window drives on this page. */
  yearHint?: string;
  /** Max report date the YTD partial year covers (e.g. "2026-03-31").
   *  When set, the rail offers the "+ Include 2026 YTD" toggle + caveat;
   *  omit on pages whose data has no partial-year points. */
  ytdThrough?: string;
}

export default function ViewRail({ scopeHint, yearHint, ytdThrough }: Props) {
  const u = unit.value;
  const cats = activeCats.value;
  const ytd = includeYTD.value;
  const [rangeStart, rangeEnd] = yearRange.value;
  const [open, setOpen] = useState(false);
  const [condensed, setCondensed] = useState(false);

  useEffect(() => {
    const onScroll = (): void => setCondensed(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  function toggleScope(id: (typeof CATEGORIES)[number]['id']): void {
    toggleCat(id);
    // The primary lens must stay inside the page scope; if the user just
    // scoped it out, hand the lens to the first category still on.
    const on = activeCats.value;
    if (!on.includes(primaryCat.value) && on.length > 0) {
      setPrimaryCat(on[0]!);
    }
  }


  return (
    <div class={`filterbar ${condensed ? 'condensed' : ''}`}>
      <div class="vrail-inner">
        <span class="vrail-label" id="vrail-unit-label">View</span>
        <div class="seg" role="group" aria-labelledby="vrail-unit-label">
          <button
            type="button"
            class={`seg-btn ${u === 'count' ? 'active' : ''}`}
            aria-pressed={u === 'count'}
            onClick={() => setUnit('count')}
          >
            Counts
          </button>
          <button
            type="button"
            class={`seg-btn ${u === 'rate' ? 'active' : ''}`}
            aria-pressed={u === 'rate'}
            onClick={() => setUnit('rate')}
          >
            Rate / 10K
          </button>
        </div>
        <span class="vrail-div" />
        <button
          type="button"
          class="vrail-btn"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <span class="vrail-glyphs">
            {CATEGORIES.map((c) => (
              <span class={cats.includes(c.id) ? '' : 'off'}>
                <CatGlyph cat={c} size={10} />
              </span>
            ))}
          </span>
          {cats.length} of {CATEGORIES.length} categories <span class="caret">▾</span>
        </button>
        <button
          type="button"
          class="vrail-btn"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {rangeStart} – {rangeEnd}{ytdThrough ? ` · YTD ${ytd ? 'on' : 'off'}` : ''} <span class="caret">▾</span>
        </button>
        <span class="vrail-spacer" />
        <CopyViewButton />
      </div>
      {open && (
        <div class="vrail-panel">
          <div class="vrail-panel-inner">
            <div>
              <p class="vrail-group-label">Categories on this page</p>
              <div class="vrail-chips">
                {CATEGORIES.map((c) => {
                  const on = cats.includes(c.id);
                  return (
                    <button
                      type="button"
                      class={`filter-chip ${on ? 'on' : ''}`}
                      aria-pressed={on}
                      onClick={() => toggleScope(c.id)}
                      style={on ? `color: ${c.color}; border-color: ${c.color};` : ''}
                    >
                      <CatGlyph cat={c} size={8} /> <span style={on ? 'color: var(--ink);' : ''}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
              <p class="vrail-hint">
                {scopeHint ?? (
                  <>
                    Chips set <strong>page scope</strong> for charts, context, and the feed.
                    The <strong>primary lens</strong> (hero, trend, seasonality, map shading)
                    is picked on the trend chart.
                  </>
                )}
              </p>
            </div>
            <div>
              <p class="vrail-group-label">Year window</p>
              <div class="vrail-years">
                <select
                  class="year-range-select"
                  value={rangeStart}
                  onChange={(e) =>
                    setYearRange(
                      parseInt((e.currentTarget as HTMLSelectElement).value, 10),
                      rangeEnd,
                    )
                  }
                  aria-label="Start year"
                >
                  {ALL_YEARS.map((y) => (
                    <option value={y} disabled={y >= rangeEnd}>{y}</option>
                  ))}
                </select>
                <span class="vrail-label">→</span>
                <select
                  class="year-range-select"
                  value={rangeEnd}
                  onChange={(e) =>
                    setYearRange(
                      rangeStart,
                      parseInt((e.currentTarget as HTMLSelectElement).value, 10),
                    )
                  }
                  aria-label="End year"
                >
                  {ALL_YEARS.map((y) => (
                    <option value={y} disabled={y <= rangeStart}>{y}</option>
                  ))}
                </select>
              </div>
              {ytdThrough && (
                <div style="margin-top: 10px;">
                  <button
                    type="button"
                    class={`filter-chip ${ytd ? 'on' : ''}`}
                    aria-pressed={ytd}
                    onClick={() => setIncludeYTD(!ytd)}
                    style={ytd ? 'color: var(--accent); border-color: var(--accent-line);' : ''}
                  >
                    + Include {ytdThrough!.slice(0, 4)} YTD
                  </button>
                </div>
              )}
              <p class="vrail-hint">
                {yearHint ?? 'Applies to the hero, trend, seasonality, map, category readout, and neighbours table.'}
              </p>
            </div>
          </div>
        </div>
      )}
      {ytdThrough && ytd && (
        <div style="max-width: var(--max-w); margin: 0 auto; padding: 0 var(--gutter) 10px;">
          <div class="caveat compact">
            <span class="caveat-icon">!</span>
            <div class="caveat-body">
              <strong>{ytdThrough!.slice(0, 4)} is year-to-date (data through {ytdThrough}).</strong>{' '}
              Both the population denominator and the incident numerator are incomplete;
              this year is excluded from 10-year comparable visuals.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
