# Test run — full-site review fixes

**Date**: 2026-07-17
**Backlog item**: [P2.11](../../project/backlog.md)
**Tested on**: macOS 26.5.2; Codex in-app Browser at its 1280px desktop viewport and a 390×844 phone override; Node 26.5.0; Python 3.9.6.

## What was tested

- Failure-safe TPS and population imports.
- Aggregate schema v2, complete year/category/neighbourhood validation, and city/neighbourhood coverage reconciliation.
- Mobile Compare controls and layout, guarded small-base changes, index semantics, scoped neighbourhood calendar/readout/feed/context, and About/privacy copy.
- The production static build across all 163 routes.

## How

1. Ran `npm test`, `npm run check`, and `npm run build` against the canonical Markdown corpus.
2. Opened Compare at 390×844, switched the visible Rate/Counts control, checked page width, and loaded `?p=ro&cmp=10,58` to exercise sub-10 endpoints.
3. Opened the neighbourhood index at `?p=at&c=at&y=2017-2018`, inspected Old East York's zero baseline, activated a sortable header, and inspected the accessibility structure of the headers and neighbourhood link.
4. Opened Princess-Rosethorn at `?p=ro&c=ro&y=2022-2023`, then brought the deferred sections into view to exercise hydration and the full incident feed.
5. Opened About at desktop width and checked the coverage disclosure, colophon, footer, and privacy wording. Checked the browser console after the responsive pass.

## Passed

- `npm test`: 102 Vitest tests and 77 Python tests passed. The invalid-import fixtures intentionally print validation errors while proving the seeded canonical files remain unchanged.
- `npm run check`: 0 errors, 0 warnings, 0 hints.
- `npm run build`: 163 pages built. The real-data reconciliation reports 369,616 full-year incidents, 9,568 in 2026 YTD, and 5,960 neighbourhood-unresolved records retained in Toronto totals. All aggregate and GeoJSON files remain below the 200 KB gzip budget.
- Compare at 390×844 exposes both Rate / 10K and Counts, changes mode successfully, has no page-level horizontal overflow, stacks its picker and small-multiple cards to 326px, and renders Princess-Rosethorn's `23→8` robbery change as a raw `−15` with a small-base label.
- The index renders Old East York's 2017→2018 auto-theft change as `+9 · 0→9` with a small-base label. Sortable headers are native buttons with `aria-sort`; neighbourhood navigation is a real `/neighbourhood/58/` link, with no fake link role or row tab stop.
- The scoped neighbourhood URL renders a 24-cell Robbery calendar for 2022–2023 with table/row/header/cell semantics and the accurate accessible label “Robbery monthly incident counts, 2022 to 2023.” Context copy says 2023 robbery rate, the readout shows only ROB for 2023, and the hydrated feed shows only Robbery (77 matching records). The 390px view has no horizontal overflow.
- About reports 5,960 unresolved-neighbourhood records (1.6%), names Space Grotesk, JetBrains Mono, and CARTO correctly, and contains no “No tracking” claim. The footer reads “Independent · Open methodology · No ads.”
- Browser console: no warnings or errors.

## Regressed / new issues

None after retest. The pass initially exposed mobile Compare min-content overflow and stale server-rendered scope attributes in two neighbourhood islands; both were fixed and the affected flows rerun.

## Notes

The viewport override was reset and temporary browser tabs were closed after the run.
