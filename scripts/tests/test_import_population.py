#!/usr/bin/env python3
"""Failure-safety tests for scripts/import_population.py."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import import_population


class FailedImportSafetyTests(unittest.TestCase):
    def test_validation_failure_leaves_existing_outputs_untouched(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            root = Path(tmpdir)
            out_dir = root / "population"
            crimes_dir = root / "crimes"
            out_dir.mkdir()
            crimes_dir.mkdir()

            targets = {
                out_dir / "toronto-neighbourhoods-2021.md": "existing neighbourhoods\n",
                out_dir / "toronto-csd-annual.md": "existing city population\n",
                out_dir / "validation.json": "existing validation\n",
            }
            for path, content in targets.items():
                path.write_text(content, encoding="utf-8")

            args = SimpleNamespace(
                neighbourhood_url="https://example.invalid/neighbourhoods.xlsx",
                csd_url="https://example.invalid/csd.zip",
                out_dir=out_dir,
                crimes_dir=crimes_dir,
            )
            valid_csd = [
                {
                    "year": year,
                    "population_july1": 3_000_000,
                    "source_release_date": "2026-01-01",
                }
                for year in import_population.CSD_YEARS
            ]

            def fake_get(_url: str, destination: Path) -> None:
                destination.write_bytes(b"fixture")

            with patch.object(import_population, "parse_args", return_value=args), patch.object(
                import_population, "http_get", side_effect=fake_get
            ), patch.object(
                import_population, "read_neighbourhoods", return_value=[]
            ), patch.object(
                import_population,
                "read_csd_annual",
                return_value=(valid_csd, "2026-01-01"),
            ), patch.object(
                import_population, "collect_csi_neighbourhood_ids", return_value=set()
            ):
                self.assertEqual(import_population.main(), 1)

            for path, content in targets.items():
                self.assertEqual(path.read_text(encoding="utf-8"), content)


if __name__ == "__main__":
    unittest.main()
