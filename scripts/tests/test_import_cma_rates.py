#!/usr/bin/env python3
"""Tests for the pure helpers in scripts/import_cma_rates.py."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from import_cma_rates import (
    STATISTIC,
    VIOLATION,
    YEAR_MAX,
    YEAR_MIN,
    collect,
    match_geo,
    missing_geographies,
)


def _row(
    geo: str,
    year: int = 2024,
    violations: str = VIOLATION,
    statistics: str = STATISTIC,
    value: str = "4000.0",
) -> dict:
    return {
        "REF_DATE": str(year),
        "GEO": geo,
        "Violations": violations,
        "Statistics": statistics,
        "VALUE": value,
    }


class MatchGeoTests(unittest.TestCase):
    def test_cma_rows_match_by_contains(self) -> None:
        self.assertEqual(match_geo("Toronto, Ontario [35535]"), "Toronto CMA")
        self.assertEqual(match_geo("Hamilton, Ontario [35537]"), "Hamilton")
        self.assertEqual(
            match_geo("Ottawa-Gatineau, Ontario/Quebec [24505/35505]"),
            "Ottawa-Gatineau",
        )

    def test_ottawa_parts_do_not_match_combined_label(self) -> None:
        self.assertIsNone(match_geo("Ottawa-Gatineau, Ontario part [35505]"))
        self.assertIsNone(match_geo("Ottawa-Gatineau, Quebec part [24505]"))

    def test_canada_exact_or_code(self) -> None:
        self.assertEqual(match_geo("Canada"), "Canada")
        self.assertEqual(match_geo("Canada [11124]"), "Canada")


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

    def test_wrong_violation_or_stat_ignored(self) -> None:
        out = collect([
            _row("Canada", violations="Total robbery [160]"),
            _row("Canada", statistics="Actual incidents"),
        ])
        self.assertEqual(out, {})

    def test_conflicting_duplicate_rows_raise(self) -> None:
        rows = [_row("Canada", value="4000.0"), _row("Canada", value="4100.0")]
        with self.assertRaises(RuntimeError):
            collect(rows)

    def test_blank_value_recorded_as_none(self) -> None:
        out = collect([_row("Canada", value="")])
        self.assertIsNone(out[(2024, "Canada")])


class MissingGeographiesTests(unittest.TestCase):
    def test_all_present_is_empty(self) -> None:
        rows = [
            _row("Toronto, Ontario [35535]"),
            _row("Hamilton, Ontario [35537]"),
            _row("Ottawa-Gatineau, Ontario/Quebec [24505/35505]"),
            _row("Montréal, Quebec [24462]"),
            _row("Vancouver, British Columbia [59933]"),
            _row("Calgary, Alberta [48825]"),
            _row("Edmonton, Alberta [48835]"),
            _row("Canada"),
        ]
        self.assertEqual(missing_geographies(collect(rows)), [])

    def test_geo_format_drift_flags_dropped_city(self) -> None:
        rows = [
            _row("Toronto (CMA), Ont. [35535]"),
            _row("Hamilton, Ontario [35537]"),
            _row("Ottawa-Gatineau, Ontario/Quebec [24505/35505]"),
            _row("Montréal, Quebec [24462]"),
            _row("Vancouver, British Columbia [59933]"),
            _row("Calgary, Alberta [48825]"),
            _row("Edmonton, Alberta [48835]"),
            _row("Canada"),
        ]
        self.assertEqual(missing_geographies(collect(rows)), ["Toronto CMA"])


if __name__ == "__main__":
    unittest.main()
