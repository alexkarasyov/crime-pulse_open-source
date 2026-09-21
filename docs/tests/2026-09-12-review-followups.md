# Test run — review follow-ups and staged refresh

**Date**: 2026-09-12  
**Backlog items**: [P2.18–P2.22](../../project/backlog.md)  
**Tested on**: macOS, Node 26.8.2, npm 11.19.1, Python 3.9.6, Chrome 152.0.7977.65; desktop 1280×900 and mobile emulation 375×812 with touch enabled.

## What was tested

All four requested follow-ups: readable Compare trends with an optional city
baseline; inspectable chart values; maintained browser regression QA; and a
source-refresh review before acceptance. Also completed the previous review's
remaining suggestions: exact index category controls, cumulative page payload
budgets, and streaming StatCan CSV imports.

## How

- `npm run verify`: type check, fresh production build, unit/data suites, then
  the maintained [Chrome runner](../../tests/browser/README.md).
- The runner serves actual `dist/` files with the project's `_headers` rules,
  uses isolated browser profiles, and performs actual pointer, keyboard and
  touch actions. Chart data is compared with built annual/monthly aggregates.
- Visually inspected desktop Compare and mobile Compare/detail captures,
  including expanded data tables and final phone-sized chart/calendar viewport captures. Independently diagnosed mobile grid bounds
  and repeated actual table-opening and calendar-tap interactions.
- Replayed the complete accepted archive through the staged refresh workflow
  without network access. Acceptance failure/rollback scenarios use temporary
  source trees, never the real accepted archive.

## Passed

- **302 unit/data tests**: 183 Vitest and 119 Python. This adds 32 cases to the
  preceding review's 270, including chart/baseline/URL regressions, calendar and
  index scope assertions, and 15 refresh/reconciliation/import-isolation tests.
- Source fixtures cover unchanged imports, additions/removals/revisions,
  impossible dates, unresolved and monthly/annual reconciliation, metadata-only
  changes, stale accepted inputs, modified candidates/reports, late importer
  failure, mid-accept rollback, and preservation of unrelated data files.
- **Zero known npm audit vulnerabilities**, including development dependencies.
- Actual archive replay: **389,614 → 389,614** incident rows; **6,094 → 6,094**
  unresolved rows; data through **2026-06-30**. No additions, removals, revisions,
  population/context changes, or boundary changes. Accepted source SHA-256
  manifests remain unchanged after all builds and QA.
- Compare counts now scale to the selected neighbourhoods by default. Showing
  Toronto changes the axis, path and table together; counts/rates choices stay
  independent and copied links preserve them after navigation and reload.
- Chart disclosures open with Enter; mobile tables scroll with ArrowRight.
  Expanded tables remain within the phone viewport. The calendar exposes a
  live count on focus/tap, and its twelve monthly values reconcile to each
  year's accepted total. For example, tapping Moss Park April 2018 reports
  31 assault incidents.
- Index single-category/all-five controls reconcile with the built source;
  search, empty states, population sort, filters and map navigation work.

`npm run verify` completed successfully. Astro checked 88 files with zero
errors/warnings/hints and emitted 163 pages. The final browser run passed
**85/85 checks** and **22 accessibility scans with zero detected violations**;
there were no browser, console, failed-request or unexpected HTTP errors.
All five surfaces passed at both viewport sizes and in dark/light themes.
The browser phase ran 08:39:04–08:40:12 UTC on 2026-09-12.

Total first-party gzip payload for the fully scrolled initial view (same at
both viewports; excludes third-party tiles and subsequent interactions):

| Surface | Compressed bytes | Budget |
| --- | ---: | ---: |
| Overview | 425,570 | 1,048,576 |
| Compare | 230,958 | 1,048,576 |
| Neighbourhood index | 482,862 | 1,048,576 |
| Moss Park detail | 490,996 | 1,048,576 |
| About | 136,757 | 1,048,576 |

Puppeteer's transitive peer dependency is configured to skip automatic browser
downloads during package/deploy installation; QA uses the installed Chrome.
The configuration loader was checked directly.

## Regressions found and corrected during QA

- Compare's introductory text still claimed the baseline was always visible;
  corrected it and added a Copy view control using the shared URL builder.
- The production CSP blocked small inlined font subsets. The build now emits
  first-party font files and leaves the font security policy intact.
- Opening small-multiple tables enlarged mobile grid tracks beyond 375px.
  Cards and responsive grids now allow their table regions to shrink and scroll.
- About's fixed two-column scope callouts overflowed the phone viewport; they
  now stack on narrow screens, with bounded grid tracks.
- Early harness failures measured theme transitions before settling and used
  the browser's expanded `innerWidth` as an overflow baseline. The maintained
  suite waits for transitions and compares against the requested viewport.

## Notes

This is local verification; no commit, push, live source acceptance or deployment
was performed. The replay review is available locally at
`.refresh/offline-replay-20260912/review.md`; that generated directory is ignored
by Git. Browser JSON results, resource measurements and screenshots are under
`test-results/browser/` and are also ignored. This document preserves the run.

The browser suite uses local tile-image fixtures by default while rendering
real Leaflet boundaries and testing real polygon navigation. Live tile service
availability is a separate optional check. Clipboard contents are captured by a
page-local stub, then the actual copied URL is opened and reloaded. Axe records
incomplete checks as well as violations; automated scans and mobile emulation
do not establish screen-reader or physical-device compatibility. Local response
header checks do not verify a deployed Cloudflare configuration.

Acceptance rolls back ordinary failures. An abrupt process kill can require
manual recovery from preserved source backups; the limitation and procedure
are recorded in [ADR-011](../../project/decisions/011-review-staged-data-before-acceptance.md).
