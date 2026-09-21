#!/usr/bin/env python3
"""Build pre-aggregated JSON artefacts from the TPS CSI Markdown archive.

This is the build-time aggregation step pinned by ADR-004
(``project/decisions/004-build-emits-aggregated-json.md``). The Astro pages
read these JSON files at runtime instead of re-parsing the full Markdown
corpus on every build.

Outputs (all under ``public/data/``):

1. ``aggregates/toronto-by-year.json`` — Toronto-wide totals + rates per 10K
   by year × category, plus a category-summed ``total_series``.
2. ``aggregates/by-neighbourhood-year.json`` — per-neighbourhood totals + rates
   by year × category.
3. ``aggregates/by-neighbourhood-month.json`` — per-neighbourhood monthly counts
   by year × month × category (no rates — too noisy for monthly slices).
4. ``aggregates/neighbourhood-incidents/{id}.json`` — per-neighbourhood incident
   feed (date, category, offence, premises_type only — per ADR-003 no coords).
   One file per neighbourhood, ID-keyed (158 files).
5. ``geo/toronto-neighbourhoods-158.geojson`` — the City's 158-area boundary
   GeoJSON, read from the vendored cache by default and slimmed. The raw
   upstream file is ~2MB because
   coordinates ship at ~13 decimal places (sub-micrometre precision) and
   feature properties carry 11 fields most of which are CKAN bookkeeping.
   We round coordinates to 4 decimals (~11m at this latitude, well below
   what the choropleth resolves) and keep only ``id`` + ``name`` properties.
   Output is written with compact JSON separators.

Rates:
- City-wide rate per 10K = ``count / city_population_by_year[year] * 10000``,
  from ``data/population/toronto-csd-annual.md`` (ADR-006).
- Per-neighbourhood rate per 10K = ``count / population_2021_sample25 * 10000``,
  from ``data/population/toronto-neighbourhoods-2021.md`` (ADR-007). The 2021
  denominator is reused for every year of the 2016–2025 window.

The script is idempotent: rerunning it produces byte-identical content except
for ``generated_at``. All JSON is written with ``sort_keys=True`` and rates
rounded to 2 decimals.

Stdlib-only. (``openpyxl`` is available in the venv but not needed here.)
"""

from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

from _md_table import iter_markdown_rows, split_pipe_row  # noqa: F401  (re-exported)


# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

SCHEMA_VERSION = 2

YEARS = tuple(range(2016, 2026))  # 2016–2025 inclusive (comparable full years)
PARTIAL_YEARS = (2026,)  # YTD, flagged partial; rate uncomputable (no denominator)

# TPS CSI raw category name -> camelCase ID used in the schemas + styleguide.
CATEGORY_MAP = {
    "Assault": "assault",
    "Auto Theft": "autoTheft",
    "Break and Enter": "breakEnter",
    "Robbery": "robbery",
    "Theft Over": "theftOver",
}
CATEGORY_IDS = ("assault", "autoTheft", "breakEnter", "robbery", "theftOver")

# Open Data Toronto Neighbourhoods package, 158-area GeoJSON in EPSG:4326.
# Confirmed live via package_show on 2026-05-26 — resource "Neighbourhoods - 4326.geojson".
GEOJSON_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/"
    "fc443770-ef0a-4025-9c2c-2cb558bfab00/resource/"
    "0719053b-28b7-48ea-b863-068823a93aaa/download/"
    "neighbourhoods-4326.geojson"
)
GEOJSON_ID_FIELD = "AREA_SHORT_CODE"  # matches CSI's (id) suffix + profile XLSX
GEOJSON_NAME_FIELD = "AREA_NAME"
GEOJSON_EXPECTED_FEATURES = 158

USER_AGENT = "crime-pulse-build/1.0"


# Size budget for each top-level aggregate (gzipped).
SIZE_BUDGET_BYTES = 200 * 1024

# Round GeoJSON coordinates to this many decimals before writing.
# At 43°N, 4 decimals ≈ 11m horizontal accuracy — well below the resolution
# the choropleth renders at any zoom we care about (neighbourhoods are
# kilometres wide). The upstream file ships ~13 decimals (sub-µm); trimming
# is what brings the file under the 200KB gzipped budget watched by ADR-004.
GEOJSON_COORD_PRECISION = 4


# --------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build pre-aggregated JSON artefacts for Toronto Crime Pulse."
    )
    parser.add_argument(
        "--crimes-dir",
        default="data/crimes",
        type=Path,
        help="Directory of imported TPS CSI Markdown tables.",
    )
    parser.add_argument(
        "--population-dir",
        default="data/population",
        type=Path,
        help="Directory of imported population denominators.",
    )
    parser.add_argument(
        "--out-dir",
        default="public/data",
        type=Path,
        help="Root directory for generated public artefacts.",
    )
    parser.add_argument(
        "--geojson-url",
        default=GEOJSON_URL,
        help="URL of the 158-area Neighbourhoods GeoJSON (EPSG:4326).",
    )
    parser.add_argument(
        "--geojson-cache",
        default="data/geo/neighbourhoods-4326.geojson",
        type=Path,
        help=(
            "Path of the committed upstream GeoJSON (vendored under data/ so a "
            "deploy build needs no network; --refresh-geojson re-downloads it)."
        ),
    )
    parser.add_argument(
        "--refresh-geojson",
        action="store_true",
        help="Force re-download of the GeoJSON even if the cache exists.",
    )
    return parser.parse_args()


# --------------------------------------------------------------------------
# Population readers
# --------------------------------------------------------------------------


_NID_SUFFIX_RE = re.compile(r"\((\d+)\)\s*$")


def read_neighbourhood_populations(population_dir: Path) -> dict[int, dict[str, object]]:
    """Read per-neighbourhood 2021 sample-25 populations.

    Returns {id: {"id": str, "name": str, "population": int}}.
    Keys are int for internal joins; the schemas serialise IDs as strings.
    """
    path = population_dir / "toronto-neighbourhoods-2021.md"
    rows = iter_markdown_rows(path)
    out: dict[int, dict[str, object]] = {}
    for row in rows:
        nid = int(row["neighbourhood_id"])
        out[nid] = {
            "id": str(nid),
            "name": row["neighbourhood_name"],
            "population": int(row["population_2021_sample25"]),
        }
    if len(out) != 158:
        raise RuntimeError(
            f"Expected 158 neighbourhood rows in {path}, got {len(out)}."
        )
    return out


