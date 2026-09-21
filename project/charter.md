# Charter

## What

Toronto Crime Pulse is a static dashboard that turns Toronto crime data into public-facing trend views: graphs, a chronological feed, and a neighbourhood choropleth, filtered by area and crime type and reported by default as raw incident counts, with incidents per 10,000 residents one toggle away (ADR-009).

## Why

The project exists to make crime trends easier to inspect than raw portal exports, while keeping the v1 architecture simple enough to publish as a static Cloudflare Pages site.

## Who it's for

Toronto Crime Pulse is for general public awareness, especially residents comparing neighbourhoods, crime categories, and recent trend direction.

## Constraints

The v1 direction is Astro, Leaflet, hand-rolled SVG/Preact charts, Markdown tables under `/data/crimes/` as the archival source, and pre-aggregated JSON as the runtime data shape. Keep the first version static and Toronto-only; review the premise with the user before adding Supabase, real-time updates, YAML, LLM news links, or regional sources beyond Toronto. The load-bearing decisions for v1 are recorded as the ADRs under [`decisions/`](decisions/).
