#!/usr/bin/env python3
"""
Import Statistics Canada Table 35-10-0177-01 — Incident-based crime statistics.

Writes:
  data/cma/cma-rates-by-geography.md   — one row per (year, geography)
  data/cma/validation.json             — fetch metadata + spot checks

Why this source:
  P1.4d's original GTA-suburb comparison is blocked at StatCan's CMA
  granularity. This importer keeps Toronto CMA alongside national and
  Ontario-peer metros so the Overview can show metro-level crime rates
  per 100,000 residents without implying neighbourhood-resolved GTA
  coverage the TPS corpus does not provide.

License:
  Statistics Canada Open Licence — commercial use permitted with
  attribution ("Source: Statistics Canada, Table 35-10-0177-01.").
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Tuple

ZIP_URL = "https://www150.statcan.gc.ca/n1/tbl/csv/35100177-eng.zip"

# (label, needle, mode). Match modes mirror scripts/import_csi.py.
WANTED: List[Tuple[str, str, str]] = [
    ("Toronto CMA",     "toronto, ontario [",                 "contains"),
    ("Hamilton",        "hamilton, ontario [",                "contains"),
    ("Ottawa-Gatineau", "ottawa-gatineau, ontario/quebec [", "contains"),
    ("Montréal",        "montréal, quebec [",                 "contains"),
    ("Vancouver",       "vancouver, british columbia [",      "contains"),
    ("Calgary",         "calgary, alberta [",                 "contains"),
    ("Edmonton",        "edmonton, alberta [",                "contains"),
    ("Canada",          "canada",                             "exact_or_code"),
]

VIOLATION = "Total, all Criminal Code violations (excluding traffic) [50]"
STATISTIC = "Rate per 100,000 population"

YEAR_MIN = 2016
YEAR_MAX = 2025

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data" / "cma"
MD_PATH = DATA_DIR / "cma-rates-by-geography.md"
VAL_PATH = DATA_DIR / "validation.json"


def fetch_zip() -> bytes:
    print(f"  → downloading {ZIP_URL}")
    req = urllib.request.Request(ZIP_URL, headers={"User-Agent": "crime-pulse-build/1.0"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def parse_csv(zip_bytes: bytes) -> Iterator[dict]:
    with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
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
        else:
            if lo == needle or lo.startswith(needle + " ["):
                return label
    return None


def collect(rows: Iterable[dict]) -> Dict[Tuple[int, str], float | None]:
    out: Dict[Tuple[int, str], float | None] = {}
    for row in rows:
        if (row.get("Violations") or "") != VIOLATION:
            continue
        if (row.get("Statistics") or "") != STATISTIC:
            continue
        try:
            year = int(row["REF_DATE"])
        except (KeyError, ValueError):
            continue
        if year < YEAR_MIN or year > YEAR_MAX:
            continue
        label = match_geo(row.get("GEO", ""))
        if label is None:
            continue
        raw = (row.get("VALUE") or "").strip()
        try:
            value = float(raw) if raw else None
        except ValueError:
            value = None
        key = (year, label)
        if key in out and out[key] != value:
            raise RuntimeError(
                f"Conflicting CMA rate values for (year={year}, geo={label!r}): "
                f"{out[key]!r} vs {value!r}."
            )
        out[key] = value
    return out


def missing_geographies(records: Dict[Tuple[int, str], float | None]) -> List[str]:
    labels_seen = {label for (_year, label) in records}
    return [label for label, _needle, _mode in WANTED if label not in labels_seen]


def write_markdown(records: Dict[Tuple[int, str], float | None]) -> int:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    keys = sorted(records.keys(), key=lambda k: (k[0], k[1]))
    lines = [
        "# Criminal Code rates by CMA",
        "",
        "Source: Statistics Canada Table 35-10-0177-01 (Incident-based crime statistics). "
        f"Direct CSV ZIP: `{ZIP_URL}`. "
        f"Filtered to `{VIOLATION}` at `{STATISTIC}`. "
        "Geographies are Census Metropolitan Areas unless noted. "
        "License: Statistics Canada Open Licence — commercial use permitted with attribution "
        "(`Source: Statistics Canada, Table 35-10-0177-01.`). "
        "Empty cells indicate the underlying source did not publish that value.",
        "",
        "| year | geography | rate_per_100k |",
        "| --- | --- | --- |",
    ]
    for (year, label) in keys:
        value = records[(year, label)]
        cell = f"{value:.2f}" if value is not None else ""
        lines.append(f"| {year} | {label} | {cell} |")
    _write_atomic(MD_PATH, "\n".join(lines) + "\n")
    return len(keys)


def _write_atomic(path: Path, text: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(path)


def write_validation(records: Dict[Tuple[int, str], float | None], row_count: int) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    toronto_latest = max(
        ((y, v) for (y, label), v in records.items()
         if label == "Toronto CMA" and v is not None),
        default=(None, None),
    )
    canada_latest = max(
        ((y, v) for (y, label), v in records.items()
         if label == "Canada" and v is not None),
        default=(None, None),
    )
    payload = {
        "output_path": "data/cma/cma-rates-by-geography.md",
        "source": {
            "name": "Statistics Canada Table 35-10-0177-01",
            "url": ZIP_URL,
            "fetched_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "license": "Statistics Canada Open Licence (commercial use permitted with attribution)",
            "violation": VIOLATION,
            "statistic": STATISTIC,
        },
        "row_count": row_count,
        "year_window": [YEAR_MIN, YEAR_MAX],
        "years_present": [
            min(y for (y, _label) in records),
            max(y for (y, _label) in records),
        ],
        "geographies_kept": [label for label, _needle, _mode in WANTED],
        "spot_checks": {
            "toronto_cma_rate_latest": {"year": toronto_latest[0], "value": toronto_latest[1]},
            "canada_rate_latest": {"year": canada_latest[0], "value": canada_latest[1]},
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
    print("→ importing Statistics Canada CMA rates (table 35-10-0177-01)")
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
