# Test run — TPS CSI 10-year import

**Date**: 2026-05-26
**Backlog item**: P1.1, [`../project/backlog.md`](../../project/backlog.md)
**Tested on**: macOS, Python 3 via `python3 scripts/import_tps_csi.py`

## What was tested

The Toronto Police Service Community Safety Indicators bulk import for full report years 2016-2025.

## How

Ran `python3 scripts/import_tps_csi.py` against the official CSV URL documented in [`../data-sources.md`](../data-sources.md). Checked the generated validation report, yearly file list, first rows from 2016 and 2025, min/max report dates, category counts, missing-coordinate counts, and duplicate-removal summary.

## Passed

- Read 474,819 source rows.
- Wrote 369,616 deduped rows across 10 Markdown files, `data/crimes/tps-csi-2016.md` through `data/crimes/tps-csi-2025.md`.
- Confirmed report-year coverage from 2016-01-01 through 2025-12-31.
- Confirmed all expected CSI categories appear in each year: Assault, Auto Theft, Break and Enter, Robbery, and Theft Over.
- Removed 29,367 duplicate rows using the importer key.
- Wrote `data/crimes/tps-csi-validation.json` with row counts, date ranges, categories, and missing-coordinate counts.

## Regressed / new issues

No regressions found. The generated Markdown data is large, about 71 MB total, which is expected for full incident-level tables.

## Notes

The import intentionally excludes 2014, 2015, and 2026 because v1 needs 10 complete years for comparable trend graphs. The source still contains partial 2026 data for a later year-to-date view.
