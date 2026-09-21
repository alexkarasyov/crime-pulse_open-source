# Specs History

## 2026-09-12

- Documented optional per-unit Compare baselines, shareable preferences, and accessible chart/monthly data inspection (P2.18–P2.19).
- Clarified exact index category controls and retained the calendar's labelled counts-only sparse fallback.
- Replaced the direct-refresh workflow with staged review and explicit acceptance (P2.21, ADR-011), and added maintained browser QA to release verification (P2.20).

## 2026-07-21

- Flipped the default unit from rate per 10,000 residents back to **raw incident counts**, with rates one toggle away; see ADR-009 (supersedes ADR-002 — the rate-default half only; denominators and rate availability unchanged). Directed by the project owner 2026-07-20.
- `overview.md`, charter, README, and AGENTS.md default-unit copy updated to match; AGENTS.md's "Do not" list now points at ADR-009 instead of forbidding count defaults.

## 2026-07-17

- Clarified the city/neighbourhood coverage contract: Toronto-wide series include all valid dated CSI records in the five supported categories, while neighbourhood surfaces exclude records that cannot be joined to the 158-neighbourhood model.
- Documented the generated reconciliation metadata and public disclosure for the unresolved-neighbourhood share; see ADR-008 and backlog P2.11.

## 2026-06-10

- Governance/docs drift pass (backlog P2.9): reconciled the spec and surrounding governance docs to current built reality, ~2–3 weeks behind the accepted ADRs.
- Corrected the data window in `overview.md` from "2014 onward" to **2016–2026** (2026 is YTD and excluded from comparable 10-year visuals), matching `scripts/import_tps_csi.py`.
- Removed all "Chart.js" references — trend, YoY, and small-multiples charts are **hand-rolled SVG rendered through Preact islands**; there is no Chart.js dependency.
- Updated `overview.md` from "planned" framing to current reality: the aggregation script (`scripts/build_aggregates.py`) and the static Cloudflare Pages web build both exist and ship.
- Companion governance fixes outside the spec: charter (GitHub Pages → Cloudflare Pages, drop Chart.js, reference the ADR set rather than "001–004"); roadmap + metrics (GTA → Toronto, cross-referencing ADR-001); AGENTS.md (reconciled "planned"/"no web build yet" to the built app + 158 neighbourhood pages); ai/testing.md + ai/data.md (Chart.js, weekly-cadence copy); deploy.md (`build_aggregates.py` is stdlib-only, not openpyxl); design-brief.md §3 (dated the pre-NSA-exclusion counts); replaced dead styleguide/ links in living docs; fixed a changelog typo.

## 2026-05-26

- Tightened v1 success from "at least 5 years, ideally 10" to a 10-year data target.
- Added `docs/data-sources.md` with researched official Toronto, GTA regional, and Statistics Canada source options.
- Repositioned v1 as Toronto-only (was "GTA"); see ADR-001. Overview, charter, README, and AGENTS.md user-visible copy updated to match.
- Made rate per 10,000 residents the default unit (was raw incident counts); see ADR-002. Added population-denominator section to `docs/data-sources.md`.
- Replaced the planned dot/cluster map with a 158-neighbourhood choropleth; see ADR-003.
- Inserted a build-time aggregation layer between the Markdown archive and the Astro pages so the dashboard reads pre-aggregated JSON; see ADR-004. Overview updated to describe the two-stage data flow.