def read_city_populations(population_dir: Path) -> dict[int, int]:
    """Read Toronto CSD July-1 population by year."""
    path = population_dir / "toronto-csd-annual.md"
    rows = iter_markdown_rows(path)
    out: dict[int, int] = {}
    for row in rows:
        out[int(row["year"])] = int(row["population_july1"])
    missing = [y for y in YEARS if y not in out]
    if missing:
        raise RuntimeError(
            f"Missing city population rows for years {missing!r} in {path}."
        )
    return out


# --------------------------------------------------------------------------
# CSI corpus reader
# --------------------------------------------------------------------------


def parse_csi_row(
    row: dict[str, str], year: int
) -> tuple[int | None, int, str, dict[str, str]] | None:
    """Normalise one Markdown row.

    Returns (neighbourhood_id, month, category_id, incident_dict) or None
    if the row is unusable for every surface (unmapped category or bad date).
    A missing neighbourhood is represented by ``neighbourhood_id=None`` so
    the record still contributes to the Toronto-wide series while remaining
    excluded from neighbourhood-resolved views.
    """
    raw_category = row.get("category", "").strip()
    category_id = CATEGORY_MAP.get(raw_category)
    if category_id is None:
        # Surprising — every imported row should have one of the 5 categories.
        return None

    report_date = row.get("report_date", "").strip()
    # The Markdown archive is canonical and may be edited independently of
    # the importer. Validate a real calendar date as well as its shape, then
    # assert the row's year matches the file's year so that
    # any cross-year mis-filing (e.g. a row landing in the wrong yearly table)
    # is caught loudly instead of skewing a year's totals.
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", report_date):
        return None
    try:
        parsed_date = date.fromisoformat(report_date)
    except ValueError:
        return None
    row_year = parsed_date.year
    if row_year != year:
        raise RuntimeError(
            f"report_date {report_date!r} has year {row_year} but appears in the "
            f"tps-csi-{year}.md table; the yearly tables are mis-filed."
        )
    month = parsed_date.month

    nbhd_cell = row.get("neighbourhood", "").strip()
    match = _NID_SUFFIX_RE.search(nbhd_cell)
    nid = int(match.group(1)) if match else None

    incident = {
        "date": report_date,
        "category": category_id,
        "offence": row.get("offence", "").strip(),
        "premises_type": row.get("premises_type", "").strip(),
    }
    return nid, month, category_id, incident


def read_csi_corpus(crimes_dir: Path) -> dict[str, object]:
    """Read all yearly Markdown tables and bucket them for aggregation.

    Returns a dict with:
      - ``yearly_totals``: {year: {category_id: count}}
      - ``yearly_by_nbhd``: {(year, nid): {category_id: count}}
      - ``monthly_by_nbhd``: {(year, month, nid): {category_id: count}}
      - ``incidents_by_nbhd``: {nid: [incident_dict, ...]}
      - ``total_rows``: int
      - ``unmapped_categories``: Counter
      - ``rows_missing_nbhd``: int — rows dropped for a missing/unparseable
        neighbourhood ID from neighbourhood-resolved outputs. These rows are
        still included in ``yearly_totals`` for honest Toronto-wide counts.
      - ``yearly_unresolved``: {year: {category_id: count}} for the records
        included city-wide but omitted from neighbourhood views.
      - ``rows_bad_date``: int — rows dropped for a malformed report_date.
        Tracked separately so date-format drift isn't mislabelled as a
        neighbourhood problem in the WARNING output.
      - ``nbhd_ids_seen``: set[int]
      - ``partial_years_loaded``: set[int] — partial years whose file was
        actually read. The builders gate on this (not on the pre-seeded
        ``yearly_totals`` keys) so a missing YTD file never emits a phantom
        "0 incidents" partial point.
    """
    all_years = tuple(YEARS) + tuple(PARTIAL_YEARS)
    yearly_totals: dict[int, Counter[str]] = {y: Counter() for y in all_years}
    yearly_unresolved: dict[int, Counter[str]] = {y: Counter() for y in all_years}
    monthly_totals: dict[tuple[int, int], Counter[str]] = defaultdict(Counter)
    monthly_unresolved: dict[tuple[int, int], Counter[str]] = defaultdict(Counter)
    yearly_by_nbhd: dict[tuple[int, int], Counter[str]] = defaultdict(Counter)
    monthly_by_nbhd: dict[tuple[int, int, int], Counter[str]] = defaultdict(Counter)
    incidents_by_nbhd: dict[int, list[dict[str, str]]] = defaultdict(list)
    nbhd_ids_seen: set[int] = set()
    unmapped_categories: Counter[str] = Counter()
    partial_years_loaded: set[int] = set()
    rows_missing_nbhd = 0
    rows_bad_date = 0
    total_rows = 0

    for year in all_years:
        path = crimes_dir / f"tps-csi-{year}.md"
        if not path.exists():
            # Partial years are optional — skip silently if not yet imported.
            if year in PARTIAL_YEARS:
                continue
            raise RuntimeError(f"Missing CSI Markdown file: {path}")
        if year in PARTIAL_YEARS:
            partial_years_loaded.add(year)
        rows = iter_markdown_rows(path)
        print(f"  {path.name}: {len(rows):,} rows")
        for row in rows:
            total_rows += 1
            parsed = parse_csi_row(row, year)
            if parsed is None:
                # Classify *why* the row was dropped so the WARNING output can
                # distinguish category and date problems — each points at a
                # different kind of upstream drift.
                raw_cat = row.get("category", "").strip()
                if raw_cat and raw_cat not in CATEGORY_MAP:
                    unmapped_categories[raw_cat] += 1
                else:
                    rows_bad_date += 1
                continue
            nid, month, category_id, incident = parsed
            yearly_totals[year][category_id] += 1
            monthly_totals[(year, month)][category_id] += 1
            if nid is None:
                rows_missing_nbhd += 1
                yearly_unresolved[year][category_id] += 1
                monthly_unresolved[(year, month)][category_id] += 1
                continue
            nbhd_ids_seen.add(nid)
            yearly_by_nbhd[(year, nid)][category_id] += 1
            monthly_by_nbhd[(year, month, nid)][category_id] += 1
            incidents_by_nbhd[nid].append(incident)

    return {
        "yearly_totals": yearly_totals,
        "yearly_unresolved": yearly_unresolved,
        "monthly_totals": monthly_totals,
        "monthly_unresolved": monthly_unresolved,
        "yearly_by_nbhd": yearly_by_nbhd,
        "monthly_by_nbhd": monthly_by_nbhd,
        "incidents_by_nbhd": incidents_by_nbhd,
        "total_rows": total_rows,
        "unmapped_categories": unmapped_categories,
        "rows_missing_nbhd": rows_missing_nbhd,
        "rows_bad_date": rows_bad_date,
        "nbhd_ids_seen": nbhd_ids_seen,
        "partial_years_loaded": partial_years_loaded,
    }


