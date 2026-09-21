# Browser QA

Install project dependencies with `npm install` and use Chrome or Chromium.
The runner finds standard macOS, Linux and Windows installations; otherwise
set `CHROME_PATH` to the browser executable. It uses a temporary profile, never
your personal browser session. No browser download happens during `npm install`.

```sh
npm run verify        # types → production build → unit/data tests → browser QA
npm run test:browser  # rerun browser QA against an existing production dist/
```

The suite starts its own loopback server on a free port, serves the production
`dist/` files with the project's Cloudflare `_headers` rules, and closes both
server and browser when finished. The release build still uses `npm run build`;
Chrome is only a maintainer/QA dependency, not a deployment requirement.

Five representative public pages run at 1280×900 and 375×812 with touch enabled
on the latter. Tests cover both units and themes, category/year controls,
Compare slots and independent baseline preferences, copied links overriding
saved preferences after reload, native chart tables, keyboard/touch calendar
inspection, monthly/yearly source reconciliation, feed pagination, index
search/sort, 158 map polygons, real pointer navigation, responsive overflow,
production route exclusion, and WCAG 2 A/AA + 2.1 AA axe scans. Unit/build suites
separately cover all 158 neighbourhood pages and data invariants.

Every route has a **1 MiB total first-party compressed payload budget** for its
fully scrolled initial view. The runner records per-resource gzip sizes; these
measure comparable content size, not server compression configuration or a
network-performance score. Interactions and third-party map tiles are excluded.
Review the measurements before deliberately changing the budget.

By default, CARTO tile images use a local image fixture so offline regressions
do not depend on a third-party service. Real Leaflet code and actual boundary
data still render and receive clicks. Use `QA_LIVE_TILES=1 npm run test:browser`
for a network-dependent map smoke check. Clipboard writes use an isolated page
stub; the copied URL is then opened and reloaded through the real application.

Results, resource sizes, full-page screenshots and failure screenshots are in
`test-results/browser/` (ignored by Git). The command fails on assertions, axe
violations, runtime/console errors, failed requests, or unexpected HTTP errors.
Accessibility scans also record incomplete checks; automated scans do not
replace visual inspection or assistive-technology testing. A changed screen
still needs a dated manual QA record under `docs/tests/`.

For a restricted Linux CI container only, `QA_NO_SANDBOX=1` opts out of Chrome's
own sandbox. The default keeps it enabled. No YAML or hosted CI is required.
