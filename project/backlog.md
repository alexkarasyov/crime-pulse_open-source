# Backlog · Phase 1

### P1.0 · Research 10-year crime data sources
**Status**: done
**What**: Identify official sources that can support Crime Pulse v1's 10-year trend target, and document which sources should be primary, companion, or parked.
**Why**: The dashboard needs a defensible data foundation before import scripts or charts are built.
**Done when**: `docs/data-sources.md` names the recommended v1 source, its coverage, import notes, and the limits of other GTA sources.

### P1.1 · Bulk-import TPS CSI data to Markdown
**Status**: done
**What**: Fetch Toronto Police Service Community Safety Indicators data, normalize date, neighbourhood, category, offence, and location fields, dedupe rows, and write Markdown tables under `/data/crimes/`.
**Why**: Crime Pulse needs real build-time crime data before the dashboard, filters, map, or charts can prove the v1 value.
**Done when**: `/data/crimes/` contains TPS Community Safety Indicators Markdown files covering 10 years, and a spot-check confirms date, neighbourhood, category, offence, location, deduplication, and year coverage.

### P1.2a · Astro skeleton on Cloudflare Pages
**Status**: done
**What**: Stand up the Astro project at the repo root with `output: 'static'`, wire the design tokens from [`../styleguide/styles.css`](../styleguide/styles.css) into a base layout, render a hello-world page that visibly uses them, configure the dev server to bind to `127.0.0.1:41690`, and confirm `npm run build` emits a deploy-ready `dist/`. No SSR adapter, no Workers, no Pages Functions (per [ADR-005](decisions/005-static-cloudflare-pages-only.md)).
**Why**: P1.7 ports the styleguide screens to Astro for real; standing up a Cloudflare-deployable skeleton first exercises the static-output assumption early instead of at the end, and gives every later UI piece a place to land.
**Done when**: `npm run build` produces `dist/`, `npm run dev` serves on `127.0.0.1:41690`, the served page uses the styleguide's OKLCH palette and IBM Plex pairing, and `.gitignore` excludes `node_modules`/`dist`/`.astro`.

