#!/usr/bin/env python3
"""Tests for the pure helpers in scripts/import_tps_csi.py.

Helper and failure-path tests; main() uses mocked downloads and temporary
outputs, so nothing here touches the network or canonical data/.
"""

from __future__ import annotations

import csv
import io
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import import_tps_csi
from import_tps_csi import (
    REQUIRED_SOURCE_COLUMNS,
    YearStats,
    clean,
    dedupe_key,
    markdown_cell,
    normalize_row,
    parse_year,
    update_stats,
)


def _source_row(**overrides: str) -> dict:
    """A minimal source-CSV row with every column normalize_row reads."""
    row = {
        "EVENT_UNIQUE_ID": "GO-20240001",
        "REPORT_DATE": "2024-03-05",
        "OCC_DATE": "2024-03-04",
        "CSI_CATEGORY": "Assault",
        "OFFENCE": "Assault",
        "NEIGHBOURHOOD_158": "Annex (95)",
        "DIVISION": "D53",
        "PREMISES_TYPE": "Outside",
        "LOCATION_TYPE": "Streets, Roads, Highways",
        "LAT_WGS84": "43.67",
        "LONG_WGS84": "-79.40",
    }
    row.update(overrides)
    return row


class CleanTests(unittest.TestCase):
    def test_none_becomes_empty_string(self) -> None:
        self.assertEqual(clean(None), "")

    def test_whitespace_collapsed_and_stripped(self) -> None:
        self.assertEqual(clean("  a   b\tc  "), "a b c")

    def test_newlines_collapsed_to_single_space(self) -> None:
        self.assertEqual(clean("line1\nline2\r\nline3"), "line1 line2 line3")

    def test_plain_value_untouched(self) -> None:
        self.assertEqual(clean("Assault"), "Assault")


class MarkdownCellTests(unittest.TestCase):
    def test_pipe_escaped(self) -> None:
        self.assertEqual(markdown_cell("a|b"), "a\\|b")

    def test_newlines_stripped_before_escaping(self) -> None:
        # markdown_cell runs clean() first, so embedded newlines can never
        # break a table row.
        self.assertEqual(markdown_cell("a\nb | c"), "a b \\| c")

    def test_empty_and_none_safe(self) -> None:
        self.assertEqual(markdown_cell(""), "")

    def test_multiple_pipes_all_escaped(self) -> None:
        self.assertEqual(markdown_cell("|x|"), "\\|x\\|")


class ParseYearTests(unittest.TestCase):
    def test_report_year_wins_when_valid(self) -> None:
        row = {"REPORT_YEAR": "2019", "REPORT_DATE": "2020-01-01"}
        self.assertEqual(parse_year(row), 2019)

    def test_fallback_to_report_date(self) -> None:
        row = {"REPORT_DATE": "2021-07-15"}
        self.assertEqual(parse_year(row), 2021)

    def test_blank_year_falls_back_to_date(self) -> None:
        row = {"REPORT_YEAR": "  ", "REPORT_DATE": "2018-02-03"}
        self.assertEqual(parse_year(row), 2018)

    def test_unparseable_returns_none(self) -> None:
        self.assertIsNone(parse_year({"REPORT_YEAR": "n/a", "REPORT_DATE": "03/05/2024"}))

    def test_missing_both_returns_none(self) -> None:
        self.assertIsNone(parse_year({}))


class NormalizeRowTests(unittest.TestCase):
    def test_full_mapping(self) -> None:
        normalized = normalize_row(_source_row())
        self.assertEqual(
            normalized,
            {
                "event_id": "GO-20240001",
                "report_date": "2024-03-05",
                "occ_date": "2024-03-04",
                "category": "Assault",
                "offence": "Assault",
                "neighbourhood": "Annex (95)",
                "division": "D53",
                "premises_type": "Outside",
                "location_type": "Streets, Roads, Highways",
                "lat": "43.67",
                "lng": "-79.40",
            },
        )

    def test_missing_source_columns_become_empty(self) -> None:
        normalized = normalize_row({})
        self.assertEqual(set(normalized.values()), {""})

    def test_values_are_cleaned(self) -> None:
        normalized = normalize_row(_source_row(OFFENCE="  Theft\nOver  "))
        self.assertEqual(normalized["offence"], "Theft Over")


class DedupeKeyTests(unittest.TestCase):
    def test_identical_rows_collide(self) -> None:
        a = normalize_row(_source_row())
        b = normalize_row(_source_row())
        self.assertEqual(dedupe_key(a), dedupe_key(b))

    def test_differing_rows_do_not_collide(self) -> None:
        base = normalize_row(_source_row())
        variant = normalize_row(_source_row(OFFENCE="Robbery - Mugging"))
        self.assertNotEqual(dedupe_key(base), dedupe_key(variant))

    def test_same_event_id_different_location_kept_distinct(self) -> None:
        # One EVENT_UNIQUE_ID can span rows differing only in premises/division.
        a = normalize_row(_source_row(PREMISES_TYPE="Outside"))
        b = normalize_row(_source_row(PREMISES_TYPE="Apartment"))
        self.assertNotEqual(dedupe_key(a), dedupe_key(b))

    def test_key_covers_every_output_field(self) -> None:
        row = normalize_row(_source_row())
        self.assertEqual(len(dedupe_key(row)), len(row))


