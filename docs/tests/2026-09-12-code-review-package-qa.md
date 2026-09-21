# Test run — code review, package updates, and dashboard QA

**Date**: 2026-09-12
**Backlog item**: [P2.17](../../project/backlog.md)
**Tested on**: macOS; Node 26.8.2; npm 11.19.1; Python 3.9.6 / openpyxl 3.1.5; Chrome 152.0.7977.65; Codex in-app browser. Production preview at `http://127.0.0.1:4324/`.

## What was tested

Parallel code reviews covered frontend state and comparisons, Python import/aggregation, build scripts, dependency compatibility, and structured data. Review fixes received focused regression tests. Responsive browser QA covers the five public page types, with asset and route checks for the production build.

## Package changes

| Package | Before | After |
|---|---|---|
| Astro | 6.3.8 | 7.3.2 |
| Astro Preact integration | 5.1.3 | 6.0.5 |
| Preact | 10.29.2 | 10.29.8 |
| Vitest | 4.1.10 | 5.0.0 |
| Astro check | 0.9.9 | 0.9.10 |
| Astro sitemap | 3.7.3 | 3.7.4 |
| JetBrains Mono / Space Grotesk packages | 5.2.8 / 5.2.10 | 5.3.0 / 5.3.0 |
| Leaflet types | 1.9.21 | 1.9.22 |
| Node types | 25.9.1 | 22.20.2 (matches the supported Node 22 deployment line) |

Declared `@preact/signals` 2.11.2 directly because application modules import it, and `preact-render-to-string` 6.7.0 as a development dependency for component regressions. Refreshed compatible transitive packages. Raised the Python requirement floor to the already-installed/current stable openpyxl 3.1.5. Leaflet 1.9.4 and resvg 2.6.2 were already current.

TypeScript remains on 6.0.3: `@astrojs/check` resolves its compiler API, while TypeScript 7 currently lacks that API. See the [official TypeScript 7 release notes](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/). This is the only newer direct npm package remaining in `npm outdated`.

