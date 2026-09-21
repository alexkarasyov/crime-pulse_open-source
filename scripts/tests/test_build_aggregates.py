#!/usr/bin/env python3
"""Tests for the pure / local-IO helpers in scripts/build_aggregates.py.

No network or reads from the canonical data/ archive. Most tests exercise
helpers; the optional-output regression runs main() against temporary fixtures.
"""

from __future__ import annotations

import io
import json
import sys
import tempfile
import unittest
from collections import Counter
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_aggregates
from build_aggregates import (
    CATEGORY_IDS,
    GEOJSON_EXPECTED_FEATURES,
    PARTIAL_YEARS,
    YEARS,
    _round_coords,
    build_toronto_by_year,
    human_bytes,
    parse_csi_row,
    round_rate,
    slim_geojson,
    validate_geojson,
    write_json,
    write_json_compact,
)


def _csi_row(**overrides: str) -> dict:
    """A Markdown-corpus row with the keys parse_csi_row reads."""
    row = {
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
    }
    row.update(overrides)
    return row


def _feature(nid: object, name: str, coords: object = None) -> dict:
    """A GeoJSON Feature with upstream property names."""
    if coords is None:
        coords = [[[-79.4, 43.7], [-79.41, 43.71], [-79.4, 43.7]]]
    return {
        "type": "Feature",
        "properties": {
            "AREA_SHORT_CODE": nid,
            "AREA_NAME": name,
            "AREA_LONG_CODE": "bookkeeping",
            "OBJECTID": 1,
        },
        "geometry": {"type": "Polygon", "coordinates": coords},
    }


class RoundRateTests(unittest.TestCase):
    def test_rounds_to_two_decimals(self) -> None:
        self.assertEqual(round_rate(12.3456), 12.35)
        self.assertEqual(round_rate(0.0), 0.0)
        self.assertEqual(round_rate(7.1), 7.1)
        # Delegates to round(value, 2) exactly, float representation and all.
        self.assertEqual(round_rate(99.995), round(99.995, 2))


class HumanBytesTests(unittest.TestCase):
    def test_bytes_have_no_decimal(self) -> None:
        self.assertEqual(human_bytes(0), "0B")
        self.assertEqual(human_bytes(1023), "1023B")

    def test_kilobytes(self) -> None:
        self.assertEqual(human_bytes(1024), "1.0KB")
        self.assertEqual(human_bytes(1536), "1.5KB")

    def test_megabytes(self) -> None:
        self.assertEqual(human_bytes(2 * 1024 * 1024), "2.0MB")

    def test_gigabytes(self) -> None:
        self.assertEqual(human_bytes(3 * 1024 * 1024 * 1024), "3.0GB")


class RoundCoordsTests(unittest.TestCase):
    def test_innermost_pair_rounded(self) -> None:
        self.assertEqual(
            _round_coords([-79.123456789, 43.987654321], 4),
            [-79.1235, 43.9877],
        )

    def test_nested_polygon_tree(self) -> None:
        tree = [[[[-79.12345678, 43.7654321], [-79.2, 43.8]]]]
        self.assertEqual(
            _round_coords(tree, 4),
            [[[[-79.1235, 43.7654], [-79.2, 43.8]]]],
        )

    def test_non_numeric_leaves_untouched(self) -> None:
        self.assertEqual(_round_coords(["x", 1.23456], 2), ["x", 1.23])


class SlimGeojsonTests(unittest.TestCase):
    def test_props_trimmed_coords_rounded_features_sorted(self) -> None:
        geo = {
            "type": "FeatureCollection",
            "features": [
                _feature("095", "Annex", [[[-79.123456789, 43.987654321]]]),
                _feature("001", "West Humber-Clairville"),
            ],
        }
        slimmed = slim_geojson(geo)
        self.assertEqual(slimmed["type"], "FeatureCollection")
        ids = [f["properties"]["id"] for f in slimmed["features"]]
        self.assertEqual(ids, ["1", "95"])  # sorted numerically, zero-pad dropped
        annex = slimmed["features"][1]
        self.assertEqual(annex["properties"], {"id": "95", "name": "Annex"})
        self.assertEqual(
            annex["geometry"]["coordinates"], [[[-79.1235, 43.9877]]]
        )

    def test_non_integer_id_feature_skipped(self) -> None:
        geo = {
            "type": "FeatureCollection",
            "features": [_feature("not-a-number", "Bad"), _feature("2", "Good")],
        }
        slimmed = slim_geojson(geo)
        self.assertEqual(len(slimmed["features"]), 1)
        self.assertEqual(slimmed["features"][0]["properties"]["id"], "2")