def read_import_metadata(crimes_dir: Path) -> dict[str, object]:
    """Read data-freshness metadata from the importer's validation report.

    The site's freshness displays must reflect when the TPS corpus was
    imported and the latest report date it covers — not ``generated_at``,
    which advances on every local aggregate rerun. Returns nulls when the
    report is missing so hand-assembled corpora still build.
    """
    path = crimes_dir / "tps-csi-validation.json"
    if not path.exists():
        return {"imported_at": None, "data_through": None, "partial_year_through": {}}
    with path.open("r", encoding="utf-8") as handle:
        report = json.load(handle)
    imported_at = (report.get("source") or {}).get("imported_at")
    years = report.get("years") or {}
    max_dates = [
        info.get("max_report_date")
        for info in years.values()
        if info.get("max_report_date")
    ]
    partial_through = {
        str(y): years[str(y)]["max_report_date"]
        for y in PARTIAL_YEARS
        if str(y) in years and years[str(y)].get("max_report_date")
    }
    return {
        "imported_at": imported_at,
        "data_through": max(max_dates) if max_dates else None,
        "partial_year_through": partial_through,
    }


# --------------------------------------------------------------------------
# GeoJSON
# --------------------------------------------------------------------------


def fetch_geojson(
    url: str, cache: Path, refresh: bool
) -> tuple[dict[str, object], bytes | None]:
    """Fetch + parse the 158-area Neighbourhoods GeoJSON.

    Returns ``(geojson, raw_bytes)``; ``raw_bytes`` is None when served from
    cache. The caller must write the cache only after validation passes, so a
    bad download (HTML error page, truncated body) can never overwrite a good
    cached copy.
    """
    if cache.exists() and not refresh:
        print(f"  using cached GeoJSON at {cache}")
        with cache.open("r", encoding="utf-8") as handle:
            return json.load(handle), None

    print(f"  fetching {url}")
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=120) as response:
        raw = response.read()
    try:
        geo = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise SystemExit(
            f"Downloaded GeoJSON is not valid JSON ({exc}); "
            f"cache at {cache} left untouched."
        ) from exc
    return geo, raw


def write_geojson_cache(cache: Path, raw: bytes) -> None:
    """Persist a validated GeoJSON download atomically."""
    cache.parent.mkdir(parents=True, exist_ok=True)
    tmp = cache.with_suffix(cache.suffix + ".tmp")
    tmp.write_bytes(raw)
    tmp.replace(cache)
    print(f"  cached at {cache} ({len(raw):,} bytes)")


def _round_coords(node: object, precision: int) -> object:
    """Recursively round all numeric leaves in a GeoJSON coordinates tree."""
    if isinstance(node, list):
        # Fast path for the innermost [lng, lat] pair (and optional altitude).
        if node and not isinstance(node[0], list):
            return [round(v, precision) if isinstance(v, (int, float)) else v for v in node]
        return [_round_coords(child, precision) for child in node]
    if isinstance(node, (int, float)):
        return round(node, precision)
    return node


def slim_geojson(geo: dict[str, object]) -> dict[str, object]:
    """Slim the upstream GeoJSON for shipping.

    - Drop every property except the join key (``id``) and ``name``.
    - Round coordinates to ``GEOJSON_COORD_PRECISION`` decimals.
    - Sort features by neighbourhood ID so output is deterministic.
    """
    features_out: list[dict[str, object]] = []
    for feat in geo.get("features", []):
        props = feat.get("properties") or {}
        nid_raw = props.get(GEOJSON_ID_FIELD)
        name = props.get(GEOJSON_NAME_FIELD)
        try:
            nid_int = int(nid_raw)
        except (TypeError, ValueError):
            # validate_geojson already flagged anything truly bad; skip safely here.
            continue
        geometry = feat.get("geometry")
        if geometry and "coordinates" in geometry:
            geometry = {
                "type": geometry["type"],
                "coordinates": _round_coords(
                    geometry["coordinates"], GEOJSON_COORD_PRECISION
                ),
            }
        features_out.append(
            {
                "type": "Feature",
                "properties": {"id": str(nid_int), "name": name},
                "geometry": geometry,
            }
        )
    features_out.sort(key=lambda f: int(f["properties"]["id"]))
    return {"type": "FeatureCollection", "features": features_out}


def validate_geojson(geo: dict[str, object], expected_ids: set[int]) -> list[str]:
    errors: list[str] = []
    if geo.get("type") != "FeatureCollection":
        errors.append(f"GeoJSON top-level type is {geo.get('type')!r}, not FeatureCollection.")
        return errors
    features = geo.get("features") or []
    if len(features) != GEOJSON_EXPECTED_FEATURES:
        errors.append(
            f"GeoJSON has {len(features)} features, expected {GEOJSON_EXPECTED_FEATURES}."
        )
    ids_seen: set[int] = set()
    for feat in features:
        props = feat.get("properties") or {}
        raw_id = props.get(GEOJSON_ID_FIELD)
        if raw_id is None:
            errors.append(f"Feature missing {GEOJSON_ID_FIELD}: {props!r}")
            continue
        try:
            ids_seen.add(int(raw_id))
        except (TypeError, ValueError):
            errors.append(f"Non-integer {GEOJSON_ID_FIELD}={raw_id!r}")
    missing_in_aggregates = sorted(ids_seen - expected_ids)
    if missing_in_aggregates:
        errors.append(
            "GeoJSON neighbourhood IDs missing from aggregates: "
            f"{missing_in_aggregates!r}"
        )
    missing_in_geo = sorted(expected_ids - ids_seen)
    if missing_in_geo:
        errors.append(
            "Aggregate neighbourhood IDs missing from GeoJSON: "
            f"{missing_in_geo!r}"
        )
    return errors


