# Skill — verify a change manually

Before marking a backlog item `done` or shipping a user-visible change, run a real verification and record it.

## What "verified" means for this project

- Static web app: render the Astro site in a real browser and exercise the actual public flow being changed, such as trends, feed, map, stats, filters, or dev-only route hiding.
- Data import/update: run the relevant import command (`npm run refresh`, or an individual `scripts/import_*.py`), then spot-check appended Markdown rows for date, neighbourhood, category, location, deduplication, and year/month coverage.
- Dashboard chart/map behavior: verify that the Leaflet choropleth and the hand-rolled SVG/Preact charts are populated from the built data, respect filters, and do not show stale or impossible values.
- Deployment: build the static output and confirm the Cloudflare Pages deployment serves the change before treating it as shipped (per [ADR-005](../project/decisions/005-static-cloudflare-pages-only.md)).

## Where to record

A dated note in [`../docs/tests/`](../docs/tests/) named `YYYY-MM-DD-{slug}.md`.

## Template

```
# Test run — {short title}

**Date**: YYYY-MM-DD
**Backlog item**: {ID, link}
**Tested on**: {device / OS / runtime / browser / hardware revision — be specific}

## What was tested
## How
## Passed
## Regressed / new issues
## Notes
```

## Anti-patterns

- "Looks good locally" with no record.
- Only testing the golden path.
- Mistaking automated checks (type-checks, linters, unit tests) for behavior verification. They're necessary, not sufficient.
- Reusing an old test note by editing it. Write a new one.