class ValidateGeojsonTests(unittest.TestCase):
    def test_wrong_top_level_type(self) -> None:
        errors = validate_geojson({"type": "Feature"}, set())
        self.assertEqual(len(errors), 1)
        self.assertIn("not FeatureCollection", errors[0])

    def test_feature_count_flagged_for_small_fixture(self) -> None:
        geo = {"type": "FeatureCollection", "features": [_feature("1", "A")]}
        errors = validate_geojson(geo, {1})
        self.assertTrue(
            any(f"expected {GEOJSON_EXPECTED_FEATURES}" in e for e in errors)
        )

    def test_id_set_mismatches_flagged_both_ways(self) -> None:
        geo = {
            "type": "FeatureCollection",
            "features": [_feature("1", "A"), _feature("2", "B")],
        }
        errors = validate_geojson(geo, {1, 3})
        # GeoJSON has id 2 that the aggregates don't...
        self.assertTrue(
            any("missing from aggregates" in e and "[2]" in e for e in errors)
        )
        # ...and the aggregates expect id 3 that the GeoJSON lacks.
        self.assertTrue(
            any("missing from GeoJSON" in e and "[3]" in e for e in errors)
        )

    def test_matching_ids_produce_only_count_error(self) -> None:
        geo = {
            "type": "FeatureCollection",
            "features": [_feature("1", "A"), _feature("2", "B")],
        }
        errors = validate_geojson(geo, {1, 2})
        self.assertEqual(len(errors), 1)  # only the 158-feature count check
        self.assertIn("features", errors[0])

    def test_missing_and_bad_id_properties_flagged(self) -> None:
        feat_no_id = {"type": "Feature", "properties": {"AREA_NAME": "X"}}
        geo = {
            "type": "FeatureCollection",
            "features": [feat_no_id, _feature("abc", "Y")],
        }
        errors = validate_geojson(geo, set())
        self.assertTrue(any("missing AREA_SHORT_CODE" in e for e in errors))
        self.assertTrue(any("Non-integer AREA_SHORT_CODE" in e for e in errors))


class ParseCsiRowTests(unittest.TestCase):
    def test_valid_row(self) -> None:
        parsed = parse_csi_row(_csi_row(), 2024)
        self.assertIsNotNone(parsed)
        nid, month, category_id, incident = parsed
        self.assertEqual(nid, 95)
        self.assertEqual(month, 3)
        self.assertEqual(category_id, "assault")
        self.assertEqual(
            incident,
            {
                "date": "2024-03-05",
                "category": "assault",
                "offence": "Assault",
                "premises_type": "Outside",
            },
        )

    def test_category_mapping(self) -> None:
        parsed = parse_csi_row(_csi_row(category="Auto Theft"), 2024)
        self.assertEqual(parsed[2], "autoTheft")

    def test_unmapped_category_returns_none(self) -> None:
        self.assertIsNone(parse_csi_row(_csi_row(category="Homicide"), 2024))

    def test_missing_neighbourhood_id_returns_none(self) -> None:
        parsed_nsa = parse_csi_row(_csi_row(neighbourhood="NSA"), 2024)
        parsed_blank = parse_csi_row(_csi_row(neighbourhood=""), 2024)
        self.assertIsNotNone(parsed_nsa)
        self.assertIsNotNone(parsed_blank)
        self.assertIsNone(parsed_nsa[0])
        self.assertIsNone(parsed_blank[0])

    def test_bad_date_returns_none(self) -> None:
        self.assertIsNone(parse_csi_row(_csi_row(report_date="03/05/2024"), 2024))
        self.assertIsNone(parse_csi_row(_csi_row(report_date=""), 2024))

    def test_impossible_calendar_date_returns_none(self) -> None:
        for report_date in ("2024-13-05", "2024-00-05", "2024-02-30", "2023-02-29"):
            with self.subTest(report_date=report_date):
                self.assertIsNone(
                    parse_csi_row(_csi_row(report_date=report_date), int(report_date[:4]))
                )

    def test_leap_day_is_kept(self) -> None:
        parsed = parse_csi_row(_csi_row(report_date="2024-02-29"), 2024)
        self.assertEqual(parsed[1], 2)
        self.assertEqual(parsed[3]["date"], "2024-02-29")

    def test_year_mismatch_raises(self) -> None:
        # A 2023 report_date filed in the 2024 table is a corpus mis-filing
        # and must fail loudly, not skew totals.
        with self.assertRaises(RuntimeError):
            parse_csi_row(_csi_row(report_date="2023-03-05"), 2024)


