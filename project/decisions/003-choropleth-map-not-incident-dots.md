# ADR-003 — Map is a neighbourhood choropleth, not incident dots

**Status**: accepted · 2026-05-26

## Context

The TPS Community Safety Indicators data publishes a `LAT_WGS84`/`LONG_WGS84` per incident but is explicit that "locations can be blank or approximate; never present map points as exact addresses" ([`docs/data-sources.md`](../../docs/data-sources.md)). The earlier design brief specified a Leaflet map of clustered incident dots over all 369,616 imported rows.

Three problems with that:
1. **Dishonest precision.** A dot on a building implies the incident happened there. The source says it didn't necessarily.
2. **Performance.** Even with clustering, hundreds of thousands of points are expensive to ship, parse, and re-cluster on mobile.
3. **Wrong unit.** Per ADR-002 the dashboard speaks in rates per 10,000 residents. A rate is a property of a population — a polygon — not a point.

The City of Toronto publishes the official 158-neighbourhood polygon GeoJSON, which matches the TPS `NEIGHBOURHOOD_158` field.

## Decision

The primary map is a **choropleth of the 158 Toronto neighbourhoods**, shaded by the selected category's rate per 10,000 residents over the active year range. Hover/tap surfaces the rate, the raw count, and a small in-place sparkline; click drills into the Neighbourhood view.

Incident-level dots are removed from v1. If a future zoom-in needs incident texture, it must be implemented as a deliberately jittered density layer with a visible "approximate" badge — never as point-precise markers.

## Consequences

+ The map reads at the same resolution the data actually supports.
+ Map payload becomes a small GeoJSON plus a per-neighbourhood aggregate JSON, well under the budget Astro can ship statically.
+ Light and dark map tile choices (CartoDB Positron / Dark Matter) work cleanly under a choropleth — the polygon shading carries the data, the tiles stay quiet.
− Loses the "you can see exactly where things happened" affordance some users will expect. The About page has to explain why.
− Choropleths visually reward larger polygons; we mitigate with rate-normalised shading (not count-normalised) and a polygon-outline emphasis on hover.

## When to revisit

If user testing shows the choropleth fails the "where is my street?" mental model, OR if Toronto publishes a finer-than-neighbourhood official boundary that doesn't break ADR-002's denominator promise.
