# Toronto Crime Pulse Overview

## What it is

Toronto Crime Pulse is a static public-awareness dashboard for Toronto crime trends, focused on whether selected crime types and neighbourhoods are increasing or decreasing across 10 years of data. Numbers are reported by default as **raw incident counts**, with **incidents per 10,000 residents** one toggle away so per-capita risk stays comparable across neighbourhoods (see [`../project/decisions/009-default-unit-is-counts.md`](../project/decisions/009-default-unit-is-counts.md), superseding ADR-002's rate default).

## Who it's for

The audience is the general public: people who want to inspect neighbourhood-level crime patterns through charts, a chronological feed, and a map without needing raw data skills.

## How it works

V1 imports Toronto Police Service Community Safety Indicators data for 2016–2026 (2026 is year-to-date and excluded from comparable 10-year visuals) as the primary 10-year source. Build-time data lives as Markdown tables under `/data/crimes/`, and a build script aggregates them once into pre-aggregated JSON the dashboard reads at runtime (see [`../project/decisions/004-build-emits-aggregated-json.md`](../project/decisions/004-build-emits-aggregated-json.md)). Astro renders pages that load those JSON files for charts, the calendar heatmap, the chronological feed, and a Leaflet choropleth keyed to the 158-neighbourhood boundary (see [`../project/decisions/003-choropleth-map-not-incident-dots.md`](../project/decisions/003-choropleth-map-not-incident-dots.md)). Trend, year-over-year, and small-multiples charts are hand-rolled SVG rendered through Preact islands — there is no Chart.js dependency.

Toronto-wide totals include every imported CSI record with a valid report date and supported category, including records whose neighbourhood is missing or cannot be joined to the 158-neighbourhood model. Neighbourhood charts, feeds, calendars, and maps necessarily exclude those unresolved records. The aggregate records this coverage gap by year and category, validates that resolved plus unresolved counts equal the city total, and the public About page discloses the current unresolved share (see [`../project/decisions/008-city-totals-include-neighbourhood-unresolved-incidents.md`](../project/decisions/008-city-totals-include-neighbourhood-unresolved-incidents.md)).

Population denominators come from City of Toronto Neighbourhood Profiles (2021 Census, 158-neighbourhood basis) for per-neighbourhood rates, and from Statistics Canada City of Toronto Census Subdivision population estimates (table 17-10-0155-01) for the city-wide rate by year — see [`../project/decisions/006-city-wide-denominator-is-toronto-csd-not-cma.md`](../project/decisions/006-city-wide-denominator-is-toronto-csd-not-cma.md) for why CSD rather than CMA.

## How to use/run/build it

Use `npm run refresh` to stage TPS, population, CSI and CMA imports and generate a change review before replacing the accepted archive. After inspecting the report, `npm run refresh:apply -- <review.json>` accepts that specific, revalidated candidate; see [ADR-011](../project/decisions/011-review-staged-data-before-acceptance.md). The accepted TPS tables remain under `/data/crimes/`. `npm run refresh -- --from-data data` rehearses staging without network access.

A build-time aggregation script, `scripts/build_aggregates.py`, reads the Markdown archive and emits the JSON aggregates the dashboard consumes. `npm run build` runs the aggregator, then OG-image generation, then `astro build` into `dist/`. `npm run verify` also checks types and runs unit/data tests and responsive Chrome QA; see the [browser QA guide](../tests/browser/README.md). The web stack remains Astro in static-output mode for Cloudflare Pages, Leaflet, and SVG/Preact charts.

## Inspecting a view

Compare shows two to four neighbourhoods with patterned traces and numbered legends. The optional Toronto-wide chart baseline starts hidden for counts so neighbourhood trends remain readable, and shown for rates. The two unit modes remember separate baseline choices in the URL; Copy view includes them. The latest-year numeric comparison retains its labelled Toronto row.

Trend charts and small multiples offer a keyboard/touch `View chart data` disclosure with labelled tables of the actual displayed series and unit. Overview and neighbourhood tables follow their scope and year controls; Compare stays on its labelled ten-full-year window. Missing values remain distinct from zero, and incomplete YTD totals stay outside comparable full-year trends.

The neighbourhood calendar exposes individual counts through keyboard arrow navigation and touch, plus a monthly table. It always reports counts, including in rate mode; a sparse primary category retains its explicitly labelled all-five-category shading fallback. The neighbourhood index offers exact single-category and all-five-category controls; a custom combination can still be selected in the view rail.

## Scope

V1 is **Toronto only**, not the GTA (see [`../project/decisions/001-v1-scope-is-toronto-not-gta.md`](../project/decisions/001-v1-scope-is-toronto-not-gta.md)). The repo directory and internal identifiers may keep `crime-pulse`, but every user-visible surface refers to Toronto by name.

## Non-goals

Toronto Crime Pulse should not use YAML, real-time infrastructure, Supabase, or agent-heavy workflows before v1 proves the static dashboard. Peel, York, Durham, Halton, LLM news links, and database-backed search, queries, or alerts are parked until after the Toronto 10-year dashboard works. Incident-level dots on the map are out of scope (the source forbids exact-location presentation); sexual-assault data is out of scope (the source excludes it).
