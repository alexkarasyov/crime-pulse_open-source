#!/usr/bin/env python3
"""Import Toronto Police Service Community Safety Indicators to Markdown."""

from __future__ import annotations

import argparse
import csv
import io
import json
import re
import sys
import tempfile
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path


SOURCE_URL = (
    "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/"
    "6909ea60-ef0e-465f-b5d0-43106b6b9130/resource/"
    "174089c6-5a1a-42a5-8937-f9f25c72700a/download/"
    "community-safety-indicators.csv"
)

YEARS = tuple(range(2016, 2027))  # 2016–2026; 2026 is YTD, flagged downstream

# The in-progress (YTD) year. Its file may legitimately be absent or small —
# all other ("full") years must write at least one row or the corpus is bad.
PARTIAL_YEARS = (2026,)

# Source CSV columns this importer reads (see parse_year / normalize_row).
# We assert these exist in the header before parsing so a schema rename or a
# wrong/HTML-error response can't slip through as a silently-empty corpus.
# REPORT_YEAR is intentionally NOT required on its own: parse_year falls back
# to REPORT_DATE, so the year is resolvable as long as REPORT_DATE is present.
REQUIRED_SOURCE_COLUMNS = (
    "REPORT_DATE",
    "OCC_DATE",
    "EVENT_UNIQUE_ID",
    "CSI_CATEGORY",
    "OFFENCE",
    "NEIGHBOURHOOD_158",
    "DIVISION",
    "PREMISES_TYPE",
    "LOCATION_TYPE",
    "LAT_WGS84",
    "LONG_WGS84",
)

OUTPUT_COLUMNS = (
    "event_id",
    "report_date",
    "occ_date",
    "category",
    "offence",
    "neighbourhood",
    "division",
    "premises_type",
    "location_type",
    "lat",
    "lng",
)


@dataclass
class YearStats:
    rows: int = 0
    missing_coordinates: int = 0
    min_report_date: str | None = None
    max_report_date: str | None = None
    categories: Counter[str] = field(default_factory=Counter)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import TPS Community Safety Indicators CSV to yearly Markdown tables."
    )
    parser.add_argument("--url", default=SOURCE_URL, help="CSV URL to import.")
    parser.add_argument(
        "--out-dir",
        default="data/crimes",
        type=Path,
        help="Directory for generated Markdown files.",
    )
    parser.add_argument(
        "--report",
        default="data/crimes/tps-csi-validation.json",
        type=Path,
        help="Validation report path.",
    )
    parser.add_argument(
        "--start-year",
        default=min(YEARS),
        type=int,
        help="First full report year to include.",
    )
    parser.add_argument(
        "--end-year",
        default=max(YEARS),
        type=int,
        help="Last full report year to include.",
    )
    return parser.parse_args()


def clean(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def markdown_cell(value: str) -> str:
    return clean(value).replace("|", "\\|")


def parse_year(row: dict[str, str]) -> int | None:
    raw_year = clean(row.get("REPORT_YEAR"))
    if raw_year.isdigit():
        return int(raw_year)

    raw_date = clean(row.get("REPORT_DATE"))
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw_date):
        return int(raw_date[:4])

    return None


def normalize_row(row: dict[str, str]) -> dict[str, str]:
    return {
        "event_id": clean(row.get("EVENT_UNIQUE_ID")),
        "report_date": clean(row.get("REPORT_DATE")),
        "occ_date": clean(row.get("OCC_DATE")),
        "category": clean(row.get("CSI_CATEGORY")),
        "offence": clean(row.get("OFFENCE")),
        "neighbourhood": clean(row.get("NEIGHBOURHOOD_158")),
        "division": clean(row.get("DIVISION")),
        "premises_type": clean(row.get("PREMISES_TYPE")),
        "location_type": clean(row.get("LOCATION_TYPE")),
        "lat": clean(row.get("LAT_WGS84")),
        "lng": clean(row.get("LONG_WGS84")),
    }


def dedupe_key(row: dict[str, str]) -> tuple[str, ...]:
    # Key on every field we write out. A single EVENT_UNIQUE_ID can legitimately
    # span multiple offence rows that differ only in premises/location/division;
    # keying on the full output tuple drops only true byte-for-byte duplicates
    # and never collapses genuinely distinct records.
    return (
        row["event_id"],
        row["report_date"],
        row["occ_date"],
        row["category"],
        row["offence"],
        row["neighbourhood"],
        row["division"],
        row["premises_type"],
        row["location_type"],
        row["lat"],
        row["lng"],
    )


