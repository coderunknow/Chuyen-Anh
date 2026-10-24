#!/usr/bin/env python3
"""Read and write the machine-readable Markdown vocabulary table."""
from __future__ import annotations

import json
from pathlib import Path
import re
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATH = ROOT / "Learned_Vocabulary_List.md"
COLUMNS = (
    "ID",
    "WORD",
    "POS",
    "MEANING",
    "WORD_FAMILY",
    "SYNONYMS",
    "ANTONYMS",
    "COLLOCATIONS",
    "REGISTER",
    "CONNOTATION",
    "NOTES",
    "TAGS",
    "SOURCES",
)
TEXT_COLUMNS = {
    "WORD_FAMILY": "wordFamily",
    "REGISTER": "register",
    "CONNOTATION": "connotation",
    "NOTES": "notes",
}
ARRAY_KEYS = {
    "SYNONYMS": "synonyms",
    "ANTONYMS": "antonyms",
    "COLLOCATIONS": "collocations",
    "TAGS": "tags",
}
SOURCE_KEYS = {"ref", "supports", "locator", "url"}
SOURCE_REQUIRED = ("ref", "supports")
LEGACY_COLUMNS = tuple(column for column in COLUMNS if column != "SOURCES")
SEPARATOR_CELL = re.compile(r"^:?-{3,}:?$")


def split_table_row(line: str) -> list[str]:
    """Split one Markdown table row, decoding escaped pipes and backslashes."""
    line = line.strip()
    if not line.startswith("|"):
        raise ValueError("table row must start with '|'")
    line = line[1:]
    if line.endswith("|"):
        line = line[:-1]

    cells: list[str] = []
    cell: list[str] = []
    index = 0
    while index < len(line):
        char = line[index]
        if char == "\\" and index + 1 < len(line) and line[index + 1] in {"\\", "|"}:
            cell.append(line[index + 1])
            index += 2
            continue
        if char == "|":
            cells.append("".join(cell).strip())
            cell.clear()
        else:
            cell.append(char)
        index += 1
    cells.append("".join(cell).strip())
    return cells


def parse_sources(value: Any, line_number: int | str = "?") -> list[dict[str, str]]:
    """Validate the structured provenance array stored in one SOURCES cell.

    Every source is an object with a registry `ref`, an optional `locator`
    (file path with line, page, or dictionary headword) and a `supports`
    statement describing what the source actually backs. Unknown keys are
    rejected so a typo cannot hide a missing field.
    """
    if not isinstance(value, list) or not value:
        raise ValueError(f"Line {line_number}: SOURCES must be a non-empty array of source objects")
    parsed: list[dict[str, str]] = []
    for position, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Line {line_number}: SOURCES[{position}] must be an object")
        unknown = set(item) - SOURCE_KEYS
        if unknown:
            raise ValueError(f"Line {line_number}: SOURCES[{position}] has unknown keys {sorted(unknown)}")
        for key in SOURCE_REQUIRED:
            if not isinstance(item.get(key), str) or not item[key].strip():
                raise ValueError(f"Line {line_number}: SOURCES[{position}] needs a non-empty {key}")
        entry = {"ref": item["ref"].strip(), "supports": item["supports"].strip()}
        for key in ("locator", "url"):
            if key in item:
                if not isinstance(item[key], str) or not item[key].strip():
                    raise ValueError(f"Line {line_number}: SOURCES[{position}].{key} must be a non-empty string")
                entry[key] = item[key].strip()
        parsed.append(entry)
    return parsed


