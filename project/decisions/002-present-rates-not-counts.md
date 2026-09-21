# ADR-002 — Present rates per 10,000 residents, not raw counts

**Status**: superseded by [ADR-009](009-default-unit-is-counts.md) · 2026-07-20 (originally accepted 2026-05-26 — rates remain first-class and the denominator decisions here still stand; only the *default* flipped to counts)

## Context

The imported TPS Community Safety Indicators data is incident counts, not rates. Toronto's 158 neighbourhoods have populations ranging roughly 6,000 to 70,000, and the city as a whole grew about 10% between 2016 and 2025. Showing raw counts on the dashboard would:

- Make denser neighbourhoods look "worse" regardless of per-resident risk, biasing the map and the Compare view.
- Inflate "10-year trend" headline copy (e.g. a 37% increase in count is meaningfully different from the per-capita change).
- Break the brief's audience promise: non-experts taking the headline at face value would be misled.

Population denominators are publicly available from the City of Toronto's Neighbourhood Profiles, which use the same 158-neighbourhood boundary as TPS CSI.

## Decision

The default unit everywhere on the dashboard is **incidents per 10,000 residents**, calculated against the most recent published Toronto Neighbourhood Profile population (2021 Census) for the corresponding 158-neighbourhood polygon.

Raw counts remain available as a user-toggle, and the toggle state is reflected in chart axes, map legend, headline copy, and the chronological feed's neighbourhood badge.

Toronto-wide trend numbers normalise against Statistics Canada's published Toronto CMA population estimates by year, so the city-level rate accounts for population growth.

For 2026, which is year-to-date and excluded from comparable 10-year visuals, no rate is published at all (the denominator and the numerator are both incomplete).

## Consequences

+ Hero copy, the map, and Compare are defensible — they answer "is risk going up?" not "is the city bigger?"
+ Aligns with how Statistics Canada and TPS themselves publish trend data.
+ Forces an explicit denominator decision that future regional add-ons (ADR-001 revisit) can copy.
− Adds a build-time dependency on Toronto Neighbourhood Profiles data and StatsCan Toronto CMA population estimates.
− 2021 Census is the most recent universal neighbourhood denominator; rates from 2022–2025 use a slightly stale denominator and that has to be disclosed.
− Counts are still what most journalists and residents have intuition for; the rate framing needs UI affordance to switch.

## When to revisit

When StatsCan or the City of Toronto publishes a newer universal neighbourhood denominator (e.g. 2026 Census release), OR when user testing shows the rate framing is misread by the general-public audience.