class ReadCsiCorpusTests(unittest.TestCase):
    def test_unresolved_rows_count_citywide_but_not_by_neighbourhood(self) -> None:
        columns = tuple(_csi_row().keys())
        rows = [
            _csi_row(),
            _csi_row(event_id="GO-20240002", neighbourhood="NSA"),
        ]
        lines = [
            "# fixture",
            "",
            "| " + " | ".join(columns) + " |",
            "| " + " | ".join(["---"] * len(columns)) + " |",
        ]
        lines.extend(
            "| " + " | ".join(row[column] for column in columns) + " |"
            for row in rows
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            (root / "tps-csi-2024.md").write_text(
                "\n".join(lines) + "\n", encoding="utf-8"
            )
            with patch.object(build_aggregates, "YEARS", (2024,)), patch.object(
                build_aggregates, "PARTIAL_YEARS", ()
            ):
                corpus = build_aggregates.read_csi_corpus(root)

        self.assertEqual(corpus["yearly_totals"][2024]["assault"], 2)
        self.assertEqual(corpus["yearly_unresolved"][2024]["assault"], 1)
        self.assertEqual(corpus["yearly_by_nbhd"][(2024, 95)]["assault"], 1)
        self.assertEqual(len(corpus["incidents_by_nbhd"][95]), 1)


class WriteJsonTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp_dir = Path(self._tmp.name)

    def test_write_json_round_trip(self) -> None:
        data = {"b": [1, 2, 3], "a": {"nested": True}}
        path = self.tmp_dir / "sub" / "pretty.json"  # parent dir auto-created
        size = write_json(path, data)
        text = path.read_text(encoding="utf-8")
        self.assertEqual(json.loads(text), data)
        self.assertEqual(size, len(text.encode("utf-8")))
        self.assertTrue(text.endswith("\n"))
        # sort_keys=True: "a" serialises before "b".
        self.assertLess(text.index('"a"'), text.index('"b"'))

    def test_write_json_compact_round_trip(self) -> None:
        data = {"b": [1, 2, 3], "a": {"nested": True}}
        path = self.tmp_dir / "compact.json"
        size = write_json_compact(path, data)
        text = path.read_text(encoding="utf-8")
        self.assertEqual(json.loads(text), data)
        self.assertEqual(size, len(text.encode("utf-8")))
        # Compact separators: no spaces after , or :
        self.assertNotIn(": ", text)
        self.assertNotIn(", ", text)

    def test_compact_is_smaller_than_pretty(self) -> None:
        data = {"series": [{"year": y, "count": y} for y in range(2016, 2026)]}
        pretty = write_json(self.tmp_dir / "p.json", data)
        compact = write_json_compact(self.tmp_dir / "c.json", data)
        self.assertLess(compact, pretty)


class BuildTorontoByYearTests(unittest.TestCase):
    GENERATED_AT = "2026-07-16T00:00:00Z"

    def _totals(self) -> dict:
        totals = {y: Counter() for y in tuple(YEARS) + tuple(PARTIAL_YEARS)}
        totals[2016]["assault"] = 10
        totals[2016]["robbery"] = 5
        totals[2025]["assault"] = 20
        for year in PARTIAL_YEARS:
            totals[year]["assault"] = 3
        return totals

    def _city_pop(self) -> dict:
        return {y: 100000 for y in YEARS}

    def test_counts_rates_and_totals(self) -> None:
        out = build_toronto_by_year(
            self._totals(), self._city_pop(), self.GENERATED_AT, set()
        )
        assault_2016 = out["series"]["assault"][0]
        self.assertEqual(assault_2016, {"year": 2016, "count": 10, "rate_per_10k": 1.0})
        total_2016 = out["total_series"][0]
        self.assertEqual(total_2016["count"], 15)  # 10 assault + 5 robbery
        self.assertEqual(total_2016["rate_per_10k"], round_rate(15 / 100000 * 10000.0))
        # total_series count equals the sum across category series per year.
        for i, year in enumerate(YEARS):
            cat_sum = sum(out["series"][cat][i]["count"] for cat in CATEGORY_IDS)
            self.assertEqual(out["total_series"][i]["count"], cat_sum)

    def test_rate_rounding_via_round_rate(self) -> None:
        totals = {y: Counter() for y in tuple(YEARS) + tuple(PARTIAL_YEARS)}
        totals[2016]["assault"] = 1234
        city_pop = {y: 2794356 for y in YEARS}
        out = build_toronto_by_year(totals, city_pop, self.GENERATED_AT, set())
        expected = round(1234 / 2794356 * 10000.0, 2)
        self.assertEqual(out["series"]["assault"][0]["rate_per_10k"], expected)

    def test_year_axis_and_metadata(self) -> None:
        out = build_toronto_by_year(
            self._totals(), self._city_pop(), self.GENERATED_AT, set()
        )
        self.assertEqual(out["years"], list(YEARS))
        self.assertEqual(out["categories"], list(CATEGORY_IDS))
        self.assertEqual(out["generated_at"], self.GENERATED_AT)
        self.assertEqual(out["partial_years"], [])
        self.assertEqual(
            out["city_population_by_year"], {str(y): 100000 for y in YEARS}
        )
        for cat in CATEGORY_IDS:
            self.assertEqual(
                [p["year"] for p in out["series"][cat]], list(YEARS)
            )

    def test_partial_year_loaded_appends_flagged_point(self) -> None:
        partial_year = PARTIAL_YEARS[0]
        out = build_toronto_by_year(
            self._totals(), self._city_pop(), self.GENERATED_AT, {partial_year}
        )
        self.assertEqual(out["partial_years"], [partial_year])
        last_assault = out["series"]["assault"][-1]
        self.assertEqual(
            last_assault,
            {
                "year": partial_year,
                "count": 3,
                "rate_per_10k": None,  # no denominator for the YTD year
                "partial": True,
            },
        )
        last_total = out["total_series"][-1]
        self.assertEqual(last_total["count"], 3)
        self.assertIsNone(last_total["rate_per_10k"])
        self.assertTrue(last_total["partial"])

    def test_partial_year_not_loaded_emits_no_phantom_point(self) -> None:
        # Even with YTD counts pre-seeded in yearly_totals, the gate is
        # partial_years_loaded — an unloaded YTD file adds no point.
        out = build_toronto_by_year(
            self._totals(), self._city_pop(), self.GENERATED_AT, set()
        )
        for cat in CATEGORY_IDS:
            self.assertEqual(len(out["series"][cat]), len(YEARS))
        self.assertEqual(len(out["total_series"]), len(YEARS))

    def test_schema_version_present(self) -> None:
        out = build_toronto_by_year(
            self._totals(), self._city_pop(), self.GENERATED_AT, set()
        )
        self.assertEqual(out["schema_version"], build_aggregates.SCHEMA_VERSION)

    def test_neighbourhood_resolution_metadata_reconciles_city_totals(self) -> None:
        unresolved = {
            y: Counter() for y in tuple(YEARS) + tuple(PARTIAL_YEARS)
        }
        unresolved[2016]["assault"] = 2
        unresolved[2016]["robbery"] = 1

        out = build_toronto_by_year(
            self._totals(),
            self._city_pop(),
            self.GENERATED_AT,
            set(),
            unresolved,
        )

        coverage = out["neighbourhood_resolution"]
        self.assertEqual(coverage["unresolved_incidents"], 3)
        self.assertEqual(coverage["resolved_incidents"], coverage["total_incidents"] - 3)
        self.assertEqual(coverage["by_year"]["2016"]["total_incidents"], 15)
        self.assertEqual(coverage["by_year"]["2016"]["resolved_incidents"], 12)
        self.assertEqual(coverage["by_year"]["2016"]["unresolved_incidents"], 3)
        self.assertEqual(
            coverage["by_year"]["2016"]["unresolved_by_category"],
            {"assault": 2, "autoTheft": 0, "breakEnter": 0, "robbery": 1, "theftOver": 0},
        )


class FetchGeojsonCacheSafetyTests(unittest.TestCase):
    """A bad download must never overwrite a good cached GeoJSON."""

    def _fake_response(self, payload: bytes):
        class _Resp:
            def __enter__(self) -> "_Resp":
                return self

            def __exit__(self, *exc: object) -> None:
                return None

            def read(self) -> bytes:
                return payload

        return _Resp()

    def test_invalid_json_download_leaves_cache_untouched(self) -> None:
        good = json.dumps({"type": "FeatureCollection", "features": []}).encode()
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp) / "geo.json"
            cache.write_bytes(good)
            with patch.object(
                build_aggregates.urllib.request,
                "urlopen",
                return_value=self._fake_response(b"<html>502 Bad Gateway</html>"),
            ):
                with self.assertRaises(SystemExit):
                    build_aggregates.fetch_geojson("https://x.invalid/geo", cache, refresh=True)
            self.assertEqual(cache.read_bytes(), good)

    def test_download_is_not_cached_until_caller_validates(self) -> None:
        payload = json.dumps({"type": "FeatureCollection", "features": []}).encode()
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp) / "geo.json"
            with patch.object(
                build_aggregates.urllib.request,
                "urlopen",
                return_value=self._fake_response(payload),
            ):
                geo, raw = build_aggregates.fetch_geojson(
                    "https://x.invalid/geo", cache, refresh=False
                )
            self.assertEqual(geo["type"], "FeatureCollection")
            self.assertEqual(raw, payload)
            self.assertFalse(cache.exists())
            build_aggregates.write_geojson_cache(cache, raw)
            self.assertEqual(cache.read_bytes(), payload)

    def test_cache_hit_returns_none_raw(self) -> None:
        payload = json.dumps({"type": "FeatureCollection", "features": []})
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp) / "geo.json"
            cache.write_text(payload, encoding="utf-8")
            geo, raw = build_aggregates.fetch_geojson(
                "https://x.invalid/geo", cache, refresh=False
            )
            self.assertEqual(geo["type"], "FeatureCollection")
            self.assertIsNone(raw)


