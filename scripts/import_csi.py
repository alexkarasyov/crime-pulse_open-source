#!/usr/bin/env python3
"""
Import Statistics Canada Table 35-10-0026-01 — Crime Severity Index and
weighted clearance rates by police service.

Writes:
  data/csi/csi-by-geography.md   — one row per (year, geography)
  data/csi/validation.json       — fetch metadata + spot checks

Why this source:
  ADR-002 commits the dashboard to per-capita context. The Crime Severity
  Index (CSI) is StatCan's offence-weighted aggregate that lets us put
  Toronto in regional / national context without conflating volume and
  severity. The styleguide-era CSICard used fabricated values; this
  importer replaces them with the real annual series.

License:
  Statistics Canada Open Licence — commercial use permitted with
  attribution ("Source: Statistics Canada, Table 35-10-0026-01.").

Install:
  python3 -m pip install --user openpyxl   # only needed by import_population.py
  (this script uses stdlib only)
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Tuple

ZIP_URL = "https://www150.statcan.gc.ca/n1/tbl/csv/35100026-eng.zip"

# Geographies we want. Match against the GEO column with a case-insensitive
# substring test; the first match wins. The label is what we write into the
# Markdown / aggregate.
# (label, needle, mode). The table's GEO column uses formats like
# "Toronto, Ontario [35535]" for CMAs, plus bare "Canada" and province names
# (optionally suffixed with a "[code]"). Two match modes:
#   "contains"      — CMA rows: the needle embeds ", province [".
#   "exact_or_code" — country/province rows: GEO equals the needle, or is the
#                     needle followed by " [<code>]". This is anchored so that
#                     e.g. "Ottawa, Ontario [505]" does NOT collapse into the
#                     province "Ontario" (the old bare-substring bug).
WANTED: List[Tuple[str, str, str]] = [
    ("Toronto",   "toronto, ontario [",            "contains"),
    ("Montréal",  "montréal, quebec [",            "contains"),
    ("Vancouver", "vancouver, british columbia [", "contains"),
    ("Calgary",   "calgary, alberta [",            "contains"),
    ("Canada",    "canada",                        "exact_or_code"),
    ("Ontario",   "ontario",                       "exact_or_code"),
]

# Which CSI variants we keep. The actual column labels are lowercase except
# for the leading word.
WANTED_STATS = {
    "Crime severity index":             "csi_total",
    "Violent crime severity index":     "csi_violent",
    "Non-violent crime severity index": "csi_non_violent",
}

# Year window. StatCan publishes long history; we keep only the dashboard's
# 10-year window plus a couple of years on either side for context.
YEAR_MIN = 2015
YEAR_MAX = 2025

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data" / "csi"
MD_PATH = DATA_DIR / "csi-by-geography.md"
VAL_PATH = DATA_DIR / "validation.json"


def fetch_zip() -> bytes:
    print(f"  → downloading {ZIP_URL}")
    # Some StatCan/CDN edges 403 a bare urllib agent; send an explicit one to
    # match scripts/import_tps_csi.py and import_population.py.
    req = urllib.request.Request(ZIP_URL, headers={"User-Agent": "crime-pulse-build/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.read()


def parse_csv(zip_bytes: bytes) -> Iterator[dict]:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
        # Find the actual data file. StatCan zips have e.g. `35100026.csv`.
        names = [n for n in zf.namelist() if n.endswith(".csv") and "MetaData" not in n]
        if not names:
            raise RuntimeError(f"no data CSV inside ZIP; saw {zf.namelist()!r}")
        data_name = names[0]
        print(f"  → reading {data_name}")
        with zf.open(data_name) as fh:
            text = io.TextIOWrapper(fh, encoding="utf-8-sig")
            yield from csv.DictReader(text)


def match_geo(geo: str) -> str | None:
    lo = geo.strip().lower()
    for label, needle, mode in WANTED:
        if mode == "contains":
            if needle in lo:
                return label
        else:  # exact_or_code
            if lo == needle or lo.startswith(needle + " ["):
                return label
    return None


def collect(rows: Iterable[dict]) -> Dict[Tuple[int, str], Dict[str, float | None]]:
    """
    Returns {(year, label): {csi_total, csi_violent, csi_non_violent}}.
    Missing values are None.
    """
    out: Dict[Tuple[int, str], Dict[str, float | None]] = {}
    sniffed_stats: set[str] = set()
    for row in rows:
        try:
            year = int(row["REF_DATE"])
        except (KeyError, ValueError):
            continue
        if year < YEAR_MIN or year > YEAR_MAX:
            continue
        label = match_geo(row.get("GEO", ""))
        if label is None:
            continue
        stat = row.get("Statistics") or row.get("STATISTICS") or ""
        sniffed_stats.add(stat)
        col = WANTED_STATS.get(stat)
        if col is None:
            continue
        raw = (row.get("VALUE") or "").strip()
        value: float | None
        try:
            value = float(raw) if raw else None
        except ValueError:
            value = None
        bucket = out.setdefault((year, label), {})
        # Detect conflicting duplicate rows for the same (year, geography, stat)
        # rather than silently letting the last write win — mirrors the
        # conflict check in import_population.read_csd_annual. A repeated row
        # with an identical value is harmless; a differing value means the
        # source has ambiguous data we must not paper over.
        if col in bucket and bucket[col] != value:
            raise RuntimeError(
                f"Conflicting CSI values for (year={year}, geo={label!r}, "
                f"stat={stat!r}): {bucket[col]!r} vs {value!r}."
            )
        bucket[col] = value
    if not out:
        print(f"  ! no matching rows found. distinct Statistics values seen: {sorted(sniffed_stats)}", file=sys.stderr)
    return out


def missing_geographies(records: Dict[Tuple[int, str], Dict[str, float | None]]) -> List[str]:
    """Wanted geographies absent from the matched records.

    A GEO label reformat upstream (e.g. "Toronto, Ontario [35535]" changing
    shape) would otherwise drop one city silently while the others keep
    matching — the Overview CSI card would then ship without that series.
    """
    labels_seen = {label for (_year, label) in records}
    return [label for label, _needle, _mode in WANTED if label not in labels_seen]


def write_markdown(records: Dict[Tuple[int, str], Dict[str, float | None]]) -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    keys = sorted(records.keys(), key=lambda k: (k[0], k[1]))
    lines = [
        "# Crime Severity Index by Geography",
        "",
        "Source: Statistics Canada Table 35-10-0026-01 (Crime Severity Index and weighted clearance rates by police service). "
        f"Direct CSV ZIP: `{ZIP_URL}`. "
        "Filtered to Toronto, Canada, Ontario, Montréal, Vancouver, Calgary. "
        "License: Statistics Canada Open Licence — commercial use permitted with attribution "
        "(`Source: Statistics Canada, Table 35-10-0026-01.`). "
        "Empty cells indicate the underlying source did not publish that value for that (year, geography).",
        "",
        "| year | geography | csi_total | csi_violent | csi_non_violent |",
        "| --- | --- | --- | --- | --- |",
    ]
    for (year, label) in keys:
        b = records[(year, label)]
        def fmt(v: float | None) -> str:
            return f"{v:.2f}" if v is not None else ""
        lines.append(f"| {year} | {label} | {fmt(b.get('csi_total'))} | {fmt(b.get('csi_violent'))} | {fmt(b.get('csi_non_violent'))} |")
    _write_atomic(MD_PATH, "\n".join(lines) + "\n")
    return len(keys)


def _write_atomic(path: Path, text: str) -> None:
    """Stage-and-replace so a crash mid-write never leaves a torn file,
    matching the other two importers."""
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def write_validation(records: Dict[Tuple[int, str], Dict[str, float | None]], row_count: int) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    toronto_latest = max(
        ((y, v.get("csi_total")) for (y, label), v in records.items()
         if label == "Toronto" and v.get("csi_total") is not None),
        default=(None, None),
    )
    canada_latest = max(
        ((y, v.get("csi_total")) for (y, label), v in records.items()
         if label == "Canada" and v.get("csi_total") is not None),
        default=(None, None),
    )
    payload = {
        "output_path": "data/csi/csi-by-geography.md",
        "source": {
            "name": "Statistics Canada Table 35-10-0026-01",
            "url": ZIP_URL,
            "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "license": "Statistics Canada Open Licence (commercial use permitted with attribution)",
        },
        "row_count": row_count,
        # The filter bound (what we'd keep) vs. what the source actually
        # provided — StatCan publishes year N's CSI in July of N+1, so
        # years_present usually trails year_window by one.
        "year_window": [YEAR_MIN, YEAR_MAX],
        "years_present": [
            min(y for (y, _label) in records),
            max(y for (y, _label) in records),
        ],
        "geographies_kept": [label for label, _needle, _mode in WANTED],
        "spot_checks": {
            "toronto_cma_csi_total_latest":  {"year": toronto_latest[0],  "value": toronto_latest[1]},
            "canada_csi_total_latest":       {"year": canada_latest[0],   "value": canada_latest[1]},
        },
    }
    _write_atomic(VAL_PATH, json.dumps(payload, indent=2) + "\n")


def main() -> int:
    global DATA_DIR, MD_PATH, VAL_PATH
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out-dir", type=Path, default=DATA_DIR)
    args = parser.parse_args()
    DATA_DIR = args.out_dir
    MD_PATH = DATA_DIR / MD_PATH.name
    VAL_PATH = DATA_DIR / VAL_PATH.name
    print("→ importing Statistics Canada CSI (table 35-10-0026-01)")
    zip_bytes = fetch_zip()
    rows = parse_csv(zip_bytes)
    records = collect(rows)
    if not records:
        print("  ! no records matched our filter — exiting non-zero", file=sys.stderr)
        return 1
    missing = missing_geographies(records)
    if missing:
        print(
            f"  ! geographies missing from source match: {missing!r} — "
            "GEO label format may have drifted; exiting non-zero",
            file=sys.stderr,
        )
        return 1
    row_count = write_markdown(records)
    write_validation(records, row_count)
    print(f"✓ wrote {row_count} rows to {MD_PATH}")
    print(f"✓ wrote validation to {VAL_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
