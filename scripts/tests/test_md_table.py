#!/usr/bin/env python3
"""Tests for scripts/_md_table.py — escape-aware Markdown-table parsing."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from _md_table import iter_markdown_rows, split_pipe_row


class SplitPipeRowTests(unittest.TestCase):
    """split_pipe_row: structural-pipe stripping and \\| unescaping."""

    def test_plain_row(self) -> None:
        self.assertEqual(split_pipe_row("| a | b | c |"), ["a", "b", "c"])

    def test_leading_pipe_stripped(self) -> None:
        # Leading structural pipe is removed; no empty first cell appears.
        cells = split_pipe_row("| first | second |")
        self.assertEqual(cells[0], "first")
        self.assertEqual(len(cells), 2)

    def test_no_leading_pipe(self) -> None:
        # A row without a leading pipe still splits on unescaped pipes.
        self.assertEqual(split_pipe_row("a | b"), ["a", "b"])

    def test_escaped_pipe_round_trips(self) -> None:
        # An escaped \| inside a cell must not tear the cell into two
        # columns, and must unescape back to a literal |.
        self.assertEqual(
            split_pipe_row("| Theft \\| Robbery | 52 Division |"),
            ["Theft | Robbery", "52 Division"],
        )

    def test_multiple_escaped_pipes_in_one_cell(self) -> None:
        self.assertEqual(
            split_pipe_row("| a\\|b\\|c | d |"),
            ["a|b|c", "d"],
        )

    def test_bare_trailing_pipe_stripped(self) -> None:
        # The bare trailing pipe is structural, not data.
        self.assertEqual(split_pipe_row("| a | b |"), ["a", "b"])
        self.assertEqual(split_pipe_row("| a | b"), ["a", "b"])

    def test_escaped_trailing_pipe_kept(self) -> None:
        # A cell whose value ends with an escaped pipe keeps that pipe:
        # only a *bare* trailing pipe is stripped as structure.
        self.assertEqual(split_pipe_row("| a | ends with \\|"), ["a", "ends with |"])

    def test_cell_that_is_only_a_pipe(self) -> None:
        self.assertEqual(split_pipe_row("| \\| | b |"), ["|", "b"])

    def test_cells_are_whitespace_stripped(self) -> None:
        self.assertEqual(split_pipe_row("|   padded   |  x  |"), ["padded", "x"])

    def test_round_trip_with_writer_escape(self) -> None:
        # Simulate the importer's markdown_cell escaping and confirm the
        # reader restores the original value.
        original = "OVER $5000 | UNDER $5000"
        written = original.replace("|", "\\|")
        line = "| " + written + " | other |"
        self.assertEqual(split_pipe_row(line), [original, "other"])


class IterMarkdownRowsTests(unittest.TestCase):
    """iter_markdown_rows: temp-file driven table parsing."""

    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.tmp_dir = Path(self._tmp.name)

    def _write(self, content: str) -> Path:
        path = self.tmp_dir / "table.md"
        path.write_text(content, encoding="utf-8")
        return path

    def test_happy_path(self) -> None:
        path = self._write(
            "# TITLE\n"
            "\n"
            "Some prose that is not part of the table.\n"
            "\n"
            "| event_id | category |\n"
            "| --- | --- |\n"
            "| GO-1 | Assault |\n"
            "| GO-2 | Robbery |\n"
        )
        rows = iter_markdown_rows(path)
        self.assertEqual(
            rows,
            [
                {"event_id": "GO-1", "category": "Assault"},
                {"event_id": "GO-2", "category": "Robbery"},
            ],
        )

    def test_separator_row_variants_skipped(self) -> None:
        # Separator cells may use dashes, colons, and spaces.
        path = self._write(
            "| a | b |\n"
            "| :--- | ---: |\n"
            "| 1 | 2 |\n"
        )
        rows = iter_markdown_rows(path)
        self.assertEqual(rows, [{"a": "1", "b": "2"}])

    def test_non_pipe_lines_ignored(self) -> None:
        path = self._write(
            "| h1 | h2 |\n"
            "| --- | --- |\n"
            "This line is ignored entirely.\n"
            "| v1 | v2 |\n"
            "  | indented pipe lines are ignored too | x |\n"
        )
        rows = iter_markdown_rows(path)
        self.assertEqual(rows, [{"h1": "v1", "h2": "v2"}])

    def test_escaped_pipe_preserves_column_count(self) -> None:
        path = self._write(
            "| offence | division |\n"
            "| --- | --- |\n"
            "| Theft \\| Mischief | D14 |\n"
        )
        rows = iter_markdown_rows(path)
        self.assertEqual(rows, [{"offence": "Theft | Mischief", "division": "D14"}])

    def test_cell_count_mismatch_raises(self) -> None:
        path = self._write(
            "| a | b |\n"
            "| --- | --- |\n"
            "| 1 | 2 | 3 |\n"
        )
        with self.assertRaises(RuntimeError):
            iter_markdown_rows(path)

    def test_no_table_raises(self) -> None:
        path = self._write("# Just a heading\n\nNo pipes anywhere.\n")
        with self.assertRaises(RuntimeError):
            iter_markdown_rows(path)

    def test_empty_file_raises(self) -> None:
        path = self._write("")
        with self.assertRaises(RuntimeError):
            iter_markdown_rows(path)

    def test_header_only_yields_no_rows(self) -> None:
        path = self._write("| a | b |\n| --- | --- |\n")
        self.assertEqual(iter_markdown_rows(path), [])


if __name__ == "__main__":
    unittest.main()
