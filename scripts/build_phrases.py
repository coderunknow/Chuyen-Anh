#!/usr/bin/env python3
"""Build `Learned_Phrase_List.md` and `data/phrases.json` from the phrase seeds.

The Markdown table is canonical for the app data, exactly like the vocabulary
pipeline. IDs are assigned in seed-file order, so adding a phrase appends an ID
and never renumbers an existing one.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterable

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from phrase_bank import TYPES, display_table, parse_table, phrase_key  # noqa: E402
from vocab_sources import (  # noqa: E402
    EXAM_ROOT,
    FRONT_MATTER_RE,
    build_exam_index,
    dedupe_sources,
    dictionary_source,
    load_registry,
    validate_sources,
    word_key,
)

DEFAULT_MARKDOWN = ROOT / "Learned_Phrase_List.md"
DEFAULT_JSON = ROOT / "data" / "phrases.json"
SEED_DIR = ROOT / "data" / "phrase-seed"
SEED_HEADER = ("phrase", "type", "meaning", "usage", "pattern", "level", "topic", "skills")
LEVELS = {"B1", "B2", "C1", "C2"}
SKILLS = {"reading", "writing", "cloze", "sentence-transformation", "grammar", "word-formation"}
TOPIC_RE = re.compile(r"^[a-z][a-z-]{2,24}$")
SEED_COLUMNS = 8


class LineIndex:
    """Case- and punctuation-folded exam lines with a word -> line index.

    A phrase is looked up only in lines that contain every content word, so the
    build stays linear instead of scanning the 4 MB corpus once per phrase.
    """

    def __init__(self, root: Path = ROOT) -> None:
        from vocab_sources import exam_files  # local import keeps module import cheap

        base = root / "De-chuyen-Anh-vao-10" if (root / "De-chuyen-Anh-vao-10").exists() else root
        self.lines: list[tuple[str, int, str]] = []
        self.words: dict[str, set[int]] = {}
        for path in exam_files(base):
            text = FRONT_MATTER_RE.sub("", path.read_text(encoding="utf-8", errors="replace"))
            relative = path.relative_to(base).as_posix()
            for number, line in enumerate(text.splitlines(), start=1):
                key = phrase_key(line)
                if not key or len(key) < 4:
                    continue
                position = len(self.lines)
                self.lines.append((relative, number, key))
                for word in set(key.split()):
                    self.words.setdefault(word, set()).add(position)

    def occurrences(self, phrase: str) -> list[tuple[str, int]]:
        needle = phrase_key(phrase)
        parts = needle.split()
        if not needle or not parts:
            return []
        candidates = [self.words.get(word, set()) for word in parts]
        if any(not candidate for candidate in candidates):
            return []
        pool = min(candidates, key=len)
        hits: list[tuple[str, int]] = []
        for position in pool:
            relative, number, key = self.lines[position]
            if f" {needle} " in f" {key} ":
                hits.append((relative, number))
        hits.sort()
        return hits


def read_seeds(directory: Path = SEED_DIR) -> list[dict[str, Any]]:
    seeds: list[dict[str, Any]] = []
    for path in sorted(directory.glob("*.tsv")):
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            cells = [cell.strip() for cell in line.split("\t")]
            if len(cells) != SEED_COLUMNS:
                raise ValueError(f"{path.name}:{number}: expected {SEED_COLUMNS} cells, found {len(cells)}")
            row = dict(zip(SEED_HEADER, cells))
            missing = [field for field in SEED_HEADER if not row[field]]
            if missing:
                raise ValueError(f"{path.name}:{number}: empty field(s) {missing}")
            if row["type"] not in TYPES:
                raise ValueError(f"{path.name}:{number}: type {row['type']!r} is not one of {list(TYPES)}")
            if row["level"] not in LEVELS:
                raise ValueError(f"{path.name}:{number}: level {row['level']!r} is not one of {sorted(LEVELS)}")
            if not TOPIC_RE.match(row["topic"]):
                raise ValueError(f"{path.name}:{number}: topic {row['topic']!r} must be a lowercase slug")
            skills = [skill.strip() for skill in row["skills"].split(",") if skill.strip()]
            if not skills or any(skill not in SKILLS for skill in skills):
                raise ValueError(f"{path.name}:{number}: skills {row['skills']!r} must be a subset of {sorted(SKILLS)}")
            if len(row["phrase"].split()) < 2 and row["type"] != "pattern":
                raise ValueError(f"{path.name}:{number}: {row['phrase']!r} is a single word; single words belong in the vocabulary table")
            seeds.append({**row, "skills": skills, "file": path.name, "line": number})
    return seeds


def build_rows(seeds: list[dict[str, Any]], root: Path = ROOT,
               index: "LineIndex | None" = None) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    index = index or LineIndex(root)
    # A phrase that is itself a vocabulary headword stays in the vocabulary table;
    # it is not duplicated into the phrase bank. Only the whole multi-word form is
    # compared, so a phrase made of existing single words is kept.
    vocabulary = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8")) \
        if (ROOT / "data" / "vocabulary.json").exists() else []
    vocab_keys = {word_key(entry["word"]): entry["id"] for entry in vocabulary if isinstance(entry, dict)}
    rows: list[dict[str, Any]] = []
    skipped: list[dict[str, str]] = []
    seen: dict[str, str] = {}
    registry = load_registry()
    for seed in seeds:
        key = phrase_key(seed["phrase"])
        if word_key(seed["phrase"]) in vocab_keys:
            skipped.append({"phrase": seed["phrase"],
                            "reason": f"already the vocabulary headword with ID {vocab_keys[word_key(seed['phrase'])]}",
                            "file": seed["file"], "line": str(seed["line"])})
            continue
        if key in seen:
            skipped.append({"phrase": seed["phrase"], "reason": f"duplicate of {seen[key]}",
                            "file": seed["file"], "line": str(seed["line"])})
            continue
        hits = index.occurrences(seed["phrase"])
        sources = [dictionary_source(seed["phrase"], seed["phrase"].replace(" ", "-"))]
        evidence = "dictionary"
        if hits:
            relative, line = hits[0]
            sources.append({
                "ref": "phrase-corpus",
                "locator": f"{relative}:L{line}",
                "supports": f"phrase occurs in {len(hits)} transcribed exam(s)",
            })
            evidence = "exam"
        row = {
            "id": f"P{len(rows) + 1:03d}",
            "phrase": seed["phrase"],
            "type": seed["type"],
            "meaning": seed["meaning"],
            "usage": seed["usage"],
            "pattern": seed["pattern"],
            "tags": [
                f"level:{seed['level']}",
                "level-source:editorial",
                f"topic:{seed['topic']}",
                f"type:{seed['type']}",
                f"source:{evidence}",
                *[f"skill:{skill}" for skill in seed["skills"]],
            ],
            "sources": dedupe_sources(sources),
        }
        problems = validate_sources(row["sources"], registry)
        if problems:
            raise ValueError(f"{seed['file']}:{seed['line']} ({seed['phrase']}): {'; '.join(problems)}")
        rows.append(row)
        seen[key] = row["id"]
    return rows, skipped


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the Markdown or JSON is out of date")
    parser.add_argument("--markdown", type=Path, default=DEFAULT_MARKDOWN)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--report", type=Path, help="write a JSON summary of the phrase bank")
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        seeds = read_seeds()
        rows, skipped = build_rows(seeds)
        rendered = display_table(rows)
        payload = json.dumps(rows, ensure_ascii=False, indent=2) + "\n"
    except (OSError, ValueError, KeyError) as error:
        print(f"Phrase build failed: {error}", file=sys.stderr)
        return 1

    if args.report:
        by_type: dict[str, int] = {}
        by_level: dict[str, int] = {}
        by_evidence: dict[str, int] = {}
        for row in rows:
            by_type[row["type"]] = by_type.get(row["type"], 0) + 1
            level = next(tag.split(":", 1)[1] for tag in row["tags"] if tag.startswith("level:"))
            by_level[level] = by_level.get(level, 0) + 1
            evidence = next(tag.split(":", 1)[1] for tag in row["tags"] if tag.startswith("source:"))
            by_evidence[evidence] = by_evidence.get(evidence, 0) + 1
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps({
            "generatedBy": "scripts/build_phrases.py",
            "phrases": len(rows),
            "seedsRead": len(seeds),
            "skippedSeeds": skipped,
            "byType": dict(sorted(by_type.items())),
            "byLevel": dict(sorted(by_level.items())),
            "byEvidence": dict(sorted(by_evidence.items())),
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if args.check:
        current_markdown = args.markdown.read_text(encoding="utf-8")
        current_json = args.json.read_text(encoding="utf-8")
        stale = []
        if current_markdown != rendered:
            stale.append(str(args.markdown.relative_to(ROOT)))
        if current_json != payload:
            stale.append(str(args.json.relative_to(ROOT)))
        if stale:
            print(f"Phrase data out of sync: {', '.join(stale)}; run python scripts/build_phrases.py", file=sys.stderr)
            return 1
        print(f"Phrase data matches {len(rows)} phrases.")
        return 0

    args.markdown.write_text(rendered, encoding="utf-8")
    args.json.write_text(payload, encoding="utf-8")
    print(f"Wrote {len(rows)} phrases ({len(skipped)} seed(s) skipped) to "
          f"{args.markdown.relative_to(ROOT)} and {args.json.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