# --------------------------------------------------------------------------
# Aggregate builders
# --------------------------------------------------------------------------


def round_rate(value: float) -> float:
    return round(value, 2)


def build_toronto_by_year(
    yearly_totals: dict[int, Counter[str]],
    city_pop: dict[int, int],
    generated_at: str,
    partial_years_loaded: set[int],
    yearly_unresolved: dict[int, Counter[str]] | None = None,
) -> dict[str, object]:
    unresolved = yearly_unresolved or {}
    series: dict[str, list[dict[str, object]]] = {cat: [] for cat in CATEGORY_IDS}
    total_series: list[dict[str, object]] = []
    for year in YEARS:
        pop = city_pop[year]
        year_total = 0
        for cat in CATEGORY_IDS:
            count = int(yearly_totals[year].get(cat, 0))
            year_total += count
            rate = round_rate(count / pop * 10000.0)
            series[cat].append({"year": year, "count": count, "rate_per_10k": rate})
        total_rate = round_rate(year_total / pop * 10000.0)
        total_series.append(
            {"year": year, "count": year_total, "rate_per_10k": total_rate}
        )
    # Partial (YTD) year — appended after the full years. rate_per_10k = null
    # because the denominator is unknown (population projects forward; the
    # year isn't done). UI checks `partial` to decide whether to include it.
    # Gated on partial_years_loaded (file actually read), not yearly_totals —
    # the latter is pre-seeded with empty Counters, so a missing YTD file
    # would otherwise emit a phantom "0 incidents YTD" point.
    for year in PARTIAL_YEARS:
        if year not in partial_years_loaded:
            continue
        year_total = 0
        for cat in CATEGORY_IDS:
            count = int(yearly_totals[year].get(cat, 0))
            year_total += count
            series[cat].append({"year": year, "count": count, "rate_per_10k": None, "partial": True})
        total_series.append(
            {"year": year, "count": year_total, "rate_per_10k": None, "partial": True}
        )
    emitted_years = list(YEARS) + [
        year for year in PARTIAL_YEARS if year in partial_years_loaded
    ]
    resolution_by_year: dict[str, dict[str, object]] = {}
    all_incidents = 0
    all_unresolved = 0
    for year in emitted_years:
        total = sum(int(yearly_totals[year].get(cat, 0)) for cat in CATEGORY_IDS)
        unresolved_by_category = {
            cat: int(unresolved.get(year, Counter()).get(cat, 0))
            for cat in CATEGORY_IDS
        }
        unresolved_total = sum(unresolved_by_category.values())
        all_incidents += total
        all_unresolved += unresolved_total
        resolution_by_year[str(year)] = {
            "total_incidents": total,
            "resolved_incidents": total - unresolved_total,
            "unresolved_incidents": unresolved_total,
            "unresolved_by_category": unresolved_by_category,
        }

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "years": list(YEARS),
        "partial_years": sorted(partial_years_loaded),
        "categories": list(CATEGORY_IDS),
        "city_population_by_year": {str(y): city_pop[y] for y in YEARS},
        "series": series,
        "total_series": total_series,
        "neighbourhood_resolution": {
            "total_incidents": all_incidents,
            "resolved_incidents": all_incidents - all_unresolved,
            "unresolved_incidents": all_unresolved,
            "unresolved_pct": round(
                (all_unresolved / all_incidents * 100.0) if all_incidents else 0.0,
                3,
            ),
            "by_year": resolution_by_year,
        },
    }


def build_by_neighbourhood_year(
    yearly_by_nbhd: dict[tuple[int, int], Counter[str]],
    neighbourhoods: dict[int, dict[str, object]],
    generated_at: str,
    partial_years_loaded: set[int],
) -> dict[str, object]:
    out: dict[str, dict[str, object]] = {}
    for nid in sorted(neighbourhoods):
        info = neighbourhoods[nid]
        pop = int(info["population"])
        series: dict[str, list[dict[str, object]]] = {cat: [] for cat in CATEGORY_IDS}
        total_series: list[dict[str, object]] = []
        for year in YEARS:
            year_total = 0
            for cat in CATEGORY_IDS:
                count = int(yearly_by_nbhd.get((year, nid), Counter()).get(cat, 0))
                year_total += count
                rate = round_rate(count / pop * 10000.0) if pop else 0.0
                series[cat].append(
                    {"year": year, "count": count, "rate_per_10k": rate}
                )
            total_rate = round_rate(year_total / pop * 10000.0) if pop else 0.0
            total_series.append(
                {"year": year, "count": year_total, "rate_per_10k": total_rate}
            )
        # Partial year(s) — counts only, no rate. Same gate as the city-wide
        # builder so the two aggregates always agree on the year axis.
        for year in PARTIAL_YEARS:
            if year not in partial_years_loaded:
                continue
            year_total = 0
            for cat in CATEGORY_IDS:
                count = int(yearly_by_nbhd.get((year, nid), Counter()).get(cat, 0))
                year_total += count
                series[cat].append(
                    {"year": year, "count": count, "rate_per_10k": None, "partial": True}
                )
            total_series.append(
                {"year": year, "count": year_total, "rate_per_10k": None, "partial": True}
            )
        out[str(nid)] = {
            "id": str(nid),
            "name": info["name"],
            "population": pop,
            "series": series,
            "total_series": total_series,
        }
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "partial_years": sorted(partial_years_loaded),
        "neighbourhoods": out,
    }