def parse_table(path: Path = DEFAULT_PATH) -> list[dict[str, Any]]:
    """Parse the single fixed-schema vocabulary table from Markdown."""
    lines = path.read_text(encoding="utf-8").splitlines()
    header_index = None
    for index, line in enumerate(lines):
        if not line.lstrip().startswith("|"):
            continue
        cells = split_table_row(line)
        if tuple(cell.upper() for cell in cells) in (COLUMNS, LEGACY_COLUMNS):
            header_index = index
            break
    if header_index is None:
        raise ValueError(f"Missing vocabulary table header in {path}")
    if header_index + 1 >= len(lines):
        raise ValueError("Vocabulary table is missing its Markdown separator row")

    header = tuple(cell.upper() for cell in split_table_row(lines[header_index]))
    columns = COLUMNS if header == COLUMNS else LEGACY_COLUMNS
    if len(separator := split_table_row(lines[header_index + 1])) != len(columns) or not all(
        SEPARATOR_CELL.fullmatch(cell) for cell in separator
    ):
        raise ValueError("Vocabulary table has an invalid Markdown separator row")

    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(lines[header_index + 2 :], start=header_index + 3):
        if not line.strip():
            continue
        if not line.lstrip().startswith("|"):
            break
        cells = split_table_row(line)
        if len(cells) != len(columns):
            raise ValueError(f"Line {line_number}: expected {len(columns)} columns, found {len(cells)}")
        row = dict(zip(columns, cells))
        if not row["ID"].isdigit():
            raise ValueError(f"Line {line_number}: ID must be a positive integer")
        if not row["WORD"] or not row["POS"] or not row["MEANING"]:
            raise ValueError(f"Line {line_number}: WORD, POS, and MEANING cannot be empty")

        record: dict[str, Any] = {
            "id": row["ID"],
            "word": row["WORD"],
            "pos": row["POS"],
            "meaning": row["MEANING"],
        }
        for column, key in TEXT_COLUMNS.items():
            record[key] = row[column]
        for column, key in ARRAY_KEYS.items():
            try:
                value = json.loads(row[column])
            except json.JSONDecodeError as error:
                raise ValueError(f"Line {line_number}: {column} must be a JSON array: {error.msg}") from error
            if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
                raise ValueError(f"Line {line_number}: {column} must be an array of non-empty strings")
            record[key] = value
        if "SOURCES" not in columns:
            record["sources"] = []
            records.append(record)
            continue
        try:
            sources = json.loads(row["SOURCES"])
        except json.JSONDecodeError as error:
            raise ValueError(f"Line {line_number}: SOURCES must be a JSON array: {error.msg}") from error
        record["sources"] = parse_sources(sources, line_number)
        records.append(record)

    expected_ids = [str(number) for number in range(1, len(records) + 1)]
    actual_ids = [record["id"] for record in records]
    if actual_ids != expected_ids:
        raise ValueError("Vocabulary IDs must be sequential, starting at 1")
    return records


def escape_cell(value: str) -> str:
    """Escape one-line text for a Markdown table without losing slashes/pipes."""
    text = str(value)
    if "\n" in text or "\r" in text:
        raise ValueError("Vocabulary table cells must be single-line text")
    return text.replace("\\", "\\\\").replace("|", "\\|")


def render_table(records: list[dict[str, Any]]) -> str:
    """Render canonical records as a regular Markdown table."""
    lines = [
        "| " + " | ".join(COLUMNS) + " |",
        "| " + " | ".join("---" for _ in COLUMNS) + " |",
    ]
    for record in records:
        values = [
            record["id"],
            record["word"],
            record["pos"],
            record["meaning"],
            record["wordFamily"],
            json.dumps(record["synonyms"], ensure_ascii=False, separators=(",", ":")),
            json.dumps(record["antonyms"], ensure_ascii=False, separators=(",", ":")),
            json.dumps(record["collocations"], ensure_ascii=False, separators=(",", ":")),
            record["register"],
            record["connotation"],
            record["notes"],
            json.dumps(record["tags"], ensure_ascii=False, separators=(",", ":")),
            json.dumps(record["sources"], ensure_ascii=False, separators=(",", ":")),
        ]
        lines.append("| " + " | ".join(escape_cell(value) for value in values) + " |")
    return "\n".join(lines)


