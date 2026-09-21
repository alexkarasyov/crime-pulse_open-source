#!/usr/bin/env python3
"""Shared, escape-aware Markdown-table parsing helpers.

The importers write data tables where a cell value may contain a literal
``|`` escaped as ``\\|`` (see ``markdown_cell`` in scripts/import_tps_csi.py).
Both the build aggregator and the population importer need to read those
tables back without tearing a pipe-bearing cell into an extra column, so the
parsing lives here once instead of being reimplemented per consumer.

Stdlib-only.
"""

from __future__ import annotations

import re
from pathlib import Path


_UNESCAPED_PIPE_RE = re.compile(r"(?<!\\)\|")


def split_pipe_row(line: str) -> list[str]:
    """Split a Markdown table row, preserving column count.

    Cell values can contain a literal ``|`` that the importers write escaped
    as ``\\|`` (see ``markdown_cell`` in scripts/import_tps_csi.py). We must
    split only on *unescaped* pipes, otherwise an offence/location string
    containing a pipe would be torn into an extra column and the row would
    fail the cell-count check below. After splitting we unescape ``\\|`` back
    to ``|`` so the data round-trips intact.
    """
    # Strip leading and trailing structural pipe + newline before splitting.
    stripped = line.strip()
    if stripped.startswith("|"):
        stripped = stripped[1:]
    # Only strip a *bare* trailing pipe (not an escaped one ending the cell).
    if stripped.endswith("|") and not stripped.endswith("\\|"):
        stripped = stripped[:-1]
    return [cell.strip().replace("\\|", "|") for cell in _UNESCAPED_PIPE_RE.split(stripped)]


def iter_markdown_rows(path: Path) -> list[dict[str, str]]:
    """Read a Markdown table and yield rows as dicts keyed by header."""
    rows: list[dict[str, str]] = []
    headers: list[str] | None = None
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.startswith("|"):
                continue
            cells = split_pipe_row(line)
            if headers is None:
                # First | row is the header.
                headers = cells
                continue
            # Skip the separator row (all dashes).
            if all(set(cell) <= {"-", ":", " "} for cell in cells):
                continue
            if len(cells) != len(headers):
                raise RuntimeError(
                    f"{path}: row has {len(cells)} cells, expected {len(headers)}: "
                    f"{cells!r}"
                )
            rows.append(dict(zip(headers, cells)))
    if headers is None:
        raise RuntimeError(f"{path}: no Markdown table found.")
    return rows
