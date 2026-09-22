#!/usr/bin/env python3
"""Small, dependency-free validator for data/vocabulary.json.

This is intentionally independent from Node/npm so deployment can validate the
source data and upload the static files without a build step.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any

DEFAULT_PATH = Path(__file__).resolve().parents[1] / "data" / "vocabulary.json"
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")


def problem(errors: list[str], index: int, entry: Any, message: str) -> None:
    entry_id = entry.get("id", "(missing)") if isinstance(entry, dict) else "(malformed)"
    word = entry.get("word", "(missing)") if isinstance(entry, dict) else "(missing)"
    errors.append(
        f"Entry: {entry_id} (index {index})\n"
        f"Word: {word}\n"
        f"Problem: {message}"
    )


def validate(data: Any) -> list[str]:
    """Return human-readable validation errors. An empty list means valid."""
    errors: list[str] = []
    if not isinstance(data, list):
        return ["Document\nWord: (none)\nProblem: root value must be a JSON array"]
    if not data:
        return ["Document\nWord: (none)\nProblem: vocabulary must not be empty"]

    ids: dict[str, list[int]] = defaultdict(list)
    words: dict[str, list[int]] = defaultdict(list)
    for index, entry in enumerate(data, start=1):
        if not isinstance(entry, dict):
            problem(errors, index, entry, "entry must be an object")
            continue

        entry_id = entry.get("id")
        word = entry.get("word")
        pos = entry.get("pos")
        meaning = entry.get("meaning")
        if not isinstance(entry_id, str) or not entry_id.strip():
            problem(errors, index, entry, "missing or empty id")
        elif not ID_RE.fullmatch(entry_id.strip()):
            problem(errors, index, entry, "id may only contain letters, numbers, dot, underscore, and hyphen")
        else:
            ids[entry_id.strip().casefold()].append(index)

        if not isinstance(word, str) or not word.strip():
            problem(errors, index, entry, "missing or empty word")
        elif len(word.strip()) > 120:
            problem(errors, index, entry, f"word is too long ({len(word.strip())} characters)")
        else:
            words[word.strip().casefold()].append(index)

        if not isinstance(pos, str) or not pos.strip():
            problem(errors, index, entry, "missing or empty pos")
        if not isinstance(meaning, str) or not meaning.strip():
            problem(errors, index, entry, "missing or empty meaning")

        examples = entry.get("examples")
        if not isinstance(examples, list):
            problem(errors, index, entry, "examples must be an array")
        else:
            for example_index, example in enumerate(examples, start=1):
                if not isinstance(example, dict):
                    problem(errors, index, entry, f"examples[{example_index}] must be an object with en and vi")
                    continue
                if not isinstance(example.get("en"), str) or not example["en"].strip():
                    problem(errors, index, entry, f"examples[{example_index}].en must be a non-empty string")
                if not isinstance(example.get("vi"), str) or not example["vi"].strip():
                    problem(errors, index, entry, f"examples[{example_index}].vi must be a non-empty string")

        tags = entry.get("tags")
        if not isinstance(tags, list) or any(not isinstance(tag, str) or not tag.strip() for tag in tags):
            problem(errors, index, entry, "tags must be an array of non-empty strings")
        difficulty = entry.get("difficulty")
        if isinstance(difficulty, bool) or not isinstance(difficulty, (int, float)) or not 0 <= difficulty <= 5:
            problem(errors, index, entry, "difficulty must be a number from 0 to 5")

    for entry_id, indexes in ids.items():
        if len(indexes) > 1:
            errors.append(f"Entry: {', '.join(map(str, indexes))}\nWord: (duplicate id)\nProblem: duplicate id {entry_id!r}")
    for word, indexes in words.items():
        if len(indexes) > 1:
            errors.append(f"Entry: {', '.join(map(str, indexes))}\nWord: {word}\nProblem: duplicate word (case-insensitive)")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate Chuyen-Anh vocabulary JSON")
    parser.add_argument("path", nargs="?", type=Path, default=DEFAULT_PATH)
    args = parser.parse_args(argv)
    print("Vocabulary validation")
    try:
        raw = args.path.read_text(encoding="utf-8")
        data = json.loads(raw)
    except FileNotFoundError:
        print(f"❌ Vocabulary file not found: {args.path}")
        return 1
    except json.JSONDecodeError as error:
        print("❌ Vocabulary validation failed")
        print(f"Problem: invalid JSON at line {error.lineno}, column {error.colno}: {error.msg}")
        return 1
    except OSError as error:
        print(f"❌ Cannot read vocabulary: {error}")
        return 1

    errors = validate(data)
    total = len(data) if isinstance(data, list) else 0
    print(f"Total entries: {total}")
    if errors:
        print(f"\n❌ Vocabulary validation failed ({len(errors)} problem(s))\n")
        for item in errors:
            print(item)
            print()
        return 1
    print("Duplicate IDs: 0")
    print("Duplicate words: 0")
    print("✅ Vocabulary validation passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