def update_stats(stats: YearStats, row: dict[str, str]) -> None:
    stats.rows += 1
    if not row["lat"] or not row["lng"]:
        stats.missing_coordinates += 1
    if row["category"]:
        stats.categories[row["category"]] += 1
    report_date = row["report_date"]
    if report_date:
        if stats.min_report_date is None or report_date < stats.min_report_date:
            stats.min_report_date = report_date
        if stats.max_report_date is None or report_date > stats.max_report_date:
            stats.max_report_date = report_date


def write_markdown_table(path: Path, rows: list[dict[str, str]], source_url: str) -> None:
    title = path.stem.replace("-", " ").upper()
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        handle.write(f"# {title}\n\n")
        handle.write(f"Source: Toronto Police Service Community Safety Indicators, `{source_url}`.\n\n")
        handle.write("| " + " | ".join(OUTPUT_COLUMNS) + " |\n")
        handle.write("| " + " | ".join(["---"] * len(OUTPUT_COLUMNS)) + " |\n")
        for row in rows:
            handle.write(
                "| "
                + " | ".join(markdown_cell(row[column]) for column in OUTPUT_COLUMNS)
                + " |\n"
            )


def date_json_default(value: object) -> str:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def main() -> int:
    args = parse_args()
    years = tuple(range(args.start_year, args.end_year + 1))
    args.out_dir.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)

    rows_by_year: dict[int, list[dict[str, str]]] = defaultdict(list)
    stats_by_year: dict[int, YearStats] = {year: YearStats() for year in years}
    seen: set[tuple[str, ...]] = set()

    total_source_rows = 0
    included_before_dedupe = 0
    duplicate_rows = 0
    skipped_outside_year_range = 0
    skipped_unparseable_year = 0

    request = urllib.request.Request(args.url, headers={"User-Agent": "crime-pulse-import/1.0"})
    with urllib.request.urlopen(request, timeout=120) as response:
        declared_length = response.headers.get("Content-Length")
        raw = response.read()
    # Guard against a truncated download being written out as if complete: a
    # mid-stream connection drop yields a clean EOF that csv.DictReader can't
    # distinguish from the real end of file. If the server told us how many
    # bytes to expect, verify it before parsing.
    declared_bytes: int | None = None
    if declared_length is not None:
        try:
            declared_bytes = int(declared_length)
        except ValueError:
            # Malformed header — we simply can't verify the length.
            print(
                f"WARNING: unparseable Content-Length header {declared_length!r}; "
                "skipping truncation check.",
                file=sys.stderr,
            )
    if declared_bytes is not None and len(raw) != declared_bytes:
        print(
            f"ERROR: truncated download — read {len(raw):,} bytes but "
            f"Content-Length declared {declared_bytes:,}.",
            file=sys.stderr,
        )
        return 2

    text_stream = io.StringIO(raw.decode("utf-8-sig"))
    reader = csv.DictReader(text_stream)
    # Fail fast if the source schema drifted (column rename) or the response
    # wasn't the CSV we expected (e.g. an HTML error page). Without this an
    # empty/garbled header would parse zero usable rows and still exit 0.
    fieldnames = reader.fieldnames or []
    missing_columns = [c for c in REQUIRED_SOURCE_COLUMNS if c not in fieldnames]
    if missing_columns:
        print(
            "ERROR: source CSV is missing required column(s) "
            f"{missing_columns!r}. Header was: {fieldnames!r}",
            file=sys.stderr,
        )
        return 2
    for source_row in reader:
        total_source_rows += 1
        year = parse_year(source_row)
        if year is None:
            skipped_unparseable_year += 1
            continue
        if year not in years:
            skipped_outside_year_range += 1
            continue

        included_before_dedupe += 1
        normalized = normalize_row(source_row)
        # REPORT_YEAR alone does not validate REPORT_DATE. Reject bad dates
        # before replacing the canonical archive: otherwise impossible months
        # disappear from monthly aggregates, and a mismatched year leaves the
        # freshly imported archive unable to build.
        report_date = normalized["report_date"]
        try:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", report_date):
                raise ValueError("expected YYYY-MM-DD")
            parsed_date = date.fromisoformat(report_date)
            if parsed_date.year != year:
                raise ValueError(f"does not match report year {year}")
        except ValueError as exc:
            print(
                f"ERROR: source CSV row {reader.line_num} has invalid "
                f"REPORT_DATE {report_date!r}: {exc}. "
                "Existing corpus and validation report were not changed.",
                file=sys.stderr,
            )
            return 2
        key = dedupe_key(normalized)
        if key in seen:
            duplicate_rows += 1
            continue
        seen.add(key)

        rows_by_year[year].append(normalized)
        update_stats(stats_by_year[year], normalized)

    for year in years:
        rows_by_year[year].sort(
            key=lambda item: (item["report_date"], item["event_id"], item["offence"])
        )

    # A full (non-YTD) year with zero written rows means the import produced an
    # all-empty corpus for a year that should always have data — treat it as a
    # hard failure rather than shipping a silently-empty dashboard. The YTD
    # year is exempt (it can be tiny or, off-season, empty).
    # Staleness alarm: once the calendar rolls past the configured window,
    # `npm run refresh` would otherwise keep exiting 0 while silently dropping
    # every new-year row into skipped_outside_year_range. Warn loudly and name
    # the constants to bump; the import itself still succeeds.
    today_year = date.today().year
    if today_year > max(years):
        print(
            f"WARNING: year window ends at {max(years)} but it is now "
            f"{today_year} — {skipped_outside_year_range:,} row(s) fell outside "
            "the window this run. Extend YEARS / PARTIAL_YEARS in "
            "scripts/import_tps_csi.py (and the matching constants in "
            "scripts/build_aggregates.py, scripts/import_population.py, "
            "scripts/import_csi.py, src/lib/state.ts).",
            file=sys.stderr,
        )

    empty_full_years = sorted(
        year
        for year in years
        if year not in PARTIAL_YEARS and stats_by_year[year].rows == 0
    )
    if empty_full_years:
        print(
            "ERROR: full (non-YTD) year(s) wrote 0 rows: "
            f"{empty_full_years!r}. The source import looks empty or malformed.",
            file=sys.stderr,
        )
        return 3

    generated_at = (
        datetime.now(timezone.utc).replace(microsecond=0, tzinfo=None).isoformat() + "Z"
    )
    report = {
        "source": {
            "name": "Toronto Police Service Community Safety Indicators",
            "url": args.url,
            "imported_at": generated_at,
        },
        "year_range": {"start": min(years), "end": max(years)},
        "summary": {
            "source_rows_read": total_source_rows,
            "rows_in_year_range_before_dedupe": included_before_dedupe,
            "rows_written": sum(stats.rows for stats in stats_by_year.values()),
            "duplicate_rows_removed": duplicate_rows,
            "rows_skipped_outside_year_range": skipped_outside_year_range,
            "rows_skipped_unparseable_year": skipped_unparseable_year,
        },
        "years": {
            str(year): {
                "rows": stats_by_year[year].rows,
                "min_report_date": stats_by_year[year].min_report_date,
                "max_report_date": stats_by_year[year].max_report_date,
                "missing_coordinates": stats_by_year[year].missing_coordinates,
                "categories": dict(sorted(stats_by_year[year].categories.items())),
                "file": str(args.out_dir / f"tps-csi-{year}.md"),
            }
            for year in years
        },
    }

    # Stage every output before replacing any canonical file. Validation
    # failures above therefore leave the existing corpus untouched, and a
    # write failure while preparing one year cannot leave a half-refreshed
    # archive behind. Path.replace() is atomic for each target on the same
    # filesystem; staging under each target's parent preserves that property.
    with tempfile.TemporaryDirectory(
        prefix=".crime-pulse-tps-", dir=args.out_dir
    ) as corpus_tmp, tempfile.TemporaryDirectory(
        prefix=".crime-pulse-tps-report-", dir=args.report.parent
    ) as report_tmp:
        corpus_stage = Path(corpus_tmp)
        staged_corpus: list[tuple[Path, Path]] = []
        for year in years:
            target = args.out_dir / f"tps-csi-{year}.md"
            staged = corpus_stage / target.name
            write_markdown_table(staged, rows_by_year[year], args.url)
            staged_corpus.append((staged, target))

        staged_report = Path(report_tmp) / args.report.name
        staged_report.write_text(
            json.dumps(report, indent=2, sort_keys=True, default=date_json_default)
            + "\n",
            encoding="utf-8",
        )

        for staged, target in staged_corpus:
            staged.replace(target)
        staged_report.replace(args.report)
    print(json.dumps(report["summary"], indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