### P1.2b · First static trend page
**Status**: done (subsumed by P1.7b)
**What**: Originally a stepping-stone item for the first real trend page. The Overview screen ported under [P1.7b](#p17b--port-styleguide-screens-to-astro) renders the Toronto-wide 10-year trend against the P1.5 aggregates, which fulfils this item end-to-end.

### P1.3 · Author v1 design brief for Claude Design
**Status**: done
**What**: Write a designer-facing brief covering audience, tone, IA, components, responsive behaviour, accessibility, and out-of-scope items for the Toronto Crime Pulse v1 dashboard. Lands at `docs/design-brief.md`. Revised on 2026-05-26 to align with ADRs 001–004 (Toronto-only scope, rates not counts, choropleth not dots, JSON aggregates).
**Why**: Before P1.2 commits to a layout, an external designer needs a single source for the look and feel so the static build doesn't lock in an unconsidered visual direction.
**Done when**: `docs/design-brief.md` exists, references the TPS CSI data shape, the four v1 ADRs, and the v1 non-goals, and can be handed to a designer without further explanation.

### P1.4a · Research population denominator sources
**Status**: done
**What**: Document the City of Toronto Neighbourhood Profiles (2021 Census, 158-neighbourhood basis) for per-neighbourhood denominators and the Statistics Canada Toronto-area annual population source for the city-wide denominator. Lands as a Population section in [`../docs/data-sources.md`](../docs/data-sources.md) covering URL, license, coverage, refresh cadence, file format, columns we need, caveats, and planned import path. Follow [`../ai/data.md`](../ai/data.md).
**Why**: The research must land before the importer (P1.4b) so the choice of geography basis (158 vs 140), the choice between City of Toronto vs Toronto CMA for the city-wide denominator, and the refresh cadence are reviewed in the open before they are baked into code.
**Done when**: [`../docs/data-sources.md`](../docs/data-sources.md) has a Population section covering both sources to the same depth as the TPS section, and any load-bearing choice (e.g., City vs CMA) is captured as an ADR.

### P1.4b · Import population denominator files
**Status**: done
**What**: Write the importer under [`../scripts/`](../scripts/) that fetches the sources documented in P1.4a, writes them under `/data/population/` with a validation file, and emits the per-neighbourhood and per-year denominator files the P1.5 build will consume.
**Why**: P1.5 cannot build per-capita aggregates without these denominators; splitting from P1.4a means the research can land and be reviewed without import code blocking it.
**Done when**: `/data/population/` contains the per-neighbourhood and per-year denominator files, a validation JSON spot-checks coverage against the 158-neighbourhood basis, and a test record under [`../docs/tests/`](../docs/tests/) confirms the imported file matches a hand-counted spot check from the source.

### P1.4c · Import Statistics Canada Crime Severity Index for the Toronto-vs-Canada card
**Status**: done
**What**: Research and import StatCan table `35-10-0026-01` (Crime Severity Index) — the source the design brief names for the Overview's "Toronto in national context" card. Document in [`../docs/data-sources.md`](../docs/data-sources.md) per [`../ai/data.md`](../ai/data.md), write the importer under [`../scripts/`](../scripts/), land the file under `/data/csi/`, and re-introduce a `CSICard` component in the Overview reading from the build-emitted aggregate.
**Why**: The original `CSICard` was removed on 2026-05-27 because its values were verbatim from the styleguide's fabricated `CSI_CONTEXT` — Toronto CMA, Canada, Ontario, Montréal, Vancouver, Calgary — and they were rendering as if they were real StatCan 2024 release values. Real CSI data is small, public, annual; restoring the card with real numbers is a clean follow-up.
**Done when**: `/data/csi/` carries the imported series with a validation file; the Overview renders the Toronto-vs-Canada bars from the real series; a manual test record under [`../docs/tests/`](../docs/tests/) confirms the values match the StatCan publication.

### P1.4d · Import StatCan 35-10-0177-01 for metro context card
**Status**: done (2026-08-30) — shipped as CMA comparison per ADR-010, not per-suburb GTA
**What** (original): import StatCan table `35-10-0177-01` (Incident-based crime statistics) and render a card comparing Toronto to **Vaughan, Markham, Brampton, Mississauga, Richmond Hill, Oakville** at city-wide annual rate per 100K.
**Why parked**: 2026-05-27 verification — table 35-10-0177-01 lists `Toronto, Ontario [35535]` at **Census Metropolitan Area** granularity only. The Toronto CMA already includes Vaughan, Markham, Brampton, Mississauga, Richmond Hill, and Oakville as one bucket; the table does **not** break them out individually. The same applies to table 35-10-0184-01 (also CMA-only). StatCan does not publish per-CSD crime statistics for the smaller GTA municipalities through any open table currently audited.
**Re-research when**: a CSD-resolved StatCan table is found, OR direct municipal sources (Peel Regional Police for Mississauga/Brampton, York Regional Police for Vaughan/Markham/Richmond Hill, Halton Regional Police for Oakville) publish under terms compatible with TPS CSI's Open Government Licence. The York / Peel / Halton license + coverage audits from the Vaughan parking-lot entry above apply here too — same blockers, same path forward.
**Alternative framing to consider**: pivot the card to compare Toronto **CMA** to other Canadian **CMAs** (Hamilton, Ottawa-Gatineau, Montréal, Vancouver, Calgary, Edmonton) at the same per-category rate-per-100K granularity. This is decisively buildable from 35-10-0177-01 today, but it's a national-context framing rather than the GTA-context framing the original ask asked for. Decision punted to the user.
**Shipped as**: [`scripts/import_cma_rates.py`](../scripts/import_cma_rates.py) → `data/cma/` → `cma-context.json` → [`CmaCompareCard.astro`](../src/components/CmaCompareCard.astro) on Overview; About §04 caveat updated; [ADR-010](decisions/010-cma-context-card-not-gta-suburbs.md).

### P1.5 · Build-time aggregation from Markdown to JSON
**Status**: done
**What**: Implement `scripts/build_aggregates.py` to parse the Markdown archive once and emit the JSON files listed in ADR-004 (Toronto-by-year, by-neighbourhood-year, by-neighbourhood-month, per-neighbourhood incident feed) joined to the P1.4b population denominators. Wire it as Astro's prebuild step in P1.2b.
**Why**: ADR-004 commits the dashboard to reading pre-aggregated JSON; the interactive cross-filter UI the design brief requires is not feasible against the raw Markdown archive on mobile.
**Done when**: Running the aggregation script produces every JSON file enumerated in ADR-004 from `/data/crimes/` and `/data/population/`, total size under the ADR-004 watch budget, and a test record under `docs/tests/` confirms an aggregate matches a hand-counted spot check.

### P1.6 · Land v1 design as runnable styleguide
**Status**: done
**What**: Bring the Claude Design handoff bundle into the repo as a runnable React + Babel prototype under [`/styleguide/`](../styleguide/), with the four IA surfaces (Overview, Neighbourhood, Compare, About), the component library, brand system, geographic + cartogram maps, and the four caveat variants from [`docs/design-brief.md`](../docs/design-brief.md). Source materials (handoff README, design chat transcript, rendered screenshots) preserved under [`/styleguide/reference/`](../styleguide/reference/).
**Why**: The v1 visual contract needs to live in the repo before P1.2 starts building Astro pages, so the port has a single source of truth instead of re-deriving the design from the brief.
**Done when**: [`/styleguide/Crime Pulse Toronto.html`](../styleguide/Crime%20Pulse%20Toronto.html) loads cleanly off a local static server, all 11 JSX/CSS dependencies serve 200, and a [`/styleguide/README.md`](../styleguide/README.md) explains what's canonical and what's prototype-only.

### P1.7a · Port styleguide foundation to Astro
**Status**: done
**What**: Port the design-system foundation from [`../styleguide/`](../styleguide/) to the Astro app: the full [`styles.css`](../styleguide/styles.css) tokens (not the skeleton subset), all brand components ([`brand.jsx`](../styleguide/brand.jsx) → `src/components/brand/`), all shared components ([`components.jsx`](../styleguide/components.jsx) → `src/components/`), and the fabricated data ([`data.jsx`](../styleguide/data.jsx) → `src/data/`) as typed TypeScript fixtures. No screens yet — that's P1.7b. No interactivity yet — components render statically from props until the screens wire them up.
**Why**: Splitting the foundation from the screens keeps each unit reviewable and matches the data-side P1.4a/P1.4b split. The foundation has no dependency on the real data pipeline; it can land before P1.5 does.
**Done when**: `npm run build` passes, the hello-world index page demos BrandLockup + Caveat variants + CatGlyphs in the right colours, every component has a strict prop interface, and the fixtures cover Categories, Toronto totals, the 158 Neighbourhoods, feed, and helpers.

### P1.7b · Port styleguide screens to Astro
**Status**: done — interactivity verified in [`../docs/tests/2026-06-02-code-review-fixes-verification.md`](../docs/tests/2026-06-02-code-review-fixes-verification.md)
**What**: On top of P1.7a, port the four IA surfaces (Overview, Neighbourhood, Compare, About), the geographic Toronto map ([`toronto-map.jsx`](../styleguide/toronto-map.jsx)), and the screen-level interactivity (filter chips, category toggles, neighbourhood picker, calendar hover). Wire the screens to read **the P1.5 JSON aggregates**, not the P1.7a fixtures — the fixtures retire once this lands. Swap the Voronoi-tiled map for a Leaflet choropleth on real 2021 Census polygons ([ADR-003](decisions/003-choropleth-map-not-incident-dots.md)). Strip the tweaks panel.
**Why**: This is what turns the skeleton into the brief's full v1. Subsumes P1.2b — the Overview screen is the first trend page.
**Done when**: The Astro build serves the four surfaces with real data from P1.5, matches the styleguide's visual output on Overview and Neighbourhood at desktop and mobile widths, and a manual test record under [`../docs/tests/`](../docs/tests/) confirms the four caveat variants render in the correct spots.

### P1.8a · Wire activeCats multi-category filter
**Status**: done (MVP) · trend-multi-line deferred
**What**: The FilterBar chips currently toggle `activeCats` in [`../src/lib/state.ts`](../src/lib/state.ts) but no chart consumes the signal — so toggling them does nothing visible. Wire it: the choropleth sums across selected categories (single hue when one, qualitative when multiple); OverviewTrend renders one line per active category; the SmallMultiples grid hides cards that aren't active; the Neighbourhood feed filters incidents to only the active categories.
**Why**: Dead filters mislead users. The user explicitly said no buttons that do nothing.
**Done when**: Toggling any chip on the FilterBar changes the rendered output on Overview, Neighbourhood, and Compare; a manual test record under [`../docs/tests/`](../docs/tests/) confirms.

### P1.8b · Wire the year-range slider in the FilterBar
**Status**: done (MVP) · custom-slider-visual deferred · chart-clipping deferred
**What**: Replace the static `2016 ████ 2025` decoration in the FilterBar with a real two-handle range slider (Preact island), back it with a `yearRange` signal in [`../src/lib/state.ts`](../src/lib/state.ts), and make every chart and the choropleth clip to that range — TrendChart, Sparkline, OverviewTrend, OverviewSignal1, NeighbourhoodTrend, NeighbourhoodCalendar (column-wise), NeighbourhoodHero deltas, TorontoMap shading, and the SR-only data summaries.
**Why**: Dead filters mislead users. A 3-year window is genuinely useful for spotting recent inflections.
**Done when**: Dragging either handle updates every visible chart in real time; the persisted range survives navigation; a test record under [`../docs/tests/`](../docs/tests/) confirms.

### P1.8c · Import 2026 YTD data and wire the YTD toggle
**Status**: done (MVP) · chart-extension-on-YTD deferred
**What**: Update [`../scripts/import_tps_csi.py`](../scripts/import_tps_csi.py) so the 2026 YTD rows land alongside the 2016–2025 corpus; teach [`../scripts/build_aggregates.py`](../scripts/build_aggregates.py) to emit 2026 with a `partial: true` flag (and without joining a denominator); wire the `includeYTD` signal so islands optionally append the 2026 partial year — with the existing YTD caveat — when the user opts in.
**Why**: The "+ Include 2026 YTD" chip in the FilterBar currently toggles a signal but the aggregates don't carry 2026, so toggling does nothing. Either remove the chip or import the data. The user chose import.
**Done when**: With YTD off, every visual shows 2016–2025 as today; with YTD on, every visual extends to 2026 YTD with the caveat banner visible; partial-year is excluded from year-over-year delta calculations.

### P1.8d · Show YoY arrows directly on map polygons
**Status**: done
**What**: In addition to the YoY arrow that now appears in the choropleth hover panel (shipped in this batch), render small ▲ ▼ — overlays at each polygon's centroid on the geographic Toronto map. Optionally toggleable from a small "Show YoY arrows" control above the map. Arrows coloured by direction (up = warm, down = cool, flat = ink-3); size scaled to keep readable at low zoom.
**Why**: User-requested feature ("a map showing neighbourhoods with crime and an arrow up ⬆️ if crime increased of the last year ⬇️ arrow down if decreased ↔️ if stagnant"). At-a-glance reading of which neighbourhoods are getting worse vs better. All YoY data is already in the aggregates — no new sourcing needed.
**Done when**: The Overview choropleth and the Neighbourhood mini-map both optionally render a ▲ ▼ — glyph at each of the 158 polygon centroids; the existing hover/click behaviour is unchanged; a manual test record under [`../docs/tests/`](../docs/tests/) confirms readability at zoom levels 10–12.

### P1.9 · Wire automated update cadence + "Updated regularly / Last updated" banner
**Status**: deferred (post-v1) · **not a release blocker**

> **2026-05-29 decision:** v1 ships *without* an automated cadence. The maintainer
> can't commit to a regular delivery, so the previously-committed weekly GitHub
> Action (`.github/workflows/rebuild.yml`) was **removed**, and all user-facing
> copy now reads "Updated periodically — no fixed schedule" alongside a dated
> `generated_at` stamp — honest by construction, no forward-looking promise.
> Refresh is now a manual local chain (`npm run refresh && npm run build`, then
> push; Cloudflare redeploys). This item stays open as a *future* enhancement:
> stand up a real weekly cron, and only then restore a cadence promise in the UI.

**What**: Stand up an automated rebuild pipeline (cron / GitHub Action / Cloudflare deploy hook — TBD) that re-runs `python3 scripts/import_tps_csi.py` + `python3 scripts/import_population.py` + `python3 scripts/build_aggregates.py` + `astro build` on a published cadence (target: weekly; the brief originally specified Mondays 06:00 ET). Then restore the now-removed `Updated regularly · Source: TPS Community Safety Indicators` banner on the Overview hero, replace the "Manual · pre-launch" label on the About page's § 05 Refresh cadence card with the real automated schedule, and put the actual rebuild promise back into the Site footer's "Data current as of" card.

The "Last sync" timestamp / sync pill / "data current as of {date}" elements are already live and accurate (they read the aggregate's `generated_at`) — those stay. The work here is the FORWARD-LOOKING promise of cadence, which we won't make until it's real.
**Why**: User direction on 2026-05-27 — the dashboard cannot ship publicly with copy that promises a weekly rebuild while the rebuild isn't actually happening on a schedule. The current build replaces the dishonest "Updated weekly" copy with honest pre-launch language; this item restores the cadence claim once it's real.
**Done when**: A test build observes the aggregate timestamps changing on the configured cadence; the three pieces of copy across Overview hero / Site footer / About § 05 are flipped from "manual / pre-launch" to the real cadence with the schedule named; a test record under [`../docs/tests/`](../docs/tests/) confirms.

### P1.9a · Check official data sources weekly
**Status**: done (2026-09-12)
**What**: Set up a weekly Codex check attached to the owner's task, comparing official TPS, population, StatCan CSI, and CMA-rate sources with the local archive. Report new releases or substantive revisions and actionable check failures; suppress unchanged results and duplicate alerts. This monitors availability only; P1.9's automatic import/rebuild/deploy work remains deferred.
**Why**: The owner wants to know when new source data is available for the dashboard.
**Done when**: An active Monday 09:00 America/Los_Angeles schedule is confirmed with the source scope and read-only comparison instructions saved.
**Result**: Codex automation `crime-pulse-weekly-data-check` is active in the owner's task, every Monday at 09:00 Pacific. It compares source releases and substantive revisions with current importer/validation metadata, checks suspected changes in temporary storage, and suppresses duplicate findings. The computer must be on and the desktop app running for this local check.

### P1.10 · Create and connect the Cloudflare Pages project
**Status**: todo · **the publish step** · needs CF account access
**What**: Stand up the Cloudflare Pages project and point it at this repo so a push to `main` deploys. Build command `npm run build`, output directory `dist`, production branch `main`. Confirm the CF build image provides Python 3 (+ `openpyxl` if a refresh build ever re-imports the XLSX) and Node 20, and that outbound network is available for the build-time boundary-GeoJSON fetch in `build_aggregates.py`. Full runbook already written at [`../docs/deploy.md`](../docs/deploy.md).
**Why**: Everything else for v1 is done and committed; the site has never been deployed anywhere. This is the one genuine "go live" action and it can only be done by someone with the Cloudflare account — it isn't a code change.
**Done when**: A push to `main` triggers a green CF Pages build, the four surfaces + 158 neighbourhood pages serve from the deploy URL, and the post-deploy smoke checklist in [`../docs/deploy.md`](../docs/deploy.md) passes (map renders, `/favicon.svg` + `/robots.txt` + `/sitemap-index.xml` are 200, branded 404 on a bad path).

### P1.11 · Set the production SITE_URL
**Status**: done (2026-07-16) — the domain exists and the production site at `https://crimepulse.ca` was serving placeholder-host canonicals/OG/sitemap URLs. The committed default in [`../astro.config.mjs`](../astro.config.mjs) is now `https://crimepulse.ca` (still overridable via `SITE_URL` for staging builds), so the correct host is baked in with no dashboard env-var dependency. Verified in `dist/`: canonical, `og:url`, `og:image`, `twitter:image`, sitemap `<loc>`, and `robots.txt`'s `Sitemap:` line all on the production host. Note: `crime-pulse.pages.dev` is NXDOMAIN (no Pages project ever served publicly), so there is no duplicate-content host to redirect.
**What**: Set `SITE_URL` in the Cloudflare Pages production environment to the real canonical origin once a domain exists. Until then the build falls back to the `https://crime-pulse.pages.dev` placeholder baked into [`../astro.config.mjs`](../astro.config.mjs) (overridable via `SITE_URL` only — the `CF_PAGES_URL` fallback was removed 2026-06-10 because it is the per-deploy hash subdomain and was baking a different "canonical" host into every deploy). This value is what gets baked into every absolute `og:image`, `<link rel="canonical">`, and the sitemap `<loc>` entries.
**Why**: On a custom domain, leaving the placeholder means social-share cards, canonical tags, and the sitemap all point at the wrong host — bad for SEO and link unfurls. Deferred for now per 2026-05-29 decision: no real domain yet, and the pages.dev placeholder is fine for a first deploy.
**Done when**: `SITE_URL` is set to the final origin; a rebuild shows `og:image` / `canonical` / sitemap `<loc>` all on that host on both `/` and a `/neighbourhood/<id>` page.

### P1.12 · Bring `by-neighbourhood-month.json` under the 200 KB gzip budget
**Status**: done (2026-06-10) — switched the artifact to the compact JSON writer (3.1 MB raw / **169 KB gzipped**, under budget), and the build now **fails with exit 5** on any budget breach instead of printing a warning. Further shrink options (sparse encoding, build-only path outside `public/`) remain available if it ever regresses.
**What**: `scripts/build_aggregates.py` emits `public/data/aggregates/by-neighbourhood-month.json` at **8.9 MB raw / 248.3 KB gzipped** — the only artifact over the 200 KB `SIZE_BUDGET_BYTES` the build warns on ([ADR-004](decisions/004-build-emits-aggregated-json.md) watch budget). It stores a fully dense 158 nbhds × 5 cats × 10 years × 12 months grid, every cell emitted even when the count is 0. **It is consumed only at build time** — `calendarGrid()` / `byNbhdMonth()` in [`../src/lib/aggregates.ts`](../src/lib/aggregates.ts) read it off disk in `neighbourhood/[id].astro` frontmatter and bake the calendar cells into each static page; **no page fetches it client-side**. So today it ships into `dist/` as dead weight that nothing downloads. Options, cheapest first: (a) write it to a build-only path outside `public/` so it never ships (the static pages already carry the data); (b) sparse-encode it (omit zero-count cells) and/or split per-neighbourhood like the incident feeds; (c) a compact columnar layout.
**Why**: ADR-004 pins a 200 KB gzipped per-artifact budget; this is the lone breach, and it's a non-fatal build warning that's easy to ignore until it isn't. Surfaced during the 2026-06-01 code-review regression run.
**Done when**: the build's size report shows no `** OVER 200KB **` flag, the Neighbourhood calendar still renders all 12 × 10 cells per category, and `npm run build` stays green.

## Phase 2 · code-review follow-ups (filed 2026-06-10)

P0/P1 findings from the 2026-06-10 full code + content review were fixed on
`fix/review-p0-p1`. The remaining (P2) findings are filed below — none are
release blockers.

### P2.1 · Hydration strategy: stop eager-loading below-the-fold islands
**Status**: done (2026-06-10), with one carve-out
**What**: Moved the below-the-fold pure-Preact islands to `client:visible` — Overview (`CategoryGrid`, `CategoryPicker`, `MapArrowToggle`, `OverviewTrend`, `OverviewSignal1`), Neighbourhood detail (`NeighbourhoodTrend`, `NeighbourhoodCalendar`, `NeighbourhoodCatReadout`, `NeighboursTable`, `NeighbourhoodFeed`), and the `/neighbourhood/` index list. UrlSync/UnitToggle/FilterBar and the above-the-fold hero islands stay `client:load` (UrlSync must apply shared-link state early).
**Carve-out**: the Leaflet `TorontoMap` + `MapSidebar` stay `client:only` rather than lazy-mounting. Verified empirically that splitting them into separately-hydrated `client:visible` bundles gives each its own module-level `mapHover` signal instance, breaking the hover→sidebar-panel sync. A lazy-mount wrapper that keeps both in one bundle (so they continue to share the signal) is a viable future optimization to defer the GeoJSON/Leaflet fetch until the map scrolls into view; left as a follow-up to avoid regressing the hover behaviour.

### P2.2 · Derive year labels from data instead of hard-coding
**Status**: done (2026-06-10) — `PrimaryCatText` gained a `$Y` placeholder (map title now tracks the year-range end); `NeighbourhoodHero`, `SmallMultiples`, `CompareScreen`, the Overview hero/SR-summary, and the neighbourhood-page copy all derive years from the data/`YEARS` window; the auto-theft card computes its peak year (2023) and the causal claim was hedged to "coincides with"; the map description no longer hard-codes "rate".
**What**: Several labels hard-code 2025/2024/2016 and will silently rot on the next data year, and some already contradict the year-range filter: `NeighbourhoodHero.tsx` ("· 2025", "vs. 2024"), `CompareScreen.tsx` ("§ 03 · Numeric comparison · 2025"), `SmallMultiples.tsx` ("'16"/"'25"), `index.astro` map title template ("$ $U, 2025 · by neighbourhood" while the choropleth shades `yearRange[1]`), the map section description (hard-codes "rate" while shading follows the unit toggle), and `[id].astro` §03 ("sorted by 2025 …"). Also `index.astro`'s auto-theft card: "peaked mid-decade" is wrong (peak is 2023 — compute the year), and the causal claim ("insurer mandates, port enforcement, renewed inspections") is unsourced — hedge to "coincides with" or cite.
**Done when**: No user-visible year literal that the aggregates can supply; the map heading follows `yearRange`; the auto-theft card names the computed peak year.

### P2.3 · Accessibility pass
**Status**: done (2026-06-10) — map container `role="img"`→`role="region"` (+ note pointing to the keyboard-accessible neighbourhood index); `--ink-4` raised oklch(0.46→0.585) to clear AA; FilterBar unit control got `aria-pressed` + `role="group"`; footer headings `<h4>`→`<h2>` (styled down) to fix the outline skip.
**What**: (a) `role="img"` on the interactive Leaflet container hides zoom controls/links from assistive tech — use `role="region"` + label (both maps). (b) `--ink-4` (~3.2:1 on `--bg`) is used for real text (`.nav-num`, breadcrumb separator, map footnotes) while About promises WCAG AA — lighten to ~oklch(0.55) or reserve for decorative elements. (c) FilterBar's unit segmented control lacks `aria-pressed` (its twin `UnitToggle` has it — share one component). (d) Footer `<h4>`s skip heading levels on pages without h2/h3. (e) Map polygons navigate via `window.location.href` on click — no keyboard access, no ctrl-click/new-tab; document the neighbourhood index as the accessible alternative or add keyboard handling.
**Done when**: axe/VoiceOver spot-check passes on Overview + one neighbourhood page; AA contrast verified for all text-bearing tokens.

### P2.4 · URL-state hash: anchors clobber filters; back/forward doesn't reset
**Status**: done (2026-06-10) — filter state moved from the URL hash to the **query string**, so in-page anchors (skip link, About TOC) and shareable filters now coexist (verified: clicking an anchor preserves `?u=count&…` and appends `#main-content`). `hydrateFromUrl` resets unmentioned keys to defaults on `popstate` (history traversal) while still merging over localStorage on initial load. NOTE: shared-link format changed from `#…` to `?…`; no live links exist yet (P1.10 pending).
**What**: In `src/lib/urlState.ts`: (a) clicking any in-page anchor (skip link, About TOC) replaces a filter hash like `#u=count&y=2017-2024` with `#main-content`, silently dropping the shareable state; (b) `hydrateFromUrl` only applies keys present in the hash and never resets absent keys to defaults, so history traversal to a shorter hash leaves stale signal values. Fix: reset unmentioned known keys to defaults when the hash contains at least one known key, and preserve non-state fragments on write.
**Done when**: Skip-link click preserves filters; back/forward restores the exact filter state of each history entry.

### P2.5 · Data-pipeline hardening
**Status**: done (2026-06-10) — `import_tps_csi.py` asserts required source columns and fails on any full year writing 0 rows; the monthly aggregate's full-years-only exclusion is documented; shared `scripts/_md_table.py` now backs both `build_aggregates.py` and `import_population.py` (the weak `parts[6]` parser is gone); `import_csi.py` raises on conflicting (year, geography, stat) values; `build_og_images.mjs` clamps long titles; and the misc `build_aggregates.py` fixes (unused `year` param now asserts the report-date year, separate `rows_bad_date` counter, guarded 2025 headline print) are in. Build verified green, monthly artifact 169KB gz.
**What**: (a) `import_tps_csi.py` exits 0 on empty output — assert required CSV columns ⊆ `reader.fieldnames` after constructing the DictReader, and fail if any full year writes 0 rows. (b) `build_aggregates.py` silently drops 2026 YTD rows from the monthly aggregate (`build_by_neighbourhood_month` iterates only `YEARS`) — emit with a `partial` marker or document the exclusion. (c) `import_population.py` duplicates a weaker markdown-table parser (`collect_csi_neighbourhood_ids` splits on every `|`, hardcodes column 6) — extract `split_pipe_row`/`iter_markdown_rows` into a shared `scripts/_md_table.py`. (d) `import_csi.py` silently last-write-wins on conflicting (year, label) rows — raise or warn like `import_population.py` does. (e) `build_og_images.mjs` renders titles at font-size 84 with no clamping — long names ("St Lawrence-East Bayfront-The Islands") clip; step the size down past ~22 chars. (f) Misc: dead `year` param in `parse_csi_row` (or use it to assert `report_date` year consistency), mislabelled `rows_missing_nbhd` counter also counts bad dates, bare `StopIteration` risk in the 2025 headline print.
**Done when**: A simulated upstream column rename fails the import loudly; the OG image for the longest neighbourhood name fits the card.

### P2.6 · SEO/meta polish
**Status**: done (2026-06-10) — each page now passes a distinct `description` through `Site`; `/compare/` ships a server-rendered `<noscript>` fallback naming the default three picks with links; `Base.astro` emits `og:image:width`/`height`/`alt`, `twitter:image:alt`, and `og:locale`; the 404 emits `noindex` and skips the canonical.
**What**: (a) Five pages share one default meta description — pass per-page `description` through `Site` (it already forwards it). (b) `/compare/` is `client:only`, so crawlers/no-JS get only the h1 — statically render the default three-pick comparison and hydrate over it. (c) Add `og:image:width`/`og:image:height` (1200×630), `og:image:alt`, `og:locale` to `Base.astro`. (d) 404 page bakes a canonical + full OG block — use `noindex` instead.
**Done when**: Each page has a distinct description; `curl /compare/` shows real comparison content; the 404 has noindex.

### P2.7 · Shared client-side aggregate types + runtime validation
**Status**: done (2026-06-10) — new client-safe `src/lib/aggregateTypes.ts` holds the one definition of the fetched-JSON shapes plus `reshapeYearPoint`/`filterPartial`; `CompareScreen`, `TorontoMap`, and `MapSidebar` import it instead of hand-rolling three copies. `asByNeighbourhoodYear`/`asTorontoByYear` validate `schema_version` and the first/last year of a sample series at fetch time, so schema drift surfaces as a visible island error (caught by the P0/P1 error states) instead of silently misaligning the index-based x-axes.
**What**: `RawAgg`/`NbhdAgg`/`AggResp` are three hand-rolled copies of the same fetched-JSON schema (CompareScreen, TorontoMap, MapSidebar), each with its own partial-point filter, and all fetched JSON is blind-cast. Extract the types + `reshapeYearPoint`/`filterPartial` into a client-safe `src/lib/aggregateTypes.ts` (the server-only `aggregates.ts` imports `node:fs`), and add a cheap shape guard at fetch time (`schema_version`, first/last year of one series) so silent axis misalignment becomes a visible error. Index-as-year coupling in `TrendChart`/`CompareScreen`/`NeighbourhoodIndex` makes a series missing an interior year plot against wrong years — the guard covers this.
**Done when**: One schema definition; tampered JSON produces a rendered error, not a wrong chart.

### P2.8 · Dead code / config cleanup
**Status**: done (2026-06-10) — removed dead CSS (`.hex*` cartogram rules, `.eyebrow-accent`, `.compare-strip`, `.brand-glyph/-divider/-locality`, `[data-density]`); annotated genuinely-unused tokens (`--font-serif`, `--shadow-1`) as reserved (the spacing/radius scale entries and `--hot`/`--cool` are intentionally complete/reserved). Implemented the DEV-routes indicator (the `INCLUDE_DEV_ROUTES` Vite define is now live — a dev-only topbar pill links to `/project` + `/styleguide`). `tsconfig` no longer excludes the deleted `styleguide/`; added an `npm run check` script. Version string is now sourced from `package.json` (`1.0.0-rc`) in both the footer and About. Island fixes: `OverviewHero`/`OverviewSignal1` use `changeTrend` (no more confident "▼ 0.0%"), `TrendChart` uses `useId` for its gradient, `state.ts` yearRange hydration requires integers, `CategoryGrid`'s YoY chip uses `yoyTrend`, the YoY arrow colours are hoisted to `trendColor()` in format.ts, and the misleading TorontoMap effect-tracking comment is corrected.
**What**: (a) Unused CSS: `.hex`/`.hex-label` block (cartogram era), `.eyebrow-accent`, `.compare-strip`, `.brand-glyph`/`-divider`/`-locality`, `[data-density="compact"]`; unused tokens `--font-serif`, `--bg-soft`, `--hot`, `--cool`, `--s-9/--s-10`, `--r-4`, `--shadow-1`. (b) Dead Vite define `import.meta.env.INCLUDE_DEV_ROUTES` — implement the intended DEV nav indicator or delete. (c) `tsconfig.json` excludes a deleted `styleguide/` dir; add a `"check": "astro check"` npm script. (d) Version string: footer/About say "v1.0.0-rc", package.json says 0.0.1 — pick one source of truth. (e) Minor island fixes: OverviewHero/OverviewSignal1 render a confident "▼ 0.0%" on flat/zero-baseline (use `changeTrend`), TrendChart default `gradientId` collides when two instances share a page (use `useId`), `state.ts` yearRange hydration lacks `Number.isInteger` checks, CompareScreen `reshape(n.series[cat])` is unguarded for missing keys at 4 call sites, `yoyTrend` (1% flat band) vs `changeTrend` (no band) are both labelled "YoY" in different components, up/down arrow colours are duplicated as literals in ~6 places (hoist to shared constants), TorontoMap's effect comment claims signal reads are tracked in effects (they aren't — the deps array does the work).
**Done when**: `astro check` script exists and passes; no unused selectors/tokens; one version string.

### P2.9 · Docs/governance drift pass
**Status**: done (2026-06-10) — reconciled charter (Cloudflare not GitHub Pages, no Chart.js, "the ADRs"), roadmap + metrics (GTA→Toronto + ADR-001 ref), AGENTS.md (built app, not "planned"), ai/testing.md + ai/data.md (no Chart.js / weekly-cadence copy), docs/overview.md (2016–2026 window, hand-rolled SVG, built), with a new docs/specs-history.md 2026-06-10 entry; fixed deploy.md openpyxl misattribution, dated design-brief §3 counts, de-linked dead styleguide/ references in living docs, and fixed the changelog typo.
**What**: One editing pass over the stale governance docs (they lag the ADRs by ~2–3 weeks): (a) `project/charter.md` still says GitHub Pages + Chart.js and "ADRs 001–004" (contradicts ADR-005; Chart.js never shipped; seven ADRs exist). (b) `project/roadmap.md` + `project/metrics.md` still define success as "GTA" (contradicts ADR-001). (c) `AGENTS.md` self-contradicts ("planned … Chart.js", "There is no web build yet" vs "The Astro app … all exist now"); `ai/testing.md` (Chart.js) and `ai/data.md` ("weekly-update story" — cadence removed per P1.9) carry the same staleness. (d) `docs/overview.md` (declared source of truth) describes a planned Chart.js site importing from 2014 — actual window is 2016–2026 and the site is built; add the required `docs/specs-history.md` entry. (e) ~12 links to the deleted `styleguide/` in living docs (backlog items above, ADR-005) — de-link with a "(deleted 2026-05-27)" note. (f) `docs/deploy.md:69` misattributes openpyxl to build_aggregates.py. (g) `docs/design-brief.md` §3 numbers predate the NSA-row exclusion + 2026 import — add a one-line dating note. (h) Changelog/`[id].astro` typo "one static page per of the 158". Note: README's refresh section says timestamps reflect `generated_at` — already updated 2026-06-10 to describe the new data-through display; verify nothing else references the old SYNC behaviour.
**Done when**: grep for "GTA" in roadmap/metrics, "Chart.js" and "2014" repo-wide, and "styleguide/" in living docs all come back clean; specs-history has the entry.

### P2.10 · Automated test suites + pre-prod QA sweep (2026-07-16)
**Status**: done (2026-07-16)
**What**: First automated test coverage for the repo, plus a scripted browser QA sweep ahead of the production redeploy. (a) **Vitest** unit tests for `src/lib` — `format`, `sparkline`, `state` (localStorage hydration guards), `urlState` (share-link encode/decode, popstate reset), `aggregateTypes` (schema-drift guards) — plus `tests/data-invariants.test.ts`, which validates the **built** aggregates against the ADR-004 contract (schema version, 158 neighbourhoods, 2016–2025 axis, nbhd-sums ≡ city counts, rate≈count/pop×10K, per-artifact 200 KB gzip budget at compression level 9). (b) **Python `unittest`** suite under `scripts/tests/` for the pipeline (`_md_table`, `import_tps_csi` helpers, `build_aggregates` helpers incl. `build_toronto_by_year` on a synthetic corpus) — stdlib-only, runs on the system Python 3.9. Wired as `npm test` / `npm run test:py`. (c) Headless-Chrome QA sweep over the built site (36 checks: all four surfaces + neighbourhood detail + shared-link hydration + assets + 404 + mobile) — found and fixed the count-mode mobile hero overflow; recorded under `docs/tests/`.
**Why**: The repo had only manual test records; a redeploy-readiness pass needs repeatable checks, and the aggregates contract (ADR-004) had no enforcement outside the aggregator itself.
**Done when**: `npm test` runs both suites green; the sweep record lands in `docs/tests/`; regressions in the aggregate contract fail loudly in CI or locally.

### P2.11 · Fix full-site review findings (2026-07-17)
**Status**: done (2026-07-17)
**What**: Resolve the July full-site review findings across the data pipeline and public UI: make failed imports non-destructive; include neighbourhood-unresolved but otherwise valid incidents in Toronto-wide totals; enforce the complete aggregate schema; restore the mobile Compare unit control; apply the small-base guard to index/map/compare deltas; make neighbourhood page scope honest; repair table/calendar accessibility; remove the absolute “No tracking” claim; and reconcile stale setup/content copy. Add regression tests and record a responsive manual browser run.
**Why**: A public crime-data dashboard must not silently corrupt its source archive, misstate trend direction, hide core controls, or overstate its privacy and accessibility behavior.
**Done when**: Failed-import fixtures leave existing files untouched; Toronto totals include valid NSA/unresolved-neighbourhood incidents while neighbourhood aggregates remain resolved-only; automated checks and the production build pass; and browser verification confirms the fixed mobile control, guarded deltas, scoped neighbourhood sections, and keyboard-accessible index.
**Result**: Aggregate schema v2, failure-safe staged imports, complete runtime validation, scoped neighbourhood islands, guarded small-base deltas, responsive Compare controls, semantic index/calendar controls, corrected privacy/setup copy, 179 automated tests, and the recorded responsive browser run all pass. See [`../docs/tests/2026-07-17-full-review-fixes.md`](../docs/tests/2026-07-17-full-review-fixes.md) and [ADR-008](decisions/008-city-totals-include-neighbourhood-unresolved-incidents.md).

### P2.12 · Post-v2 full QA sweep + loader/site-invariant test suites (2026-07-20)
**Status**: done (2026-07-20)
**What**: Full QA pass over the site after the neighbourhood-v2 / ViewRail migration (which post-dated the P2.10 sweep): re-run all automated suites and `astro check`, rebuild, and run an expanded headless-Chrome sweep (94 checks) covering the ViewRail (unit toggle, scope chips, year window, Copy view, share-link hydration with short category codes), the calendar's table semantics and year-window slicing, the Compare slot model (3 defaults, add/remove/select), the index search/sort, both viewports, and the asset/404/dev-route checks from P2.10. Add three durable suites for the untested gaps: `src/lib/fetchJson.test.ts` (request dedupe + eviction-on-failure), `src/lib/aggregates.test.ts` (the 441-line build-time loader: reshaping, lookups, `calendarGrid` zero-fill and month≡year reconciliation, `nearestNeighbourIds`), and `tests/site-invariants.test.ts` (built HTML in `dist/`: all surfaces + 158 neighbourhood pages emitted, dev routes absent, canonical/OG metadata resolves, sitemap covers everything and only public routes).
**Why**: The v2 rail rework touched every data screen's control surface after the last recorded sweep; the client fetch layer, the server-side aggregate loader, and the built HTML had no automated coverage at all.
**Done when**: `npm test` green with the new suites; the browser sweep passes 94/94 on the fresh production build; any regressions found are fixed in the same batch; the run is recorded under `docs/tests/`.
**Result**: 227 automated tests green (150 Vitest + 77 unittest). Sweep found and fixed two mobile-only overflow regressions: the neighbourhood index `<h1>` (fixed 56px → clamp) and About's `.dl-grid` (fixed 200px label column → single column at the mobile breakpoint). See [`../docs/tests/2026-07-20-full-qa-sweep.md`](../docs/tests/2026-07-20-full-qa-sweep.md).

### P2.13 · SEO: structured data, static interlinking, sitemap lastmod (2026-07-20)
**Status**: done (2026-07-20)
**What**: Close the three gaps from the 2026-07-20 SEO audit (the on-page fundamentals — unique titles/descriptions, canonicals, OG/Twitter cards, h1s, sitemap/robots hygiene — were already in place). (a) JSON-LD: `WebSite`+`Dataset` (Overview), `Dataset` (About), `BreadcrumbList` (each neighbourhood page), built by `src/lib/schema.ts` and emitted through a new `jsonLd` layout prop. (b) Server-rendered "Nearby:" link rows on every neighbourhood page so the 158-page set interlinks statically (previously 0 no-JS links between neighbourhood pages; the neighbours table is a client island). (c) Sitemap `<lastmod>` stamped by a post-build script keyed to a committed content-hash manifest (`data/sitemap-lastmod.json`), so a page's lastmod advances only when its built HTML actually changes — wired into `npm run build`/`build:dev` as the standing rule.
**Why**: Dataset search eligibility, richer result display, a real crawlable link mesh across the neighbourhood pages, and honest recrawl signals after quarterly data refreshes.
**Done when**: JSON-LD validates and ships on the right surfaces; every neighbourhood page statically links its neighbours; back-to-back rebuilds leave lastmod untouched while content changes bump only the affected pages; invariant tests enforce all three.
**Result**: 233 automated tests green (156 Vitest + 77 unittest); 94/94 browser sweep; double-build verified 162/162 URLs unchanged on the no-op rebuild. See the changelog 2026-07-20 (later) entry.

### P2.14 · Default unit flipped to counts (ADR-009) (2026-07-21)
**Status**: done (2026-07-21)
**What**: Owner-directed reversal of ADR-002's default: raw incident counts are now the site-wide default unit, with rate per 10K one toggle away. `DEFAULT_UNIT` in `src/lib/state.ts` is the single switch; share links encode `u=` only for the non-default unit; persisted visitor prefs still win. Toggle button order puts Counts first (ViewRail + topbar). A new `UnitPhrase` island keeps the Overview hero eyebrow honest in both units, and the category-grid eyebrow now uses `$U`. All rate-default copy rewritten (About §02, Overview hero/methodology, footer, meta descriptions, Dataset schema, default OG-card subtitle) and governance docs reconciled (AGENTS.md, README, charter, overview.md + specs-history). ADR-002 marked superseded; caveat copy now carries the dense-neighbourhood warning ADR-002's default used to handle.
**Why**: Owner decision 2026-07-20 — counts are the unfiltered record and match general-public intuition; the comparability argument moves from the default setting into copy and affordance.
**Done when**: Fresh visit shows counts everywhere; `?u=rate` links hydrate rates; old `u=count` links still work; suites + sweep green; ADR-009 recorded and every doc that claimed rate-default rewritten.
**Result**: 233 automated tests green (156 Vitest + 77 unittest, expectations flipped), 95/95 browser sweep incl. a new counts-is-default check, `astro check` clean. Known cost, recorded in ADR-009: pre-flip shared links that omitted `u=` now open in counts.

### P2.15 · Social media image generator + card sets (retroactive; shipped 2026-07-16 / 2026-07-21)
**Status**: done (recorded retroactively 2026-08-07)
**What**: `scripts/build_social_images.mjs` renders shareable PNG cards (X, Facebook, LinkedIn, Instagram post/story, square) from the live aggregates into `social/`; two card sets shipped (launch set, "10 years by the numbers" set). Committed as rendered point-in-time assets alongside the generator.
**Why**: Launch/announcement assets with real numbers instead of hand-made graphics. Recorded retroactively — commits `59909dd` and `2eb6544` shipped without the backlog/changelog step AGENTS.md requires.
**Done when**: Generator runs from `node scripts/build_social_images.mjs`; PNGs render with real aggregate values.
**Result**: Shipped. 2026-08-07 audit hardened the generator: trend claims ("ten-year high", arrow direction, "more/fewer than ten years ago", signed YoY) are now computed from the data instead of baked into the copy. The committed PNGs are Q1-2026 snapshots; regenerate before re-sharing.

### P2.16 · Full repo audit & QA remediation (2026-08-07)
**Status**: done (2026-08-07)
**What**: Full audit (automated checks, three parallel review passes over frontend / data pipeline / repo hygiene, live headless-Chrome QA, independent data-integrity spot check) followed by fixes for every verified finding: two category-scope state bugs (CategoryGrid, NeighbourhoodIndex), popstate clean-URL reset in `urlState.ts`, ARIA 1.2 combobox pattern in NeighbourhoodPicker, GeoJSON cache-poisoning guard + exact feed reconciliation + year-staleness warnings in the pipeline, CSI importer geography-completeness check + atomic writes, sitemap-stamp verification, social/OG generator claim-hardening, ADR-009 copy drift on About, a de-hydrated static island, and doc corrections (deploy.md Node version / freshness claim / row count, `.nvmrc` 22.12).
**Why**: Pre-release quality gate requested by the owner before approving the commit.
**Done when**: All suites green, `astro check` clean, production build clean, browser sweep clean, and regression scenarios for the two state bugs pass against the built site.
**Result**: 249 automated tests green (158 Vitest + 91 unittest, 16 new), 163 pages built, browser sweep + targeted regression scenarios pass with zero console errors. See changelog 2026-08-07.

### P2.17 · Review code, update packages, and verify the public dashboard
**Status**: done (2026-09-12)
**What**: Review the frontend, data pipeline, and build tooling; update compatible project dependencies; fix verified regressions with focused coverage; run automated checks and responsive browser QA; and record prioritized improvement ideas.
**Why**: Keep the public dashboard reliable and maintainable as its dependencies and context features evolve.
**Done when**: Dependency changes are documented, automated checks and a production build pass, desktop/mobile public flows have a dated QA record, and remaining findings and improvement ideas are prioritized with evidence.
**Result**: Astro 7.3.2 / Preact integration 6.0.5 / Vitest 5 and compatible packages updated; npm audit reports zero known vulnerabilities (18 before). Corrected comparisons, shared/persisted state, invalid-date handling, stale context outputs, custom-origin structured data, and accessibility defects. `npm run verify` passes 270 tests and a 163-page production build; 35 final browser checks and 30 accessibility scans pass. See the [review and QA record](../docs/tests/2026-09-12-code-review-package-qa.md). Follow-ups are P2.18–P2.21.

### P2.18 · Make neighbourhood comparisons readable in counts mode
**Status**: done (2026-09-12)
**What**: Offer a Toronto-baseline toggle on Compare and avoid overlapping series end labels, while preserving raw counts as the default unit.
**Why**: The city total dominates the shared scale; the default neighbourhood trajectories differ by only a few pixels and their labels overlap.
**Done when**: The default three neighbourhoods have legible trends and labels at desktop and mobile widths; the Toronto baseline can still be inspected; counts and rates remain clearly labelled.
**Result**: Optional baselines, per-unit shared preferences, full numbered legends and patterned traces verified on desktop/mobile; chart and URL regression cases pass. See the [follow-up QA record](../docs/tests/2026-09-12-review-followups.md).

### P2.19 · Expose chart values for keyboard and touch users
**Status**: done (2026-09-12)
**What**: Add a data-table or value-inspection option that follows the active chart's unit, categories, and year range and can be operated with keyboard and touch.
**Why**: SVG labels and static screen-reader summaries do not expose every interactive view's values.
**Done when**: A visitor can inspect each selected year/category value without relying on hover or sight, and the displayed values reconcile with the current chart.
**Result**: Trend and small-multiple tables follow their actual series/unit/window; calendar cells expose keyboard/touch counts plus a monthly table. Expanded mobile tables remain bounded and keyboard-scrollable; numerical regression and browser checks pass.

### P2.20 · Preserve a repeatable responsive browser QA runner
**Status**: done (2026-09-12)
**What**: Turn the temporary browser sweep into a maintained repository runner for public routes, units, category/year controls, Compare slots, shared preferences, maps, overflow, and accessibility. Integrate it with the existing `npm run verify` release workflow without introducing YAML.
**Why**: Unit/build tests now have a single release command, but browser regressions still depend on session-only scripts.
**Done when**: A fresh checkout can run the documented browser suite against a fresh build and fail on a broken shared view, hidden core control, or responsive overflow.
**Result**: The maintained Chrome runner is part of npm run verify: 85 browser checks and 22 accessibility scans pass, alongside 302 unit/data tests and a 163-page production build. Includes source-value reconciliation, production headers, real map clicks and configured-width overflow checks. Setup documented in tests/browser/README.md.

### P2.21 · Summarize source changes before accepting a refresh
**Status**: done (2026-09-12)
**What**: Produce a refresh comparison of source dates, new/revised incident totals, unresolved-neighbourhood coverage, and monthly-to-annual reconciliation before replacing the accepted archive.
**Why**: The weekly monitor identifies available updates; the maintainer also needs an understandable record of what a proposed import changes.
**Done when**: An unchanged import reports no substantive differences; changed fixtures report exact count/coverage differences; monthly totals reconcile with yearly totals before the archive is accepted.
**Result**: Staged review, hash-checked acceptance and rollback implemented (ADR-011); 15 new pipeline tests pass. Full offline replay reports 389,614 rows unchanged, 6,094 unresolved unchanged, through 2026-06-30. Canonical sources were not replaced.

### P2.22 · Resolve the review's remaining index, payload and importer improvements
**Status**: done (2026-09-12)
**What**: Give the neighbourhood index exact single-category/all-category controls, measure cumulative initial page payloads in browser QA, and stream the large StatCan CSV filters. Include production-header compatibility fixes found by the maintained QA runner.
**Why**: The owner's follow-up requested all remaining review improvements as well as the four prioritized items.
**Done when**: Index totals reconcile with the selected scope, all representative pages fit a documented cumulative budget, streamed import fixtures pass, and the production build loads fonts without security-policy failures.
**Result**: Exact index scope controls reconcile with source totals; all five representative pages fit the 1 MiB cumulative budget (largest 490,996 gzip bytes). CSI/CMA imports stream CSV rows. Production font loading and narrow-screen About callouts verified with zero browser errors.

### P2.23 · Deploy the verified review release to production
**Status**: done (2026-09-12)
**What**: Publish the verified P2.17–P2.22 code/package release to the existing production Cloudflare target and confirm the live public flows, assets, metadata and response headers.
**Why**: The owner explicitly requested production deployment after local verification passed.
**Done when**: The new production version is identified, crimepulse.ca serves the reviewed features, and a dated production smoke-test record captures the result.
**Result**: Published verified assets to the existing crime-pulse production service on crimepulse.ca, version c130947c-f709-48f3-b289-feae4d0296c0 at 100% traffic. All 105 HTTP checks passed; desktop/mobile public flows and shared-link retests verified, with 22 clean accessibility scans. Domain mapping, source freshness and analytics state preserved. See the [production test record](../docs/tests/2026-09-12-production-deployment.md).


## Phase 3 · open source

### P3.0 · Publish a clean public snapshot of the dashboard
**Status**: done (2026-09-20)
**What**: Copy this app into a **new folder with a new git history**, add MIT `LICENSE` plus a short `NOTICE` for the open-data terms, rewrite `README.md` for clone-and-build, keep the crime Markdown as-is, keep `AGENTS.md`. Details: [`handoffs/2026-09-20-open-source.md`](handoffs/2026-09-20-open-source.md).
**Why**: The live site is public; the source is not reusable without a license.
**Done when**: A new repo folder exists (not a rewrite of this `.git`); `LICENSE` and `NOTICE` are in the first commit; `npm run build` works; this private repo is left alone.
**Result**: Public snapshot lives in this repository (`alexkarasyov/crime-pulse_open-source`). MIT `LICENSE`, data `NOTICE`, and a clone-and-build `README.md` are in the first commit. Crime Markdown is unchanged, including lat/lng. The private `alexkarasyov/crime-pulse` history and remotes were not rewritten.

## Parking lot

### Vaughan / York Regional Police extension — **parked**
Research landed 2026-05-27 in [`../docs/data-sources.md`](../docs/data-sources.md) § GTA expansion · Vaughan. Recommendation: **stay on [ADR-001](decisions/001-v1-scope-is-toronto-not-gta.md)**. Three independent blockers:
1. **Coverage: 4 years, not 10.** YRP's incident-level FeatureServer effectively starts 2021-01-01; ADR-001 requires 10 years.
2. **License: commercial-use prohibition.** YRP's item-level terms prohibit commercial use; TPS uses Open Government Licence – Toronto which permits it. Side-by-side rendering of a permissive and a non-permissive source is structurally awkward.
3. **No published data dictionary.** Category-to-CSI mapping is research inference, not YRP's assertion.

Plus, for the user's specific Woodbridge / Maple / Concord / Kleinburg ask: **community-level boundaries and community-level population are both unpublished** by the City of Vaughan or any provincial body. Even if YRP fixed (1)-(3), community granularity requires custom geography work with no upstream maintainer.

Re-research when: YRP publishes pre-2021 incident-level data covering at least 2016-onward **and** drops the commercial-use prohibition. Both are required; either alone is insufficient.