def build_by_neighbourhood_month(
    monthly_by_nbhd: dict[tuple[int, int, int], Counter[str]],
    neighbourhoods: dict[int, dict[str, object]],
    generated_at: str,
) -> dict[str, object]:
    # DELIBERATELY full-years-only: this aggregate iterates YEARS (2016–2025)
    # and never PARTIAL_YEARS. The frontend calendar UI renders only complete
    # calendar years (12 months per year), so emitting the in-progress YTD
    # year's partial months would surface visually-incomplete final-year cells
    # that read as a sudden cliff in monthly activity. ``monthly_by_nbhd`` may
    # contain YTD months (the corpus reader buckets every loaded year), but
    # they are intentionally dropped here. Do NOT add PARTIAL_YEARS or emit a
    # ``partial`` flag — the calendar reads YEARS only and the schema must not
    # change. The full-year city/neighbourhood-year aggregates DO carry the
    # YTD point (for the trend charts); the calendar is the one view that does
    # not, and that asymmetry is intended.
    out: dict[str, dict[str, object]] = {}
    for nid in sorted(neighbourhoods):
        info = neighbourhoods[nid]
        series: dict[str, list[dict[str, object]]] = {cat: [] for cat in CATEGORY_IDS}
        for cat in CATEGORY_IDS:
            for year in YEARS:
                for month in range(1, 13):
                    count = int(
                        monthly_by_nbhd.get((year, month, nid), Counter()).get(cat, 0)
                    )
                    series[cat].append(
                        {"year": year, "month": month, "count": count}
                    )
        out[str(nid)] = {
            "id": str(nid),
            "name": info["name"],
            "series": series,
        }
    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": generated_at,
        "neighbourhoods": out,
    }


def build_incident_feed(
    incidents_by_nbhd: dict[int, list[dict[str, str]]],
    neighbourhoods: dict[int, dict[str, object]],
) -> dict[int, dict[str, object]]:
    """Per-neighbourhood incident feed, newest first."""
    feeds: dict[int, dict[str, object]] = {}
    for nid, info in neighbourhoods.items():
        rows = incidents_by_nbhd.get(nid, [])
        # Newest first: sort descending by date, then a deterministic secondary key.
        rows_sorted = sorted(
            rows,
            key=lambda r: (r["date"], r["category"], r["offence"], r["premises_type"]),
            reverse=True,
        )
        feeds[nid] = {
            "id": str(nid),
            "name": info["name"],
            "incidents": rows_sorted,
        }
    return feeds


# --------------------------------------------------------------------------
# Validation
# --------------------------------------------------------------------------


def validate_monthly_corpus(corpus: dict[str, object]) -> list[str]:
    """Reconcile every imported month, including YTD and unresolved records."""
    errors: list[str] = []
    if corpus["rows_bad_date"] or corpus["unmapped_categories"]:
        errors.append(
            f"Invalid source rows: bad dates={corpus['rows_bad_date']}, "
            f"unsupported categories={dict(corpus['unmapped_categories'])!r}."
        )
    resolved = defaultdict(Counter)
    for (year, month, _nid), counts in corpus["monthly_by_nbhd"].items():
        resolved[(year, month)].update(counts)
    for year, totals in corpus["yearly_totals"].items():
        for cat in CATEGORY_IDS:
            city_months = sum(corpus["monthly_totals"].get((year, m), {}).get(cat, 0) for m in range(1, 13))
            unresolved_months = sum(corpus["monthly_unresolved"].get((year, m), {}).get(cat, 0) for m in range(1, 13))
            if city_months != totals.get(cat, 0):
                errors.append(f"City monthly/yearly mismatch: {year} {cat}.")
            if unresolved_months != corpus["yearly_unresolved"][year].get(cat, 0):
                errors.append(f"Unresolved monthly/yearly mismatch: {year} {cat}.")
            for month in range(1, 13):
                city = corpus["monthly_totals"].get((year, month), {}).get(cat, 0)
                unknown = corpus["monthly_unresolved"].get((year, month), {}).get(cat, 0)
                if city != resolved[(year, month)].get(cat, 0) + unknown:
                    errors.append(f"City monthly resolution mismatch: {year}-{month:02d} {cat}.")
    return errors


