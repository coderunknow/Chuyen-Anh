#!/usr/bin/env python3
"""Read and write the machine-readable phrase-bank table.

The phrase bank is a separate data source with its own ID space (`P001`,
`P002`, ...) so a phrase can never collide with a vocabulary ID. Its schema is:

    ID | PHRASE | TYPE | MEANING | USAGE | PATTERN | TAGS | SOURCES

`TAGS` and `SOURCES` are JSON arrays inside one cell, following the vocabulary
table's convention. Rendering is deterministic, so `--check` can compare bytes.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PATH = ROOT / "Learned_Phrase_List.md"
COLUMNS = ("ID", "PHRASE", "TYPE", "MEANING", "USAGE", "PATTERN", "TAGS", "SOURCES")
PHRASE_ID_RE = re.compile(r"^P\d{3,4}$")
SEPARATOR_CELL = re.compile(r"^:?-{3,}:?$")
TYPES = (
    "phrasal-verb",
    "idiom",
    "collocation",
    "dependent-preposition",
    "linker-phrase",
    "pattern",
    "fixed-expression",
)
TAG_NAMESPACES = {"level", "level-source", "topic", "skill", "source", "type"}
TAG_RE = re.compile(r"^[a-z][a-z-]*(?::[A-Za-z0-9][A-Za-z0-9-]*)?$")
SOURCE_KEYS = {"ref", "locator", "supports", "url"}


def phrase_key(value: str) -> str:
    """Collision key for phrase forms.

    Lower-cases, normalises Unicode, folds hyphen/en-dash/em-dash and typographic
    apostrophes, removes punctuation and collapses whitespace, so `well-being`,
    `well being` and `Well-Being` are one phrase. Words are not stemmed: a
    different word order or a different word stays a different phrase.
    """
    text = unicodedata.normalize("NFKC", value).lower()
    text = text.replace("\u2019", "'").replace("\u2018", "'")
    text = re.sub(r"[\u2010-\u2015-]", " ", text)
    text = re.sub(r"[^a-z0-9' ]+", " ", text)
    return " ".join(text.split())


def split_table_row(line: str) -> list[str]:
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


def parse_table(path: Path = DEFAULT_PATH) -> list[dict[str, Any]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    header_index = None
    for index, line in enumerate(lines):
        if not line.lstrip().startswith("|"):
            continue
        if tuple(cell.upper() for cell in split_table_row(line)) == COLUMNS:
            header_index = index
            break
    if header_index is None:
        raise ValueError(f"Missing phrase table header in {path}")
    separator = split_table_row(lines[header_index + 1])
    if len(separator) != len(COLUMNS) or not all(SEPARATOR_CELL.fullmatch(cell) for cell in separator):
        raise ValueError("Phrase table has an invalid Markdown separator row")

    records: list[dict[str, Any]] = []
    for line_number, line in enumerate(lines[header_index + 2 :], start=header_index + 3):
        if not line.strip():
            continue
        if not line.lstrip().startswith("|"):
            break
        cells = split_table_row(line)
        if len(cells) != len(COLUMNS):
            raise ValueError(f"Line {line_number}: expected {len(COLUMNS)} columns, found {len(cells)}")
        row = dict(zip(COLUMNS, cells))
        if not PHRASE_ID_RE.fullmatch(row["ID"]):
            raise ValueError(f"Line {line_number}: phrase ID must look like P001")
        if not row["PHRASE"] or not row["TYPE"] or not row["MEANING"]:
            raise ValueError(f"Line {line_number}: PHRASE, TYPE and MEANING cannot be empty")
        if row["TYPE"] not in TYPES:
            raise ValueError(f"Line {line_number}: TYPE {row['TYPE']!r} is not one of {list(TYPES)}")
        record: dict[str, Any] = {
            "id": row["ID"],
            "phrase": row["PHRASE"],
            "type": row["TYPE"],
            "meaning": row["MEANING"],
            "usage": row["USAGE"],
            "pattern": row["PATTERN"],
        }
        try:
            tags = json.loads(row["TAGS"])
            sources = json.loads(row["SOURCES"])
        except json.JSONDecodeError as error:
            raise ValueError(f"Line {line_number}: TAGS/SOURCES must be JSON arrays: {error.msg}") from error
        if not isinstance(tags, list) or any(not isinstance(tag, str) or not tag.strip() for tag in tags):
            raise ValueError(f"Line {line_number}: TAGS must be an array of non-empty strings")
        record["tags"] = tags
        record["sources"] = parse_sources(sources, line_number)
        records.append(record)

    expected = [f"P{number:03d}" for number in range(1, len(records) + 1)]
    actual = [record["id"] for record in records]
    if actual != expected:
        raise ValueError("Phrase IDs must be sequential, starting at P001")
    return records


def parse_sources(value: Any, line_number: int | str = "?") -> list[dict[str, str]]:
    if not isinstance(value, list) or not value:
        raise ValueError(f"Line {line_number}: SOURCES must be a non-empty array of source objects")
    parsed: list[dict[str, str]] = []
    for position, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Line {line_number}: SOURCES[{position}] must be an object")
        unknown = set(item) - SOURCE_KEYS
        if unknown:
            raise ValueError(f"Line {line_number}: SOURCES[{position}] has unknown keys {sorted(unknown)}")
        for key in ("ref", "supports"):
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


def escape_cell(value: str) -> str:
    text = str(value)
    if "\n" in text or "\r" in text:
        raise ValueError("Phrase table cells must be single-line text")
    return text.replace("\\", "\\\\").replace("|", "\\|")


def render_table(records: list[dict[str, Any]]) -> str:
    lines = [
        "| " + " | ".join(COLUMNS) + " |",
        "| " + " | ".join("---" for _ in COLUMNS) + " |",
    ]
    for record in records:
        values = [
            record["id"],
            record["phrase"],
            record["type"],
            record["meaning"],
            record["usage"],
            record["pattern"],
            json.dumps(record["tags"], ensure_ascii=False, separators=(",", ":")),
            json.dumps(record["sources"], ensure_ascii=False, separators=(",", ":")),
        ]
        lines.append("| " + " | ".join(escape_cell(value) for value in values) + " |")
    return "\n".join(lines)


PREAMBLE = """# Learned Phrase List — Chuyên Anh

