#!/usr/bin/env python3
"""Stage and review all source imports before explicitly accepting an archive.

`stage --from-data DIR` replays already-imported sources without network access.
A review records source/candidate SHA-256 manifests. `apply review.json` refuses
stale inputs, revalidates a private copy, and replaces source directories with
rollback. Import timestamps are provenance, not substantive data changes.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import shutil
import shlex
import subprocess
import sys
import tempfile
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import build_aggregates as aggregates
from _md_table import iter_markdown_rows
from import_tps_csi import OUTPUT_COLUMNS

REPO = Path(__file__).resolve().parent.parent
SOURCE_DIRS = ("crimes", "population", "csi", "cma", "geo")
VERSION = 1


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def manifest(root: Path, managed_only: bool = False) -> dict[str, str]:
    """Hash names and bytes; reject links so a review cannot escape its tree."""
    result = {}
    roots = [root / name for name in SOURCE_DIRS] if managed_only else [root]
    for directory in roots:
        if not directory.is_dir() or directory.is_symlink():
            raise RuntimeError(f"Expected a real source directory: {directory}")
        for path in sorted(directory.rglob("*")):
            if path.is_symlink():
                raise RuntimeError(f"Symlinks are not allowed in reviewed inputs: {path}")
            if path.is_file():
                digest = hashlib.sha256()
                with path.open("rb") as handle:
                    for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                        digest.update(chunk)
                result[path.relative_to(root).as_posix()] = digest.hexdigest()
    return result


def copy_sources(source: Path, dest: Path) -> None:
    manifest(source, managed_only=True)
    dest.mkdir(parents=True, exist_ok=True)
    for name in SOURCE_DIRS:
        shutil.copytree(source / name, dest / name)


def command(args: list[str], log: Path) -> None:
    with log.open("a", encoding="utf-8") as output:
        output.write("\n$ " + " ".join(args) + "\n")
        output.flush()
        subprocess.run([sys.executable, *args], cwd=REPO, stdout=output,
                       stderr=subprocess.STDOUT, check=True)


def import_sources(data: Path, log: Path) -> None:
    command(["scripts/import_tps_csi.py", "--out-dir", str(data / "crimes"),
             "--report", str(data / "crimes/tps-csi-validation.json")], log)
    command(["scripts/import_population.py", "--out-dir", str(data / "population"),
             "--crimes-dir", str(data / "crimes")], log)
    command(["scripts/import_csi.py", "--out-dir", str(data / "csi")], log)
    command(["scripts/import_cma_rates.py", "--out-dir", str(data / "cma")], log)


def validate_sources(data: Path) -> None:
    """Validate canonical table values, independently of importer reports."""
    # Import lazily: offline review/replay needs only the standard library.
    populations = aggregates.read_neighbourhood_populations(data / "population")
    nbhd_rows = iter_markdown_rows(data / "population/toronto-neighbourhoods-2021.md")
    if len(nbhd_rows) != 158 or any(int(row["population_2021_sample25"]) <= 0 for row in nbhd_rows):
        raise RuntimeError("Population requires 158 unique, positive neighbourhood denominators.")
    if abs(sum(n["population"] for n in populations.values()) / 2794356 - 1) > .02:
        raise RuntimeError("Neighbourhood population sum exceeds the documented 2% tolerance.")
    city_rows = iter_markdown_rows(data / "population/toronto-csd-annual.md")
    city = aggregates.read_city_populations(data / "population")
    if len(city_rows) != len(aggregates.YEARS) or set(city) != set(aggregates.YEARS):
        raise RuntimeError("Population requires one row for every full year.")
    if any(not 2500000 <= population <= 3500000 for population in city.values()):
        raise RuntimeError("City population falls outside the documented validation range.")
    for name, filename, metrics, labels in (
        ("csi", "csi-by-geography.md", ("csi_total", "csi_violent", "csi_non_violent"),
         {"Toronto", "Canada", "Ontario", "Montréal", "Vancouver", "Calgary"}),
        ("cma", "cma-rates-by-geography.md", ("rate_per_100k",),
         {"Toronto CMA", "Hamilton", "Ottawa-Gatineau", "Montréal", "Vancouver", "Calgary", "Edmonton", "Canada"}),
    ):
        rows = iter_markdown_rows(data / name / filename)
        seen = set()
        for row in rows:
            key = (int(row["year"]), row["geography"])
            if key in seen or key[1] not in labels:
                raise RuntimeError(f"Duplicate or unexpected {name} geography/year: {key}")
            seen.add(key)
            for metric in metrics:
                if row[metric] and (not math.isfinite(float(row[metric])) or float(row[metric]) < 0):
                    raise RuntimeError(f"Invalid {name} value for {key}: {metric}")
        if {label for _year, label in seen} != labels:
            raise RuntimeError(f"Incomplete {name} geography coverage.")
        years = {year for year, _label in seen}
        if years != set(range(min(years), max(years) + 1)) or seen != {(y, label) for y in years for label in labels}:
            raise RuntimeError(f"Incomplete {name} year/geography coverage.")
    for year in aggregates.YEARS:
        if not iter_markdown_rows(data / "crimes" / f"tps-csi-{year}.md"):
            raise RuntimeError(f"Full year {year} is empty.")


def validate_candidate(data: Path, output: Path, log: Path) -> None:
    validate_sources(data)
    if not (data / "geo/neighbourhoods-4326.geojson").is_file():
        raise RuntimeError("The vendored boundary is required; refresh validation must not fetch it.")
    command(["scripts/build_aggregates.py", "--crimes-dir", str(data / "crimes"),
             "--population-dir", str(data / "population"), "--out-dir", str(output),
             "--geojson-cache", str(data / "geo/neighbourhoods-4326.geojson")], log)


def incident_rows(data: Path) -> dict[str, Counter]:
    events = defaultdict(Counter)
    for path in sorted((data / "crimes").glob("tps-csi-*.md")):
        for row in iter_markdown_rows(path):
            values = tuple(row[column] for column in OUTPUT_COLUMNS)
            if not row["event_id"]:
                raise RuntimeError(f"Missing event ID in {path}")
            events[row["event_id"]][values] += 1
    return events


def compare_incidents(before: Path, after: Path) -> dict:
    old, new = incident_rows(before), incident_rows(after)
    buckets = defaultdict(Counter)
    total = Counter()
    dates = {"before": None, "after": None}

    def add(row: tuple, field: str, amount: int = 1) -> None:
        year, category = int(row[1][:4]), row[3]
        buckets[(year, category)][field] += amount
        total[field] += amount

    for side, events in (("before", old), ("after", new)):
        for rows in events.values():
            for row, count in rows.items():
                add(row, side, count)
                if dates[side] is None or row[1] > dates[side]:
                    dates[side] = row[1]
                if aggregates._NID_SUFFIX_RE.search(row[5]) is None:
                    add(row, f"unresolved_{side}", count)
    for event in old.keys() | new.keys():
        previous, current = old.get(event, Counter()), new.get(event, Counter())
        removed = sorted((previous - current).elements())
        added = sorted((current - previous).elements())
        # The source has an event ID, but no stable offence-row ID. Identical
        # rows cancel first; remaining rows within an event are paired in a
        # deterministic order, so revisions are explicitly a row-level estimate.
        paired = min(len(removed), len(added))
        for left, right in zip(removed[:paired], added[:paired]):
            add(left, "revised_from")
            add(right, "revised_to")
        for row in removed[paired:]:
            add(row, "removed")
        for row in added[paired:]:
            add(row, "added")
    fields = ("before", "after", "added", "removed", "revised_from", "revised_to", "unresolved_before", "unresolved_after")
    rows = []
    for (year, category), values in sorted(buckets.items()):
        record = {"year": year, "category": category, **{key: values[key] for key in fields}}
        record["net_change"] = values["after"] - values["before"]
        record["unresolved_change"] = values["unresolved_after"] - values["unresolved_before"]
        rows.append(record)
    totals = {key: total[key] for key in fields}
    totals.update(net_change=total["after"] - total["before"], unresolved_change=total["unresolved_after"] - total["unresolved_before"])
    return {"totals": totals, "by_year_category": rows, "data_through": dates,
            "revision_method": "Identical rows cancel first. Remaining rows with the same EVENT_UNIQUE_ID are paired in sorted order. TPS has no stable offence-row ID, so revised row counts are estimates; additions, removals and net totals are exact under this pairing."}


def compare_table(before: Path, after: Path, keys: tuple[str, ...], ignored: tuple[str, ...] = ()) -> list[dict]:
    def indexed(path: Path) -> dict:
        return {tuple(row[k] for k in keys): {k: v for k, v in row.items() if k not in ignored}
                for row in iter_markdown_rows(path)}
    old, new = indexed(before), indexed(after)
    return [{"key": dict(zip(keys, key)), "before": old.get(key), "after": new.get(key)}
            for key in sorted(old.keys() | new.keys()) if old.get(key) != new.get(key)]


def source_metadata(data: Path) -> dict:
    result = {}
    for name, filename in (("crimes", "tps-csi-validation.json"), ("population", "validation.json"),
                           ("csi", "validation.json"), ("cma", "validation.json")):
        report = json.loads((data / name / filename).read_text())
        if name == "population":
            result[name] = {key: value.get("source", {}) for key, value in report.items()}
        else:
            result[name] = {"source": report.get("source", {}), "years_present": report.get("years_present", report.get("year_range"))}
    return result


def comparison(before: Path, after: Path) -> dict:
    incidents = compare_incidents(before, after)
    changes = {}
    for name, filename, keys, ignored in (
        ("neighbourhood_population", "population/toronto-neighbourhoods-2021.md", ("neighbourhood_id",), ()),
        ("city_population", "population/toronto-csd-annual.md", ("year",), ("source_release_date",)),
        ("csi", "csi/csi-by-geography.md", ("year", "geography"), ()),
        ("cma", "cma/cma-rates-by-geography.md", ("year", "geography"), ()),
    ):
        changes[name] = compare_table(before / filename, after / filename, keys, ignored)
    boundary_changed = (before / "geo/neighbourhoods-4326.geojson").read_bytes() != (after / "geo/neighbourhoods-4326.geojson").read_bytes()
    substantive = any(incidents["totals"][key] for key in ("added", "removed", "revised_to")) or any(changes.values()) or boundary_changed
    return {"substantive_changes": bool(substantive), "incidents": incidents,
            "tables": changes, "boundary_changed": boundary_changed,
            "sources": {"before": source_metadata(before), "after": source_metadata(after)}}


def markdown(report: dict) -> str:
    diff = report["comparison"]
    totals = diff["incidents"]["totals"]
    lines = ["# Source refresh review", "", f"Prepared: {report['created_at']}", "",
             "Substantive changes found." if diff["substantive_changes"] else "No substantive data changes. Fetch timestamps and release metadata may differ.", "",
             f"Incident rows: **{totals['before']:,} → {totals['after']:,}** ({totals['net_change']:+,}). "
             f"Added {totals['added']:,}; removed {totals['removed']:,}; revised {totals['revised_to']:,}.", "",
             f"Unresolved neighbourhood rows: **{totals['unresolved_before']:,} → {totals['unresolved_after']:,}**.", "",
             f"Data through: {diff['incidents']['data_through']['before']} → {diff['incidents']['data_through']['after']}", "",
             f"Vendored neighbourhood boundary changed: {'yes' if diff['boundary_changed'] else 'no'}.", "",
             "Validation passed: source coverage and values; complete aggregate build; monthly-to-annual reconciliation for every neighbourhood/category and city totals including unresolved and YTD records.", "",
             "## Incident changes by year and category", "", "| Year | Category | Before | After | Added | Removed | Revised from / to | Unresolved before / after |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for row in diff["incidents"]["by_year_category"]:
        lines.append(f"| {row['year']} | {row['category']} | {row['before']} | {row['after']} | {row['added']} | {row['removed']} | {row['revised_from']} / {row['revised_to']} | {row['unresolved_before']} / {row['unresolved_after']} |")
    lines += ["", diff["incidents"]["revision_method"], "", "## Population and context changes", ""]
    for name, changes in diff["tables"].items():
        lines += [f"### {name.replace('_', ' ').title()}: {len(changes)} changed rows", ""]
        for change in changes:
            lines.append(f"- {json.dumps(change['key'], ensure_ascii=False)}: {json.dumps(change['before'], ensure_ascii=False)} → {json.dumps(change['after'], ensure_ascii=False)}")
        lines.append("")
    lines += ["## Source dates and provenance", "", "```json", json.dumps(diff["sources"], indent=2, ensure_ascii=False), "```", "",
              "## Accept this reviewed candidate", "", "Accepted data is unchanged. Read this report before running:", "",
              "```sh", f"npm run refresh:apply -- {shlex.quote(report['review_path'])}", "```", "",
              "The command refuses changed accepted inputs or changed candidate files and repeats validation before applying. A normal build does not invalidate the review. After applying, run the release verification workflow.", ""]
    return "\n".join(lines)


def stage(accepted: Path, run: Path, from_data: Path | None = None) -> Path:
    accepted, run = accepted.resolve(), run.resolve()
    if run == accepted or accepted in run.parents:
        raise RuntimeError("Review staging must be outside accepted data.")
    run.mkdir(parents=True, exist_ok=False)
    baseline = manifest(accepted, managed_only=True)
    candidate = run / "candidate"
    data = candidate / "data"
    log = run / "validation.log"
    try:
        copy_sources(from_data.resolve() if from_data else accepted, data)
        if not from_data:
            import_sources(data, log)
        print(f"Validating staged sources in {run}", flush=True)
        validate_candidate(data, candidate / "public-data", log)
        diff = comparison(accepted, data)
        if manifest(accepted, managed_only=True) != baseline:
            raise RuntimeError("Accepted sources changed while preparing this review; stage again.")
        path = run / "review.json"
        report = {"schema_version": VERSION, "created_at": now(), "status": "validated",
                  "accepted_data": str(accepted), "review_path": str(path),
                  "accepted_manifest": baseline, "candidate_manifest": manifest(candidate),
                  "comparison": diff}
        (run / "review.md").write_text(markdown(report), encoding="utf-8")
        report["markdown_sha256"] = hashlib.sha256((run / "review.md").read_bytes()).hexdigest()
        write_json(path, report)
        print(f"Review ready: {run / 'review.md'}", flush=True)
        print("Substantive changes found." if diff["substantive_changes"] else "No substantive data changes.", flush=True)
        return path
    except BaseException as exc:
        write_json(run / "failure.json", {"created_at": now(), "error": str(exc), "accepted_data_unchanged_by_refresh": True})
        raise


def apply(review_path: Path) -> None:
    review_path = review_path.resolve()
    report = json.loads(review_path.read_text())
    if report.get("schema_version") != VERSION or report.get("status") != "validated":
        raise RuntimeError("This is not a validated refresh review.")
    run = review_path.parent
    accepted = Path(report["accepted_data"])
    candidate = run / "candidate"
    if accepted == candidate or accepted in candidate.parents or candidate in accepted.parents:
        raise RuntimeError("Accepted sources and review candidate must be separate trees.")
    if manifest(accepted, managed_only=True) != report["accepted_manifest"]:
        raise RuntimeError("Accepted source files changed since review; stage again.")
    if manifest(candidate) != report["candidate_manifest"]:
        raise RuntimeError("Candidate files changed since review; stage again.")
    if hashlib.sha256((run / "review.md").read_bytes()).hexdigest() != report.get("markdown_sha256"):
        raise RuntimeError("The human-readable review changed; stage again.")
    # A lock serializes refresh accept operations. Normal build output is not
    # locked because it is outside source-owned paths.
    lock = accepted.parent / ".crime-pulse-refresh.lock"
    try:
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise RuntimeError(f"Another refresh apply is active (lock: {lock}).")
    os.close(fd)
    try:
        work = Path(tempfile.mkdtemp(prefix=".crime-pulse-accept-", dir=accepted.parent))
        cleanup = True
        try:
            replacement = work / "sources"
            copy_sources(candidate / "data", replacement)
            validate_candidate(replacement, work / "public-data", work / "validation.log")
            # Prove the JSON summary still describes exactly what was reviewed.
            if comparison(accepted, replacement) != report["comparison"]:
                raise RuntimeError("Review summary does not match its source data; stage again.")
            if manifest(accepted, managed_only=True) != report["accepted_manifest"] or manifest(candidate) != report["candidate_manifest"]:
                raise RuntimeError("Sources or candidate changed during apply; stage again.")
            backup = work / "backup"
            backup.mkdir()
            moved = []
            try:
                # Only managed source directories move. Unrelated accepted data
                # (including a sitemap manifest updated by a concurrent build)
                # remains in place throughout acceptance.
                for name in SOURCE_DIRS:
                    (accepted / name).replace(backup / name)
                    moved.append(name)
                    (replacement / name).replace(accepted / name)
            except BaseException:
                try:
                    for name in reversed(moved):
                        if (accepted / name).exists():
                            shutil.rmtree(accepted / name)
                        (backup / name).replace(accepted / name)
                except BaseException as rollback_error:
                    cleanup = False
                    raise RuntimeError(f"Rollback could not finish; preserved original source backups in {backup}") from rollback_error
                raise
        finally:
            if cleanup:
                shutil.rmtree(work)
        print("Reviewed source archive accepted. Run npm run verify before shipping.")
    finally:
        lock.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    prepare = sub.add_parser("stage", help="Download into a candidate and produce a review.")
    prepare.add_argument("--accepted-data", type=Path, default=REPO / "data")
    prepare.add_argument("--run-dir", type=Path)
    prepare.add_argument("--from-data", type=Path, help="Offline replay from an existing imported data directory.")
    accept = sub.add_parser("apply", help="Explicitly accept one reviewed JSON artifact.")
    accept.add_argument("review", type=Path)
    args = parser.parse_args()
    try:
        if args.action == "stage":
            run = args.run_dir or REPO / ".refresh" / (datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + "-" + uuid.uuid4().hex[:6])
            stage(args.accepted_data, run, args.from_data)
        else:
            apply(args.review)
        return 0
    except (RuntimeError, OSError, ValueError, KeyError, subprocess.CalledProcessError) as exc:
        print(f"Refresh failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