class OptionalContextCleanupTests(unittest.TestCase):
    def test_removing_optional_sources_removes_previous_generated_context(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            crimes = root / "data" / "crimes"
            crimes.mkdir(parents=True)
            # Real corpus parsing, builders, validation, and writers run below;
            # only the larger population and boundary inputs use small fixtures.
            columns = tuple(_csi_row().keys())
            (crimes / "tps-csi-2024.md").write_text(
                "| " + " | ".join(columns) + " |\n"
                + "| " + " | ".join(["---"] * len(columns)) + " |\n"
                + "| " + " | ".join(_csi_row().values()) + " |\n",
                encoding="utf-8",
            )
            csi = root / "data" / "csi" / "csi-by-geography.md"
            csi.parent.mkdir()
            csi.write_text(
                "| year | geography | csi_total | csi_violent | csi_non_violent |\n"
                "| --- | --- | --- | --- | --- |\n"
                "| 2024 | Toronto | 50 | 60 | 40 |\n", encoding="utf-8",
            )
            cma = root / "data" / "cma" / "cma-rates-by-geography.md"
            cma.parent.mkdir()
            cma.write_text(
                "| year | geography | rate_per_100k |\n"
                "| --- | --- | --- |\n"
                "| 2024 | Toronto CMA | 4000 |\n", encoding="utf-8",
            )
            neighbourhoods = {
                nid: {"id": str(nid), "name": f"Neighbourhood {nid}", "population": 10000}
                for nid in range(1, 159)
            }
            geo = {
                "type": "FeatureCollection",
                "features": [_feature(nid, info["name"]) for nid, info in neighbourhoods.items()],
            }
            args = SimpleNamespace(
                crimes_dir=crimes, population_dir=root / "data" / "population",
                out_dir=root / "public" / "data", geojson_url="https://example.invalid/geo",
                geojson_cache=root / "geo.json", refresh_geojson=False,
            )
            with patch.object(build_aggregates, "parse_args", return_value=args), patch.object(
                build_aggregates, "YEARS", (2024,),
            ), patch.object(
                build_aggregates, "read_neighbourhood_populations", return_value=neighbourhoods,
            ), patch.object(
                build_aggregates, "read_city_populations", return_value={2024: 3000000},
            ), patch.object(
                build_aggregates, "fetch_geojson", return_value=(geo, None),
            ), redirect_stdout(io.StringIO()):
                self.assertEqual(build_aggregates.main(), 0)
                outputs = [args.out_dir / "aggregates" / f"{kind}-context.json" for kind in ("csi", "cma")]
                self.assertTrue(all(path.exists() for path in outputs))
                csi.unlink()
                cma.unlink()
                self.assertEqual(build_aggregates.main(), 0)
                self.assertTrue(all(not path.exists() for path in outputs))


if __name__ == "__main__":
    unittest.main()