def validate_aggregates(
    toronto: dict[str, object],
    by_year: dict[str, object],
    by_month: dict[str, object],
    incident_feeds: dict[int, dict[str, object]],
    neighbourhoods: dict[int, dict[str, object]],
) -> list[str]:
    errors: list[str] = []

    # 1. All 10 full years in toronto-by-year, plus optional PARTIAL_YEARS
    # tacked on the end (each marked partial: True with rate_per_10k: None).
    partial_present = [y for y in PARTIAL_YEARS if any(
        p["year"] == y for cat in CATEGORY_IDS for p in toronto["series"][cat]
    )]
    expected = list(YEARS) + partial_present
    for cat in CATEGORY_IDS:
        years = [point["year"] for point in toronto["series"][cat]]
        if years != expected:
            errors.append(
                f"toronto-by-year.{cat} year axis is {years!r}, expected {expected!r}."
            )

    # 2. 158 neighbourhoods in both year and month aggregates.
    if len(by_year["neighbourhoods"]) != 158:
        errors.append(
            f"by-neighbourhood-year has {len(by_year['neighbourhoods'])} neighbourhoods, expected 158."
        )
    if len(by_month["neighbourhoods"]) != 158:
        errors.append(
            f"by-neighbourhood-month has {len(by_month['neighbourhoods'])} neighbourhoods, expected 158."
        )

    # The calendar emits full years only; every category's twelve cells must
    # sum exactly to the same neighbourhood's annual chart value.
    month_errors: list[str] = []
    for nid, nbhd in by_year["neighbourhoods"].items():
        monthly = by_month["neighbourhoods"].get(nid, {}).get("series", {})
        for cat in CATEGORY_IDS:
            points = monthly.get(cat, [])
            axis = [(p["year"], p["month"]) for p in points]
            if axis != [(y, m) for y in YEARS for m in range(1, 13)]:
                month_errors.append(f"{nid} {cat}: incomplete or duplicate monthly axis")
            annual = {p["year"]: p["count"] for p in nbhd["series"][cat]}
            for year in YEARS:
                total = sum(p["count"] for p in points if p["year"] == year)
                if total != annual.get(year):
                    month_errors.append(f"{nid} {cat} {year}: months={total}, annual={annual.get(year)}")
    if month_errors:
        errors.append("Monthly totals do not reconcile with yearly totals:\n    " + "\n    ".join(month_errors))

    # 3. Per-neighbourhood incident totals reconcile with yearly counts.
    feed_mismatches: list[str] = []
    for nid, nbhd in by_year["neighbourhoods"].items():
        yearly_total = sum(
            point["count"]
            for cat in CATEGORY_IDS
            for point in nbhd["series"][cat]
        )
        feed_total = len(incident_feeds[int(nid)]["incidents"])
        # Both totals are derived from the same in-memory rows, so they must
        # be exactly equal — any drift is a builder bug, and a percentage
        # tolerance would only mask it.
        if feed_total != yearly_total:
            feed_mismatches.append(
                f"{nid} ({nbhd['name']}): feed={feed_total} vs yearly_sum={yearly_total}"
            )
    if feed_mismatches:
        errors.append(
            "Per-neighbourhood incident feed totals do not reconcile:\n    "
            + "\n    ".join(feed_mismatches)
        )

    # 4. Toronto-wide totals reconcile with the sum of resolved neighbourhood
    # totals plus the explicitly-tracked unresolved-neighbourhood records.
    toronto_by_cat_year: dict[tuple[str, int], int] = {}
    for cat in CATEGORY_IDS:
        for point in toronto["series"][cat]:
            toronto_by_cat_year[(cat, point["year"])] = point["count"]

    nbhd_sum_by_cat_year: dict[tuple[str, int], int] = defaultdict(int)
    for nbhd in by_year["neighbourhoods"].values():
        for cat in CATEGORY_IDS:
            for point in nbhd["series"][cat]:
                nbhd_sum_by_cat_year[(cat, point["year"])] += point["count"]

    reconcile_errors: list[str] = []
    resolution_by_year = toronto.get("neighbourhood_resolution", {}).get("by_year", {})
    for key, city_count in toronto_by_cat_year.items():
        nbhd_count = nbhd_sum_by_cat_year.get(key, 0)
        year_resolution = resolution_by_year.get(str(key[1]), {})
        unresolved_count = year_resolution.get("unresolved_by_category", {}).get(
            key[0], 0
        )
        if nbhd_count + unresolved_count != city_count:
            reconcile_errors.append(
                f"{key[0]} {key[1]}: toronto={city_count} vs "
                f"nbhd_sum={nbhd_count} + unresolved={unresolved_count}"
            )
    if reconcile_errors:
        errors.append(
            "Toronto totals do not equal neighbourhood totals plus unresolved rows:\n    "
            + "\n    ".join(reconcile_errors)
        )

    return errors


# --------------------------------------------------------------------------
# Writers
# --------------------------------------------------------------------------


def build_cma_context(cma_dir: Path, generated_at: str) -> dict[str, object] | None:
    """
    Read data/cma/cma-rates-by-geography.md (produced by scripts/import_cma_rates.py)
    and shape it for the Overview's CmaCompareCard.
    """
    path = cma_dir / "cma-rates-by-geography.md"
    if not path.exists():
        return None
    rows = iter_markdown_rows(path)
    by_geo: dict[str, list[dict[str, object]]] = {}
    years_seen: set[int] = set()
    for row in rows:
        try:
            year = int(row["year"])
        except (KeyError, ValueError):
            continue
        label = row.get("geography", "").strip()
        if not label:
            continue
        raw = (row.get("rate_per_100k") or "").strip()
        rate: float | None
        try:
            rate = float(raw) if raw else None
        except ValueError:
            rate = None
        by_geo.setdefault(label, []).append({"year": year, "rate_per_100k": rate})
        years_seen.add(year)
    if not by_geo:
        return None
    for label in by_geo:
        by_geo[label].sort(key=lambda r: r["year"])
    geographies = [
        {"label": label, "accent": label == "Toronto CMA", "series": series}
        for label, series in sorted(by_geo.items(), key=lambda kv: kv[0])
    ]
    return {
        "schema_version": 1,
        "generated_at": generated_at,
        "years": sorted(years_seen),
        "geographies": geographies,
        "metric": {
            "violation": "Total Criminal Code violations (excluding traffic)",
            "unit": "rate per 100,000 population",
        },
        "source": {
            "name": "Statistics Canada Table 35-10-0177-01",
            "license": "Statistics Canada Open Licence (commercial use permitted with attribution)",
            "attribution": "Source: Statistics Canada, Table 35-10-0177-01.",
        },
    }


def build_csi_context(csi_dir: Path, generated_at: str) -> dict[str, object] | None:
    """
    Read data/csi/csi-by-geography.md (produced by scripts/import_csi.py)
    and shape it for the Overview's CSICard. Returns None if the source
    file isn't present yet — the aggregator should not fail in that case
    because CSI is an optional context layer, not a load-bearing series.
    """
    path = csi_dir / "csi-by-geography.md"
    if not path.exists():
        return None
    rows = iter_markdown_rows(path)
    # Group by geography → list of {year, csi_total, csi_violent, csi_non_violent}.
    by_geo: dict[str, list[dict[str, object]]] = {}
    years_seen: set[int] = set()
    for row in rows:
        try:
            year = int(row["year"])
        except (KeyError, ValueError):
            continue
        label = row.get("geography", "").strip()
        if not label:
            continue
        def to_float(key: str) -> float | None:
            raw = (row.get(key) or "").strip()
            if not raw:
                return None
            try:
                return float(raw)
            except ValueError:
                return None
        by_geo.setdefault(label, []).append({
            "year": year,
            "csi_total":       to_float("csi_total"),
            "csi_violent":     to_float("csi_violent"),
            "csi_non_violent": to_float("csi_non_violent"),
        })
        years_seen.add(year)
    if not by_geo:
        return None
    for label in by_geo:
        by_geo[label].sort(key=lambda r: r["year"])
    geographies = [
        {"label": label, "accent": label == "Toronto", "series": series}
        for label, series in sorted(by_geo.items(), key=lambda kv: kv[0])
    ]
    return {
        "schema_version": 1,
        "generated_at": generated_at,
        "years": sorted(years_seen),
        "geographies": geographies,
        "source": {
            "name": "Statistics Canada Table 35-10-0026-01",
            "license": "Statistics Canada Open Licence (commercial use permitted with attribution)",
            "attribution": "Source: Statistics Canada, Table 35-10-0026-01.",
        },
    }


