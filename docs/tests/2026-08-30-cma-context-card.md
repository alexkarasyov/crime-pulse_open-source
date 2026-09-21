# Test run — CMA metro context card

**Date**: 2026-08-30
**Backlog item**: [P1.4d](../project/backlog.md) · [ADR-010](../project/decisions/010-cma-context-card-not-gta-suburbs.md)
**Tested on**: macOS · Node 22 · production `dist/` from `npm run build`

## What was tested

- StatCan 35-10-0177-01 import (`scripts/import_cma_rates.py`)
- Overview *Toronto metro in context* card (rates per 100K, Toronto CMA highlighted)
- About §04 GTA / CMA scope caveat
- `npm run refresh` chain includes new importer

## How

1. `python3 scripts/import_cma_rates.py` → 80 rows, 8 geographies × 2016–2025
2. `npm run build` → 163 pages, sitemap 162/162 stamped
3. `npm test` → 100 Python + Vitest suites green
4. Grep `dist/index.html` for card title, 2025 Toronto CMA rate, and GTA caveat copy
5. Spot-check `data/cma/validation.json`: Toronto CMA 2025 = 3949.7, Canada 2025 = 5584.6

## Passed

- Import completes; all 8 wanted geographies present
- Built HTML includes "Toronto metro in context", "Rate / 100K · 2025", Toronto CMA bar value 3,950 (rounded), and copy distinguishing City of Toronto from Toronto CMA
- About page includes updated scope caveat referencing the metro card
- Automated tests pass; `cma-context.json` gz ≈ 1.0 KB (under budget)

## Regressed / new issues

- None observed in this pass.

## Notes

- True per-suburb GTA expansion (Vaughan, Mississauga, etc.) remains parked per ADR-001; StatCan only publishes Toronto at CMA granularity.
- 2025 rates ship because StatCan table 35-10-0177-01 already includes them; TPS neighbourhood views still end at comparable 2016–2025 plus optional 2026 YTD.
