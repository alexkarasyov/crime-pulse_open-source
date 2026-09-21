# ADR-010 — Metro context card uses CMA rates, not GTA suburb expansion

**Status**: accepted · 2026-08-30

## Context

Backlog item P1.4d originally asked for a card comparing Toronto to Vaughan, Markham, Brampton, Mississauga, Richmond Hill, and Oakville. StatCan table 35-10-0177-01 publishes `Toronto, Ontario [35535]` at **Census Metropolitan Area** granularity only — that CMA already includes those suburbs as one bucket. Per-CSD crime rates for individual GTA municipalities are not available from any open StatCan table currently audited, and direct municipal police sources (Peel, York, Halton) fail ADR-001's bar on coverage, licensing, or data dictionaries (see the Vaughan parking-lot entry in [`project/backlog.md`](../backlog.md)).

The owner asked to ship the buildable alternative: compare Toronto CMA to other Canadian CMAs, while being honest about what "GTA expansion" can mean without breaking ADR-001.

## Decision

Add a second Overview context card — **Toronto metro in context** — sourced from StatCan 35-10-0177-01:

- Metric: **Total Criminal Code violations (excluding traffic), rate per 100,000 population**.
- Geographies: **Toronto CMA** (highlighted), **Hamilton**, **Ottawa-Gatineau**, **Montréal**, **Vancouver**, **Calgary**, **Edmonton**, and **Canada**.
- Copy on the card and About §04 must state explicitly that **Toronto CMA ≠ City of Toronto**: the metro bucket includes Mississauga, Brampton, Vaughan, Markham, and other GTA municipalities, while maps, feeds, and neighbourhood pages remain City-of-Toronto-only per ADR-001.

This is **national and Ontario-peer metro context**, not incident-level GTA suburb expansion. Individual Peel/York/Halton/Durham dashboards remain parked until those sources meet ADR-001's revisit criteria.

## Consequences

+ Gives users searching for "GTA crime comparison" a defensible metro-level answer instead of silence or misleading suburb labels.
+ Reuses the existing CSI-card visual pattern and the StatCan Open Licence pipeline already proven by P1.4c.
+ Hamilton and Ottawa-Gatineau provide Ontario metro peers without pretending Vaughan is a separate series in StatCan.
− Toronto CMA rates are **not comparable** to City-of-Toronto counts on the same page without reading the caveat — the card must carry that warning prominently.
− Still no neighbourhood-resolved or municipality-resolved GTA coverage; users looking for Mississauga-only trends must go elsewhere.

## When to revisit

When at least two of Peel, York, Durham, or Halton publish 10-year incident-level data their terms allow to be compared over time **and** ADR-001's side-by-side rendering bar is met — at that point add municipality or regional layers; do not relabel CMA rates as suburb-specific counts.
