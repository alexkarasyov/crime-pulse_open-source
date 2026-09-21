# ADR-005 — Deployment is a static site on Cloudflare Pages

**Status**: accepted · 2026-05-26

## Context

[`docs/overview.md`](../../docs/overview.md) previously named "static GitHub Pages site" as the planned host. The user clarified on 2026-05-26 that v1 will deploy as a **static site on Cloudflare Pages** — not GitHub Pages, and not anything server-rendered. The "for now" framing leaves a later move open, but every v1 implementation choice must assume static-only on Cloudflare.

The two earlier ADRs that touch the runtime — [ADR-003 (choropleth not dots)](003-choropleth-map-not-incident-dots.md) and [ADR-004 (build emits aggregated JSON)](004-build-emits-aggregated-json.md) — already assume the dashboard reads pre-aggregated artefacts at runtime, so this ADR pins the assumption rather than changing it.

## Decision

V1 ships as a **fully static site on Cloudflare Pages**. Concretely:

- Astro builds with `output: 'static'`. No SSR adapter, no Cloudflare Workers, no Pages Functions, no `_middleware`.
- All data the dashboard reads at runtime is the JSON the build emits per [ADR-004](004-build-emits-aggregated-json.md); no fetches to an origin we control.
- No auth, no per-user state, no cookies set by the site, no analytics that require a server endpoint.
- Third-party tile servers for Leaflet are allowed (the brief already names CartoDB Positron / Dark Matter) provided their terms allow public use; Cloudflare Pages is the only origin we deploy.
- The styleguide prototype (styleguide/ — deleted 2026-05-27) was deployable as-is — it was pure static (HTML + CDN React/Babel + JSX strings) — but production won't ship it; the Astro port supersedes it.

## Consequences

+ Hosting is free at Cloudflare's free Pages tier; the static budget keeps the project cheap to leave online.
+ Cache behaviour and global CDN come for free; no origin to scale or monitor.
+ Forces the data pipeline to stay build-time, which the project already wanted ([ADR-004](004-build-emits-aggregated-json.md)).
− No server-side personalisation, no per-request filtering on the backend; everything cross-filter must run in the browser against the emitted JSON.
− No way to add features that need a private key or rate-limited upstream (e.g. proxying a third-party API) without changing this decision.
− Search, if it gets added, has to be client-side over the emitted JSON (acceptable at 158 neighbourhoods + ~370k incidents pre-aggregated).

## When to revisit

When v1 has shipped and a real feature needs server-side work that doesn't fit Cloudflare Pages' static envelope — most likely candidates: rate-limited upstream proxying, signed download endpoints, or per-user saved comparisons. Even then, Cloudflare Workers / Pages Functions are the first thing to consider before leaving Cloudflare.
