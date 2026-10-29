# Changelog · newest at top

## 2026-10-29

- **[P3.1](../project/backlog.md)** — A Compare link whose `cmp` ids are not neighbourhood numbers no longer crashes the comparison; those links keep the default neighbourhoods. Neighbourhood names are encoded before they are written into JSON-LD and map tooltips. npm audit findings in the lockfile are cleared with updates inside the existing version ranges (Astro 7.4.4, devalue 5.9.4).

## 2026-09-21

- Dev-only topbar links to `/project/` and `/styleguide/` now include the trailing slash the site requires, so those pages open from the dev server instead of 404.

## 2026-09-20

- **[P3.0](../project/backlog.md)** — Published this public snapshot with a fresh git history: MIT [`LICENSE`](../LICENSE), data-licence [`NOTICE`](../NOTICE), and a clone-and-build [`README.md`](../README.md) pointing at [crimepulse.ca](https://crimepulse.ca). Crime Markdown is unchanged (including lat/lng). Operator-only Cloudflare `workers.dev` hostnames were dropped. The private source repo was not rewritten. README now covers tests, data-licence table, screenshot, and deploy notes for a first-time clone. The open-source handoff no longer names a local checkout path or the private GitHub slug.

## 2026-09-12

- **[P2.23](../project/backlog.md)** — Published the verified review/package release to [crimepulse.ca](https://crimepulse.ca) on the existing Cloudflare static-assets service, version `c130947c-f709-48f3-b289-feae4d0296c0`. Confirmed production pages/assets, headers, real maps, responsive controls and shared views; source freshness and analytics setting are unchanged. The [production test record](tests/2026-09-12-production-deployment.md) includes deployment and live QA evidence; deployment instructions now identify the actual production service.

- **[P2.18–P2.22](../project/backlog.md)** — Made Compare's city baseline optional with shareable per-unit choices and readable patterned legends; added keyboard/touch chart tables and calendar values; clarified exact index category selection. Added maintained responsive Chrome QA, cumulative page-size budgets and production-header checks to `npm run verify`, including fixes for embedded fonts and narrow-screen tables/callouts. Refreshes now stage all sources and produce a change review before explicit, revalidated acceptance with rollback; StatCan filters stream their CSV inputs. See [ADR-011](../project/decisions/011-review-staged-data-before-acceptance.md) and the [follow-up QA record](tests/2026-09-12-review-followups.md).

- **[P2.17](../project/backlog.md)** — Updated Astro/Preact and development packages, refreshed the lockfile, and removed all 18 reported npm dependency vulnerabilities. Kept TypeScript 6 for Astro checker compatibility; added `npm run verify` to check, build, and test in one command. Corrected neighbourhood/city rate comparisons and selected-year populations, made copied views independent of recipient preferences, guarded invalid saved state and incident dates, removed stale optional context outputs, and aligned structured data with the configured site URL. Responsive QA also addressed contrast, inline-link identification, and keyboard access to scrollable tables. Full findings, package versions, verification, and prioritized follow-ups are in the [review and QA record](tests/2026-09-12-code-review-package-qa.md).

- **[P1.9a](../project/backlog.md#p19a--check-official-data-sources-weekly)** — Activated the owner's weekly Codex data-availability check for Mondays at 09:00 Pacific, covering TPS incidents, population, StatCan CSI, and CMA rates. The monitor reports new releases or substantive revisions and actionable check failures, suppresses duplicate alerts, and leaves source imports and deployment manual. Automation `crime-pulse-weekly-data-check` was confirmed active; local runs require the computer on and the desktop app running.

## 2026-08-30

Metro context card shipped ([P1.4d](../project/backlog.md), [ADR-010](../project/decisions/010-cma-context-card-not-gta-suburbs.md)).

### Added
- **Toronto metro in context card** on the Overview — police-reported Criminal Code rate per 100,000 for Toronto CMA vs Hamilton, Ottawa-Gatineau, Montréal, Vancouver, Calgary, Edmonton, and Canada (StatCan 35-10-0177-01). New [`scripts/import_cma_rates.py`](../scripts/import_cma_rates.py) → `data/cma/` → `cma-context.json` → [`CmaCompareCard.astro`](../src/components/CmaCompareCard.astro). Card copy and About §04 explain that Toronto CMA includes Mississauga, Brampton, Vaughan, Markham, and other GTA municipalities while maps and neighbourhood views remain City-of-Toronto-only (ADR-001 unchanged).
- **`npm run refresh`** now also re-imports StatCan CSI (35-10-0026-01) and CMA rates (35-10-0177-01) alongside TPS and population data.

### Verification
- `npm test` green after import + rebuild; manual test record under [`docs/tests/2026-08-30-cma-context-card.md`](tests/2026-08-30-cma-context-card.md).

## 2026-08-07

Full repo audit & QA remediation ([P2.16](../project/backlog.md)) — pre-release gate before commit approval.

### Fixed
- **Category scope desync (the audit's two real state bugs).** The Overview category cards (`CategoryGrid`) and the neighbourhood-index chips (`NeighbourhoodIndex`) called `setPrimaryCat` without `ensureCatOn`, unlike `CategoryPicker` which documents the invariant. With the rail scoped down, clicking a scoped-out category rendered that category's label over *another category's data* (index table) or desynced the map from the share-link state (Overview). Both now force the picked lens into scope; verified live (`?c=as` + ROB click → `?p=ro&c=as,ro`).
- **Back/forward to a clean-URL history entry left stale state.** `hydrateFromUrl`'s early-return ran before the popstate reset block, so Back onto an entry with no query kept the previous filters under a clean URL. A no-state URL on history traversal now resets everything to defaults (+2 tests).
- **GeoJSON cache poisoning.** `build_aggregates.py` wrote the downloaded bytes to the vendored cache *before* parsing/validation — an HTML error page or truncated body would overwrite `data/geo/neighbourhoods-4326.geojson` and break every subsequent (including offline deploy) build. The cache is now written atomically only after parse + validation succeed (+3 tests).
- **CSI importer could silently drop a geography.** A StatCan GEO-label reformat would drop e.g. Toronto from the context card while other geographies kept matching. `import_csi.py` now fails when any wanted geography is missing, writes atomically (stage-and-replace like the other importers), and gained its first test suite (11 tests: `match_geo` anchoring, conflict detection, year window, completeness).
- **Sitemap stamping could silently no-op.** `update_sitemap_lastmod.mjs` now counts actual `<lastmod>` substitutions and refuses to write (exit 1) if the count doesn't match the URL list — previously a sitemap-serialization change would update the manifest while landing zero stamps in the XML.
- **Social/OG generators asserted data claims in static copy.** "the ten-year high", the up-arrow + "more … than ten years ago" framing, and `+${yoy}` sign were baked into `build_social_images.mjs` regardless of the data (a future refresh could render "fell 12%" for a rise, or `+-3.2%`); all claims are now computed, with zero-base and <2-full-years guards. `build_og_images.mjs`'s footer year window now derives from the aggregate instead of a `2016–2025` literal.
- **ADR-009 copy drift on About.** The ethics bullet still said "Counts are never the default visualisation" and §03 said the map shades "rate per 10K" — both contradicted the counts default shipped 2026-07-21. Rewritten to state the actual position (counts default, switch to rates when comparing across sizes).
- **Overview auto-theft signal hardcoded its direction.** "fell … after peaking in {year}" now derives "fell/rose" from the YoY sign and drops the peak clause when the latest year *is* the peak.
- **Feed footer honesty on fetch failure.** With a category filter active and the full-feed fetch failed, the footer claimed "END OF FEED" over the 14 server-rendered rows; the unavailable state now wins whenever the full feed never arrived.
- **Choropleth hover panel sparkline** now slices to the rail's year window, matching the value/YoY beside it.
- **A11y**: NeighbourhoodPicker rebuilt to the ARIA 1.2 combobox pattern (role/`aria-expanded` on the input, `aria-controls`, `aria-activedescendant` for the highlighted option); `aria-live` on the "✓ Link copied" swap and the index result count; "Rate by year" card title now tracks the unit; YoY sort comparator NaN guard (two zero-base rows).
- **Docs**: deploy.md "Node 20" → Node 22 (≥ 22.12), stale `generated_at` freshness claim corrected, "~369k-row" → ~390k; `.nvmrc` pinned to `22.12` (astro@6 hard-exits below 22.12).

### Changed
- **Year-window staleness alarms.** `import_tps_csi.py` and `build_aggregates.py` now warn loudly (naming every constant to bump) once the calendar rolls past the configured window — previously January-2027 refreshes would exit 0 while silently dropping every new-year row.
- **Feed reconciliation is exact.** The ±0.5% `TOTAL_RECONCILE_TOLERANCE` is gone; feed totals and yearly sums derive from the same in-memory rows and must be equal (verified 158/158 exact today).
- **`NeighbourhoodChange` de-islanded.** It renders two static links; it no longer hydrates (`client:load` dropped) or ships a dead 158-element prop on each of the 158 pages.
- **Dataset JSON-LD name** derives its year window from `dataThrough()` so it can't disagree with `temporalCoverage`; footer year window and category count now derive from `YEAR_MIN`/`YEAR_MAX`/`CATEGORIES`.
- **Process backfill**: the social-card work (commits `59909dd`, `2026-07-16` and `2eb6544`, `2026-07-21`) shipped without backlog/changelog entries; recorded retroactively as [P2.15](../project/backlog.md).

### Verification
- 249 automated tests green (158 Vitest + 91 unittest; 16 new: geojson cache safety ×3, import_csi ×11, popstate ×2). `astro check` 0 errors. Production build clean, 163 pages; sitemap 162/162 re-stamped (JS bundle hashes moved with the code changes). Headless-Chrome sweep over the fresh `dist/`: 16 page-loads (8 routes × 2 viewports) + interaction sweep, zero console/page errors, zero failed requests, zero horizontal overflow; targeted regression scenarios for both state bugs pass. Independent data-integrity spot check: neighbourhood 1's 2024 aggregate total (1,187) re-counted exactly from the Markdown corpus.

## 2026-07-27 (later)

StatCan CSI 2025 published — context card caught up.

### Changed
- **CSI context card now shows 2025** (was source-stale at 2024). Freshness audit of "are all dashboards up to date" found `npm run refresh` does not re-import StatCan 35-10-0026-01, and StatCan's annual release (late July) had landed: re-ran `scripts/import_csi.py` → 66 rows, 6 geographies × 2015–2025. Toronto-CMA 2025 CSI 54.99 (still lowest of the six shown). Only the Overview's HTML changed (sitemap lastmod 1/162).
- Same audit confirmed the other intended asymmetry: the monthly calendar deliberately stops at 2025-12 (complete years only, per the documented design in `build_aggregates.py`); trend charts and incident feeds carry 2026 YTD through 2026-06-30.

### Verification
- `npm test` 233/233 green; headless-Chrome check on the rebuilt Overview renders "CSI · 2025" with all six geographies and zero console errors.

## 2026-07-27

Data refresh: TPS Q2 2026 published.

### Changed
- **Q2 2026 imported — data now covers reports through 2026-06-30** (previous corpus ended 2026-03-31). `npm run refresh` + full rebuild: corpus grows 379,184 → 389,614 rows; `tps-csi-2026.md` now holds 20,028 H1 rows (Jan–Jun). All freshness surfaces (topbar pill, footer, About, Dataset JSON-LD `dateModified`) advance automatically; sitemap `lastmod` stamped 162/162 (data touches every page).
- **Back-year revisions from the source, largest in 2025.** TPS revised recent history: 2025 net −29 rows (+43/−72, mostly Assault and B&E reclassifications/withdrawals); 2020/2022/2023/2024 each shifted by ≤3 rows. 2016–2019 and 2021 byte-identical. Population re-import unchanged (only `imported_at` advanced).
- Notable in the new half-year (H1-vs-H1, counts): total +2.8%; **Auto Theft +12.0%** — its first H1 increase since the 2023 peak (H1: 5,810 → 4,695 → 3,024 → 3,387); **Robbery −15.8%** (carjackings −61.7%, business robbery −45.6%); Theft Over +10.9%; Assault +3.0%; B&E −2.0%.

### Verification
- `npm test` 233/233 green (156 Vitest + 77 unittest). Full production build clean (163 pages). Headless-Chrome sweep 34/34 over the fresh `dist/` (desktop + 375px: freshness strings show 2026-06-30, YTD toggle surfaces the H1 data with its caveat, choropleths draw 158 polygons, `partial_years` metadata correct, zero console/page/network errors, no overflow).

## 2026-07-21 (later)

### Fixed
- **About TOC floated over the content on screens ≤1100px (user report).** Below the 1100px breakpoint `.about-grid` collapses to one column with the TOC stacked above the content, but `.about-toc` kept `position: sticky` — and a sticky grid item sticks within the whole grid container, so the TOC rode down the page overlapping the sections (e.g. at the `#unit` anchor). The TOC is now `static` in the single-column layout; desktop (>1100px) keeps its sticky own-column behaviour. Verified at 375/576/1000/1280px.
- **Stale TOC label.** "02 · Why rates, not counts" (pre-ADR-009 copy) → "02 · The default unit".

## 2026-07-21

Default unit flipped to raw counts ([P2.14](../project/backlog.md), [ADR-009](../project/decisions/009-default-unit-is-counts.md) — supersedes ADR-002's rate default; rates and their denominators are unchanged and stay one toggle away).

### Changed
- **Counts are the site-wide default unit.** `DEFAULT_UNIT` in `src/lib/state.ts` drives the signal default and share-link encoding (`u=` emitted only for the non-default unit). Toggle order now leads with Counts in the view rail and topbar. Persisted visitor preferences still override the default.
- **Copy reconciled everywhere rate-default was claimed.** About §02 rewritten (with the dense-neighbourhood comparison caveat promoted to a warning), Overview hero + methodology bullets, footer, all meta descriptions, the Dataset JSON-LD, and the default OG-card subtitle. A new `UnitPhrase` island keeps the hero eyebrow accurate in either unit; the category-grid eyebrow tracks the unit via `$U`.
- **Governance docs updated.** AGENTS.md (including its "Do not" list), README, charter, and `docs/overview.md` now state the counts default and point at ADR-009; ADR-002 is marked superseded; specs-history has the entry.

### Known cost
- Shared links minted before this change that omitted the `u=` param (rate was implied) now open in counts. Links that encoded `u=count` explicitly are unaffected.

## 2026-07-20 (later)

SEO gaps closed ([P2.13](../project/backlog.md)).

### Added
- **JSON-LD structured data.** New `src/lib/schema.ts` builders serialized via a `jsonLd` prop through `Site`/`Base`: `WebSite` + `Dataset` on the Overview, `Dataset` on About (licence, temporal/spatial coverage, `dateModified` from the import date), and a `BreadcrumbList` on each of the 158 neighbourhood pages.
- **Static nearby-neighbourhood links.** Each neighbourhood page now server-renders a "Nearby:" link row (the 8 geographically-nearest pages, already computed for the neighbours table) — the 158 pages interlink without JavaScript instead of relying on the client-rendered table.
- **Sitemap `<lastmod>`, auto-maintained.** `scripts/update_sitemap_lastmod.mjs` runs at the end of every `npm run build`: it hashes each built page (normalising the build-volatile "site built" date), keeps a committed manifest at `data/sitemap-lastmod.json`, and stamps `<lastmod>` only for pages whose HTML actually changed — verified stable across back-to-back rebuilds. Commit the manifest when it changes; it is the cross-build memory.
- **Invariant tests for all three.** `tests/site-invariants.test.ts` now asserts the JSON-LD nodes parse and carry the right types per surface, every neighbourhood page has ≥4 valid nearby links (never itself), every sitemap entry has an ISO `lastmod`, and the manifest agrees with the sitemap.

## 2026-07-20

Post-v2 full QA sweep + new test suites ([P2.12](../project/backlog.md)).

### Added
- **Client fetch-layer tests.** `src/lib/fetchJson.test.ts` covers the shared island JSON loader: per-URL request dedupe, non-2xx rejection, and eviction-on-failure so a transient error doesn't poison the cache.
- **Aggregate-loader tests.** `src/lib/aggregates.test.ts` exercises the server-side loader against the built aggregates: partial-point filtering, category/year reshaping, neighbourhood lookups, `calendarGrid` zero-fill plus a monthly≡yearly count reconciliation, and `nearestNeighbourIds` behavior.
- **Built-site invariants.** `tests/site-invariants.test.ts` checks the HTML in `dist/`: every public surface and all 158 neighbourhood pages emitted, dev routes absent, canonical/OG metadata present and resolving to shipped files, and the sitemap covering exactly the public routes.

### Fixed
- **Mobile overflow on the neighbourhood index.** The `<h1>` ("Toronto neighbourhoods.") used a fixed 56px size; the single unbreakable word forced ~70px of page-level horizontal scroll at 375px. Now `clamp(34px, 9vw, 56px)`, matching the house pattern.
- **Mobile overflow on About.** `.dl-grid`'s fixed `200px 1fr` columns left ~77px for values at 375px, overflowing the page by ~27px. The grid collapses to a single column at the mobile breakpoint.

## 2026-07-17

Full-site review fixes ([P2.11](../project/backlog.md)).

### Added
- **Explicit city/neighbourhood coverage metadata.** Aggregate schema v2 reports resolved and unresolved-neighbourhood incidents overall, by year, and by category; the build enforces `city = neighbourhoods + unresolved`, and About discloses the 5,960-record (1.572%) coverage gap ([ADR-008](../project/decisions/008-city-totals-include-neighbourhood-unresolved-incidents.md)).
- **Failure-safety and schema regression tests.** Import fixtures prove invalid downloads leave the canonical TPS/population files untouched, while aggregate tests now validate every category, every neighbourhood, every year, and the coverage reconciliation.
- **Documented population-import dependency.** `requirements.txt` declares `openpyxl`, and the README/deploy setup now installs it before a population refresh.

### Changed
- **Toronto totals include all valid source records.** Records with a supported category and date now contribute citywide even when their neighbourhood cannot be resolved; neighbourhood charts, feeds, calendars, and maps remain resolved-only.
- **Neighbourhood page controls now describe and control the real scope.** Category and year selections propagate through seasonality, context, readout, and map sections; the calendar exposes table semantics to assistive technology.
- **Privacy and product copy made precise.** Removed the absolute “No tracking” claim, corrected the bundled font names, and reconciled Compare's documented capacity to its actual two-to-four-neighbourhood behavior.

### Fixed
- **Imports can no longer corrupt the canonical archive on validation failure.** TPS and population outputs are fully staged and validated before existing files are replaced.
- **Misleading small-base deltas.** Index, map, and Compare views show the underlying count change instead of a confident percentage when the baseline is zero or too small.
- **Mobile Compare controls and keyboard access.** Rate/count is visible on narrow screens; index sorting uses real buttons and neighbourhood navigation uses real links instead of mouse-only table-row behavior.

## 2026-07-16 (later)

### Fixed
- **Production canonicals pointed at the placeholder host (P1.11).** The live
  site at `https://crimepulse.ca` was serving `canonical`, `og:url`,
  `og:image`, `twitter:image`, sitemap `<loc>`, and `robots.txt` `Sitemap:`
  URLs on `https://crime-pulse.pages.dev` — a host that doesn't even resolve
  (NXDOMAIN). The `SITE_URL` default in
  [`astro.config.mjs`](../astro.config.mjs) is now the real production
  domain; `SITE_URL` remains an override for staging builds.
  [`docs/deploy.md`](deploy.md) updated to match.

## 2026-07-16

Pre-redeploy QA sweep: first automated test suites, a scripted browser QA pass, and Workers-deploy fixes (backlog P2.10).

### Added
- **Automated tests — `npm test`.** Vitest unit suites for `src/lib` ([`format`](../src/lib/format.test.ts), [`sparkline`](../src/lib/sparkline.test.ts), [`state`](../src/lib/state.test.ts), [`urlState`](../src/lib/urlState.test.ts), [`aggregateTypes`](../src/lib/aggregateTypes.test.ts)) plus [`tests/data-invariants.test.ts`](../tests/data-invariants.test.ts), which checks the **built** aggregates against the ADR-004 contract (schema version, 158 neighbourhoods, 2016–2025 axis, neighbourhood sums ≡ city-wide counts, rate ≈ count/pop×10K, 200 KB gzip budget). 88 tests.
- **Python pipeline tests** under [`scripts/tests/`](../scripts/tests/) (`python3 -m unittest discover -s scripts/tests`, also `npm run test:py`) — `_md_table` escape-aware parsing, `import_tps_csi` normalization/dedupe helpers, `build_aggregates` helpers including `build_toronto_by_year` on a synthetic corpus. Stdlib-only, green on Python 3.9. 73 tests.

### Changed
- **Data refresh run (no new upstream data).** Re-imported TPS CSI, population, and StatCan CSI on 2026-07-16: all three byte-identical to the committed corpus (TPS still 379,184 rows through 2026-03-31 — Q2 2026 not yet published; StatCan CSI still ends at 2024; CSD population release still 2026-01-14). Only the `imported_at`/`fetched_at` stamps advanced.

### Fixed
- **Mobile hero overflow in count mode.** With `u=count`, the Overview bigstat ("39,371" + "INCIDENTS · 2025" on one flex row) forced the hero column to ~419px on a 375px viewport — the whole page scrolled horizontally. `.bigstat-num` now wraps the unit label under the number when it doesn't fit ([`base.css`](../src/styles/base.css)). Found by the scripted QA sweep; not visible in rate mode.
- **Branded 404 on the Workers static-assets deploy.** [`wrangler.jsonc`](../wrangler.jsonc) now sets `assets.not_found_handling: "404-page"` — Workers assets defaults to a bodyless 404 (unlike Pages, which auto-serves `404.html`). Verified via `wrangler dev`: branded 404 with status 404, `_headers` CSP/cache rules applied.

## 2026-07-09

Data refresh check + build-time network dependency removed.

### Changed
- **Data refresh run (no new TPS data).** Re-imported the TPS CSI source; the corpus is byte-identical to the 2026-06-14 import (still 379,184 rows, data through 2026-03-31 — TPS hasn't published Q2 yet), so only `imported_at` in `tps-csi-validation.json` advanced. Population re-import likewise unchanged (StatCan CSD release 2026-01-14).
- **Boundary GeoJSON vendored** at [`data/geo/neighbourhoods-4326.geojson`](../data/geo/neighbourhoods-4326.geojson) — `build_aggregates.py`'s `--geojson-cache` default moved there from the gitignored `.astro/`, so a Cloudflare Pages build no longer fetches the Toronto CKAN endpoint (a down endpoint can no longer fail a deploy). `--refresh-geojson` re-downloads; [`docs/deploy.md`](deploy.md), [`docs/data-sources.md`](data-sources.md), and the README file map updated to match.

### Fixed
- **Deploy would have failed on Node 20.** `astro@6` hard-exits below Node 22.12, but the repo pinned nothing and [`docs/deploy.md`](deploy.md) instructed `NODE_VERSION=20`. Added `.nvmrc` (`22`) + a `package.json` `engines` field and corrected the runbook. (Found in the 2026-07-09 pre-prod sweep; local builds masked it because the dev machine runs Node 26.)
- **OG images depended on the build container's locale** — `toLocaleString()` in `build_og_images.mjs` now pins `en-CA`; `import_csi.py`'s validation now records `years_present` (2015–2024) alongside the `year_window` filter bound so the metadata can't overstate coverage.
- **Wrong Ontario values on the CSI card.** `data/csi/csi-by-geography.md` was generated *before* the 2026-06-10 geography-disambiguation fix in `import_csi.py` and never re-imported — the committed Ontario series carried bare-substring mismatches (e.g. 2024 CSI total 107.70 rendered where the real provincial value is 60.69; violent 206.31 vs 81.28). Re-imported from StatCan 35-10-0026-01; all ten Ontario rows corrected, every other geography unchanged. No new StatCan year yet (series still ends at 2024).
- **`import_csi.py` crash** writing its validation file — `geographies_kept` unpacked the 3-tuple `WANTED` entries as pairs (`ValueError: too many values to unpack`), so the importer died *after* writing the data file but *before* the validation JSON.
- **`docs/deploy.md` drift** — it still claimed `CF_PAGES_URL` is used as a `SITE_URL` fallback; that fallback was deliberately removed 2026-06-10 (per-deploy hash subdomains would bake a different "canonical" host into every deploy).

## 2026-06-10

Full code + content review follow-ups. P0/P1 findings landed first; this entry covers the P2 batch (backlog P2.1–P2.9).

### Added
- **`public/_headers`** — CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`, and long-lived cache headers for `/_astro` + fonts.
- **Self-hosted fonts** via `@fontsource/ibm-plex-sans` + `-mono` (no more render-blocking request to Google Fonts, which contradicted the "No tracking" promise).
- **Shared client-safe aggregate schema** ([`src/lib/aggregateTypes.ts`](../src/lib/aggregateTypes.ts)) with runtime `schema_version`/year-axis validation; [`src/lib/fetchJson.ts`](../src/lib/fetchJson.ts) (response-ok check + promise cache) shared by the data islands.
- **Dev-routes indicator** — a dev-only topbar pill linking to `/project` + `/styleguide` (the previously-dead `INCLUDE_DEV_ROUTES` flag is now wired via `process.env`; the flaky Vite `define` was removed).
- **`npm run check`** (`astro check`); per-page meta descriptions; `og:image:width/height/alt`, `twitter:image:alt`, `og:locale`; a `<noscript>` fallback on `/compare/`; `noindex` on the 404.

### Changed
- **Filter state moved from the URL hash to the query string**, so in-page anchors (skip link, About TOC) and shareable filters coexist; history traversal restores each entry's full state.
- **Freshness display** reads the data's max report date + import date (from `tps-csi-validation.json`), not the aggregate build time; the topbar pill now reads "DATA THROUGH".
- **Hydration** — below-the-fold islands switched to `client:visible`; the Leaflet maps stay `client:only` (they share a `mapHover` signal that separate hydration bundles would break).
- **Year labels derive from the data** (`$Y` placeholder, computed auto-theft peak year, etc.) instead of hard-coded `2025`/`2024`/`'16`–`'25`.
- **Disclosures** — the ADR-007 25%-sample basis and the ADR-002 frozen-2021 denominator are now surfaced on About + the neighbourhood pages; the Overview caveat names the correct (city-wide CSD) denominator.
- **Accessibility** — map `role="region"`, `--ink-4` raised to clear WCAG AA, FilterBar unit toggle gets `aria-pressed`, footer headings demoted to `<h2>`.
- **Version string** now sourced from `package.json` (`1.0.0-rc`); governance docs (charter, roadmap, metrics, AGENTS, overview, ai/*) reconciled to the built Cloudflare-Pages reality (no Chart.js, Toronto not GTA, 2016–2026 window).

### Fixed
- **`by-neighbourhood-month.json`** now written compact (248KB→169KB gzip, under the 200KB budget); a budget breach now fails the build (exit 5) instead of warning (backlog P1.12).
- **Garbled "Theft Over $5,000"** headings — `PrimaryCatText` now does a single-pass replace.
- **Per-neighbourhood page weight** — the incident feed is fetched at hydration instead of inlined as ~2MB of island props (HTML 2.27MB→~128KB).
- **Phantom YTD point** when the 2026 file is absent; **stuck-forever loading** in Compare/MapSidebar on fetch failure; map hover panel reads the selected year (was always 2025); selected-polygon outline (invalid `var()` in an SVG attribute); feed column mislabel.
- **Pipeline hardening** — `import_tps_csi.py` fails on missing columns / empty full years; shared `scripts/_md_table.py`; `import_csi.py` raises on conflicts; OG title clamping for long names.
- Flat/zero-baseline deltas no longer render a confident "▼ 0.0%"; `TrendChart` gradient ids are per-instance.

## 2026-05-29

### Added
- **Type-ahead neighbourhood picker** ([`NeighbourhoodPicker`](../src/components/islands/NeighbourhoodPicker.tsx)) on the Overview hero and atop `/neighbourhood/`: diacritic-folded token-AND substring match, keyboard nav, jumps to the detail page.
- **Shareable URL state** ([`urlState.ts`](../src/lib/urlState.ts) + [`UrlSync`](../src/components/islands/UrlSync.tsx)) — `unit`, `primaryCat`, `activeCats`, `yearRange`, `includeYTD`, and Compare picks sync to the URL hash; a URL wins over localStorage on load. FilterBar grows a "Copy link" button.
- **Per-page OG images** — build-time 1200×630 PNGs ([`scripts/build_og_images.mjs`](../scripts/build_og_images.mjs), Resvg + bundled IBM Plex TTFs under `scripts/fonts/`), one per neighbourhood + default, plus `og:*` / `twitter:*` / `canonical` meta in [`Base.astro`](../src/layouts/Base.astro).
- **Compare "vs Toronto (rate)" column** and a 4th comparison slot.
- **SEO + chrome** — `public/robots.txt`, `@astrojs/sitemap` (`sitemap-index.xml`, 163 URLs), `public/favicon.svg` (the pulse mark) with `theme-color`, and a branded [`404.astro`](../src/pages/404.astro).
- **[`docs/deploy.md`](deploy.md)** — Cloudflare Pages setup, env vars, build-time deps, refresh + smoke checks.

### Changed
- **Cadence copy** across Overview hero, footer, and About § 05 now reads "Updated periodically — no fixed schedule" with a dated `generated_at` stamp.
- **Mobile pass** — 700px breakpoint for hero, FilterBar, Compare pickers, and horizontally-scrolling tables.
- **Self-hosted Leaflet CSS** (`public/leaflet-1.9.4.css`) instead of the unpkg CDN — removes a third-party point of failure and stops leaking visitor IPs.
- **README "Refresh pipeline"** rewritten to "periodically, no fixed schedule," matching the UI; backlog **P1.9** reframed from "blocks public release" to deferred post-v1.

### Fixed
- **Compare** dropped the 2026 partial-year row before reading the "latest year" (was surfacing 2026 partial counts and a meaningless `null`-rate "vs Toronto" delta); the comparison column is now always rate-based regardless of the unit toggle.

### Removed
- **Weekly rebuild GitHub Action** (`.github/workflows/rebuild.yml`) — v1 ships with no automated cadence; refresh is manual. Re-automation deferred to backlog P1.9.

## 2026-05-27

- **P1.4d parked — data not available at the requested granularity.** Verified directly against StatCan table 35-10-0177-01 ZIP: `Toronto, Ontario [35535]` appears only at **CMA** granularity. Vaughan, Markham, Brampton, Mississauga, Richmond Hill, and Oakville have **no individual entries** in this table; the Toronto CMA already includes them as one bucket. Cross-checked against table 35-10-0184-01 (also CMA-only). StatCan does not publish per-CSD crime statistics for those smaller GTA municipalities through any open table currently audited. The same source-quality blockers documented in the Vaughan parking-lot entry above (YRP coverage, license, no data dictionary) apply equally to direct municipal-police sources for Markham / Mississauga / Brampton / etc. Alternative framing left for user input: pivot the card to Toronto **CMA vs other Canadian CMAs** (Montréal, Vancouver, Calgary, Ottawa) — buildable today from the same table but a national-context framing, not the GTA-context framing the original ask requested.
- **"Theft Over" → "Theft Over $5,000"** — the styleguide-era short label was ambiguous; the Criminal Code threshold is what makes this a distinct TPS CSI category (vs Theft Under $5,000). Updated [`categories.ts`](../src/lib/categories.ts) `name` and the About page's category list to match. shortCode `TOV` unchanged.
- **Year-range picker wired (P1.8b, MVP)** — FilterBar's static `2016 ████ 2025` decoration replaced with two real `<select>` dropdowns (start → end) backed by a new `yearRange = signal<[number, number]>` in `src/lib/state.ts`. Persisted to localStorage. `setYearRange()` clamps to YEARS_MIN/YEAR_MAX and enforces a minimum 2-year window so YoY arrows always have a prior year. Choropleth shading + polygon YoY arrows on TorontoMap use the range's end year. NeighbourhoodIndex's "current value" / sparkline / YoY column / column label all flex to the selected range. **Deferred**: a sleeker custom two-handle SVG slider visual (functional today via native selects; visual polish is a separate batch); extending year-range clipping into every trend chart, sparkline, calendar heatmap, and SR-only summary (cross-cuts every chart, also batched separately).
- **2026 YTD imported + toggle wired (P1.8c, MVP)** — `scripts/import_tps_csi.py` now defaults to pulling 2016-2026 (the `YEARS` tuple was extended); 2026 is YTD. Aggregator emits 2026 entries with `partial: true` and `rate_per_10k: null` on `toronto-by-year.json` + `by-neighbourhood-year.json`, plus a `partial_years: [2026]` top-level field. `src/lib/aggregates.ts` learned `filterPartial()`, `torontoPartialSeries()`, `partialYears()`. Default loaders strip partials so existing islands keep 2016-2025 framing; charts that don't opt in are unaffected. New `OverviewYTDFootnote` island appears under the Overview bigstat when the FilterBar's "+ Include 2026 YTD" chip is on, showing "2026 YTD: N {primaryCat} incidents · rate not computed". Toronto-wide 2026 YTD assault: 5,254. **Deferred to follow-up**: extending the actual chart x-axis to include 2026 (a dashed end segment for partial). Currently charts only re-render when partial is in their data; that wider data-flow change is left for a separate batch since it cross-cuts every trend chart.
- **Multi-cat compounding wired (P1.8a, MVP)** — FilterBar's category chips no longer toggle a no-op signal: choropleth shading, polygon YoY arrows, MapSidebar legend + "highest" list, NeighbourhoodIndex current-value/arrow/sparkline/label, and NeighbourhoodFeed all react to `activeCats`. Sum-across-active-cats is the compound value; hue stays keyed to `primaryCat` so the user still controls colour. When `cats.length > 1` the index page swaps the category label for `"N categories summed"` and shifts the column hue to the accent amber so it's visually unambiguous that the number is a sum. **Deferred to follow-up** (would have made this commit much bigger and is independent): OverviewTrend / NeighbourhoodTrend rendering one chart line per active cat (currently still single-line on primary); SmallMultiples fading non-active tiles. Both are visual-only enhancements over the working compounding underneath.
- **YoY arrows on map polygons (P1.8d)** — choropleth now overlays a small ▲ ▼ — at each of the 158 polygon centroids, coloured by year-over-year direction (warm = up, cool = down, ink-3 = stagnant within ±1%). Arrow respects the active category + unit + selected ID. Persistent toggle in the map section header lets the user hide them; defaults on. State persisted to localStorage alongside the other signals.
- **CSI card restored with real data (P1.4c)** — [`scripts/import_csi.py`](../scripts/import_csi.py) pulls StatCan table 35-10-0026-01 (Crime Severity Index and weighted clearance rates), filtered to Toronto / Canada / Ontario / Montréal / Vancouver / Calgary at CMA + provincial + national level. Lands `data/csi/csi-by-geography.md` (60 rows × 3 indices: total / violent / non-violent) + `validation.json`. [`build_aggregates.py`](../scripts/build_aggregates.py) emits `public/data/aggregates/csi-context.json` (1.3KB gz). New [`src/components/CSICard.astro`](../src/components/CSICard.astro) reads it via `csiContext()` and re-renders on Overview — bars sorted by CSI ascending, Toronto highlighted, year label tied to whatever the source most recently published (2024 at time of writing: Toronto CMA = 59.4, Canada = 77.9). Replaces the styleguide-era fabricated card removed 2026-05-26. License: StatCan Open Licence, commercial use permitted with attribution.
- **Automated weekly rebuild pipeline landed (P1.9, infra only)** — new [`.github/workflows/rebuild.yml`](../.github/workflows/rebuild.yml) runs every Monday at 11:00 UTC (06:00 ET): checkout → install Python + Node → `import_tps_csi.py` → `import_population.py` → `build_aggregates.py` → `npm ci` → `npm run build` → commit any refreshed Markdown under `data/` back to main (Cloudflare Pages auto-redeploys on push). `workflow_dispatch` enables ad-hoc runs. Local equivalent: `npm run refresh`. [`README.md`](../README.md) documents the pipeline. The "Updated regularly" copy on Overview / Site footer / About § 05 stays in pre-launch language until the workflow has been observed running successfully at least once — deliberate step on the human side per the original launch-gate framing.
- **"Updated weekly" claim removed from site copy** — the Overview hero eyebrow, the Site footer's "Data current as of" card, and the About page's § 05 Refresh cadence all previously promised a weekly rebuild on Mondays 06:00 ET. That rebuild pipeline isn't set up yet, so the copy was dishonest. Replaced with pre-launch language ("Manual · pre-launch", "An automated rebuild cadence will be set up before public release"). The live "LAST SYNC" / "data current as of" timestamps stay — they read the aggregate's real `generated_at`. Backlogged as [P1.9](../project/backlog.md) which **blocks public release**; restoring an honest cadence claim is the prerequisite for shipping.
- **GTA context card backlogged as [P1.4d](../project/backlog.md)** — surviving piece of the Vaughan ask. Import StatCan `35-10-0177-01` (annual police-reported crime by geography, Open Licence, commercial use permitted) and render a small Overview card with Toronto alongside Vaughan, Markham, Brampton, Mississauga, Richmond Hill, Oakville at city-wide annual rate per 100K. The asymmetry vs Toronto's 158-neighbourhood fidelity is carried as a visible caveat on the card itself.
- **Vaughan extension — parked.** Research landed in [`data-sources.md`](data-sources.md) § GTA expansion · Vaughan: YRP's incident-level FeatureServer only carries 2021+ (verified via REST query against the historical service — zero records pre-2021, despite aspirational service names like `Occurrence_2016_to_2019`), YRP's item-level terms **prohibit commercial use** (vs TPS's Open Government Licence which permits it), and YRP publishes no data dictionary. Community-level granularity (Woodbridge / Maple / Kleinburg / Concord) is doubly blocked: City of Vaughan publishes interactive viewers only, no open-data portal with downloadable boundaries; Census doesn't aggregate at community level either. Recommendation: stay on [ADR-001](../project/decisions/001-v1-scope-is-toronto-not-gta.md). The five TPS CSI categories *do* map cleanly to YRP's underlying 25-bucket schema (Assault, Auto Theft, Break and Enter, Robbery, Theft Over all present, all queryable), so if YRP later backfills to 2016 and drops the commercial-use prohibition the path B (Vaughan as one CSD-level polygon) or path D (separate `/region/vaughan/` section) reopen. Filed in the backlog parking lot.
- **Neighbourhood picker, YoY arrows, and unit-toggle fixes** — new index route at [`/neighbourhood/`](../src/pages/neighbourhood/index.astro) lists all 158 with sortable name / population / current value / year-over-year arrow / 10-year sparkline; client-side search by name. The Overview hero CTA, the topbar nav, and the Neighbourhood detail "Change neighbourhood" button now all point at the index (replacing the previous `/neighbourhood/73` hardcodes and the `window.prompt('1-158')` UX, which was wrong — the real IDs go up to 174). The Compare picker swapped `window.prompt` for native `<select>` dropdowns with all 158 names; can also remove a slot down to 2. The choropleth hover panel now shows a YoY ▲ ▼ — arrow alongside the value, and respects the rate/count unit. Headline templates in `PrimaryCatText` learned a `$U` placeholder that resolves to the active unit word, so the Overview and Neighbourhood section headers no longer hard-code the word "rate" when the user has flipped to count. The Overview's "Three signals" Assault card became an island so the headline + delta % rebuild on unit change. Backlogged P1.8a (multi-cat compounding), P1.8b (year-range slider), P1.8c (2026 YTD import + toggle), P1.8d (YoY arrows directly on map polygons).
- **Dev vs prod builds split** — `npm run build` (prod) emits the four public surfaces only; `npm run build:dev` and `npm run dev` set `INCLUDE_DEV_ROUTES=1`, which activates a small Astro integration in [`../astro.config.mjs`](../astro.config.mjs) that `injectRoute`s two extra pages: `/project` (live status header from the aggregates + raw markdown of backlog / changelog / charter / overview / data-sources / README + ADR index) and `/styleguide` (brand, OKLCH palette, type, glyphs, caveats, sparklines on real data). The dev pages live in [`../src/dev/`](../src/dev/), outside `src/pages/`, so there is no path for them to leak into a prod build. Verified: prod `dist/` has neither `project/` nor `styleguide/` (161 pages); dev `dist/` has both (163 pages).
- **Fake / example data removed** — deleted the entire [`../styleguide/`](../styleguide/) folder (React + Babel prototype, all fabricated counts/rates/feed entries, made-up 1-158 neighbourhood IDs that didn't match the real 158-area basis). The Astro app under [`../src/`](../src/) is now the only canonical UI. Also removed `src/components/CSICard.astro` and its call site in [`../src/pages/index.astro`](../src/pages/index.astro) — its `CSI_CONTEXT` array was mockup data from the styleguide rendering as if it were real StatCan 2024 release values. A real-CSI import is queued as [P1.4c](../project/backlog.md) so the Toronto-vs-Canada card can return with truthful numbers. Memory + [`../README.md`](../README.md) updated; historical references to the styleguide in earlier changelog entries and ADRs remain as a record.

## 2026-05-26

- **Screens, Leaflet map, and Preact islands landed (P1.7b, partial)** — four routes pre-render against the build-emitted aggregates: Overview at `/`, Compare at `/compare`, About at `/about`, and a dynamic `/neighbourhood/[id]` that generates one static page per neighbourhood for each of the 158 real neighbourhood IDs (these go up to 174 with gaps; the styleguide's 1-158 sequence was mockup-only). New shared chrome in [`../src/layouts/Site.astro`](../src/layouts/Site.astro); state-holding interactivity lives in Preact islands under [`../src/components/islands/`](../src/components/islands/) with shared chart primitives ported to Preact under [`../src/components/preact/`](../src/components/preact/). The temporary `src/data/*.ts` fixtures retired; real data flows through [`../src/lib/aggregates.ts`](../src/lib/aggregates.ts). `npm run build` emits 161 HTML pages cleanly in ~3s. Path resolution in the aggregate loader switched from `import.meta.url` → `process.cwd()` (the former lands inside `dist/.prerender/chunks/` during build). Interactivity (filter chips, unit toggle, map hover/click, neighbourhood typeahead, compare picker, calendar hover) is wired but not yet verified end-to-end — the subagent was killed mid-verify. Tracked as [P1.7b](../project/backlog.md).
- **Build-time aggregates emitted** — [`scripts/build_aggregates.py`](../scripts/build_aggregates.py) reads `data/crimes/` + `data/population/`, fetches the 158-neighbourhood GeoJSON from Open Data Toronto, and emits the five JSON files per [ADR-004](../project/decisions/004-build-emits-aggregated-json.md): toronto-by-year (970B gz), by-neighbourhood-year (66KB gz), by-neighbourhood-month (248KB gz — over the 200KB advisory, candidate for flat-array reshape in P1.7b), 158 per-neighbourhood incident feeds (largest 47KB gz), and the slimmed neighbourhoods GeoJSON (130KB gz, from 2.1MB upstream — property-pruned and coordinates rounded to 4 decimals ≈ 11m). Total 363,773 incidents reconciled across Toronto-wide and per-neighbourhood views (5,843 NSA-tagged rows excluded both sides; reconciliation delta exactly 0). `npm run build` wired to run the aggregator first, then `astro build`. `public/data/` is `.gitignore`'d as build output. Tracked as [P1.5](../project/backlog.md).
- **Population denominators imported** — [`scripts/import_population.py`](../scripts/import_population.py) fetches the 158-model XLSX from Open Data Toronto and the StatCan CSD ZIP, writes Markdown tables to [`../data/population/`](../data/population/) (158 neighbourhood rows + 10 annual rows), and validates against the revised contract. 158-sum = 2,761,290 vs Census 2,794,356 (-1.18%, within ±2% per [ADR-007](../project/decisions/007-per-neighbourhood-denominator-is-25pct-sample.md)); 2025 CSD = 3,271,830. The real 158-area neighbourhood IDs go up to 174 with gaps — `styleguide/data.jsx`'s fabricated 1-158 sequence is mockup-only and retires at P1.7b. Tracked as [P1.4b](../project/backlog.md).
- **Styleguide foundation ported to Astro** — ~2,400 LOC across 25 files under [`../src/`](../src/): full OKLCH token set + base styles ([`tokens.css`](../src/styles/tokens.css), [`base.css`](../src/styles/base.css)), five brand components, twelve shared components (CatGlyph/Sparkline/Delta/Caveat/Legend/FeedRow/CSICard rendered fully; TrendChart/SmallMultiples/HexCartogram/CalendarHeatmap/FilterBar rendered static — interactivity is P1.7b), and five typed data-fixture modules under [`../src/data/`](../src/data/) (marked `TEMPORARY FIXTURE — will be replaced with build-emitted JSON from P1.5`). `tsconfig.json` excludes `styleguide/` from the type-check sweep so the legacy React prototype doesn't noise up `astro check`. `npm run build` passes in ~370ms. Tracked as [P1.7a](../project/backlog.md). Flags for P1.7b: Caveat left border is hard-coded amber (kind-tinted borders would need a CSS extension); HexCartogram/FilterBar/CalendarHeatmap have no hover/select state yet; toronto.ts↔helpers.ts has ES-live-binding circularity that works but is worth watching if P1.5 pre-computes more aggressively.
- **P1.4b contract revised against real data** — first importer attempt hit two source realities the original contract didn't anticipate: the 158-model XLSX has no 100% population row (long-form 25% sample only), and the StatCan CSD series has a documented post-2021-Census rebasing dip at 2020→2021. Pinned the 25% sample basis as [ADR-007](../project/decisions/007-per-neighbourhood-denominator-is-25pct-sample.md), widened the neighbourhood tolerance to ±2%, replaced YoY monotonicity with a range check, and corrected the StatCan GEO label / filter approach in [`data-sources.md`](data-sources.md). Importer (P1.4b) resumed against the revised contract.
- **Population denominator sources researched** — [`data-sources.md`](data-sources.md) now documents both denominators to the same depth as the TPS source: per-neighbourhood from the City of Toronto `Neighbourhood Profiles 2021, 158-model` (XLSX-only — importer needs an XLSX reader and a transpose), and city-wide annual from StatCan table `17-10-0155-01` (CSD, not CMA — see [ADR-006](../project/decisions/006-city-wide-denominator-is-toronto-csd-not-cma.md)). The CMA call (~7.1M) would have understated the per-capita rate by more than half versus the CSD (~3.0M) the CSI numerator actually covers. ADR-002's "Toronto CMA" phrasing is superseded by reference; [`overview.md`](overview.md) and [`design-brief.md`](design-brief.md) updated. Tracked as [P1.4a](../project/backlog.md).
- **Astro skeleton stood up** — repo is no longer pre-build: `astro@6.3.8` scaffolded at the root with `output: 'static'`, dev server bound to `127.0.0.1:41690` (`strictPort` via Vite passthrough — Astro 6's top-level `server` block doesn't expose it). Design tokens copied from [`../styleguide/styles.css`](../styleguide/styles.css) into [`../src/styles/tokens.css`](../src/styles/tokens.css); base layout and hello-world hero use them. `npm install`, `npm run build`, and `npm run dev` all pass; `dist/index.html` is the deploy artefact for Cloudflare Pages. Tracked as [P1.2a](../project/backlog.md).
- **Data-source workflow codified** — added [`../ai/data.md`](../ai/data.md): research → ADR-if-needed → backlog split → import → verify → changelog. Indexed in [`../ai/README.md`](../ai/README.md). Backlog rewritten to match: P1.2 split into P1.2a (Astro skeleton) + P1.2b (first trend page); P1.4 split into P1.4a (research) + P1.4b (import). Fixed a stale "GitHub Pages" reference in [`../ai/testing.md`](../ai/testing.md) to point at the Cloudflare deployment per [ADR-005](../project/decisions/005-static-cloudflare-pages-only.md).
- **Deployment pinned to static Cloudflare Pages** — v1 ships as a static site on Cloudflare Pages (not GitHub Pages, not SSR). Recorded as [ADR-005](../project/decisions/005-static-cloudflare-pages-only.md); [`overview.md`](overview.md) updated.
- **v1 design landed** — imported the Claude Design handoff bundle into [`../styleguide/`](../styleguide/) as a runnable React + Babel prototype. Entry: [`../styleguide/Crime Pulse Toronto.html`](../styleguide/Crime%20Pulse%20Toronto.html). All four IA surfaces from [`design-brief.md`](design-brief.md) §5 are implemented (Overview, Neighbourhood, Compare, About) along with the component library, brand system, geographic + cartogram maps, and the four caveat variants. Data is fabricated and shaped to the real TPS signals; the Astro port will read live aggregates from [P1.5](../project/backlog.md). Tracked as [P1.6](../project/backlog.md).
- **Scope / framing** — repositioned v1 as Toronto Crime Pulse (was "GTA"), per [ADR-001](../project/decisions/001-v1-scope-is-toronto-not-gta.md). Updated user-visible copy in [`overview.md`](overview.md), [`../README.md`](../README.md), [`../AGENTS.md`](../AGENTS.md), and [`../project/charter.md`](../project/charter.md). Repo directory name unchanged.
- **Unit of measure** — default unit is now incidents per 10,000 residents, per [ADR-002](../project/decisions/002-present-rates-not-counts.md). Added population-denominator sourcing (City of Toronto Neighbourhood Profiles + StatsCan Toronto CMA estimates) to [`data-sources.md`](data-sources.md) and backlogged the import as P1.4.
- **Map** — replaced the planned dot/cluster map with a 158-neighbourhood choropleth, per [ADR-003](../project/decisions/003-choropleth-map-not-incident-dots.md). Reflected in `design-brief.md` §6 and §8.
- **Build pipeline** — inserted a build-time aggregation layer that emits pre-aggregated JSON from the Markdown archive, per [ADR-004](../project/decisions/004-build-emits-aggregated-json.md). Overview describes the two-stage flow; aggregation script backlogged as P1.5.
- **P1.3 (revised)** — rewrote [`design-brief.md`](design-brief.md) on top of ADRs 001–004: Toronto framing, rate-per-10,000 defaults, choropleth components, baseline-overlay required on trend charts, four standardised caveat callouts, sticky unit toggle on mobile, and Toronto-vs-Canada CSI context card on the Overview.
- **P1.1** — imported 10 complete years of Toronto Police Service Community Safety Indicators into yearly Markdown tables under [`../data/crimes/`](../data/crimes/) and recorded validation in [`tests/2026-05-26-tps-csi-import.md`](tests/2026-05-26-tps-csi-import.md).
- **Data sources** — documented the recommended 10-year Toronto-first data strategy and companion GTA/Statistics Canada sources in [`data-sources.md`](data-sources.md).
