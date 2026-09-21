# ADR-006 — City-wide denominator is Toronto Census Subdivision, not Toronto CMA

**Status**: accepted · 2026-05-26

## Context

[ADR-002](002-present-rates-not-counts.md) commits the dashboard to rates per 10,000 residents and names "Statistics Canada Toronto CMA population estimates" as the city-wide denominator by year. Source research for the population denominators (see [`../../docs/data-sources.md` § Population denominators](../../docs/data-sources.md)) turned up two distinct StatCan series:

- **Table 17-10-0148-01** — population estimates by **Census Metropolitan Area (CMA)**, 2021 boundaries. The Toronto CMA covers the City of Toronto **plus** parts of Peel, York, Durham, and Halton (Mississauga, Brampton, Vaughan, Markham, Richmond Hill, Ajax, Pickering, etc.). 2025 Toronto CMA population is ~7.1M.
- **Table 17-10-0155-01** — population estimates by **Census Subdivision (CSD)**, 2021 boundaries. The "Toronto, City (C)" row (DGUID `2021A00053520005`) is the City of Toronto only. 2025 City of Toronto population is ~3.0M.

The numerator in this dashboard is TPS Community Safety Indicators, which covers City of Toronto incidents only — it does not include Peel Regional, York Regional, Durham Regional, or Halton Regional incidents. Pairing a City-of-Toronto numerator with a CMA denominator would divide ~24k 2024 assaults by ~7.1M residents instead of ~3.0M residents, understating the per-capita rate by more than half and breaking the cross-region comparability that ADR-002 promised.

ADR-002's phrasing ("Toronto CMA population estimates") was carried over from early framing and is incorrect for the geography the dashboard actually ships.

## Decision

The city-wide annual denominator is the **City of Toronto Census Subdivision** population from StatCan **table 17-10-0155-01**, not the Toronto CMA.

Concretely:

- Pull the "Toronto, City (C), Ontario" row (CSD UID `3520005`, DGUID `2021A00053520005`) by reference year.
- Use the July 1 estimate for each year 2016–2025; that is the same series ADR-002 needs and the only one currently published annually at CSD granularity on 2021 boundaries.
- The CMA table (17-10-0148-01) is **not** imported for v1. If a future feature compares the City of Toronto against the rest of the GTA (an explicit ADR-001 revisit), that is the moment to pull the CMA series — and even then it should be presented as a separate "GTA context" denominator, never as the City of Toronto denominator.

ADR-002 will be considered updated by reference to this ADR; the language in the data-sources doc and the design brief should follow this decision and stop saying "Toronto CMA" where it means "City of Toronto."

## Consequences

+ Numerator geography (City of Toronto incidents in CSI) and denominator geography (City of Toronto CSD population) match exactly. The city-wide rate answers the question the dashboard asks.
+ The chosen StatCan table is active, refreshed annually, 2021-boundaries, and already covers 2016–2025, which spans the full v1 reporting window.
+ Aligns with how the TPS Annual Statistical Report and StatCan's own Toronto police-reported crime tables (e.g. 35-10-0177-01) publish rates against Toronto Police Service's jurisdiction population, which is City of Toronto, not CMA.
− Loses a built-in cross-region context number — the GTA is no longer the unit of analysis at any layer of the dashboard. That is consistent with [ADR-001](001-v1-scope-is-toronto-not-gta.md).
− Anyone reading older drafts of ADR-002 or the design brief and looking for "Toronto CMA population" needs the cross-reference to find this ADR.

## When to revisit

When a regional phase lands per [ADR-001's "When to revisit"](001-v1-scope-is-toronto-not-gta.md), and the dashboard needs to render City-of-Toronto rates alongside Peel/York/Durham/Halton rates on shared axes. At that point pull table 17-10-0148-01 (CMA) **in addition to** 17-10-0155-01 (CSD), one for the regional context layer and one for the existing city-wide denominator. Do not retire the CSD denominator when the CMA one arrives.
