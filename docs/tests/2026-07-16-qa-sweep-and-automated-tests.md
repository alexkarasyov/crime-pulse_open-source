# Test run — pre-redeploy QA sweep + first automated test suites

**Date**: 2026-07-16
**Backlog item**: P2.10 ([`../../project/backlog.md`](../../project/backlog.md))
**Tested on**: macOS (Darwin 25.5.0), Node 26.4.0, system Python 3.9.6, headless Google Chrome (system install) via puppeteer-core, site served by `astro preview` (port 4322) and `wrangler dev` (port 8788)

## What was tested

1. **Data freshness** — re-ran all three importers to check for newer upstream data.
2. **Automated suites (new)** — `npm test`: 88 Vitest tests over `src/lib` + built-aggregate invariants; 73 Python `unittest` tests over the pipeline helpers.
3. **Browser QA sweep** — scripted headless-Chrome pass (36 checks) over the production build: Overview, Neighbourhood detail (73/Moss Park), Compare, neighbourhood index, About, shared-link hydration, static assets, dev-route hiding, 404, mobile viewport.
4. **Workers static-assets deploy path** — `wrangler dev` serving `dist/`: headers, 404 handling.

## How

- `npm run refresh` + `scripts/import_csi.py`, then diffed `data/**/validation.json`.
- `npm run check` (astro check), `npm run build` (163 pages), `npm test`, `npm run test:py`.
- QA script (scratchpad, puppeteer-core): loads each surface at 1280×900 and 375×812, collects console errors / page errors / failed requests / ≥400 responses, scrolls to hydrate `client:visible` islands, exercises the unit toggle, category chips, neighbourhood-index row navigation, and `?u=count&c=…&y=…` shared-link hydration; asserts 158 choropleth polygons, 158 index rows, honest "data through 2026-03-31" freshness copy, canonical/OG meta on a neighbourhood page, robots/sitemap/favicon/Leaflet CSS served, `/project/` + `/styleguide/` absent (404), branded 404, and no document-level horizontal overflow.
- `wrangler dev`: curl checks for CSP/`X-Frame-Options`/cache headers, branded 404 body with status 404, immutable cache on `/leaflet-1.9.4.css`.

## Passed

- Data: **no new upstream data** — TPS corpus byte-identical (379,184 rows, through 2026-03-31; Q2 2026 not yet published), StatCan CSI still ends 2024, population release still 2026-01-14. Committed data is current.
- `astro check`: 0 errors. Build: 163 pages, all aggregates under the 200 KB gzip budget (`by-neighbourhood-month.json` 169.4 KB).
- Automated tests: **161/161 green** (88 Vitest + 73 unittest).
- QA sweep: **36/36 checks pass** (after the fix below), including zero console/page/network errors on every surface, both viewports.
- Workers deploy path: `_headers` rules (CSP, nosniff, DENY, cache) applied; branded 404 served with status 404 after the `not_found_handling` fix.

## Regressed / new issues

- **Fixed in this batch — mobile hero overflow in count mode.** `?u=count` at 375px: the `.bigstat-num` flex row (number + "INCIDENTS · 2025" label) has an intrinsic width of ~387px, stretching the hero column to 419px and making the whole page scroll horizontally. Not visible in rate mode (shorter number), which is why earlier mobile passes missed it. Fix: `flex-wrap: wrap` on `.bigstat-num`; verified 375/375 in all filter states, desktop hero unaffected (label wraps under the number, card no longer stretched).
- **Fixed in this batch — Workers deploy served a bodyless 404.** `wrangler.jsonc` lacked `assets.not_found_handling: "404-page"` (Workers assets defaults to `"none"`, unlike Pages). The docs/deploy.md smoke check "branded 404 on a bad path" would have failed on the first Workers deploy.

## Notes

- The neighbourhood index rows navigate via `role="link"` + Enter handling (keyboard-accessible per the P2.3 pass) but are not real `<a>` elements, so middle-click / open-in-new-tab don't work. Filed as a follow-up suggestion, not a blocker (sitemap covers crawler discovery).
- The Overview hero eyebrow reads "PER 10,000 RESIDENTS" even when the unit toggle is on Counts — static framing copy, arguably fine, noted for a future copy pass.
- `docs/deploy.md` documents the Cloudflare **Pages** flow; `wrangler.jsonc` (added 2026-07-13) targets **Workers static assets**. A short Workers subsection was added to deploy.md in this batch; if Workers becomes the canonical path, the Pages runbook should be demoted explicitly.
- The vitest data-invariants suite measures gzip at level 9 to match the aggregator's own budget enforcement (Node's default level 6 reads ~235 KB and would false-flag).
