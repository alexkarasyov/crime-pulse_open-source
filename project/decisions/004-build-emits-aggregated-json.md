# ADR-004 — Build emits pre-aggregated JSON; Markdown stays as archival source

**Status**: accepted · 2026-05-26

## Context

The repo currently stores 369,616 deduped TPS CSI incident rows across ten yearly Markdown files under [`../../data/crimes/`](../../data/crimes/). The original intent was that Astro would read these Markdown tables at build time and the resulting page would carry whatever it needs.

That works for archival, but it does not work for the design brief's interactive surfaces. The brief asks for:

- Cross-filtering by neighbourhood × category × year × month, on mobile, with a chart, a map, and a chronological feed coexisting.
- A choropleth (ADR-003) that needs per-neighbourhood aggregates at multiple time granularities.
- Compare-2-or-3-neighbourhoods (stretch goal) that needs cheap per-neighbourhood lookups.

Shipping the 370k-row dataset (even minified) to the client to support this client-side is not viable on mobile. Re-parsing Markdown at build time for every page variant is slow and produces no reusable artefact.

## Decision

The build pipeline parses the Markdown archive **once** and emits a small set of pre-aggregated JSON files that the Astro pages and client-side filter UI consume directly:

- `public/data/aggregates/toronto-by-year.json` — totals and rates by year × category, plus city-wide rate per 10,000.
- `public/data/aggregates/by-neighbourhood-year.json` — totals and rates by neighbourhood × year × category.
- `public/data/aggregates/by-neighbourhood-month.json` — same, monthly, for calendar heatmaps.
- `public/data/aggregates/neighbourhood-incidents/{neighbourhood-slug}.json` — per-neighbourhood incident feed (date, category, offence, premises_type, no coords), loaded only on Neighbourhood view.
- `public/data/geo/toronto-neighbourhoods-158.geojson` — official boundary file for the choropleth (ADR-003).

The Markdown files remain as the canonical archive and the source of truth for re-aggregation. They are not read at runtime.

A single build-time aggregation script lives at `scripts/build_aggregates.py` and is run by Astro's prebuild step.

## Consequences

+ Per-page payload becomes a handful of small JSON files instead of a 100MB+ Markdown corpus.
+ Cross-filter UI on mobile becomes feasible; choropleth and Compare view both stay snappy.
+ The aggregation step is the only place population denominators are applied (ADR-002), so rate logic lives in one file.
+ Markdown archive is still grep-able and human-readable for spot checks and journalism.
− Adds a build step and a second data-format layer. The next agent has to understand both.
− Aggregates can drift from Markdown if the aggregation script is bypassed; the test record under [`../../docs/tests/`](../../docs/tests/) needs an aggregate-verification companion.
− The per-neighbourhood incident feed file count is 158, which is fine on GitHub Pages but should be watched if it grows.

## When to revisit

When the aggregate JSON for any single page exceeds ~200KB compressed, OR when a second data source (e.g. Shootings & Firearm Discharges, per [`../../docs/data-sources.md`](../../docs/data-sources.md)) needs to join with TPS CSI in a way the flat aggregate shape cannot express cleanly.
