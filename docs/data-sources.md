# Data Sources

Source inventory for Crime Pulse v1 and likely follow-ons. V1 should use the Toronto source first because it is the only researched GTA source with clean, official, incident-level coverage back to 2014.

## Recommended v1 source

| Source | Coverage found | Shape | Fit |
|--------|----------------|-------|-----|
| City of Toronto / Toronto Police Service, `Community Safety Indicators` | Reported dates from 2014-01-01 through 2026-03-31 in the current CKAN datastore check; refreshed quarterly | CSV, JSON, XML, CKAN datastore; about 475k records | Primary v1 source. Supports 10-year trend graphs, neighbourhood filters, category filters, list views, and approximate map markers. |

Import notes:

- Current package name: `major-crime-indicators`, now titled `Community Safety Indicators`.
- Current CKAN datastore resource checked: `11581817-b148-4dd4-99c4-679649515ccc`.
- CSV download checked: `https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/6909ea60-ef0e-465f-b5d0-43106b6b9130/resource/174089c6-5a1a-42a5-8937-f9f25c72700a/download/community-safety-indicators.csv`.
- Fields include `EVENT_UNIQUE_ID`, `REPORT_DATE`, `OCC_DATE`, report and occurrence year/month/day/hour, `DIVISION`, `LOCATION_TYPE`, `PREMISES_TYPE`, `OFFENCE`, `CSI_CATEGORY`, old and new neighbourhood IDs/names, `LONG_WGS84`, and `LAT_WGS84`.
- Categories in this source are Assault, Break and Enter, Auto Theft, Robbery, and Theft Over. Sexual assaults are excluded by this source's notes.
- Locations can be blank or approximate; never present map points as exact addresses.

## Strong companion sources

| Source | Coverage found | Shape | Fit |
|--------|----------------|-------|-----|
| Toronto Police Service `Shootings & Firearm Discharges` | Since 2004; current package refresh checked as quarterly | CSV, GeoJSON, SHP, GPKG, CKAN datastore | Good v1.1 or v2 overlay for firearm-specific trends. Not a replacement for MCI/CSI because it answers a narrower question. |
| Toronto Police Service `Police Annual Statistical Report - Homicides` | Homicide occurrences by occurred date; current package refresh checked as quarterly | CSV, GeoJSON, SHP, GPKG, CKAN datastore | Good companion chart because homicide is high-salience and long-running, but too sparse for the main dashboard alone. |
| Toronto Police Service `Intimate Partner and Family Violence` | Annual reported-year data; current package refresh checked as annual | CSV, JSON, XML | Useful later for a Toronto-only thematic page. Treat separately from public map/list views because it is aggregated and sensitive. |
| Statistics Canada table `35-10-0177-01` | 1998 to 2024 | Annual table by geography and detailed violation | **Imported (2026-08-30)** for the Overview's *Toronto metro in context* card: Criminal Code rate per 100K at CMA granularity (Toronto CMA, Hamilton, Ottawa-Gatineau, Montréal, Vancouver, Calgary, Edmonton, Canada). Not incident-level; not suitable for map markers or feed rows. Toronto CMA includes GTA suburbs as one bucket — see [ADR-010](../project/decisions/010-cma-context-card-not-gta-suburbs.md). |
| Statistics Canada table `35-10-0026-01` | 1998 to 2024 | Annual Crime Severity Index and clearance rates by geography | Best context source for GTA/CMA-level trend baselines. Use for context cards, not incident feed or neighbourhood map. |

## Secondary GTA sources

