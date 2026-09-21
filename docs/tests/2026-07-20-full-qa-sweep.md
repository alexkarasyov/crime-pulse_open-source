# Test run — post-v2 full QA sweep + loader/site-invariant suites

**Date**: 2026-07-20
**Backlog item**: P2.12 ([`../../project/backlog.md`](../../project/backlog.md))
**Tested on**: macOS (Darwin 25.5.0), headless Google Chrome (system install) via puppeteer-core, site served by `astro preview` on port 4324 (fresh `dist/` build — NOT the long-running preview on 41690, which may be stale)

## What was tested

1. **Automated suites** — `npm test`: 150 Vitest tests (102 existing + 48 new) and 77 Python `unittest` tests. `npm run check` (astro check): 0 errors / 0 warnings over 70 files.
2. **Production build** — `npm run build`: 163 pages, all aggregates within the ADR-004 gzip budget.
3. **Browser QA sweep (94 checks)** — scripted headless-Chrome pass over the fresh production build at 1280×900 and 375×812. This sweep post-dates the neighbourhood-v2 / ViewRail migration, so it exercises the new control surface directly:
   - **Overview**: ViewRail renders; unit toggle changes the hero; rail panel opens with 5 scope chips; chip toggle updates the "N of 5" summary; year selects update the window; Copy view writes a share URL containing the current state; choropleth draws 158 polygons; no console/page/network errors; no horizontal overflow.
   - **Shared-link hydration**: `/?u=count&c=as,ro&y=2018-2024` (short category codes per `urlState.ts`) hydrates unit, "2 of 5" scope, and the year window.
   - **Neighbourhood detail (73 / Moss Park)**: ViewRail + hero delta strip; calendar exposes `role="table"` semantics (13 rows) with 120 cells (12 months × 10 default years — verified with cleared localStorage; the year window slices columns); canonical + og:image point at crimepulse.ca and the image ships; context map 158 polygons; neighbours table populated.
   - **Neighbourhood index**: 158 rows as real links; search narrows; population sort applies; ViewRail present.
   - **Compare**: 3 default slots (per `DEFAULT_COMPARE_PICKS`); add → 4; slot `<select>` swaps the neighbourhood; chart draws ≥4 stroked series; remove → 3.
   - **About**: methodology copy present.
   - **404 / dev routes / assets**: branded 404 with status 404; `/project/` and `/styleguide/` absent; robots/sitemap/favicon/Leaflet CSS serve 200; robots.txt points at the crimepulse.ca sitemap.
   - **Mobile (375×812)**: Overview, Nbhd 73, index, Compare, About, and 404 — no horizontal overflow in rate *and* count modes; zero console/page/network errors everywhere.
4. **New durable suites** (see changelog 2026-07-20): `fetchJson` dedupe/eviction, `aggregates.ts` loader contract, and `tests/site-invariants.test.ts` over `dist/`.

## Passed

- `npm test`: **227/227 green** (150 Vitest + 77 unittest). `astro check` clean.
- Browser sweep: **94/94 checks pass** after the two fixes below.

## Regressed / new issues

- **Fixed in this batch — mobile page scroll on the neighbourhood index.** The v2 index header `<h1>` ("Toronto neighbourhoods.") shipped with a fixed inline `font-size: 56px`; the single unbreakable word is ~411px wide at that size, forcing the whole page to ~444px at a 375px viewport. Fix: `clamp(34px, 9vw, 56px)` (the house pattern used by `.hero h1` and the 404 page). Verified 375-wide clean after rebuild.
- **Fixed in this batch — mobile page scroll on About.** `.dl-grid` (the source/licensing definition lists) uses fixed `grid-template-columns: 200px 1fr`; at 375px the value column gets ~77px and longer values push the page to ~402px. Fix: single-column `.dl-grid` inside the existing mobile media block in `base.css`. Verified clean after rebuild.
- Both were found by the sweep's per-page `scrollWidth <= clientWidth` assertion and bisected by hiding subtrees until the overflow disappeared — worth keeping in future sweeps; neither was visible at desktop widths.

## Addendum — SEO fixes (same day, P2.13)

After the sweep, the SEO audit's three gaps were closed (JSON-LD, static nearby-neighbourhood links, sitemap `lastmod` via content-hash manifest). Verification: `npm test` 233/233 green with the new site-invariant assertions; the 94-check browser sweep re-run clean against the rebuilt site; the nearby-links row screenshot-checked at 1280 and 375 wide (no overflow, house mono style); and the lastmod rule proven by back-to-back builds — first build stamped 162/162 URLs, immediate rebuild stamped 0/162.

## Notes

- The sweep clears `localStorage` per page (`evaluateOnNewDocument`) — persisted view prefs otherwise leak across checks (e.g. a year-window change on the Overview shrinks the calendar's expected 120 cells on a later neighbourhood-page check to 72).
- Compare's three default slots and per-slot `<select>` (no free-text picker) are by design; the first sweep draft assumed two slots + a search input and flagged false failures.
- The QA script itself is a session scratchpad artifact (not committed); the durable regression protection added instead is the three new suites, which cover the loader/fetch/built-HTML layers the script can't reach in CI without a browser.
- Data freshness was not re-imported this run (last verified 2026-07-16; TPS corpus through 2026-03-31, Q2 2026 not yet published).