class UpdateStatsTests(unittest.TestCase):
    def test_counts_rows_and_categories(self) -> None:
        stats = YearStats()
        update_stats(stats, normalize_row(_source_row()))
        update_stats(stats, normalize_row(_source_row(CSI_CATEGORY="Robbery")))
        self.assertEqual(stats.rows, 2)
        self.assertEqual(stats.categories["Assault"], 1)
        self.assertEqual(stats.categories["Robbery"], 1)

    def test_missing_coordinates_counted(self) -> None:
        stats = YearStats()
        update_stats(stats, normalize_row(_source_row(LAT_WGS84="")))
        update_stats(stats, normalize_row(_source_row(LONG_WGS84="")))
        update_stats(stats, normalize_row(_source_row()))
        self.assertEqual(stats.missing_coordinates, 2)

    def test_min_max_report_date_tracked(self) -> None:
        stats = YearStats()
        update_stats(stats, normalize_row(_source_row(REPORT_DATE="2024-06-01")))
        update_stats(stats, normalize_row(_source_row(REPORT_DATE="2024-01-15")))
        update_stats(stats, normalize_row(_source_row(REPORT_DATE="2024-12-31")))
        self.assertEqual(stats.min_report_date, "2024-01-15")
        self.assertEqual(stats.max_report_date, "2024-12-31")

    def test_empty_report_date_leaves_bounds_untouched(self) -> None:
        stats = YearStats()
        update_stats(stats, normalize_row(_source_row(REPORT_DATE="")))
        self.assertIsNone(stats.min_report_date)
        self.assertIsNone(stats.max_report_date)

    def test_empty_category_not_counted(self) -> None:
        stats = YearStats()
        update_stats(stats, normalize_row(_source_row(CSI_CATEGORY="")))
        self.assertEqual(sum(stats.categories.values()), 0)


class FailedImportSafetyTests(unittest.TestCase):
    class _Response(io.BytesIO):
        headers: dict[str, str] = {}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb) -> None:
            self.close()

    def test_invalid_report_dates_leave_existing_outputs_untouched(self) -> None:
        for report_date in ("2024-13-05", "2024-02-30", "2023-03-05", "20240305", ""):
            with self.subTest(report_date=report_date), tempfile.TemporaryDirectory() as tmpdir:
                out_dir = Path(tmpdir)
                existing_year = out_dir / "tps-csi-2024.md"
                report = out_dir / "tps-csi-validation.json"
                existing_year.write_text("existing corpus\n", encoding="utf-8")
                report.write_text("existing report\n", encoding="utf-8")

                columns = (*REQUIRED_SOURCE_COLUMNS, "REPORT_YEAR")
                values = _source_row(REPORT_DATE=report_date, REPORT_YEAR="2024")
                csv_output = io.StringIO()
                writer = csv.DictWriter(csv_output, fieldnames=columns)
                writer.writeheader()
                writer.writerow(values)
                raw = csv_output.getvalue().encode()
                args = SimpleNamespace(
                    url="https://example.invalid/tps.csv", out_dir=out_dir,
                    report=report, start_year=2024, end_year=2024,
                )
                with patch.object(import_tps_csi, "parse_args", return_value=args), patch.object(
                    import_tps_csi.urllib.request, "urlopen", return_value=self._Response(raw),
                ):
                    self.assertEqual(import_tps_csi.main(), 2)

                self.assertEqual(existing_year.read_text(encoding="utf-8"), "existing corpus\n")
                self.assertEqual(report.read_text(encoding="utf-8"), "existing report\n")

    def test_empty_full_year_leaves_existing_outputs_untouched(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            out_dir = root / "crimes"
            out_dir.mkdir()
            existing_year = out_dir / "tps-csi-2016.md"
            report = out_dir / "tps-csi-validation.json"
            existing_year.write_text("existing corpus\n", encoding="utf-8")
            report.write_text("existing report\n", encoding="utf-8")

            values = {
                "REPORT_DATE": "2026-01-01",
                "OCC_DATE": "2026-01-01",
                "EVENT_UNIQUE_ID": "GO-1",
                "CSI_CATEGORY": "Assault",
                "OFFENCE": "Assault",
                "NEIGHBOURHOOD_158": "Annex (95)",
                "DIVISION": "D53",
                "PREMISES_TYPE": "Outside",
                "LOCATION_TYPE": "Street",
                "LAT_WGS84": "43.67",
                "LONG_WGS84": "-79.40",
            }
            header = ",".join(REQUIRED_SOURCE_COLUMNS)
            row = ",".join(values[column] for column in REQUIRED_SOURCE_COLUMNS)
            raw = f"{header}\n{row}\n".encode()
            args = SimpleNamespace(
                url="https://example.invalid/tps.csv",
                out_dir=out_dir,
                report=report,
                start_year=2016,
                end_year=2016,
            )

            with patch.object(import_tps_csi, "parse_args", return_value=args), patch.object(
                import_tps_csi.urllib.request,
                "urlopen",
                return_value=self._Response(raw),
            ):
                self.assertEqual(import_tps_csi.main(), 3)

            self.assertEqual(existing_year.read_text(encoding="utf-8"), "existing corpus\n")
            self.assertEqual(report.read_text(encoding="utf-8"), "existing report\n")


if __name__ == "__main__":
    unittest.main()