| Source | Coverage found | Shape | Fit |
|--------|----------------|-------|-----|
| York Regional Police Community Safety Data | Public portal says data refreshes daily and dates back to 2019; historical layer checked showed occurrence dates 2021-2025, with a separate year-to-date layer | ArcGIS FeatureServer | Good post-v1 regional add-on, but not enough for a 10-year v1 and has strong disclaimers against safety comparisons over time. |
| Durham Regional Police Community Safety Data Portal | ArcGIS Hub categories include Auto Theft, Break and Enter, Robbery, Theft Over 5000, Drug Violations, and Firearm Shooting; Auto Theft layer checked at 2020-2026 | ArcGIS FeatureServer | Good post-v1 regional add-on, but not enough for 10-year v1. |
| Peel Regional Police crime statistics and maps | Public page has annual highlights and year-to-date tables; 2026 page shows 2023-2025 full-year columns and some longer specialty tables | HTML tables, crime map, annual reports | Useful context source, but not a clean 10-year incident-level import source from the pages checked. |
| Open Data Mississauga `crime-incidents` | About 41k reported Mississauga occurrences shown; page says source is City of Mississauga / Peel Regional Police data | Web dashboard / HTML-rendered records | Worth testing later for a Mississauga-only add-on. Current page is not the right primary source for a 10-year GTA dashboard. |
| Halton Regional Police crime stats | Current public crime stats page shows 2020-2024 totals and 5-year averages; crime map is hosted separately | HTML tables and third-party crime map | Useful context source only. Not enough for 10-year incident-level v1. |

## Population denominators

V1 reports rates per 10,000 residents (see [`../project/decisions/002-present-rates-not-counts.md`](../project/decisions/002-present-rates-not-counts.md)). Two denominators are needed: one keyed to the 158-neighbourhood polygon for the choropleth and Neighbourhood views, and one keyed to year for the city-wide trend headline. Both have been verified against the same neighbourhood-ID and reference-year basis the imported TPS CSI corpus uses.

### Per-neighbourhood population — City of Toronto Neighbourhood Profiles (2021 Census, 158-model)

| Source | Coverage found | Shape | Fit |
|--------|----------------|-------|-----|
| City of Toronto / Open Data Toronto, `Neighbourhood Profiles` package, resource `neighbourhood-profiles-2021-158-model` | One 2021 Census snapshot at City-of-Toronto 158-neighbourhood granularity, plus 2001/2006/2011/2016 at the older 140-neighbourhood granularity | XLSX for the 158-model file; CSV/XML/JSON for the older 140-model files; CKAN package | Primary v1 per-neighbourhood denominator. Joins on the same 158-neighbourhood IDs the TPS CSI corpus already uses (e.g. `Moss Park (73)`). |

Import notes:

