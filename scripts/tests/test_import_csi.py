#!/usr/bin/env python3
"""Tests for the pure helpers in scripts/import_csi.py.

Never invokes main() — no network. Rows are synthetic dicts shaped like
StatCan table 35-10-0026-01 CSV rows.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from import_csi import (
    YEAR_MAX,
    YEAR_MIN,
    collect,
    match_geo,
    missing_geographies,
)


def _row(geo: str, year: int = 2024, stat: str = "Crime severity index", value: str = "50.0") -> dict:
    return {"REF_DATE": str(year), "GEO": geo, "Statistics": stat, "VALUE": value}


class MatchGeoTests(unittest.TestCase):
    def test_cma_rows_match_by_contains(self) -> None:
        self.assertEqual(match_geo("Toronto, Ontario [35535]"), "Toronto")
        self.assertEqual(match_geo("Montréal, Quebec [24462]"), "Montréal")

    def test_province_rows_are_anchored(self) -> None:
        self.assertEqual(match_geo("Ontario"), "Ontario")
        self.assertEqual(match_geo("Ontario [35]"), "Ontario")
        # The old bare-substring bug: a CMA containing ", Ontario" must NOT
        # collapse into the province.
        self.assertIsNone(match_geo("Ottawa, Ontario [505]"))

    def test_canada_exact_or_code(self) -> None:
        self.assertEqual(match_geo("Canada"), "Canada")
        self.assertEqual(match_geo("Canada [11124]"), "Canada")
        self.assertIsNone(match_geo("Atlantic Canada Region"))

    def test_unwanted_geography_returns_none(self) -> None:
        self.assertIsNone(match_geo("Winnipeg, Manitoba [46602]"))


class CollectTests(unittest.TestCase):
    def test_year_window_filter(self) -> None:
        rows = [
            _row("Canada", year=YEAR_MIN - 1),
            _row("Canada", year=YEAR_MIN),
            _row("Canada", year=YEAR_MAX),
            _row("Canada", year=YEAR_MAX + 1),
        ]
        out = collect(rows)
        self.assertEqual(sorted(y for (y, _l) in out), [YEAR_MIN, YEAR_MAX])

    def test_identical_duplicate_rows_are_harmless(self) -> None:
        rows = [_row("Canada"), _row("Canada")]
        out = collect(rows)
        self.assertEqual(out[(2024, "Canada")]["csi_total"], 50.0)

    def test_conflicting_duplicate_rows_raise(self) -> None:
        rows = [_row("Canada", value="50.0"), _row("Canada", value="51.0")]
        with self.assertRaises(RuntimeError):
            collect(rows)

    def test_blank_value_recorded_as_none(self) -> None:
        out = collect([_row("Canada", value="")])
        self.assertIsNone(out[(2024, "Canada")]["csi_total"])

    def test_unwanted_stat_ignored(self) -> None:
        out = collect([_row("Canada", stat="Weighted clearance rate")])
        self.assertEqual(out, {})


class MissingGeographiesTests(unittest.TestCase):
    def test_all_present_is_empty(self) -> None:
        rows = [
            _row("Toronto, Ontario [35535]"),
            _row("Montréal, Quebec [24462]"),
            _row("Vancouver, British Columbia [59933]"),
            _row("Calgary, Alberta [48825]"),
            _row("Canada"),
            _row("Ontario"),
        ]
        self.assertEqual(missing_geographies(collect(rows)), [])

    def test_geo_format_drift_flags_dropped_city(self) -> None:
        # Simulate StatCan reformatting the Toronto CMA label so the
        # "contains" needle no longer matches, while everything else does.
        rows = [
            _row("Toronto (CMA), Ont. [35535]"),
            _row("Montréal, Quebec [24462]"),
            _row("Vancouver, British Columbia [59933]"),
            _row("Calgary, Alberta [48825]"),
            _row("Canada"),
            _row("Ontario"),
        ]
        self.assertEqual(missing_geographies(collect(rows)), ["Toronto"])


if __name__ == "__main__":
    unittest.main()
