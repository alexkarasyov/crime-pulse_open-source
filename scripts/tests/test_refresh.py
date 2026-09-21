"""Offline refresh integration tests, using synthetic sources and real builders."""
from __future__ import annotations

import io
import json
import shutil
import sys
import tempfile
import unittest
import zipfile
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import build_aggregates as aggregates
import import_cma_rates
import import_csi
import refresh
from import_tps_csi import OUTPUT_COLUMNS, write_markdown_table


def incident(event="old", category="Assault", neighbourhood="Example (1)", year=2025):
    row = {key: "" for key in OUTPUT_COLUMNS}
    row.update(event_id=event, report_date=f"{year}-01-01", occ_date=f"{year}-01-01",
               category=category, offence="Example offence", neighbourhood=neighbourhood)
    return row


def table(path, columns, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("| " + " | ".join(columns) + " |\n| " + " | ".join("---" for _ in columns)
                    + " |\n" + "".join("| " + " | ".join(str(v) for v in row) + " |\n" for row in rows))


def sources(data):
    for name in refresh.SOURCE_DIRS:
        (data / name).mkdir(parents=True)
    for year in aggregates.YEARS + aggregates.PARTIAL_YEARS:
        write_markdown_table(data / "crimes" / f"tps-csi-{year}.md",
                             [incident(event=f"event-{year}", year=year), incident(event=f"unresolved-{year}", neighbourhood="NSA", year=year)], "https://example.invalid/tps")
    refresh.write_json(data / "crimes/tps-csi-validation.json", {"source": {"imported_at": "2026-01-01T00:00:00Z"}, "years": {}})
    table(data / "population/toronto-neighbourhoods-2021.md", ("neighbourhood_id", "neighbourhood_name", "population_2021_sample25"), [(n, f"Neighbourhood {n}", 17686) for n in range(1, 159)])
    table(data / "population/toronto-csd-annual.md", ("year", "population_july1", "source_release_date"), [(y, 3000000, "2026-01-01") for y in aggregates.YEARS])
    refresh.write_json(data / "population/validation.json", {"csd_file": {"source": {"release_date": "2026-01-01"}}})
    for name, filename, columns, labels in (
        ("csi", "csi-by-geography.md", ("csi_total", "csi_violent", "csi_non_violent"), ["Toronto", "Canada", "Ontario", "Montréal", "Vancouver", "Calgary"]),
        ("cma", "cma-rates-by-geography.md", ("rate_per_100k",), ["Toronto CMA", "Hamilton", "Ottawa-Gatineau", "Montréal", "Vancouver", "Calgary", "Edmonton", "Canada"]),
    ):
        table(data / name / filename, ("year", "geography", *columns), [(2025, label, *([50] * len(columns))) for label in labels])
        refresh.write_json(data / name / "validation.json", {"source": {"fetched_at": "2026-01-01T00:00:00Z"}, "years_present": [2025, 2025]})
    refresh.write_json(data / "geo/neighbourhoods-4326.geojson", {
        "type": "FeatureCollection", "features": [{"type": "Feature", "properties": {"AREA_SHORT_CODE": str(n), "AREA_NAME": f"Neighbourhood {n}"},
        "geometry": {"type": "Polygon", "coordinates": [[[-79.4, 43.6], [-79.3, 43.6], [-79.3, 43.7], [-79.4, 43.6]]]}} for n in range(1, 159)]})


class RefreshTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.accepted = self.root / "data"
        sources(self.accepted)
        self.initial = refresh.manifest(self.accepted)
        self.candidate = self.root / "imported"
        shutil.copytree(self.accepted, self.candidate)
        self.run = self.root / "review"

    def stage(self):
        with redirect_stdout(io.StringIO()):
            return refresh.stage(self.accepted, self.run, self.candidate)

    def test_unchanged_replay_builds_complete_candidate_and_accepts(self):
        report_path = self.stage()
        report = json.loads(report_path.read_text())
        self.assertFalse(report["comparison"]["substantive_changes"])
        self.assertIn("No substantive data changes", (self.run / "review.md").read_text())
        self.assertEqual(refresh.manifest(self.accepted), self.initial)
        self.assertTrue((self.run / "candidate/public-data/aggregates/cma-context.json").exists())
        with redirect_stdout(io.StringIO()):
            refresh.apply(report_path)
        self.assertEqual(refresh.manifest(self.accepted), self.initial)

    def test_changed_counts_coverage_population_and_context_are_exact(self):
        rows = [incident(event="event-2025", category="Robbery", neighbourhood="NSA"), incident(event="new", category="Assault")]
        write_markdown_table(self.candidate / "crimes/tps-csi-2025.md", rows, "https://example.invalid/tps")
        city = self.candidate / "population/toronto-csd-annual.md"
        city.write_text(city.read_text().replace("2025 | 3000000", "2025 | 3000001"))
        csi = self.candidate / "csi/csi-by-geography.md"
        csi.write_text(csi.read_text().replace("Toronto | 50", "Toronto | 51"))
        report = json.loads(self.stage().read_text())
        diff = report["comparison"]
        self.assertTrue(diff["substantive_changes"])
        self.assertEqual({key: diff["incidents"]["totals"][key] for key in ("added", "removed", "revised_to", "net_change")}, {"added": 1, "removed": 1, "revised_to": 1, "net_change": 0})
        assault = next(r for r in diff["incidents"]["by_year_category"] if r["year"] == 2025 and r["category"] == "Assault")
        robbery = next(r for r in diff["incidents"]["by_year_category"] if r["year"] == 2025 and r["category"] == "Robbery")
        self.assertEqual((assault["before"], assault["after"], assault["unresolved_change"]), (2, 1, -1))
        self.assertEqual((robbery["before"], robbery["after"], robbery["unresolved_change"]), (0, 1, 1))
        self.assertEqual(len(diff["tables"]["city_population"]), 1)
        self.assertEqual(len(diff["tables"]["csi"]), 1)
        self.assertEqual(refresh.manifest(self.accepted), self.initial)
        # Unrelated data can change after review and must survive acceptance.
        unrelated = self.accepted / "sitemap-lastmod.json"
        unrelated.write_text('"new build"')
        with redirect_stdout(io.StringIO()):
            refresh.apply(self.run / "review.json")
        self.assertEqual(unrelated.read_text(), '"new build"')
        self.assertEqual(refresh.manifest(self.accepted, True), refresh.manifest(self.candidate, True))

    def test_metadata_only_refresh_is_not_substantive(self):
        meta = self.candidate / "crimes/tps-csi-validation.json"
        meta.write_text(meta.read_text().replace("2026-01-01", "2026-09-12"))
        city = self.candidate / "population/toronto-csd-annual.md"
        city.write_text(city.read_text().replace("2026-01-01", "2026-09-12"))
        self.assertFalse(refresh.comparison(self.accepted, self.candidate)["substantive_changes"])

    def test_invalid_source_never_changes_accepted_archive(self):
        bad = self.candidate / "crimes/tps-csi-2025.md"
        bad.write_text(bad.read_text().replace("2025-01-01", "2025-02-30"))
        with self.assertRaises(Exception):
            self.stage()
        self.assertEqual(refresh.manifest(self.accepted), self.initial)
        self.assertFalse((self.run / "review.json").exists())
        self.assertTrue((self.run / "failure.json").exists())

    def test_late_import_failure_never_changes_accepted_archive(self):
        def failed_import(data, _log):
            (data / "crimes/tps-csi-2025.md").write_text("partially imported")
            raise RuntimeError("Population import failed after TPS succeeded")
        with patch.object(refresh, "import_sources", side_effect=failed_import), self.assertRaisesRegex(RuntimeError, "Population"):
            refresh.stage(self.accepted, self.run)
        self.assertEqual(refresh.manifest(self.accepted), self.initial)
        self.assertFalse((self.run / "review.json").exists())

    def test_changed_candidate_is_rejected(self):
        review = self.stage()
        path = self.run / "candidate/data/crimes/tps-csi-2025.md"
        path.write_text(path.read_text() + "\nchanged after review\n")
        with self.assertRaisesRegex(RuntimeError, "Candidate files changed"):
            refresh.apply(review)
        self.assertEqual(refresh.manifest(self.accepted), self.initial)

    def test_changed_accepted_source_is_rejected(self):
        review = self.stage()
        path = self.accepted / "csi/validation.json"
        path.write_text(path.read_text() + "\n")
        changed = refresh.manifest(self.accepted)
        with self.assertRaisesRegex(RuntimeError, "Accepted source files changed"):
            refresh.apply(review)
        self.assertEqual(refresh.manifest(self.accepted), changed)

    def test_changed_generated_candidate_or_review_is_rejected(self):
        review = self.stage()
        (self.run / "review.md").write_text("different human-readable conclusions")
        with self.assertRaisesRegex(RuntimeError, "human-readable review changed"):
            refresh.apply(review)
        self.assertEqual(refresh.manifest(self.accepted), self.initial)

    def test_apply_rollback_preserves_all_originals_on_second_directory_failure(self):
        review = self.stage()
        original = Path.replace
        failed = False
        def fail_once(path, target):
            nonlocal failed
            if path.name == "population" and path.parent.name == "sources" and not failed:
                failed = True
                raise OSError("simulated disk failure during acceptance")
            return original(path, target)
        with patch.object(Path, "replace", fail_once), redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(OSError, "simulated disk failure"):
                refresh.apply(review)
        self.assertTrue(failed)
        self.assertEqual(refresh.manifest(self.accepted), self.initial)
        self.assertFalse((self.root / ".crime-pulse-refresh.lock").exists())

    def test_symlinked_candidate_source_is_rejected_without_writes(self):
        (self.candidate / "population/external").symlink_to(self.accepted / "population/validation.json")
        with self.assertRaisesRegex(RuntimeError, "Symlinks"):
            self.stage()
        self.assertEqual(refresh.manifest(self.accepted), self.initial)


class MonthlyReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.data = Path(self.tmp.name) / "data"
        sources(self.data)
        with redirect_stdout(io.StringIO()):
            self.corpus = aggregates.read_csi_corpus(self.data / "crimes")

    def test_city_and_unresolved_months_include_ytd_and_reconcile(self):
        self.assertEqual(aggregates.validate_monthly_corpus(self.corpus), [])
        self.assertEqual(self.corpus["monthly_unresolved"][(2026, 1)]["assault"], 1)

    def test_monthly_unresolved_drift_is_a_validation_failure(self):
        self.corpus["monthly_unresolved"][(2026, 1)]["assault"] += 1
        errors = aggregates.validate_monthly_corpus(self.corpus)
        self.assertTrue(any("Unresolved monthly/yearly mismatch: 2026 assault" in e for e in errors))
        self.assertTrue(any("City monthly resolution mismatch: 2026-01 assault" in e for e in errors))

    def test_emitted_neighbourhood_calendar_must_match_annual_values(self):
        neighbourhoods = aggregates.read_neighbourhood_populations(self.data / "population")
        corpus = self.corpus
        toronto = aggregates.build_toronto_by_year(corpus["yearly_totals"], {y: 3000000 for y in aggregates.YEARS}, "now", {2026}, corpus["yearly_unresolved"])
        yearly = aggregates.build_by_neighbourhood_year(corpus["yearly_by_nbhd"], neighbourhoods, "now", {2026})
        monthly = aggregates.build_by_neighbourhood_month(corpus["monthly_by_nbhd"], neighbourhoods, "now")
        feeds = aggregates.build_incident_feed(corpus["incidents_by_nbhd"], neighbourhoods)
        self.assertEqual(aggregates.validate_aggregates(toronto, yearly, monthly, feeds, neighbourhoods), [])
        monthly["neighbourhoods"]["1"]["series"]["assault"][0]["count"] += 1
        errors = aggregates.validate_aggregates(toronto, yearly, monthly, feeds, neighbourhoods)
        self.assertTrue(any("Monthly totals do not reconcile" in error for error in errors))


class ContextImporterStagingTests(unittest.TestCase):
    def check_importer(self, module, statistics, violation=""):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            accepted, staged = root / "accepted", root / "staged"
            accepted.mkdir()
            existing = accepted / module.MD_PATH.name
            existing.write_text("accepted source must survive")
            buffer = io.BytesIO()
            rows = ["REF_DATE,GEO,Statistics,Violations,VALUE"]
            for _label, needle, mode in module.WANTED:
                geo = needle + "123]" if mode == "contains" else needle
                rows.append(f'2025,"{geo}","{statistics}","{violation}",50')
            with zipfile.ZipFile(buffer, "w") as archive:
                archive.writestr("source.csv", "\n".join(rows))
            with patch.object(sys, "argv", [module.__file__, "--out-dir", str(staged)]), patch.object(
                module, "fetch_zip", return_value=buffer.getvalue()
            ), patch.object(module, "DATA_DIR", accepted), patch.object(
                module, "MD_PATH", existing
            ), patch.object(module, "VAL_PATH", accepted / "validation.json"), redirect_stdout(io.StringIO()):
                self.assertEqual(module.main(), 0)
            self.assertEqual(existing.read_text(), "accepted source must survive")
            self.assertTrue((staged / existing.name).is_file())
            self.assertTrue((staged / "validation.json").is_file())
            self.assertFalse((accepted / "validation.json").exists())

    def test_csi_command_writes_only_to_explicit_staged_directory(self):
        self.check_importer(import_csi, "Crime severity index")

    def test_cma_command_writes_only_to_explicit_staged_directory(self):
        self.check_importer(import_cma_rates, import_cma_rates.STATISTIC, import_cma_rates.VIOLATION)


if __name__ == "__main__":
    unittest.main()
