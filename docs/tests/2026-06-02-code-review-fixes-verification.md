# Manual test — code-review fixes runtime verification

**Date**: 2026-06-02
**Scope**: commit `b397879` (code-review fixes) + `66edabb` merge, on `main`.
**Method**: production build (`npm run build`) served two ways —
`astro preview` for the static-output smoke checklist (curl), and the dev
server on `127.0.0.1:41690` driven through a headless browser for island
runtime behaviour. Console watched throughout.

## Static / deploy smoke (curl against the built `dist/`)

| Check | Result |
|---|---|
| `/`, `/compare/`, `/about/`, `/neighbourhood/`, `/neighbourhood/100/` | all **200** |
| `/favicon.svg`, `/robots.txt`, `/sitemap-index.xml` | all **200** |
| `/nope` (bad path) | **404**; branded `dist/404.html` is built (Cloudflare serves it for unknown paths — the local `astro preview` shows its own 404) |
| `robots.txt` (now a dynamic endpoint) | emits `Sitemap: https://crime-pulse.pages.dev/sitemap-index.xml` (absolute, tracks `SITE_URL`) |
| canonical + og:image host on `/` and `/neighbourhood/100/` | consistent `crime-pulse.pages.dev` host, trailing slashes present |

## Island runtime behaviour (headless browser)

1. ✅ **Overview** renders; hero "▲ 15.7% since 2016", peak "72 · 2024". No console errors.
2. ✅ **Map** — Leaflet choropleth renders **158 polygons** + 30 tiles. Sidebar legend reads **46 / 334 / 622** (non-zero) in default rate mode; "Highest rates" lists real neighbourhoods (Mimico-Queensway 622, …). Label says "… · 2025", not 2026. *(This was the all-zeros-in-rate-mode HIGH bug.)*
3. ✅ **Map hover panel** — hovering N°1 shows "West Humber-Clairville · ASSAULT (2025) 99 / 10K · YoY ▲ 1.5%". Real year, **no NaN/null**, no 2026. *(TorontoMap partial-filter + TorontoMapPanel dynamic-year fix.)*
4. ✅ **FilterBar year range** — setting End year → 2020 updated the hero (num 56, "▼ 7.9% since 2016", "5-yr peak · 2019", "2020 (rate)") **and** the category grid ("'16 → '20 ▼ 8% YoY ▼ 13.0%"). Dynamic labels + up/down direction both correct. *(HIGH #4 — Overview now honours yearRange.)*
5. ✅ **Unit toggle** → Counts: hero shows "22,847 incidents" (matches the aggregator's reported 2025 assault count exactly).
6. ✅ **Compare** page renders past the loading state (no hook-order crash on loading→loaded). No console errors.
7. 🔍 **Compare dedup/swap** — set slot 1 to N°73 (already in slot 2) → slots became **[73, 87, 143]** (swap, no duplicate), not [73, 73, 143].
8. 🔍 **Compare add/remove/floor** — "+ Add" → 4th slot N°129 (distinct); remove slot 2 → [73,143,129]; remove again → [143,129], at which point the × remove buttons disappear (cannot drop below 2) while "+ Add" remains.
9. ✅ **Neighbourhood** (Yonge-Eglinton, N°100) — calendar 120 cells (12×10); feed "SHOWING 1–14 OF 1,548"; **neighbours table N° 100,173,103,174,101,97,99,96,102** = exactly the GeoJSON-centroid nearest set (was numeric-id distance). Hero delta strip shows consistent arrows on all three cells. No console warnings.

## Findings

- ⚠️ **vs. Toronto cell in *count* mode reads "▼ 100%"** (NeighbourhoodHero). Comparing a single neighbourhood's incident *count* to the city total is ~−100% by construction — low-information, though technically correct. This is **pre-existing** behaviour (the cell has always used the active unit); the fix only made its formatting consistent and zero-baseline safe. In the default *rate* unit the cell is meaningful. Consider forcing this cell to rate regardless of the active unit (as the Compare table already does).
- No console errors or hydration warnings observed on any surface.
- Screenshot capture occasionally returned a blank frame on mid-page scroll (tooling timing); DOM queries used as primary evidence.

## Verdict

**PASS** — every code-review fix behaves correctly at runtime; no regressions or console errors observed across Overview, Map, FilterBar, Compare, and Neighbourhood.

## Not covered (needs the maintainer's accounts/env)

- **Real Cloudflare Pages deploy (P1.10)** — requires CF account access; verified the production build + static output locally as the closest stand-in. The CF build image's Python 3 / Node 20 / outbound-network requirements (per `docs/deploy.md`) are unverified until a first deploy.
- OG card rendering in a live social validator (needs a public URL).
