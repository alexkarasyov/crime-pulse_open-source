# ADR-007 — Per-neighbourhood denominator is the 25% long-form sample, not 100% Census population

**Status**: accepted · 2026-05-26

## Context

The City of Toronto's `Neighbourhood Profiles 2021, 158-model` XLSX — the source named in [`../../docs/data-sources.md`](../../docs/data-sources.md) for the per-neighbourhood denominator — does **not contain a 100% Census `Population, 2021` row at 158-neighbourhood granularity**. Every population total in the file is sourced from the 2021 Census **25% long-form sample** (the canonical row is `Total - Age groups of the population - 25% sample data`).

The implementation effort for [P1.4b](../backlog.md) hit this on first contact: summed across the 158 neighbourhoods, the 25% sample row totals **2,761,290** vs. the City of Toronto 100% Census total of **2,794,356** — a **1.18% under-count**, outside the original ±0.5% validation tolerance in `data-sources.md`.

The City of Toronto does not publish a 100% population row at 158-model granularity in any open dataset. The alternatives are:

- Use the older 140-neighbourhood Census files, where 100% population is published — but the 140-area IDs do not join to the TPS CSI corpus (`NEIGHBOURHOOD_158` field), so this is a non-starter for [v1's choropleth and feed joins (ADR-003)](003-choropleth-map-not-incident-dots.md).
- Aggregate raw 2021 Census Dissemination Area populations to the 158-neighbourhood polygons using a DA-to-neighbourhood crosswalk. Plausible but a meaningful project on its own, and the crosswalk itself introduces error that the City's published 25% sample row has already absorbed cleanly.
- Pay for a Community Data Program tabulation. Out of scope; not open data.

## Decision

The per-neighbourhood denominator for v1 is the **25% long-form sample population** from the 158-model Neighbourhood Profile, taken directly from the row labelled `Total - Age groups of the population - 25% sample data`.

Concretely:

- The importer ([P1.4b](../backlog.md)) reads that row as the canonical population value per neighbourhood.
- `data/population/toronto-neighbourhoods-2021.md` carries `population_2021_sample25` as the column name (or `population_2021` with a top-of-file note — pick one, be consistent) to make the provenance unmistakable.
- The validation contract for the population total widens to **±2%** of the City of Toronto 100% Census total (2,794,356). That's wide enough to accept the documented 25% sample under-count without masking a real data corruption.
- Every per-neighbourhood rate the dashboard shows discloses the 25% sample basis in the same place it discloses the 2021 reference year (per [ADR-002](002-present-rates-not-counts.md)).

## Consequences

+ The importer can ship against the data the City actually publishes, without standing up a custom DA aggregation or licensing a tabulation.
+ Trend SLOPE across years is unaffected — the 2021 denominator is fixed, so growth and decline at the neighbourhood level move with the numerator, not the denominator.
+ Cross-neighbourhood comparisons are unaffected for the same reason — every neighbourhood uses the same 25% sample basis, so relative ranking and choropleth shading are clean.
− Absolute per-neighbourhood rates are biased ~1% **high** versus what they would be against the 100% Census denominator (smaller denominator → larger rate). The bias is uniform across neighbourhoods and disclosed.
− If a future reviewer compares our per-capita rates to StatCan's published Toronto rates (which use the CSD 100% denominator from [ADR-006](006-city-wide-denominator-is-toronto-csd-not-cma.md)), they will see a small consistent offset. The city-wide trend headline uses the 100% CSD denominator, so the offset only shows up at the neighbourhood layer.

## When to revisit

When either (a) the City publishes a 100% population row at 158-model granularity for the 2021 Census or a later one, or (b) a 2026 Census release lands with new neighbourhood-level tabulations. At that point swap the denominator and tighten the validation tolerance back to ±0.5%. The downstream choropleth and Neighbourhood views need no changes; only the importer and a one-line note on every per-neighbourhood rate display.
