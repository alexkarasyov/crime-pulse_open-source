# ADR-008 — Include neighbourhood-unresolved incidents in city totals

**Status**: accepted · 2026-07-17

## Context

The TPS Community Safety Indicators archive contains 5,960 records across 2016–2026 with a valid report date and one of the dashboard's five supported categories, but no neighbourhood ID that joins to Toronto's 158-neighbourhood model. Of those, 5,843 are in the comparable 2016–2025 full-year window and 117 are in 2026 YTD. The original aggregator dropped these records before both city and neighbourhood aggregation so the two layers reconciled exactly. That made the neighbourhood sum internally tidy, but understated the citywide numerator by about 1.6% and treated missing geography as if the incident did not happen.

The records cannot be placed on a neighbourhood chart, feed, calendar, or choropleth without inventing a location. They can still contribute legitimately to a Toronto-wide category total because their date and category are known.

## Decision

Toronto-wide totals and rates must include every imported TPS CSI record with a valid report date and supported category, regardless of whether its neighbourhood can be resolved. Neighbourhood-level aggregates must include only records joined to the 158-neighbourhood model.

The city aggregate must publish resolved and unresolved counts overall, by year, and by category. Build validation must enforce `city total = resolved neighbourhood total + unresolved total`, and the public methodology must disclose the current unresolved count and share.

## Consequences

+ Citywide counts and rates no longer understate the source data solely because geography is absent.
+ Missing-neighbourhood coverage becomes explicit, measurable, and testable rather than an invisible discard.
− Toronto totals will not equal a simple sum of the 158 neighbourhoods; consumers must include the published unresolved component when reconciling the layers.
− City and neighbourhood trends can differ slightly because records with unresolved geography contribute only to the city layer.

## When to revisit

Revisit when TPS supplies stable 158-model neighbourhood IDs for the unresolved records or publishes an authoritative city-total series that uses a materially different inclusion rule. At that point, backfill the corpus or reconcile the competing definition before changing the aggregate contract.