> The phrase bank is a separate data source from `Learned_Vocabulary_List.md`. Its IDs are `P001`, `P002`, … so they can never be confused with vocabulary IDs, and its progress is stored under its own key (`chuyen-anh.phrases.v1`). Phrases are **not** counted towards the 3,000 vocabulary requirement.

## Schema

`ID | PHRASE | TYPE | MEANING | USAGE | PATTERN | TAGS | SOURCES`

- `TYPE` is one of `phrasal-verb`, `idiom`, `collocation`, `dependent-preposition`, `linker-phrase`, `pattern`, `fixed-expression`.
- `MEANING` is a Vietnamese gloss written for a learner preparing for the specialist English entrance exam.
- `USAGE` says when the phrase is used and what it contrasts with; it is not a copied dictionary definition.
- `PATTERN` is the grammatical frame a learner must reproduce (e.g. `look forward to + V-ing`).
- `TAGS` uses the same namespaces as the vocabulary table: `level:`, `level-source:`, `topic:`, `skill:`, `source:`.
- `SOURCES` uses the same source registry as the vocabulary table, [`docs/vocabulary-sources.json`](docs/vocabulary-sources.json). An `exam` source records that the phrase occurs in a transcribed paper in this repository, with the file and line; a `dictionary` source is a locator for the entry and is not a claim that the page was fetched offline.

## Rows

Rows are generated by `scripts/build_phrases.py` from `data/phrase-seed/*.tsv` (seed line: `phrase<TAB>type<TAB>meaning<TAB>usage<TAB>pattern<TAB>level<TAB>topic<TAB>skills`). Duplicate forms are rejected after case, Unicode, punctuation and spacing folding; a phrase whose component words already exist in the vocabulary table is still a separate entry. Run `python scripts/build_phrases.py --check` to prove this file matches the seeds.

## Phrases
"""


def display_table(records: list[dict[str, Any]]) -> str:
    return PREAMBLE + render_table(records) + "\n"