The [Astro 7 migration guide](https://docs.astro.build/en/guides/upgrade-to/v7/) was checked. `compressHTML: true` explicitly preserves the previous inline whitespace behavior; no removed APIs or incompatible custom Markdown plugins were found. The architecture remains a static site.

## Review findings fixed

| Priority | Trigger and previous behavior | Correction |
|---|---|---|
| P2 | Counts-mode neighbourhood hero compared a neighbourhood's raw total to Toronto's total, misleadingly suggesting almost every neighbourhood was roughly 99% lower. | Always compare per-capita levels and label the comparison “vs. Toronto (rate).” |
| P2 | Toronto anchor row kept the count change in rate mode and used the 2025 population for earlier selected years. | Use the displayed unit for change and the selected year's population. |
| P2 | Selecting a Compare category excluded from scope wrote contradictory primary/scope state; reloading changed the selection. | Update primary and scope together. |
| P2 | A copied default view omitted filter defaults, so the recipient's saved preferences changed the shared view. | Copied URLs explicitly encode all filters and retain them after reload. |
| P2 | Saved preferences containing valid JSON `null` could break hydration. | Ignore non-object preference data. |
| P2 | Impossible TPS dates could enter annual totals/feed but disappear from monthly totals; mismatched years could replace the archive before the next build failed. | Validate real dates and matching years before archive replacement; independently validate dates when reading Markdown. |
| P2 | Removing an optional CSI/CMA source left the old generated JSON and context card behind. | Remove obsolete generated context files when their source is absent. |
| P3 | `SITE_URL` overrides changed canonical/OG/sitemap URLs but JSON-LD stayed on the production domain. | Pass the configured Astro site to all structured-data builders. |
| P3 | The neighbourhood index always called its sparkline a ten-year trace, even with a shorter selected window. | Derive the label from the selected span. |
| P2 | Muted navigation/card labels and light-theme selected controls failed text contrast checks. | Adjust dark muted text and light accent/category tokens while preserving their hues. |
| P2 | The inline methodology link depended on color alone. | Underline inline prose links. |
| P2 | Mobile comparison tables scrolled horizontally but could not receive keyboard focus. | Add meaningful accessible names, keyboard focus, and visible inset focus rings. |

## Automated verification

- Baseline: 158 Vitest + 100 Python tests; Astro check clean.
- Updated code: 166 Vitest + 104 Python tests, **270 total**, including 12 additional regression cases.
- `npm run verify` now runs the type check, a fresh production build, and both suites in order. This ensures built-artifact tests have current output instead of silently skipping absent artifacts.
- Astro check: 79 files, zero errors/warnings/hints.
- Production build: 163 pages, including all 158 neighbourhood pages; production excludes `/project/` and `/styleguide/`.
- Built data and HTML invariant suites pass, including aggregate reconciliation, gzip budgets, canonical/OG links, sitemap coverage, and structured-data assertions.
- `npm audit`: **18 vulnerable packages before → zero known vulnerabilities after** (including development dependencies).
- Read-only corpus check: all 389,614 incident rows have real dates and matching yearly files. Source data was not refreshed or changed. Current TPS coverage is through 2026-06-30, imported 2026-07-27.
- Sitemap hashes were regenerated for the new build; subsequent rebuilding preserved unchanged page dates.

## Browser QA

Tested at **1280×900 desktop** and **375×812 mobile**, in dark and light themes. An initial broad sweep passed 106 valid flow assertions. After the accessibility corrections, **35/35 final targeted checks passed** and **30/30 axe WCAG A/AA scans reported zero violations**: all five surfaces in both themes and viewports, plus every selected category on desktop Overview and Compare. These are two overlapping passes, not a claim of 141 unique checks.

- Overview: counts default, units, category scope, year window, optional YTD caveat, 158 map polygons, and map navigation.
- Compare: three default slots, add a fourth, swap selection, remove down to two, and keep a newly selected category after reload even when the prior scope excluded it.
- Index: 158 rows, search, empty search state, population sorting, filters, map navigation, and responsive layout.
- Neighbourhood detail: calendar table semantics and selected-year columns, feed pagination, 158 map polygons, nearby links, and corrected city comparisons. Moss Park's “vs. Toronto (rate)” remains **▲300%** in both units. Toronto's assault change is **▲34% counts / ▲16% rate**; selecting 2023 shows population **3,134,010**.
- Share links: Copy view encodes all defaults; a recipient with saved rate/robbery/narrow-year/YTD preferences sees the copied counts/all-categories/full-year view on open and reload. Explicit non-default shared links also hydrate correctly.
- Mobile tables: keyboard focus is visible, and ArrowRight scrolls both comparison tables horizontally (40 pixels in the targeted checks).
- About, public navigation, branded missing routes, production-only routes, assets, metadata, and both themes were checked. No document-level horizontal overflow was found on the tested public surfaces in either unit.
- No unexpected browser JavaScript or resource failures. The three 404 console messages came from deliberate missing-route checks; cancelled CARTO tile requests occurred on navigation/theme replacement, rather than failed application requests.
- Final visual inspection included desktop Overview/Compare and mobile neighbourhood layouts in the in-app browser, plus final Chrome captures. Twenty final screenshots were captured.

The first harness incorrectly clicked hidden unit controls on mobile About, clicked map polygons under the expanded sticky filter rail, and compared two empty lists for one numerical assertion. Those checks were corrected and rerun with real pointer clicks, nonempty numerical values, and explicit keyboard actions; they were not counted as product regressions.

Session evidence lives in `/private/tmp/crime-pulse-qa/`: `initial-results.json`, `results-retest.json`, `qa-summary.json`, `verify.log`, `npm-audit.json`, the temporary sweep runner, and `final-*.png`. The repository record is this document; temporary evidence is not a durable browser test suite. Axe's zero violations apply to the scanned states and do not replace testing with assistive technology.

## Prioritized improvement ideas

1. **Make Compare useful in counts mode.** The always-visible Toronto total controls the shared axis, squeezing the default neighbourhood trajectories into only a few pixels and overlapping their end labels. Offer a Toronto-baseline toggle, retaining raw counts as the default unit; suppress/collate colliding labels. This was confirmed in the browser, not just inferred from code.
2. **Expose the selected chart values accessibly.** Add a visible data-table or value-inspection option that follows the chosen unit, categories, and years and works by keyboard and touch. Current SVG labels and static screen-reader summaries do not expose every interactive view's values.
3. **Keep browser regression coverage in the repository.** `npm run verify` now handles the build and automated suites. A maintained browser runner should cover filter/share/persistence cases, responsive overflow, maps, and accessibility, which historical temporary sweep scripts cannot protect continuously.
4. **Show a reviewable data-refresh diff.** Report new/revised incident counts, unresolved neighbourhood coverage, source dates, and monthly-to-annual reconciliation before accepting a refreshed archive. This complements the existing weekly availability monitor.

Further options: make the index's single-category versus summed-category controls clearer; set cumulative page transfer budgets alongside per-file budgets; stream large StatCan CSV filters to reduce importer memory.

## Notes and limits

This is local source/build verification; no commit, push, source refresh, or deployment was performed. Existing weekly-monitor notes in the backlog/changelog were preserved. Local preview does not verify Cloudflare's deployed response headers or analytics configuration. Node 22 compatibility follows package engine requirements; this run used Node 26 locally.