def write_json(path: Path, data: object) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, indent=2, sort_keys=True) + "\n"
    path.write_text(payload, encoding="utf-8")
    return len(payload.encode("utf-8"))


def write_json_compact(path: Path, data: object) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(data, sort_keys=True, separators=(",", ":")) + "\n"
    path.write_text(payload, encoding="utf-8")
    return len(payload.encode("utf-8"))


def gzip_size(path: Path) -> int:
    raw = path.read_bytes()
    return len(gzip.compress(raw, compresslevel=9, mtime=0))


def human_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB"):
        if n < 1024:
            return f"{n:.1f}{unit}" if unit != "B" else f"{n}{unit}"
        n = n / 1024
    return f"{n:.1f}GB"


# --------------------------------------------------------------------------
# main
# --------------------------------------------------------------------------


def main() -> int:
    args = parse_args()
    generated_at = (
        datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None).isoformat() + "Z"
    )

    print(f"Crime Pulse build aggregator — {generated_at}")
    print()

    # Staleness alarm: the year window is hardcoded; once the calendar rolls
    # past it, builds would otherwise keep succeeding with a frozen
    # comparable window and a permanently "partial" latest year.
    today_year = datetime.now(timezone.utc).year
    if today_year > max(PARTIAL_YEARS):
        print(
            f"WARNING: PARTIAL_YEARS ends at {max(PARTIAL_YEARS)} but it is "
            f"now {today_year} — the comparable window ({min(YEARS)}–"
            f"{max(YEARS)}) is stale. Bump YEARS / PARTIAL_YEARS here and the "
            "matching constants in scripts/import_tps_csi.py, "
            "scripts/import_population.py, scripts/import_csi.py, "
            "scripts/import_cma_rates.py, src/lib/state.ts.",
            file=sys.stderr,
        )
        print()

    # 1. Populations.
    print("Reading population denominators")
    neighbourhoods = read_neighbourhood_populations(args.population_dir)
    city_pop = read_city_populations(args.population_dir)
    print(f"  {len(neighbourhoods)} neighbourhoods, "
          f"{len(city_pop)} city-pop years")

    # 2. CSI corpus.
    print()
    print("Reading TPS CSI Markdown corpus")
    corpus = read_csi_corpus(args.crimes_dir)
    print(f"  total rows read: {corpus['total_rows']:,}")
    if corpus["unmapped_categories"]:
        print(f"  WARNING unmapped categories: "
              f"{dict(corpus['unmapped_categories'])!r}")
    if corpus["rows_missing_nbhd"]:
        print(f"  NOTE rows included city-wide but excluded from neighbourhood views "
              f"(missing/unparseable neighbourhood): "
              f"{corpus['rows_missing_nbhd']:,}")
    if corpus["rows_bad_date"]:
        print(f"  WARNING rows skipped (malformed report_date): "
              f"{corpus['rows_bad_date']:,}")

    # 3. Cross-check CSI neighbourhood IDs against the population file.
    nbhd_ids = set(neighbourhoods.keys())
    csi_only = sorted(corpus["nbhd_ids_seen"] - nbhd_ids)
    if csi_only:
        print(
            "ERROR: CSI rows reference neighbourhood IDs absent from the "
            f"population file: {csi_only!r}",
            file=sys.stderr,
        )
        return 2

    # 4. Build aggregates.
    print()
    print("Building aggregates")
    partial_loaded = corpus["partial_years_loaded"]
    import_meta = read_import_metadata(args.crimes_dir)
    toronto = build_toronto_by_year(
        corpus["yearly_totals"],
        city_pop,
        generated_at,
        partial_loaded,
        corpus["yearly_unresolved"],
    )
    # Freshness metadata for the site's SYNC pill / footer / About §05 —
    # the honest numbers are when the corpus was imported and the max report
    # date it covers, not when this script last ran.
    toronto["data_imported_at"] = import_meta["imported_at"]
    toronto["data_through"] = import_meta["data_through"]
    toronto["partial_year_through"] = import_meta["partial_year_through"]
    by_year = build_by_neighbourhood_year(
        corpus["yearly_by_nbhd"], neighbourhoods, generated_at, partial_loaded
    )
    by_month = build_by_neighbourhood_month(
        corpus["monthly_by_nbhd"], neighbourhoods, generated_at
    )
    incident_feeds = build_incident_feed(corpus["incidents_by_nbhd"], neighbourhoods)

    # 5. Fetch + validate GeoJSON.
    print()
    print("Fetching choropleth GeoJSON")
    geojson, geojson_raw = fetch_geojson(
        args.geojson_url, args.geojson_cache, args.refresh_geojson
    )
    geo_errors = validate_geojson(geojson, set(neighbourhoods.keys()))
    if geo_errors:
        print("GeoJSON validation FAILED:", file=sys.stderr)
        for err in geo_errors:
            print(f"  - {err}", file=sys.stderr)
        if geojson_raw is not None:
            print(f"  cache at {args.geojson_cache} left untouched.", file=sys.stderr)
        return 3
    if geojson_raw is not None:
        write_geojson_cache(args.geojson_cache, geojson_raw)

    # 6. Validate aggregates.
    print()
    print("Validating aggregates")
    errors = validate_monthly_corpus(corpus) + validate_aggregates(
        toronto, by_year, by_month, incident_feeds, neighbourhoods
    )
    if errors:
        print("Aggregate validation FAILED:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        return 4

    # 7. Write outputs.
    print()
    print("Writing outputs")
    aggregates_dir = args.out_dir / "aggregates"
    geo_dir = args.out_dir / "geo"
    incidents_dir = aggregates_dir / "neighbourhood-incidents"
    aggregates_dir.mkdir(parents=True, exist_ok=True)
    geo_dir.mkdir(parents=True, exist_ok=True)
    incidents_dir.mkdir(parents=True, exist_ok=True)

    # Clean stale incident files so reruns are deterministic if neighbourhood
    # IDs ever drift.
    for stale in incidents_dir.glob("*.json"):
        stale.unlink()

    toronto_path = aggregates_dir / "toronto-by-year.json"
    by_year_path = aggregates_dir / "by-neighbourhood-year.json"
    by_month_path = aggregates_dir / "by-neighbourhood-month.json"
    geo_path = geo_dir / "toronto-neighbourhoods-158.geojson"

    sizes = {
        "toronto-by-year.json": write_json(toronto_path, toronto),
        "by-neighbourhood-year.json": write_json(by_year_path, by_year),
        # Compact writer: the monthly aggregate is 94K+ points; pretty-printing
        # it alone pushed the gzip size past the 200KB budget (P1.12).
        "by-neighbourhood-month.json": write_json_compact(by_month_path, by_month),
    }

    # Optional CSI context layer (StatCan 35-10-0026-01). If data/csi/ hasn't
    # been populated by scripts/import_csi.py the aggregator skips silently
    # and the Overview falls back to the no-CSI layout.
    csi_dir = (args.crimes_dir.parent / "csi")
    csi_context = build_csi_context(csi_dir, generated_at)
    csi_path = aggregates_dir / "csi-context.json"
    if csi_context is not None:
        sizes["csi-context.json"] = write_json(csi_path, csi_context)
        print(f"  + CSI context: {len(csi_context['geographies'])} geographies × {len(csi_context['years'])} years")
    else:
        csi_path.unlink(missing_ok=True)
        print("  (no data/csi/ yet — Overview will render without the CSI card)")

    cma_dir = args.crimes_dir.parent / "cma"
    cma_context = build_cma_context(cma_dir, generated_at)
    cma_path = aggregates_dir / "cma-context.json"
    if cma_context is not None:
        sizes["cma-context.json"] = write_json(cma_path, cma_context)
        print(
            f"  + CMA context: {len(cma_context['geographies'])} geographies × "
            f"{len(cma_context['years'])} years"
        )
    else:
        cma_path.unlink(missing_ok=True)
        print("  (no data/cma/ yet — Overview will render without the CMA card)")

    # GeoJSON is slimmed (props trimmed, coords rounded) and written compact.
    # Raw upstream is ~2MB; this brings it well under the per-page budget.
    geo_size = write_json_compact(geo_path, slim_geojson(geojson))

    # Per-neighbourhood incident feeds.
    incident_sizes: list[tuple[int, int]] = []  # (nid, gzipped_size)
    for nid in sorted(incident_feeds):
        path = incidents_dir / f"{nid}.json"
        write_json(path, incident_feeds[nid])
        incident_sizes.append((nid, gzip_size(path)))

    # 8. Report sizes.
    print()
    print("Output sizes (gzipped):")
    over_budget: list[str] = []
    for name, raw_size in sizes.items():
        path = aggregates_dir / name
        gz = gzip_size(path)
        flag = "  ** OVER 200KB **" if gz > SIZE_BUDGET_BYTES else ""
        print(f"  {name:32s} raw={human_bytes(raw_size):>8s} "
              f"gz={human_bytes(gz):>8s}{flag}")
        if gz > SIZE_BUDGET_BYTES:
            over_budget.append(f"{name}: {human_bytes(gz)} gzipped")

    geo_gz = gzip_size(geo_path)
    flag = "  ** OVER 200KB **" if geo_gz > SIZE_BUDGET_BYTES else ""
    print(f"  {'toronto-neighbourhoods-158.geojson':32s} "
          f"raw={human_bytes(geo_size):>8s} gz={human_bytes(geo_gz):>8s}{flag}")
    if geo_gz > SIZE_BUDGET_BYTES:
        over_budget.append(
            f"toronto-neighbourhoods-158.geojson: {human_bytes(geo_gz)} gzipped"
        )

    # Per-neighbourhood incident files: flag any individual file > 200KB.
    print()
    incident_sizes.sort(key=lambda r: r[1], reverse=True)
    top_n = incident_sizes[:5]
    print("Largest per-neighbourhood incident feeds (gzipped):")
    for nid, gz in top_n:
        name = neighbourhoods[nid]["name"]
        flag = "  ** OVER 200KB **" if gz > SIZE_BUDGET_BYTES else ""
        print(f"  {nid:>4}  {name:40s} gz={human_bytes(gz):>8s}{flag}")
        if gz > SIZE_BUDGET_BYTES:
            over_budget.append(
                f"neighbourhood-incidents/{nid}.json ({name}): "
                f"{human_bytes(gz)} gzipped"
            )

    # 9. Sanity-print headline numbers.
    print()
    print("Headline numbers:")
    full_year_total = sum(
        p["count"] for p in toronto["total_series"] if not p.get("partial")
    )
    print(f"  Toronto-wide total incidents (2016–2025): {full_year_total:,}")
    partial_total = sum(
        p["count"] for p in toronto["total_series"] if p.get("partial")
    )
    if partial_total:
        print(f"  Toronto-wide partial-year incidents (2026 YTD): {partial_total:,}")
    assault_2025 = next(
        (p["count"] for p in toronto["series"]["assault"] if p["year"] == 2025),
        None,
    )
    if assault_2025 is not None:
        print(f"  Toronto 2025 assault count: {assault_2025:,}")
    else:
        print("  Toronto 2025 assault count: (2025 absent from series)")
    zero_nbhds = [
        (nid, info["name"])
        for nid, info in neighbourhoods.items()
        if sum(
            point["count"]
            for cat in CATEGORY_IDS
            for point in by_year["neighbourhoods"][str(nid)]["series"][cat]
        )
        == 0
    ]
    if zero_nbhds:
        print(f"  Neighbourhoods with zero incidents 2016–2025 ({len(zero_nbhds)}):")
        for nid, name in zero_nbhds:
            print(f"    {nid}  {name}")
    else:
        print("  No neighbourhoods with zero incidents over the 10-year window.")

    if over_budget:
        print()
        print("ERROR: files over the 200KB gzipped budget:", file=sys.stderr)
        for item in over_budget:
            print(f"  - {item}", file=sys.stderr)
        return 5

    print()
    print("Build aggregates complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
