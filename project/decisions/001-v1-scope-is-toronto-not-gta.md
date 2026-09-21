# ADR-001 — v1 scope is Toronto, not GTA

**Status**: accepted · 2026-05-26

## Context

The repository name (`crime-pulse`) and earlier framing in `README.md`, `AGENTS.md`, `project/charter.md`, and `docs/overview.md` described the project as a "GTA crime-trends" dashboard. Source research in [`docs/data-sources.md`](../../docs/data-sources.md) found that no other GTA police service publishes clean, official, 10-year incident-level data on terms comparable to Toronto Police Service's Community Safety Indicators. Peel, York, Durham, Halton, and Mississauga sources are either short-coverage, ArcGIS-only, HTML-only, or carry strong disclaimers against trend comparison.

Shipping under a "GTA" label without GTA data sets up a credibility gap: users arrive expecting Peel/York/Durham/Halton and find Toronto only.

## Decision

V1 is positioned and copy-written as **Toronto Crime Pulse**. The repo directory and code identifiers may keep `crime-pulse`, but every user-visible surface — hero, About page, page titles, OG tags — says "Toronto," not "GTA."

A future regional phase may re-introduce "GTA" framing if and when comparable Peel/York/Durham/Halton data lands on equal terms (10-year incident-level, neighbourhood-resolvable, trend-safe per source's own disclaimers).

## Consequences

+ Hero and headline copy can confidently state coverage instead of hedging.
+ The About page tells a clean, defensible scope story.
+ Avoids the worst failure mode (users reading the dashboard as authoritative for regions it doesn't cover).
− "GTA" stops being a marketing handle for now; the project loses a broader-sounding name.
− When regional sources are added later, branding has to migrate again, which is a coordination cost.

## When to revisit

When at least two of Peel, York, Durham, or Halton publish 10-year incident-level data their own terms allow to be compared over time, AND the design has a way to render their data side-by-side with Toronto without implying false equivalence.
