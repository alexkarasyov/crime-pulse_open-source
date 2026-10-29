# Test run — Compare links, name encoding, dependency audit

**Date**: 2026-10-29
**Backlog item**: [P3.1](../../project/backlog.md)
**Tested on**: Linux, Node 22.23.4, Python 3.12.3, openpyxl 3.1.5, headless Chrome, production `dist/` served with the project's header rules.

## What was tested

A Compare URL whose `cmp` values are not neighbourhood numbers, a numeric `cmp` list, map tooltip text for a name that contains an apostrophe, and the neighbourhood JSON-LD script body.

## How

1. `npm run build`, then `npm test` and `npm run check`.
2. Opened `/compare/?cmp=__proto__,constructor` in headless Chrome. Confirmed the three default neighbourhoods (High Park-Swansea, Moss Park, West Rouge), slots 87 / 73 / 143, an empty console and page-error list, and that the address bar dropped the malformed query.
3. Opened `/compare/?cmp=5,9,12` and confirmed those three slots loaded with no console errors.
4. On `/neighbourhood/`, scrolled the map into view, hovered polygons, and read the tooltip for O'Connor-Parkview. The visible text was the neighbourhood name.
5. Read `dist/neighbourhood/118/index.html` and confirmed the JSON-LD script body contains Tam O'Shanter-Sullivan and no raw `<`.

## Passed

- Build: 163 pages.
- Tests after the fix: 190 Vitest + 119 Python tests. `astro check`: 0 errors.
- `npm audit`: 0 vulnerabilities.
- Malformed Compare link no longer throws; numeric picks still load.
- Tooltip and JSON-LD render the apostrophe names as names.

## Regressed / new issues

None observed on the paths above.

## Notes

Before these edits, the same commands on unmodified `main` produced a successful production build (163 pages), 183 Vitest tests, and 119 Python tests once `openpyxl` was installed. The first Python run failed only because this environment did not have `openpyxl` yet. `npm audit` on that tree reported 14 vulnerabilities (9 high, 4 moderate, 1 low, 0 critical).