def display_table(records: list[dict[str, Any]]) -> str:
    """Return the documentation header and canonical vocabulary table."""
    preamble = """# Learned Vocabulary Log — Chuyên Anh

> Machine-readable Markdown table with one fixed-schema row per ID. `ID` is numeric; `WORD`, `POS`, `MEANING`, `WORD_FAMILY`, `REGISTER`, `CONNOTATION`, `NOTES` and `SOURCES` are text cells.
> `SYNONYMS`, `ANTONYMS`, `COLLOCATIONS`, `TAGS` and `SOURCES` use JSON arrays/objects inside one cell. Empty text cells and empty JSON arrays mean that the source does not provide that information; they are not inferred. `TAGS` retains existing app tags and the meanings of legacy difficulty markers.
> For IDs 614–913, `WORD_FAMILY` comes only from the explicitly labeled source field. `NOTES` preserves the original distinction and source citation; those notes are not reclassified as synonyms, antonyms, collocations, register, or connotation.

## About IDs 614–913

These 300 source-backed entries were added on 2026-09-30. They prioritize reading, writing, word formation, and commonly confused pairs. Source citations point to reproduced specialist English entrance exams from 2022–2026; they show that a form occurs in the source, not that it was necessarily a correct answer or a model sentence. See [the evidence and editorial review](docs/vocabulary-300-review.md).

The earlier note that these entries did not replace `data/vocabulary.json` was superseded by the user's 2026-10-06 request to include all 913 entries in the standalone app.

## Structured provenance (`SOURCES`)

Every active row carries at least one source object:

```json
{"ref": "<registry id>", "locator": "<where>", "supports": "<what the source backs>", "url": "<optional direct link>"}
```

`ref` must exist in [`docs/vocabulary-sources.json`](docs/vocabulary-sources.json), which states the title, publisher, access mode, locator scheme, what each source can support, and its limits. `locator` is a file path with a line number for a transcription in `De-chuyen-Anh-vao-10/`, a dictionary headword, or the ID of the originating row. `supports` is deliberately narrow: an exam transcription supports only the occurrence of a form, never a meaning, a part of speech, or an answer key. A dictionary reference supports the spelling and part of speech of a headword; it is not a fetched-and-verified claim when the offline build could not reach the dictionary.

`NOTES` keeps its historical prose. New rows state provenance in `SOURCES` instead of free text, so the source is machine-checkable.

## Rows added for v1.0.0-beta7 (ID 914 onward)

Rows from 914 onward come from the reviewed seed set in `data/vocab-seed/*.tsv`, materialised by `scripts/expand_vocabulary.py` (run with `--check` to prove this file matches the seeds). Each seed line is `word<TAB>pos<TAB>meaning<TAB>level<TAB>topic<TAB>type<TAB>skills`. The seed files record editorial decisions only; provenance is derived and stored per row:

- An exam transcription hit adds an `exam-corpus` source with a file-and-line locator, so the occurrence can be re-checked in this repository.
- Every row adds the `cambridge` dictionary reference for spelling and part of speech.
- Rows with no transcription hit keep only the dictionary reference. They are editorial selections for the entrance-exam syllabus, labelled as such; no row claims exam occurrence without a locator.

Duplicate handling is automated and reported in `docs/vocabulary-3000-audit.md`: a seed candidate is skipped when its normalized form (NFD, case, whitespace) already exists, when it is only an inflection of an existing headword, or when it is only an -ise/-ize, -our/-or, -re/-er or -lled/-led spelling variant of one. Tags use namespaces: `level:<CEFR>`, `level-source:editorial`, `topic:<topic>`, `type:<kind>`, `skill:<exam skill>`, `source:<evidence type>`. `level-source:editorial` marks an estimated band; no row claims a dictionary-stated CEFR level.
"""
    return preamble + render_table(records) + "\n"