- Open Data Toronto package: `neighbourhood-profiles` ([CKAN listing](https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/neighbourhood-profiles), [portal page](https://open.toronto.ca/dataset/neighbourhood-profiles/)). Package last updated 2026-02-20; refresh cadence is "as available" — in practice a one-off release per Census cycle.
- Resource for v1: `neighbourhood-profiles-2021-158-model` (resource ID `19d4a806-7385-4889-acf2-256f1e079060`). Direct download: `https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/6e19a90f-971c-46b3-852c-0c48c436d1fc/resource/19d4a806-7385-4889-acf2-256f1e079060/download/nbhd_2021_census_profile_full_158model.xlsx`.
- Format note: the 158-model release is **XLSX only** — there is no CSV/JSON sibling at this granularity. The 2016 release shipped a 140-neighbourhood CSV/JSON, but the boundaries changed on 2022-04-12 (140 → 158 social planning neighbourhoods, see the [City's About page](https://www.toronto.ca/city-government/data-research-maps/neighbourhoods-communities/neighbourhood-profiles/about-toronto-neighbourhoods/)). The 140-area file is **not** a valid join target for the imported CSI corpus because CSI uses the new 158-area IDs.
- License: Open Government Licence – Toronto ([canonical text](https://open.toronto.ca/open-data-licence/)). Worldwide, royalty-free, commercial use allowed; attribution required (`Contains information licensed under the Open Government Licence – Toronto.`). CKAN's metadata field currently shows "License not specified," but the portal-wide licence above applies to all Open Data Toronto datasets.
- Column we need: total population for each of the 158 neighbourhoods, from the row labelled **`Total - Age groups of the population - 25% sample data`**. The 158-model XLSX does NOT carry a 100% Census `Population, 2021` row — the City only publishes long-form sample totals at this granularity, which is the constraint pinned by [ADR-007](../project/decisions/007-per-neighbourhood-denominator-is-25pct-sample.md). Neighbourhood-ID column is the same `(id)` suffix used in TPS CSI (`Moss Park (73)`, `Annex (95)`, ...); the file's `Neighbourhood Number` field matches the parenthesised number in CSI's `NEIGHBOURHOOD_158`.
- Coverage / refresh: single Census-year snapshot (2021). Static for v1 — every 2022–2025 rate reuses the 2021 denominator. The next universal refresh is the 2026 Census release, expected to land in 2027 per StatCan's normal cycle.
- Caveats: (a) Population is a 2021 snapshot, not annual — disclose this in every per-neighbourhood rate per [ADR-002](../project/decisions/002-present-rates-not-counts.md). (b) Population is from the 2021 long-form 25% sample, not the 100% Census — see [ADR-007](../project/decisions/007-per-neighbourhood-denominator-is-25pct-sample.md). Across the 158 neighbourhoods the sample sum is ~1.18% below the 100% Census total; the bias is uniform and disclosed alongside every per-neighbourhood rate. (c) Census undercounts apply (more so for some neighbourhood demographics than others) but no neighbourhood-level alternative is available. (d) The XLSX layout pivots the geography across columns; the importer reads the "Neighbourhood Number" header row and the 25% sample population row, transposing rather than treating it as a tidy table.

### City-wide annual population — Statistics Canada CSD population estimates (table 17-10-0155-01)

| Source | Coverage found | Shape | Fit |
|--------|----------------|-------|-----|
| Statistics Canada, table `17-10-0155-01` "Population estimates, July 1, by census subdivision, 2021 boundaries" | Annual, 2001 through 2025 (released 2026-01-14); 2021-boundary geography; all 5,201 Canadian CSDs including `Toronto, City (C), Ontario` (DGUID `2021A00053520005`) | CSV (full-table ZIP) / SDMX / web table | Primary v1 city-wide denominator by year, used for the headline "Toronto's 10-year crime pulse" trend. |

Import notes:

- Source page: [`https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710015501`](https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=1710015501).
- Direct CSV download (full table, all CSDs in Canada): `https://www150.statcan.gc.ca/n1/tbl/csv/17100155-eng.zip`. The ZIP contains the data CSV plus a metadata sidecar; the importer filters by **`DGUID == "2021A00053520005"`** (unambiguous) and keeps the July-1 population estimate for reference years 2016 through 2025. The GEO label in the file is `"Toronto (C), Ontario"` (no `, City` segment) — filter on DGUID, not GEO, to avoid label-format drift between StatCan releases.
- License: Statistics Canada Open Licence ([canonical text](https://www.statcan.gc.ca/en/reference/licence)). Worldwide, royalty-free, commercial use allowed; attribution required (`Source: Statistics Canada, Table 17-10-0155-01.`).
- Coverage / refresh: annual, July 1 reference date. Revised estimates for the prior four years are republished with each release, so 2021–2024 will be revised when 2026 lands. Refresh cadence is annual, typically mid-January.
- Why CSD and not CMA: see [ADR-006](../project/decisions/006-city-wide-denominator-is-toronto-csd-not-cma.md). The Toronto Census Metropolitan Area (StatCan table `17-10-0148-01`) covers ~7.1M residents and spans Peel, York, Durham, and Halton; the TPS CSI numerator covers only the City of Toronto (~3.0M residents). Using the CMA as a denominator would understate the per-capita rate by more than half. ADR-002's original phrasing ("Toronto CMA population estimates") is superseded by this finding.
- Caveats: (a) Postcensal estimates for the most recent two reference years are preliminary and may be revised at the next release — the build emits the value as-of import date. (b) July 1 is mid-year, not year-end; for an annual rate this is conventional and matches how StatCan publishes its own Toronto crime rate tables (35-10-0177-01). (c) The 2020→2021 estimate shows a **~1.2% drop** — a post-2021-Census rebasing artifact, not actual population loss. Subsequent releases may revise it. The 2024→2025 estimate drops ~0.3% as a preliminary-year correction. The importer's validation must allow these documented rebasing dips rather than asserting strict YoY monotonicity.

### Choropleth geometry

Geometry for the choropleth (see [`../project/decisions/003-choropleth-map-not-incident-dots.md`](../project/decisions/003-choropleth-map-not-incident-dots.md)) comes from the City of Toronto's `Neighbourhoods` open-data package ([CKAN listing](https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/neighbourhoods)), specifically the current 158-neighbourhood GeoJSON resource (EPSG:4326). The polygon `AREA_LONG_CODE` / `AREA_SHORT_CODE` field matches the parenthesised IDs in both TPS CSI's `NEIGHBOURHOOD_158` and the Neighbourhood Profiles XLSX above, so the three sources join cleanly.

The upstream GeoJSON is **vendored in the repo** at [`../data/geo/neighbourhoods-4326.geojson`](../data/geo/neighbourhoods-4326.geojson) (since 2026-07-09), so `build_aggregates.py` — and therefore a deploy build — reads it off disk instead of fetching the CKAN endpoint. Re-download with `python3 scripts/build_aggregates.py --refresh-geojson` if the City ever revises the boundaries, and commit the result.

### Planned import path

Both denominator files land under [`../data/population/`](../data/population/) (directory will be created by the importer in backlog item P1.4b — not in scope for source research). Proposed layout:

- `data/population/toronto-neighbourhoods-2021.md` — one row per neighbourhood: `neighbourhood_id`, `neighbourhood_name`, `population_2021`. Sourced from `nbhd_2021_census_profile_full_158model.xlsx`.
- `data/population/toronto-csd-annual.md` — one row per year 2016–2025: `year`, `population_july1`, `source_release_date`. Sourced from `17100155-eng.zip`.
- `data/population/validation.json` — mirrors [`../data/crimes/tps-csi-validation.json`](../data/crimes/tps-csi-validation.json) shape: source URL, fetch timestamp, row count, geography spot-check (`Moss Park (73)` and `Annex (95)` populations from the neighbourhood file; `Toronto, City (C), Ontario` 2021 estimate from the CSD file — both verifiable against the published Census Profile).

Validation contract for the eventual importer:

- Neighbourhood file: exactly **158 rows**; every `neighbourhood_id` in the imported CSI corpus must appear in the population file (no orphan crime rows when the build joins); total of the 158 populations within **±2%** of the City of Toronto 100% 2021 Census total (2,794,356). The ±2% tolerance is wide enough to accept the documented 25% sample under-count ([ADR-007](../project/decisions/007-per-neighbourhood-denominator-is-25pct-sample.md)) without masking real data corruption.
- CSD annual file: exactly **10 rows** for v1 (2016 through 2025); `year` is the unique key; every `population_july1` value must fall within the range **[2,500,000, 3,500,000]** (a sanity bracket that catches importer bugs without penalising the documented 2020→2021 post-Census rebasing dip). Strict YoY monotonicity is NOT enforced — the rebasing artifact is known and documented as a caveat above.
- Both files are tiny (<200 rows total). Re-download is cheap; the importer should fetch fresh each run rather than incrementally update.

## Recommendation

V1 should be Toronto-first, not full-GTA-first:

1. Import 10 years of Toronto `Community Safety Indicators`, targeting 2016-2025 for full-year comparable charts and keeping 2026 year-to-date separately.
2. Aggregate the Markdown archive into per-neighbourhood and city-wide JSON files at build time, joining population denominators above to produce rate-per-10,000 figures (see [`../project/decisions/004-build-emits-aggregated-json.md`](../project/decisions/004-build-emits-aggregated-json.md)).
3. Render the dashboard from those JSON aggregates: annual and monthly views by `CSI_CATEGORY`, `OFFENCE`, and `NEIGHBOURHOOD_158`.
4. Add visible data notes that the 2021 Census denominator is reused for 2022-2025, categories are limited to the source's CSI set, sexual assault is excluded, and 2026 is year-to-date.
5. After v1 works, add York/Durham/Peel/Halton as separate regional modules only where their coverage and terms support the same comparison.
6. Use Statistics Canada annual tables as a context layer for rates and cross-region comparisons, not as a replacement for incident-level Toronto data.

## GTA expansion · Vaughan (research, 2026-05-27)

This section audits whether v1's Toronto-only scope (per [ADR-001](../project/decisions/001-v1-scope-is-toronto-not-gta.md)) can extend to the **City of Vaughan** — population 323,103 at 2021 Census, including the communities of Woodbridge, Maple, Concord, Kleinburg, and the Vaughan portion of Thornhill. Vaughan is policed by **York Regional Police** (YRP), not TPS. ADR-001's "When to revisit" clause asks for 10-year incident-level data on terms comparable to TPS CSI; this section measures the gap against that bar.

### Incidents — York Regional Police Community Safety Data Portal

| Source | Coverage found | Shape | Fit |
|--------|----------------|-------|-----|
| York Regional Police, `Historical Community Safety Data 2021 to 2025` (ArcGIS item `6ba41e1f3bfb4cd9bd0d89843a7d80f5`) plus `Year to Date Community Safety Data` (item `d89408f3c044424d91ada07cee849d55`) | Despite the dataset titles and the YRP item description ("dates back to 2019"), the actual `occ_date` minimum returned by the FeatureServer is **2021-01-01**; the historical layer's definition query is `occ_date BETWEEN 2021-01-01 AND 2025-01-01`. Effective full-year coverage is **2021–2024** (four years), with 2025+ in the current layer. | ArcGIS FeatureServer; query supports CSV / GeoJSON / Shapefile / FileGDB / KML / Excel export. Point geometry, EPSG:3857. | **Does not clear ADR-001's 10-year bar.** Also carries a commercial-use prohibition and a no-comparison disclaimer (see caveats). |

Source details:

- Hub portal: [`https://community-safety-portal-datayrp.hub.arcgis.com/`](https://community-safety-portal-datayrp.hub.arcgis.com/). The portal itself is a client-rendered ArcGIS Hub; dataset URLs and FAQ pages return empty bodies to non-JS fetchers, so the values below were verified by hitting the ArcGIS REST APIs directly rather than the human-facing portal.
- Historical FeatureServer (2021–2024): `https://services8.arcgis.com/lYI034SQcOoxRCR7/arcgis/rest/services/Occurrence_2016_to_2019/FeatureServer/0`. **The service path says `2016_to_2019` and the dataset's user-facing title says `2021 to 2025`, but the actual data covers 2021–2024**. A parallel service `Occurrence_Data_2020_to_2023` exists at the same host; queried directly it also returns `min(occ_date) = 2021-01-01`. YRP service names are not load-bearing.
- Year-to-date FeatureServer (2025+): `https://services8.arcgis.com/lYI034SQcOoxRCR7/arcgis/rest/services/Occurrence/FeatureServer/0`. Definition query filters to `occ_date > 2025-01-01`. Item description says "since 2024" but the layer is filtered to 2025+. Daily refresh ~3 AM (confirmed in item metadata).
- Fields: `UniqueIdentifier`, `case_type_pubtrans` ("Occurrence Detail", offence sub-type), `LocationCode`, `district` (YRP policing district), `municipality` (city — e.g. `Vaughan`), `Special_grouping`, `Shooting`, `hate_crime`, `case_status`, `occ_type` (broad category), `rep_date`, `time_est`, `occ_date`, plus point geometry.
- Coverage years actually verified (Vaughan-filtered queries against the historical FeatureServer): records with `occ_date < 2021-01-01` = **0**; records with `occ_date < 2022-01-01` = 11,829. The four full years 2021, 2022, 2023, 2024 are present; 2025 lives in the YTD layer.
- License / terms of use: YRP's own item-level disclaimer (verified verbatim against the ArcGIS item JSON for both services) states **"Any use of the information or data for commercial purposes is strictly prohibited,"** plus the standard "no representations, warranties or guarantees" and "data should not be used for safety comparisons between areas" language. This is **a different, stricter licence than York Region's Open Data Licence** — YRP overrides it for its crime data. Commercial-use prohibition is a hard blocker for any monetised or ad-supported deployment, and is at minimum a copy/disclosure constraint for a public non-commercial dashboard.
- Privacy: points are snapped to the nearest intersection, not the actual address. Same convention as TPS, slightly coarser than TPS's already-jittered coordinates.
- Categories actually present (counted by `groupBy occ_type` against Vaughan records, 2021-01-01 through 2024-12-31; total 25 distinct values, including all of: Assaults 6,340 · Break and Enter — Residential 1,326 · Break and Enter — Commercial 1,222 · Break and Enter — Other 39 · Robbery 598 · Theft of Motor Vehicle 6,253 · Theft Over $5000 1,102 · Theft Under $5000 15,631 · Fraud 7,065 · Mischief 4,119 · Sexual Violations 602 · Homicide 21 · Attempt Murder 46 · Drug Violations 1,314 · Firearms Violations 272 · Weapons Violations 601 · Arson 114 · Cannabis Act 229 · Impaired Operation 2,036 · Missing Person 813 · Other Persons Crime 5,497 · Other Property Crime 2,415 · Other Criminal Code 870 · Provincial Offences 354 · Public Morals 121). **All five TPS CSI categories map cleanly** — see reconciliation table below. Note that the public-facing renderer collapses these into 10 visual buckets (rolling Robbery and Theft Over into "Other"), but the underlying data exposes the granular breakdown queried above.
- **No data dictionary is published.** YRP does not publish a public data dictionary mapping `case_type_pubtrans` strings (offence sub-types) to the broad `occ_type` buckets. The mapping has to be inferred from the rendered values and from Statistics Canada's UCR codes. This is load-bearing: any category reconciliation we publish would be our derivation, not YRP's.
- Refresh: daily at ~03:00. Annual statistics reports (PDF) at [`https://annualreport.yrp.ca/statistical-information/`](https://annualreport.yrp.ca/statistical-information/) cover 2016+ but as aggregated tables, not incident-level data.

### Category reconciliation — YRP → TPS CSI (5 buckets)

| TPS CSI category | YRP `occ_type` mapping | Caveats |
|---|---|---|
| Assault | `Assaults` | TPS CSI's `Assault` bucket excludes sexual assault and aggregates several offence sub-types. YRP's `Assaults` bucket has no published definition; whether it includes domestic, aggravated, or weapons-involved assault as TPS does is **not documented**. The category sizes are plausibly comparable but a precise definition match cannot be asserted without a YRP data dictionary. |
| Auto Theft | `Theft of Motor Vehicle` | Cleanest mapping. Both sources use the StatCan UCR `Theft of Motor Vehicle` definition by convention. |
| Break and Enter | `Break and Enter - Residential` + `Break and Enter - Commercial` + `Break and Enter - Other` | YRP splits B&E into three sub-buckets; TPS combines them. Aggregation is mechanical and safe. |
| Robbery | `Robbery` | Clean mapping. |
| Theft Over | `Theft Over $5000` | Clean name match; both follow the $5,000 statutory threshold. |
| _(excluded from TPS CSI)_ | `Sexual Violations` | TPS CSI explicitly excludes sexual assault; v1 maintains that exclusion for parity. YRP's bucket would be dropped on import. |

The mapping is workable. The risk is not category names — it's the **absence of a published YRP data dictionary**, so we can't independently verify which offence sub-types land in each bucket year over year, or whether YRP has re-classified anything between 2021 and 2024.

### Boundaries — Vaughan as a polygon

**City-level (CSD) boundary**: The York Region Open Data portal ([`https://insights-york.opendata.arcgis.com/`](https://insights-york.opendata.arcgis.com/)) lists a `Municipal Boundary` dataset that, per the search-result snippet, "represents the regional/municipal boundaries which are frequently used in mapping, analysis and queries." The portal is ArcGIS-Hub-rendered and a direct FeatureServer URL could not be confirmed via WebFetch (hub pages return empty bodies). A fallback is StatCan's `Census subdivision boundary file` (DGUID `2021A00053519028`, Vaughan CY), which is downloadable as Shapefile/GML from [`https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm`](https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm) under the Statistics Canada Open Licence (commercial use permitted with attribution). Either source resolves the city polygon; the StatCan boundary is the safer choice because its licence is known-good for downstream redistribution.

**Sub-Vaughan (community) boundaries — Woodbridge, Maple, Concord, Kleinburg, Thornhill**: **No publicly downloadable boundary file was found** for these communities as a single, consistent geography. What exists:

- City of Vaughan publishes interactive viewers only (PLANit, City Viewer, Zoning Vaughan at [`https://www.arcgis.com/apps/PublicInformation/index.html?appid=49e2d8da815840c59058b412e6b30815`](https://www.arcgis.com/apps/PublicInformation/index.html?appid=49e2d8da815840c59058b412e6b30815)) — viewers, not downloads. **There is no open-data portal at vaughan.ca with a dataset catalogue.**
- The official "communities" page at [`https://www.vaughan.ca/explore-vaughan/communities`](https://www.vaughan.ca/explore-vaughan/communities) returned HTTP 403 to WebFetch and could not be inspected programmatically.
- The City publishes **Secondary Plans** (Woodbridge Centre, Concord GO Centre, Vaughan Mills, Maple GO Station, North Kleinburg-Nashville, West Vaughan Employment Area) — these are planning-policy areas covering parts of the city, not a full citywide community partition.
- The University of Toronto Map and Data Library hosts `City of Vaughan Navigator Plus` ([`https://mdl.library.utoronto.ca/collections/geospatial-data/city-vaughan-navigator-plus`](https://mdl.library.utoronto.ca/collections/geospatial-data/city-vaughan-navigator-plus)) but this is a licensed/subscription archive, not open data.
- Wards exist (City Council electoral boundaries, [`https://www.vaughan.ca/about-city-vaughan/projects-and-initiatives/city-government-projects/ward-boundary-review/current-ward-boundaries`](https://www.vaughan.ca/about-city-vaughan/projects-and-initiatives/city-government-projects/ward-boundary-review/current-ward-boundaries)) but they don't map onto the named communities residents recognise (Woodbridge ≠ Ward N).

Bottom line: a polygon set for "Woodbridge, Maple, Concord, Kleinburg, Thornhill (Vaughan portion)" would have to be hand-drawn from Census Tract aggregates or scraped from a Vaughan internal GIS layer that isn't published as open data.

### Population denominators

**City-level (Vaughan CSD)**: Already covered. StatCan table `17-10-0155-01` (already used for Toronto, see above) carries `Vaughan, City (CY), Ontario` (DGUID `2021A00053519028`) annually for 2001–2025. 2021 Census population is **323,103**; 2016 was 306,233 (+5.5%). Same licence (StatCan Open Licence) and same refresh cadence (annual, mid-January) as Toronto. No new import work needed — the existing CSD-by-DGUID importer would just pull a second row. ✅

**Sub-Vaughan (community)**: Vaughan's communities are **not Census-published geographies** — Statistics Canada has no `Woodbridge` or `Maple` aggregation. What's available:

- The City's own Economic Development arm publishes 2021-Census-derived city totals only ([`https://vaughanbusiness.ca/insights/2021-census-insights-and-findings-population-and-dwellings/`](https://vaughanbusiness.ca/insights/2021-census-insights-and-findings-population-and-dwellings/)). **No community-level breakdown** is published there.
- The Vaughan Community Health Centre PDF ([`http://www.vaughanchc.com/wp-content/uploads/2021/02/Community-Profile.pdf`](http://www.vaughanchc.com/wp-content/uploads/2021/02/Community-Profile.pdf)) returned 404 at fetch time; even if it had loaded, a single PDF report is not a sustainable refresh path for a 10-year dashboard.
- The only mechanical path is to **manually map Census Dissemination Areas (DAs) or Census Tracts (CTs) to each named community** by polygon overlay, then sum DA/CT populations. This is doable but is custom geography work, has no upstream owner, and would have to be revisited every Census cycle when DA/CT boundaries shift. It is also a Census-year snapshot (one denominator per cycle), not an annual series.

### Recommendation — **Path A · Park, with a note**

Vaughan does not clear ADR-001's "When to revisit" bar. The three blockers, in order of severity:

1. **Coverage is 4 years, not 10**. YRP's incident-level FeatureServer effectively starts 2021-01-01. ADR-001 set a 10-year bar; Vaughan's incident data is less than half that. The annual Statistics Reports go back further but are aggregated PDFs, not incident-level data, and would put Vaughan on a fundamentally different fidelity from Toronto.
2. **Commercial-use prohibition** on YRP data. TPS CSI ships under the Open Government Licence – Toronto (commercial use permitted). YRP's item-level disclaimer explicitly prohibits commercial use. Even a non-commercial public dashboard has to disclose the asymmetry, and any future revenue model (ads, sponsorship, even Patreon) becomes a legal question that doesn't exist on the Toronto side.
3. **No data dictionary**. YRP doesn't publish the offence-sub-type → bucket mapping, so the category reconciliation table above is our derivation. Any year-over-year reclassification on YRP's side would silently break our comparability story.

Sub-Vaughan granularity is a separate, deeper problem: **community-level boundaries and community-level population are both unpublished**. Even if the incident-data blockers were resolved, Path C (Woodbridge / Maple / Kleinburg / Concord / Thornhill as polygons) is infeasible without custom geography work that has no sustainable upstream maintainer.

Path B (Vaughan as a single CSD-level comparator polygon alongside Toronto's 158 neighbourhoods) is technically possible but rhetorically misleading: it would put a 323K-resident polygon next to ~10K-resident Toronto neighbourhoods on the same choropleth, visually invite the "compare Vaughan to Moss Park" reading that ADR-001 was written to prevent, and inherit YRP's "do not use for safety comparisons" disclaimer.

**The call**: stay on ADR-001. Document Vaughan-the-gap on the About page so users searching for "Vaughan crime stats" understand the project's scope deliberately, not accidentally.

**What would flip this to B or D**: YRP publishing pre-2021 incident data (closing the coverage gap to 10 years) **AND** an explicit OGL-style licence change permitting commercial use. Both would have to happen; either alone is insufficient. Path C would additionally require either a City-of-Vaughan-published community boundary file or a community-level population release — neither of which is on any visible roadmap.

### Open questions / things this research could not determine

- **YRP data dictionary**: no public mapping of `case_type_pubtrans` → `occ_type`. The reconciliation table above is inferred from rendered field values, not asserted by YRP.
- **YRP "Assault" bucket definition**: whether it parallels TPS's `Assault` CSI bucket (excluding sexual assault, including bodily harm and weapons) is undocumented.
- **Pre-2021 YRP incident data**: item descriptions say "back to 2019" or "back to 2016"; direct API queries returned zero records before 2021-01-01. Whether older data exists and is simply not on the public FeatureServer cannot be determined without contacting `businessIntelligence@yrp.ca`.
- **York Region Open Data Licence — full text**: the licence document at [`https://hub.arcgis.com/documents/78cc02388af248c0b7a30eda6adfade0`](https://hub.arcgis.com/documents/78cc02388af248c0b7a30eda6adfade0) returns only a title to WebFetch (client-rendered). The licence is widely described as OGL-Canada-compatible (commercial use permitted) but this section relies on that description, not on first-hand reading of the licence text. **YRP's commercial-use prohibition is item-level and overrides whatever the portal-wide licence says**, which is what matters for Vaughan crime data specifically.
- **City of Vaughan open data portal**: no evidence of one. The City publishes interactive viewers, not a dataset catalogue. A direct request to the City's GIS group at `gisapps@vaughan.ca` might surface internal layers that aren't on the public web, but that's procurement, not open data.
